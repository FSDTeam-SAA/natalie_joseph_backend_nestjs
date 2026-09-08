# Subscription, credits and companion features

All routes below use `/api/v1`. Send the existing bearer token. Responses use the existing `{ statusCode, success, message, data }` envelope. Swagger is at `/api/docs`.

## Run the update

```sh
npx prisma migrate deploy
npm run generate
npm run build
npm test -- --runInBand
```

Run migrations against the intended database before starting this version. The two new migrations add the schema, connect historical messages to conversations, seed costs, backfill relationships and record opening subscription balances. They preserve historical messages, payments and purchased credit lots. Historical subscription spending was not itemized by the old implementation; it is represented by the remaining opening balance, not invented historical transactions. PostgreSQL 12+ is required for the enum migration. Use a Node version supported by the installed dependencies (at least Node 20.19).

Required existing environment variables: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, JWT secrets and the existing AI/SMTP configuration. `FRONTEND_URL` is also required for the billing portal.

Configure Stripe to deliver these events to `POST /api/v1/webhook`:

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Enable the Stripe customer portal for payment-method updates and invoices. Keep plan changes in this backend's upgrade endpoint, which controls the new cycle and allowance policy.

## Rules

| Feature | Implemented behavior |
| --- | --- |
| Recurring renewal | New paid plans use a Stripe card subscription with an exact 30-day interval. Only a paid invoice grants a fresh period and allowance. Retries do not grant twice. |
| Upgrade/cancel | Higher-priced plans can start a new 30-day cycle. Stripe credits unused paid time through proration. The saved card must successfully pay before an upgrade applies. Cancellation stops the next renewal and retains current access until expiry. |
| Credit ledger | Purchases, allowance grants, message/voice/photo/gift spending and both kinds of expiry are recorded. `source` distinguishes `subscription` and `purchased`; before/after balances belong to that source. `referenceId` links a grant to its subscription, a purchase to its payment, spending to its message/gift/photo view, and purchased expiry to its lot. |
| Credit costs | Admin configures message, photo, voice and low-credit threshold in the database. Defaults: 1, 5, 3 and 10. Zero-cost actions are supported. Gift prices remain configured per gift. |
| Relationship | One row per user/companion, with nickname, notes, interaction count and latest interaction time. Chats, gifts and first photo views update it. |
| Human takeover | Admin switches a conversation between AI and human, with an audit event and user notification. Human mode stores the user's message without calling AI. Only the assigned admin can answer it. Pending messages must be answered before returning to AI. |
| Daily stories | One editable story per companion per UTC calendar date. Users see published stories whose dates have arrived; admins can see drafts and future stories. |
| Photo history | Records first view, latest view, view count and original cost per user/companion/gallery URL. The first view is charged; repeat views are free. |
| Admin conversations | Paginated conversation list and message history, including legacy messages and gifts. |
| Admin user details | Selected profile fields, billing status, latest subscriptions/payments, wallet, relationships and usage counts. Passwords and OTPs are excluded. |
| Notifications | Stored notifications for activation, low credits, credit expiry, failed renewal, mode changes and human replies; admin can create a user notification. Users can read only their own notifications. |
| Purchased expiry | Each purchase expires exactly 90 days after its successful payment event. Only the unused portion expires. Expiry runs hourly and before wallet reads/spending. |
| Low credits | Available allowance plus unexpired purchased credits is compared with the configured threshold. Detection returns a flag and stores a notification; repeated checks while low do not repeatedly notify. |

Spending requires an active subscription, preserving the existing access policy. Subscription allowance is consumed first, then purchased lots in earliest-expiry order. Unused allowance expires when a period ends or is replaced. `messagesUsed` counts messages, not credits or gifts; `messageLimit` remains a deprecated display field, while `creditAllowance` controls spending. A failed AI call rejects the database transaction, including its debit.

Existing free and one-time subscriptions retain their original expiry and do not automatically charge a saved card. The user must initiate a new recurring subscription to opt into renewal. Free trials remain one-use and cannot replace an existing subscription. Incomplete old one-time checkout intents are canceled before starting recurring billing.

Paid-plan `durationDays` is always 30 for recurring billing; free trials still use their configured duration. Paid price/allowance values are copied to immutable Stripe price metadata, so editing a plan does not silently change existing customers' terms. Create a new purchase/upgrade to use revised terms.

## User routes

