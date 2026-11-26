const $ = id => document.getElementById(id);
const socket = io();

const PROMPTS = [
  'แมวใส่แว่นกันแดดนั่งชายหาด', 'ช้างเล่นสเก็ตบอร์ด', 'บ้านในฝันของคุณ', 'หัวหน้าตอนวันจันทร์', 'อาหารจานโปรด',
  'ไดโนเสาร์ไปทำงานออฟฟิศ', 'มนุษย์ต่างดาวกินส้มตำ', 'ตัวเองอีก 10 ปีข้างหน้า', 'สัตว์ประจำทีมของเรา', 'วันหยุดที่ดีที่สุด',
  'ปลาทองขับรถตุ๊กตุ๊ก', 'หุ่นยนต์ทำอาหาร', 'สิ่งที่ทำให้ยิ้มได้ทุกวัน', 'ซูเปอร์ฮีโร่ประจำออฟฟิศ', 'ต้นไม้ที่ออกผลเป็นขนม',
  'เพนกวินไปเที่ยวทะเลทราย', 'ประชุมออนไลน์ที่วุ่นวายที่สุด', 'รถไฟฟ้าแห่งอนาคต', 'ช่วงเวลาที่เขินที่สุด', 'ตัวละครในฝันของคุณ',
  'ปาร์ตี้สิ้นปี', 'ยานอวกาศรูปทุเรียน', 'กาแฟแก้วแรกของวัน', 'สัตว์เลี้ยงในอุดมคติ', 'เมืองใต้น้ำ',
];
const TIMES = [[30, '30 วินาที'], [60, '1 นาที'], [90, '1 นาที 30 วิ'], [120, '2 นาที'], [180, '3 นาที'], [300, '5 นาที'], [420, '7 นาที'], [600, '10 นาที'], [900, '15 นาที']];
const fmtDur = s => s < 60 ? `${s} วินาที` : (s % 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วิ` : `${s / 60} นาที`);
const randPrompt = (avoid = []) => { const pool = PROMPTS.filter(p => !avoid.includes(p)); return pool[Math.floor(Math.random() * pool.length)] || PROMPTS[0]; };

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'style') n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  kids.flat().forEach(c => c != null && n.append(c));
  return n;
}

// ===================== BUILDER =====================
let settings = JSON.parse(localStorage.getItem('dp_settings') || 'null') || {
  title: '', maxPlayers: 30, voting: true, voteSeconds: 30, showNames: true, showPromptOnPhone: true,
  rounds: [{ prompt: randPrompt(), seconds: 120 }],
};

function readBuilder() {
  settings.title = $('title').value;
  settings.maxPlayers = +$('maxPlayers').value || 30;
  settings.voting = $('voting').checked;
  settings.voteSeconds = +$('voteSeconds').value;
  settings.showNames = $('showNames').checked;
  settings.showPromptOnPhone = $('showPromptOnPhone').checked;
  localStorage.setItem('dp_settings', JSON.stringify(settings));
}

function renderRounds() {
  const box = $('rounds'); box.textContent = '';
  settings.rounds.forEach((r, i) => {
    const inp = el('input', { class: 'input', maxlength: 120, placeholder: 'โจทย์ เช่น แมวใส่แว่นกันแดด' });
    inp.value = r.prompt;
    inp.addEventListener('input', () => { r.prompt = inp.value; summarize(); });
    const sel = el('select', { class: 'input' }, TIMES.map(([v, t]) => el('option', { value: v, text: t })));
    if (!TIMES.some(([v]) => v === r.seconds)) sel.append(el('option', { value: r.seconds, text: fmtDur(r.seconds) }));
    sel.value = r.seconds;
    sel.addEventListener('change', () => { r.seconds = +sel.value; summarize(); });
    box.append(el('div', { class: 'round' },
      el('div', { class: 'num', text: i + 1 }), inp,
      el('button', { class: 'iconbtn', title: 'สุ่มโจทย์', onclick: () => { r.prompt = randPrompt(settings.rounds.map(x => x.prompt)); inp.value = r.prompt; summarize(); } }, '🎲'),
      sel,
      el('button', { class: 'iconbtn del', title: 'ลบรอบนี้', onclick: () => { if (settings.rounds.length > 1) { settings.rounds.splice(i, 1); renderRounds(); } } }, '✕')));
  });
  summarize();
}

function summarize() {
  readBuilder();
  const s = settings, n = s.rounds.length;
  const drawSec = s.rounds.reduce((a, r) => a + r.seconds, 0);
  const total = Math.ceil((drawSec + n * 45 + (s.voting ? n * (s.voteSeconds + 30) : 0) + 120) / 60);
  $('sumLead').innerHTML = '';
  $('sumLead').append('สรุปเกมวาดรูปความยาวประมาณ ', el('b', { text: `${total} นาที` }), ' สำหรับผู้เล่นสูงสุด ', el('b', { text: `${s.maxPlayers} คน` }), ':');
  $('sumRounds').textContent = `${n} รอบ`;
  $('sumRoundsP').textContent = n === 1
    ? `ทุกคนวาดบนมือถือ ${fmtDur(s.rounds[0].seconds)} จากนั้นรูปทั้งหมดจะขึ้นจอกลางพร้อมกัน`
    : `วาดรวม ${fmtDur(drawSec)} จบแต่ละรอบ รูปทุกคนจะขึ้นจอกลาง ก่อนไปโจทย์ถัดไป`;
  $('sumVote').textContent = s.voting ? 'เปิด' : 'ปิด';
  $('sumVoteP').textContent = s.voting
    ? `ทุกคนมีเวลา ${fmtDur(s.voteSeconds)} โหวตรูปที่ชอบที่สุด (โหวตให้ตัวเองไม่ได้) แล้วประกาศผลบนจอ`
    : 'แค่วาดแล้วชมรูปบนจอกลาง ไม่ต้องแข่ง ทุกคนสนุกได้เท่ากัน';
  $('sumWall').textContent = s.showNames ? 'มีชื่อ' : 'ไม่ระบุชื่อ';
  $('sumWallP').textContent = s.showNames
    ? 'ทุกรูปบนจอกลางมีชื่อคนวาดกำกับ'
    : 'ซ่อนชื่อคนวาด ทายกันเองว่าใครวาดรูปไหน';
  $('voteSecWrap').style.opacity = s.voting ? 1 : .4;
}

function loadBuilder() {
  $('title').value = settings.title; $('maxPlayers').value = settings.maxPlayers;
  $('voting').checked = settings.voting; $('voteSeconds').value = settings.voteSeconds;
  $('showNames').checked = settings.showNames; $('showPromptOnPhone').checked = settings.showPromptOnPhone;
  renderRounds();
}
['title', 'maxPlayers', 'voting', 'voteSeconds', 'showNames', 'showPromptOnPhone'].forEach(k => $(k).addEventListener('input', summarize));
$('addRound').onclick = () => {
  if (settings.rounds.length >= 20) return;
  settings.rounds.push({ prompt: randPrompt(settings.rounds.map(x => x.prompt)), seconds: settings.rounds.at(-1)?.seconds || 120 });
  renderRounds();
};

let roomCode = null;
$('create').onclick = () => {
  readBuilder();
  if (roomCode && state?.phase === 'lobby') {
    socket.emit('host:settings', settings, () => showLive());
    return;
  }
  $('create').disabled = true;
  socket.emit('host:create', settings, res => {
    $('create').disabled = false;
    if (!res.ok) return alert('สร้างห้องไม่สำเร็จ');
    roomCode = res.code;
    sessionStorage.setItem('dp_host', JSON.stringify({ code: res.code, token: res.token }));
    setupJoin();
    showLive();
  });
};

// ===================== LIVE =====================
let state = null, offset = 0;

function showLive() { $('builder').classList.add('hidden'); $('live').classList.remove('hidden'); }
function showBuilder() { $('live').classList.add('hidden'); $('builder').classList.remove('hidden'); loadBuilder(); window.scrollTo(0, 0); }

async function setupJoin() {
  let origin = location.origin;
  if (/^(localhost|127\.)/.test(location.hostname)) {
    try { const info = await (await fetch('/info')).json(); if (info.ips[0]) origin = `${location.protocol}//${info.ips[0]}:${location.port || info.port}`; } catch {}
  }
  const url = `${origin}/play.html?code=${roomCode}`;
  $('joinUrl').textContent = origin.replace(/^https?:\/\//, '') + '/play.html';
  $('qrImg').src = '/qr?u=' + encodeURIComponent(url);
}

