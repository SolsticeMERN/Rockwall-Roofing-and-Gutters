# Custom lead system

## Local demonstration (no accounts or emails needed)

Run `npm run dev:api` in one terminal and `LEAD_CAPTURE_ENABLED=true npm run dev` in another. Open `http://localhost:4173/` to submit a test inquiry and `http://localhost:4173/owner.html` for the dashboard. Use `local-demo-owner-key-change-before-launch` to sign in. The local API binds only to loopback. It stores demo data in ignored `.data/leads.json`; it never sends email, including if email credentials are present. Use invented information for demonstrations.

## What is implemented

- Both website forms support custom capture when enabled at build time.
- Leads and notification jobs are inserted together transactionally in Supabase.
- Request IDs prevent duplicate inserts after a retry. Ten submissions per hashed IP per hour are allowed; honeypot and server-side validation are applied. Add provider/WAF bot protection before significant traffic if abuse occurs.
- The owner dashboard uses a strong server-side access key held only in browser memory. API responses are not cached. The dashboard HTML contains no private data before authentication.
- Status, internal notes, confirmed inspection date, and an owner callback reminder can be edited. Version checks reject stale edits.
- New inquiries enqueue an owner email. Callback reminders enqueue an owner email for the selected date. Won/Lost/Do not contact cancel pending reminders.
- Notifications are attempted after capture; failed notifications remain queued. The protected daily cron retries pending messages. Resend idempotency keys reduce duplicate deliveries; provider idempotency has a limited retention window, so rare duplicates remain possible after extended failures.
- No AI receptionist, outbound customer SMS, automatic customer emails, or automatic calendar bookings are included in this version. Follow-up means controlled owner callback tasks and owner email reminders.

## Activate on Vercel

1. Create a Supabase project and run `database/leads.sql` once in its SQL editor. Keep Data API access enabled. Tables have RLS enabled with no public policies; access is server-only. The schema is not a rerunnable migration.
2. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works. Never prefix secrets with `VITE_`.
3. Connect Resend and verify a sending domain. Set `RESEND_API_KEY`, `NOTIFICATION_FROM`, and `OWNER_NOTIFICATION_EMAIL` (the business inbox). No email has been sent by development tests.
4. Generate distinct random secrets of at least 32 characters for `OWNER_ACCESS_KEY`, `CRON_SECRET`, and `RATE_LIMIT_SALT`. Share the owner key privately; never put it in a URL. Rotate it in Vercel to revoke access.
5. Set `ALLOWED_ORIGINS` to the exact live origins, comma separated, e.g. `https://yourdomain.com,https://www.yourdomain.com`. Set `LEAD_CAPTURE_ENABLED=true`, and redeploy. Leave `LEADS_LOCAL_DEMO=false`.
6. The cron configured in `vercel.json` runs daily at 14:00 UTC (morning in Dallas; daylight saving changes the local hour). Reminders are daily, not precise-minute notifications. Increase frequency only if your Vercel plan supports it. `CRON_SECRET` protects the endpoint.
7. Before routing paid traffic, test both forms using clearly labeled test data. Verify database insertion, owner inbox delivery, dashboard authentication, status edits, stop conditions, and cron execution. Never interpret a saved inquiry as an appointment or guaranteed email delivery.

Until activation the deployed site keeps its existing FormSubmit integration. Custom capture is deliberately opt-in. Raw file previews cannot execute the backend; use the local dev URL or Vercel.

## Operational limits

The dashboard shows the most recent 500 inquiries. Notification processing handles 25 due jobs per invocation; monitor backlog and increase scheduling/capacity if volume grows. It is a single-owner MVP, not multi-user CRM authentication. Keep daily backups and set a retention/deletion policy. Request logs should not contain customer contact details. Owner email and SQL storage need a live-account end-to-end test after connection. IP/origin checks do not replace comprehensive bot mitigation.

The notification API calls are documented by [Resend](https://resend.com/docs/api-reference/emails/send-email); storage uses [Supabase's Data REST API](https://supabase.com/docs/guides/api); cron authorization follows [Vercel's cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
