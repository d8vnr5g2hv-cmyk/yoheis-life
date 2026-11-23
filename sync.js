// ============================================================
// Yohei's Life — GASとつなぐ（読み込み・保存・各画面への反映・操作）
// URLと合言葉は iPhone の中（localStorage）にだけ保存します
// ============================================================
const Sync = (() => {
  const { $, $$, pop, toast, rise, countUp, se } = UI;
  const CONF = 'yl-conf', STATE = 'yl-state';
  const WD = '日月火水木金土';
  let conf = null, st = null, last = 0, busy = null;
  try { conf = JSON.parse(localStorage.getItem(CONF) || 'null'); } catch (_) {}
  try { st = JSON.parse(localStorage.getItem(STATE) || 'null'); } catch (_) {}

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const yen = n => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const md = s => { const [, m, d] = s.slice(0, 10).split('/'); return `${+m}/${+d}`; };
  const wd = s => WD[new Date(s.slice(0, 10)).getDay()];
  const HO = { who:'ホシノ', av:'av_hoshino.webp' }, MI = { who:'ミカ', av:'av_mika.webp' };
  const say = (c, text) => toast(Object.assign({ text }, c));

  // ---------- 通信 ----------
  async function get(c) {
    const r = await fetch(`${c.url}?key=${encodeURIComponent(c.key)}&a=state&t=${Date.now()}`);
    const j = await r.json(); if (j.error) throw new Error(j.error); return j;
  }
  // 通信中は右上に小さなスピナー
  let busyN = 0;
  const spin = d => { busyN = Math.max(0, busyN + d); let e = document.getElementById('busy'); if (!e) { e = document.createElement('div'); e.id = 'busy'; document.body.appendChild(e); } e.classList.toggle('on', busyN > 0); };
  async function pull(force) {
    if (!conf) return null;
    if (!force && Date.now() - last < 60e3) return st;
    if (busy) return busy;
    spin(1);
    busy = get(conf).then(j => {
      st = j; last = Date.now(); localStorage.setItem(STATE, JSON.stringify(j)); renderAll(); return j;
    }).catch(e => { if (e.message === 'key') say(HO, '合言葉が違うみたい〜。データの設定を見てね〜'); return st; })
      .finally(() => { busy = null; spin(-1); });
    return busy;
  }
  // 画面を先に変えて、裏で送る。だめなら元に戻す
  async function act(params, change, okText) {
    if (!conf) { openSetting(); return; }
    const backup = JSON.stringify(st);
    if (change && st) { change(st); renderAll(); }
    spin(1);
    try {
      const r = await fetch(conf.url, { method:'POST', body:JSON.stringify(Object.assign({ key:conf.key }, params)) });  // text/plainで送る（下準備の通信なし）
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'ng');
      if (okText) say(okText[0], okText[1]);
      setTimeout(() => pull(true), 400);
    } catch (e) {
      st = JSON.parse(backup); renderAll(); say(HO, 'うへ〜、送れなかったよ〜。電波を見てもう一回お願い〜');
    } finally { spin(-1); }
  }

  // ---------- 設定 ----------
  function openSetting() {
    const d = pop({
      title:'データの設定',
      body:`<div class="lead"><img src="av_hoshino.webp" alt=""><p>GASのURLと合言葉を入れてね〜。この端末にだけ保存するよ〜</p></div>
        <label class="fld"><small>GASのURL（…/exec）</small><input id="cfUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(conf && conf.url)}"></label>
        <label class="fld"><small>合言葉（APP_KEY）</small><input id="cfKey" type="text" autocomplete="off" autocapitalize="off" value="${esc(conf && conf.key)}"></label>
        <p class="note" id="cfMsg">${st ? `最終更新 ${esc(st.now)}` : 'まだつながっていません'}</p>`,
      buttons:[{ label:'とじる', cls:'gray' }, { label:'つなぐ', onClick:dlg => {
        const c = { url:$('#cfUrl', dlg).value.trim(), key:$('#cfKey', dlg).value.trim() }, msg = $('#cfMsg', dlg);
        if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(c.url)) { msg.textContent = 'URLは …/exec で終わる形で入れてね'; msg.classList.add('ng'); return false; }
        msg.textContent = 'つないでいます…'; msg.classList.remove('ng');
        get(c).then(j => {
          conf = c; localStorage.setItem(CONF, JSON.stringify(c)); st = j; last = Date.now(); localStorage.setItem(STATE, JSON.stringify(j));
          renderAll(); dlg.close(); say(HO, 'つながったよ〜。これでLINEの記録がここにも出るからね〜');
        }).catch(e => { msg.textContent = e.message === 'key' ? '合言葉が違うみたい' : 'つながらなかった…URLを見直してね'; msg.classList.add('ng'); });
        return false;
      } }],
    });
  }

  // ---------- 入力用ポップアップ ----------
  function form(title, fields, label, onOk, extra) {
    const d = pop({
      title,
      body:fields.map(f => `<label class="fld"><small>${f.label}</small><input data-k="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'inputmode="numeric"' : ''} value="${esc(f.value)}" placeholder="${esc(f.ph || '')}"></label>`).join('') + (extra || ''),
      buttons:[{ label:'とじる', cls:'gray' }, { label, onClick:dlg => {
        const v = {}; $$('[data-k]', dlg).forEach(i => v[i.dataset.k] = i.value.trim());
        return onOk(v, dlg);
      } }],
    });
    setTimeout(() => { const i = $('input', d); i && !i.value && i.focus(); }, 320);
    return d;
  }

  // ---------- ロビー ----------
  function renderLobby() {
    const d = new Date();
    $('#lvDate').textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $('#lvDay').textContent = WD[d.getDay()];
    if (!st) { $('#lvPay').textContent = '—'; return; }
    $('#lvPay').textContent = st.paydayIn;
    const b = $('#lvBal'), k = $('#lvBalK');
    if (st.balance === null) { k.textContent = '今月'; UI.odo(b, yen(st.monthSpent), 'lv'); }
    else { k.textContent = '残高'; UI.odo(b, yen(st.balance), 'lv'); b.classList.toggle('red', st.balance < 0); }
    const today = ymd(d);
    badge('#bTask', st.tasks.length);
    badge('#bPlan', st.plans.filter(p => p.t.startsWith(today)).length);
    badge('#bLedger', st.unknown.length);
  }
  function badge(sel, n) { const e = $(sel); e.hidden = !n; e.textContent = n; }
  const upd = () => st ? `<div class="upd">${esc(st.now.slice(11))} 更新</div>` : '';
  const empty = (c, t) => `<div class="lead rise"><img src="${c.av}" alt=""><p>${t}</p></div>`;
  // 読み込み中は一覧の形を灰色で先に見せる（スケルトン）
  const skel = (n = 4) => conf ? `<div class="skel"><i class="sk-l"></i><div class="list">${Array.from({ length:n }, () => '<div class="item"><i class="sk-c"></i><div class="bd"><i class="sk-t"></i><i class="sk-s"></i></div></div>').join('')}</div></div>` : null;
  const noconf = () => skel() || `<div class="lead"><img src="av_hoshino.webp" alt=""><p>まだつながってないよ〜。タイトルの「データの設定」から入れてね〜</p></div><button class="bt" data-setting style="display:grid;margin:10px auto"><span>データの設定</span></button>`;

  // ---------- トーク（見るだけ） ----------
  function renderTalk() {
    const box = $('#box-talk'), sum = $('#sum-talk');
    if (!st) { box.innerHTML = noconf(); sum.textContent = 'データの設定をしてね'; return; }
    const t = st.talk.filter(x => x.w !== 'me'), l = t[t.length - 1];
    sum.textContent = l ? `${l.w === 'mika' ? 'ミカ' : 'ホシノ'}「${l.x.replace(/\s+/g, ' ')}」` : 'まだトークはないよ';
    let html = upd() + empty(HO, '話しかけるのはLINEからだよ〜。ここでは最近のやり取りが見られるよ〜'), day = '';
    st.talk.forEach(x => {
      const dd = x.t.slice(0, 10);
      if (dd !== day) { day = dd; html += `<div class="tday"><span>${md(dd)}（${wd(dd)}）</span></div>`; }
      const me = x.w === 'me', av = x.w === 'mika' ? 'av_mika.webp' : 'av_hoshino.webp';
      html += `<div class="msg ${me ? 'me' : ''}">${me ? '' : `<img src="${av}" alt="">`}<div><p>${esc(x.x).replace(/\n/g, '<br>')}</p><small class="num">${x.t.slice(11, 16)}</small></div></div>`;
    });
    if (!st.talk.length) html += '<p class="note">まだやり取りがないよ</p>';
    box.innerHTML = html;
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });   // 新しいやり取りを下に
  }

  // ---------- タスク・メモ ----------
  function renderTask() {
    const box = $('#box-task'), sum = $('#sum-task');
    if (!st) { box.innerHTML = noconf(); sum.textContent = 'データの設定をしてね'; return; }
    sum.textContent = st.tasks.length ? `残り${st.tasks.length}件 ・ ${st.tasks[0].n}` : 'やることはぜんぶ終わり！';
    let html = upd() + `<div class="lbl">やること<small>${st.tasks.length}件</small><button class="add" data-add="task" aria-label="追加">＋</button></div>`;
    html += st.tasks.length ? `<div class="list">${st.tasks.map(r => `<div class="swr" data-sw="done" data-id="${esc(r.id)}"><div class="swbg ok">完了</div><div class="item swi"><button class="check" data-tdone="${esc(r.id)}" aria-label="完了"></button><div class="bd"><b>${esc(r.n)}</b>${r.due ? `<small><span class="tag">${md(r.due)}まで</span></small>` : ''}</div></div></div>`).join('')}</div><p class="note">左にスワイプでも完了できるよ</p>`
      : empty(HO, 'うへ〜、やることはないよ〜。LINEで「やること 〇〇」って送ってもいいよ〜');
    html += `<div class="lbl">メモ<small>${st.memo.length}件</small></div>`;
    html += st.memo.length ? `<div class="list">${st.memo.map(r => `<div class="item"><div class="bd"><b class="wrap">${esc(r.n)}</b><small class="num">${md(r.t)} ${r.t.slice(11, 16)}</small></div></div>`).join('')}</div>`
      : '<p class="note">LINEで「メモ 〇〇」と送るとここに出るよ</p>';
    box.innerHTML = html;
  }

  // ---------- 予定 ----------
  const isAllDay = t => t.slice(11, 16) === '09:00';
  function renderPlan() {
    const box = $('#box-plan'), sum = $('#sum-plan');
    if (!st) { box.innerHTML = noconf(); sum.textContent = 'データの設定をしてね'; return; }
    const now = new Date(), nowS = `${ymd(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`, today = ymd(now);
    const next = st.plans.find(p => p.t >= nowS || (p.t.startsWith(today) && isAllDay(p.t)));
    sum.textContent = next ? `${next.t.startsWith(today) ? '' : md(next.t) + ' '}${isAllDay(next.t) ? '' : next.t.slice(11, 16) + ' '}${next.n}` : '1週間、予定なし';
    const tm = new Date(now); tm.setDate(tm.getDate() + 1); const tmr = ymd(tm);
    const wk = new Date(now); wk.setDate(wk.getDate() + 7); const wkS = ymd(wk);
    const groups = {}; st.plans.forEach(p => (groups[p.t.slice(0, 10)] = groups[p.t.slice(0, 10)] || []).push(p));
    const near = st.plans.filter(p => p.t.slice(0, 10) <= wkS).length;
    let html = upd() + `<div class="lbl">この1週間<small>${near}件</small><button class="add" data-add="plan" aria-label="追加">＋</button></div>`;
    if (!near) html += empty(HO, '1週間、予定なしだよ〜。のんびりできるね〜');
    let later = false;
    Object.keys(groups).sort().forEach(d => {
      if (d > wkS && !later) { later = true; html += `<div class="lbl">その先<small>1週間前にLINEで知らせるよ</small></div>`; }
      html += `<div class="lbl sub">${d === today ? '今日' : d === tmr ? '明日' : md(d)}<small>${md(d)}（${wd(d)}）</small></div><div class="list">`;
      html += groups[d].map(p => `<div class="swr" data-sw="delplan" data-id="${esc(p.id)}"><div class="swbg">削除</div><div class="item swi ${p.t < nowS && !isAllDay(p.t) ? 'dim' : ''}"><span class="tm num">${isAllDay(p.t) ? '<small>終日</small>' : p.t.slice(11, 16)}</span><div class="bd"><b>${esc(p.n)}</b></div></div></div>`).join('') + '</div>';
    });
    html += '<p class="note">左にスワイプで消せるよ</p>';
    box.innerHTML = html;
  }

  // ---------- 台帳 ----------
  function renderLedger() {
    const sum = $('#sum-ledger'), stc = $('#stMoney'), pane = $('#p-money');
    if (!st) { sum.textContent = 'データの設定をしてね'; stc.innerHTML = '<span>未設定</span>'; pane.innerHTML = noconf(); return; }
    const mode = st.mode === 'arrears';
    const bal = st.balance === null ? '残高まだ' : `残高 ${yen(st.balance)}`;
    sum.textContent = `${bal} ・ ${mode ? `滞納 ${st.arrears.length}件` : `貯金 ${yen(st.savings)}`}${st.unknown.length ? ` ・ 不明 ${st.unknown.length}件` : ''}`;
    stc.innerHTML = `<span>残高<b class="num">${st.balance === null ? '—' : yen(st.balance)}</b></span>` +
      (mode ? `<span class="red">滞納<b class="num">${st.arrears.length}件</b></span>` : `<span>貯金<b class="num">${yen(st.savings)}</b></span>`) +
      `<span>給料日まで<b class="num">${st.paydayIn}日</b></span>`;
    $('#ledLead').textContent = st.unknown.length ? `先生、使い道がわからないのが${st.unknown.length}件あるよ☆ お金から教えて！` : 'おかえり、先生☆ 何を見る？';

    let h = upd();
    h += `<div class="big"><div><div class="k">${st.balance === null ? '今月使った' : '口座残高（推定）'}</div><div class="v num ${st.balance < 0 ? 'red' : ''}" id="moneyBig"></div></div><img src="o_mika_stand.webp" alt="ミカ"></div>`;
    h += `<div class="list" style="margin-top:8px">
      <div class="kv"><span>今月使った</span><span class="num">${yen(st.monthSpent)}</span></div>
      <div class="kv"><span>給料日まで</span><span><span class="num">${st.paydayIn}</span> 日（${md(st.payday)}）</span></div>
      <div class="kv ${mode ? 'red' : ''}"><span>いまの段階</span><span>${mode ? '滞納を片付け中' : '先取り貯金'}</span></div>
      <div class="kv"><span>貯金</span><span class="num">${yen(st.savings)}</span></div></div>`;
    // 30 同棲資金の水位（目標50万円）
    const GOAL = 500000, pct = Math.min(100, Math.round(st.savings / GOAL * 1000) / 10);
    h += `<div class="tide"><div class="tw" style="--lv:${100 - Math.max(pct, 3)}%"><svg viewBox="0 0 200 40" preserveAspectRatio="none" class="w1"><path d="M0 20 Q25 8 50 20 T100 20 T150 20 T200 20 V40 H0Z"/></svg><svg viewBox="0 0 200 40" preserveAspectRatio="none" class="w2"><path d="M0 20 Q25 30 50 20 T100 20 T150 20 T200 20 V40 H0Z"/></svg><i class="fill"></i><b class="num">${pct}<small>%</small></b></div>
      <div class="tt"><span class="k">同棲資金</span><b class="num">${yen(st.savings)}<small> / ${yen(GOAL)}</small></b><small>${st.savings >= GOAL ? '目標達成☆' : `あと${yen(GOAL - st.savings)} ・ 来年の中ごろまで`}</small>${mode ? '<small class="muted">滞納が片付いたら、先取りでためていくよ</small>' : ''}</div></div>`;
    h += `<div class="btns"><button class="bt sm" data-m="balance"><span>残高を合わせる</span></button>${mode ? '' : '<button class="bt sm" data-m="moved"><span>先取りを移した</span></button>'}</div>`;
    if (st.unknown.length) {
      h += `<div class="lbl">何に使った？<small>${st.unknown.length}件</small></div><div class="list">` +
        st.unknown.map(r => `<div class="item"><span class="tm num">${yen(r.a)}</span><div class="bd"><b>使い道が不明</b><small class="num">${md(r.t)} ${r.t.slice(11, 16)}</small></div><button class="bt sm" data-fix="${esc(r.id)}"><span>教える</span></button></div>`).join('') + '</div>';
    }
    if (mode) {
      h += `<div class="lbl">滞納<small>合計 ${yen(st.arrears.reduce((s, r) => s + Number(r.a), 0))}</small></div><div class="list">` +
        st.arrears.map(r => `<div class="item"><div class="bd"><b>${esc(r.n)}</b><small>${yen(r.a)}${r.due ? ` ・ <span class="tag red">${md(r.due)}まで</span>` : ''}</small></div><div class="slc" data-slc="paid" data-id="${esc(r.id)}"><span class="sl-t">払った</span><span class="sk">›</span></div></div>`).join('') + '</div><p class="note">右にスライドで「払った」</p>';
    }
    // サブスク（アプリで登録・毎月「使った？」を聞く・2か月使ってなければ解約を提案）
    const subs = st.subs || [], sym = st.subsYm, smon = sym ? +sym.slice(5) : 0;
    const prevYm = sym ? (() => { const d = new Date(sym + '-01T00:00:00'); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })() : '';
    h += `<div class="lbl">サブスク<small>毎月 ${yen(subs.reduce((s, x) => s + Number(x.price || 0), 0))}</small><button class="add" data-sub="" aria-label="追加">＋</button></div>`;
    const ask = subs.filter(x => !(x.use || {})[sym] && (x.start || '') <= sym);
    if (ask.length) h += `<div class="subask"><b>${smon}月、使った？</b>${ask.map(x => `<div class="sa"><span>${esc(x.name)}</span><button class="bt sm" data-subuse="${esc(x.id)}" data-v="yes"><span>使った</span></button><button class="bt sm gray" data-subuse="${esc(x.id)}" data-v="no"><span>使ってない</span></button></div>`).join('')}</div>`;
    h += subs.length ? `<div class="list">${subs.map(x => {
      const u = x.use || {}, two = u[sym] === 'no' && u[prevYm] === 'no', one = u[sym] === 'no';
      return `<button class="item row" data-sub="${esc(x.id)}"><span class="tm num">${x.day}日</span><div class="bd"><b>${esc(x.name)}${two ? '<span class="tag red">解約しよ</span>' : one ? '<span class="tag">先月使ってない</span>' : ''}</b><small>毎月 ${yen(x.price)}</small></div><span class="num amt">${yen(x.price)}</span></button>`;
    }).join('')}</div>` : '<p class="note">「＋」から登録すると、毎月「使った？」を聞いて、2か月使ってなければ解約を提案するよ</p>';
    h += `<div class="lbl">最近の支出<small>${st.recent.length}件</small><button class="add" data-add="exp" aria-label="追加">＋</button></div>`;
    h += st.recent.length ? `<div class="list">${st.recent.map(r => `<div class="swr" data-sw="delexp" data-id="${esc(r.id)}"><div class="swbg">削除</div><button class="item row swi" data-exp="${esc(r.id)}"><span class="tm num">${md(r.t)}</span><div class="bd"><b>${esc(r.n)}</b><small>${esc(r.c)}${r.st === '仮' ? ' ・ 照合待ち' : ''}</small></div><span class="num amt">${yen(r.a)}</span></button></div>`).join('')}</div><p class="note">タップで名前の修正、左にスワイプで削除</p>`
      : '<p class="note">Apple Payで払うか、LINEで「コンビニ 466」と送るとここに出るよ</p>';
    pane.innerHTML = h;
    UI.odo($('#moneyBig'), yen(st.balance === null ? st.monthSpent : st.balance), 'money');
  }

  // ---------- 台帳 › 体（睡眠） ----------
  const hm = m => `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, '0')}分`;
  const hmS = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const clk = m => { m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const toMin = t => { const [h, m] = t.slice(11, 16).split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
  const SRC = { call:'電話を切った', charge:'充電した' };
  function renderBody() {
    const pane = $('#p-body'), stc = $('#stBody');
    if (!st) { pane.innerHTML = noconf(); stc.innerHTML = '<span>未設定</span>'; return; }
    const b = st.body || { week:[] }, l = b.last;
    stc.innerHTML = l && l.min ? `<span>昨夜<b class="num">${hmS(l.min)}</b></span>${b.avgMin ? `<span>平均<b class="num">${hmS(b.avgMin)}</b></span>` : ''}` : '<span>記録待ち</span>';
    let h = upd();
    if (!l) {
      pane.innerHTML = h + empty(MI, 'まだ記録がないよ。夜に充電するか、おやすみ電話を切ると「寝た時刻」、朝アラームを止めると「起きた時刻」が入るよ☆');
      return;
    }
    const msg = !l.wake ? 'いまは寝た時刻まで入ってるよ。起きたらアラームを止めてね☆'
      : l.min < 360 ? '昨夜はちょっと短めだったね……。今夜は早めに寝よ？'
      : l.min >= 480 ? 'しっかり寝れたね☆ えらいえらい。'
      : 'ちゃんと寝れてるね☆ この調子！';
    h += empty(MI, msg);
    h += `<div class="big"><div><div class="k">昨夜の睡眠</div><div class="v num">${l.wake ? hm(l.min) : '記録中'}</div></div><img src="o_mika_stand.webp" alt="ミカ"></div>`;
    h += `<div class="list" style="margin-top:8px">
      <div class="kv"><span>寝た時刻</span><span><span class="num">${l.bed ? l.bed.slice(11) : '—'}</span>${l.src ? `<small>（${SRC[l.src] || ''}）</small>` : ''}</span></div>
      <div class="kv"><span>起きた時刻</span><span class="num">${l.wake ? l.wake.slice(11) : '—'}</span></div>
      ${b.week.length ? `<div class="kv"><span>1週間の平均</span><span class="num">${hm(b.avgMin)}</span></div>
      <div class="kv"><span>平均の寝た時刻／起きた時刻</span><span class="num">${clk(b.avgBed)} → ${clk(b.avgWake)}</span></div>` : ''}</div>`;
    if (b.week.length) {
      const S = 21 * 60, W = 15 * 60;                 // 21時〜翌12時の帯
      h += `<div class="lbl">この1週間<small>21時〜12時</small></div><div class="list slp">
        <div class="sax"><span></span><i style="left:20%">0時</i><i style="left:40%">3時</i><i style="left:60%">6時</i><i style="left:80%">9時</i></div>` +
        b.week.slice().reverse().map(r => {
          const a = Math.max(0, toMin(r.bed) - S), z = Math.min(W, toMin(r.wake) - S);
          return `<div class="srow"><span class="sd num">${md(r.night)}<small>${wd(r.night)}</small></span><span class="str"><i style="left:${a / W * 100}%;width:${Math.max(2, (z - a) / W * 100)}%" class="${r.min < 360 ? 'short' : ''}"></i></span><span class="sm num">${hmS(r.min)}</span></div>`;
        }).join('') + '</div>';
    }
    pane.innerHTML = h;
  }

  // ---------- 台帳 › 人 ----------
  function renderPeople() {
    const pane = $('#p-people'), stc = $('#stPeople');
    if (!st) { pane.innerHTML = noconf(); stc.innerHTML = '<span>未設定</span>'; return; }
    const ps = st.people || [], nx = ps.find(p => p.days != null);
    stc.innerHTML = nx ? `<span>${esc(nx.name)}の誕生日まで<b class="num">${nx.days}日</b></span>` : `<span>登録<b class="num">${ps.length}人</b></span>`;
    let h = upd();
    h += empty(HO, nx && nx.days <= 30 ? `${esc(nx.name)}の誕生日まで、あと${nx.days}日だよ〜。` : '誕生日と好きなものを入れておくと、1か月前におじさんがプレゼントの相談するよ〜');
    h += `<div class="lbl">人<small>${ps.length}人</small><button class="add" data-person="" aria-label="追加">＋</button></div>`;
    h += ps.length ? `<div class="list">${ps.map(p => `<button class="item row" data-person="${esc(p.id)}">
        <span class="pday ${p.days != null && p.days <= 30 ? 'soon' : ''}">${p.days == null ? '<small>—</small>' : p.days === 0 ? '<b>今日</b>' : `<b class="num">${p.days}</b><small>日後</small>`}</span>
        <div class="bd"><b>${esc(p.name)}${p.rel ? `<span class="tag">${esc(p.rel)}</span>` : ''}</b><small>${p.bday ? `誕生日 ${esc(p.bday.replace(/^0/, '').replace('/0', '/'))}` : '誕生日 未登録'}${p.likes ? ' ・ ' + esc(p.likes) : ''}</small>
        <small>${p.since == null ? '会った記録なし' : p.since === 0 ? '今日会った' : `最後に会ってから ${p.since}日`}</small></div></button>`).join('')}</div>`
      : '<p class="note">「＋」から登録してね</p>';
    pane.innerHTML = h;
  }
  function personForm(p) {
    p = p || {};
    const [bm, bd] = (p.bday || '').split('/');
    const d = form(p.id ? p.name : '人を追加', [
      { k:'name', label:'名前', value:p.name, ph:'坂井さん' },
      { k:'rel', label:'関係', value:p.rel, ph:'友達・家族・会社など' },
      { k:'bm', label:'誕生日（月）', type:'number', value:bm ? +bm : '', ph:'3' },
      { k:'bd', label:'誕生日（日）', type:'number', value:bd ? +bd : '', ph:'14' },
      { k:'likes', label:'好きなもの（「、」区切り。プレゼント探しに使う）', value:p.likes, ph:'ビール、サッカー' },
      { k:'memo', label:'メモ', value:p.memo, ph:'' },
    ], p.id ? '保存' : '追加', v => {
      if (!v.name) return false;
      const bday = v.bm && v.bd ? `${pad(+v.bm)}/${pad(+v.bd)}` : '';
      act({ a:'person', id:p.id || '', name:v.name, rel:v.rel, bday, likes:v.likes, memo:v.memo }, null, [HO, p.id ? '直しといたよ〜' : `${v.name}、入れといたよ〜`]);
    }, p.id ? `<div class="btns"><button class="bt sm" data-pmet><span>今日会った</span></button><button class="bt sm" data-pgift><span>プレゼントを探す</span></button></div><button class="del" data-pdel>この人を消す</button>` : '');
    if (!p.id) return;
    $('[data-pmet]', d).addEventListener('click', () => { d.close(); act({ a:'met', id:p.id }, s => { const x = find(s.people, p.id); if (x) x.since = 0; }, [HO, `${p.name}と会ったんだね〜。記録しといたよ〜`]); });
    $('[data-pdel]', d).addEventListener('click', () => { d.close(); act({ a:'delperson', id:p.id }, s => { s.people = s.people.filter(x => x.id !== p.id); }, [HO, '消しといたよ〜']); });
    $('[data-pgift]', d).addEventListener('click', () => { d.close(); giftForm(p); });
  }
  function giftForm(p) {
    form(`${p.name}へのプレゼント`, [{ k:'budget', label:`予算（円）${p.likes ? ' ・ 好きなもの：' + p.likes : ''}`, type:'number', ph:'3000' }], '探す', (v, dlg) => {
      const b = Number(v.budget); if (!b) return false;
      const msg = document.createElement('p'); msg.className = 'note'; msg.textContent = '楽天で探しています…'; dlg.querySelector('.pop').appendChild(msg);
      fetch(conf.url, { method:'POST', body:JSON.stringify({ key:conf.key, a:'gift', id:p.id, budget:b }) }).then(r => r.json()).then(j => {
        dlg.close();
        if (!j.ok || !j.items.length) { say(HO, j.error || 'うへ〜、いいのが見つからなかったよ〜。予算を変えてみて〜'); return; }
        pop({ title:'プレゼントの候補', body:`<div class="lead"><img src="av_hoshino.webp" alt=""><p>「${esc(j.kw.join('・'))}」から${yen(b)}以内で探してみたよ〜</p></div><div class="gifts">${j.items.map(it => `<a class="gift" href="${esc(it.url)}" target="_blank" rel="noopener"><img src="${esc(it.img)}" alt=""><span><b>${esc(it.name)}</b><small class="num">${yen(it.price)}${it.count ? ` ・ ★${it.review}` : ''}</small></span></a>`).join('')}</div>` });
      }).catch(() => { msg.textContent = '通信できなかった…もう一回お願い'; msg.classList.add('ng'); });
      return false;
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-person]'); if (!b) return;
    e.stopPropagation();
    if (!conf) { openSetting(); return; }
    personForm(b.dataset.person ? find(st.people || [], b.dataset.person) : null);
  }, true);

  function renderAll() { renderLobby(); renderTalk(); renderTask(); renderPlan(); renderLedger(); renderBody(); renderPeople(); }

  // ---------- 操作 ----------
  const find = (list, id) => list.find(x => x.id === id);
  document.addEventListener('click', e => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-setting]'))) { e.stopPropagation(); openSetting(); return; }
    if ((b = t.closest('[data-tdone]'))) {
      const id = b.dataset.tdone; b.innerHTML = UI.icon('check', 13, 3); b.classList.add('on', 'draw'); se.ok();
      const w0 = b.closest('.swr'); if (w0) w0.classList.add('strike');          // 33 文字に線を引いてから消える
      setTimeout(() => { const w = b.closest('.swr'); if (w) w.classList.add('gone'); }, 520);
      setTimeout(() => doneTask(id), 800);
      return;
    }
    if ((b = t.closest('[data-paid]'))) {
      const r = find(st.arrears, b.dataset.paid);
      pop({ title:'払った？', body:`<div class="lead"><img src="av_mika.webp" alt=""><p>「${esc(r.n)}」${yen(r.a)}、済みにするね？</p></div>`, buttons:[{ label:'まだ', cls:'gray' }, { label:'払った', onClick:() => {
        act({ a:'paid', id:r.id }, s => { s.arrears = s.arrears.filter(x => x.id !== r.id); if (!s.arrears.length) s.mode = 'saving'; }, [MI, st.arrears.length > 1 ? 'えらいじゃん☆ 残りも一緒に片付けよ' : 'これで滞納ゼロだよ、先生☆']);
      } }] });
      return;
    }
    if ((b = t.closest('[data-fix]'))) {
      const r = find(st.unknown, b.dataset.fix);
      form('何に使った？', [{ k:'name', label:`${md(r.t)} ${r.t.slice(11, 16)} の ${yen(r.a)}`, ph:'コンビニ' }], '記録する', v => {
        if (!v.name) return false;
        act({ a:'fixexp', id:r.id, name:v.name }, s => { s.unknown = s.unknown.filter(x => x.id !== r.id); const x = find(s.recent, r.id); if (x) { x.n = v.name; x.st = '確定'; } }, [MI, `${v.name}ね、記録しといた☆`]);
      });
      return;
    }
    if ((b = t.closest('[data-exp]'))) {
      const r = find(st.recent, b.dataset.exp);
      const d = form('支出', [{ k:'name', label:`${md(r.t)} ${r.t.slice(11, 16)} ・ ${yen(r.a)}`, value:r.n }], '直す', v => {
        if (!v.name || v.name === r.n) return;
        act({ a:'fixexp', id:r.id, name:v.name }, s => { const x = find(s.recent, r.id); if (x) x.n = v.name; }, [MI, '直しといたよ☆']);
      }, '<button class="del" data-delexp>この支出を消す</button>');
      $('[data-delexp]', d).addEventListener('click', () => { d.close(); act({ a:'delexp', id:r.id }, s => { s.recent = s.recent.filter(x => x.id !== r.id); s.monthSpent -= r.a; if (s.balance !== null) s.balance += r.a; }, [MI, '消しといたよ☆']); });
      return;
    }
    if ((b = t.closest('[data-m]'))) {
      if (b.dataset.m === 'balance') form('残高を合わせる', [{ k:'amount', label:'今の口座残高（円）', type:'number', ph:'38200' }], '合わせる', v => {
        const a = Number(v.amount); if (!v.amount || isNaN(a)) return false;
        act({ a:'balance', amount:a }, s => { s.balance = a; }, [MI, `残高 ${yen(a)}、覚えたよ☆`]);
      });
      else form('先取りを移した', [{ k:'amount', label:'移した額（円）', type:'number', value:st.preSave || '' }], '移した', v => {
        const a = Number(v.amount); if (!a) return false;
        act({ a:'moved', amount:a }, s => { s.savings += a; if (s.balance !== null) s.balance -= a; }, [MI, `${yen(a)}、貯金に入れたよ☆`]);
      });
      return;
    }
    if ((b = t.closest('[data-add]'))) {
      const k = b.dataset.add;
      if (k === 'task') form('やることを追加', [{ k:'text', label:'内容', ph:'名刺の入稿' }, { k:'due', label:'期限（なくてもOK）', type:'date' }], '追加', v => {
        if (!v.text) return false;
        act({ a:'task', text:v.text, due:v.due.replace(/-/g, '/') }, s => { s.tasks.push({ id:'tmp', n:v.text, due:v.due.replace(/-/g, '/') }); }, [HO, `「${v.text}」、入れといたよ〜`]);
      });
      if (k === 'plan') {
        const today = ymd(new Date()).replace(/\//g, '-');
        form('予定を追加', [{ k:'text', label:'内容', ph:'坂井さんと飲み' }, { k:'date', label:'日にち', type:'date', value:today }, { k:'time', label:'時刻（なければ終日）', type:'time' }], '追加', v => {
          if (!v.text || !v.date) return false;
          const at = `${v.date.replace(/-/g, '/')} ${v.time || '09:00'}`;
          act({ a:'plan', text:v.text, at }, s => { s.plans.push({ id:'tmp', t:at, n:v.text }); s.plans.sort((x, y) => x.t.localeCompare(y.t)); }, [HO, v.time ? '入れといたよ〜。1時間前に声かけるね〜' : '入れといたよ〜。当日の朝に声かけるね〜']);
        });
      }
      if (k === 'exp') form('支出を追加', [{ k:'name', label:'何に', ph:'ランチ' }, { k:'amount', label:'金額（円）', type:'number', ph:'800' }], '記録する', v => {
        const a = Number(v.amount); if (!v.name || !a) return false;
        act({ a:'exp', name:v.name, amount:a }, s => { s.recent.unshift({ id:'tmp', t:`${ymd(new Date())} 00:00`, n:v.name, c:'', a, st:'確定' }); s.monthSpent += a; if (s.balance !== null) s.balance -= a; }, [MI, `${v.name} ${yen(a)}、記録したよ☆`]);
      });
    }
  }, true);

  // 左スワイプの操作（完了・削除）
  const doneTask = id => act({ a:'done', id }, s => { s.tasks = s.tasks.filter(x => x.id !== id); }, [HO, 'おつかれ〜、1個片付いたね〜']);
  document.addEventListener('slideconfirm', e => {
    const { act:k, id } = e.detail;
    if (k === 'paid') act({ a:'paid', id }, s => { s.arrears = s.arrears.filter(x => x.id !== id); if (!s.arrears.length) s.mode = 'saving'; }, [MI, st.arrears.length > 1 ? 'えらいじゃん☆ 残りも一緒に片付けよ' : 'これで滞納ゼロだよ、先生☆']);
  });
  document.addEventListener('click', e => {
    const u = e.target.closest('[data-subuse]');
    if (u) { e.stopPropagation(); const id = u.dataset.subuse, v = u.dataset.v; act({ a:'subuse', id, ym:st.subsYm, v }, s => { const x = find(s.subs, id); if (x) { x.use = x.use || {}; x.use[s.subsYm] = v; } }, v === 'yes' ? [MI, '使ってるならOK☆'] : [MI, '了解。2か月続いたら解約を考えよ☆']); return; }
    const b = e.target.closest('[data-sub]'); if (!b) return;
    e.stopPropagation(); if (!conf) { openSetting(); return; }
    const x = b.dataset.sub ? find(st.subs || [], b.dataset.sub) : {};
    const d = form(x.id ? x.name : 'サブスクを追加', [
      { k:'name', label:'名前', value:x.name, ph:'Netflix' },
      { k:'price', label:'毎月の金額（円）', type:'number', value:x.price, ph:'1490' },
      { k:'day', label:'引き落とし日（毎月◯日）', type:'number', value:x.day, ph:'5' },
    ], x.id ? '保存' : '追加', v => {
      if (!v.name || !Number(v.price)) return false;
      act({ a:'sub', id:x.id || '', name:v.name, price:v.price, day:v.day || 1 }, null, [MI, x.id ? '直しといたよ☆' : `${v.name}、入れといたよ☆`]);
    }, x.id ? '<button class="del" data-subdel>このサブスクを消す（解約したとき）</button>' : '');
    if (x.id) $('[data-subdel]', d).addEventListener('click', () => { d.close(); act({ a:'delsub', id:x.id }, s => { s.subs = s.subs.filter(y => y.id !== x.id); }, [MI, `${x.name}、一覧から消したよ。解約えらい☆`]); });
  }, true);
  document.addEventListener('swipeact', e => {
    const { act:k, id } = e.detail;
    if (k === 'done') { se.ok(); doneTask(id); }
    if (k === 'delplan') act({ a:'delplan', id }, s => { s.plans = s.plans.filter(x => x.id !== id); }, [HO, '消しといたよ〜']);
    if (k === 'delexp') { const r = find(st.recent, id); act({ a:'delexp', id }, s => { s.recent = s.recent.filter(x => x.id !== id); s.unknown = s.unknown.filter(x => x.id !== id); if (r) { s.monthSpent -= r.a; if (s.balance !== null) s.balance += r.a; } }, [MI, '消しといたよ☆']); }
  });

  renderAll();
  return { pull, renderAll, openSetting, hasConf:() => !!conf, state:() => st };
})();
