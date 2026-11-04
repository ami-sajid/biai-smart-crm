import { configured } from "@/lib/auth";
export const runtime = "nodejs";

// Public assessment demo: return workspace configuration without a login step.
export async function GET() {
  return Response.json({
    mode: configured() ? "database" : "demo",
    ai: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
  });
}
