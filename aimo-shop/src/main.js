import './style.css';
import { sb, configured } from './supabase.js';
import { $, $$, fa, ic, esc, dg, toast, store, pills } from './ui.js';

// Payments stay OFF until a real gateway is connected server-side.
const PAYMENTS_ENABLED = false;

const C = [
  { k: 'ai', n: 'هوش مصنوعی', g: 'g1', s: ['ChatGPT', 'Claude', 'Gemini', 'تصویر'] },
  { k: 'num', n: 'شماره مجازی', g: 'g2', s: ['دائمی', 'موقت'] },
  { k: 'sub', n: 'اشتراک‌ها', g: 'g5', s: ['موزیک', 'فضای ابری'] },
  { k: 'gift', n: 'گیفت‌کارت', g: 'g4', s: ['آمریکا'] },
  { k: 'game', n: 'اکانت بازی', g: 'g3', s: ['اکشن', 'ورزشی'] },
  { k: 'tg', n: 'خدمات تلگرام', g: 'g6', s: ['پریمیوم', 'استارز'] }
];
const SL = [
  ['g1', 'ai', 'هوش مصنوعی در دستان تو', 'اشتراک ChatGPT، Claude و ابزار تصویر با تحویل سریع.', 'ai'],
  ['g2', 'num', 'شماره مجازی دائمی و موقت', 'برای تلگرام و شبکه‌های اجتماعی، فعال‌سازی در چند دقیقه.', 'num'],
  ['g5', 'tg', 'تلگرام پریمیوم و استارز', 'ورود به اکانت یا گیفتی، هر کدام که می‌خواهی.', 'tg']
];
const BL = [
  ['g1', 'ai', 'راهنمای خرید اشتراک هوش مصنوعی', '۵ دقیقه مطالعه', 'اول نیازت را مشخص کن؛ نوشتن، کدنویسی یا تصویر. بعد پلن مناسب را با بودجه‌ات مقایسه کن.'],
  ['g6', 'tg', 'تفاوت پریمیوم ورود به اکانت و گیفتی', '۴ دقیقه مطالعه', 'در ورود به اکانت، اشتراک روی همان حساب فعال می‌شود؛ در گیفتی، کد هدیه برایت ارسال می‌شود.'],
  ['g4', 'num', 'شماره مجازی چیست و چطور امن استفاده کنیم', '۶ دقیقه مطالعه', 'شماره مجازی را فقط برای ثبت‌نام استفاده کن و کد تایید را هرگز با کسی به اشتراک نگذار.']
];
const cn = (k) => C.find((c) => c.k === k) || C[0];

// Legacy demo keys (credentials/products/log stored in the browser) must not linger.
['aimo-adm', 'aimo-lk', 'aimo-log', 'aimo-user', 'aimo-products', 'aimo-cart'].forEach(store.del);

const S = { cat: 'all', q: '', all: false, P: [], cart: {}, user: null, profile: null, ready: false, lr: 0 };
const GUEST_KEY = 'aimo-guest-cart';

/* ---------- views ---------- */
function show(v) {
  const f = () => {
    ['home', 'cats', 'login'].forEach((x) => { $('#v-' + x).hidden = x !== v; });
    $('#nav').classList.remove('on');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion:reduce)').matches) document.startViewTransition(f);
  else f();
}
function to(id) {
  if ($('#v-home').hidden) show('home');
  setTimeout(() => { const e = document.getElementById(id); if (e) e.scrollIntoView({ behavior: 'smooth' }); }, 30);
}

/* ---------- slider ---------- */
$('#sl').innerHTML =
  SL.map((s, i) =>
    '<div class="sd ' + s[0] + (i ? '' : ' on') + '"><h1>' + s[2] + '</h1><p>' + s[3] + '</p><button class="btn" data-cat="' + s[4] + '">مشاهده محصولات</button>' + ic(s[1]) + '</div>').join('') +
  '<div class="dots">' + SL.map((s, i) => '<button data-sl="' + i + '" class="' + (i ? '' : 'on') + '" aria-label="اسلاید ' + fa(i + 1) + '"></button>').join('') + '</div>';
let si = 0, timer;
function go(i) {
  si = (i + SL.length) % SL.length;
  $$('.sd').forEach((e, j) => e.classList.toggle('on', j === si));
  $$('[data-sl]').forEach((e, j) => e.classList.toggle('on', j === si));
}
function auto() {
  clearInterval(timer);
  if (!matchMedia('(prefers-reduced-motion:reduce)').matches) timer = setInterval(() => { if (!document.hidden) go(si + 1); }, 5500);
}
auto();