const imgUrl = (r, pid) => `/img/${state.code}/${r}/${pid}`;

function show(id) {
  ['s-lobby', 's-drawing', 's-wall', 's-results', 's-final'].forEach(s => $(s).classList.toggle('hidden', s !== id));
}

function chips(box, players, mode) {
  box.textContent = '';
  players.forEach(p => {
    const c = el('span', { class: 'chip' + (p.connected ? '' : ' off') + (mode === 'draw' && p.submitted ? ' done' : '') }, p.name);
    if (mode === 'draw' && p.submitted) c.prepend('✓');
    if (mode === 'lobby') c.append(el('button', { class: 'x', title: 'เอาออกจากห้อง', onclick: () => confirm(`เอา ${p.name} ออกจากห้อง?`) && socket.emit('host:kick', p.id) }, '✕'));
    box.append(c);
  });
}

function tileSize(n) { return n <= 4 ? '300px' : n <= 9 ? '240px' : n <= 16 ? '200px' : n <= 30 ? '170px' : '140px'; }

// Keep tiles keyed by drawing so re-renders don't replay the pop-in animation
function renderWall(box, round, drawings, { numbered = false, tally = null, names = true } = {}) {
  const key = `${state.code}:${round}`;
  if (box.dataset.key !== key) { box.textContent = ''; box.dataset.key = key; }
  box.style.setProperty('--tile', tileSize(drawings.length));
  const have = new Map([...box.children].map(c => [c.dataset.pid, c]));
  drawings.forEach((d, i) => {
    let t = have.get(d.pid);
    const name = names ? d.name : '';
    if (!t) {
      t = el('div', { class: 'tile', style: `animation-delay:${Math.min(i, 20) * 70}ms` },
        el('img', { src: imgUrl(round, d.pid), alt: `รูปของ ${d.name}`, loading: 'lazy' }));
      t.dataset.pid = d.pid;
      t.addEventListener('click', () => openLightbox(imgUrl(round, d.pid), name));
      box.append(t);
    }
    t.querySelectorAll('.nm,.no,.votes').forEach(n => n.remove());
    if (name) t.append(el('div', { class: 'nm', text: name }));
    if (numbered) t.append(el('div', { class: 'no', text: i + 1 }));
    if (tally) t.append(el('div', { class: 'votes', text: `${tally[d.pid] || 0}` }));
  });
  if (!drawings.length && !box.querySelector('.empty')) box.append(el('div', { class: 'empty', text: 'ยังไม่มีรูปในรอบนี้' }));
}

