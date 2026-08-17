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

  console.log('Testing live Vercel scan-isbn endpoint for ISBN 9786254416170...');
  const res = await fetch('https://singularity-life-os.vercel.app/api/library/scan-isbn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `singularity_session=${token}`
    },
    body: JSON.stringify({
      isbn_text: '9786254416170'
    })
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Live Vercel Response:\n', JSON.stringify(data, null, 2));

  await client.end();
}

main().catch(console.error);
