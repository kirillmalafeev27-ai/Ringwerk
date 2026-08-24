import {
  evaluateRecallAnswer,
  RecallEvaluationRequestError,
} from "@/server/recall-evaluation";

const RATE_WINDOW_MS = 60_000;
const CLIENT_LIMIT = 12;
const GLOBAL_LIMIT = 60;
const MAX_REQUEST_BYTES = 12_000;

const requestsByClient = new Map<string, number[]>();
let globalRequests: number[] = [];

function clientKey(request: Request) {
  const cloudflareRequest = request as Request & { cf?: unknown };
  const cloudflareAddress = cloudflareRequest.cf ? request.headers.get("cf-connecting-ip") : null;
  const forwardedAddress = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return (cloudflareAddress ?? forwardedAddress ?? request.headers.get("x-real-ip") ?? "shared")
    .trim()
    .slice(0, 96);
}

function withinRateLimit(request: Request) {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  globalRequests = globalRequests.filter((time) => time > cutoff);
  if (globalRequests.length >= GLOBAL_LIMIT) return false;

  const client = clientKey(request);
  const recent = (requestsByClient.get(client) ?? []).filter((time) => time > cutoff);
  if (recent.length >= CLIENT_LIMIT) {
    requestsByClient.set(client, recent);
    return false;
  }

  recent.push(now);
  globalRequests.push(now);
  requestsByClient.set(client, recent);
  if (requestsByClient.size > 2_000) {
    for (const [key, times] of requestsByClient) {
      if (!times.some((time) => time > cutoff)) requestsByClient.delete(key);
    }
  }
  return true;
}

async function readJsonBody(request: Request) {
  const advertisedLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_REQUEST_BYTES) {
    throw new RecallEvaluationRequestError("Request body is too large", 413);
  }

  if (!request.body) throw new RecallEvaluationRequestError("Request body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RecallEvaluationRequestError("Request body is too large", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof RecallEvaluationRequestError) throw error;
    throw new RecallEvaluationRequestError("Invalid request body");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RecallEvaluationRequestError("Invalid JSON body");
  }
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function POST(request: Request) {
  if (!withinRateLimit(request)) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...responseHeaders(), "Retry-After": "60" } },
    );
  }

  try {
    const input = await readJsonBody(request);
    const evaluation = await evaluateRecallAnswer(input);
    return Response.json(evaluation, { headers: responseHeaders() });
  } catch (error) {
    const status = error instanceof RecallEvaluationRequestError ? error.statusCode : 503;
    return Response.json(
      { error: status === 413 ? "request_too_large" : status === 400 ? "invalid_request" : "evaluation_unavailable" },
      { status, headers: responseHeaders() },
    );
  }
}
