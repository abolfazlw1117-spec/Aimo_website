// Admin panel. Loaded on demand. NOTHING here is a security boundary: every read/write is
// checked by Postgres RLS (profiles.role = 'admin' AND a TOTP-verified aal2 session).
// If someone edits this file in DevTools they still get "permission denied" from the database.
import { $, $$, fa, esc, dg, toast, pills } from './ui.js';

const IDLE_MS = 10 * 60 * 1000;
let AD, ctx, idle;

const STATUS = { awaiting_payment: 'در انتظار پرداخت', paid: 'پرداخت‌شده', cancelled: 'لغوشده', refunded: 'بازگشت وجه' };

function close(msg) {
  clearTimeout(idle);
  if (AD) { AD.hidden = true; AD.innerHTML = ''; }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  if (msg) toast(msg);
}
function touch() {
  clearTimeout(idle);
  idle = setTimeout(async () => { close('نشست مدیر به دلیل عدم فعالیت بسته شد'); await ctx.sb.auth.signOut(); }, IDLE_MS);
}
const set = (html) => { AD.innerHTML = html; pills(); };

export async function openAdmin(c) {
  ctx = c;
  if (!AD) {
    AD = document.createElement('div');
    AD.className = 'ad';
    document.body.appendChild(AD);
    AD.addEventListener('click', onClick);
    AD.addEventListener('input', touch);
  }
  AD.hidden = false;
  set('<div class="lw"><h2>پنل مدیریت</h2><p class="nt">در حال بررسی دسترسی…</p></div>');
  await gate();
}

async function gate() {
  const { sb } = ctx;
  const { data: lvl, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) { set(box('خطا', '<p class="nt">بررسی نشست ناموفق بود.</p>' + closeBtn())); return; }
  if (lvl.currentLevel === 'aal2') { touch(); return panel('p'); }
  const { data: f } = await sb.auth.mfa.listFactors();
  const verified = (f && f.totp) || [];
  if (verified.length) return challengeForm(verified[0].id);
  return enrollForm();
}

const closeBtn = () => '<button class="btn o" type="button" data-ax="1">بستن</button>';
const box = (title, inner) => '<div class="lw"><h2>' + title + '</h2>' + inner + '</div>';

function challengeForm(factorId) {
  set(box('تایید دو مرحله‌ای', '<form class="fm" id="mf" novalidate><label>کد ۶ رقمی برنامه Authenticator<input id="mc" inputmode="numeric" maxlength="6" autocomplete="one-time-code" dir="ltr"></label><button class="btn" type="submit">ورود به پنل</button>' + closeBtn() + '<div class="nt" id="mn" role="status"></div></form>'));
  $('#mf').onsubmit = async (e) => {
    e.preventDefault();
    const code = dg($('#mc').value.trim());
    if (!/^\d{6}$/.test(code)) { $('#mn').textContent = 'کد ۶ رقمی را وارد کنید.'; return; }
    const { sb } = ctx;
    const ch = await sb.auth.mfa.challenge({ factorId });
    if (ch.error) { $('#mn').textContent = 'خطا؛ دوباره تلاش کنید.'; return; }
    const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
    if (v.error) { $('#mn').textContent = 'کد نادرست است.'; return; }
    touch(); panel('p');
  };
}

