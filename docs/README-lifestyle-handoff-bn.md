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
