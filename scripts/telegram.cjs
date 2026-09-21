require('dotenv').config({ quiet: true });
const axios = require('axios');

async function main() {
  const command = process.argv[2] || 'status';
  if (!['status', 'setup'].includes(command))
    throw new Error(
      'Use: node scripts/telegram.cjs status|setup [https://public-host]',
    );
  const token = process.env.TELEGRAM_ELENA_BOT_TOKEN;
  if (!token) throw new Error('Set TELEGRAM_ELENA_BOT_TOKEN in .env');
  async function call(method, data = {}) {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/${method}`,
        data,
        { timeout: 15000 },
      );
      if (!response.data.ok) throw new Error();
      return response.data.result;
    } catch {
      throw new Error(
        `Telegram ${method} failed. Check token, network and webhook configuration.`,
      );
    }
  }
  const bot = await call('getMe');
  if (
    process.env.TELEGRAM_ELENA_BOT_USERNAME &&
    bot.username !== process.env.TELEGRAM_ELENA_BOT_USERNAME.replace(/^@/, '')
  ) {
    throw new Error('Bot username does not match TELEGRAM_ELENA_BOT_USERNAME');
  }
  console.log(`Bot: @${bot.username}`);
  if (command === 'setup') {
    const base = new URL(
      process.argv[3] || process.env.TELEGRAM_PUBLIC_BASE_URL || '',
    );
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    ) {
      throw new Error(
        'Provide the public HTTPS origin only, e.g. https://your-domain.com',
      );
    }
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret))
      throw new Error('Set a valid TELEGRAM_WEBHOOK_SECRET');
    await call('setWebhook', {
      url: `${base.origin}/api/v1/webhooks/telegram`,
      secret_token: secret,
      allowed_updates: ['message'],
      max_connections: 1,
    });
    console.log('Webhook registered.');
  }
  const info = await call('getWebhookInfo');
  console.log(
    JSON.stringify(
      {
        url: info.url,
        pending_update_count: info.pending_update_count,
        last_error_date: info.last_error_date,
        last_error_message: info.last_error_message,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
