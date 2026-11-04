# AI Enquiry Processor — Pending / Reviewed Selection

## Changes
- Two selectors in **CURRENT ENQUIRY**: **Review status** (`Pending` or `Reviewed`) and **Select enquiry** (only records in the chosen group).
- Opens with `Pending` selected. Incoming links from the Enquiry List open the specific enquiry in its matching group.
- Previous/Next navigate within the chosen review group only.
- Once a save moves an enquiry out of the selected group, the selection moves to the next eligible record (or the previous one if it was last).
- If Pending is empty: "All caught up! There are no pending enquiries to review."
- If Reviewed is empty: "No reviewed enquiries yet."
- Enquiry selection is disabled when a review group is empty.
- Reverting review status in the Enquiry List moves a record back into Pending. Saved analysis and original messages remain intact.
- Manually created enquiries appear under their saved review status without changing the original 20 provided records.
- No new database fields, routes, credentials, or API calls were needed.

## Edited files
- `web/components/crm.tsx`
- `web/app/globals.css`
- `web/tests/ui.test.ts`

## Verification in packaging environment
- TypeScript parser on the changed TS/TSX files: **0 syntax errors**.
- Official source CSV: **SHA-256 matches the original provided file**.
- Dependency installation: **blocked** (`npm ci --offline` reports ENOTCACHED for `zod@4.6.7`; online install did not complete).
- `npm test`: **not completed** (missing `tsx`).
- `npm run typecheck`: **not completed** (missing dependencies / types).
- `npm run build`: **not completed** (missing `next`).
- No live Neon/Gemini/Vercel configuration was accessed.

## Verify locally (inside `web`)
```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```
Use a Node.js version compatible with the locked dependencies (Node 24.15+ recommended). Test Pending → Reviewed → Pending on your authenticated Vercel demo, then push the changes to the GitHub production branch. Do not commit `.env.local`.
