# Companion chat

Setup:

1. Run `npx prisma migrate deploy` and `npm run generate`, then restart the backend.
2. Optional environment variable: `AI_API_BASE_URL=https://natalie-joseph-ai.onrender.com/api/v1`.
3. Set `aiCompanionId` through the existing companion create/update endpoint to the matching AI companion UUID (for example `de7e358f-ffe5-4942-a77b-b6219b8163c7`). If omitted, the local companion ID is used. The AI companion must already exist; this integration does not create AI companion profiles.
4. The AI service must accept the logged-in user's bearer token. No token is hardcoded or stored.

Use the backend's existing global API prefix with these routes:

```http
POST /chat/:companionId/messages
Authorization: Bearer <user-access-token>
Content-Type: application/json

{ "message": "Hi" }
```

`companionId` is the backend companion ID. The backend checks for an active subscription, consumes one credit (subscription credits first, purchased credits second), creates or reuses that user's AI conversation, calls `/chat`, and saves the user message and AI reply together. The reply is in `data.response`, the saved exchange in `data.message`, and remaining balances in `data.usage`. AI token usage does not affect the one-credit message cost. Existing credit allowances remain the billing rule; `messageLimit` is not an additional cap.

- `GET /chat/:companionId/messages?page=1`: newest 50 saved exchanges, ordered oldest to newest within that page. Each row's `message` is the user bubble and nullable `response` is the companion bubble. Older pre-integration rows have no reply. Gift rows retain their existing type.
- `GET /chat/conversations`: current user's conversations with companion profiles, most recently active first.
- `GET /chat/usage`: current subscription and credit balances.

All routes require the user's bearer token. History is scoped to the authenticated user. Missing subscription or insufficient credit returns HTTP 402; upstream failure/invalid response returns HTTP 502 and rolls back local message writes and credit deductions.

The AI calls have a 30-second timeout each; the database transaction has a 75-second limit and holds a per-user wallet lock to serialize charges. This simple integration holds a database connection while waiting for AI. The remote API and local database cannot commit atomically: a timeout or local commit failure can leave an upstream message without a locally saved exchange. Automatic retries are intentionally absent; the supplied AI contract has no idempotency/reconciliation mechanism. Local history contains exchanges successfully saved through this backend, not messages sent directly to the AI API.
