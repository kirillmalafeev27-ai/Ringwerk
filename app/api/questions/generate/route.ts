import { generateQuestions, QuestionRequestError } from "@/server/question-generation";

const requestsByClient = new Map<string, number[]>();
let globalRequests: number[] = [];
const RATE_WINDOW_MS = 60_000;
const CLIENT_LIMIT = 6;
const GLOBAL_LIMIT = 30;

function clientKey(request: Request) {
  const cloudflareRequest = request as Request & { cf?: unknown };
  const cloudflareAddress = cloudflareRequest.cf ? request.headers.get("cf-connecting-ip") : null;
  // Northflank's edge is the closest proxy, so the last forwarded address is
  // safer than the user-controlled first entry. The global ceiling below is
  // authoritative even if every client header is forged.
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

export async function POST(request: Request) {
  if (!withinRateLimit(request)) {
    return Response.json({ questions: [] }, { status: 429, headers: { "Retry-After": "60" } });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ questions: [] }, { status: 400 });
  }

  try {
    const questions = await generateQuestions(input);
    return Response.json(
      { questions },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    const status = error instanceof QuestionRequestError ? error.statusCode : 503;
    return Response.json({ questions: [] }, { status });
  }
}
