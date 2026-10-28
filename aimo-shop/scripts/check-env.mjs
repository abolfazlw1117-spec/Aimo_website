// Fails the build if a secret key is exposed via VITE_*; requires config on Vercel.
import { readFileSync, existsSync } from 'node:fs';

function loadDotenv() {
  const out = {};
  for (const f of ['.env', '.env.local', '.env.production']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

const env = { ...loadDotenv(), ...process.env };
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';
const onVercel = !!env.VERCEL;
let fail = false;

function jwtRole(k) {
  try {
    const p = k.split('.')[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role;
  } catch { return null; }
}

for (const [name, val] of Object.entries(env)) {
  if (!name.startsWith('VITE_')) continue;
  if (/service_role|secret|private/i.test(name) || /^sb_secret_/.test(val) || jwtRole(val) === 'service_role') {
    console.error(`✗ ${name} looks like a SECRET key. Never expose it to the browser.`);
    fail = true;
  }
}

if (!url || !key) {
  const msg = 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.';
  if (onVercel) { console.error('✗ ' + msg); fail = true; }
  else console.warn('! ' + msg + ' The site will build but show a configuration warning.');
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.warn('! VITE_SUPABASE_URL does not look like https://<ref>.supabase.co (custom domains need a CSP update in vercel.json).');
}

if (fail) process.exit(1);
console.log('✓ env check passed');
