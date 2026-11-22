// ============================================================
// Yohei's Life — 壁紙（取り込み・位置合わせ・ランダム表示）
// 画像は端末の IndexedDB に元のサイズのまま保存する
// ============================================================
const Wall = (() => {
  const DEF = [
    { id:'d-h1', who:'hoshino', src:'lobby_tall_poster.jpg', fy:30, def:true },
    { id:'d-h2', who:'hoshino', src:'09_aquarium_tall_poster.jpg', fy:22, def:true },
    { id:'d-m1', who:'mika', src:'mika_tall_poster.jpg', fy:18, def:true },
    { id:'d-m2', who:'mika', src:'16_mika_night_tall_poster.jpg', fy:20, def:true },
  ];
  const FY = JSON.parse(localStorage.getItem('yl-wall-fy') || '{}');   // 初期壁紙の位置だけはここに保存
  let db = null, list = [], urls = {};

  function open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('yoheis-life', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('walls', { keyPath:'id' });
        r.onsuccess = () => { db = r.result; res(); };
        r.onerror = () => res();
      } catch (e) { res(); }
    });
  }
  const tx = mode => db.transaction('walls', mode).objectStore('walls');
  function all() {
    return new Promise(res => { if (!db) return res([]); const q = tx('readonly').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); });
  }
  function put(w) { return new Promise(res => { if (!db) return res(); const q = tx('readwrite').put(w); q.onsuccess = q.onerror = () => res(); }); }
  function del(id) { return new Promise(res => { if (!db) return res(); const q = tx('readwrite').delete(id); q.onsuccess = q.onerror = () => res(); }); }

  const srcOf = w => w.src || (urls[w.id] ||= URL.createObjectURL(w.blob));
  const fyOf = w => w.def ? (FY[w.id] ?? w.fy) : w.fy;

  async function load() {
    await open();
    const mine = await all();
    list = [...DEF, ...mine.sort((a, b) => a.at - b.at)];
  }

  // ---------- 画面を開くたびにランダム（同じ絵を続けない） ----------
  const last = {};
  function pick(who, screen) {
    const pool = list.filter(w => who === 'both' || w.who === who);
    if (!pool.length) return null;
    let c = pool; if (pool.length > 1) c = pool.filter(w => w.id !== last[screen]);
    const w = c[Math.floor(Math.random() * c.length)]; last[screen] = w.id; return w;
  }
  function apply(img, w) {
    if (!w) return;
    img.style.opacity = 0;
    img.onload = () => { img.style.opacity = 1; };
    img.src = srcOf(w); img.style.objectPosition = `50% ${fyOf(w)}%`;
  }

  // ---------- 台帳の壁紙タブ ----------
  function render() {
    const $ = UI.$;
    if ($('#wcAll')) $('#wcAll').textContent = list.length + '枚';
    ['hoshino', 'mika'].forEach(who => {
      const g = $(who === 'hoshino' ? '#wgH' : '#wgM'), ws = list.filter(w => w.who === who);
      $(who === 'hoshino' ? '#wcH' : '#wcM').textContent = ws.length + '枚';
      g.innerHTML = ws.map(w => `<button class="wth" data-w="${w.id}"><img src="${srcOf(w)}" style="object-position:50% ${fyOf(w)}%" alt="">${w.def ? '<span class="def">初期</span>' : ''}</button>`).join('')
        + `<label class="wth add" aria-label="写真から追加">${UI.icon('plus', 22, 2.6)}<input type="file" accept="image/*" multiple data-add="${who}"></label>`;
    });
  }
  async function add(files, who) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const w = { id:'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), who, blob:f, fy:20, at:Date.now() };
      await put(w); list.push(w);
    }
    render(); UI.toast({ who: who === 'mika' ? 'ミカ' : 'ホシノ', av: who === 'mika' ? 'av_mika.webp' : 'av_hoshino.webp', text:'壁紙、増やしといたよ' });
  }
  function adjust(id) {
    const w = list.find(x => x.id === id); if (!w) return;
    let fy = fyOf(w);
    const d = UI.pop({
      title:'位置の調整',
      body:`<div class="frame"><img src="${srcOf(w)}" style="object-position:50% ${fy}%" alt=""><div class="sh"></div><div class="zone"><span>顔をここに</span></div></div>
        <input type="range" min="0" max="100" step="1" value="${fy}" aria-label="縦の位置">`,
      buttons:[
        ...(w.def ? [] : [{ label:'削除', cls:'navy', onClick:async () => { await del(w.id); list = list.filter(x => x.id !== w.id); render(); } }]),
        { label:'保存', onClick:async () => {
          if (w.def) { FY[w.id] = fy; localStorage.setItem('yl-wall-fy', JSON.stringify(FY)); } else { w.fy = fy; await put(w); }
          render();
        } },
      ],
    });
    const img = d.querySelector('.frame img');
    d.querySelector('input[type=range]').addEventListener('input', e => { fy = +e.target.value; img.style.objectPosition = `50% ${fy}%`; });
  }
  document.addEventListener('change', e => { const i = e.target.closest('[data-add]'); if (i && i.files.length) { add([...i.files], i.dataset.add); i.value = ''; } });
  document.addEventListener('click', e => { const b = e.target.closest('.wth[data-w]'); if (b) adjust(b.dataset.w); });

  return { load, pick, apply, render };
})();
