# Migration notes

The user explicitly requested Next.js for Vercel. This edition is a separate web application; it does not attempt to run Streamlit inside Vercel.

| Original responsibility | Vercel edition |
| --- | --- |
| Streamlit four-screen UI | React client workspace with reference-inspired panels, table and board |
| Python Gemini service | Server-side Gemini API route and TypeScript validation |
| SQLite / SQLAlchemy persistence | Browser-local demo or shared PostgreSQL tables |
| Original source snapshots | Read-only original fields and bundled unchanged CSV |
| Staff edit validation | Shared domain rules plus protected server validation |
| Daily request budget | Atomic PostgreSQL counter keyed to Asia/Dhaka date |
| Reviewer access | Signed HttpOnly eight-hour cookie and shared access code |

The original uploaded Python project is preserved under `original-streamlit`. Its historical test reports and deployment instructions describe the Python edition only. Use the web edition's README for Vercel.

The visual references guide structure and spacing, not their unrelated companies, revenue figures, contacts or extra stages. BIAI retains exactly New, Contacted, Interested, Paid and Lost. Cards use actual enquiries; no progress is fabricated to fill the board.

Existing Python database edits are not imported automatically, and web saves do not synchronize back to Streamlit. The source dataset is shared; the live stores are separate. Use a separate Neon branch for this demo.

Not implemented: message sending, payment processing, arbitrary new-contact creation, drag-and-drop stage changes, per-user accounts, or bulk autonomous AI classification. The visible UI does not claim those capabilities. Stage changes use the detail panel so the verification step is explicit.
