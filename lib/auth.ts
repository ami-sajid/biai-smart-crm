import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export function configured() {
  return !!process.env.DATABASE_URL;
}
export function secret() {
  const s = process.env.REVIEWER_ACCESS_CODE;
  if (!s || s.length < 16)
    throw Error("Set REVIEWER_ACCESS_CODE to at least 16 characters.");
  return s;
}
export function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function token(exp: number) {
  return (
    exp +
    "." +
    createHmac("sha256", secret())
      .update("biai-session:" + exp)
      .digest("hex")
  );
}
export function valid(value: string) {
  const exp = Number(value.split(".")[0]);
  return (
    Number.isFinite(exp) &&
    exp > Date.now() &&
    exp < Date.now() + 9 * 3600000 &&
    equal(value, token(exp))
  );
}
export async function authorized() {
  if (!configured()) return false;
  return valid((await cookies()).get("biai_session")?.value || "");
}
export async function guard(request: Request) {
  if (!(await authorized())) throw Error("Sign in to continue.");
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    throw Error("Request origin rejected.");
}
export function safeError(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  const allowed = [
    "This record changed",
    "This creation request",
    "AI provenance",
    "Verify payment",
    "Approve the name",
    "Record not found",
    "Request limit",
    "Sign in",
    "Request origin",
    "Set REVIEWER",
    "Confirm the target",
    "Gemini",
    "Add GEMINI",
  ];
  return allowed.some((x) => msg.startsWith(x))
    ? msg
    : "The request could not be completed. Check configuration or reload and try again.";
}