function openLightbox(src, cap) { $('lbImg').src = src; $('lbCap').textContent = cap; $('lightbox').classList.remove('hidden'); }
$('lightbox').onclick = () => $('lightbox').classList.add('hidden');

let finalTab = 0;
function render() {
  const s = state; if (!s) return;
  const R = s.settings.rounds, r = s.round, total = R.length;
  const online = s.players.filter(p => p.connected);
  $('roomCode').textContent = s.code;
  $('roundInfo').textContent = r >= 0 && s.phase !== 'final' ? `รอบ ${r + 1}/${total}` : '';
  $('btnAdd').classList.toggle('hidden', !['drawing', 'voting'].includes(s.phase));
  const nextLabel = {
    lobby: 'เริ่มเกม →', drawing: 'จบเวลาเลย →',
    gallery: s.settings.voting ? 'เริ่มโหวต →' : (r + 1 < total ? `รอบที่ ${r + 2} →` : 'สรุปผล →'),
    voting: 'ปิดโหวต →', results: r + 1 < total ? `รอบที่ ${r + 2} →` : 'สรุปผล →',
  }[s.phase];
  $('btnNext').classList.toggle('hidden', !nextLabel);
  if (nextLabel) $('btnNext').textContent = nextLabel;

  if (s.phase === 'lobby') {
    show('s-lobby');
    $('lobbyTitle').textContent = s.settings.title;
    $('bigCode').textContent = s.code;
    $('lobbyCount').textContent = s.players.length ? `ผู้เล่นในห้อง ${online.length} คน` : 'รอผู้เล่นเข้าห้อง…';
    chips($('lobbyChips'), s.players, 'lobby');
    $('btnStart').disabled = !online.length;
    $('btnNext').disabled = !online.length;
  } else $('btnNext').disabled = false;

  if (s.phase === 'drawing') {
    show('s-drawing');
    $('drawLabel').textContent = `รอบ ${r + 1} จาก ${total} · วาดเลย!`;
    $('drawPrompt').textContent = R[r].prompt;
    const done = s.players.filter(p => p.submitted).length;
    $('drawCount').textContent = `ส่งรูปแล้ว ${done}/${online.length} คน`;
    chips($('drawChips'), s.players, 'draw');
  }

  if (s.phase === 'gallery' || s.phase === 'voting') {
    show('s-wall');
    const voting = s.phase === 'voting';
    $('wallLabel').textContent = `รอบ ${r + 1} · ${voting ? 'โหวตบนมือถือได้เลย' : 'ผลงานทุกคน'}`;
    $('wallTitle').textContent = R[r].prompt;
    $('voteTimer').classList.toggle('hidden', !voting);
    $('wallCount').textContent = voting
      ? `โหวตแล้ว ${s.players.filter(p => p.voted).length}/${online.length}`
      : `${s.drawings.length} รูป`;
    renderWall($('wall'), r, s.drawings, { numbered: voting, names: s.settings.showNames });
  }

  if (s.phase === 'results') {
    show('s-results');
    $('resLabel').textContent = `รอบ ${r + 1} · ${R[r].prompt}`;
    const ranked = [...s.drawings].sort((a, b) => (s.tally[b.pid] || 0) - (s.tally[a.pid] || 0)).filter(d => s.tally[d.pid]);
    const pod = $('podium'); pod.textContent = '';
    const order = [1, 0, 2].filter(i => ranked[i]);
    order.forEach(i => {
      const d = ranked[i];
      pod.append(el('div', { class: 'p' + (i === 0 ? ' first' : ''), style: `animation-delay:${(2 - i) * 350}ms` },
        el('div', { class: 'medal', text: ['🥇', '🥈', '🥉'][i] }),
        el('div', { class: 'tile' }, el('img', { src: imgUrl(r, d.pid), alt: '' }), el('div', { class: 'nm', text: d.name })),
        el('div', { class: 'vv', text: `${s.tally[d.pid]} โหวต` })));
    });
    if (!ranked.length) pod.append(el('div', { class: 'empty', text: 'ไม่มีใครโหวตในรอบนี้' }));
    renderWall($('resWall'), r, s.drawings, { tally: s.tally, names: true });
  }

  if (s.phase === 'final') {
    show('s-final');
    $('finalTitle').textContent = s.settings.title;
    $('finalLbWrap').classList.toggle('hidden', !s.settings.voting);
    const lb = $('finalLb'); lb.textContent = '';
    s.leaderboard.slice(0, 10).forEach((p, i) => lb.append(el('li', {}, el('span', { text: `${i + 1}. ${p.name}` }), el('span', { text: `${p.votes} โหวต` }))));
    const tabs = $('finalTabs'); tabs.textContent = '';
    finalTab = Math.min(finalTab, s.allRounds.length - 1);
    s.allRounds.forEach((rd, i) => tabs.append(el('button', { class: i === finalTab ? 'on' : '', text: `รอบ ${i + 1}: ${rd.prompt}`, onclick: () => { finalTab = i; render(); } })));
    const rd = s.allRounds[finalTab];
    renderWall($('finalWall'), finalTab, rd.drawings, { names: true, tally: s.settings.voting ? rd.tally : null });
  }
  tick();
}

