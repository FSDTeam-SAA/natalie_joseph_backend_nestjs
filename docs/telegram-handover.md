# Telegram backend setup and acceptance tests

Five companions share the existing user, subscription, wallet and ChatService.
Each bot routes by a configured database companion ID, never by display name.
This repository contains the backend, not the website UI.

## Configuration

Merge `.env.telegram.example` into your existing `.env`, preserving other settings.
Supply distinct valid bot tokens, final usernames and active database companion UUIDs.
Use `GET /api/v1/companions` to find IDs. Rotate previously exposed tokens privately.
Fill these exact frontend page URLs, then restart the backend:

- `TELEGRAM_CREDITS_URL`: credit purchase page.
- `TELEGRAM_SUBSCRIPTION_URL`: subscription/renewal page.
- `TELEGRAM_CONNECT_URL`: website login/companion selection page.
- `TELEGRAM_PUBLIC_BASE_URL`: deployed public HTTPS backend origin.

The three page links retain existing query parameters and append `companionId`
and `source=telegram`. They contain no login credential or Telegram linking token.
The frontend must retain this companion context through login and payment.
Empty URLs intentionally produce a configuration error instead of sending users
to an invented or incorrect checkout page.

## Local checks and webhook registration

```sh
npm test -- --runInBand
npm run build
node scripts/telegram.cjs check
node scripts/telegram-check-db.cjs
node scripts/telegram.cjs status
# Run only after deployment and correct configuration. This changes live webhooks:
node scripts/telegram.cjs setup
# Optional: select one bot using the fourth argument:
node scripts/telegram.cjs setup https://api.example.com ELENA
```

`check` validates local configuration only. `telegram-check-db.cjs` reads the five
configured companion records in a read-only transaction and reports name/status.
`status` verifies bot token/username
using getMe and reads webhook status; it does not register anything.
`setup` verifies all selected bot identities before registering webhooks. Registration
is sequential; if a later bot fails, earlier registrations remain and setup can be retried.
Pending updates are not dropped. Neither tokens nor webhook secrets are printed.

New webhook: `POST /api/v1/webhooks/telegram/:companionId`.
Each route uses its own optional `TELEGRAM_<NAME>_WEBHOOK_SECRET`, otherwise
HMAC-SHA256(master `TELEGRAM_WEBHOOK_SECRET`, uppercase bot key).
The setup script and backend derive identical values. Secrets must not be shared
between bot overrides. Legacy `/api/v1/webhooks/telegram` remains Elena-only,
using the original master secret, for migration compatibility.

## Swagger / frontend integration

Open `/api/docs` and authorize with a user access token for user endpoints,
or an admin access token for admin endpoints. All paths below include `/api/v1`.

| API | Usage |
| --- | --- |
| `GET /companions` | Public companion selection and database IDs |
| `GET /subscription` | Available subscription plans |
| `GET /payment/subscription/status` | Authoritative subscription status |
| `POST /payment/subscription/:subscriptionId` | Start subscription payment |
| `GET /credits/packages` | Credit packages |
| `POST /payment/credits` | Start credit payment with `{ "packageId": "..." }` |
| `GET /credits/wallet` | Wallet balance and transactions |
| `POST /telegram/connect/:companionId` | Single-use 10-minute bot deep link; active subscription required |
| `GET /telegram/status/:companionId` | Linked state, active subscription, purchase URLs, return-to-bot URL |
| `PUT /companions/:id` | Admin companion edit |
| `GET /dashboard/overview` | Admin metrics |

For connect, open `data.telegramUrl`, then press START in Telegram. An unlinked
Telegram user receives a Connect account website button. Linking is companion-scoped.
Expired or already used tokens cannot link again.

Payment APIs use the existing Stripe client-secret flow; these are not hosted
website pages. The frontend completes payment and waits for the backend's verified
payment webhook to grant entitlement. A frontend success redirect alone grants nothing.
After confirmation, call Telegram status. If linked and subscribed, show
`data.telegramUrl` as Continue on Telegram. If unlinked, call connect to obtain a new
link. Telegram messages recheck current entitlement, so a linked user can also just
return to the existing bot after payment. Subscription can be active while credits
are insufficient; status is not a guarantee that the next message is affordable.

## Manual acceptance checklist (test account / payment test mode)

1. No subscription: connect returns 402 and stores no new linking token.
2. Active subscription: create a link for each companion, press START, send a message.
   Each correct bot replies using that companion; chats and links remain separated.
3. Use a Chloe link in Elena: it fails. Reusing or expiring a link also fails.
4. Active subscription with all message allowance and usable credits exhausted:
   receive Buy Credits, open the configured page with the companion query parameter.
   No AI work or credit debit should occur for denied messages.
