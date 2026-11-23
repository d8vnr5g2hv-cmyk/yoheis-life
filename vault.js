// ============================================================
// Yohei's Life — 金庫（この端末の中だけ。暗証番号で暗号化して保存）
// PBKDF2(SHA-256, 25万回) で鍵を作り、AES-GCM で暗号化。GASには送らない
// ============================================================
const Vault = (() => {
  const { $, pop, toast, se } = UI;
  const KEY = 'yl-vault';
  const MI = { who:'ミカ', av:'av_mika.webp' };
  const say = t => toast(Object.assign({ text:t }, MI));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let key = null, items = [], timer = null;

  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:250000, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
  }
  async function save() {
    const v = saved(), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(items)));
    localStorage.setItem(KEY, JSON.stringify({ v:1, salt:v.salt, iv:b64(iv), data:b64(data), n:items.length }));
    render();
  }
  async function unlock(pin) {
    const v = saved();
    const k = await derive(pin, unb64(v.salt));
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(v.iv) }, k, unb64(v.data));   // 番号違いはここで失敗する
    key = k; items = JSON.parse(new TextDecoder().decode(plain)); armTimer(); render();
  }
  async function create(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(KEY, JSON.stringify({ v:1, salt:b64(salt), iv:'', data:'', n:0 }));
    key = await derive(pin, salt); items = []; await save(); armTimer();
  }
  function lock() { key = null; items = []; clearTimeout(timer); render(); }
  function armTimer() { clearTimeout(timer); timer = setTimeout(lock, 3 * 60e3); }   // 3分さわらなければ自動で鍵
  document.addEventListener('visibilitychange', () => { if (document.hidden) lock(); });

  // ---------- 表示 ----------
  function render() {
    const pane = $('#p-vault'), stc = $('#stVault'), v = saved();
    if (!pane) return;
    stc.innerHTML = !v ? '<span>未設定</span>' : `<span>${key ? '開いています' : 'ロック中'}</span><span>登録<b class="num">${v.n || 0}件</b></span>`;
    const lead = t => `<div class="lead rise"><img src="av_mika.webp" alt=""><p>${t}</p></div>`;
    if (!v) {
      pane.innerHTML = lead('ここは先生だけの金庫だよ。中身はこのスマホの中だけに、暗証番号で鍵をかけて置いておくね☆ 番号を忘れたら私でも開けられないから、気をつけて！') +
        `<div class="vlock"><div class="vic">${UI.icon('lock', 28, 2.2)}</div><b>暗証番号を決める</b><small>4けた以上。あとから変えられません</small><button class="bt" data-vnew><span>はじめる</span></button></div>`;
      return;
    }
    if (!key) {
      pane.innerHTML = lead('金庫を開けるね。暗証番号を入れて☆') +
        `<div class="vlock"><div class="vic">${UI.icon('lock', 28, 2.2)}</div><b>ロック中</b><small>${v.n || 0}件 入っています</small>
          <label class="fld"><input id="vPin" type="password" inputmode="numeric" autocomplete="off" placeholder="暗証番号"></label>
          <button class="bt" data-vopen><span>開ける</span></button><p class="note" id="vMsg"></p></div>`;
      return;
    }
    pane.innerHTML = lead('開いてるよ。3分さわらないか、アプリを閉じると自動で鍵がかかるからね☆') +
      `<div class="lbl">金庫<small>${items.length}件</small><button class="add" data-vadd aria-label="追加">＋</button></div>` +
      (items.length ? `<div class="list">${items.map(x => `<button class="item row" data-vitem="${esc(x.id)}"><div class="bd"><b>${esc(x.title)}</b><small>${esc(x.user || '')}</small></div><span class="go">›</span></button>`).join('')}</div>` : '<p class="note">「＋」から入れてね</p>') +
      `<div class="btns"><button class="bt sm gray" data-vlock><span>鍵をかける</span></button><button class="bt sm gray" data-vexport><span>控えを書き出す</span></button><button class="bt sm gray" data-vimport><span>控えから戻す</span></button></div>
       <p class="note">本当に大事なパスワードは、iPhoneの「パスワード」アプリのほうが安全だよ</p>`;
  }

  // ---------- 入力 ----------
  function pinForm() {
    const d = pop({ title:'暗証番号を決める', body:`<label class="fld"><small>暗証番号（4けた以上）</small><input data-k="a" type="password" inputmode="numeric"></label><label class="fld"><small>もう一度</small><input data-k="b" type="password" inputmode="numeric"></label><p class="note" id="vNewMsg">忘れると中身は戻せません</p>`,
      buttons:[{ label:'とじる', cls:'gray' }, { label:'決める', onClick:dlg => {
        const a = $('[data-k=a]', dlg).value, b = $('[data-k=b]', dlg).value, m = $('#vNewMsg', dlg);
        if (a.length < 4) { m.textContent = '4けた以上にしてね'; m.classList.add('ng'); return false; }
        if (a !== b) { m.textContent = '2回の番号がちがうよ'; m.classList.add('ng'); return false; }
        create(a).then(() => say('金庫ができたよ☆ 番号は忘れないでね'));
      } }] });
    setTimeout(() => $('input', d).focus(), 320);
  }
  function itemForm(x) {
    x = x || {};
    const f = (k, l, v, t) => `<label class="fld"><small>${l}</small><input data-k="${k}" type="${t || 'text'}" value="${esc(v)}" autocomplete="off" autocapitalize="off"></label>`;
    const d = pop({ title:x.id ? x.title : '金庫に入れる',
      body:f('title', 'なまえ（例：ジムの会員番号）', x.title) + f('user', 'ID・番号', x.user) + `<label class="fld"><small>パスワード・暗証</small><span class="vpw"><input data-k="pass" type="password" value="${esc(x.pass)}" autocomplete="off"><button type="button" data-vshow>表示</button></span></label>` + `<label class="fld"><small>メモ</small><input data-k="memo" value="${esc(x.memo)}"></label>` +
        (x.id ? `<div class="btns"><button class="bt sm" data-vcopy="user"><span>IDをコピー</span></button><button class="bt sm" data-vcopy="pass"><span>パスワードをコピー</span></button></div><button class="del" data-vdel>これを消す</button>` : ''),
      buttons:[{ label:'とじる', cls:'gray' }, { label:x.id ? '保存' : '入れる', onClick:dlg => {
        const v = {}; dlg.querySelectorAll('[data-k]').forEach(i => v[i.dataset.k] = i.value);
        if (!v.title.trim()) return false;
        if (x.id) Object.assign(items.find(y => y.id === x.id), v); else items.push(Object.assign({ id:Math.random().toString(36).slice(2, 10) }, v));
        armTimer(); save().then(() => say(x.id ? '直しといたよ☆' : 'しまっといたよ☆'));
      } }] });
    $('[data-vshow]', d).addEventListener('click', e => { const i = $('[data-k=pass]', d); i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? '表示' : '隠す'; });
    if (!x.id) return;
    d.querySelectorAll('[data-vcopy]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.vcopy === 'user' ? x.user : x.pass;
      navigator.clipboard.writeText(t || '').then(() => say('コピーしたよ☆'), () => say('コピーできなかった…'));
    }));
    $('[data-vdel]', d).addEventListener('click', () => { d.close(); items = items.filter(y => y.id !== x.id); save().then(() => say('消しといたよ')); });
  }
  function exportIt() {
    const raw = localStorage.getItem(KEY);
    const d = pop({ title:'控えを書き出す', body:`<p class="note" style="text-align:left">鍵がかかったままの文字です。メモアプリなどに貼って保管してね。戻すときは同じ暗証番号が必要です。</p><textarea class="vtext" readonly>${esc(raw)}</textarea>`,
      buttons:[{ label:'とじる', cls:'gray' }, { label:'コピー', onClick:() => { navigator.clipboard.writeText(raw).then(() => say('コピーしたよ☆')); } }] });
    setTimeout(() => $('.vtext', d).select(), 300);
  }
  function importIt() {
    pop({ title:'控えから戻す', body:`<p class="note" style="text-align:left">書き出した文字を貼ってね。今の金庫は置きかわります。</p><textarea class="vtext" data-k="t"></textarea><p class="note" id="vImMsg"></p>`,
      buttons:[{ label:'とじる', cls:'gray' }, { label:'戻す', onClick:dlg => {
        const t = $('[data-k=t]', dlg).value.trim(), m = $('#vImMsg', dlg);
        try { const j = JSON.parse(t); if (!j.salt || !j.data) throw 0; localStorage.setItem(KEY, t); lock(); say('戻したよ。暗証番号で開けてね☆'); }
        catch (_) { m.textContent = '控えの文字じゃないみたい'; m.classList.add('ng'); return false; }
      } }] });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-vnew]')) { pinForm(); return; }
    if (t.closest('[data-vopen]')) {
      const pin = $('#vPin').value, m = $('#vMsg'); if (!pin) return;
      m.textContent = '開けています…'; m.classList.remove('ng');
      unlock(pin).then(() => { se.ok(); }).catch(() => { m.textContent = '番号がちがうみたい'; m.classList.add('ng'); $('#vPin').value = ''; });
      return;
    }
    if (t.closest('[data-vlock]')) { lock(); se.close(); return; }
    if (t.closest('[data-vadd]')) { armTimer(); itemForm(); return; }
    const it = t.closest('[data-vitem]'); if (it) { armTimer(); itemForm(items.find(x => x.id === it.dataset.vitem)); return; }
    if (t.closest('[data-vexport]')) { exportIt(); return; }
    if (t.closest('[data-vimport]')) { importIt(); return; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'vPin') $('[data-vopen]').click(); });

  render();
  return { render, lock };
})();
