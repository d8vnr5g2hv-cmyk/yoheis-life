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
  async function pull(force) {
    if (!conf) return null;
    if (!force && Date.now() - last < 60e3) return st;
    if (busy) return busy;
    busy = get(conf).then(j => {
      st = j; last = Date.now(); localStorage.setItem(STATE, JSON.stringify(j)); renderAll(); return j;
    }).catch(e => { if (e.message === 'key') say(HO, '合言葉が違うみたい〜。データの設定を見てね〜'); return st; })
      .finally(() => { busy = null; });
    return busy;
  }
  // 画面を先に変えて、裏で送る。だめなら元に戻す
  async function act(params, change, okText) {
    if (!conf) { openSetting(); return; }
    const backup = JSON.stringify(st);
    if (change && st) { change(st); renderAll(); }
    try {
      const r = await fetch(conf.url, { method:'POST', body:JSON.stringify(Object.assign({ key:conf.key }, params)) });  // text/plainで送る（下準備の通信なし）
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'ng');
      if (okText) say(okText[0], okText[1]);
      setTimeout(() => pull(true), 400);
    } catch (e) {
      st = JSON.parse(backup); renderAll(); say(HO, 'うへ〜、送れなかったよ〜。電波を見てもう一回お願い〜');
    }
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
    if (st.balance === null) { k.textContent = '今月'; b.textContent = yen(st.monthSpent); }
    else { k.textContent = '残高'; b.textContent = yen(st.balance); b.classList.toggle('red', st.balance < 0); }
    const today = ymd(d);
    badge('#bTask', st.tasks.length);
    badge('#bPlan', st.plans.filter(p => p.t.startsWith(today)).length);
    badge('#bLedger', st.unknown.length);
  }
  function badge(sel, n) { const e = $(sel); e.hidden = !n; e.textContent = n; }
  const upd = () => st ? `<div class="upd">${esc(st.now.slice(11))} 更新</div>` : '';
  const empty = (c, t) => `<div class="lead rise"><img src="${c.av}" alt=""><p>${t}</p></div>`;
  const noconf = () => `<div class="lead"><img src="av_hoshino.webp" alt=""><p>まだつながってないよ〜。タイトルの「データの設定」から入れてね〜</p></div><button class="bt" data-setting style="display:grid;margin:10px auto"><span>データの設定</span></button>`;

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
    html += st.tasks.length ? `<div class="list">${st.tasks.map(r => `<div class="item"><button class="check" data-tdone="${esc(r.id)}" aria-label="完了"></button><div class="bd"><b>${esc(r.n)}</b>${r.due ? `<small><span class="tag">${md(r.due)}まで</span></small>` : ''}</div></div>`).join('')}</div>`
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
    const groups = {}; st.plans.forEach(p => (groups[p.t.slice(0, 10)] = groups[p.t.slice(0, 10)] || []).push(p));
    let html = upd() + `<div class="lbl">この1週間<small>${st.plans.length}件</small><button class="add" data-add="plan" aria-label="追加">＋</button></div>`;
    if (!st.plans.length) html += empty(HO, '1週間、予定なしだよ〜。のんびりできるね〜');
    Object.keys(groups).sort().forEach(d => {
      html += `<div class="lbl sub">${d === today ? '今日' : d === tmr ? '明日' : md(d)}<small>${md(d)}（${wd(d)}）</small></div><div class="list">`;
      html += groups[d].map(p => `<div class="item ${p.t < nowS && !isAllDay(p.t) ? 'dim' : ''}" data-plan="${esc(p.id)}"><span class="tm num">${isAllDay(p.t) ? '<small>終日</small>' : p.t.slice(11, 16)}</span><div class="bd"><b>${esc(p.n)}</b></div></div>`).join('') + '</div>';
    });
    html += '<p class="note">長押しで消せるよ</p>';
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
    h += `<div class="big"><div><div class="k">${st.balance === null ? '今月使った' : '口座残高（推定）'}</div><div class="v num ${st.balance < 0 ? 'red' : ''}" data-count="${st.balance === null ? st.monthSpent : st.balance}" data-pre="¥">${yen(st.balance === null ? st.monthSpent : st.balance)}</div></div><img src="o_mika_stand.webp" alt="ミカ"></div>`;
    h += `<div class="list" style="margin-top:8px">
      <div class="kv"><span>今月使った</span><span class="num">${yen(st.monthSpent)}</span></div>
      <div class="kv"><span>給料日まで</span><span><span class="num">${st.paydayIn}</span> 日（${md(st.payday)}）</span></div>
      <div class="kv ${mode ? 'red' : ''}"><span>いまの段階</span><span>${mode ? '滞納を片付け中' : '先取り貯金'}</span></div>
      <div class="kv"><span>貯金</span><span class="num">${yen(st.savings)}</span></div></div>`;
    h += `<div class="btns"><button class="bt sm" data-m="balance"><span>残高を合わせる</span></button>${mode ? '' : '<button class="bt sm" data-m="moved"><span>先取りを移した</span></button>'}</div>`;
    if (st.unknown.length) {
      h += `<div class="lbl">何に使った？<small>${st.unknown.length}件</small></div><div class="list">` +
        st.unknown.map(r => `<div class="item"><span class="tm num">${yen(r.a)}</span><div class="bd"><b>使い道が不明</b><small class="num">${md(r.t)} ${r.t.slice(11, 16)}</small></div><button class="bt sm" data-fix="${esc(r.id)}"><span>教える</span></button></div>`).join('') + '</div>';
    }
    if (mode) {
      h += `<div class="lbl">滞納<small>合計 ${yen(st.arrears.reduce((s, r) => s + Number(r.a), 0))}</small></div><div class="list">` +
        st.arrears.map(r => `<div class="item"><div class="bd"><b>${esc(r.n)}</b><small>${yen(r.a)}${r.due ? ` ・ <span class="tag red">${md(r.due)}まで</span>` : ''}</small></div><button class="bt sm" data-paid="${esc(r.id)}"><span>払った</span></button></div>`).join('') + '</div>';
    }
    h += `<div class="lbl">最近の支出<small>${st.recent.length}件</small><button class="add" data-add="exp" aria-label="追加">＋</button></div>`;
    h += st.recent.length ? `<div class="list">${st.recent.map(r => `<button class="item row" data-exp="${esc(r.id)}"><span class="tm num">${md(r.t)}</span><div class="bd"><b>${esc(r.n)}</b><small>${esc(r.c)}${r.st === '仮' ? ' ・ 照合待ち' : ''}</small></div><span class="num amt">${yen(r.a)}</span></button>`).join('')}</div><p class="note">タップで名前の修正・削除</p>`
      : '<p class="note">Apple Payで払うか、LINEで「コンビニ 466」と送るとここに出るよ</p>';
    pane.innerHTML = h;
  }

  function renderAll() { renderLobby(); renderTalk(); renderTask(); renderPlan(); renderLedger(); }

  // ---------- 操作 ----------
  const find = (list, id) => list.find(x => x.id === id);
  document.addEventListener('click', e => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-setting]'))) { e.stopPropagation(); openSetting(); return; }
    if ((b = t.closest('[data-tdone]'))) {
      const id = b.dataset.tdone; b.classList.add('on'); b.innerHTML = UI.icon('check', 13, 3); se.ok();
      setTimeout(() => act({ a:'done', id }, s => { s.tasks = s.tasks.filter(x => x.id !== id); }, [HO, 'おつかれ〜、1個片付いたね〜']), 350);
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

  // 予定は長押しで消す
  let lp = null;
  document.addEventListener('pointerdown', e => {
    const it = e.target.closest('[data-plan]'); if (!it) return;
    lp = setTimeout(() => {
      const p = find(st.plans, it.dataset.plan); if (!p) return;
      pop({ title:'予定を消す', body:`<div class="lead"><img src="av_hoshino.webp" alt=""><p>${md(p.t)} ${isAllDay(p.t) ? '' : p.t.slice(11, 16)}「${esc(p.n)}」を消すね〜？</p></div>`, buttons:[{ label:'やめる', cls:'gray' }, { label:'消す', onClick:() => {
        act({ a:'delplan', id:p.id }, s => { s.plans = s.plans.filter(x => x.id !== p.id); }, [HO, '消しといたよ〜']);
      } }] });
    }, 550);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(ev => document.addEventListener(ev, e => { if (ev !== 'pointermove' || Math.abs(e.movementY) > 3) clearTimeout(lp); }));

  renderAll();
  return { pull, renderAll, openSetting, hasConf:() => !!conf, state:() => st };
})();
