/* aiom.shop - data + tee drawing helpers (no dependencies) */
(function (w) {
  'use strict';

  var COLORS = {
    chalk:  { name: 'گچی',     hex: '#F5F5F1', field: '#E4472B' },
    ink:    { name: 'مشکی',    hex: '#141414', field: '#D8C8A8' },
    tomato: { name: 'گوجه‌ای', hex: '#E4472B', field: '#A9CBE8' },
    moss:   { name: 'خزه‌ای',  hex: '#44603C', field: '#E6E6E1' },
    sky:    { name: 'آسمانی',  hex: '#A9CBE8', field: '#44603C' },
    sand:   { name: 'شنی',     hex: '#D8C8A8', field: '#141414' }
  };
  var COLOR_ORDER = ['chalk', 'ink', 'tomato', 'moss', 'sky', 'sand'];
  var SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  var SIZE_TABLE = [
    { size: 'S',   chest: 52, length: 70 },
    { size: 'M',   chest: 54, length: 72 },
    { size: 'L',   chest: 56, length: 74 },
    { size: 'XL',  chest: 58, length: 76 },
    { size: 'XXL', chest: 60, length: 78 },
    { size: '3XL', chest: 62, length: 80 }
  ];

  /* Sample catalogue: names, prices and descriptions are placeholders to be confirmed. */
  var PRODUCTS = [
    { id: 'basic',   name: 'بیسیک سنگین', price: 790000, fit: 'regular',  print: 'basic',
      colors: ['ink', 'chalk', 'tomato', 'moss', 'sky', 'sand'], field: '#D9D9D3',
      desc: 'ساده‌ترین تیشرت کمدت؛ پنبه‌ی سنگین، یقه‌ی محکم و یک نشان کوچک روی سینه.' },
    { id: 'wave',    name: 'موج',          price: 890000, fit: 'regular',  print: 'wave',
      colors: ['chalk', 'ink', 'sky', 'sand'], field: '#D8C8A8',
      desc: 'سه خط موج که از روی سینه رد می‌شوند. آرام، تمیز و قابل ست با همه‌چیز.' },
    { id: 'horizon', name: 'افق',          price: 890000, fit: 'oversize', print: 'horizon',
      colors: ['ink', 'tomato', 'sand'], field: '#E4472B',
      desc: 'خورشیدی که روی افق نشسته. برش اورسایز با شانه‌ی افتاده.' },
    { id: 'signal',  name: 'سیگنال',       price: 940000, fit: 'regular',  print: 'signal',
      colors: ['moss', 'chalk', 'ink'], field: '#A9CBE8',
      desc: 'دایره‌های هم‌مرکز، مثل موجی که از یک نقطه پخش می‌شود.' },
    { id: 'blocks',  name: 'بلوک',         price: 940000, fit: 'oversize', print: 'blocks',
      colors: ['tomato', 'chalk', 'sky'], field: '#141414',
      desc: 'سه شکل هندسی ساده روی سینه؛ برای کسی که طرح‌های شلوغ دوست ندارد.' },
    { id: 'cloud',   name: 'ابر',          price: 890000, fit: 'regular',  print: 'cloud',
      colors: ['sky', 'chalk', 'sand'], field: '#44603C',
      desc: 'ابری سبک روی پارچه‌ای سنگین. تضادی که دوستش خواهی داشت.' },
    { id: 'dots',    name: 'نقطه',         price: 840000, fit: 'oversize', print: 'dots',
      colors: ['ink', 'moss', 'chalk'], field: '#E4472B',
      desc: 'شبکه‌ای از نقطه‌ها که از وسط بزرگ و به کنار کوچک می‌شود.' },
    { id: 'arch',    name: 'طاق',          price: 990000, fit: 'regular',  print: 'arch',
      colors: ['ink', 'sand', 'tomato', 'moss'], field: '#A9CBE8',
      desc: 'سه طاق تو در تو؛ الهام‌گرفته از قوس‌های معماری.' }
  ];

  /* ---- colour helpers ---- */
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lum(hex) {
    var c = rgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColor(hex) { return lum(hex) > 0.3 ? '#141414' : '#F5F5F1'; }
  function shade(hex, pct) {
    pct = pct == null ? 0.14 : pct;
    var c = rgb(hex).map(function (v) { return Math.round(v * (1 - pct)); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* ---- tee drawing ---- */
  var PATH_REG  = 'M150 40L74 66L20 156L80 186L102 166L106 410H294L298 166L320 186L380 156L326 66L250 40Q200 100 150 40Z';
  var PATH_OVER = 'M150 40L82 64L26 168L86 198L98 178L92 412H308L302 178L314 198L374 168L318 64L250 40Q200 100 150 40Z';

  function printMarkup(kind) {
    switch (kind) {
      case 'basic':
        return '<text class="pf" x="258" y="150" font-size="17" font-weight="800" text-anchor="middle" direction="ltr" font-family="Vazirmatn,Tahoma,sans-serif">aiom</text>';
      case 'wave':
        return [190, 218, 246].map(function (y) {
          return '<path class="ps" d="M140 ' + y + ' q15 -22 30 0 t30 0 t30 0 t30 0"/>';
        }).join('');
      case 'horizon':
        return '<path class="pf" d="M156 226a44 44 0 0 1 88 0Z"/>' +
               '<rect class="pf" x="146" y="238" width="108" height="8" rx="4"/>' +
               '<rect class="pf" x="162" y="254" width="76" height="8" rx="4"/>' +
               '<rect class="pf" x="178" y="270" width="44" height="8" rx="4"/>';
      case 'signal':
        return '<circle class="pf" cx="200" cy="226" r="13"/>' +
               '<circle class="ps" style="stroke-width:6" cx="200" cy="226" r="29"/>' +
               '<circle class="ps" style="stroke-width:6" cx="200" cy="226" r="45"/>';
      case 'blocks':
        return '<rect class="pf" x="148" y="184" width="50" height="50"/>' +
               '<circle class="pf" cx="228" cy="209" r="25"/>' +
               '<rect class="pf" x="148" y="244" width="104" height="26"/>';
      case 'cloud':
        return '<circle class="pf" cx="176" cy="226" r="26"/>' +
               '<circle class="pf" cx="207" cy="212" r="32"/>' +
               '<circle class="pf" cx="238" cy="230" r="22"/>' +
               '<rect class="pf" x="150" y="236" width="102" height="20" rx="10"/>';
      case 'dots':
        var out = '';
        for (var i = 0; i < 5; i++) {
          for (var j = 0; j < 5; j++) {
            var dx = i - 2, dy = j - 2;
            var r = Math.max(2.5, 10 - Math.sqrt(dx * dx + dy * dy) * 3.2);
            out += '<circle class="pf" cx="' + (152 + i * 24) + '" cy="' + (178 + j * 24) + '" r="' + r.toFixed(1) + '"/>';
          }
        }
        return out;
      case 'arch':
        return '<path class="ps" d="M154 272v-42a46 46 0 0 1 92 0v42"/>' +
               '<path class="ps" d="M174 272v-36a26 26 0 0 1 52 0v36"/>' +
               '<path class="pf" d="M190 272v-28a10 10 0 0 1 20 0v28Z"/>';
      default:
        return '';
    }
  }

  function teeSVG(o) {
    var c = o.color, over = o.fit === 'oversize';
    var hem = over ? 'M92 398H308V412H92Z' : 'M106 396H294V410H106Z';
    var style = '--tee:' + c + ';--shade:' + shade(c) + ';--print:' + onColor(c);
    var label = o.label ? ' role="img" aria-label="' + o.label + '"' : ' aria-hidden="true"';
    return '<svg class="tee" viewBox="0 0 400 440"' + label + ' style="' + style + '" focusable="false">' +
      '<path class="tee-body" d="' + (over ? PATH_OVER : PATH_REG) + '"/>' +
      '<path class="tee-shade" d="' + hem + '"/>' +
      '<path class="tee-shade" d="M150 40Q200 100 250 40Q200 64 150 40Z"/>' +
      printMarkup(o.print) + '</svg>';
  }

  function setTee(svg, hex) {
    svg.style.setProperty('--tee', hex);
    svg.style.setProperty('--shade', shade(hex));
    svg.style.setProperty('--print', onColor(hex));
  }

  w.AIOM = {
    COLORS: COLORS, COLOR_ORDER: COLOR_ORDER, SIZES: SIZES, SIZE_TABLE: SIZE_TABLE,
    PRODUCTS: PRODUCTS, teeSVG: teeSVG, setTee: setTee, onColor: onColor
  };
})(window);
