# Backend deployment and remaining release gates

This change hardens the backend; it is not a certification that the live product has no risks. Real frontend registration/payment routes, Telegram payment-policy decisions, HTTPS AI hosting and live device/load tests still need completion. Do not point customer buttons at Swagger.

## Required rollout order

1. Back up the database. Use a supported Node LTS version (validate the chosen VPS runtime in staging), install with `npm ci`, and supply the existing secrets plus `.env.production.example` settings.
2. Run `npx prisma migrate deploy`, then `npm run generate`, then `npm run build`. The new additive migration creates `request_limits` and `telegram_jobs`; it does not change balances or subscriptions. Do not start this version against an unmigrated database: login rate limits require the new table even when the Telegram queue is disabled.
3. Run `npm run start:prod` under a service manager with automatic restart. Configure a public HTTPS reverse proxy to port 8080 and keep that port inaccessible directly from the internet. Set `TRUST_PROXY_HOPS` to the actual number of trusted proxy hops; never blindly trust forwarded IP headers.
4. Use the permanent backend HTTPS origin in `TELEGRAM_PUBLIC_BASE_URL`. Run `node scripts/telegram.cjs setup https://YOUR-BACKEND`, then `node scripts/telegram.cjs status`. A hostname/secret change needs re-registration; a restart at the same hostname does not.
5. Configure Stripe's webhook separately to the real `/api/v1/webhook`, with the matching endpoint secret. Verify paid invoices activate the wallet once; refunds/cancellations and retry events must also be tested in staging.
6. Check `/api/v1/health/live` and `/api/v1/health/ready`. Ready checks the database and new runtime tables, not upstream AI, SMTP or Stripe health. Add uptime/error/queue alerts and backups on the VPS.
7. Test Android, iOS, Desktop and Web: login, wrong password, registration return, account transfer, message/image/voice, no subscription, exhausted credits, purchased credits and payment callbacks.

## Configuration behavior

- Change env values then restart; existing chat buttons retain old URLs, so request `/login` again.
- CORS uses `CORS_ORIGINS` (or `FRONTEND_URL` fallback). Production requires exact HTTPS origins, distinct access/refresh secrets of at least 32 characters, an HTTPS AI URL, and the durable queue when Telegram replies are enabled. Invalid configuration stops startup rather than silently deploying insecure defaults.
- Swagger is disabled in production unless explicitly enabled. Production 5xx responses hide database/internal details.
- Queue concurrency is 1–8 per process (default 2). Start low relative to the DB pool and measure; AI generation still holds an existing credit transaction/user lock. This preserves accounting but can cause waits under load. This change does not promise 3-second AI replies or remove that lock.
- Existing external AI HTTP endpoints must be placed behind HTTPS before production mode starts. Do not merely label an HTTP-only server as HTTPS.
- The frontend must implement registration/payment return handling; env URLs alone cannot create those frontend flows.

## Frontend auth contract changes (required)

- After deployment, previously issued JWTs must be replaced through normal login. New JWTs carry a password-dependent session version. Password reset/change invalidates previously issued access and refresh tokens; authorization checks the current DB user status and role.
- `POST /api/v1/auth/verify-otp` now returns `data.resetToken`. Send that value alongside `email` and `password` to `POST /api/v1/auth/reset-password`. The token expires after 10 minutes and is consumed atomically. Email plus the old `verifiedForgot` flag is no longer accepted. Request a fresh OTP after deploying this change; legacy outstanding OTPs are invalid.
- Do not persist reset tokens or passwords in browser storage or put them in URLs. Password/OTP/internal verification fields are removed from JSON responses, including nested user objects.
- Shared DB limits allow 30 attempts/IP and 10/email per endpoint per 10 minutes; Mini App additionally checks signed Telegram identity. Limits fail closed if the database is unavailable. At the proxy, also apply body-size and connection limits to prevent traffic exhausting the database before guards execute.

## Queue operations and limitations

Authenticated Telegram webhooks durably insert one row per bot/update ID before returning 200. The worker claims jobs with short transactional locks and a 15-minute lease, processes up to the configured concurrency, and serializes work for each bot/chat. Failures back off; five failed attempts go to `failed` for operator review. Process crashes recover after lease expiry. Explicit Telegram 429 responses with retry_after up to 30 seconds receive one bounded retry; larger waits enter the durable retry flow.

Completed payloads are erased immediately. Completed/failed job rows are removed after seven days; rate counters expire after ten minutes and are cleaned hourly. Protect the database with encryption and restricted access because pending jobs contain user messages.

Monitor using a read-only query:

```sql
SELECT status, count(*), min("createdAt") AS oldest
FROM telegram_jobs GROUP BY status;
```

Investigate failed jobs before any manual retry. Do not clear the inbox or bulk replay it. An ambiguous Telegram timeout or a crash after delivery but before recording completion can still duplicate a reply; Telegram send APIs do not provide an exactly-once guarantee. Chat idempotency protects the saved AI response and credit charge. A message already in flight during account transfer can finish; subsequent messages use the new binding.

## Release evidence and scope

Build/unit/temporary PostgreSQL integration checks are documented in the task result. `node scripts/test-runtime-postgres.cjs` uses temporary tables and rolls back; it does not migrate the real database. Run it after a build against an appropriate test database.

Run `npm audit` again at deployment time. Targeted overrides patch YAML, Prisma configuration merging, and mysql2; revalidate those overrides when upgrading parent packages. Dependency advisories and an antivirus scan are separate checks and do not prove absence of all malicious code or vulnerabilities.

Telegram digital goods/services sold through bots/Mini Apps must follow Telegram Stars rules: https://core.telegram.org/bots/payments-stars . The existing Stripe business model has not been silently replaced. Resolve the purchase-flow policy before public paid launch. Content moderation, privacy consent/retention, actual VPS security, backup restore, provider failures and sustained load testing remain operational release checks.
