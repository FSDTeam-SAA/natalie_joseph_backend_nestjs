# Telegram login inside the app

Unlinked users and `/login` receive a **Log In / Connect Account** Mini App button.
The backend serves the mobile login page at `/api/v1/telegram/app?companionId=UUID`.
No database migration is required. Existing deep links continue working.

## Deployment

1. Build and deploy this backend, then restart it.
2. Set `TELEGRAM_PUBLIC_BASE_URL` to this deployed backend's HTTPS origin. The button's login page uses this value; do not leave an old tunnel hostname.
3. Set `TELEGRAM_REGISTER_URL` and `TELEGRAM_FORGOT_PASSWORD_URL` to actual frontend pages. Empty settings hide the corresponding links and display registration guidance. They must not be Swagger pages.
4. Set `TELEGRAM_CREDITS_URL` and `TELEGRAM_SUBSCRIPTION_URL` to actual frontend purchase pages. Existing `/api/docs` placeholders do not provide a customer checkout experience.
5. Register the Telegram webhooks against the same deployment with `node scripts/telegram.cjs setup https://YOUR-BACKEND-HOST`. No Mini App menu registration is required for the inline web_app button.
6. Protect `POST /api/v1/telegram/app/login/*` at the reverse proxy with a shared rate limit. The backend also limits attempts per verified Telegram ID and email (10 per 10 minutes per process). Multiple replicas need a shared limiter. Do not log request bodies, credentials, or initData.

## Account and payment flow

The form submits credentials and raw Telegram initData over HTTPS to the same backend. It reuses existing password authentication, validates the bot-specific HMAC and a 10-minute auth_date window, and links only approved adult users. No JWT, password hash, or cookie is returned to the Mini App; no credentials are stored in browser storage. A Telegram account cannot replace another account's binding. A website account already connected to another Telegram account is also rejected; contact support rather than silently transferring access.

Linking does not purchase a subscription or grant credits. Once linked, the form checks current database subscription dates and effective credit balance. It offers Subscribe / Renew, Buy Credits, or Return to chat. Check subscription & credits refreshes the database state after payment; it does not itself reconcile Stripe. Each chat still performs its existing entitlement and message-cost checks.

Registration/reset links carry `companionId`, `source=telegram`, and `returnTo`. The frontend must preserve the companion across registration/payment and validate any returnTo against the configured backend origin (never blindly redirect to arbitrary input). Until the frontend implements the return journey, users return to the original Telegram bot, send `/login`, and sign in. Payment pages may require their own website login; the Mini App does not share a website cookie or place a JWT in a URL.

Opening the login page in an ordinary browser displays instructions; it cannot link without valid Telegram initData. If the session expires, close and reopen the bot's Log In button. Linked accounts persist after that short login session expires. Bindings remain per companion.

## Acceptance checks

- Unlinked bot: Start → Log In → correct credentials → connected → Return to chat → send hello.
- Bad password: generic failure, no new link. Tampered/expired/cross-bot initData: denied before password authentication.
- Already linked same account: status loads without asking for a password.
- Existing different account binding: rejected, existing connection preserved.
- No active subscription: linked, Subscribe / Renew shown, chat remains gated.
- Active subscription with exhausted allowance but purchased credits: ready.
- All credits exhausted: Buy Credits. Expired subscription even with purchased credits: Subscribe / Renew.
- Registration/reset buttons open configured HTTPS pages, retain companion, and return through login.
- Test on Telegram Android/iOS/Desktop/Web after deployment. Browser mocks do not verify Telegram's real signed login or client rendering.
