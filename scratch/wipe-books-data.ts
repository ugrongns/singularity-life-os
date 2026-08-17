import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

async function main() {
  const { client } = await import('../src/db');
  console.log('Wiping all books tables in Supabase Postgres...');

  await client`TRUNCATE TABLE book_quotes, reading_sessions, books RESTART IDENTITY CASCADE`;
  console.log('✅ All book_quotes, reading_sessions, and books records deleted successfully.');

  await client.end();
}

main().catch(console.error);
