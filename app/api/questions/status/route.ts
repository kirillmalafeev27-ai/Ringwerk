import { isQuestionGenerationReady } from "@/server/question-generation";

export function GET() {
  return Response.json(
    { ready: isQuestionGenerationReady() },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
