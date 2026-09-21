# Telegram AI setup

WhatsApp remains registered separately. Telegram private chats use the same ChatService as WhatsApp: linked users, AI conversation history, subscriptions, credits and human takeover.

1. Set these values in your local `.env` (rotate any token shared in chat or screenshots using BotFather `/revoke`):

   ```ini
   TELEGRAM_ELENA_BOT_TOKEN=YOUR_NEW_BOT_TOKEN
   TELEGRAM_ELENA_BOT_USERNAME=MeetElysiaElenaBot
   TELEGRAM_WEBHOOK_SECRET=YOUR_RANDOM_SECRET
   TELEGRAM_AUTO_REPLY_ENABLED=true
   TELEGRAM_REPLY_MODE=ai
   ```

   Secret must contain 1–256 letters, digits, underscores or hyphens. Keep these values private.

2. Apply the new account-link table with `npx prisma migrate deploy`, run `npm run generate`, then restart the backend with `npm run start:dev`. The bot resolves the active companion named Elena; if the name differs or is ambiguous, set `TELEGRAM_ELENA_COMPANION_ID` to her database UUID.
3. Deploy it to a public HTTPS host, or forward a public HTTPS tunnel to the backend's configured `PORT` (default 3000).
4. Register the webhook from the project directory:

   ```powershell
   node scripts/telegram.cjs setup https://YOUR-PUBLIC-HOST
   node scripts/telegram.cjs status
   ```

   The script reads credentials from `.env`; do not put the token in a browser URL. Re-register if the tunnel hostname or webhook secret changes. Restart the backend after changing `.env`.

5. Open `/api/docs`, authorize with your website user access token, then call `POST /api/v1/telegram/connect/{companionId}` using Elena’s UUID. Open the returned `data.telegramUrl` and press Start within 10 minutes. The link is single-use. After “Telegram connected”, send `hello` for an AI response. Your account must be approved and adult-eligible, with an active subscription and sufficient credits. A plain Start without the generated link cannot identify your website account.

The frontend can use this endpoint for a Connect Telegram button; this backend change does not add frontend UI. Set `TELEGRAM_REPLY_MODE=echo` only for delivery testing. Image replies are sent as Telegram photos, without a caption or visible image URL.

Endpoint: `POST /api/v1/webhooks/telegram`. Telegram supplies `X-Telegram-Bot-Api-Secret-Token`; missing or incorrect values return 403. Outbound failures return 503 so Telegram can retry. Inspect the status command for pending updates and delivery errors. A local server alone cannot receive Telegram webhooks.

No messages are sent by the setup/status commands. Tests mock Telegram API requests. Replies are plain text and capped at 4096 Unicode code points. Duplicate suppression is bounded to 10,000 updates/24 hours within one process; restarts, multiple replicas and ambiguous network failures can produce duplicate replies. Use durable shared deduplication before scaling.

Reference: https://core.telegram.org/bots/api#setwebhook
