// Shared UI helpers (ported from the original single-file script).
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);
export const fa = (n) => Number(n).toLocaleString('fa-IR');
export const ic = (k) => '<svg class="ic"><use href="#i-' + k + '"/></svg>';
export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => '&#' + c.charCodeAt(0) + ';');

// Persian/Arabic digits -> ASCII
export const dg = (s) =>
  String(s)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

let tt;
export function toast(m) {
  const t = $('#ts');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('on'), 2600);
}

// Local, NON-sensitive storage only (theme + guest cart). Never credentials.
export const store = {
  get(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
  },
  del(k) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
};

// Sliding highlight pills for tab bars / chips / nav (unchanged behaviour).
export function pills() {
  $$('.tb:not([data-p]),.chips:not([data-p]),.nav:not([data-p])').forEach((bx) => {
    bx.dataset.p = 1;
    const hv = bx.classList.contains('nav');
    const pl = document.createElement('i');
    pl.className = 'pl' + (hv ? ' hv' : '');
    bx.insertBefore(pl, bx.firstChild);
    const mv = (t) => {
      const b = t || bx.querySelector('[aria-pressed=true]');
      if (!b || !b.offsetWidth) { pl.style.opacity = 0; return; }
      const f = !pl.dataset.s;
      if (f) pl.style.transition = 'none';
      pl.style.opacity = 1;
      pl.style.width = b.offsetWidth + 'px';
      pl.style.height = b.offsetHeight + 'px';
      pl.style.transform = 'translate3d(' + b.offsetLeft + 'px,' + b.offsetTop + 'px,0)';
      if (f) { pl.dataset.s = 1; void pl.offsetWidth; pl.style.transition = ''; }
    };
    if (hv) {
      bx.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b) mv(b); });
      bx.addEventListener('pointerleave', () => { pl.style.opacity = 0; });
    } else {
      new MutationObserver(() => mv()).observe(bx, { attributes: true, attributeFilter: ['aria-pressed'], subtree: true });
      if (window.ResizeObserver) new ResizeObserver(() => mv()).observe(bx);
      if (document.fonts) document.fonts.ready.then(() => mv());
      mv();
    }
  });
}
