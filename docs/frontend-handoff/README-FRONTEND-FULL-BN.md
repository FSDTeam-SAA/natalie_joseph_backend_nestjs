# Meet Elysia - Complete frontend and admin API handbook

English handoff generated from local source: **126 routes**, **62 DTO classes**. Legacy filenames containing BN are retained for link compatibility; all document text is English. This is not a live deployment certificate.

Local base: `http://localhost:8080/api/v1`. Swagger: `/api/docs` when enabled. Browser environment variables may contain public API origins and publishable payment keys, never server secrets.

## Reading order

1. Integration flow guide
2. Profile publishing and 24-hour media stories
3. Lifestyle, library, billing and allowances
4. Endpoint index and exact source mapping
5. DTO validation and enum appendix


# Integration flow guide

# Frontend and admin integration guide

English handoff updated 10 November 2026. This is a source-based implementation guide, not a live release certificate. Legacy filenames are retained to preserve links.

## References and API client

- `api-reference-bn.md`: generated controller routes, request decorators, response mapping and exact DTO validation.
- `api-contract.json`: machine-readable source inventory, not OpenAPI.
- `README-FRONTEND-FULL-BN.md`: this guide, publishing/lifestyle guidance and exact API appendices combined.
- `frontend-integration-bn.html`: browser-readable guide/reference.

Local API base: `http://localhost:8080/api/v1`. Production uses the configured HTTPS backend origin. Append the API prefix only once. Public browser environment variables must never contain bot tokens, signing secrets, database credentials or AI keys.

Protected JSON requests use `Authorization: Bearer <accessToken>` and `Content-Type: application/json`. Browser FormData uploads must set their own multipart boundary. Normal JSON responses use the global `statusCode`, `success`, `message`, optional `meta`, and `data` envelope. Data may be an object, array or null; raw HTML/media/webhook responses differ.

Follow runtime DTO decorators and query allowlists. User, companion, conversation, message, local plan, credit package and provider subscription IDs are different identifiers. Payment routes usually accept a local plan ID, not a Stripe `sub_...` ID.

## Website and dashboard screen map

| Screen | API group | UI responsibilities |
|---|---|---|
| Registration/session/reset | `/auth/*`, `/user/my-profile` | Form errors, token/cookie session and reset flow |
| Companion cards/details | `/companions`, `/companions/:id` | Filters, pagination, profile/gallery and Telegram CTA |
| Plans/billing | `/subscription`, `/payment/subscription/*`, `/payment/billing-portal` | Checkout, reconciliation, cancellation and upgrade state |
| Wallet/packages | `/credits/wallet`, `/credits/packages`, `/credits/costs`, `/credits/ledger` | Balances, expiry, prices and history |
| Chat | `/chat/conversations`, `/chat/:companionId/messages`, `/chat/usage` | Text/media, saved history, loading and stable retry ID |
| Photo request | `/lifestyle/companions/:companionId/photo` | Library-first response, trial/credit errors |
| Daily feed | `/lifestyle/preference`, `/allowances`, `/inbox` | Selected companion, opt-in and remaining allowance |
| Media Story viewer | `/media-stories/summary`, `/media-stories/companions/:id` | Rings, expiry, signed media and next/previous |
| Text life events | `/companions/:id/stories` | Published dated text context |
| Gallery unlock/history | `/companions/:id/photos/view`, `/photos/history` | Existing gallery item unlock and history |
| Gifts/relationships | `/gifts`, `/gifts/:id/send`, `/relationships` | Catalogue, debit, nickname and notes |
| Notifications | `/notifications`, `/notifications/:id/read` | List and read state |
| Telegram return | `/telegram/status/:id`, `/telegram/connect/:id` | Authentication, plan, connection and return buttons |
| Admin overview/users | `/dashboard/overview`, `/user`, `/admin/users/:id/details`, `/ledger` | Metrics, search and financial detail |
| Admin companion editor | `/companions`, image/voice routes | Nested metadata, uploads and gallery append/replace |
| Admin lifestyle | `/admin/companions/:id/lifestyle/*` | Routine, library, approval and daily scheduling |
| Admin publishing | Telegram-profile/media-story routes | Sync state, retry, publication and removal |
| Admin support | `/admin/conversations/*` | Monitoring, AI/human mode and human reply persistence |
| Admin finance/content | Package, plan, gift, cost and text-story routes | Validated management forms |

Newsletter subscription, legal HTML and explicit admin broadcast actions remain separate. Do not expose subscriber management merely because a controller has no JWT guard; review service/access behavior before release.

## Authentication and reset

Registration example:

```json
{"name":"Demo User","email":"demo@example.com","phoneNumber":"+8801700000000","password":"ExampleOnly123!","adultEligible":true}
```

Adult confirmation must come from the user. Registration returns account data rather than a login token; log in next. Use `/auth/register` rather than the legacy `/user` creation route for normal signup.

Login body is email/password. Use `data.accessToken` for API requests and sanitized `data.user` for navigation. Backend guards remain authoritative. Do not infer current balance or entitlement from an old JWT.

Refresh uses an HttpOnly cookie; requests may need credentials/include or withCredentials. Current secure/same-site cookie behavior requires appropriate HTTPS and same-site/reverse-proxy deployment. CORS alone does not fix cross-site cookie restrictions. Do not store passwords, OTPs or reset tokens in localStorage.

Reset sequence:

1. POST `/auth/forgot-password` with email.
2. POST `/auth/verify-otp` with email and the six-character OTP string.
3. POST `/auth/reset-password` with email, password and returned `data.resetToken`.
4. Clear sensitive form state and log in again. Password changes invalidate older sessions.

Change password uses `/auth/change-password` with email/oldPassword/newPassword. Logout uses `/auth/logout` followed by client session cleanup.

## Subscription, payment and wallet

Select a local plan ID and POST `/payment/subscription/:subscriptionId`.

- Free activation may return `activated:true` and `clientSecret:null`; refetch usage rather than opening payment UI. One-use trial/activation restrictions remain server-side.
- Paid checkout returns a clientSecret for payment confirmation. Other response fields can vary by branch; handle optional/null values.
- An existing plan may return `alreadySubscribed:true`; do not repeatedly create subscriptions.
- Upgrade uses `/payment/subscription/:subscriptionId/upgrade`; cancellation uses `/payment/subscription/cancel`. Display returned/status state rather than assuming immediate expiry.
- `/payment/billing-portal` returns a URL for provider-managed billing.

Payment UI success alone does not establish backend activation. Reconcile subscription state with `/payment/subscription/sync`, status, usage and wallet reads. Sync is not a generic purchased-credit settlement API.

Credit checkout uses only `POST /payment/credits` with packageId. The server determines price/credits. After confirmation, use bounded wallet polling and a pending state; never instruct repeated Pay clicks while a webhook is delayed.

Usage includes active subscription, dates, creditAllowance/creditsUsed, remaining subscription credits, purchasedCredits/creditBalance, totalCredits and lowCredit/threshold. A zero legacy message count alone must not block purchased-credit usage. Expired subscriptions may still restrict access even when purchased credits remain.

Read action rates from `/credits/costs`. Wallet returns recent ledger entries and purchased lots with remainingAmount/expiresAt; use the ledger endpoint for history. Format UTC dates in the user's timezone and handle decimal price strings deliberately.

## Telegram connection

Preserve the selected companion through login/registration/payment. Refetch usage and `/telegram/status/:companionId`. If unlinked, create a connection URL only on an explicit button click. The link is single-use and expires after ten minutes. The user must open Telegram and press Start; a backend cannot bypass that action. Refetch status on return and provide expired-link recovery.

Status includes companion identity, linked state, active-subscription state and Telegram/credit/subscription URLs. A returned URL alone does not prove linking. Provide an explicit Continue in Telegram fallback if automatic navigation is blocked.

The login Mini App requires signed Telegram initData. A normal browser without it is not an equivalent login environment. Account-transfer/connection decisions require their existing backend consent flow; do not silently reassign identities.

## Chat, library and response data

Use a stable UUID requestId per action; reuse it for network retries of that same action. Different content needs a new ID. Render message_type/media, handle null text and refresh saved history after errors. No general realtime socket/SSE implementation is established by this guide.

| Endpoint | Read data from |
|---|---|
| GET companion/plan/user collections | `result.data` and optional `result.meta` |
| GET chat messages | `result.data.messages`, total/page/limit |
| POST general chat | `result.data.response`, message_type, media; saved row in message |
| POST lifestyle photo | Saved row: `result.data.aiPayload.media`, response |
| GET daily inbox | Delivery array and content text/photo fields |
| GET allowances | policy, usage, periodStart/periodEnd |
| GET preference | Object or null |
| GET media Story feed | stories, companion, serverTime, hasActiveStory |
| GET overview | Metrics object; not a time-series dataset |

Typed image requests now use approved unseen library matching before paid generation. New gallery images enter the library pending approval. Generic reusable generations can be saved pending only when safe/durable; private/custom content is excluded. Spoken image requests retain the existing AI route.

Trial included allowances are distinct from wallet credits. Use policy/usage, not zero wallet alone, to explain trial access. Verify Mini App trial state handling before release; older status logic may still classify zero credit as credit-required. Images use photo rates, while response-billing mode also measures voice/transcription units. See the lifestyle guide for exact rules.

Human-mode input is stored without automatic AI generation. An admin reply being saved does not prove an outbound Telegram push. Do not automatically retry payments, gifts or broadcasts merely because chat has request-ID replay protection.

## Admin editing and uploads

Follow nested DTOs for personality, communication, background, visual identity and voice. Gallery append and replacement are distinct operations. Photo Library now supports import, caption/tags, approval, pagination and removal. Daily content requires an approved companion photo and valid companion-local dates/window.

Overview keys include totalUsers, totalSubscriptionPlans, activeSubscriptions, activeSubscribers, totalMessages, totalConversations and totalRevenue. Legacy totalSubscriptions/totalConversions refer to plan/message counts, not conversion rates. Do not invent trend charts or currency conversions from aggregate metrics.

Read current DTO/service permissions before creating role/status/account-approval controls. Older self-profile update paths had a password-only update limitation; do not send dummy passwords as a workaround. Payment export/refund/manual top-up and bot token/username editing are not implied by existing general admin forms.

## Errors and deployment

| Status | UX |
|---|---|
| 400 | Explain validation/operation errors and preserve editable fields |
| 401 | Attempt one controlled refresh, then login without redirect loops |
| 402 | Refetch entitlement/usage and offer subscription or credit purchase |
| 403 | Explain eligibility/permission/trial restriction; do not simply request payment |
| 404 | Show unavailable/missing item state |
| 409 | Refetch conflicting/account/takeover state |
| 429 | Respect retry guidance and show cooldown |
| 502/503 | Show a safe temporary-error/retry state, never a raw stack |

Design loading, empty, pending-payment, failed, expired-link and insufficient-credit states. Do not retry paid mutations blindly.

Coordinate exact HTTPS website/admin origins and backend CORS settings. Telegram connect/register/reset/subscription/credit URL settings must point to actual frontend pages, not Swagger. Public environment changes require restart/rebuild. Legal HTML lives outside the API prefix. Production rollouts and migrations require the reviewed deployment workflow.

Before release verify authentication/reset, role isolation, trial/paid checkout, pending webhooks, credit expiry/rates, connection/recovery, media playback/history, human mode, uploads/schedules, Android/iOS/Desktop/Web and original client reference matching. Live provider behavior and nullability require staging acceptance; source-derived routes and passing unit tests are not certification.

See [publishing guidance](companion-publishing-bn.md), [lifestyle guidance](../README-lifestyle-handoff-bn.md) and the root `RUN_PROJECT.md`. The root photo-library handoff records known verification limits and content readiness.


# Profile publishing and media stories

# Telegram profile sync and 24-hour media Stories

English handoff. These publishing features are separate from approved library delivery and scheduled daily subscription content.

## Behavior

Saving a companion name/profile photo updates the website first and queues Telegram synchronization when enabled/configured. Publishing APIs also manage About and Description. Bot username editing is not supported. Upload the profile photo through the backend/Cloudinary flow; the worker converts it to JPEG for Telegram. No client OTP is needed.

