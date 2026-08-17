import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

async function main() {
  const { client } = await import('./src/db');
  const sessionRows = await client`SELECT token FROM auth_sessions ORDER BY created_at DESC LIMIT 1`;
  const token = sessionRows[0]?.token;

  console.log('Testing local scan-isbn endpoint for ISBN 9786257762175...');
  const res = await fetch('http://127.0.0.1:3000/api/library/scan-isbn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `singularity_session=${token}`
    },
    body: JSON.stringify({
      isbn_text: '9786257762175'
    })
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Local Response:\n', JSON.stringify(data, null, 2));

  await client.end();
}

main().catch(console.error);
