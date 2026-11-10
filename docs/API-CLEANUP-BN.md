# API cleanup and retained behavior

This project uses Telegram as its messaging channel while retaining the shared website/admin backend. Source inventory is generated from current controllers; see [the complete handbook](frontend-handoff/README-FRONTEND-FULL-BN.md). A source inventory is not proof of deployed availability.

## Removed endpoints and integration

- `POST /api/v1/credits/purchase` duplicated credit checkout. Use `POST /api/v1/payment/credits` with `packageId`.
- `POST /api/v1/whatsapp/test` was an arbitrary outbound test endpoint and has no public replacement.
- WhatsApp connect/webhook modules and companion-facing WhatsApp fields were removed as part of the Telegram-only channel decision.

Historical WhatsApp database records and the legacy `ChatMessage.whatsappMessageKey` column remain. That column now also protects Telegram, web and library retries from duplicate charges. Do not delete it merely because its name is historical.

## Retained features

Authentication, profiles, companions, subscriptions, wallet/credits, payment webhooks, Telegram login/connect, Mini Apps, media, routine, photo library, daily delivery and admin monitoring remain. Gifts, newsletter, relationships and human takeover are separate implemented features and were not removed by the messaging-channel change.

Text life events, expiring media Stories, profile gallery, approved photo library and scheduled daily content have distinct contracts. New gallery uploads now create pending library entries, but do not automatically publish a Story or daily schedule.

Existing external clients must migrate away from removed routes before deployment. Production traffic and every consumer were not audited by this cleanup. Exact client reference matching remains dependent on the original source documents/assets.