Media Stories remain available for 24 hours after publication through website APIs and the Telegram Mini App viewer. This is not Telegram's native Story bar. An approved adult account is required, with account linking for Telegram. Viewing does not consume chat/subscription credits.

## Initial acceptance flow

1. Review/apply required migrations for the target environment, then restart the intended backend instance.
2. If the optional publishing console is enabled, open `http://localhost:8080/api/v1/publishing/admin` and log in with an existing admin account.
3. Select a companion, edit display name/About/Description and choose **Save profile & queue sync**.
4. Upload a profile image. Status moves through pending/processing to synced or failed. The worker checks approximately every 15 seconds; multiple bots may take longer. Check Telegram and refresh cached profiles. Correct configuration before retrying. Automatic attempts are bounded at three.
5. Publish JPEG/PNG/WebP or MP4 media with an optional caption. Default upload limit is 10 MB; H.264/AAC is appropriate for browser MP4 playback.
6. A connected Telegram user can use Menu > Stories or `/stories` and choose the viewer. Next/previous, captions, video playback and refresh need device testing.
7. Removing/expiring a Story makes subsequent feed/media requests unavailable. Already downloaded content cannot be recalled. Signed media links last five minutes; refresh/reopen the viewer when necessary.

Publishing does not broadcast unsolicited messages to every user. Menu setup commands are deliberate administrative actions: `node scripts/telegram.cjs menu` configures five bots, or append `ELENA` for one bot. This menu command does not change webhooks or send user messages; existing more-specific Telegram menu overrides may take precedence.

## Configuration

```dotenv
TELEGRAM_PROFILE_SYNC_ENABLED=true
COMPANION_MEDIA_STORIES_ENABLED=true
PUBLISHING_ADMIN_CONSOLE_ENABLED=true
STORY_MAX_UPLOAD_MB=10
STORY_MEDIA_SIGNING_SECRET=<strong-persistent-random-secret>
TELEGRAM_PUBLIC_BASE_URL=https://your-backend-domain.example
```

Keep signing secrets persistent and consistent across replicas. Existing bot-token/companion-ID mappings and Cloudinary credentials are required. A changing tunnel URL requires deliberate public-base/webhook updates and restart; use stable HTTPS origins in production. Registration/payment website URL settings remain separate.

## API map

Prefix routes with `/api/v1`; normal payloads are in `data`. Admin mutations require an admin Bearer token.

| Method | Path | Use |
|---|---|---|
| GET | `/admin/companions/:companionId/telegram-profile` | Desired fields, status and safe lastError |
| PUT | `/admin/companions/:companionId/telegram-profile` | displayName (64), about (120), description (512 characters) |
| POST | `/admin/companions/:companionId/telegram-profile/retry` | Requeue eligible profile sync |
| PUT | `/companions/:id/profile-image` | Multipart profileImage; website save plus configured sync |
| GET / POST | `/admin/companions/:companionId/media-stories` | Recent metadata or multipart media plus caption (2048 characters) |
| DELETE | `/admin/companions/:companionId/media-stories/:storyId` | Remove a Story and clear stored media bytes |
| GET | `/media-stories/summary` | Authenticated active counts and expiry for avatar rings |
| GET | `/media-stories/companions/:companionId` | Authenticated active feed with signed mediaPath |
| GET | `/media-stories/:storyId/media?ticket=...` | Signed media bytes, including video Range support |
| GET | `/telegram/stories?companionId=...` | Mini App viewer shell |
| POST | `/telegram/stories/:companionId/feed` | Signed initData/account-validated feed |

A mediaPath already begins with `/api/v1`; prepend only the backend origin. Use serverTime/expiresAt for countdown and refresh at expiry. Public companion data may expose display fields; private queue status remains in admin APIs. A failed Telegram sync does not roll back saved website fields.

## Operations and limits

Use the reviewed deployment workflow: install dependencies, generate Prisma, review/apply pending migrations, build, then start under the deployment process manager. The optional test console can be disabled after dashboard integration while keeping role-protected APIs available.

Uploads are memory-buffered and Story bytes use the database. Higher-volume media requires an appropriate object-storage/streaming design. Expired bytes are cleaned periodically (approximately every ten minutes), with metadata retained. Basic signatures are checked; malware scanning/transcoding are not included.

Automated tests cover expiry, access, signed links, leases/retries, ranges and browser script parsing. Live profile mutation and real-account Story publishing were not performed as part of those tests. Exact website/Figma integration and device acceptance remain separate work.


# Lifestyle and photo-library integration

# Lifestyle, photo library, daily content and allowances

English source handoff updated 10 November 2026. This describes local implementation, not completed production acceptance. See the root photo-library handoff for the latest verification snapshot.

## Ownership and content types

The main backend owns identity, adult/account eligibility, subscription policy, credits, scheduling and delivery. The AI service owns generation, persona, routine-grounded responses, memory, image and voice processing.

Five companions are configured: Elena, Chloe, Lina, Luna and Thalia. Weekly routine and approved content provide consistent fictional activity context. Keep these distinct:

- Profile gallery: public companion reference/gallery assets.
- Approved photo library: tagged assets selected for user requests.
- Text StoryEvent: dated global life-event context.
- Media Story: expiring photo/video viewer content.
- Daily subscription content: scheduled approved photo and text delivered to opted-in eligible users.

New gallery uploads create pending library entries; they do not publish daily content or a media Story automatically.

## Routes

Prefix every path below with `/api/v1`. Admin routes require an admin Bearer token; user routes require a user token. Normal response payloads are inside `data`. Library/schedule/delivery lists use `page` with fixed pages of 50.

Admin base: `/admin/companions/{companionId}/lifestyle`.

| Method | Suffix | Behavior |
|---|---|---|
| GET / PUT | `/routine` | Read or replace timezone and weekly slots |
| GET | `/context` | Preview current local activity and approved context |
| GET / POST | `/photos` | List or upload pending library images |
| POST | `/photos/import-gallery` | Import missing gallery URLs for review |
| PATCH | `/photos/{photoId}` | Approve/revoke with `approved` |
| PUT | `/photos/{photoId}` | Edit caption/tags |
| DELETE | `/photos/{photoId}` | Remove the library entry, preserving delivered assets |
| GET / PUT | `/daily-content` | List or draft/publish a daily schedule |
| POST | `/daily-content/{contentId}/unpublish` | Stop future reservations |
| GET | `/deliveries` | Inspect delivery states |

| User method | Path | Behavior |
|---|---|---|
| GET / PUT | `/lifestyle/preference` | Select one companion and opt in/out |
| GET | `/lifestyle/allowances` | Read policy and included/trial usage |
| GET | `/lifestyle/inbox` | Read eligible available daily content |
| POST | `/lifestyle/companions/{companionId}/photo` | Library-first photo request; requestId required |
| POST | `/chat/{companionId}/messages` | General chat; preserve optional requestId on retry |

## Routine example

```json
{"timezone":"Asia/Dubai","weekly":[{"day":1,"start":"06:00","end":"12:00","activity":"Coffee at home, then gym","location":"Dubai"},{"day":1,"start":"12:00","end":"18:00","activity":"Work at a cafe"},{"day":1,"start":"18:00","end":"23:00","activity":"Dinner with friends"},{"day":1,"start":"23:00","end":"06:00","activity":"Sleep"}]}
```

Monday=1 and Sunday=7. Overnight slots end the next day. Overlap is rejected. Supply the other days as needed. Unscheduled time produces no resolved activity rather than inventing one.

## Image upload and approval

```javascript
const body = new FormData();
body.append('image', selectedFile);
body.append('caption', 'A quiet morning before the gym.');
body.append('tags', 'gym,morning,sporty');
await fetch(`${API}/admin/companions/${companionId}/lifestyle/photos`, {
  method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body
});
```

`API` includes the backend origin and `/api/v1`. Let the browser set the multipart boundary. JPEG/PNG/WebP and a 10 MB limit are enforced. The existing uploader fits assets within 500x500; it is not a full-resolution-original archive. Save the returned ID, edit tags and approve explicitly. Ownership is scoped to the selected companion.

Typed natural-language requests and `/photo` first search approved unseen assets. Every explicit tag constraint must match. A paid miss falls back to AI generation; a trial miss does not start paid generation. Generic durable generated output may be retained pending review with private history excluded. Personal requests stay out of the shared library.

## Daily schedule example

```json
{"day":"2026-11-01","publishAt":"2026-11-01T08:00:00+04:00","expiresAt":"2026-11-01T23:59:00+04:00","photoId":"APPROVED-PHOTO-UUID","text":"Good morning! Coffee first, then the gym.","activity":"Morning coffee and gym","published":true}
```

Use real UUIDs and explicit offsets. The day must match the companion-local publication date. The positive delivery window cannot exceed 24 hours. Missed previous-day content is not caught up. Editing is blocked once delivery records exist; preview drafts first.

Opt-in body:

```json
{"companionId":"COMPANION-UUID","enabled":true}
```

Photo request body:

```json
{"requestId":"NEW-UUID-PER-ACTION","tag":"gym"}
```

## Policies and billing

Plan entitlement policy is copied to a membership snapshot. Editing a plan does not retroactively rewrite existing memberships. An empty legacy policy is treated as paid without implicit daily inclusion. No automatic trial-to-paid conversion or historical financial backfill was introduced.

An explicit trial policy supports a three-day trial, capped at 10 replies per rolling 24 hours and 30 total, plus one included photo per rolling day and three total. Voice is excluded. Library requests and scheduled trial photos share the included-photo allowance. Existing free-activation one-use checks remain.

Paid policy can enable `dailyPhoto` and `dailyText`. One account selects one daily companion; allowance is not multiplied by five companions. Paid inclusion uses UTC calendar days; routine/content dates use the companion timezone.

Read rates from `/credits/costs`; update through `PUT /admin/credit-costs/{action}` with `{"credits":10}`. Do not overwrite existing financial settings merely to match a proposal. Package CRUD supports the business owner's selected pricing.

With `AI_RESPONSE_BILLING_ENABLED=true`:

- Text output uses the message rate.
- Images use the photo rate, including captions.
- Voice uses `ceil(voice_characters/500) * voice`.
- Incoming audio adds `ceil(transcription_seconds/60) * transcription`.
- Human-mode input and failed AI responses do not incur content debit.
- Missing/invalid required measurements cause an error and wallet-transaction rollback.

Legacy mode retains fixed voice/message charging, with actual image output using the photo rate. Ledger expiry and subscription-first credit consumption remain. User upgrade creates a new membership snapshot.

## Delivery semantics

The worker runs each minute with a bounded batch, not exact-second guarantees. Website-only users receive inbox availability; linked Telegram users may receive delivery.

States: `available` (website inbox), `sent` (confirmed Telegram send), `failed` (definitive rejection), `unknown` (ambiguous outcome), `skipped` (ineligible/no allowance), and `sending` (in progress).

Failed/unknown delivery retains inbox content. Ambiguous Telegram sends are not automatically repeated. Unpublishing/revoking content cannot erase already-downloaded media or sent messages. Library Cloudinary assets use the existing public URL model, not DRM.

## Deployment and scope

Relevant flags are `DAILY_CONTENT_DELIVERY_ENABLED`, `AI_LIFESTYLE_CONTEXT_ENABLED` and `AI_RESPONSE_BILLING_ENABLED`. Enable daily delivery only for the intended worker/deployment; it can send due content to eligible opted-in users.

Deploy the updated AI service before the backend: `/chat` must validate/acknowledge `lifestyle-v1`, support voice mode and return billing measurements. Public lifestyle grounding is optional; this caller's own library delivery context supports conversation continuity. Context cannot expand a signed authorization grant. Private relationship notes and other users' histories are not shared.

Existing database migrations must be applied to a new environment after review/backups. This library-first feature introduced no additional migration. Generate Prisma, build/test, restart, configure approved content and perform staging acceptance. Read [the AI contract](ai-lifestyle-contract.md), [the full handbook](frontend-handoff/README-FRONTEND-FULL-BN.md), and the root `RUN_PROJECT.md`.

