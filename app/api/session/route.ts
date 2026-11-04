import { cookies } from "next/headers";
import {
  authorized,
  configured,
  equal,
  secret,
  token,
  safeError,
} from "@/lib/auth";
import { db, setup, reserve } from "@/lib/db";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json({
      mode: configured() ? "database" : "demo",
      authenticated: await authorized(),
      ai: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
    });
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 503 });
  }
}
export async function POST(r: Request) {
  try {
    if (r.headers.get("origin") !== new URL(r.url).origin)
      return Response.json(
        { error: "Request origin rejected." },
        { status: 403 },
      );
    if (!configured())
      return Response.json(
        { error: "Database not configured." },
        { status: 503 },
      );
    await setup(db());
    await reserve(db(), "login:" + Math.floor(Date.now() / 600000), 50);
    const { code } = await r.json();
    if (typeof code !== "string" || !equal(code, secret()))
      return Response.json(
        { error: "Incorrect access code." },
        { status: 401 },
      );
    (await cookies()).set("biai_session", token(Date.now() + 8 * 3600000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 28800,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 400 });
  }
}
export async function DELETE() {
  (await cookies()).delete("biai_session");
  return Response.json({ ok: true });
}