async function enrollForm() {
  const { sb } = ctx;
  const { data: f } = await sb.auth.mfa.listFactors();
  for (const x of (f && f.all) || []) if (x.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'aimo-admin-' + Date.now() });
  if (error) { set(box('فعال‌سازی دو مرحله‌ای', '<p class="nt">فعال‌سازی TOTP در Supabase امکان‌پذیر نیست: ' + esc(error.message) + '</p>' + closeBtn())); return; }
  set(box('فعال‌سازی دو مرحله‌ای', '<form class="fm" id="ef" novalidate><p class="nt">برای دسترسی مدیر، احراز دومرحله‌ای الزامی است. QR را با برنامه Authenticator اسکن کنید.</p><img class="qr" alt="QR" src="' + esc(data.totp.qr_code) + '"><p class="nt">یا کلید دستی:</p><code class="kc" dir="ltr">' + esc(data.totp.secret) + '</code><label>کد ۶ رقمی<input id="ec" inputmode="numeric" maxlength="6" autocomplete="one-time-code" dir="ltr"></label><button class="btn" type="submit">تایید و ورود</button>' + closeBtn() + '<div class="nt" id="en" role="status"></div></form>'));
  $('#ef').onsubmit = async (e) => {
    e.preventDefault();
    const code = dg($('#ec').value.trim());
    if (!/^\d{6}$/.test(code)) { $('#en').textContent = 'کد ۶ رقمی را وارد کنید.'; return; }
    const ch = await sb.auth.mfa.challenge({ factorId: data.id });
    if (ch.error) { $('#en').textContent = 'خطا؛ دوباره تلاش کنید.'; return; }
    const v = await sb.auth.mfa.verify({ factorId: data.id, challengeId: ch.data.id, code });
    if (v.error) { $('#en').textContent = 'کد نادرست است.'; return; }
    touch(); panel('p');
  };
}

/* ---------------- panel ---------------- */
async function panel(tab, note) {
  touch();
  const head = '<div class="w ap"><div class="ah"><h2>پنل مدیریت</h2><div class="tb">' +
    [['p', 'محصولات'], ['r', 'نظرات'], ['o', 'سفارش‌ها'], ['s', 'امنیت']].map((t) => '<button data-at="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>').join('') +
    '</div><button class="btn o" data-ao="1">خروج</button></div>';
  set(head + '<p class="nt">در حال بارگذاری…</p></div>');
  let body = '';
  if (tab === 'p') body = await productsTab(note);
  else if (tab === 'r') body = await reviewsTab();
  else if (tab === 'o') body = await ordersTab();
  else body = securityTab();
  set(head + body + '</div>');
  if (tab === 'p') bindProductForm();
  if (tab === 's') bindSecurity();
}

const errBox = (e) => '<div class="re">دسترسی یا بارگذاری ناموفق بود: ' + esc(e.message) + '</div>';

async function productsTab(note) {
  const { data, error } = await ctx.sb.from('products').select('*').order('sort_order').order('id');
  if (error) return errBox(error);
  ctx.rows = data;
  return '<form class="fm" id="pf" novalidate><input type="hidden" id="pi"><label>نام محصول<input id="pn" maxlength="80"></label><label>دسته<select id="pc">' +
    ctx.C.map((x) => '<option value="' + x.k + '">' + x.n + '</option>').join('') +
    '</select></label><label>قیمت (تومان)<input id="pp" inputmode="numeric"></label><label>برچسب (اختیاری)<input id="pb" maxlength="20"></label><label>ترتیب نمایش<input id="po" inputmode="numeric" value="0"></label><label><span><input id="pa" type="checkbox" checked> فعال (قابل نمایش در فروشگاه)</span></label><button class="btn" type="submit">ذخیره محصول</button><div class="nt" id="pm" role="status">' + esc(note || '') + '</div></form>' +
    '<div class="at">' + data.map((x) => '<div class="ar"><span>' + esc(x.name) + '<small> · ' + fa(x.price) + (x.is_active ? '' : ' · غیرفعال') + '</small></span><span class="ac"><button data-ae="' + x.id + '">ویرایش</button><button data-ad="' + x.id + '">حذف</button></span></div>').join('') + '</div>';
}

function bindProductForm() {
  const f = $('#pf'); if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#pn').value.replace(/\s+/g, ' ').trim();
    const price = Math.round(Number(dg($('#pp').value).replace(/[,،\s]/g, '')));
    const id = Number($('#pi').value) || null;
    const row = {
      name, category: $('#pc').value, price,
      badge: $('#pb').value.trim().slice(0, 20) || null,
      sort_order: Math.round(Number(dg($('#po').value)) || 0),
      is_active: $('#pa').checked
    };
    if (name.length < 3 || name.length > 80 || !(price > 0) || price > 1e9) { $('#pm').textContent = 'نام (۳ تا ۸۰ حرف) و قیمت معتبر لازم است.'; return; }
    const q = id ? ctx.sb.from('products').update(row).eq('id', id) : ctx.sb.from('products').insert(row);
    const { error } = await q;
    if (error) { $('#pm').textContent = 'ذخیره ناموفق: ' + error.message; return; }
    await ctx.onProducts();
    panel('p', 'ذخیره شد.');
  };
}