Instagram/social auto-posting, short-video generation, new payment gateways and provider approval were not implemented by this feature. Frontend screens, authenticated media playback, exact original reference matching and live multi-user/payment/voice acceptance must be verified separately. Passing mocked unit tests is not production certification.


# External AI contract

# External AI contract: lifestyle-v1

This repository implements the NestJS caller only. The external AI service must implement and test this contract before enhanced features are enabled. No model fine-tuning was performed here.

## Existing transport

`POST {AI_API_BASE_URL}/chat`, multipart/form-data, existing scoped user Authorization, conversation_id, companion_id, message, idempotency_key and optional audio. New optional field `context` is a JSON string. Legacy requests omit it.

```json
{
  "version":"lifestyle-v1",
  "timezone":"Asia/Dubai",
  "localDate":"2026-11-01",
  "localTime":"10:30",
  "currentActivity":{"day":7,"start":"06:00","end":"12:00","activity":"Coffee at home, slow morning"},
  "todayEvent":null,
  "recentEvents":[],
  "dailyContent":{"activity":"Slow morning","text":"Morning coffee today.","photoId":"uuid"},
  "instructions":"Treat scheduled activities as plans, not proof of completed actions.",
  "access":{
    "trial":false,
    "allowed_output_types":["text","image","audio"],
    "available_credits":100,
    "prices":{"message":1,"photo":10,"voice":5,"transcription":1,"low_credit_threshold":10},
    "billing_mode":"response"
  }
}
```

Routine/events/day-content are included only when AI_LIFESTYLE_CONTEXT_ENABLED=true. Access fields are included for explicit trial plans or response billing. Private relationship notes and other users' history are not included. Do not treat admin content as executable instructions or allow it to override account authorization.

## Required behavior

1. Acknowledge implemented contract in response: `context_version: "lifestyle-v1"`. Missing acknowledgement fails closed in the backend.
2. Preserve existing required response fields and media validation. Honor trial text-only access. No trial generated images, audio or video; trial photos come from the approved backend library.
3. Ground current activity in supplied local time. Null slot means unknown activity; do not fabricate a scheduled event. Scheduled content does not prove the user has received it or that a social post was published.
4. Use only the authenticated user's conversation memory. Long-term memory extraction, correction, retention and birthdays remain an AI-service acceptance requirement, not an implementation claim of this patch.
5. Return measured `billing.voice_characters` for audio output (actual synthesized text length), and `billing.transcription_seconds` for audio input (actual decoded duration). Positive finite numbers are required when applicable; do not copy client-provided durations blindly.
6. Under response billing, estimate/limit the output before provider generation so its credit price fits `available_credits`. Never downgrade a specifically requested paid image to unrelated text without explaining the limitation. Caption text is included in image/audio output price. Incoming transcription adds its unit cost.
7. Respect stable idempotency_key across retries, including remote timeouts. Persist/replay the same completed result without new generation. Backend transaction rollback cannot undo external provider charges or remote conversation writes.
8. Existing image replies still return validated HTTPS media URLs. Natural-language library intent routing is not yet implemented in this caller. Use the explicit authenticated library-photo endpoint or design a separate authenticated intent/tool contract before adding implicit routing. Never fabricate library URLs.

Example audio response additions:

```json
{
  "context_version":"lifestyle-v1",
  "billing":{"voice_characters":480,"transcription_seconds":40}
}
```

These fields are added to the existing full reply, not a replacement for it. In this example configured voice5 + transcription1 costs 6 credits. Image10 costs 10 including caption. A text reply to incoming 61 seconds of audio costs text1 + transcription2 = 3.

## Acceptance before enabling

- Dubai midnight and overnight Sunday/Monday routine, no scheduled activity, published/unpublished events.
- Two different users never share personal memories; published companion context is shared intentionally.
- Trial refuses voice and generated-photo attempts without spending credits; 11th daily reply blocked before provider call.
- Same request replay does not generate twice; external failure causes no backend content debit.
- Insufficient budget prevents expensive generation; measured voice/transcription metadata matches actual content.
- Human-mode inputs bypass AI and content charging.
- Confirm identity/appearance and user-memory quality with representative conversations. A version string alone is not this validation.


# Endpoint index