/* ---------- categories ---------- */
$('#cr').innerHTML = C.map((c) => '<button class="cb" data-cat="' + c.k + '" aria-pressed="false"><span class="ci ' + c.g + '">' + ic(c.k) + '</span>' + c.n + '</button>').join('');
$('#chips').innerHTML = [{ k: 'all', n: 'همه' }].concat(C).map((c) => '<button class="chip" data-chip="' + c.k + '" aria-pressed="' + (c.k === 'all') + '">' + c.n + '</button>').join('');
$('#cg').innerHTML = C.map((c) =>
  '<div class="cx"><header><span class="ci ' + c.g + '">' + ic(c.k) + '</span>' + c.n + '<button data-cat="' + c.k + '">مشاهده همه</button></header><div class="sl2">' +
  c.s.map((x) => '<button data-cat="' + c.k + '" data-sq="' + x + '">' + x + '</button>').join('') + '</div></div>').join('');

function sync() {
  $$('[data-cat].cb').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === S.cat)));
  $$('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chip === S.cat)));
}

/* ---------- products (from Supabase) ---------- */
let loadErr = '';
async function loadProducts() {
  if (!configured) { loadErr = 'اتصال به دیتابیس هنوز تنظیم نشده است.'; return; }
  const { data, error } = await sb.from('products').select('id,category,name,price,badge')
    .eq('is_active', true).order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (error) { loadErr = 'بارگذاری محصولات ناموفق بود. چند دقیقه بعد دوباره امتحان کنید.'; console.error(error.message); return; }
  loadErr = '';
  S.P = data.map((x) => ({ id: Number(x.id), c: x.category, n: x.name, p: Number(x.price), b: x.badge || undefined }));
}

function grid() {
  const l = S.P.filter((x) => (S.cat === 'all' || x.c === S.cat) && (!S.q || x.n.indexOf(S.q) > -1 || cn(x.c).n.indexOf(S.q) > -1));
  const m = !S.all && !S.q && S.cat === 'all' && l.length > 8;
  const v = m ? l.slice(0, 8) : l;
  $('#more').parentNode.hidden = !m;
  $('#gr').innerHTML = v.length
    ? v.map((x) => {
        const c = cn(x.c);
        return '<article class="cd"><div class="tile ' + c.g + '">' + (x.b ? '<span class="tg">' + esc(x.b) + '</span>' : '') + ic(x.c) + c.n + '</div><div class="cbd"><span class="cc">' + c.n + '</span><span class="cn">' + esc(x.n) + '</span><div class="pr"><span class="pv">' + fa(x.p) + '<small>تومان</small></span><button class="add" data-add="' + x.id + '" aria-label="افزودن به سبد">' + ic('plus') + '</button></div></div></article>';
      }).join('')
    : '<div class="em">' + esc(loadErr || (S.ready ? 'محصولی پیدا نشد. عبارت دیگری را امتحان کنید.' : 'در حال بارگذاری…')) + '</div>';
  sync();
  rev($('#gr'));
}
function pick(k, q) { S.cat = k; S.q = q || ''; $('#q').value = S.q; grid(); to('products'); }
$('#more').onclick = () => { S.all = true; grid(); };
$('#q').oninput = (e) => { S.q = e.target.value.trim().slice(0, 60); grid(); };

/* ---------- cart: per-user in Supabase, guest cart in localStorage then merged on login ---------- */
const clampQ = (n) => Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
let cartQ = Promise.resolve();

