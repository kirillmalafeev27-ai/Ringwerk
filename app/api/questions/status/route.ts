import { isQuestionGenerationReady } from "@/server/question-generation";
import { isTextToSpeechReady } from "@/server/text-to-speech";

export function GET() {
  return Response.json(
    { ready: isQuestionGenerationReady(), speech: isTextToSpeechReady() },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
