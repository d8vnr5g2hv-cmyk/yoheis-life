// ============================================================
// Yohei's Life — タイトル → ローディング → ロビー → 各画面（見本 v0.2）
// ============================================================
(async () => {
  const { $, $$, se, playBgm, playVoice, show, rise, pop, toast, paintIcons } = UI;
  paintIcons();
  const wallReady = Wall.load();

  const CH = {
    hoshino: { av:'av_hoshino.webp', chibi:'hoshino_chibi.webp', bgm:'bgm.mp3', voice:i => `c1_v${String(i).padStart(2, '0')}.mp3`, nv:12,
      lobby:['lobby_tall_h264.mp4', 'lobby_tall_poster.jpg'], title:['09_aquarium_tall_h264.mp4', '09_aquarium_tall_poster.jpg'],
      lines:['うへ〜、先生おかえり〜。今日もほどほどにね〜', '予定はおじさんが見とくから、先生はのんびりしてて〜', 'お昼寝……じゃなくて、休憩中だよ〜'],
      tips:['おじさん、ちょっとだけお昼寝……', '予定の1時間前には声かけるからね〜', 'LINEで送れば、おじさんが整理しとくよ〜'] },
    mika: { av:'av_mika.webp', chibi:'mika_chibi.webp', bgm:'c2_bgm.mp3', voice:i => `c2_v${String(i).padStart(2, '0')}.mp3`, nv:10,
      lobby:['mika_tall_h264.mp4', 'mika_tall_poster.jpg'], title:['16_mika_night_tall_h264.mp4', '16_mika_night_tall_poster.jpg'],
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
  setVideo($('#tVideo'), $('#tPoster'), CH[who].title);
  let started = false;
  $('#title').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) { pop({ title:b.dataset.act, body:`<div class="list"><div class="item"><div class="bd"><b>見本では、まだ中身はありません</b></div></div></div>` }); return; }
    if (started) return; started = true;
    se.start(); $('.flash').classList.add('go'); playBgm('bgm_title.mp3', .4);
    setTimeout(() => show('loading').then(load), 240);
  });

  // ---------- ローディング ----------
  function load() {
    const c = CH[who];
    $('#lImg').src = c.chibi; $('#lTip').textContent = pick(c.tips);
    setVideo($('#lbVideo'), $('#lbPoster'), c.lobby);
    const bar = $('#lBar'), t0 = performance.now(), ms = 1800;
    (function step(t) { const k = Math.min(1, (t - t0) / ms); bar.style.width = (k * 100) + '%'; k < 1 ? requestAnimationFrame(step) : wallReady.then(enterLobby); })(t0);
  }

  // ---------- ロビー ----------
  function fillTop() {
    const d = new Date();
    $('#lvDate').textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $('#lvDay').textContent = '日月火水木金土'[d.getDay()];
    let pay = new Date(d.getFullYear(), d.getMonth(), 15); if (d.getDate() >= 15) pay = new Date(d.getFullYear(), d.getMonth() + 1, 15);
    $('#lvPay').textContent = Math.ceil((pay - d) / 864e5);
  }
  let toasted = false;
  function enterLobby() {
    fillTop();
    show('lobby').then(() => {
      playBgm(CH[who].bgm, .4);
      if (!toasted) { toasted = true; setTimeout(() => toast({ who:'ミカ', av:'av_mika.webp', text:'11/21 19:29の466円って何？' }), 1500); }
    });
  }
  let sayT;
  $('#tapzone').addEventListener('click', () => {
    const c = CH[who]; playVoice(c.voice(1 + Math.floor(Math.random() * c.nv)));
    $('#sayText').textContent = pick(c.lines); $('#say').classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => $('#say').classList.remove('on'), 3000);
  });
  $('#swap').addEventListener('click', () => {
    who = who === 'hoshino' ? 'mika' : 'hoshino';
    $('#swap').textContent = who === 'hoshino' ? '1/2' : '2/2';
    setVideo($('#lbVideo'), $('#lbPoster'), CH[who].lobby); playBgm(CH[who].bgm, .4); $('#say').classList.remove('on');
  });

  // ---------- 各画面へ（開くたびに壁紙をランダムで） ----------
  function openScreen(id) {
    const s = $('#' + id);
    s.classList.remove('hideui'); $('.sheet', s).classList.remove('full');
    if (id === 'ledger') Wall.render();
    show(id, { before:() => Wall.apply($('.wall', s), Wall.pick(s.dataset.who, id)) });
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', () => openScreen(b.dataset.go)));
  $$('[data-back]').forEach(b => b.addEventListener('click', () => show('lobby')));

  // シートの引き上げ・絵だけ表示
  $$('[data-sheet]').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('full')));
  $$('.more').forEach(m => m.addEventListener('click', () => m.closest('.sheet') && m.closest('.sheet').classList.add('full')));
  $$('[data-expand]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); b.closest('.screen').classList.toggle('hideui'); }));
  $$('.screen').forEach(s => s.addEventListener('click', e => {
    if (s.classList.contains('hideui') && !e.target.closest('[data-expand]')) s.classList.remove('hideui');
  }));

  // 台帳のタブ
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#seg button').forEach(x => x.classList.toggle('on', x === b));
    $$('#ledger .pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + b.dataset.p));
    if (b.dataset.p === 'wall') Wall.render();
    rise($('#p-' + b.dataset.p));
  });
  // チェックの切り替え（見本）
  $$('.check').forEach(c => c.addEventListener('click', () => { c.classList.toggle('on'); if (c.classList.contains('on') && !c.innerHTML) c.innerHTML = UI.icon('check', 13, 3); }));
})();