function tick() {
  if (!state) return;
  const s = state;
  const left = s.endsAt ? Math.max(0, Math.ceil((s.endsAt - (Date.now() + offset)) / 1000)) : 0;
  const txt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (s.phase === 'drawing') {
    $('drawTimer').textContent = s.endsAt ? txt : 'หมดเวลา!';
    $('drawTimer').classList.toggle('low', left <= 10);
    const totalSec = s.settings.rounds[s.round].seconds;
    $('drawBar').style.width = `${s.endsAt ? (left / totalSec) * 100 : 0}%`;
  }
  if (s.phase === 'voting') { $('voteTimer').textContent = s.endsAt ? txt : '0:00'; $('voteTimer').classList.toggle('low', left <= 5); }
}
setInterval(tick, 250);

socket.on('state', s => { offset = s.serverNow - Date.now(); state = s; roomCode = s.code; render(); });

$('btnNext').onclick = () => socket.emit('host:next');
$('btnStart').onclick = () => socket.emit('host:next');
$('btnAdd').onclick = () => socket.emit('host:addtime', 30);
$('btnEdit').onclick = showBuilder;
$('btnFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
$('btnRestart').onclick = () => confirm('เริ่มเกมใหม่ด้วยห้องและผู้เล่นเดิม? รูปเดิมจะถูกล้าง') && socket.emit('host:restart');
$('btnNew').onclick = () => { sessionStorage.removeItem('dp_host'); location.reload(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('lightbox').classList.add('hidden'); });

// Resume after a refresh of the big screen
socket.on('connect', () => {
  const saved = JSON.parse(sessionStorage.getItem('dp_host') || 'null');
  if (!saved) return;
  socket.emit('host:resume', saved, res => {
    if (res.ok) { roomCode = saved.code; setupJoin(); showLive(); }
    else sessionStorage.removeItem('dp_host');
  });
});

loadBuilder();
