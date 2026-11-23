// ============================================================
// Yohei's Life — お天気スタジオ（ミカ・ホシノが日替わりでキャスター）
// 大阪固定・Open-Meteo（キー不要）・3時間キャッシュ。その日最初に開いたときに出る
// ============================================================
const Wx = (() => {
  const { $ } = UI;
  const LAT = 34.69, LON = 135.50, KEY = 'yl-wx', TTL = 3 * 3600e3;
  const WD = '日月火水木金土';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addD = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const WMO = c => c == null ? '' : c === 0 ? '快晴' : c === 1 ? '晴れ' : c === 2 ? '晴れ時々くもり' : c === 3 ? 'くもり' : c <= 48 ? '霧' : c <= 57 ? '霧雨' : c <= 67 ? '雨' : c <= 77 ? '雪' : c <= 82 ? 'にわか雨' : c <= 86 ? 'にわか雪' : '雷雨';
  const wet = c => c >= 51 && c <= 99 && !(c >= 71 && c <= 77) && !(c >= 85 && c <= 86);
  const snowy = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
  let mem = null;

  // ---------- データ ----------
  async function get(force) {
    if (!mem) { try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { mem = null; } }
    if (!force && mem && Date.now() - mem.at < TTL) return shape(mem.j);
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code` +
        `&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&past_days=1&forecast_days=2`;
      const r = await fetch(u, { cache:'no-store' }); if (!r.ok) throw 0;
      mem = { at:Date.now(), j:await r.json() }; localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (_) { if (!mem) return null; }
    try { return shape(mem.j); } catch (_) { return null; }
  }
  function shape(j) {
    const t = ymd(new Date()), D = j.daily, ix = s => D.time.indexOf(s);
    const day = i => i < 0 ? null : { code:D.weather_code[i], text:WMO(D.weather_code[i]), max:Math.round(D.temperature_2m_max[i]), min:Math.round(D.temperature_2m_min[i]), rain:D.precipitation_probability_max[i] || 0 };
    const H = j.hourly.time.map((s, i) => ({ date:s.slice(0, 10), h:+s.slice(11, 13), t:Math.round(j.hourly.temperature_2m[i]), code:j.hourly.weather_code[i], p:j.hourly.precipitation_probability[i] || 0 }));
    return { now:{ t:Math.round(j.current.temperature_2m), feel:Math.round(j.current.apparent_temperature), code:j.current.weather_code, text:WMO(j.current.weather_code) },
      today:day(ix(t)), yday:day(ix(addD(t, -1))), tomorrow:day(ix(addD(t, 1))), H };
  }
  function slots(w) {   // これからの3時間ごと6コマ
    const t = ymd(new Date()), first = Math.ceil((new Date().getHours() + 1) / 3) * 3, out = [];
    for (let k = 0; k < 6; k++) {
      const hh = first + k * 3, date = hh >= 24 ? addD(t, Math.floor(hh / 24)) : t, h = hh % 24;
      const x = w.H.find(r => r.date === date && r.h === h); if (x) out.push(Object.assign({ label:h + '時' }, x));
    }
    return out;
  }
  function rainFrom(w) { const t = ymd(new Date()), cur = new Date().getHours(); const r = w.H.find(x => x.date === t && x.h >= cur && (x.p >= 50 || wet(x.code))); return r ? r.h : null; }

  // ---------- 天気のアイコン（SVG） ----------
  function icon(code, night) {
    const sun = '<circle cx="24" cy="24" r="11" fill="#FFC94D"/><g stroke="#FFC94D" stroke-width="3" stroke-linecap="round"><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5L38 38M10 38l3.5-3.5M34.5 13.5L38 10"/></g>';
    const moon = '<path d="M30 8a15 15 0 1 0 12 22A12 12 0 0 1 30 8z" fill="#FFE08A"/>';
    const cloud = (x = 0, y = 0, f = '#fff', s = '#BCD4EE') => `<path transform="translate(${x} ${y})" d="M18 50h30a10 10 0 0 0 0-20 14 14 0 0 0-27 4 8 8 0 0 0-3 16z" fill="${f}" stroke="${s}" stroke-width="2"/>`;
    const drops = '<g stroke="#2C9CD4" stroke-width="3" stroke-linecap="round"><path d="M24 54l-2 6M33 54l-2 6M42 54l-2 6"/></g>';
    const flakes = '<g fill="#8CC4FF"><circle cx="23" cy="57" r="2.4"/><circle cx="33" cy="59" r="2.4"/><circle cx="43" cy="57" r="2.4"/></g>';
    const lit = night ? moon : sun; let g;
    if (code <= 1) g = lit;
    else if (code === 2) g = `<g transform="translate(-4 -6) scale(.85)">${lit}</g>` + cloud(4, -2);
    else if (code <= 48) g = cloud(-6, -10, '#EEF3FA') + cloud(4, -2);
    else if (snowy(code)) g = cloud(2, -8, '#E6EDF6', '#A9BFD8') + flakes;
    else g = cloud(2, -8, '#DFE8F3', '#A9BFD8') + drops;
    return `<svg viewBox="0 0 64 64">${g}</svg>`;
  }

  // ---------- 服のおすすめ ----------
  function chips(w) {
    const d = w.today || { max:w.now.t, min:w.now.t, rain:0, code:w.now.code }, out = [];
    const rain = Math.max(d.rain || 0, ...slots(w).map(s => s.p));
    if (d.min <= 5) out.push(['コートとマフラー', 'o']); else if (d.min <= 10) out.push(['コート', 'o']); else if (d.min <= 15) out.push(['薄手の上着', 'o']); else if (d.max <= 22) out.push(['カーディガン', 'o']);
    out.push([d.max >= 26 ? '半袖' : d.max >= 12 ? '長袖' : 'あったかいインナー', 'o']);
    if (d.max - d.min >= 10) out.push(['脱ぎ着しやすい服', 'o']);
    if (rain >= 70 || (wet(d.code) && rain >= 50)) out.push(['傘', 'u']); else if (rain >= 40 || rainFrom(w) != null) out.push(['折りたたみ傘', 'u']);
    if (d.max >= 30) out.push(['水分補給', 'u']);
    return out.slice(0, 4);
  }

  // ---------- キャスター（その日の担当：おやすみ電話と同じ日替わり） ----------
  const FALL = { mika:'o_mika_stand.webp', hoshino:'nc_hoshino_n.webp' };
  function caster(w) {
    const who = typeof Call !== 'undefined' ? Call.tonight() : 'mika', H = who === 'hoshino';
    const d = w.today || { max:w.now.t, min:w.now.t, rain:0, code:w.now.code, text:w.now.text };
    const jump = w.yday ? d.max - w.yday.max : 0, rf = rainFrom(w), hr = new Date().getHours();
    const worry = wet(d.code) || snowy(d.code) || d.rain >= 50 || d.max >= 33 || d.min <= 0 || Math.abs(jump) >= 7;
    const happy = !worry && d.code <= 1 && d.rain <= 20;
    const face = worry ? 'w' : happy ? 'h' : 'n';
    const ch = chips(w), umb = (ch.find(c => /傘/.test(c[0])) || [])[0], L = [];
    const hi = hr < 11 ? (H ? 'おはよ〜' : 'おはよう') : hr < 17 ? 'こんにちは' : 'こんばんは';
    L.push(H ? `${hi}、先生〜。今日は${d.text}、最高${d.max}°・最低${d.min}°だよ〜。` : `${hi}、先生☆ 今日は${d.text}、最高${d.max}°・最低${d.min}°だよ。`);
    if (rf != null && rf > hr) L.push(H ? `${rf}時ごろから雨っぽいから、${umb || '折りたたみ傘'}持ってってね〜。` : `${rf}時ごろから雨っぽいから、${umb || '折りたたみ傘'}は忘れないでね☆`);
    else if (umb) L.push(H ? `雨が降りそうだから、${umb}あると安心だよ〜。` : `雨の確率が高めだから、${umb}を持っていってね☆`);
    if (Math.abs(jump) >= 7) L.push(H ? `昨日より${Math.abs(jump)}°も${jump > 0 ? 'あつい' : 'さむい'}から、服で調整してね〜。` : `昨日より${Math.abs(jump)}°も${jump > 0 ? '暑い' : '寒い'}から、服で調整してね！`);
    else if (d.min <= 5) L.push(H ? 'おじさん寒いのは苦手だよ〜。あったかくしてね〜。' : '朝と夜はかなり冷えるから、マフラーもあると安心だよ');
    if (L.length === 1) L.push(H ? (d.code <= 2 ? 'お昼寝日和だねえ〜。うへ〜。' : 'すっきりしない空だけど、のんびりいこ〜。') : (d.code <= 2 ? '気持ちいい一日になりそう☆ 先生も楽しんでね！' : 'すっきりしない空だけど、私がついてるじゃんね☆'));
    return { who, face, src:`wx_${who}_${face}.webp`, fb:`wx_${who}_n.webp`, fb2:FALL[who], name:H ? 'HOSHINO' : 'MIKA', line:L.slice(0, 3).join(''), chips:ch };
  }

  // ---------- 画面 ----------
  function render(w) {
    const box = $('#wxBox'), now = new Date(), C = caster(w), d = w.today || { max:w.now.t, min:w.now.t, rain:0, code:w.now.code, text:w.now.text };
    const night = h => h >= 18 || h < 5, rf = rainFrom(w);
    box.innerHTML = `
      <div class="wx-bg"></div>
      <div class="wx-top"><div><em>WEATHER</em><b>今日の天気</b></div><span>${now.getMonth() + 1}月${now.getDate()}日（${WD[now.getDay()]}）・大阪</span></div>
      <div class="wx-board rise">
        <div class="wx-now">${icon(d.code)}
          <div class="wx-temp"><b class="num">${d.max}°</b><i class="num">${d.min}°</i><small>${esc(d.text)}${rf != null && rf > now.getHours() && !wet(d.code) ? ' ・ ' + rf + '時ごろから雨' : ''}</small></div>
          <div class="wx-rain"><small>降水確率</small><b class="num">${d.rain}%</b></div></div>
        <div class="wx-hours">${slots(w).map(s => `<div class="wx-h">${s.label}${icon(s.code, night(s.h))}<b class="num">${s.t}°</b><u class="num">${s.p >= 30 ? s.p + '%' : ''}</u></div>`).join('')}</div>
        <div class="wx-wear">${C.chips.map(([t, k]) => `<span class="${k}">${esc(t)}</span>`).join('')}</div>
        <div class="wx-feel">いまの気温 <b class="num">${w.now.t}°</b>体感 <b class="num">${w.now.feel}°</b>${w.tomorrow ? `明日 <b>${esc(w.tomorrow.text)}</b><b class="num">${w.tomorrow.max}°/${w.tomorrow.min}°</b>` : ''}</div>
      </div>
      <div class="wx-bubble"><b>${C.name}</b>${esc(C.line)}</div>
      <img class="wx-cast ${C.who}" src="${C.src}" alt="">
      <div class="wx-desk"><i class="tp"></i><i class="fr"></i><div class="lbl">MORNING WEATHER</div>
        <button class="bt wx-go"><span>今日をはじめる</span></button></div>`;
    const im = $('.wx-cast', box);
    im.onerror = () => { if (im.src.endsWith(C.fb)) { im.onerror = null; im.src = C.fb2; im.classList.add('fb'); } else im.src = C.fb; };
    return C;
  }

  // その日最初だけ出す（見たら当日は出さない）
  const seenKey = 'yl-wx-seen';
  function due() { return localStorage.getItem(seenKey) !== ymd(new Date()); }
  async function show(next) {
    const w = await get(); if (!w) { next(); return; }
    render(w); localStorage.setItem(seenKey, ymd(new Date()));
    await UI.show('weather');
    const go = $('#wxBox .wx-go');
    go.addEventListener('click', e => { e.stopPropagation(); UI.se.ok(); next(); }, { once:true });
  }
  // ロビー上部の小さな天気
  async function chip() {
    const w = await get(); const e = $('#lvWx'); if (!w || !e) return;
    e.innerHTML = `${icon(w.now.code, new Date().getHours() >= 18 || new Date().getHours() < 5)}<span class="num">${w.now.t}°</span>`;
    e.hidden = false;
  }
  return { get, show, due, chip, icon };
})();