function cartRender() {
  const ids = Object.keys(S.cart).filter((i) => S.cart[i] > 0 && S.P.some((x) => String(x.id) === i));
  let n = 0, sum = 0;
  $('#dl').innerHTML = ids.length
    ? ids.map((id) => {
        const p = S.P.find((x) => String(x.id) === id), q = S.cart[id];
        n += q; sum += p.p * q;
        return '<div class="ln"><span class="ci ' + cn(p.c).g + '">' + ic(p.c) + '</span><div><b>' + esc(p.n) + '</b><div class="mt"><span class="q"><button data-q="' + id + '" data-d="-1" aria-label="کم">−</button><span>' + fa(q) + '</span><button data-q="' + id + '" data-d="1" aria-label="زیاد">+</button></span><span>' + fa(p.p * q) + ' تومان</span></div></div></div>';
      }).join('')
    : '<div class="de">سبد خرید خالی است.</div>';
  $('#dt').textContent = fa(sum) + ' تومان';
  const b = $('#cc'); b.hidden = !n; b.textContent = fa(n);
  const co = $('#co');
  co.disabled = !PAYMENTS_ENABLED || !n;
  co.textContent = PAYMENTS_ENABLED ? 'ادامه و پرداخت' : 'پرداخت به‌زودی فعال می‌شود';
  $('#dm').textContent = PAYMENTS_ENABLED || !n ? '' : 'درگاه پرداخت هنوز فعال نیست؛ سبد شما ذخیره می‌ماند و هیچ سفارشی ثبت نمی‌شود.';
}

async function cartLoad() {
  if (S.user) {
    const { data, error } = await sb.from('cart_items').select('product_id,quantity').eq('user_id', S.user.id);
    if (error) { toast('بارگذاری سبد خرید ناموفق بود'); return; }
    S.cart = {};
    data.forEach((r) => { S.cart[r.product_id] = clampQ(r.quantity); });
  } else {
    const g = store.get(GUEST_KEY) || {};
    S.cart = {};
    Object.keys(g).forEach((k) => { if (/^\d+$/.test(k) && clampQ(g[k]) > 0) S.cart[k] = clampQ(g[k]); });
  }
  cartRender();
}

function cartPersist(id) {
  const q = clampQ(S.cart[id]);
  if (!S.user) { store.set(GUEST_KEY, S.cart); return; }
  const uid = S.user.id;
  cartQ = cartQ.then(async () => {
    const r = q > 0
      ? await sb.from('cart_items').upsert({ user_id: uid, product_id: Number(id), quantity: q }, { onConflict: 'user_id,product_id' })
      : await sb.from('cart_items').delete().eq('user_id', uid).eq('product_id', Number(id));
    if (r.error) { toast('ذخیره سبد خرید ناموفق بود'); await cartLoad(); }
  });
}
function cartSet(id, q) { S.cart[id] = clampQ(q); if (!S.cart[id]) delete S.cart[id]; cartRender(); cartPersist(id); }

async function cartMergeGuest() {
  const g = store.get(GUEST_KEY);
  if (!g || !S.user) return;
  const ids = Object.keys(g).filter((k) => /^\d+$/.test(k) && S.P.some((p) => String(p.id) === k) && clampQ(g[k]) > 0);
  if (ids.length) {
    const { data } = await sb.from('cart_items').select('product_id,quantity').eq('user_id', S.user.id);
    const cur = {}; (data || []).forEach((r) => { cur[r.product_id] = r.quantity; });
    const rows = ids.map((k) => ({ user_id: S.user.id, product_id: Number(k), quantity: clampQ((cur[k] || 0) + clampQ(g[k])) }));
    const { error } = await sb.from('cart_items').upsert(rows, { onConflict: 'user_id,product_id' });
    if (error) return;
  }
  store.del(GUEST_KEY);
}
function drawer(on) { $('#dr').classList.toggle('on', on); $('#sc2').classList.toggle('on', on); }

/* ---------- auth (Supabase Auth, email + password) ---------- */
let mode = 'in', recovery = false;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function tab(m) {
  mode = m; recovery = false;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === m)));
  $('#authtabs').hidden = false;
  $('#le').hidden = false;
  $('#ln').hidden = m !== 'up';
  $('#lforgot').hidden = m !== 'in';
  $('#lgoogle').hidden = false;
  $('#lp').autocomplete = m === 'up' ? 'new-password' : 'current-password';
  $('#lb').textContent = m === 'up' ? 'ساخت حساب' : 'ورود';
  $('#lt').textContent = m === 'up' ? 'ساخت حساب کاربری' : 'ورود به حساب';
  $('#lp').placeholder = 'حداقل ۸ کاراکتر';
  $('#lnt').textContent = '';
}
function recoveryMode() {
  recovery = true;
  $('#authtabs').hidden = true; $('#ln').hidden = true; $('#le').hidden = true; $('#lforgot').hidden = true; $('#lgoogle').hidden = true;
  $('#lt').textContent = 'تعیین رمز جدید'; $('#lb').textContent = 'ذخیره رمز جدید'; $('#lp').autocomplete = 'new-password';
  $('#lp').placeholder = 'رمز جدید، حداقل ۸ کاراکتر';
  show('login');
}
function who() {
  const nm = S.profile && S.profile.full_name ? S.profile.full_name : (S.user && S.user.email) || '';
  $('#ub').innerHTML = S.user ? '<b>' + esc(nm.charAt(0).toUpperCase()) + '</b>' : ic('user');
  $('#ub').title = S.user ? nm : '';
  $('#authbox').hidden = !!S.user && !recovery;
  $('#acct').hidden = !S.user || recovery;
  $('#acm').textContent = S.user ? (S.profile && S.profile.full_name ? S.profile.full_name + ' · ' : '') + (S.user.email || '') : '';
  const isAdmin = !!(S.profile && S.profile.role === 'admin');
  $('#adminlink').hidden = !isAdmin; $('#fadm').hidden = !isAdmin;
}

