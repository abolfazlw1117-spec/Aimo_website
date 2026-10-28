// Post-build: make sure no secret-looking material ended up in the bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const bad = [];
for (const f of walk('dist')) {
  if (!/\.(js|html|css|map)$/.test(f)) continue;
  const t = readFileSync(f, 'utf8');
  if (/sb_secret_[A-Za-z0-9_-]+/.test(t)) bad.push([f, 'sb_secret key']);
  for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const role = JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role;
      if (role === 'service_role') bad.push([f, 'service_role JWT']);
    } catch { /* not a JWT */ }
  }
  if (/localStorage\.setItem\(\s*['"]aimo-adm/.test(t)) bad.push([f, 'legacy admin credential storage']);
}
if (bad.length) { console.error('✗ Secret scan failed:', bad); process.exit(1); }
console.log('✓ dist secret scan passed');
