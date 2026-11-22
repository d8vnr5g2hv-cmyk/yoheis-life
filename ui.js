// ============================================================
// Yohei's Life — UIキット（音・画面切り替え・ポップアップ・通知・数字）
// ============================================================
const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- アイコン（線画） ----------
  const P = {
    back:'<path d="M15 5l-7 7 7 7M8 12h12"/>',
    home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    talk:'<path d="M4 6h16v10H10l-4 4v-4H4z"/><path d="M8 10h8M8 13h5"/>',
    task:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4v2h6V4M8 11l2 2 4-4M8 17h8"/>',
    plan:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3"/>',
    book:'<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11M9 8h6"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    phone:'<path d="M6 3h3l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v3a3 3 0 01-3 3A16 16 0 013 6a3 3 0 013-3z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    yen:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 9l3 3 3-3M12 12v4M9.5 13.5h5"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    bell:'<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
    expand:'<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    image:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.8"/><path d="M20 15l-5-5-9 9"/>',
    up:'<path d="M6 15l6-6 6 6"/>',
    s:'<path d="M16 6.5C15 5 13.6 4.3 12 4.3c-2.4 0-4 1.3-4 3.2 0 4.4 8.4 2.6 8.4 7.4 0 2.3-1.9 3.8-4.6 3.8-1.9 0-3.6-.8-4.6-2.3"/>',
  };
  const icon = (n, s = 24, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const paintIcons = (root = document) => $$('[data-ic]', root).forEach(e => { if (!e.dataset.done) { e.insertAdjacentHTML('afterbegin', icon(e.dataset.ic, +e.dataset.s || 24, +e.dataset.w || 2.2)); e.dataset.done = 1; } });

  // ---------- 音（タップ音は合成、BGM・ボイスはファイル） ----------
  let ac = null, bgm = null, muted = false;
  const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(f1, f2, dur, vol = .06, type = 'sine') {
    if (muted) return;
    try {
      const c = ctx(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  }
  const se = {
    tap:  () => tone(1650, 1100, .06, .05),
    ok:   () => { tone(1100, 1500, .07, .05); setTimeout(() => tone(1500, 2100, .09, .045), 55); },
    open: () => tone(700, 1300, .12, .05, 'triangle'),
    close:() => tone(1200, 650, .1, .045, 'triangle'),
    wipe: () => tone(380, 1500, .22, .03, 'sawtooth'),
    start:() => { tone(880, 1760, .18, .06, 'triangle'); setTimeout(() => tone(1320, 2640, .25, .05, 'triangle'), 90); },
  };
  function playBgm(src, vol = .45) {
    if (bgm && bgm.dataset.src === src) return;
    if (bgm) { const old = bgm; fadeTo(old, 0, 500, () => old.pause()); }
    bgm = new Audio(src); bgm.dataset.src = src; bgm.loop = true; bgm.volume = 0; bgm.muted = muted;
    bgm.play().then(() => fadeTo(bgm, vol, 700)).catch(() => {});
  }
  function fadeTo(a, v, ms, done) {
    const s = a.volume, t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / ms); a.volume = s + (v - s) * k; k < 1 ? requestAnimationFrame(step) : done && done(); })(t0);
  }
  let voice = null;
  function playVoice(src) { if (muted) return; try { voice && voice.pause(); voice = new Audio(src); voice.volume = .9; voice.play().catch(() => {}); } catch (e) {} }
  function mute(v) { muted = v; if (bgm) bgm.muted = v; }

  // ---------- 押したときのキラッ ----------
  function sparkle(x, y) {
    const s = document.createElement('i'); s.className = 'sparkle'; s.style.left = (x - 9) + 'px'; s.style.top = (y - 9) + 'px';
    document.body.appendChild(s); setTimeout(() => s.remove(), 650);
  }

  // ---------- 斜めの画面切り替え ----------
  let busy = false;
  function wipe(swap) {
    if (busy) return Promise.resolve(); busy = true;
    const w = document.createElement('div'); w.className = 'wipe'; w.innerHTML = '<i></i><i></i><i></i>';
    document.body.appendChild(w); se.wipe();
    requestAnimationFrame(() => w.classList.add('in'));
    return new Promise(res => setTimeout(() => {
      swap && swap();
      w.classList.remove('in'); void w.offsetWidth; w.classList.add('out');
      setTimeout(() => { w.remove(); busy = false; res(); }, 470);
    }, 400));
  }
  function show(id, { anim = true, before } = {}) {
    const go = () => { before && before(); $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); rise($('#' + id)); };
    return anim ? wipe(go) : (go(), Promise.resolve());
  }

  // ---------- 順番に出てくる ----------
  function rise(root) {
    $$('.rise', root).forEach((e, i) => { e.classList.remove('go'); e.style.animationDelay = (i * 45) + 'ms'; void e.offsetWidth; e.classList.add('go'); });
    $$('[data-count]', root).forEach(countUp);
    $$('.gauge i[data-to]', root).forEach(g => { g.style.width = 0; setTimeout(() => g.style.width = g.dataset.to + '%', 120); });
  }

  // ---------- 金額のカウントアップ ----------
  function countUp(el) {
    const to = +el.dataset.count, ms = 900, t0 = performance.now(), pre = el.dataset.pre || '';
    (function step(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + Math.round(to * e).toLocaleString('ja-JP'); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  // ---------- ポップアップ ----------
  function pop({ title, body, buttons = [{ label: 'OK' }] }) {
    const d = document.createElement('div'); d.className = 'scrim';
    d.innerHTML = `<div class="pop" role="dialog" aria-label="${title}"><div class="ph"><h2>${title}</h2><button class="x" aria-label="閉じる">${icon('x', 30, 2.6)}</button></div>
      <div class="pb">${body}</div><div class="pf">${buttons.map((b, i) => `<button class="bt ${b.cls || ''}" data-i="${i}"><span>${b.label}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(d); se.open(); paintIcons(d);
    const close = () => { se.close(); d.style.transition = 'opacity .16s'; d.style.opacity = 0; setTimeout(() => d.remove(), 170); };
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('.x')) return close();
      const b = e.target.closest('[data-i]'); if (b) { se.ok(); const f = buttons[+b.dataset.i].onClick; if (f && f(d) === false) return; close(); }
    });
    d.close = close; return d;
  }

  // ---------- 通知 ----------
  let tt;
  function toast({ who = 'ミカ', av = 'av_mika.webp', text }) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = `<img src="${av}" alt=""><div><b>${who}</b><p>${text}</p></div>`;
    se.open(); requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600);
  }

  // ---------- 全体のタップ反応 ----------
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button,label.wth,[data-tap]');
    if (b && !b.closest('.scrim')) { se.tap(); sparkle(e.clientX, e.clientY); }
  }, { passive: true });

  return { $, $$, icon, paintIcons, se, playBgm, playVoice, mute, wipe, show, rise, countUp, pop, toast, sparkle };
})();
