// ============================================================
// Yohei's Life — タイトル → ローディング → ロビー（見本）
// ============================================================
(() => {
  const { $, $$, se, playBgm, playVoice, show, rise, pop, toast, paintIcons } = UI;
  paintIcons();

  // ---------- キャラ ----------
  const CH = {
    hoshino: { name:'ホシノ', av:'av_hoshino.webp', chibi:'hoshino_chibi.webp', bgm:'bgm.mp3', voice:i => `c1_v${String(i).padStart(2, '0')}.mp3`, nv:12,
      lobbies:[['lobby_tall_h264.mp4', 'lobby_tall_poster.jpg'], ['09_aquarium_tall_h264.mp4', '09_aquarium_tall_poster.jpg']],
      lines:['うへ〜、先生おかえり〜。今日もほどほどにね〜', '予定はおじさんが見とくから、先生はのんびりしてて〜', 'お昼寝……じゃなくて、休憩中だよ〜'],
      tips:['おじさん、ちょっとだけお昼寝……', '予定の1時間前には声かけるからね〜', 'LINEで送れば、おじさんが整理しとくよ〜'] },
    mika: { name:'ミカ', av:'av_mika.webp', chibi:'mika_chibi.webp', bgm:'c2_bgm.mp3', voice:i => `c2_v${String(i).padStart(2, '0')}.mp3`, nv:10,
      lobbies:[['mika_tall_h264.mp4', 'mika_tall_poster.jpg'], ['16_mika_night_tall_h264.mp4', '16_mika_night_tall_poster.jpg']],
      lines:['先生、おかえり☆ 今日は何に使ったの？', 'お金のことは私に任せて！……たぶん☆', '給料日まで、一緒にがんばろっか'],
      tips:['お買い物は計画的に、だよ☆', 'Apple Payで払うと、私がすぐ記録するね', '滞納ゼロまで、あと少し！'] },
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let who = Math.random() < .5 ? 'hoshino' : 'mika';

  function setVideo(v, p, [src, poster]) {
    p.src = poster; v.style.opacity = 0;
    v.src = src; v.load();
    v.oncanplay = () => { v.play().catch(() => {}); v.style.opacity = 1; };
  }

  // ---------- タイトル ----------
  const [tSrc] = [pick(CH[who].lobbies)];
  setVideo($('#tVideo'), $('#tPoster'), tSrc);

  let started = false;
  $('#title').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const t = { notice:'お知らせ', menu:'メニュー', data:'データの設定' }[b.dataset.act];
      pop({ title:t, body:`<div class="tray"><div class="row"><span class="t">見本では中身はまだありません</span></div></div>` });
      return;
    }
    if (started) return; started = true;
    se.start(); $('.flash').classList.add('go');
    playBgm('bgm_title.mp3', .4);
    setTimeout(() => show('loading').then(load), 260);
  });

  // ---------- ローディング ----------
  function load() {
    const c = CH[who];
    $('#lImg').src = c.chibi; $('#lTip').textContent = pick(c.tips);
    const bar = $('#lBar'), t0 = performance.now(), ms = 2000;
    // 本番ではここで素材を先読みする。見本は時間で進める
    const v = $('#lbVideo'); setVideo(v, $('#lbPoster'), c.lobbies[0]);
    (function step(t) {
      const k = Math.min(1, (t - t0) / ms); bar.style.width = (k * 100) + '%';
      k < 1 ? requestAnimationFrame(step) : enterLobby();
    })(t0);
  }

  // ---------- ロビー ----------
  function fillTop() {
    const d = new Date(), wd = '日月火水木金土'[d.getDay()];
    $('#lvDate').textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $('#lvDay').textContent = wd + '曜日';
    let pay = new Date(d.getFullYear(), d.getMonth(), 15);
    if (d.getDate() >= 15) pay = new Date(d.getFullYear(), d.getMonth() + 1, 15);
    const prev = new Date(pay.getFullYear(), pay.getMonth() - 1, 15);
    const left = Math.ceil((pay - d) / 864e5), span = Math.round((pay - prev) / 864e5);
    $('#lvPay').textContent = left + '日';
    $('#lvGauge').dataset.to = Math.round((1 - left / span) * 100);
  }
  function enterLobby() {
    fillTop();
    show('lobby').then(() => {
      playBgm(CH[who].bgm, .4);
      setTimeout(() => toast({ who:'ミカ', av:'av_mika.webp', text:'11/21 19:29の466円って何？' }), 1400);
    });
  }

  let li = 0, sayT;
  function say() {
    const c = CH[who]; playVoice(c.voice(1 + Math.floor(Math.random() * c.nv)));
    $('#sayText').textContent = pick(c.lines); $('#say').classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => $('#say').classList.remove('on'), 3200);
  }
  $('#tapzone').addEventListener('click', say);
  $('#swap').addEventListener('click', () => {
    who = who === 'hoshino' ? 'mika' : 'hoshino'; li = 0;
    $('#swap').textContent = who === 'hoshino' ? '1/2' : '2/2';
    setVideo($('#lbVideo'), $('#lbPoster'), CH[who].lobbies[0]);
    playBgm(CH[who].bgm, .4); $('#say').classList.remove('on');
  });

  // ---------- 見本ページへ ----------
  $$('[data-go]').forEach(b => b.addEventListener('click', () => {
    $('#kitTitle').textContent = b.dataset.go;
    show('kit');
  }));
  $$('[data-back]').forEach(b => b.addEventListener('click', () => show('lobby')));

  // タブ・サイドタブ・ラジオ
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#side').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#side button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#radio').addEventListener('click', e => { const l = e.target.closest('label'); if (!l) return; $$('#radio label').forEach(x => x.classList.toggle('on', x === l)); });

  $('#openPop').addEventListener('click', () => pop({
    title:'アカウント',
    body:`<div class="tray"><div class="row"><span class="t">LINEの連携</span><button class="bt"><i class="shine"></i><span>OK</span></button></div>
      <div class="row"><span class="t">壁紙の管理</span><button class="bt"><i class="shine"></i><span>進む</span></button></div>
      <div class="row"><span class="t">データの控え</span><button class="bt"><i class="shine"></i><span>OK</span></button></div></div>`,
    buttons:[{ label:'閉じる', cls:'navy' }],
  }));
  $('#openToast').addEventListener('click', () => toast({ who:'ホシノ', av:'av_hoshino.webp', text:'先生〜、19時から山下さんと梅田だよ〜' }));

  // 画面ごとの「出てくる動き」
  rise($('#title'));
})();
