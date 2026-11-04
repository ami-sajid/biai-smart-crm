# BIAI Smart CRM — Next.js / Vercel edition

A working Next.js CRM inspired by the supplied UI references: a quiet sidebar, split conversation/review workspace, filterable contact table, and five-column sales pipeline. This is the Vercel edition explicitly requested by the project owner.

## Start on Windows

1. Install Node.js 22 or 24 from https://nodejs.org/ (Node.js, not Python).
2. Open this repository folder in VS Code.
3. Open Terminal and run:

```powershell
npm ci
npm run dev
```

4. Open http://localhost:3000. Alternatively, double-click `run-web.bat`.

No environment variables are needed for the manual local demo. It starts with all 20 supplied enquiries. Changes are saved in this browser's local storage. AI is deliberately disabled until server configuration is complete; the app never pretends to have called Gemini.

## Publish to Vercel

1. Extract the entire project and create a GitHub repository using GitHub Desktop. Do not commit `.env.local`, `node_modules`, `.next`, API keys or database credentials.
2. In Vercel, import the repository.
3. Choose **Next.js** and set **Root Directory to `.`** (package.json is at repository root). If you upload only the contents of `web` to the repository, use `.` instead.
4. Use Node.js **22.x**, install command `npm ci`, build command `npm run build`, and the default output directory.
5. Deploy. With no environment variables, this runs as a browser-local manual demonstration.
6. For shared saves and AI, add the variables below in Vercel project **Settings → Environment Variables**, then redeploy. Apply them to the deployment environments you use.

Production deployment is connected separately through GitHub and Vercel. Verify the current public URL after every release.

## Shared database and Gemini

For local use, copy `.env.example` to `.env.local`. For Vercel, enter values in its environment settings. Never prefix secrets with `NEXT_PUBLIC_`.

| Variable | Value / purpose |
| --- | --- |
| `DATABASE_URL` | A Neon pooled PostgreSQL connection string with `sslmode=require`. Use a dedicated demo database/branch. |
| `GEMINI_API_KEY` | Your Gemini API key. Used on the server only. |
| `GEMINI_MODEL` | An exact text model ID available to your AI Studio project. No model ID is assumed. |
| `GEMINI_TIMEOUT_MS` | Optional; default 120000, bounded to 10000–120000 ms. |
| `AI_DAILY_LIMIT` | Optional; default 40 total requests per Dhaka calendar day. Set 0 to disable AI requests. Failed attempts also count. |

The database user needs permission to create and alter the `biai_web_*` tables, create indexes, and create/use the `biai_manual_id` sequence. On the first public load, the server creates these tables and imports the 20 original enquiries. Repeated loads never overwrite staff edits. The web edition uses separate tables; it does **not** automatically migrate existing Streamlit `crm.db` edits. Keep the old database as a backup.

The demo is publicly accessible without a password. All visitors can view and edit the same enquiry records and use the shared Gemini request budget. Use a dedicated Neon demo database/branch with fictional data only. Do not connect it to production customer data. Existing payment verification, field validation and AI request limits remain; they are business safeguards, not access control. To restrict public editing or API usage later, add authentication or a read-only public demo mode.

## What works

- Dashboard with actual record counts, review queue, inbox and sales-stage counts.
- AI processor: choose an official enquiry or paste text; review classifications, language, intent, reply, and optional extracted identity. Regenerate only the reply. Copy a draft without sending it.
- Manual editing works without AI. Original contact metadata remains the default. Name/phone changes require explicit approval.
- Enquiry list: text search, type tabs, programme and stage filters, pagination, detail panel, CSV export with spreadsheet-formula escaping.
- Pipeline: New → Contacted → Interested → Paid / Lost. Sales-only default; All enquiries option. Open a card to change its stage. A payment claim is never treated as verified payment.
- Server validation, optimistic concurrency, idempotent imports/saves, database audit events, shared daily AI cap, same-origin checked API routes (public access).
- Responsive CSS, keyboard focus indicators, labeled controls, Escape-to-close and focus containment in dialogs.

Only Sales records appear in the sales pipeline by default. All supplied records initially remain **New / Unclassified**, so an empty Sales pipeline is intentional. Review/classify one first, or choose All enquiries. No prices, revenues, deadlines, fake staff assignments or invented customer messages are added.