function authMsg(err) {
  const m = (err && err.message || '').toLowerCase();
  if (/email not confirmed/.test(m)) return 'ایمیل شما هنوز تایید نشده؛ لینک ارسال‌شده را باز کنید.';
  if (/rate limit|too many|over_email/.test(m)) return 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.';
  if (/password/.test(m) && /(weak|short|least|characters)/.test(m)) return 'رمز عبور ضعیف است؛ حداقل ۸ کاراکتر شامل حرف و عدد.';
  if (/invalid login|invalid credentials/.test(m)) return 'ایمیل یا رمز عبور نادرست است.';
  return 'خطا در انجام عملیات. دوباره تلاش کنید.';
}

$('#lf').onsubmit = async (e) => {
  e.preventDefault();
  const n = $('#lnt'), btn = $('#lb');
  if (!configured) { n.textContent = 'اتصال به سرویس احراز هویت تنظیم نشده است.'; return; }
  const em = $('#lm').value.trim().toLowerCase(), p = $('#lp').value, nm = $('#la').value.trim();
  const strong = p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
  btn.disabled = true; n.textContent = '';
  try {
    if (recovery) {
      if (!strong) { n.textContent = 'رمز جدید حداقل ۸ کاراکتر و شامل حرف و عدد باشد.'; return; }
      const { error } = await sb.auth.updateUser({ password: p });
      if (error) { n.textContent = authMsg(error); return; }
      recovery = false; $('#lf').reset(); tab('in'); who(); toast('رمز عبور تغییر کرد'); show('home');
      return;
    }
    if (mode === 'up' && nm.length < 3) { n.textContent = 'نام کامل را وارد کنید.'; return; }
    if (!EMAIL_RE.test(em)) { n.textContent = 'ایمیل معتبر نیست.'; return; }
    if (mode === 'up' && !strong) { n.textContent = 'رمز عبور حداقل ۸ کاراکتر و شامل حرف و عدد باشد.'; return; }
    if (mode === 'in' && p.length < 8) { n.textContent = 'رمز عبور حداقل ۸ کاراکتر است.'; return; }
    if (mode === 'up') {
      const { data, error } = await sb.auth.signUp({ email: em, password: p, options: { data: { full_name: nm.slice(0, 60) }, emailRedirectTo: location.origin + location.pathname } });
      if (error) { n.textContent = authMsg(error); return; }
      $('#lf').reset();
      if (data.session) { toast('حساب شما ساخته شد'); show('home'); }
      else n.textContent = 'اگر این ایمیل قابل استفاده باشد، لینک تایید برایتان ارسال شد. پس از تایید وارد شوید.';
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email: em, password: p });
    if (error) { n.textContent = authMsg(error); return; }
    $('#lf').reset(); toast('خوش آمدی'); show('home');
  } finally { btn.disabled = false; }
};
$('#lforgot').onclick = async () => {
  const n = $('#lnt'), em = $('#lm').value.trim().toLowerCase();
  if (!configured) return;
  if (!EMAIL_RE.test(em)) { n.textContent = 'ابتدا ایمیل خود را وارد کنید.'; return; }
  await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
  n.textContent = 'اگر این ایمیل ثبت شده باشد، لینک بازیابی رمز ارسال شد.';
};
$('#lgoogle').onclick = async () => {
  const n = $('#lnt');
  if (!configured) { n.textContent = 'اتصال به سرویس احراز هویت تنظیم نشده است.'; return; }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) n.textContent = 'ورود با گوگل در دسترس نیست.';
};
$('#logout').onclick =async () => { await sb.auth.signOut(); toast('خارج شدید'); show('home'); };