| Method | Full path | Purpose | Access |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Register (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/auth/login` | Login (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/auth/refresh` | Refresh Token (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/auth/forgot-password` | Forgot Password (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/auth/verify-otp` | Verify Otp (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/auth/reset-password` | Reset Password (Auth). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/auth/change-password` | Change Password (Auth). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin', 'user')) |
| POST | `/api/v1/auth/logout` | Logout (Auth). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin', 'user')) |
| GET | `/api/v1/chat/conversations` | Get Conversations (Chat). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/chat/:companionId/messages` | Get Messages (Chat). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/chat/usage` | Get Usage (Chat). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/chat/:companionId/messages` | Send a text or voice-mode request; preserve requestId on retry. Approved library matches bypass generation. | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/companions` | Create Companion (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/companions` | Get All Companions (Companions). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/companions/:id` | Get Companion By Id (Companions). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| PUT | `/api/v1/companions/:id` | Update Companion (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/profile-image` | Update Profile Image (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/cover-image` | Update Cover Image (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/companions/:id/gallery` | Append gallery uploads and create pending photo-library entries. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/companions/:id/gallery` | Remove a gallery URL and revoke matching library approval. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/gallery` | Replace the gallery, revoke removed library approvals and import new uploads as pending. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/companions/:id` | Delete Companion (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/voice` | Update Voice (Companions). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/credits/packages` | Create Package (Credit). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/credits/packages` | Get Packages (Credit). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| PATCH | `/api/v1/credits/packages/:id` | Update Package (Credit). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/credits/packages/:id` | Deactivate Package (Credit). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/credits/wallet` | Get Wallet (Credit). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/dashboard/overview` | Dashboard Overview (Dashboard). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/relationships` | Relationships (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| PATCH | `/api/v1/relationships/:companionId` | Relationship (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/companions/:companionId/stories` | Stories (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/companions/:companionId/photos/view` | Photo (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/photos/history` | Photos (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/credits/ledger` | Ledger (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/credits/costs` | Costs (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/notifications` | Notifications (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| PATCH | `/api/v1/notifications/:id/read` | Read (Engagement). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| PUT | `/api/v1/admin/credit-costs/:action` | Cost (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/stories` | Story (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/stories` | Stories (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/conversations` | Conversations (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/conversations/:id` | Conversation (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PATCH | `/api/v1/admin/conversations/:id/mode` | Mode (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/conversations/:id/replies` | Save an admin human-mode reply; do not assume an outbound Telegram push. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/users/:id/details` | User (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/users/:id/ledger` | Ledger (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/notifications` | Notification (EngagementAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/gifts` | Create Gift (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/gifts` | Get Gifts (Gift). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/gifts/admin` | Admin Gifts (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/gifts/history` | History (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| PATCH | `/api/v1/gifts/:id` | Update Gift (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/gifts/:id` | Deactivate Gift (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/gifts/:giftId/send` | Send Gift (Gift). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/routine` | Routine (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/lifestyle/routine` | Save Routine (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/context` | Context (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/photos` | Photos (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/lifestyle/photos/import-gallery` | Import missing companion gallery URLs as pending library entries. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/lifestyle/photos` | Upload an image to the companion photo library for review. | UseGuards(AuthGuard('admin')) |
| PATCH | `/api/v1/admin/companions/:companionId/lifestyle/photos/:photoId` | Approve a library photo or return it to pending. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/lifestyle/photos/:photoId` | Edit a library photo caption and normalized tags. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/admin/companions/:companionId/lifestyle/photos/:photoId` | Remove a library entry while retaining assets used by delivered chat history. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/daily-content` | Daily (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/lifestyle/daily-content` | Save (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/lifestyle/daily-content/:contentId/unpublish` | Unpublish (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/deliveries` | Deliveries (LifestyleAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/lifestyle/preference` | Preference (Lifestyle). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| PUT | `/api/v1/lifestyle/preference` | Save (Lifestyle). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/lifestyle/allowances` | Allowances (Lifestyle). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/lifestyle/companions/:companionId/photo` | Request an approved unseen library photo; paid users fall back to generation when no match exists. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/lifestyle/inbox` | Inbox (Lifestyle). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/newsletter` | Send Mail (Newsletter). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/newsletter/broadcast` | Broadcast Newsletter (Newsletter). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/newsletter` | Get All Newsletter (Newsletter). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/newsletter/:id` | Get Newsletter By Id (Newsletter). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/payment/config` | Config (Payment). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/payment/subscription/status` | Status (Payment). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/sync` | Sync (Payment). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/billing-portal` | Portal (Payment). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/cancel` | Cancel (Payment). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/:subscriptionId/upgrade` | Upgrade (Payment). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/:subscriptionId` | Start local-plan activation or recurring subscription checkout. | UseGuards(AuthGuard('admin', 'user')) |
| POST | `/api/v1/payment/credits` | Start credit-package checkout using packageId; never trust a client-supplied price. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/admin/companions/:companionId/telegram-profile` | Status (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/telegram-profile` | Profile (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/telegram-profile/retry` | Retry (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/media-stories` | List (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/media-stories` | Publish (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/admin/companions/:companionId/media-stories/:storyId` | Remove (PublishingAdmin). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/media-stories/summary` | Summary (MediaStory). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/media-stories/companions/:companionId` | Feed (MediaStory). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/media-stories/:storyId/media` | Media (StoryMedia). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/telegram/stories` | Page (TelegramStory). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/telegram/stories/:companionId/feed` | Feed (TelegramStory). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/publishing/admin` | Page (PublishingConsole). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/subscription` | Create Subscription (Subscription). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/subscription` | Get All Subscription (Subscription). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/subscription/:id` | Get Subscription By Id (Subscription). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| PUT | `/api/v1/subscription/:id` | Update Subscription (Subscription). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/subscription/:id` | Delete Subscription (Subscription). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/telegram/status/:companionId` | Status (TelegramConnect). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/telegram/connect/:companionId` | Create a short-lived, single-use link for the selected companion. | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/telegram/app` | Page (TelegramMiniApp). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/telegram/app/settings/:companionId` | Settings (TelegramMiniApp). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/telegram/app/login/:companionId` | Verify signed Telegram initData and website credentials before linking accounts. | Service, signature or provider validation applies |
| POST | `/api/v1/telegram/app/status/:companionId` | Status (TelegramMiniApp). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/webhooks/telegram/:companionId` | Receive For Companion (TelegramWebhook). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/webhooks/telegram` | Receive (TelegramWebhook). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| POST | `/api/v1/user` | Create User (User). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/user` | Get All User (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/user//overview` | Get All User Overview (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/user/my-profile` | My Profile (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| PUT | `/api/v1/user/my-profile` | Update My Profile (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/user/payments` | My Payments (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/user/:id` | Get User By Id (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/user/:id` | Update User (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/user/:id` | Delete User (User). Follow the exact handler and DTO below. | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/webhook` | Process the signed payment-provider webhook; this is not a frontend endpoint. | Service, signature or provider validation applies |
| GET | `/` | Get Hello (App). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/health/live` | Live (Health). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/api/v1/health/ready` | Ready (Health). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/privacy-policy` | Privacy Policy (LegalPages). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/terms` | Terms (LegalPages). Follow the exact handler and DTO below. | Service, signature or provider validation applies |
| GET | `/data-deletion` | Data Deletion (LegalPages). Follow the exact handler and DTO below. | Service, signature or provider validation applies |

# Exact API request and response mapping

Controller source is response mapping, not a live response example. Normal JSON responses receive the global success envelope. Raw HTML/media and provider webhook responses may differ. An absent JWT guard does not bypass service-level signatures, initData validation or resource ownership checks.

## POST /api/v1/auth/register

Register (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:39`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() createAuthDto: CreateAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('register')
@ApiOperation({
    summary: 'Register a new user',
  })
@ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User already exists',
  })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.register(createAuthDto);

    return {
      message: 'User registered successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/login

Login (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:62`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() loginAuthDto: LoginAuthDto
@Res({ passthrough: true }) res: Response
```

Upload/status/validation metadata:

```typescript
@Post('login')
@ApiOperation({
    summary: 'Login user',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid email or password',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.login(loginAuthDto, res);

    return {
      message: 'Login successfully',
      data: result,
    };
  }
```

## GET /api/v1/auth/refresh

Refresh Token (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:88`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('refresh')
@ApiOperation({
    summary: 'Generate new access token using refresh token',
  })
@ApiCookieAuth('refreshToken')
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Access token refreshed successfully',
  })
@ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token invalid or missing',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.refreshToken(req);

    return {
      message: 'Token refreshed successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/forgot-password

Forgot Password (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:112`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() forgotPasswordAuthDto: ForgotPasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('forgot-password')
@ApiOperation({
    summary: 'Send password reset OTP',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User not found',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.forgotPassword(
      forgotPasswordAuthDto.email,
    );

    return {
      message: 'OTP sent successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/verify-otp

Verify Otp (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:137`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() verifyOtpAuthDto: VerifyOtpAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('verify-otp')
@ApiOperation({
    summary: 'Verify password reset OTP',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP verified successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired OTP',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.verifyOtp(
      verifyOtpAuthDto.email,
      verifyOtpAuthDto.otp,
    );

    return {
      message: 'OTP verified successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/reset-password

Reset Password (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:163`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() resetPasswordAuthDto: ResetPasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('reset-password')
@ApiOperation({
    summary: 'Reset password after OTP verification',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'OTP verification required',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.resetPassword(
      resetPasswordAuthDto.email,
      resetPasswordAuthDto.password,
      resetPasswordAuthDto.resetToken,
    );

    return {
      message: 'Password reset successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/change-password

Change Password (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:190`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Body() changePasswordAuthDto: ChangePasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('change-password')
@ApiOperation({
    summary: 'Change logged-in user password',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
  })
@ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const userId = req.user!.id;
    const result = await this.authService.changePassword(
      userId,
      changePasswordAuthDto.oldPassword,
      changePasswordAuthDto.newPassword,
    );

    return {
      message: 'Password changed successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/logout

Logout (Auth). Follow the exact handler and DTO below.

Source: `src/app/module/auth/auth.controller.ts:223`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Res({ passthrough: true }) res: Response
```

Upload/status/validation metadata:

```typescript
@Post('logout')
@ApiOperation({
    summary: 'Logout logged-in user',
  })
@ApiBearerAuth('access-token')
@ApiCookieAuth('refreshToken')
@UseGuards(AuthGuard('admin', 'user'))
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successfully',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.logout(req, res);

    return {
      message: 'Logout successfully',
      data: result,
    };
  }
```

## GET /api/v1/chat/conversations

Get Conversations (Chat). Follow the exact handler and DTO below.

Source: `src/app/module/chat/chat.controller.ts:28`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('conversations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    return { data: await this.chatService.getConversations(request.user.id) };
  }
```

## GET /api/v1/chat/:companionId/messages

Get Messages (Chat). Follow the exact handler and DTO below.

Source: `src/app/module/chat/chat.controller.ts:36`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get(':companionId/messages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    if (page < 1) throw new BadRequestException('Page must be positive');
    return {
      data: await this.chatService.getMessages(
        request.user.id,
        companionId,
        page,
      ),
    };
  }
```

## GET /api/v1/chat/usage

Get Usage (Chat). Follow the exact handler and DTO below.

Source: `src/app/module/chat/chat.controller.ts:55`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('usage')
@ApiOperation({ summary: 'Get subscription usage and credit balance' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.getUsage(request.user.id);
    return { message: 'Chat usage fetched successfully', data };
  }
```

## POST /api/v1/chat/:companionId/messages

Send a text or voice-mode request; preserve requestId on retry. Approved library matches bypass generation.

Source: `src/app/module/chat/chat.controller.ts:65`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Body() payload: SendMessageDto
```

Upload/status/validation metadata:

```typescript
@Post(':companionId/messages')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Send a message to a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.sendMessage(
      request.user.id,
      companionId,
      payload.message,
      request.headers.authorization!,
      payload.type,
      payload.requestId ? `web:${request.user.id}:${companionId}:${payload.requestId}` : undefined,
    );
    return { message: 'Message sent successfully', data };
  }
```

## POST /api/v1/companions

Create Companion (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:39`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() payload: CreateCompanionDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: CreateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.createCompanion(payload);
    return { message: 'Companion created successfully', data };
  }
```

## GET /api/v1/companions

Get All Companions (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:50`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@HttpCode(HttpStatus.OK)
@ApiOperation({
    summary: 'Get all companions',
    description:
      'Returns each public companion profile with its routine (timezone and weekly slots). The routine is null until an admin creates it.',
  })
@ApiQuery({ name: 'searchTerm', required: false, type: String })
@ApiQuery({ name: 'occupation', required: false, type: String })
@ApiQuery({ name: 'location', required: false, type: String })
@ApiQuery({ name: 'status', required: false, type: Boolean })
@ApiQuery({ name: 'interest', required: false, type: String })
@ApiQuery({ name: 'personalityTrait', required: false, type: String })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'sortBy', required: false, type: String })
@ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
```

Controller response mapping:

```typescript
{
    const filters = pick(request.query, [
      'searchTerm',
      'name',
      'title',
      'backstory',
      'occupation',
      'profession',
      'location',
      'status',
      'interest',
      'personalityTrait',
    ]);
    const options = pick(request.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ]);
    const result = await this.companionsService.getAllCompanions(
      filters,
      options,
    );
    return {
      message: 'Companions fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/companions/:id

Get Companion By Id (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:97`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@HttpCode(HttpStatus.OK)
@ApiOperation({
    summary: 'Get a companion by ID',
    description:
      'Returns the public companion profile with its routine (timezone and weekly slots). The routine is null until an admin creates it.',
  })
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.getCompanionById(id);
    return { message: 'Companion fetched successfully', data };
  }
```

## PUT /api/v1/companions/:id

Update Companion (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:109`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() payload: UpdateCompanionDto
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: UpdateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateCompanion(id, payload);
    return { message: 'Companion updated successfully', data };
  }
```

## PUT /api/v1/companions/:id/profile-image

Update Profile Image (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:123`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@UploadedFiles() files: { profileImage?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/profile-image')
@ApiTags('Telegram profile setup')
@ApiOperation({
    summary: '1. Upload profile photo — website and Telegram',
    description:
      'Admin only. Click Try it out, enter the companion ID and choose a file in profileImage. Saves the website photo and queues Telegram sync when TELEGRAM_PROFILE_SYNC_ENABLED=true and this companion has a configured bot. The worker checks every 15 seconds; upload success does not mean Telegram sync is complete. Check GET /api/v1/admin/companions/{companionId}/telegram-profile for enabled, status and lastError. When sync is disabled, only the website photo changes.',
  })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['profileImage'],
      properties: { profileImage: { type: 'string', format: 'binary' } },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'profileImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'profileImage',
      files.profileImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## PUT /api/v1/companions/:id/cover-image

Update Cover Image (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:159`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@UploadedFiles() files: { coverImage?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/cover-image')
@ApiOperation({ summary: 'Set or replace companion coverImage' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['coverImage'],
      properties: { coverImage: { type: 'string', format: 'binary' } },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'coverImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'coverImage',
      files.coverImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## POST /api/v1/companions/:id/gallery

Append gallery uploads and create pending photo-library entries.

Source: `src/app/module/companions/companions.controller.ts:190`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Post(':id/gallery')
@ApiOperation({ summary: 'Add to companion galleryImages' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      true,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## DELETE /api/v1/companions/:id/gallery

Remove a gallery URL and revoke matching library approval.

Source: `src/app/module/companions/companions.controller.ts:227`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Query('url') url: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id/gallery')
@ApiOperation({ summary: 'Remove one companion gallery image' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiQuery({
    name: 'url',
    type: String,
    required: true,
    description: 'Cloudinary image URL to remove from gallery',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.removedOneGallaryImage(id, url);

    return {
      message: 'Gallery image removed successfully',
      data,
    };
  }
```

## PUT /api/v1/companions/:id/gallery

Replace the gallery, revoke removed library approvals and import new uploads as pending.

Source: `src/app/module/companions/companions.controller.ts:250`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/gallery')
@ApiOperation({ summary: 'Set or replace companion galleryImages' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## DELETE /api/v1/companions/:id

Delete Companion (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:287`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.deleteCompanion(id);
    return { message: 'Companion deleted successfully', data };
  }
```

## PUT /api/v1/companions/:id/voice

Update Voice (Companions). Follow the exact handler and DTO below.

Source: `src/app/module/companions/companions.controller.ts:295`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() payload: UpdateVoiceDto
```

Upload/status/validation metadata:

```typescript
@Put(':id/voice')
@ApiOperation({ summary: 'Update companion voice ID' })
@ApiBearerAuth('access-token')
@ApiBody({ type: UpdateVoiceDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateVoiceSettings(
      id,
      payload.voiceId,
    );

    return { message: 'Voice ID updated successfully', data };
  }
```

## POST /api/v1/credits/packages

Create Package (Credit). Follow the exact handler and DTO below.

Source: `src/app/module/credit/credit.controller.ts:29`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() payload: CreateCreditPackageDto
```

Upload/status/validation metadata:

```typescript
@Post('packages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Create a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.createPackage(payload);
    return { message: 'Credit package created successfully', data };
  }
```

## GET /api/v1/credits/packages

Get Packages (Credit). Follow the exact handler and DTO below.

Source: `src/app/module/credit/credit.controller.ts:38`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('packages')
@ApiOperation({ summary: 'Get active credit packages' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.getActivePackages();
    return { message: 'Credit packages fetched successfully', data };
  }
```

## PATCH /api/v1/credits/packages/:id

Update Package (Credit). Follow the exact handler and DTO below.

Source: `src/app/module/credit/credit.controller.ts:45`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() payload: UpdateCreditPackageDto
```

Upload/status/validation metadata:

```typescript
@Patch('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.updatePackage(id, payload);
    return { message: 'Credit package updated successfully', data };
  }
```

## DELETE /api/v1/credits/packages/:id

Deactivate Package (Credit). Follow the exact handler and DTO below.

Source: `src/app/module/credit/credit.controller.ts:57`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.deactivatePackage(id);
    return { message: 'Credit package deactivated successfully', data };
  }
```

## GET /api/v1/credits/wallet

Get Wallet (Credit). Follow the exact handler and DTO below.

Source: `src/app/module/credit/credit.controller.ts:66`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('wallet')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Get wallet balance and recent transactions' })
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.creditService.getWallet(request.user.id);
    return { message: 'Wallet fetched successfully', data };
  }
```

## GET /api/v1/dashboard/overview

Dashboard Overview (Dashboard). Follow the exact handler and DTO below.

Source: `src/app/module/dashboard/dashboard.controller.ts:17`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('overview')
@ApiOperation({ summary: 'Get dashboard overview' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const data = await this.dashboardService.dashboardOverview();

    return {
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }
```

## GET /api/v1/relationships

Relationships (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:39`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('relationships')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.relationships(req.user!.id, query) };
  }
```

## PATCH /api/v1/relationships/:companionId

Relationship (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:45`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: RelationshipDto
```

Upload/status/validation metadata:

```typescript
@Patch('relationships/:companionId')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.service.updateRelationship(req.user!.id, id, body),
    };
  }
```

## GET /api/v1/companions/:companionId/stories

Stories (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:54`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.stories(id, query) };
  }
```

## POST /api/v1/companions/:companionId/photos/view

Photo (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:60`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: PhotoDto
```

Upload/status/validation metadata:

```typescript
@Post('companions/:companionId/photos/view')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.service.viewPhoto(req.user!.id, id, body.photoUrl),
    };
  }
```

## GET /api/v1/photos/history

Photos (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:69`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('photos/history')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.photoHistory(req.user!.id, query) };
  }
```

## GET /api/v1/credits/ledger

Ledger (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:75`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('credits/ledger')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.ledger(req.user!.id, query) };
  }
```

## GET /api/v1/credits/costs

Costs (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:81`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('credits/costs')
```

Controller response mapping:

```typescript
{
    return { data: await this.credits.getCosts() };
  }
```

## GET /api/v1/notifications

Notifications (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:84`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('notifications')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.notifications(req.user!.id, query) };
  }
```

## PATCH /api/v1/notifications/:id/read

Read (Engagement). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:90`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Patch('notifications/:id/read')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.readNotification(req.user!.id, id) };
  }
```

## PUT /api/v1/admin/credit-costs/:action

Cost (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:107`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('action') action: string
@Body() body: CostDto
```

Upload/status/validation metadata:

```typescript
@Put('credit-costs/:action')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.setCost(action, body.credits) };
  }
```

## PUT /api/v1/admin/companions/:companionId/stories

Story (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:113`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId') id: string
@Body() body: StoryDto
```

Upload/status/validation metadata:

```typescript
@Put('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveStory(id, body) };
  }
```

## GET /api/v1/admin/companions/:companionId/stories

Stories (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:119`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.stories(id, query, true) };
  }
```

## GET /api/v1/admin/conversations

Conversations (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:125`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('conversations')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.conversations(query) };
  }
```

## GET /api/v1/admin/conversations/:id

Conversation (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:128`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('conversations/:id')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.conversation(id, query) };
  }
```

## PATCH /api/v1/admin/conversations/:id/mode

Mode (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:134`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: ModeDto
```

Upload/status/validation metadata:

```typescript
@Patch('conversations/:id/mode')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.setMode(id, req.user!.id, body.mode) };
  }
```

## POST /api/v1/admin/conversations/:id/replies

Save an admin human-mode reply; do not assume an outbound Telegram push.

Source: `src/app/module/engagement/engagement.controller.ts:141`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: HumanReplyDto
```

Upload/status/validation metadata:

```typescript
@Post('conversations/:id/replies')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.humanReply(id, req.user!.id, body) };
  }
```

## GET /api/v1/admin/users/:id/details

User (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:148`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get('users/:id/details')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.userDetails(id) };
  }
```

## GET /api/v1/admin/users/:id/ledger

Ledger (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:151`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('users/:id/ledger')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.ledger(id, query) };
  }
```

## POST /api/v1/admin/notifications

Notification (EngagementAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/engagement/engagement.controller.ts:157`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() body: NotificationDto
```

Upload/status/validation metadata:

```typescript
@Post('notifications')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.prisma.notification.create({
        data: { ...body, type: 'admin' },
      }),
    };
  }
```

## POST /api/v1/gifts

Create Gift (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:41`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() payload: CreateGiftDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a gift (admin)' })
@ApiConsumes('multipart/form-data')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.createGift(payload, file);
    return { message: 'Gift created successfully', data };
  }
```

## GET /api/v1/gifts

Get Gifts (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:55`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get active gifts' })
@ApiQuery({ name: 'searchTerm', required: false, type: String })
@ApiQuery({ name: 'name', required: false, type: String })
@ApiQuery({ name: 'sortBy', required: false, type: String })
@ApiQuery({ name: 'sortOrder', required: false, type: String })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'page', required: false, type: Number })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, ['searchTerm', 'name']);
    const options = pick(req.query, ['sortBy', 'sortOrder', 'limit', 'page']);
    const result = await this.giftService.getActiveGifts(filters, options);
    return {
      message: 'Gifts fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/gifts/admin

Admin Gifts (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:75`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('admin')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.giftService.getActiveGifts(
      pick(req.query, ['searchTerm', 'name']),
      pick(req.query, ['sortBy', 'sortOrder', 'limit', 'page']),
      true,
    );
    return { data: result.data, meta: result.meta };
  }
```

## GET /api/v1/gifts/history

History (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:86`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('history')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (page < 1 || page > 100000)
      throw new BadRequestException('Invalid page');
    return { data: await this.giftService.history(req.user!.id, page) };
  }
```

## PATCH /api/v1/gifts/:id

Update Gift (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:97`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() payload: UpdateGiftDto
```

Upload/status/validation metadata:

```typescript
@Patch(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a gift (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.updateGift(id, payload);
    return { message: 'Gift updated successfully', data };
  }
```

## DELETE /api/v1/gifts/:id

Deactivate Gift (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:106`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a gift (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.deactivateGift(id);
    return { message: 'Gift deactivated successfully', data };
  }
```

## POST /api/v1/gifts/:giftId/send

Send Gift (Gift). Follow the exact handler and DTO below.

Source: `src/app/module/gift/gift.controller.ts:115`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('giftId') giftId: string
@Body() payload: SendGiftDto
```

Upload/status/validation metadata:

```typescript
@Post(':giftId/send')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Send a gift to a companion using credits' })
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.giftService.sendGift(
      request.user.id,
      payload.companionId,
      giftId,
      payload.requestId,
      payload.expectedCreditCost,
    );
    return { message: 'Gift sent successfully', data };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/routine

Routine (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:50`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('routine')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.routine(id) };
  }
```

## PUT /api/v1/admin/companions/:companionId/lifestyle/routine

Save Routine (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:55`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: RoutineDto
```

Upload/status/validation metadata:

```typescript
@Put('routine')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveRoutine(id, dto) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/context

Context (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:61`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('context')
```

Controller response mapping:

```typescript
{
    await this.service.companion(id);
    return { data: await this.service.context(id) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/photos

Photos (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:67`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('photos')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.photos(id, pageNumber(page)) };
  }
```

## POST /api/v1/admin/companions/:companionId/lifestyle/photos/import-gallery

Import missing companion gallery URLs as pending library entries.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:73`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Post('photos/import-gallery')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.importGallery(id) };
  }
```

## POST /api/v1/admin/companions/:companionId/lifestyle/photos

Upload an image to the companion photo library for review.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:78`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: LibraryPhotoDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post('photos')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        tags: { type: 'string', example: 'gym,morning' },
      },
    },
  })
@UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
```

Controller response mapping:

```typescript
{
    return { data: await this.service.upload(id, dto, file) };
  }
```

## PATCH /api/v1/admin/companions/:companionId/lifestyle/photos/:photoId

Approve a library photo or return it to pending.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:99`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('photoId', ParseUUIDPipe) photoId: string
@Body() dto: ApprovePhotoDto
```

Upload/status/validation metadata:

```typescript
@Patch('photos/:photoId')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.approve(id, photoId, dto.approved) };
  }
```

## PUT /api/v1/admin/companions/:companionId/lifestyle/photos/:photoId

Edit a library photo caption and normalized tags.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:106`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('photoId', ParseUUIDPipe) photoId: string
@Body() dto: LibraryPhotoDto
```

Upload/status/validation metadata:

```typescript
@Put('photos/:photoId')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.editPhoto(id, photoId, dto) };
  }
```

## DELETE /api/v1/admin/companions/:companionId/lifestyle/photos/:photoId

Remove a library entry while retaining assets used by delivered chat history.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:113`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('photoId', ParseUUIDPipe) photoId: string
```

Upload/status/validation metadata:

```typescript
@Delete('photos/:photoId')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.removePhoto(id, photoId) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/daily-content

Daily (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:119`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('daily-content')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.daily(id, pageNumber(page)) };
  }
```

## PUT /api/v1/admin/companions/:companionId/lifestyle/daily-content

Save (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:125`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: DailyContentDto
```

Upload/status/validation metadata:

```typescript
@Put('daily-content')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveDaily(id, dto) };
  }
```

## POST /api/v1/admin/companions/:companionId/lifestyle/daily-content/:contentId/unpublish

Unpublish (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:131`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('contentId', ParseUUIDPipe) contentId: string
```

Upload/status/validation metadata:

```typescript
@Post('daily-content/:contentId/unpublish')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.unpublish(id, contentId) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/deliveries

Deliveries (LifestyleAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:137`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('deliveries')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: { content: { companionId: id } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNumber(page) - 1) * 50,
        take: 50,
      }),
    };
  }
```

## GET /api/v1/lifestyle/preference

Preference (Lifestyle). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:161`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('preference')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.preference(req.user!.id) };
  }
```

## PUT /api/v1/lifestyle/preference

Save (Lifestyle). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:164`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Body() dto: DailyPreferenceDto
```

Upload/status/validation metadata:

```typescript
@Put('preference')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.preference(req.user!.id, dto) };
  }
```

## GET /api/v1/lifestyle/allowances

Allowances (Lifestyle). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:170`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('allowances')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.usage(req.user!.id) };
  }
```

## POST /api/v1/lifestyle/companions/:companionId/photo

Request an approved unseen library photo; paid users fall back to generation when no match exists.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:173`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: PhotoRequestDto
```

Upload/status/validation metadata:

```typescript
@Post('companions/:companionId/photo')
```

Controller response mapping:

```typescript
{
    const result = await this.chat.sendMessage(
      req.user!.id,
      id,
      `/photo${dto.tag ? ` ${dto.tag}` : ''}`,
      req.headers.authorization!,
      'text',
      `library:${req.user!.id}:${id}:${dto.requestId}`,
    );
    return { data: result.message };
  }
```

## GET /api/v1/lifestyle/inbox

Inbox (Lifestyle). Follow the exact handler and DTO below.

Source: `src/app/module/lifestyle/lifestyle.controller.ts:188`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('inbox')
```

Controller response mapping:

```typescript
{
    await this.service.active(this.prisma, req.user!.id);
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: {
          userId: req.user!.id,
          status: { in: ['available', 'sent', 'unknown', 'failed'] },
          content: { published: true, photo: { approved: true } },
        },
        include: { content: { include: { photo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: (pageNumber(page) - 1) * 50,
      }),
    };
  }
```

## POST /api/v1/newsletter

Send Mail (Newsletter). Follow the exact handler and DTO below.

Source: `src/app/module/newsletter/newsletter.controller.ts:30`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() createNewsletterDto: CreateNewsletterDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Subscribe to newsletter' })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const data = await this.newsletterService.sendMail(createNewsletterDto);
    return {
      message: 'Newsletter subscription saved successfully',
      data,
    };
  }
```

## POST /api/v1/newsletter/broadcast

Broadcast Newsletter (Newsletter). Follow the exact handler and DTO below.

Source: `src/app/module/newsletter/newsletter.controller.ts:41`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() dto: BroadcastNewsletterDto
```

Upload/status/validation metadata:

```typescript
@Post('broadcast')
@ApiOperation({ summary: 'Broadcast an email to all newsletter subscribers' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const data = await this.newsletterService.broadcastNewsletter(dto);

    return {
      message: 'Newsletter broadcast sent successfully',
      data,
    };
  }
```

## GET /api/v1/newsletter

Get All Newsletter (Newsletter). Follow the exact handler and DTO below.

Source: `src/app/module/newsletter/newsletter.controller.ts:55`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get all newsletter' })
@ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'Search term',
  })
@ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'Email',
  })
@ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number',
  })
@ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Limit number',
  })
@ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'Sort by',
  })
@ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'Sort order',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const params = pick(req.query, ['searchTerm', 'email']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.newsletterService.getAllNewsletter(
      params,
      options,
    );

    return {
      message: 'Get all newsletter successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/newsletter/:id

Get Newsletter By Id (Newsletter). Follow the exact handler and DTO below.

Source: `src/app/module/newsletter/newsletter.controller.ts:109`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get newsletter by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.newsletterService.getNewsletterById(id);

    return {
      message: 'Get newsletter by id successfully',
      data: result,
    };
  }
```

## GET /api/v1/payment/config

Config (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:30`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('config')
@ApiOperation({ summary: 'Get public payment configuration' })
```

Controller response mapping:

```typescript
{
    if (!config.stripe.publicKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return { data: { publishableKey: config.stripe.publicKey } };
  }
```

## GET /api/v1/payment/subscription/status

Status (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:39`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('subscription/status')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.status(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/sync

Sync (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:46`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('subscription/sync')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@ApiOperation({
    summary:
      'Verify Stripe payment and synchronize subscription access without charging again',
  })
```

Controller response mapping:

```typescript
{
    return { data: await this.billing.sync(request.user!.id) };
  }
```

## POST /api/v1/payment/billing-portal

Portal (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:57`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('billing-portal')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.portal(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/cancel

Cancel (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:64`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('subscription/cancel')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.cancel(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/:subscriptionId/upgrade

Upgrade (Payment). Follow the exact handler and DTO below.

Source: `src/app/module/payment/payment.controller.ts:71`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('subscriptionId') id: string
```

Upload/status/validation metadata:

```typescript
@Post('subscription/:subscriptionId/upgrade')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.upgrade(request.user!.id, id);
  }
```

## POST /api/v1/payment/subscription/:subscriptionId

Start local-plan activation or recurring subscription checkout.

Source: `src/app/module/payment/payment.controller.ts:78`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('subscriptionId') subscriptionId: string
```

Upload/status/validation metadata:

```typescript
@Post('subscription/:subscriptionId')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Initiate a subscription payment' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const result = await this.paymentService.paySubscriber(
      request.user.id,
      subscriptionId,
    );

    return {
      message: 'Payment initiated successfully',
      data: result,
    };
  }
```

## POST /api/v1/payment/credits

Start credit-package checkout using packageId; never trust a client-supplied price.

Source: `src/app/module/payment/payment.controller.ts:102`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Body() payload: BuyCreditsDto
```

Upload/status/validation metadata:

```typescript
@Post('credits')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Buy a credit package by package ID' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const result = await this.paymentService.buyCredits(
      request.user.id,
      payload.packageId,
    );
    return { message: 'Credit payment initiated successfully', data: result };
  }
```

## GET /api/v1/admin/companions/:companionId/telegram-profile

Status (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:50`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('telegram-profile')
@ApiTags('Telegram profile setup')
@ApiOperation({
    summary: '2. Check Telegram profile sync status',
    description: 'Admin only. Inspect data.enabled, data.status and data.lastError after uploading a profile photo. status=synced confirms the worker completed the update. Profile sync requires TELEGRAM_PROFILE_SYNC_ENABLED=true and a configured companion bot.',
  })
```

Controller response mapping:

```typescript
{
    await this.stories.companion(id);
    return { data: await this.profiles.status(id) };
  }
```

## PUT /api/v1/admin/companions/:companionId/telegram-profile

Profile (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:60`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: TelegramProfileDto
```

Upload/status/validation metadata:

```typescript
@Put('telegram-profile')
@ApiTags('Telegram profile setup')
@ApiOperation({
    summary: 'Edit Telegram display name, about and description',
    description: 'Admin only. Queues text profile updates. This JSON endpoint does not upload photos; use PUT /api/v1/companions/{id}/profile-image with multipart field profileImage. displayName also updates the website companion name.',
  })
```

Controller response mapping:

```typescript
{
    await this.stories.companion(id);
    return { data: await this.profiles.save(id, dto) };
  }
```

## POST /api/v1/admin/companions/:companionId/telegram-profile/retry

Retry (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:73`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Post('telegram-profile/retry')
@ApiTags('Telegram profile setup')
@ApiOperation({
    summary: '3. Retry a queued or failed Telegram profile update',
    description: 'Admin only. Requeues an existing profile sync record. Enable sync and correct the reported configuration/error first. Poll the status endpoint afterwards; this request does not confirm delivery to Telegram.',
  })
```

Controller response mapping:

```typescript
{
    return { data: await this.profiles.retry(id) };
  }
```

## GET /api/v1/admin/companions/:companionId/media-stories

List (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:82`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('media-stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.adminList(id, req.user!.id) };
  }
```

## POST /api/v1/admin/companions/:companionId/media-stories

Publish (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:89`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: PublishMediaStoryDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post('media-stories')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['media'],
      properties: {
        caption: { type: 'string', maxLength: 2048 },
        media: { type: 'string', format: 'binary' },
      },
    },
  })
@UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.publish(id, dto.caption || '', file) };
  }
```

## DELETE /api/v1/admin/companions/:companionId/media-stories/:storyId

Remove (PublishingAdmin). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:114`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('storyId', ParseUUIDPipe) storyId: string
```

Upload/status/validation metadata:

```typescript
@Delete('media-stories/:storyId')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.remove(id, storyId) };
  }
```

## GET /api/v1/media-stories/summary

Summary (MediaStory). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:129`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('summary')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.summary(req.user!.id) };
  }
```

## GET /api/v1/media-stories/companions/:companionId

Feed (MediaStory). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:134`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.list(id, req.user!.id) };
  }
```

## GET /api/v1/media-stories/:storyId/media

Media (StoryMedia). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:148`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('storyId', ParseUUIDPipe) id: string
@Query('ticket') ticket: string | string[] | undefined
@Headers('range') range: string | undefined
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get(':storyId/media')
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    if (ticket !== undefined && typeof ticket !== 'string')
      throw new ForbiddenException('Invalid media link');
    const safeTicket = ticket ?? '';
    const row = await this.stories.media(id, safeTicket);
    const bytes = Buffer.from(row.media);
    const length = bytes.length;
    res.set({
      'Content-Type': row.mimeType,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, length - Number(match[2]));
      const end = match[1]
        ? match[2]
          ? Math.min(Number(match[2]), length - 1)
          : length - 1
        : length - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= length
      )
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      return res
        .status(206)
        .set({
          'Content-Range': `bytes ${start}-${end}/${length}`,
          'Content-Length': String(end - start + 1),
        })
        .send(bytes.subarray(start, end + 1));
    }
    return res.set('Content-Length', String(length)).send(bytes);
  }
```

## GET /api/v1/telegram/stories

Page (TelegramStory). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:205`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get()
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(storyViewer.replaceAll('__NONCE__', nonce));
  }
```

## POST /api/v1/telegram/stories/:companionId/feed

Feed (TelegramStory). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:219`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: StorySessionDto
```

Upload/status/validation metadata:

```typescript
@Post(':companionId/feed')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.stories.list(
        id,
        await this.stories.telegramUser(id, dto.initData),
      ),
    };
  }
```

## GET /api/v1/publishing/admin

Page (PublishingConsole). Follow the exact handler and DTO below.

Source: `src/app/module/publishing/publishing.controller.ts:238`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get('admin')
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    if (this.config.get('PUBLISHING_ADMIN_CONSOLE_ENABLED') !== 'true')
      throw new NotFoundException();
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      })
      .type('html')
      .send(publishingConsole.replaceAll('__NONCE__', nonce));
  }
```

## POST /api/v1/subscription

Create Subscription (Subscription). Follow the exact handler and DTO below.

Source: `src/app/module/subscription/subscription.controller.ts:26`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Body() createSubscriptionDto: CreateSubscriptionDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.createSubscription(
      createSubscriptionDto,
    );
    return {
      message: 'Subscription created successfully',
      data: result,
    };
  }
```

## GET /api/v1/subscription

Get All Subscription (Subscription). Follow the exact handler and DTO below.

Source: `src/app/module/subscription/subscription.controller.ts:42`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get all subscription' })
@ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
  })
@ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
  })
@ApiQuery({
    name: 'sortBy',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'sortOrder',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'name',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'features',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'isPopular',
    type: 'boolean',
    required: false,
  })
@ApiQuery({
    name: 'isActive',
    type: 'boolean',
    required: false,
  })
@ApiQuery({
    name: 'searchTerm',
    type: 'string',
    required: false,
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, [
      'searchTerm',
      'name',
      'features',
      'isPopular',
      'isActive',
    ]);
    const params = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.subscriptionService.getAllSubscription(
      filters,
      params,
    );
    return {
      message: 'Subscription fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/subscription/:id

Get Subscription By Id (Subscription). Follow the exact handler and DTO below.

Source: `src/app/module/subscription/subscription.controller.ts:110`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get subscription by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.getSubscriptionById(id);
    return {
      message: 'Subscription fetched successfully',
      data: result,
    };
  }
```

## PUT /api/v1/subscription/:id

Update Subscription (Subscription). Follow the exact handler and DTO below.

Source: `src/app/module/subscription/subscription.controller.ts:121`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() updateSubscriptionDto: UpdateSubscriptionDto
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.updateSubscription(
      id,
      updateSubscriptionDto,
    );
    return {
      message: 'Subscription updated successfully',
      data: result,
    };
  }
```

## DELETE /api/v1/subscription/:id

Delete Subscription (Subscription). Follow the exact handler and DTO below.

Source: `src/app/module/subscription/subscription.controller.ts:139`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.deleteSubscription(id);
    return {
      message: 'Subscription deleted successfully',
      data: result,
    };
  }
```

## GET /api/v1/telegram/status/:companionId

Status (TelegramConnect). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-connect.controller.ts:28`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Get('status/:companionId')
@ApiOperation({
    summary: 'Get Telegram linking/subscription status and return-to-bot URL',
    description:
      'Use after payment confirmation. Credit balance is available from the credit wallet API. This endpoint does not grant credits or activate subscriptions.',
  })
@ApiParam({ name: 'companionId', format: 'uuid' })
```

Controller response mapping:

```typescript
{
    return { data: await this.ai.status(request.user!.id, companionId) };
  }
```

## POST /api/v1/telegram/connect/:companionId

Create a short-lived, single-use link for the selected companion.

Source: `src/app/module/telegram/telegram-connect.controller.ts:42`

Access: `UseGuards(AuthGuard('user'))`

Request parameters and DTOs:

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Post('connect/:companionId')
@ApiOperation({
    summary: 'Create a 10-minute, single-use Telegram account link',
    description:
      'Requires an approved adult user and active subscription. Open data.telegramUrl and press START in Telegram.',
  })
@ApiParam({ name: 'companionId', format: 'uuid' })
@ApiResponse({
    status: 402,
    description:
      'Active subscription required. Subscribe on the website, then retry.',
  })
```

Controller response mapping:

```typescript
{
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
```

## GET /api/v1/telegram/app

Page (TelegramMiniApp). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:43`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Res() response: Response
```

Upload/status/validation metadata:

```typescript
@Get()
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    const nonce = randomBytes(18).toString('base64');
    response
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(telegramLoginPage.replaceAll('__NONCE__', nonce));
  }
```

## GET /api/v1/telegram/app/settings/:companionId

Settings (TelegramMiniApp). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:58`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Get('settings/:companionId')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.app.settings(companionId) };
  }
```

## POST /api/v1/telegram/app/login/:companionId

Verify signed Telegram initData and website credentials before linking accounts.

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:64`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramLoginDto
```

Upload/status/validation metadata:

```typescript
@Post('login/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.app.login(
        id,
        body.initData,
        body.email,
        body.password,
        body.confirmTransfer,
      ),
    };
  }
```

## POST /api/v1/telegram/app/status/:companionId

Status (TelegramMiniApp). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:82`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramSessionDto
```

Upload/status/validation metadata:

```typescript
@Post('status/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.app.status(id, body.initData) };
  }
```

## POST /api/v1/webhooks/telegram/:companionId

Receive For Companion (TelegramWebhook). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-webhook.controller.ts:24`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/status/validation metadata:

```typescript
@Post(':companionId')
@HttpCode(200)
```

Controller response mapping:

```typescript
{
    const key = this.telegram.botKey(companionId);
    this.telegram.verifySecret(secret, key);
    await this.queue.receive(body, key);
    return { ok: true };
  }
```

## POST /api/v1/webhooks/telegram

Receive (TelegramWebhook). Follow the exact handler and DTO below.

Source: `src/app/module/telegram/telegram-webhook.controller.ts:37`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/status/validation metadata:

```typescript
@Post()
@HttpCode(200)
```

Controller response mapping:

```typescript
{
    this.telegram.verifySecret(secret);
    await this.queue.receive(body);
    return { ok: true };
  }
```

## POST /api/v1/user

Create User (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:43`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Body() createUserDto: CreateUserDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({
    summary: 'create user',
  })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.createUser(createUserDto);

    return {
      message: 'create user successfully',
      data: result,
    };
  }
```

## GET /api/v1/user

Get All User (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:57`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({
    summary: 'get all user',
  })
@ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'search term',
  })
@ApiQuery({
    name: 'role',
    type: String,
    required: false,
    description: 'role',
  })
@ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'email',
  })
@ApiQuery({
    name: 'name',
    type: String,
    required: false,
    description: 'name',
  })
@ApiQuery({
    name: 'phoneNumber',
    type: String,
    required: false,
    description: 'phoneNumber',
  })
@ApiQuery({
    name: 'status',
    type: String,
    required: false,
    description: 'status',
  })
@ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'page number',
  })
@ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'limit number',
  })
@ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'sort by',
  })
@ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'sort order',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, [
      'searchTerm',
      'role',
      'email',
      'name',
      'phoneNumber',
      'status',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(filters, options);

    return {
      message: 'get all user successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/user//overview

Get All User Overview (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:143`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('/overview')
@ApiOperation({ summary: 'User overview' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.getAllUserOverview();
    return {
      message: 'get all user overview successfully',
      data: result,
    };
  }
```

## GET /api/v1/user/my-profile

My Profile (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:156`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('my-profile')
@ApiOperation({
    summary: 'get my profile',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const id = req.user!.id;
    const result = await this.userService.myProfile(id);

    return {
      message: 'get my profile successfully',
      data: result,
    };
  }
```

## PUT /api/v1/user/my-profile

Update My Profile (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:173`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Body() updateUserDto: UpdateProfileDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Put('my-profile')
@ApiOperation({
    summary: 'update my profile',
  })
@ApiConsumes('multipart/form-data')
@ApiBody({ type: UpdateProfileDto })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const id = req.user!.id;
    const result = await this.userService.UpdateMyProfile(
      id,
      updateUserDto,
      file,
    );

    return {
      message: 'update my profile successfully',
      data: result,
    };
  }
```

## GET /api/v1/user/payments

My Payments (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:201`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters and DTOs:

```typescript
@Req() req: Request
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('payments')
@ApiOperation({ summary: 'Read your own paginated payment history' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    if (page < 1 || page > 100000) throw new BadRequestException('Invalid page');
    return { data: await this.userService.myPayments(req.user!.id, page) };
  }
```

## GET /api/v1/user/:id

Get User By Id (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:210`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({
    summary: 'get user by id',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.getUserById(id);

    return {
      message: 'get user by id successfully',
      data: result,
    };
  }
```

## PUT /api/v1/user/:id

Update User (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:226`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
@Body() updateUserDto: UpdateUserDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({
    summary: 'update user',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.updateUser(id, updateUserDto, file);

    return {
      message: 'update user successfully',
      data: result,
    };
  }
```

## DELETE /api/v1/user/:id

Delete User (User). Follow the exact handler and DTO below.

Source: `src/app/module/user/user.controller.ts:247`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters and DTOs:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({
    summary: 'delete user',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.deleteUser(id);

    return {
      message: 'delete user successfully',
      data: result,
    };
  }
```

## POST /api/v1/webhook

Process the signed payment-provider webhook; this is not a frontend endpoint.

Source: `src/app/module/webhook/webhook.controller.ts:14`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Req() req: RawBodyRequest<Request>
@Headers('stripe-signature') signature?: string
```

Upload/status/validation metadata:

```typescript
@Post()
@HttpCode(200)
@ApiOperation({ summary: 'Stripe webhook handler' })
```

Controller response mapping:

```typescript
{
    return this.webhookService.handleWebhook(req.rawBody, signature);
  }
```

## GET /

Get Hello (App). Follow the exact handler and DTO below.

Source: `src/app.controller.ts:11`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get()
```

Controller response mapping:

```typescript
{
    return res.type('html').send(this.appService.getHello());
  }
```

## GET /api/v1/health/live

Live (Health). Follow the exact handler and DTO below.

Source: `src/health.controller.ts:14`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('live')
```

Controller response mapping:

```typescript
{
    return { status: 'ok' };
  }
```

## GET /api/v1/health/ready

Ready (Health). Follow the exact handler and DTO below.

Source: `src/health.controller.ts:17`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('ready')
```

Controller response mapping:

```typescript
{
    try {
      const rows = await this.prisma.$queryRaw<
        { ready: boolean }[]
      >`SELECT (to_regclass('request_limits') IS NOT NULL AND to_regclass('telegram_jobs') IS NOT NULL) AS ready`;
      if (!rows[0]?.ready) throw new Error();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Service not ready');
    }
  }
```

## GET /privacy-policy

Privacy Policy (LegalPages). Follow the exact handler and DTO below.

Source: `src/legal-pages.controller.ts:40`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('privacy-policy')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Privacy Policy',
      `
      <p>This policy describes information processed by Meet Elysia through its website, accounts, AI companion features and Telegram integration.</p>
      <h2>Information we process</h2>
      <ul>
        <li>Account information such as your email, name, password hash, optional phone number and profile image.</li>
        <li>Messages you send, generated responses, conversation identifiers, selected companions and interaction history.</li>
        <li>For Telegram, your Telegram user/chat identifiers, message identifiers, message content and account-linking information received through Telegram.</li>
        <li>Subscription status, payment records, payment-provider identifiers, credits and purchases.</li>
        <li>Operational information used to investigate errors, secure accounts and process message delivery.</li>
      </ul>
      <h2>How information is used</h2>
      <p>We use this information to authenticate accounts, link Telegram conversations to users and companions, generate and deliver replies, manage subscriptions and credits, provide support and troubleshoot the service. Authorized administrators can access conversations for support and human takeover.</p>
      <h2>Service providers</h2>
      <p>Operating the service involves providers for hosting and database storage, AI processing, email, media storage and payments. Relevant message content and conversation context are sent to the configured AI service when AI replies are enabled. Telegram processes Telegram messages; Stripe handles payment processing; uploaded profile media may be stored through Cloudinary. These providers process information under their own applicable terms and privacy policies.</p>
      <h2>Storage and retention</h2>
      <p>Account, conversation and transaction information is stored to operate the service. Retention varies by record type and provider; there is no single automatic deletion period for all records. Contact us to request deletion or ask about a particular record. Some records may need to be retained for applicable obligations, dispute resolution or security, and provider backups may follow separate retention schedules.</p>
      <h2>Your choices and requests</h2>
      <p>You may stop messaging the service and contact ${contactLink} to request access, correction or deletion of your information. Follow our <a href="/data-deletion">data deletion instructions</a> to identify the account or Telegram data involved. Deleting a chat in Telegram does not itself delete records held by Meet Elysia.</p>
      <h2>Security and updates</h2>
      <p>Account passwords are stored as hashes. No online system can guarantee absolute security; do not send passwords, payment card details or other unnecessary sensitive information in companion chats. Updates to this policy will be reflected on this page.</p>
    `,
    );
  }
```

## GET /terms

Terms (LegalPages). Follow the exact handler and DTO below.

Source: `src/legal-pages.controller.ts:69`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('terms')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Terms of Service',
      `
      <p>These terms describe use of Meet Elysia's account, companion chat and Telegram features. By using the service, you agree to these terms.</p>
      <h2>Accounts and responsible use</h2>
      <p>Provide accurate account information, use only accounts and phone numbers you are authorized to use, and keep your credentials secure. Do not use the service for unlawful activity, harassment, fraud, unauthorized access or interference with other users or systems.</p>
      <h2>Companion conversations</h2>
      <p>Companions are AI-powered characters. Generated responses may be inaccurate or inappropriate and should not be relied on as professional advice or emergency assistance. Authorized administrators may participate through human takeover. Availability and response times can vary.</p>
      <h2>Subscriptions and credits</h2>
      <p>Some features require a subscription or credits. Review the price, renewal terms and purchase details shown at checkout before paying. Contact ${contactLink} for billing, cancellation or refund questions; applicable consumer rights remain unaffected.</p>
      <h2>Your content and privacy</h2>
      <p>Only submit content you have permission to share. You allow the service and its providers to process that content as needed to deliver the requested features. See our <a href="/privacy-policy">Privacy Policy</a> for data handling and our <a href="/data-deletion">Data Deletion</a> page for removal requests.</p>
      <h2>Third-party services and access</h2>
      <p>Telegram, payment services and other integrated providers have their own terms. Features may change or become unavailable. Access may be restricted to address abuse, security issues or violations of these terms.</p>
      <h2>Contact and changes</h2>
      <p>Questions or requests to close an account can be sent to ${contactLink}. Revised terms will be posted here with an updated date.</p>
    `,
    );
  }
```

## GET /data-deletion

Data Deletion (LegalPages). Follow the exact handler and DTO below.

Source: `src/legal-pages.controller.ts:92`

Access: `Service/provider validation applies`

Request parameters and DTOs:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('data-deletion')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Data Deletion Instructions',
      `
      <p>You can request deletion of your Meet Elysia account or data associated with its Telegram integration by email.</p>
      <h2>Submit a request</h2>
      <ol>
        <li>Email ${contactLink} with the subject <strong>Meet Elysia Data Deletion Request</strong>.</li>
        <li>Send from your registered email where possible. Include the account email and, for Telegram data, your Telegram username or user ID.</li>
        <li>Specify whether you want the entire account deleted or only particular data, such as Telegram linking information or conversation history.</li>
      </ol>
      <p>Do not include passwords, one-time codes, access tokens or payment card details.</p>
      <h2>What happens next</h2>
      <p>The support team handles requests manually and may ask for information needed to verify account ownership before processing deletion. Ask in the same email for confirmation of completion and the status of any retained records.</p>
      <h2>Scope and limitations</h2>
      <p>A request can cover your profile, stored conversations and Telegram account links. Records subject to applicable retention obligations or needed for disputes or security may require separate handling. Copies held in provider backups may follow their retention schedules.</p>
      <p>Deleting Meet Elysia data does not delete your Telegram account or copies held by Telegram or message recipients. Deleting a Telegram chat alone does not submit a deletion request to Meet Elysia. If you have an active subscription, include a cancellation request so support can address billing separately.</p>
      <p>Read our <a href="/privacy-policy">Privacy Policy</a> for an overview of the information processed by the service.</p>
    `,
    );
  }
```

# DTO fields, nested objects and runtime validation

IsOptional marks optional fields; PartialType makes inherited fields optional. Follow Type/ValidateNested and OmitType declarations. ApiProperty examples are not production defaults. TypeScript optional syntax alone does not establish runtime validation. Do not send unsupported permission fields.

## CreateAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class CreateAuthDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '01712345678',
    description: 'User phone number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;

  @ApiProperty({
    example: 'Password123',
    description: 'User password',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether the companion is adult eligible',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  adultEligible?: boolean;
}
```

## LoginAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class LoginAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'Password123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}
```

## ForgotPasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ForgotPasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
```

## VerifyOtpAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class VerifyOtpAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6 digit OTP',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Matches(/^\d{6}$/, {
    message: 'OTP must be exactly 6 digits',
  })
  otp!: string;
}
```

## ResetPasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ResetPasswordAuthDto {
  @ApiProperty({ description: 'Single-use resetToken returned by verify-otp' })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  resetToken!: string;
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;
}
```

## ChangePasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ChangePasswordAuthDto {
  @ApiProperty({
    example: 'OldPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Old password is required' })
  oldPassword!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, {
    message: 'New password must be at least 6 characters',
  })
  newPassword!: string;
}
```

## UpdateAuthDto

Source: `src/app/module/auth/dto/update-auth.dto.ts`

```typescript
export class UpdateAuthDto extends PartialType(CreateAuthDto) {}
```

## SendMessageDto

Source: `src/app/module/chat/dto/send-message.dto.ts`

```typescript
export class SendMessageDto {
  @ApiProperty({
    required: false,
    description:
      'UUID; reuse on retries to avoid duplicate replies and charges',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;
  @ApiProperty({
    enum: ['text', 'voice'],
    required: false,
    description: 'Voice messages supply their transcript in message.',
  })
  @IsOptional()
  @IsIn(['text', 'voice'])
  type?: 'text' | 'voice';

  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}
```

## CompanionPersonalityDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionPersonalityDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  traits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  about!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  essence!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  sharedTraits!: string[];
}
```

## CompanionCommunicationStyleDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionCommunicationStyleDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  styleTraits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  topicsSheEnjoys!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  whatYouExperience!: string[];
}
```

## CompanionBackgroundDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionBackgroundDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  occupation!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  lifestyle!: string[];
}
```

## CompanionVisualProfileDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVisualProfileDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  aestheticKeywords!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  referenceImages!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  physicalIdentity?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  generationInstructions?: string | null;
}
```

## CompanionVoiceSettingsDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVoiceSettingsDto {
  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  stability!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  similarityBoost!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  style!: number;

  @ApiProperty({})
  @Transform(toBoolean)
  @IsBoolean()
  useSpeakerBoost!: boolean;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  speed!: number;
}
```

## CompanionVoiceDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVoiceDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  voiceId?: string | null;

  @ApiPropertyOptional({
    type: () => CompanionVoiceSettingsDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceSettingsDto)
  @IsObject()
  @ValidateNested()
  settings?: CompanionVoiceSettingsDto;
}
```

## CreateCompanionDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CreateCompanionDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(18)
  age?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  backstory?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  voiceDescription!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  profileImage?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  status?: boolean;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiPropertyOptional({
    type: () => CompanionPersonalityDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionPersonalityDto)
  @IsObject()
  @ValidateNested()
  personality?: CompanionPersonalityDto;

  @ApiPropertyOptional({
    type: () => CompanionCommunicationStyleDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionCommunicationStyleDto)
  @IsObject()
  @ValidateNested()
  communicationStyle?: CompanionCommunicationStyleDto;

  @ApiPropertyOptional({
    type: () => CompanionBackgroundDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionBackgroundDto)
  @IsObject()
  @ValidateNested()
  background?: CompanionBackgroundDto;

  @ApiPropertyOptional({
    type: () => CompanionVisualProfileDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVisualProfileDto)
  @IsObject()
  @ValidateNested()
  visualProfile?: CompanionVisualProfileDto;

  @ApiPropertyOptional({
    type: () => CompanionVoiceDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceDto)
  @IsObject()
  @ValidateNested()
  voice?: CompanionVoiceDto;
}
```

## UpdateCompanionPersonalityDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionPersonalityDto extends PartialType(
  CompanionPersonalityDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionCommunicationStyleDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionCommunicationStyleDto extends PartialType(
  CompanionCommunicationStyleDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionBackgroundDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionBackgroundDto extends PartialType(
  CompanionBackgroundDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVisualProfileDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVisualProfileDto extends PartialType(
  CompanionVisualProfileDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVoiceSettingsDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVoiceSettingsDto extends PartialType(
  CompanionVoiceSettingsDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVoiceDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVoiceDto extends PartialType(
  OmitType(CompanionVoiceDto, ['settings'] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceSettingsDto)
  settings?: UpdateCompanionVoiceSettingsDto;
}
```

## UpdateCompanionDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionDto extends PartialType(
  OmitType(CreateCompanionDto, [
    'personality',
    'communicationStyle',
    'background',
    'visualProfile',
    'voice',
  ] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionPersonalityDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionPersonalityDto)
  personality?: UpdateCompanionPersonalityDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionCommunicationStyleDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionCommunicationStyleDto)
  communicationStyle?: UpdateCompanionCommunicationStyleDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionBackgroundDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionBackgroundDto)
  background?: UpdateCompanionBackgroundDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVisualProfileDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVisualProfileDto)
  visualProfile?: UpdateCompanionVisualProfileDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceDto)
  voice?: UpdateCompanionVoiceDto;
}
```

## UpdateVoiceDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateVoiceDto {
  @ApiProperty({ example: 'your-provider-voice-id' })
  @IsString()
  @IsNotEmpty()
  voiceId: string;
}
```

## CreateCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class CreateCreditPackageDto {
  @ApiProperty({ example: 'Starter Credits' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ example: '4.99' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Price must be a valid amount' })
  price!: string;

  @ApiPropertyOptional({ example: 'usd', default: 'usd' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

## UpdateCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class UpdateCreditPackageDto extends PartialType(
  CreateCreditPackageDto,
) {}
```

## CreateDashboardDto

Source: `src/app/module/dashboard/dto/create-dashboard.dto.ts`

```typescript
export class CreateDashboardDto {}
```

## UpdateDashboardDto

Source: `src/app/module/dashboard/dto/update-dashboard.dto.ts`

```typescript
export class UpdateDashboardDto extends PartialType(CreateDashboardDto) {}
```

## PageDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class PageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
```

## RelationshipDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class RelationshipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

## CostDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class CostDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1000000)
  credits!: number;
}
```

## ModeDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class ModeDto {
  @ApiProperty({ enum: ['ai', 'human'] })
  @IsIn(['ai', 'human'])
  mode!: 'ai' | 'human';
}
```

## HumanReplyDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class HumanReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  message!: string;
}
```

## StoryDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class StoryDto {
  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(20000)
  content!: string;
  @ApiProperty()
  @IsBoolean()
  published!: boolean;
}
```

## PhotoDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class PhotoDto {
  @ApiProperty({ description: 'URL from this companion’s galleryImages' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  photoUrl!: string;
}
```

## NotificationDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class NotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  body!: string;
}
```

## CreateGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class CreateGiftDto {
  @ApiProperty({ example: 'Rose' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/rose.png',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  creditCost!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
```

## UpdateGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class UpdateGiftDto extends PartialType(CreateGiftDto) {}
```

## SendGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class SendGiftDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedCreditCost?: number;

  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiProperty({ example: 'companion-id' })
  @IsString()
  @IsNotEmpty()
  companionId!: string;
}
```

## RoutineSlotDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class RoutineSlotDto {
  @ApiProperty({ description: 'ISO weekday: Monday=1, Sunday=7' })
  @IsInt()
  @Min(1)
  @Max(7)
  day!: number;
  @ApiProperty({ example: '06:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start!: string;
  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(500) activity!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
```

## RoutineDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class RoutineDto {
  @ApiProperty({ example: 'Asia/Dubai' })
  @IsString()
  @MaxLength(80)
  timezone!: string;
  @ApiProperty({ type: [RoutineSlotDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoutineSlotDto)
  weekly!: RoutineSlotDto[];
}
```

## LibraryPhotoDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class LibraryPhotoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) caption =
    '';
  @ApiPropertyOptional({
    description: 'Comma-separated tags, e.g. gym,morning,sporty',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags = '';
}
```

## ApprovePhotoDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class ApprovePhotoDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
}
```

## DailyContentDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class DailyContentDto {
  @ApiProperty({ example: '2026-10-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty({ description: 'ISO instant including timezone' })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  publishAt!: string;
  @ApiProperty({
    description: 'End of delivery window; missed content is skipped',
  })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  expiresAt!: string;
  @ApiProperty() @IsUUID() photoId!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(4000) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) activity =
    '';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published = false;
}
```

## DailyPreferenceDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class DailyPreferenceDto {
  @ApiProperty() @IsUUID() companionId!: string;
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
```

## PhotoRequestDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class PhotoRequestDto {
  @ApiProperty({
    description: 'Unique per user request; reuse on network retry',
  })
  @IsUUID()
  requestId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) tag?: string;
}
```

## EntitlementPolicyDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class EntitlementPolicyDto {
  @ApiProperty({ enum: ['paid', 'trial'] }) @IsIn(['paid', 'trial']) kind!:
    'paid' | 'trial';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyPhoto = false;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyText = false;
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  trialRepliesPerDay = 10;
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  trialRepliesTotal = 30;
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  trialPhotosTotal = 3;
}
```

## BroadcastNewsletterDto

Source: `src/app/module/newsletter/dto/broadcast-newsletter.dto.ts`

```typescript
export class BroadcastNewsletterDto {
  @ApiProperty({ example: 'Latest news from Elysia' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: '<h1>Hello!</h1><p>Here is our latest update.</p>' })
  @IsString()
  @IsNotEmpty()
  html: string;
}
```

## CreateNewsletterDto

Source: `src/app/module/newsletter/dto/create-newsletter.dto.ts`

```typescript
export class CreateNewsletterDto {
  @ApiProperty({
    example: '[EMAIL_ADDRESS]',
    description: 'The email of the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
```

## UpdateNewsletterDto

Source: `src/app/module/newsletter/dto/update-newsletter.dto.ts`

```typescript
export class UpdateNewsletterDto extends PartialType(CreateNewsletterDto) {}
```

## BuyCreditsDto

Source: `src/app/module/payment/dto/buy-credits.dto.ts`

```typescript
export class BuyCreditsDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
```

## CreatePaymentDto

Source: `src/app/module/payment/dto/create-payment.dto.ts`

```typescript
export class CreatePaymentDto {}
```

## UpdatePaymentDto

Source: `src/app/module/payment/dto/update-payment.dto.ts`

```typescript
export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
```

## TelegramProfileDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class TelegramProfileDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  about?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;
}
```

## PublishMediaStoryDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class PublishMediaStoryDto {
  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  caption?: string;
}
```

## StorySessionDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class StorySessionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData!: string;
}
```

## CreateSubscriptionDto

Source: `src/app/module/subscription/dto/create-subscription.dto.ts`

```typescript
export class CreateSubscriptionDto {
  @ApiPropertyOptional({ type: EntitlementPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntitlementPolicyDto)
  entitlementPolicy?: EntitlementPolicyDto;
  @ApiProperty({
    example: 'Premium Plan',
    description: 'Subscription plan name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    example: '29.99',
    description: 'Subscription plan price',
  })
  @IsString()
  @IsNotEmpty({ message: 'Price is required' })
  price!: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Deprecated: use creditAllowance',
  })
  @IsOptional()
  @IsInt({ message: 'Message limit must be an integer' })
  @Min(0, {
    message: 'Message limit cannot be negative',
  })
  messageLimit?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Credits granted for each subscription period',
  })
  @IsOptional()
  @IsInt({ message: 'Credit allowance must be an integer' })
  @Min(0, { message: 'Credit allowance cannot be negative' })
  creditAllowance?: number;

  @ApiProperty({ example: 30, required: false, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiProperty({
    example: [
      '1000 messages per month',
      'Priority support',
      'Advanced AI features',
    ],
    description: 'List of subscription features',
    type: [String],
  })
  @IsArray({
    message: 'Features must be an array',
  })
  @IsString({
    each: true,
    message: 'Each feature must be a string',
  })
  features!: string[];

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether this plan is popular',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isPopular must be a boolean',
  })
  isPopular?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether this subscription plan is active',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isActive must be a boolean',
  })
  isActive?: boolean;
}
```

## UpdateSubscriptionDto

Source: `src/app/module/subscription/dto/update-subscription.dto.ts`

```typescript
export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}
```

## TelegramSessionDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramSessionDto {
  @IsString() @MinLength(1) @MaxLength(8192) initData!: string;
}
```

## TelegramLoginDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramLoginDto extends TelegramSessionDto {
  @IsOptional() @IsBoolean() confirmTransfer?: boolean;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
```

## CreateUserDto

Source: `src/app/module/user/dto/create-user.dto.ts`

```typescript
export class CreateUserDto {
  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Name is requried' })
  name!: string;

  @ApiPropertyOptional({ example: '' })
  @IsEmail()
  @IsNotEmpty({ message: 'Email is requried' })
  email!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Password is requried' })
  password!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is requried' })
  phoneNumber!: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsString()
  @IsOptional()
  profileImage?: string;
}
```

## UpdateProfileDto

Source: `src/app/module/user/dto/update-profile.dto.ts`

```typescript
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}
```

## UpdateUserDto

Source: `src/app/module/user/dto/update-user.dto.ts`

```typescript
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {}
```

# Response enums

Database/response enum values are not automatically valid in every request DTO. For example, SendMessageDto accepts text/voice input while responses can contain images.

```prisma
enum UserRole {
  admin
  user
}

enum Status {
  pending
  approved
  rejected
}

enum PaymentStatus {
  pending
  completed
  failed
  refunded
}

enum CreditDirection {
  credit
  debit
}

enum CreditReason {
  purchase
  opening_balance
  subscription_grant
  subscription_expiry
  expiry
  photo
  voice
  extra_message
  gift
}

enum ChatMessageType {
  text
  voice
  photo
  gift
}

enum GiftTransactionStatus {
  completed
  refunded
}

```

# Refreshing this handbook

Run these commands from the backend repository after changing routes or DTOs:

```powershell
node scripts/export-frontend-contract.cjs
node scripts/build-full-frontend-readme.cjs
node scripts/render-frontend-handoff.cjs
```

Review business-flow prose when services change; route extraction cannot verify billing, provider quality or live delivery.
