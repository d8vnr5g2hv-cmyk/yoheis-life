// ============================================================
// Yohei's Life — タイトル → ローディング → ロビー → 各画面（v0.5 GASとつなぐ）
// ============================================================
(async () => {
  const { $, $$, se, playBgm, playVoice, show, rise, pop, toast, paintIcons } = UI;
  paintIcons();
  const wallReady = Wall.load();

  const CH = {
    hoshino: { av:'av_hoshino.webp', chibi:'hoshino_chibi.webp', bgm:'bgm.mp3', voice:i => `c1_v${String(i).padStart(2, '0')}.mp3`, nv:12,
      lobby:['lobby_tall_h264.mp4', 'lobby_tall_poster.jpg'], art:['title_h_sleep.webp', 'title_h_wake.webp'],
      lines:['うへ〜、先生おかえり〜。今日もほどほどにね〜', '予定はおじさんが見とくから、先生はのんびりしてて〜', 'お昼寝……じゃなくて、休憩中だよ〜'],
      tips:['おじさん、ちょっとだけお昼寝……', '予定の1時間前には声かけるからね〜', 'LINEで送れば、おじさんが整理しとくよ〜'] },
    mika: { av:'av_mika.webp', chibi:'mika_chibi.webp', bgm:'c2_bgm.mp3', voice:i => `c2_v${String(i).padStart(2, '0')}.mp3`, nv:10,
      lobby:['mika_tall_h264.mp4', 'mika_tall_poster.jpg'], art:['title_m_sleep.webp', 'title_m_wake.webp'],
      lines:['先生、おかえり☆ 今日は何に使ったの？', 'お金のことは私に任せて！……たぶん☆', '給料日まで、一緒にがんばろっか'],
      tips:['お買い物は計画的に、だよ☆', 'Apple Payで払うと、私がすぐ記録するね', '滞納ゼロまで、あと少し！'] },
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let who = Math.random() < .5 ? 'hoshino' : 'mika';

  function setVideo(v, p, [src, poster]) {
    p.src = poster; v.style.opacity = 0; v.src = src; v.load();
    v.oncanplay = () => { v.play().catch(() => {}); v.style.opacity = 1; };
  }

  // ---------- タイトル ----------
  // タイトル：寝ている絵 → タッチで起きた絵へ（ホシノかミカ、開くたびにランダム）
  $('#tSleep').src = CH[who].art[0]; $('#tWake').src = CH[who].art[1];
  const fx = $('#tFx');
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('i'), z = 3 + Math.random() * 5;
    p.className = 'pt';
    p.style.cssText = `left:${Math.random() * 100}%;width:${z}px;height:${z}px;--dx:${(Math.random() - .5) * 60}px;animation-duration:${9 + Math.random() * 8}s;animation-delay:${-Math.random() * 14}s`;
    fx.appendChild(p);
  }
  let started = false;
  $('#title').addEventListener('click', () => {
    if (started) return; started = true;
    const c = CH[who];
    $('#title').classList.add('awake'); se.start();
    UI.unlockAudio(); playBgm('bgm_title.mp3', .4);          // タップの中で鳴らす（iPhone対策）
    playVoice(c.voice(1 + Math.floor(Math.random() * c.nv)));
    setTimeout(() => {
      $('.flash').classList.add('go');
      setTimeout(() => show('loading').then(load), 240);
    }, 1300);
  });

  // ---------- ローディング ----------
  const LOADS = [['load_1.webp', '先生、どっちと行くの？'], ['load_2.webp', 'おつかれさま、先生'], ['load_3.webp', 'どっちのお弁当にする？'], ['load_4.webp', 'お昼寝？ それともお買い物？']];
  function load() {
    const c = CH[who], [img, line] = pick(LOADS);
    $('#lImg').src = img; $('#lTip').textContent = line;
    setVideo($('#lbVideo'), $('#lbPoster'), c.lobby);
    const bar = $('#lBar'), t0 = performance.now(), ms = 1800;
    (function step(t) { const k = Math.min(1, (t - t0) / ms); bar.style.width = (k * 100) + '%'; k < 1 ? requestAnimationFrame(step) : wallReady.then(() => Wx.due() ? Wx.show(enterLobby) : enterLobby()); })(t0);   // その日最初はお天気から
  }

  // ---------- ロビー ----------
  let toasted = false;
  function enterLobby() {
    Wx.chip();
    Sync.renderAll();
    const got = Sync.pull(true);
    show('lobby').then(() => {
      playBgm(CH[who].bgm, .4);
      if (!Sync.hasConf()) { setTimeout(Sync.openSetting, 700); return; }
      Promise.resolve(got).then(st => {
        if (st && st.call && st.call.ring) { setTimeout(() => Call.incoming(st.call.who), 900); return; }   // 充電で呼ばれていたら着信
        if (toasted || !st) return; toasted = true;
        if (st.unknown.length) setTimeout(() => toast({ who:'ミカ', av:'av_mika.webp', text:`先生、使い道がわからないのが${st.unknown.length}件あるよ☆ 台帳で教えて` }), 1200);
      });
    });
  }
  // アプリに戻ってきたときも読み直す
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || $('#title').classList.contains('on')) return;
    Promise.resolve(Sync.pull(true)).then(st => { if (st && st.call && st.call.ring && $('#lobby').classList.contains('on')) Call.incoming(st.call.who); });
  });
  // おやすみ電話：ロビーのボタンでこちらからかける／終わったらロビーの曲に戻す
  document.addEventListener('click', e => { if (e.target.closest('[data-call]')) { const st = Sync.state(); Call.dial(st && st.call ? st.call.who : Call.tonight()); } });
  window.addEventListener('callend', () => { playBgm(CH[who].bgm, .4); Sync.pull(true); });

  $('#tapzone').addEventListener('click', () => {
    const c = CH[who]; playVoice(c.voice(1 + Math.floor(Math.random() * c.nv)));   // ロビーは声だけ（吹き出しなし）
  });
  $('#swap').addEventListener('click', () => {
    who = who === 'hoshino' ? 'mika' : 'hoshino';
    $('#swap').textContent = who === 'hoshino' ? '1/2' : '2/2';
    setVideo($('#lbVideo'), $('#lbPoster'), CH[who].lobby); playBgm(CH[who].bgm, .4);
  });

  // ---------- 各画面へ（開くたびに壁紙をランダムで） ----------
  function openScreen(id) {
    const s = $('#' + id);
    setPage(s, 1, false);
    s.querySelector('.s2').classList.remove('indetail');
    if (id === 'ledger') Wall.render();
    Sync.pull();
    show(id, { before:() => Wall.apply($('.wall', s), Wall.pick(s.dataset.who, id)) });
  }
  // 1枚目（壁紙）⇔ 2枚目（機能）
  function setPage(s, n, fx = true) {
    const was = s.classList.contains('p2');
    s.classList.toggle('p2', n === 2);
    $$('.dots i', s).forEach((d, i) => d.classList.toggle('on', i === n - 1));
    if (fx && was !== (n === 2)) {
      const f = document.createElement('i'); f.className = 'slidefx' + (n === 1 ? ' back' : ''); document.body.appendChild(f); setTimeout(() => f.remove(), 520);
      se.wipe(); if (n === 2) rise($('.s2', s));
    }
  }
  $$('.wscreen').forEach(s => {
    $('[data-next]', s).addEventListener('click', () => setPage(s, 2));
    let x0 = null, y0 = 0;
    s.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive:true });
    s.addEventListener('touchend', e => {
      if (window.__sw) return;                          // 一覧の項目をスワイプ中はページを変えない
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) setPage(s, dx < 0 ? 2 : 1);
    }, { passive:true });
  });
  $$('[data-go]').forEach(b => b.addEventListener('click', () => openScreen(b.dataset.go)));
  $$('[data-back]').forEach(b => b.addEventListener('click', () => show('lobby')));

  // ロビーの⤢（絵だけ表示）
  $$('#lobby [data-expand]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); $('#lobby').classList.toggle('hideui'); }));
  $('#lobby').addEventListener('click', e => { if ($('#lobby').classList.contains('hideui') && !e.target.closest('[data-expand]')) $('#lobby').classList.remove('hideui'); });

  // 台帳：カードを選んで中へ
  const DT = { money:'Money', body:'Body', people:'People', vault:'Vault', wall:'Wallpaper' };
  $$('.lcard').forEach(c => c.addEventListener('click', () => {
    const p = c.dataset.p, sh = $('#ledger .s2');
    $$('#ledger .pane').forEach(x => x.classList.toggle('on', x.id === 'p-' + p));
    $('#dTitle').textContent = DT[p];
    if (p === 'wall') Wall.render();
    sh.classList.add('indetail'); $('.in', sh).scrollTop = 0; rise($('#p-' + p));
    $$('[data-count]', $('#p-' + p)).forEach(UI.countUp);
  }));
  $('[data-dback]').addEventListener('click', () => { $('#ledger .s2').classList.remove('indetail'); rise($('#ledger .lselect')); });

  // 音のオン・オフ（覚えておく）
  let muted = localStorage.getItem('yl-mute') === '1';
  const paintSnd = () => { $('#snd').innerHTML = UI.icon(muted ? 'mute' : 'sound', 15, 2.4); };
  UI.mute(muted); paintSnd();
  $('#snd').addEventListener('click', e => { e.stopPropagation(); muted = !muted; localStorage.setItem('yl-mute', muted ? '1' : '0'); UI.mute(muted); paintSnd(); });

})();
