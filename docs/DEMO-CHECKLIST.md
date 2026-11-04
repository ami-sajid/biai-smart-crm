# Five-minute demo and live checks

Before recording, deploy to Vercel and configure Neon + Gemini. Keep secrets out of the recording.

1. **Overview (30 sec)** — Explain 20 source enquiries from 19 contacts. Show actual counts, and why all records initially start New / Unclassified.
2. **AI workspace (90 sec)** — Choose Rafi's Bootcamp enquiry; analyse with the live model. Review language, programme and reply. Edit before saving. Show that price/date facts are never invented. Regenerate and copy without sending.
3. **Sensitive cases (60 sec)** — Review Farzana's payment-confirmation complaint and Habibur's refund request as Support; explain that a claim does not verify payment. Show Spam with no reply and a job application outside the sales pipeline.
4. **Enquiry list (45 sec)** — Search Rafi's shared phone and find both messages; filter and open the detail panel. Demonstrate missing phone handling and preserved source details.
5. **Pipeline (45 sec)** — Show Sales-only, then All enquiries. Move a reviewed Sales record to Contacted or Interested. Demonstrate the Paid verification checkbox without falsely confirming an actual payment.
6. **Reliability (30 sec)** — Refresh to demonstrate persistence. Explain human review, request cap, server-only secrets and honest test limitations.

Live checklist:
- [ ] Open the Vercel URL on desktop and a phone; verify navigation and layouts.
- [ ] Sign in with reviewer code; reject an incorrect code.
- [ ] Confirm edits remain after refresh and in a second authenticated browser.
- [ ] Try simultaneous edits and confirm stale changes are rejected.
- [ ] Run all 20 messages through real Gemini and manually evaluate classification, identity and replies.
- [ ] Check English, Bangla and Banglish replies, spam suppression and uncertainty flags.
- [ ] Verify copied reply text and CSV export in Excel.
- [ ] Verify quota, unavailable-model and timeout messages without leaking credentials.

Live AI quality status at handoff: **NOT RUN for all 20 enquiries**. Do not present automated tests as evidence of real Gemini accuracy.
