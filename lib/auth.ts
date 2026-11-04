// Public BIAI assessment demo: no reviewer password or session cookie.
// Keep same-origin checks for browser writes to avoid accidental cross-site requests.
export function configured() {
  return !!process.env.DATABASE_URL;
}
export async function guard(request: Request) {
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
    "Request origin",
    "Confirm the target",
    "Gemini",
    "Add GEMINI",
  ];
  return allowed.some((x) => msg.startsWith(x))
    ? msg
    : "The request could not be completed. Check configuration or reload and try again.";
}
