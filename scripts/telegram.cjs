require('dotenv').config({ quiet: true });
const axios = require('axios');
const { createHmac } = require('node:crypto');
const keys = ['ELENA', 'CHLOE', 'LINA', 'LUNA', 'THALIA'];

async function main() {
  const command = process.argv[2] || 'status';
  if (!['check', 'status', 'setup', 'menu'].includes(command))
    throw new Error(
      'Use: node scripts/telegram.cjs check|status|setup [https://public-host] [ELENA|CHLOE|LINA|LUNA|THALIA|all], or menu [ELENA|CHLOE|LINA|LUNA|THALIA|all]',
    );
  const selected = ((command === 'menu' ? process.argv[3] : process.argv[4]) || 'all').toUpperCase();
  if (selected !== 'ALL' && !keys.includes(selected))
    throw new Error('Unknown bot key');
  const targets = selected === 'ALL' ? keys : [selected];
  const ids = new Set();
  const tokens = new Set();
  const usernames = new Set();
  const bots = targets.map((key) => {
    const get = (field) => {
      const value = process.env[`TELEGRAM_${key}_${field}`]?.trim();
      if (!value) throw new Error(`Set TELEGRAM_${key}_${field} in .env`);
      return value;
    };
    const token = get('BOT_TOKEN');
    const username = get('BOT_USERNAME').replace(/^@/, '');
    const companionId = get('COMPANION_ID');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        companionId,
      )
    )
      throw new Error(`${key}: companion ID must be a database UUID`);
    if (
      ids.has(companionId) ||
      tokens.has(token) ||
      usernames.has(username.toLowerCase())
    )
      throw new Error(
        'Each bot must have a distinct companion ID, username and token',
      );
    ids.add(companionId);
    tokens.add(token);
    usernames.add(username.toLowerCase());
    const master = process.env.TELEGRAM_WEBHOOK_SECRET;
    const secret =
      process.env[`TELEGRAM_${key}_WEBHOOK_SECRET`] ||
      (master ? createHmac('sha256', master).update(key).digest('hex') : '');
    if (command !== 'menu' && !/^[A-Za-z0-9_-]{1,256}$/.test(secret))
      throw new Error(
        `${key}: configure a valid webhook secret or TELEGRAM_WEBHOOK_SECRET`,
      );
    return { key, token, username, companionId, secret };
  });
  if (command === 'check' || command === 'setup') {
    for (const key of [
      'TELEGRAM_CREDITS_URL',
      'TELEGRAM_SUBSCRIPTION_URL',
      'TELEGRAM_CONNECT_URL',
    ]) {
      let url;
      try {
        url = new URL(process.env[key]);
      } catch {
        throw new Error(`Set ${key} to the actual website page URL`);
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(`${key} must be an HTTP(S) URL without credentials`);
    }
  }
  if (command === 'check') {
    console.log(
      `Local configuration OK for ${bots.length} bots. Tokens, database IDs and live URLs have not been verified.`,
    );
    return;
  }
  const maxConnections = Number(
    process.env.TELEGRAM_WEBHOOK_MAX_CONNECTIONS || 4,
  );
  if (
    !Number.isInteger(maxConnections) ||
    maxConnections < 1 ||
    maxConnections > 40
  )
    throw new Error(
      'TELEGRAM_WEBHOOK_MAX_CONNECTIONS must be between 1 and 40',
    );
  let base;
  if (command === 'setup') {
    try {
      base = new URL(process.argv[3] || process.env.TELEGRAM_PUBLIC_BASE_URL);
    } catch {
      throw new Error(
        'Set TELEGRAM_PUBLIC_BASE_URL to the deployed HTTPS origin',
      );
    }
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    )
      throw new Error(
        'Provide only a public HTTPS origin, e.g. https://api.example.com',
      );
  }
  async function call(bot, method, data = {}) {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.token}/${method}`,
        data,
        { timeout: 15000 },
      );
      if (!response.data.ok) throw new Error();
      return response.data.result;
    } catch {
      throw new Error(
        `${bot.key}: Telegram ${method} failed. Check token, network and configuration.`,
      );
    }
  }
  // Verify every selected bot before modifying any webhook.
  for (const bot of bots) {
    const info = await call(bot, 'getMe');
    if (info.username.toLowerCase() !== bot.username.toLowerCase())
      throw new Error(`${bot.key}: token belongs to a different bot username`);
  }
  for (const bot of bots) {
    if (command === 'menu' || command === 'setup') {
      const scope = { type: 'all_private_chats' };
      const existing = await call(bot, 'getMyCommands', { scope });
      const defaults = await call(bot, 'getMyCommands');
      const preferred = [
        { command: 'stories', description: '📸 Stories — view the latest photos and videos' },
        { command: 'login', description: 'Log in or connect your Meet Elysia account' },
        { command: 'start', description: 'Start chatting with your companion' },
      ];
      const commands = [...preferred];
      for (const item of [...existing, ...defaults]) {
        if (!commands.some((c) => c.command === item.command)) commands.push(item);
      }
      if (commands.length > 100) throw new Error(`${bot.key}: too many existing menu commands`);
      await call(bot, 'setMyCommands', { scope, commands });
      await call(bot, 'setChatMenuButton', { menu_button: { type: 'commands' } });
      const verified = await call(bot, 'getMyCommands', { scope });
      const menu = await call(bot, 'getChatMenuButton');
      if (!verified.some((c) => c.command === 'stories') || menu.type !== 'commands')
        throw new Error(`${bot.key}: menu verification failed`);
      console.log(`${bot.key}: Stories, Login and Start menu configured and verified`);
      if (command === 'menu') continue;
    }
    if (command === 'setup') {
      await call(bot, 'setWebhook', {
        url: `${base.origin}/api/v1/webhooks/telegram/${bot.companionId}`,
        secret_token: bot.secret,
        allowed_updates: ['message'],
        max_connections: maxConnections,
      });
      console.log(`${bot.key}: webhook registered`);
    }
    const info = await call(bot, 'getWebhookInfo');
    console.log(
      JSON.stringify(
        {
          bot: bot.username,
          url: info.url,
          pendingUpdates: info.pending_update_count,
          lastErrorDate: info.last_error_date,
          hasLastError: Boolean(info.last_error_message),
        },
        null,
        2,
      ),
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
