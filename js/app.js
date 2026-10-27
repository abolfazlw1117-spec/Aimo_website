/* aiom.shop - storefront logic (vanilla JS, no build step) */
(function () {
  'use strict';
  var A = window.AIOM;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var fa = function (n) { return Number(n).toLocaleString('fa-IR'); };
  var money = function (n) { return fa(n) + ' تومان'; };
  var byId = {};
  A.PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  /* ---------- state ---------- */
  var state = { fit: 'all', color: 'all', cart: [] };
  try { state.cart = JSON.parse(localStorage.getItem('aiom-cart') || '[]').filter(function (l) { return byId[l.id] && A.COLORS[l.color]; }); } catch (e) { state.cart = []; }
  function save() { try { localStorage.setItem('aiom-cart', JSON.stringify(state.cart)); } catch (e) {} }

  /* ---------- reveal on scroll ---------- */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.style.setProperty('--delay', (en.target.dataset.d || 0) + 'ms');
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
  function watch(root) {
    (root || document).querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    });
  }

  /* ---------- hero ---------- */
  var heroTee = $('#heroTee'), stage = $('#stage'), heroSw = $('#heroSwatches'), heroLabel = $('#heroColorLabel');
  var heroIdx = 0, heroTimer = null;
  heroTee.innerHTML = A.teeSVG({ color: A.COLORS.chalk.hex, fit: 'regular', print: 'wave', label: 'تیشرت aiom' });
  var heroSvg = heroTee.firstChild;

  function setHero(i) {
    heroIdx = i;
    var key = A.COLOR_ORDER[i], c = A.COLORS[key];
    A.setTee(heroSvg, c.hex);
    stage.style.setProperty('--stage', c.field);
    stage.style.setProperty('--on-stage', A.onColor(c.field));
    heroLabel.textContent = 'رنگ: ' + c.name;
    heroSw.querySelectorAll('.sw').forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
  }
  A.COLOR_ORDER.forEach(function (key, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'sw'; b.style.setProperty('--c', A.COLORS[key].hex);
    b.setAttribute('aria-label', A.COLORS[key].name);
    b.addEventListener('click', function () { stopAuto(); setHero(i); });
    heroSw.appendChild(b);
  });
  function stopAuto() { clearInterval(heroTimer); heroTimer = null; }
  setHero(0);
  if (!reduce) heroTimer = setInterval(function () { setHero((heroIdx + 1) % A.COLOR_ORDER.length); }, 3600);

  // gentle pointer parallax on the hero tee (transform only)
  var heroWrap = $('#heroWrap');
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      heroWrap.style.transform = 'translate(' + (x * 16).toFixed(1) + 'px,' + (y * 12).toFixed(1) + 'px) rotate(' + (x * 4).toFixed(2) + 'deg)';
    });
    stage.addEventListener('pointerleave', function () { heroWrap.style.transform = ''; });
    heroWrap.style.transition = 'transform .4s cubic-bezier(.2,.7,.2,1)';
  }

  /* ---------- marquee ---------- */
  var track = $('#track'), cells = '';
  A.PRODUCTS.forEach(function (p) {
    cells += '<div class="cell" style="background:' + p.field + '">' +
      A.teeSVG({ color: A.COLORS[p.colors[0]].hex, fit: p.fit, print: p.print }) + '</div>';
  });
  track.innerHTML = cells + cells;

  /* ---------- filters ---------- */
  var FITS = [['all', 'همه'], ['regular', 'معمولی'], ['oversize', 'اورسایز']];
  var fitChips = $('#fitChips');
  FITS.forEach(function (f) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = f[1]; b.dataset.v = f[0];
    b.setAttribute('aria-pressed', f[0] === 'all' ? 'true' : 'false');
    b.addEventListener('click', function () { state.fit = f[0]; syncFilters(); renderTiles(); });
    fitChips.appendChild(b);
  });
  var colorFilter = $('#colorFilter');
  (function () {
    var all = document.createElement('button');
    all.type = 'button'; all.className = 'sw sw-all'; all.textContent = 'همه‌ی رنگ‌ها'; all.dataset.v = 'all';
    all.setAttribute('aria-pressed', 'true');
    all.addEventListener('click', function () { state.color = 'all'; syncFilters(); renderTiles(); });
    colorFilter.appendChild(all);
    A.COLOR_ORDER.forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.dataset.v = key;
      b.style.setProperty('--c', A.COLORS[key].hex);
      b.setAttribute('aria-label', A.COLORS[key].name); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { state.color = key; syncFilters(); renderTiles(); });
      colorFilter.appendChild(b);
    });
  })();
  function syncFilters() {
    fitChips.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === state.fit)); });
    colorFilter.querySelectorAll('.sw').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === state.color)); });
  }

  /* ---------- tiles ---------- */
  var tiles = $('#tiles');
  var SPANS = [2, 1, 1, 1, 1, 2, 2, 2];
  function renderTiles() {
    var list = A.PRODUCTS.filter(function (p) {
      return (state.fit === 'all' || p.fit === state.fit) && (state.color === 'all' || p.colors.indexOf(state.color) > -1);
    });
    var full = list.length === A.PRODUCTS.length;
    if (!list.length) {
      tiles.innerHTML = '<li class="empty"><p>تیشرتی با این ترکیب پیدا نشد.</p><button class="btn" type="button" id="resetF">نمایش همه</button></li>';
      $('#resetF').addEventListener('click', function () { state.fit = 'all'; state.color = 'all'; syncFilters(); renderTiles(); });
      return;
    }
    tiles.innerHTML = list.map(function (p, i) {
      var key = state.color !== 'all' ? state.color : p.colors[0];
      var field = state.color !== 'all' ? A.COLORS[key].field : p.field;
      var span = full ? SPANS[i] : 1;
      return '<li class="tile' + (span === 2 ? ' wide' : '') + '" style="--span:' + span + '" data-reveal data-d="' + ((i % 4) * 70) + '">' +
        '<button class="tile-btn" type="button" data-id="' + p.id + '" data-color="' + key + '" aria-label="' + p.name + '، ' + money(p.price) + '">' +
        '<span class="tile-field" style="background:' + field + '">' + A.teeSVG({ color: A.COLORS[key].hex, fit: p.fit, print: p.print }) + '</span>' +
        '<span class="tile-meta"><span class="tile-name">' + p.name + '</span><span class="tile-price">' + money(p.price) + '</span></span>' +
        '<span class="tile-sub"><span class="dots">' + p.colors.map(function (k) { return '<i style="--c:' + A.COLORS[k].hex + '"></i>'; }).join('') + '</span>' +
        '<span>' + (p.fit === 'oversize' ? 'اورسایز' : 'معمولی') + '</span></span>' +
        '</button></li>';
    }).join('');
    watch(tiles);
  }
  tiles.addEventListener('click', function (e) {
    var b = e.target.closest('.tile-btn'); if (!b) return;
    openProduct(b.dataset.id, b.dataset.color, b);
  });

  /* ---------- size table ---------- */
  $('#sizeBody').innerHTML = A.SIZE_TABLE.map(function (r) {
    return '<tr><td>' + r.size + '</td><td>' + fa(r.chest) + ' سانتی‌متر</td><td>' + fa(r.length) + ' سانتی‌متر</td></tr>';
  }).join('');

  /* ---------- dialogs ---------- */
  var pd = $('#pdialog'), cart = $('#cart'), lastFocus = null;
  function openDialog(d, from) {
    lastFocus = from || document.activeElement;
    if (!d.open) d.showModal();
    document.documentElement.classList.add('lock');
  }
  function closeDialog(d) { if (d.open) d.close(); }
  [pd, cart].forEach(function (d) {
    d.addEventListener('close', function () {
      if (!pd.open && !cart.open) document.documentElement.classList.remove('lock');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) closeDialog(d);
    });
  });

  function openProduct(id, colorKey, from) {
    var p = byId[id], color = colorKey, size = null;
    pd.setAttribute('aria-labelledby', 'pdTitle');
    pd.innerHTML =
      '<div class="pd-stage" id="pdStage"><div class="pd-tee">' + A.teeSVG({ color: A.COLORS[color].hex, fit: p.fit, print: p.print, label: p.name }) + '</div></div>' +
      '<div class="pd-info">' +
        '<button class="x" type="button" data-close aria-label="بستن"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></button>' +
        '<h2 id="pdTitle">' + p.name + '</h2>' +
        '<p class="pd-price">' + money(p.price) + '</p>' +
        '<p>' + p.desc + '</p>' +
        '<fieldset><legend>رنگ: <span id="pdColorName">' + A.COLORS[color].name + '</span></legend><div class="sws" id="pdColors"></div></fieldset>' +
        '<fieldset><legend>سایز</legend><div class="sizes" id="pdSizes"></div></fieldset>' +
        '<p class="err" id="pdErr" role="alert"></p>' +
        '<button class="btn btn-wide" type="button" id="pdAdd">افزودن به سبد</button>' +
        '<p class="pd-note">برش ' + (p.fit === 'oversize' ? 'اورسایز؛ اگر بین دو سایز ماندی، همان سایز همیشگی‌ات را بگیر.' : 'معمولی؛ اگر بین دو سایز ماندی، سایز بالاتر راحت‌تر است.') + '</p>' +
      '</div>';

    var svg = $('.tee', pd), stg = $('#pdStage', pd);
    function paint() {
      A.setTee(svg, A.COLORS[color].hex);
      stg.style.setProperty('--stage', A.COLORS[color].field);
      $('#pdColorName', pd).textContent = A.COLORS[color].name;
      $('#pdColors', pd).querySelectorAll('.sw').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === color)); });
    }
    p.colors.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.dataset.k = k; b.style.setProperty('--c', A.COLORS[k].hex);
      b.setAttribute('aria-label', A.COLORS[k].name);
      b.addEventListener('click', function () { color = k; paint(); });
      $('#pdColors', pd).appendChild(b);
    });
    A.SIZES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'size-btn'; b.textContent = s; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        size = s; $('#pdErr', pd).textContent = '';
        $('#pdSizes', pd).querySelectorAll('.size-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      $('#pdSizes', pd).appendChild(b);
    });
    $('#pdAdd', pd).addEventListener('click', function () {
      if (!size) {
        var err = $('#pdErr', pd), sz = $('#pdSizes', pd);
        err.textContent = 'اول یک سایز انتخاب کن.';
        sz.classList.remove('shake'); void sz.offsetWidth; sz.classList.add('shake');
        return;
      }
      addToCart(p.id, color, size);
      closeDialog(pd);
      renderCart(true);
      openDialog(cart, $('#cartBtn'));
    });
    paint();
    openDialog(pd, from);
  }

  /* ---------- cart ---------- */
  var cartCount = $('#cartCount'), cartBody = $('#cartBody'), cartFoot = $('#cartFoot');
  function addToCart(id, color, size) {
    var f = state.cart.filter(function (l) { return l.id === id && l.color === color && l.size === size; })[0];
    if (f) f.qty = Math.min(20, f.qty + 1); else state.cart.push({ id: id, color: color, size: size, qty: 1 });
    state.lastAdded = id + color + size;
    save();
  }
  function total() { return state.cart.reduce(function (s, l) { return s + byId[l.id].price * l.qty; }, 0); }
  function count() { return state.cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  function orderMail() {
    var lines = state.cart.map(function (l, i) {
      var p = byId[l.id];
      return (i + 1) + '. ' + p.name + ' | رنگ: ' + A.COLORS[l.color].name + ' | سایز: ' + l.size + ' | تعداد: ' + l.qty + ' | ' + money(p.price * l.qty);
    });
    var body = 'سلام،\nمی‌خواهم این سفارش را ثبت کنم:\n\n' + lines.join('\n') + '\n\nجمع کل: ' + money(total()) +
      '\n\nنام و نام خانوادگی:\nآدرس کامل:\nشماره‌ی تماس:\n';
    return 'mailto:hello@aiom.shop?subject=' + encodeURIComponent('سفارش جدید از aiom.shop') + '&body=' + encodeURIComponent(body);
  }

  function renderCart(animateLast) {
    var n = count();
    var prev = cartCount.textContent;
    cartCount.textContent = fa(n);
    if (prev !== cartCount.textContent && animateLast) { cartCount.classList.remove('bump'); void cartCount.offsetWidth; cartCount.classList.add('bump'); }
    if (!state.cart.length) {
      cartBody.innerHTML = '<div class="cart-empty"><p>سبد خرید خالی است.</p><button class="btn" type="button" data-close>دیدن محصولات</button></div>';
      cartFoot.innerHTML = '';
      cartFoot.hidden = true;
      return;
    }
    cartFoot.hidden = false;
    cartBody.innerHTML = state.cart.map(function (l, i) {
      var p = byId[l.id], c = A.COLORS[l.color];
      var isNew = animateLast && state.lastAdded === l.id + l.color + l.size;
      return '<div class="line' + (isNew ? ' new' : '') + '">' +
        '<div class="line-tee" style="--lf:' + c.field + '">' + A.teeSVG({ color: c.hex, fit: p.fit, print: p.print }) + '</div>' +
        '<div><p class="line-name">' + p.name + '</p><p class="line-sub">' + c.name + ' · ' + l.size + '</p>' +
        '<div class="qty"><button type="button" data-act="dec" data-i="' + i + '" aria-label="کم کردن تعداد">−</button><output aria-live="polite">' + fa(l.qty) + '</output><button type="button" data-act="inc" data-i="' + i + '" aria-label="زیاد کردن تعداد">+</button></div></div>' +
        '<div class="line-price"><span>' + money(p.price * l.qty) + '</span><button class="rm" type="button" data-act="rm" data-i="' + i + '" aria-label="حذف ' + p.name + '">×</button></div>' +
      '</div>';
    }).join('');
    cartFoot.innerHTML =
      '<div class="cart-total"><span>جمع کل</span><span>' + money(total()) + '</span></div>' +
      '<a class="btn btn-wide" id="checkout" href="' + orderMail() + '">ثبت سفارش</a>' +
      '<p class="pd-note">با زدن این دکمه، ایمیلی با جزئیات سفارشت آماده می‌شود. پرداخت و ارسال را با هم هماهنگ می‌کنیم.</p>';
  }
  cartBody.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var i = +b.dataset.i, l = state.cart[i]; if (!l) return;
    if (b.dataset.act === 'inc') l.qty = Math.min(20, l.qty + 1);
    if (b.dataset.act === 'dec') l.qty -= 1;
    if (b.dataset.act === 'rm') l.qty = 0;
    state.cart = state.cart.filter(function (x) { return x.qty > 0; });
    state.lastAdded = null;
    save(); renderCart(false);
  });
  $('#cartBtn').addEventListener('click', function () { renderCart(false); openDialog(cart, this); });

  /* ---------- init ---------- */
  renderTiles();
  renderCart(false);
  watch(document);
})();