For a new customer, use **+ New Enquiry** in the public database workspace. Choose WhatsApp, Facebook, Website or Phone Call, paste the message, analyze with AI, review/edit the fields and select **Save New Enquiry**. Missing names and phones stay empty. Staff can also save without AI. The record receives a PostgreSQL-generated ID, Manual Entry origin and New stage. A unique request key makes repeat submissions idempotent; after a failed/uncertain save, retry the retained submission.

The dataset selector defaults to **Official dataset** for assessments. **All enquiries** and **Manual entries** include staff-created records; creating a record switches to All enquiries. The browser-only demo remains the official 20 records and does not simulate database creation. No test fixtures are seeded into the app.

Pasted text in the existing-record processor still requires target confirmation. It never replaces the original message. CSV identity fields show **From official dataset**; applied AI values show **Extracted by AI**; staff changes show **Manual**. Existing-record identity suggestions require staff application and correction approval. Original source metadata remains intact.

Open an enquiry's detail panel, choose **Review status → Pending / Reviewed**, then **Save changes**. Review status is independent of pipeline stage. AI may recommend Pending for support/job/uncertain cases; staff can explicitly mark them Reviewed or return them to Pending. Both changes are audited, preserving analysis, reply and corrections. Spam still clears the reply.

## Validation

```powershell
npm test
npm run typecheck
npm run build
```

See `docs/VALIDATION.md` for results and honest limits. Live Gemini, hosted Neon and Vercel verification must be performed with your own configuration. Component tests use simulated API responses; they are not evidence of real model accuracy.

## Stack and source

Next.js App Router / TypeScript / React; standard CSS and Lucide icons; PostgreSQL via `pg`; Gemini via `@google/genai`; Zod input/output validation. Exact package versions are locked. Runtime fonts load from Google Fonts with local fallbacks.

- `components/crm.tsx`: four screens, forms, local-demo persistence.
- `app/globals.css`: shared visual system and responsive layouts.
- `app/api/session/route.ts`: reviewer session gate.
- `app/api/crm/route.ts`: protected reads and writes.
- `app/api/ai/route.ts`: protected Gemini requests and usage budget.
- `lib/domain.ts`: authoritative field validation, identity/payment/source safeguards.
- `lib/db.ts`: namespaced PostgreSQL persistence, import and audit log.
- `lib/ai.ts` / `lib/prompt.ts`: Gemini structured output and original triage rules.
- `data/sample-enquiries.csv`: byte-for-byte copy of the supplied CSV.
- `data/source.json`: faithful parsed representation used for initial records.

Technical references: https://nextjs.org/docs/app/api-reference/file-conventions/route and https://ai.google.dev/gemini-api/docs/structured-output .


## Staff-approved AI pipeline recommendations

The Dashboard heading and sidebar now use Dashboard. KPI titles use 19px bold type on desktop and 17px on smaller screens, with a two-column tablet grid and one-column narrow-phone grid. Statistics, icons and the purple theme are unchanged.

Analyze an existing enquiry to see **AI Pipeline Recommendation**, including stage, explanation and confidence. **Apply Recommendation** changes only the editable stage; **Save reviewed enquiry** persists it. Ignore the suggestion or choose another stage manually. Saved recommendations also appear on pipeline cards and in enquiry details. Reply regeneration preserves the existing recommendation.

The API reads the saved stage/contact history from PostgreSQL. Analysis does not record contact or move cards. Contacted requires recorded/confirmed staff contact; saving Contacted manually confirms actual contact. Payment claims are flagged for verification, never promoted to Paid by AI. Existing Paid records remain Paid in AI recommendations. Unclear, low-confidence, unsupported, refund/cancellation and non-sales cases retain their current stage for staff review.

New enquiries still start at New. Their AI suggestion is saved with the reviewed analysis and can be applied after creation. Recommendation fields are optional for old stored analyses. They use the existing JSONB record; this update requires no new tables or migration. Existing environment variables and Vercel Root Directory `web` remain the same.


## Light and Dark Mode

Use the Light Mode / Dark Mode switch near the bottom of the sidebar, above Workspace guide. Light remains the default. Your choice is saved locally in this browser and restored before the page renders on refresh. The same theme applies to the public Dashboard, all CRM screens, forms and dialogs. Blocked browser storage does not prevent switching themes, but persistence requires localStorage access.

The decorative workspace card and sidebar AI promotional card have been removed. All CRM features and backend configuration remain unchanged. No new application dependencies or migration are required.