5. Expired subscription with purchased credits remaining: receive Subscribe / Renew.
6. Complete a test credit payment, confirm wallet update, return to the bot and chat.
   Repeat with subscription renewal. Duplicate payment webhooks must not grant twice.
7. Duplicate Telegram update on the same bot: process once in this server process.
   Same update ID on different bots: both process independently.
8. Wrong/missing webhook secret: 403, no AI or outgoing message.
9. AI image: delivered as photo; typing stops on both success and failure.
10. Admin renames a companion: routing still works and welcome text uses the new name.
    Telegram's profile/display name remains managed through BotFather.
11. Admin overview distinguishes totalSubscriptionPlans, activeSubscriptions,
    activeSubscribers, totalMessages and totalConversations. Legacy totalSubscriptions
    still means plan count and totalConversions still means message count.

## Deployment limits

No database migration is required for this change. Configuration validation does not
prove database IDs exist; runtime requires an active companion record.
Incoming Telegram text, voice notes and audio attachments are supported (10 MB input
limit and 5 minute declared duration limit, matching the supplied AI server defaults).
Audio is fetched using the receiving bot's getFile credentials after account and chat
entitlement checks, uploaded to AI `/chat` as multipart `audio`, and charged at the
configured voice rate. The returned transcript is stored as the user message. AI audio
media is uploaded to Telegram using sendVoice, while AI images still use sendPhoto.
Audio is retrieved from the configured AI origin's authenticated `/media/{id}` endpoint
with the linked user's JWT, never from an arbitrary returned URL. Public HTTPS image
URLs remain supported. Redirects and output downloads larger than 20 MB are rejected.
Test a short voice note on each bot after restarting the backend: expect a
playable voice reply and a single voice charge. An explicit image request spoken in
audio may return a photo according to the AI service's behavior. Retried committed
voice messages reuse the stored media instead of charging or generating again.
Website UI, live Stripe payments and bot delivery require manual staging
acceptance and are not established by mocked automated tests.

Delivery deduplication is bounded and process-local. Existing ChatService persists the
message key and serializes charges per user, preventing a committed AI response from
charging again on retry. A crash after Telegram accepts a message but before local
acknowledgement can still cause a repeated outgoing reply. Multiple replicas require a
durable webhook queue/outbox before promising delivery-level deduplication. AI processing
currently completes inside the webhook request; test latency/retries under real traffic.
This change does not claim exactly-once Telegram delivery.

## Voice provider failures and latency

The supplied Python code returns `{ "error": { "code": "PROVIDER_ERROR", "message": "..." } }`.
Live diagnosis on 2026-10-03 returned `ElevenLabs speech-to-text request failed` for
a fresh voice attempt. Retrying the same key returned `The previous transcription
attempt is incomplete or terminal; use a new idempotency key.` Renaming the same
recording to `.ogg` did not resolve the provider failure.

Nest now recognizes an allowlist of terminal voice errors, logs a safe reason code,
and sends a user-facing notice after the failed chat transaction rolls back. It then
acknowledges the webhook so this update does not repeatedly block other messages.
It never automatically changes the idempotency key to force a potentially billable retry.
The AI operator must check ElevenLabs STT key permissions, account quota, model and
provider response status. The supplied provider masks that status, so the exact
ElevenLabs account/configuration cause cannot be established from Nest's 502 alone.
Do not expose API keys or raw upstream request headers in diagnostic logs.

`AI_API_LOG_TIMING=true` reports successful AI request duration without user content.

Chat timing also separates `lockWaitMs` (transaction/another message waiting),
`prepareMs` (validation, charging, conversation setup and input audio download),
`aiMs` (AI chat generation), and `saveMs` (saving and committing). Telegram logs
separate preparation from delivery. Compare fresh text, image and voice messages
after restarting the backend; do not use duplicate updates as speed benchmarks
because they reuse saved responses. Credit charging reuses locked balances and
combines subscription debit/message counting, removing seven database operations
from the usual subscription-funded chat path. This does not shorten upstream
model generation itself; no end-to-end latency target has been verified.
The ordinary Telegram message path no longer fetches the companion twice; ChatService
still validates the active record. `TELEGRAM_WEBHOOK_MAX_CONNECTIONS=4` permits several
users' webhook requests concurrently (range 1–40). Run the setup script again to apply
this value; previously registered webhooks keep their old setting until then.
Per-user charge serialization remains intact. These changes reduce queue blocking and
one database lookup, but do not accelerate the external AI model or repair ElevenLabs.
