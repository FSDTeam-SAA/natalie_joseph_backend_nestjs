# WhatsApp AI setup

## Echo test before AI

Set `WHATSAPP_AUTO_REPLY_ENABLED=true` and `WHATSAPP_REPLY_MODE=echo`, restart,
then send `how are you` from WhatsApp to the configured companion business number.
Expected reply: `You said: how are you`. Echo does not require user linking or
call AI/charge credits. It is a temporary connectivity test; it does not apply
conversation human-mode rules. Signature verification and active companion mapping
still apply. Status-only events never trigger replies.

After the echo test, set `WHATSAPP_REPLY_MODE=ai` and restart to use the linking
and AI flow below. Missing mode defaults to AI. For deployment, configure the
GitHub Actions variable `WHATSAPP_REPLY_MODE`. Logs show disabled replies, missing
companion mapping, selected mode and Meta acceptance without logging message text
or tokens. Meta acceptance alone does not prove delivery.

Flow: signed webhook → companion by Meta phone ID → linked user → ChatService
subscription/credit checks → AI → WhatsApp reply.

## Setup

Apply migrations to your intended database before running the updated app:

```sh
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

Keep the existing WhatsApp access token, app secret, verification token and Graph
version configured. Set WHATSAPP_AUTO_REPLY_ENABLED=true.
AI_API_BASE_URL defaults to https://natalie-joseph-ai.onrender.com/api/v1.
The AI server must trust the existing ACCESS_TOKEN_SECRET used for backend JWTs.
A five-minute JWT is minted for the linked user; login tokens are never stored.

Save whatsappPhoneNumber, whatsappPhoneNumberId, whatsappEnabled=true and status=true
on the companion using the existing admin PUT /api/v1/companions/:id endpoint.
The number uses +countrycode format; Meta Phone Number ID is a separate value.
Display name and welcome message are stored settings, not yet used for sending.

## Link once, then chat

Sign in as an approved adult USER and call with no body:

```http
POST /api/v1/whatsapp/connect/<COMPANION_UUID>
Authorization: Bearer <USER_ACCESS_TOKEN>
```

Open data.whatsappUrl and SEND the prefilled START token message in WhatsApp.
Opening the link alone does not link the account. Tokens expire after ten minutes,
are single-use and stored as hashes. A new link invalidates the previous pending
link. An existing phone cannot be claimed by a second account for that companion.

After confirmation, send Hello Elena in WhatsApp. Existing ChatService checks the
subscription and credits, stores conversation/message history, and returns AI text.
Unknown phones get linking instructions. Human mode sends no automatic AI reply.
Pre-signup trials and outbound admin human replies are not implemented here.

Meta callback: https://<public-host>/api/v1/webhooks/whatsapp
Use the server WHATSAPP_VERIFY_TOKEN, subscribe to messages, and keep the backend
and tunnel running. POST requires Meta raw-body signature verification.

## Admin test API

POST /api/v1/whatsapp/test remains admin-only and sends template or fixed text.
It does not call AI. Example body (replace recipient and UUID):

```json
{ "companionId": "<UUID>", "to": "8801712345678", "type": "template" }
```

Omitting companionId uses WHATSAPP_PHONE_NUMBER_ID from the environment.

## Limits and checks

Committed AI replies are reused by whatsappMessageKey on retries without another
charge. Outbound delivery deduplication remains process-local; a restart or ambiguous
Meta timeout can resend the saved reply. Webhooks await AI completion. A durable
queue/outbox is needed for production throughput. AI success followed by database
rollback can repeat remote work. Replies are currently truncated to 4096 characters.
Webhook payloads are not logged because START messages contain linking secrets.

Tests mock external services:

```sh
npm test -- --runInBand whatsapp aiapi chat.service.spec.ts
npm run build
```

Live AI authentication and WhatsApp delivery still require a linked test recipient
and valid credentials. Migrations are provided, not automatically applied.
