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