async function reviewsTab() {
  const { data, error } = await ctx.sb.from('reviews').select('id,author_name,rating,body,created_at').order('created_at', { ascending: false }).limit(50);
  if (error) return errBox(error);
  return '<div class="at">' + (data.length ? data.map((r) => '<div class="ar"><span>' + esc(r.author_name) + ' · ' + '★'.repeat(r.rating) + '<small> · ' + esc(r.body) + '</small></span><span class="ac"><button data-rd="' + r.id + '">حذف</button></span></div>').join('') : '<div class="em">نظری وجود ندارد.</div>') + '</div>';
}

async function ordersTab() {
  const { data, error } = await ctx.sb.from('orders').select('id,status,total,created_at,order_items(name,quantity)').order('created_at', { ascending: false }).limit(50);
  if (error) return errBox(error);
  return '<p class="nt">سفارش‌ها فقط توسط سرور و پس از اتصال درگاه واقعی ایجاد می‌شوند.</p><div class="at">' +
    (data.length ? data.map((o) => '<div class="ar"><span>#' + fa(o.id) + ' · ' + esc(STATUS[o.status] || o.status) + '<small> · ' + fa(o.total) + ' تومان · ' + (o.order_items || []).map((i) => esc(i.name) + '×' + fa(i.quantity)).join('، ') + '</small></span><small>' + new Date(o.created_at).toLocaleString('fa-IR') + '</small></div>').join('') : '<div class="em">سفارشی وجود ندارد.</div>') + '</div>';
}

function securityTab() {
  return '<div class="sg"><form class="fm" id="cf" novalidate><b>تغییر رمز عبور</b><label>رمز جدید (حداقل ۱۲ کاراکتر، شامل حرف و عدد)<input id="o2" type="password" autocomplete="new-password"></label><button class="btn" type="submit">تغییر رمز</button><div class="nt" id="cn2" role="status"></div></form>' +
    '<div class="fm"><b>احراز دومرحله‌ای</b><p class="nt">فعال است؛ دسترسی مدیر فقط با نشست تاییدشده (aal2) معتبر است.</p></div></div>';
}
function bindSecurity() {
  const f = $('#cf'); if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const p = $('#o2').value, n = $('#cn2');
    if (p.length < 12 || !/[a-zA-Z]/.test(p) || !/\d/.test(p)) { n.textContent = 'رمز ضعیف است.'; return; }
    const { error } = await ctx.sb.auth.updateUser({ password: p });
    n.textContent = error ? 'تغییر رمز ناموفق بود.' : 'رمز تغییر کرد.';
    if (!error) f.reset();
  };
}

/* ---------------- clicks ---------------- */
async function onClick(e) {
  touch();
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ax) return close();
  if (b.dataset.ao) { close('خارج شدید'); await ctx.sb.auth.signOut(); return; }
  if (b.dataset.at) return panel(b.dataset.at);
  if (b.dataset.ae) {
    const x = (ctx.rows || []).find((p) => String(p.id) === b.dataset.ae); if (!x) return;
    $('#pi').value = x.id; $('#pn').value = x.name; $('#pc').value = x.category; $('#pp').value = x.price;
    $('#pb').value = x.badge || ''; $('#po').value = x.sort_order; $('#pa').checked = x.is_active; $('#pn').focus();
    return;
  }
  if (b.dataset.ad) {
    if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'مطمئنی؟'; return; }
    const { error } = await ctx.sb.from('products').delete().eq('id', Number(b.dataset.ad));
    if (error) { toast('حذف ناموفق: ' + error.message); return; }
    await ctx.onProducts(); panel('p', 'حذف شد.'); return;
  }
  if (b.dataset.rd) {
    if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'مطمئنی؟'; return; }
    const { error } = await ctx.sb.from('reviews').delete().eq('id', Number(b.dataset.rd));
    if (error) { toast('حذف ناموفق: ' + error.message); return; }
    await ctx.onReviews(); panel('r');
  }
}
