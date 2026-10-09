export function deploymentSettings(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const origins = (env.CORS_ORIGINS || env.FRONTEND_URL || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (production && !origins.length)
    throw new Error('Set CORS_ORIGINS before production startup');
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      url.origin !== origin.replace(/\/$/, '') ||
      url.username ||
      url.password ||
      (production && url.protocol !== 'https:')
    )
      throw new Error(
        'CORS_ORIGINS must contain website origins (HTTPS in production)',
      );
  }
  if (production) {
    for (const key of ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'])
      if (!env[key] || env[key]!.length < 32)
        throw new Error(`${key} must contain at least 32 characters`);
    if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET)
      throw new Error('Access and refresh secrets must differ');
    if (env.TELEGRAM_AUTO_REPLY_ENABLED === 'true') {
      if (env.TELEGRAM_QUEUE_ENABLED !== 'true')
        throw new Error(
          'Enable TELEGRAM_QUEUE_ENABLED and run migrations for production',
        );
      if (!env.TELEGRAM_PUBLIC_BASE_URL?.startsWith('https://'))
        throw new Error('Set HTTPS TELEGRAM_PUBLIC_BASE_URL');
    }
    if (!env.AI_API_BASE_URL?.startsWith('https://'))
      throw new Error(
        'Production AI_API_BASE_URL must use HTTPS to protect user bearer tokens',
      );
  }
  const hops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5)
    throw new Error('TRUST_PROXY_HOPS must be 0–5');
  return {
    origins: origins.map((x) => new URL(x).origin),
    hops,
    swagger:
      env.SWAGGER_ENABLED === 'true' ||
      (!production && env.SWAGGER_ENABLED !== 'false'),
  };
}