| Method and path | Body / purpose |
| --- | --- |
| `POST /payment/subscription/:planId` | Free trial activation, or recurring subscription initialization. Confirm the returned `clientSecret` with Stripe on the frontend; then poll status. Paid responses now contain `stripeSubscriptionId`, `status`, `clientSecret`, `invoiceUrl`, `activated: false`; a local payment record is created on the paid invoice event. |
| `GET /payment/subscription/status` | Current local paid access, renewal status and cancellation flag. |
| `POST /payment/subscription/:planId/upgrade` | Upgrade using the saved card. If payment fails or needs additional authentication, the plan remains unchanged; update the card via the portal and retry. |
| `POST /payment/subscription/cancel` | Cancel future renewal; returns `accessUntil`. |
| `POST /payment/billing-portal` | Returns a Stripe portal URL for payment-method management. |
| `GET /credits/wallet` | Purchased balance, recent ledger, active purchase lots, combined available credits and low-credit state. |
| `GET /credits/ledger?page=1&limit=50` | Full paginated ledger. |
| `GET /credits/costs` | Current effective action prices and threshold. |
| `GET /chat/usage` | Current subscription allowance and usage. |
| `POST /chat/:companionId/messages` | `{ "message": "Hello", "type": "text" }`; `type` defaults to `text`. For `voice`, supply a transcript in `message`; this API does not perform transcription or audio synthesis. |
| `GET /relationships` | Own relationships; accepts page/limit. |
| `PATCH /relationships/:companionId` | `{ "nickname": "Alex", "notes": "Enjoys hiking" }` |
| `GET /companions/:companionId/stories` | Published daily stories; accepts page/limit. |
| `POST /companions/:companionId/photos/view` | `{ "photoUrl": "<exact URL from companion.galleryImages>" }` |
| `GET /photos/history` | Own photo history; accepts page/limit. |
| `GET /notifications` | Own notifications; accepts page/limit. |
| `PATCH /notifications/:id/read` | Idempotently mark an owned notification as read. |

Paginated engagement routes default to 50 records, capped at 100. Existing credit-package purchase and gift routes continue to work.

## Admin routes

All routes below require an admin token.

| Method and path | Body / purpose |
| --- | --- |
| `PUT /admin/credit-costs/:action` | `{ "credits": 5 }`; action is `message`, `photo`, `voice` or `low_credit_threshold`. |
| `GET /admin/conversations` | Paginated conversation overview. |
| `GET /admin/conversations/:id` | Conversation and paginated message history. |
| `PATCH /admin/conversations/:id/mode` | `{ "mode": "human" }` or `{ "mode": "ai" }`; switching to human assigns the requesting admin. |
| `POST /admin/conversations/:id/replies` | `{ "messageId": "<unanswered user message>", "message": "Hello" }`; updates that message's `response` and `humanAdminId`, without a second user charge. |
| `GET /admin/users/:id/details` | User billing, credits, relationships and usage. |
| `GET /admin/users/:id/ledger` | Paginated full user ledger. |
| `PUT /admin/companions/:companionId/stories` | `{ "day": "2026-09-08", "title": "Morning walk", "content": "Today...", "published": true }`; upserts by companion/date. |
| `GET /admin/companions/:companionId/stories` | Includes drafts/future dates; accepts page/limit. |
| `POST /admin/notifications` | `{ "userId": "...", "title": "Update", "body": "..." }` |

Notifications and human replies are delivered through database APIs, so the frontend must poll or refresh. Photo history tracks gallery access; existing public image URLs are not converted into private signed assets. Human messages are stored locally and are not injected into the external AI service's historical context. AI requests still use the existing external service inside the charging transaction; local rollback cannot undo a response already produced remotely.

## Verification

The automated service and HTTP tests cover credit splitting/expiry, low-credit notifications, duplicate and out-of-order invoice handling, cancellation/upgrade rules, human takeover, ownership checks, validation and response envelopes. Database and Stripe calls are mocked in these tests; the suite does not prove PostgreSQL row-lock behavior or actual card billing.

Before production rollout, apply migrations to a staging PostgreSQL database and test a Stripe test-mode subscription through initial payment, 30-day test-clock renewal, failed renewal, upgrade and cancellation. Send concurrent spending requests against staging and confirm the wallet never goes negative. No live database migration or real Stripe charge is performed by the unit tests.

Stripe behavior used here: [subscription updates](https://docs.stripe.com/api/subscriptions/update), including `error_if_incomplete` and proration. Installed Stripe SDK types are the source for the current invoice/subscription payload fields.

Mail is sent directly through the existing Nodemailer SMTP helper. Redis and BullMQ are no longer required. Newsletter broadcasts wait for SMTP sending and return `sent` rather than `queued`. There are no background retries; large broadcasts can take longer than an HTTP request timeout. Old Redis jobs are not automatically replayed.
