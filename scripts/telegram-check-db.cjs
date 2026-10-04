require('dotenv').config({ quiet: true });
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const keys = ['ELENA', 'CHLOE', 'LINA', 'LUNA', 'THALIA'];
  const ids = keys.map((key) =>
    process.env[`TELEGRAM_${key}_COMPANION_ID`]?.trim(),
  );
  if (ids.some((id) => !id) || new Set(ids).size !== keys.length)
    throw new Error('Configure five distinct companion IDs');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(
      'SELECT id, name, status FROM companions WHERE id = ANY($1::text[])',
      [ids],
    );
    let invalid = false;
    keys.forEach((key, index) => {
      const row = rows.find((row) => row.id === ids[index]);
      console.log(
        `${key}: ${row ? `${row.name} (${row.status ? 'active' : 'inactive'})` : 'NOT FOUND'}`,
      );
      if (!row?.status) invalid = true;
    });
    await client.query('ROLLBACK');
    if (invalid)
      throw new Error(
        'One or more mappings do not point to an active companion',
      );
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(
    error.code
      ? `Database check failed (${error.code}). Check database access/configuration.`
      : 'Database mapping check failed. Check configuration and database access.',
  );
  process.exitCode = 1;
});
