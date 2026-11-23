// ============================================================
// Yohei's Life — おやすみ電話（ホシノ・ミカ）
// 着信 → 出る → 今日のふり返り → 「今日どうだった？」→ Claudeの返事 → おやすみ
// ============================================================
const Call = (() => {
  const { $, se, playBgm, playVoice } = UI;
  const IMG = {
    hoshino:[['nc_hoshino_n.webp', 'nc_hoshino_s.webp'], ['call_hoshino_m.webp', 'call_hoshino_s.webp']],
    mika:[['nc_mika_n.webp', 'nc_mika_s.webp']],
  };
  const NAME = { hoshino:'小鳥遊ホシノ', mika:'聖園ミカ' }, SHORT = { hoshino:'ホシノ', mika:'ミカ' };
  const BG = { hoshino:'title_h_wake.webp', mika:'title_m_wake.webp' };
  const VOICE = { hoshino:n => `c1_v${String(n).padStart(2, '0')}.mp3`, mika:n => `c2_v${String(n).padStart(2, '0')}.mp3` }, NV = { hoshino:12, mika:10 };
  const CHOICES = [['good', 'いい日だった'], ['soso', 'まあまあかな'], ['tired', '疲れた…']];
  const yen = n => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
  let who, face, lines = [], li = 0, typing = null, timer = null, t0 = 0, ringer = null, on = false, waiting = false;

  // 今夜の担当（日ごとに交互。朝4時までは前の日の夜）— GASと同じ計算
  function tonight() {
    const d = new Date(Date.now() - 4 * 3600e3), k = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 9 * 3600e3;   // 日本の0時に合わせる
    return Math.floor(k / 864e5) % 2 ? 'mika' : 'hoshino';
  }

  // ---------- 着信音（電子音の2連打をくり返す） ----------
  function ringStart() {
    ringStop();
    let ac; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; }
    const beep = (t, f) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .02); g.gain.setValueAtTime(.08, t + .16); g.gain.linearRampToValueAtTime(0, t + .2); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .22); };
    const once = () => { const t = ac.currentTime + .02; beep(t, 1320); beep(t + .26, 1760); beep(t + .6, 1320); beep(t + .86, 1760); };
    once(); ringer = { ac, id:setInterval(once, 2600) };
  }
  function ringStop() { if (ringer) { clearInterval(ringer.id); try { ringer.ac.close(); } catch (_) {} ringer = null; } }

  // ---------- セリフ ----------
  function script(w) {
    const st = typeof Sync !== 'undefined' && Sync.state(), r = st && st.call && st.call.recap;
    const H = w === 'hoshino', L = [];
    L.push({ t:H ? 'うへ〜、先生。こんな時間まで起きてたの〜？ おじさんはもうおねむだよ〜。' : '先生、まだ起きてたんだ。ふふ、声が聞けてうれしいな☆', f:H ? 'n' : 's' });
    if (r) {
      const done = r.done && r.done.length ? (H ? `「${r.done[0]}」も終わらせたんでしょ〜？ えらいえらい〜。` : `「${r.done[0]}」もちゃんと終わらせたじゃん☆`) : '';
      L.push({ t:(r.spent > 0 ? (H ? `今日は${yen(r.spent)}使ったみたいだね〜。` : `今日は${yen(r.spent)}使ったよね。ちゃんと見てるんだから☆`) : (H ? '今日はお金、使わなかったみたいだね〜。' : '今日はお金使わなかったね。やるじゃん☆')) + done, f:'s' });
      const nx = r.next ? `明日は${r.next.t.slice(11, 16) === '09:00' ? '' : r.next.t.slice(11, 16) + 'から'}「${r.next.n}」${H ? 'だよ〜。' : 'があるよ。'}` : (H ? '明日は予定なしだよ〜。' : '明日は予定なし！ ゆっくりできるね。');
      L.push({ t:nx + (H ? `給料日まで、あと${r.paydayIn}日〜。` : ` 給料日まであと${r.paydayIn}日、一緒にがんばろ☆`), f:'n' });
    } else {
      L.push({ t:H ? '今日も一日おつかれさま〜。' : '今日も一日おつかれさま、先生☆', f:'s' });
    }
    L.push({ t:H ? '……で、今日はどうだった〜？' : 'ねえ、今日はどうだった？', f:'n', choice:true });
    return L;
  }
  const BYE = { hoshino:'じゃあ、そろそろ寝よっか〜。おやすみ、先生〜。また明日ね〜。', mika:'そろそろ寝よっか。おやすみ、先生……また明日ね☆' };
  const FALL = {
    hoshino:{ good:'うへ〜、それはよかったねえ。おじさんもうれしいよ〜。', soso:'まあまあなら上出来だよ〜。がんばりすぎなくていいからね〜。', tired:'おつかれさま、先生〜。今日はもう何も考えずに、ゆっくり寝ちゃお〜。' },
    mika:{ good:'ほんと？ よかった☆ 先生が楽しそうだと、私までうれしくなっちゃう。', soso:'まあまあかぁ。でも、ちゃんと一日終えたんだから、えらいよ先生☆', tired:'つかれたよね……。今日はもう、あったかくしてゆっくり寝よ？' },
  };

  // ---------- 画面 ----------
  function setFace(f) {
    const img = $('#cFace'), src = face[f === 's' ? 1 : 0];
    if (img.getAttribute('src') === src) return;
    img.classList.add('blink'); setTimeout(() => { img.src = src; img.classList.remove('blink'); }, 90);
  }
  function say(line) {
    clearInterval(typing);
    const p = $('#cText'), ch = $('#cCh'); ch.innerHTML = ''; p.textContent = '';
    $('#cBox').classList.toggle('wait', false);
    setFace(line.f); let i = 0;
    typing = setInterval(() => {
      p.textContent = line.t.slice(0, ++i);
      if (i >= line.t.length) { clearInterval(typing); typing = null; done(line); }
    }, 38);
  }
  function done(line) {
    const box = $('#cBox');
    if (line.choice) {
      box.classList.add('choosing'); box.classList.remove('cmore');
      $('#cCh').innerHTML = CHOICES.map(([k, v]) => `<button class="cc" data-mood="${k}">${v}</button>`).join('');
    } else box.classList.toggle('cmore', !line.end);
  }
  function next() {
    if (waiting) return;
    if (typing) { clearInterval(typing); typing = null; $('#cText').textContent = lines[li].t; done(lines[li]); return; }
    const cur = lines[li]; if (!cur || cur.choice) return;
    if (cur.end) { hangup(); return; }
    li++; if (lines[li]) { se.tap(); say(lines[li]); }
  }
  async function answerMood(mood, label) {
    if (waiting) return; waiting = true;
    $('#cBox').classList.remove('choosing'); $('#cCh').innerHTML = '';
    $('#cText').innerHTML = `<span class="me">${label}</span>`; se.ok();
    $('#cBox').classList.add('wait');
    let text = null;
    try {
      const c = JSON.parse(localStorage.getItem('yl-conf') || 'null');
      if (c) {
        const r = await fetch(c.url, { method:'POST', body:JSON.stringify({ key:c.key, a:'callreply', who, mood }) });
        const j = await r.json(); text = j.ok && j.text;
      }
    } catch (_) {}
    waiting = false;
    lines.push({ t:text || FALL[who][mood], f:'s' }, { t:BYE[who], f:'s', end:true });
    li++; say(lines[li]);
  }

  function open(w, mode) {
    who = w || tonight();
    const sets = IMG[who]; face = sets[Math.floor(Math.random() * sets.length)];
    $('#cBg').src = BG[who]; $('#cFace').src = face[0];
    $('#cName').textContent = NAME[who]; $('#cWho').textContent = SHORT[who];
    $('#cText').textContent = ''; $('#cCh').innerHTML = ''; $('#cBox').className = 'cbox';
    $('#cEnd').classList.remove('on');
    const s = $('#call'); s.classList.remove('ring', 'talk', 'dial'); s.classList.add(mode);
    $('#cTime').textContent = mode === 'dial' ? '呼び出し中…' : '着信中…';
    lines = script(who); li = 0; on = true;
    return UI.show('call');
  }
  // かかってくる
  function incoming(w) {
    if (on || Date.now() - Number(localStorage.getItem('yl-decl') || 0) < 20 * 60e3) return;   // 「あとで」から20分は鳴らさない
    open(w, 'ring').then(ringStart);
  }
  // こちらからかける（少し呼び出してから相手が出る）
  function dial(w) {
    if (on) return;
    open(w, 'dial').then(() => { ringStart(); setTimeout(() => { if (on && $('#call').classList.contains('dial')) answer(); }, 2600); });
  }
  function answer() {
    ringStop(); se.ok();
    const s = $('#call'); s.classList.remove('ring', 'dial'); s.classList.add('talk');
    playBgm('night_bgm.mp3', .32);
    playVoice(VOICE[who](1 + Math.floor(Math.random() * NV[who])));
    t0 = Date.now(); clearInterval(timer);
    const tick = () => { const sec = Math.floor((Date.now() - t0) / 1000); $('#cTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
    tick(); timer = setInterval(tick, 1000);
    setTimeout(() => say(lines[0]), 600);
  }
  function close() {
    on = false; ringStop(); clearInterval(timer); clearInterval(typing); typing = null; waiting = false;
    UI.show('lobby').then(() => window.dispatchEvent(new Event('callend')));
  }
  function decline() { localStorage.setItem('yl-decl', Date.now()); se.close(); close(); }
  function hangup() {
    if (!on) return;
    const sec = t0 ? Math.floor((Date.now() - t0) / 1000) : 0;
    clearInterval(timer); clearInterval(typing); ringStop(); se.close();
    try {
      const c = JSON.parse(localStorage.getItem('yl-conf') || 'null');
      if (c && sec > 0) fetch(c.url, { method:'POST', body:JSON.stringify({ key:c.key, a:'callend', who, sec }) });
    } catch (_) {}
    $('#cDur').textContent = `通話時間 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#cEndT').textContent = who === 'mika' ? 'おやすみ、先生☆' : 'おやすみ〜、先生';
    $('#cEnd').classList.add('on');
    setTimeout(close, 2600);
  }

  // ---------- 操作 ----------
  document.addEventListener('click', e => {
    if (!on) return;
    const t = e.target;
    if (t.closest('[data-cyes]')) { answer(); return; }
    if (t.closest('[data-cno]')) { decline(); return; }
    if (t.closest('[data-chang]')) { hangup(); return; }
    const m = t.closest('[data-mood]'); if (m) { answerMood(m.dataset.mood, m.textContent); return; }
    if (t.closest('#cBox') || t.closest('.cfig')) next();
  });

  return { incoming, dial, tonight, isOn:() => on };
})();