async function applySession(session) {
  const prev = S.user && S.user.id;
  S.user = session ? session.user : null;
  if (!S.user) { S.profile = null; S.cart = {}; who(); await cartLoad(); return; }
  if (prev !== S.user.id) {
    const { data } = await sb.from('profiles').select('full_name,role').eq('id', S.user.id).maybeSingle();
    S.profile = data || { full_name: '', role: 'customer' };
    await cartMergeGuest();
    await cartLoad();
  }
  who();
}

/* ---------- reviews (Supabase) ---------- */
async function loadReviews() {
  const box = $('#rl');
  box.querySelectorAll('.rv').forEach((x) => x.remove());
  if (!configured) return;
  const { data, error } = await sb.from('reviews').select('author_name,rating,body').order('created_at', { ascending: false }).limit(30);
  if (error) { $('#re').hidden = false; $('#re').textContent = 'بارگذاری نظرات ناموفق بود.'; return; }
  $('#re').hidden = data.length > 0;
  $('#re').textContent = 'هنوز نظری ثبت نشده. اولین نفر باش.';
  const frag = document.createElement('div');
  frag.innerHTML = data.map((r) => {
    const s = Math.max(1, Math.min(5, Number(r.rating) || 1));
    return '<div class="rv"><header><span>' + esc(r.author_name) + '</span><span class="st">' + '★'.repeat(s) + '☆'.repeat(5 - s) + '</span></header><p>' + esc(r.body) + '</p></div>';
  }).join('');
  while (frag.firstChild) box.appendChild(frag.firstChild);
}
$('#rf').onsubmit = async (e) => {
  e.preventDefault();
  if ($('#hp').value) return;
  const n = $('#rnt');
  if (!configured) { n.textContent = 'اتصال به دیتابیس تنظیم نشده است.'; return; }
  if (!S.user) { toast('برای ثبت نظر ابتدا وارد شوید'); show('login'); return; }
  if (Date.now() - S.lr < 20000) { n.textContent = 'لطفا کمی صبر کنید.'; return; }
  const body = $('#rt').value.trim().slice(0, 300), rating = Number($('#rs').value);
  if (!body || !(rating >= 1 && rating <= 5)) { n.textContent = 'متن نظر را بنویسید.'; return; }
  S.lr = Date.now();
  const { error } = await sb.from('reviews').insert({ user_id: S.user.id, rating, body });
  if (error) { n.textContent = /rate limit/i.test(error.message) ? 'امروز به حد مجاز ثبت نظر رسیده‌اید.' : 'ثبت نظر ناموفق بود.'; return; }
  e.target.reset(); n.textContent = 'نظر شما ثبت شد.';
  loadReviews();
};

/* ---------- blog ---------- */
$('#bl').innerHTML = BL.map((b, i) =>
  '<button class="po2" data-bl="' + i + '" aria-expanded="false"><div class="tile ' + b[0] + '">' + ic(b[1]) + '</div><div class="t"><h3>' + b[2] + '</h3><small>' + b[3] + '</small><p class="x" hidden>' + b[4] + '</p></div></button>').join('');

/* ---------- admin (lazy-loaded; real security is RLS + role + TOTP aal2 in the database) ---------- */
async function openAdmin() {
  if (!configured) { toast('اتصال به دیتابیس تنظیم نشده است'); return; }
  if (!S.user) { toast('ابتدا وارد حساب شوید'); show('login'); return; }
  if (!S.profile || S.profile.role !== 'admin') { toast('دسترسی ندارید'); return; }
  const m = await import('./admin.js');
  m.openAdmin({ sb, S, C, onProducts: async () => { await loadProducts(); cartRender(); grid(); }, onReviews: loadReviews });
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const t = e.target; let b;
  if ((b = t.closest('[data-go]'))) { e.preventDefault(); show(b.dataset.go); if (b.dataset.tab2) tab(b.dataset.tab2); return; }
  if ((b = t.closest('[data-to]'))) { to(b.dataset.to); $('#nav').classList.remove('on'); return; }
  if ((b = t.closest('[data-cat]'))) { pick(b.dataset.cat, b.dataset.sq); return; }
  if ((b = t.closest('[data-chip]'))) { S.cat = b.dataset.chip; S.q = ''; $('#q').value = ''; grid(); return; }
  if ((b = t.closest('[data-add]'))) {
    const id = b.dataset.add; cartSet(id, (S.cart[id] || 0) + 1);
    const bb = $('#cc'); bb.classList.remove('bump'); void bb.offsetWidth; bb.classList.add('bump');
    toast(S.user ? 'به سبد خرید اضافه شد' : 'به سبد اضافه شد؛ برای ذخیره دائمی وارد شوید');
    return;
  }
  if ((b = t.closest('[data-q]'))) { const k = b.dataset.q; cartSet(k, (S.cart[k] || 0) + Number(b.dataset.d)); return; }
  if ((b = t.closest('[data-sl]'))) { go(Number(b.dataset.sl)); auto(); return; }
  if ((b = t.closest('[data-tab]'))) { tab(b.dataset.tab); return; }
  if ((b = t.closest('[data-bl]'))) { const p = b.querySelector('.x'); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); return; }
  if ((b = t.closest('[data-copy]'))) {
    const v = b.dataset.copy;
    try { navigator.clipboard.writeText(v).then(() => toast('کپی شد: ' + v), () => toast(v)); } catch { toast(v); }
    return;
  }
  if ((b = t.closest('[data-msg]'))) { toast(b.dataset.msg); return; }
  if (t.closest('#adminlink')) { openAdmin(); return; }
  if ((b = t.closest('[data-act]'))) {
    const a = b.dataset.act;
    if (a === 'menu') $('#nav').classList.toggle('on');
    else if (a === 'cart') drawer(true);
    else if (a === 'close') drawer(false);
    else if (a === 'support') $('#sp').hidden = !$('#sp').hidden;
    else if (a === 'admin') openAdmin();
    else if (a === 'search') { show('home'); S.cat = 'all'; grid(); to('products'); setTimeout(() => $('#q').focus(), 350); }
    else if (a === 'theme') {
      const r = document.documentElement;
      const c = r.dataset.theme || (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
      const nx = c === 'dark' ? 'light' : 'dark'; r.dataset.theme = nx; store.set('aimo-theme', nx);
    }
    return;
  }
  if (!t.closest('#sp')) $('#sp').hidden = true;
});
// Checkout stays disabled; this handler never reports a payment or creates an order.
$('#co').onclick = () => {
  if (PAYMENTS_ENABLED) return;
  $('#dm').textContent = 'درگاه پرداخت هنوز فعال نیست؛ هیچ سفارشی ثبت نشد.';
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { drawer(false); $('#sp').hidden = true; } });
const th = store.get('aimo-theme'); if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th;

/* ---------- reveal + glow (unchanged) ---------- */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -5% 0px' })
  : null;
function rev(root) {
  let n = 0;
  (root || document).querySelectorAll('.sh,.cb,.cd,.tr,.pm,.sb,.po2,.fq details,.rg>*,.cx').forEach((el) => {
    if (el.classList.contains('rv-in')) return;
    el.classList.add('rv-in'); el.style.setProperty('--d', (n++ % 6) * 60 + 'ms');
    if (io) io.observe(el); else el.classList.add('in');
  });
}
let raf;
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest && e.target.closest('.cd,.cb,.cx,.po2,.sb');
  if (!c || raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}, { passive: true });
addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

/* ---------- boot ---------- */
(async function boot() {
  pills(); grid(); rev(); cartRender(); who();
  if (!configured) {
    const w = document.createElement('div');
    w.className = 'cfgwarn'; w.textContent = 'تنظیمات Supabase کامل نیست؛ ورود، سبد خرید و محصولات تا تکمیل متغیرهای محیطی کار نمی‌کنند.';
    document.body.insertBefore(w, document.body.firstChild);
    S.ready = true; grid(); return;
  }
  sb.auth.onAuthStateChange((ev, session) => {
    // never await Supabase calls inside this callback; defer to avoid auth-lock deadlocks
    setTimeout(async () => {
      if (ev === 'PASSWORD_RECOVERY') { await applySession(session); recoveryMode(); who(); return; }
      if (ev === 'INITIAL_SESSION') return;
      await applySession(session);
      if (ev === 'SIGNED_OUT') cartRender();
    }, 0);
  });
  const { data } = await sb.auth.getSession();
  await loadProducts();
  S.ready = true;
  await applySession(data.session);
  grid(); cartRender(); loadReviews();
  const h = location.hash.slice(1);
  if (h === 'cats' || h === 'login') show(h);
  if (h === 'admin') openAdmin();
})();
