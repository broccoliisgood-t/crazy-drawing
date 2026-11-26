const $ = id => document.getElementById(id);
const socket = io();

// [prompt shown on screen, secret answer]
const PAIRS = [
  ['วาดสัตว์ที่เกี่ยวกับคริสต์มาส', 'ไก่งวง'], ['วาดสัตว์ที่เกี่ยวกับคริสต์มาส', 'กวางเรนเดียร์'], ['วาดของที่เกี่ยวกับคริสต์มาส', 'ต้นคริสต์มาส'],
  ['วาดของที่เกี่ยวกับคริสต์มาส', 'ถุงเท้าคริสต์มาส'], ['วาดตัวละครคริสต์มาส', 'ซานตาคลอส'], ['วาดตัวละครคริสต์มาส', 'มนุษย์หิมะ'],
  ['วาดสัตว์', 'ช้าง'], ['วาดสัตว์', 'ยีราฟ'], ['วาดสัตว์', 'เพนกวิน'], ['วาดสัตว์', 'ปลาหมึก'], ['วาดสัตว์', 'แมวนอนหลับ'],
  ['วาดผลไม้', 'ทุเรียน'], ['วาดผลไม้', 'สับปะรด'], ['วาดผลไม้', 'แตงโม'], ['วาดอาหาร', 'ส้มตำ'], ['วาดอาหาร', 'ข้าวมันไก่'],
  ['วาดอาหาร', 'พิซซ่า'], ['วาดขนม', 'โดนัท'], ['วาดยานพาหนะ', 'ตุ๊กตุ๊ก'], ['วาดยานพาหนะ', 'เครื่องบิน'], ['วาดยานพาหนะ', 'จักรยาน'],
  ['วาดสถานที่', 'ชายหาด'], ['วาดสถานที่', 'วัด'], ['วาดสิ่งของในบ้าน', 'พัดลม'], ['วาดสิ่งของในบ้าน', 'ตู้เย็น'], ['วาดอาชีพ', 'หมอ'],
  ['วาดอาชีพ', 'นักบินอวกาศ'], ['วาดกีฬา', 'ฟุตบอล'], ['วาดกีฬา', 'มวยไทย'], ['วาดสิ่งของในออฟฟิศ', 'เครื่องถ่ายเอกสาร'], ['วาดเครื่องดนตรี', 'กีตาร์'],
];
const TIMES = [[30, '30 วินาที'], [60, '1 นาที'], [90, '1 นาที 30 วิ'], [120, '2 นาที'], [180, '3 นาที'], [300, '5 นาที'], [420, '7 นาที'], [600, '10 นาที'], [900, '15 นาที']];
const fmtDur = s => s < 60 ? `${s} วินาที` : (s % 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วิ` : `${s / 60} นาที`);
const randPair = (avoid = []) => { const pool = PAIRS.filter(p => !avoid.includes(p[1])); return pool[Math.floor(Math.random() * pool.length)] || PAIRS[0]; };
const newRound = (avoid, seconds = 60) => { const [prompt, answer] = randPair(avoid); return { prompt, answer, seconds }; };
const MODE = { answer: 'Host ตัดสิน', vote: 'โหวต', none: 'ไม่แข่ง' };

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
let settings = JSON.parse(localStorage.getItem('dp_settings2') || 'null') || {
  title: '', maxPlayers: 30, mode: 'answer', voteSeconds: 30, showNames: true, showPromptOnPhone: true,
  rounds: [newRound([])],
};
let showAnswers = false;

function readBuilder() {
  settings.title = $('title').value;
  settings.maxPlayers = +$('maxPlayers').value || 30;
  settings.mode = $('mode').value;
  settings.music = $('music').value;
  settings.voteSeconds = +$('voteSeconds').value;
  settings.showNames = $('showNames').checked;
  settings.showPromptOnPhone = $('showPromptOnPhone').checked;
  localStorage.setItem('dp_settings2', JSON.stringify(settings));
}

function renderRounds() {
  const box = $('rounds'); box.textContent = '';
  settings.rounds.forEach((r, i) => {
    const inp = el('input', { class: 'input', maxlength: 120, placeholder: 'โจทย์ เช่น วาดสัตว์' });
    inp.value = r.prompt;
    inp.addEventListener('input', () => { r.prompt = inp.value; summarize(); });
    // A normal text field (not type=password, which blocks Thai input); masked with CSS instead
    const ans = el('input', { class: 'input ans' + (showAnswers ? '' : ' masked'), maxlength: 60, type: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', lang: 'th', placeholder: 'พิมพ์คำตอบเอง เช่น ไก่งวง' });
    ans.value = r.answer || '';
    ans.addEventListener('input', () => { r.answer = ans.value; summarize(); });
    const sel = el('select', { class: 'input' }, TIMES.map(([v, t]) => el('option', { value: v, text: t })));
    if (!TIMES.some(([v]) => v === r.seconds)) sel.append(el('option', { value: r.seconds, text: fmtDur(r.seconds) }));
    sel.value = r.seconds;
    sel.addEventListener('change', () => { r.seconds = +sel.value; summarize(); });
    box.append(el('div', { class: 'round' },
      el('div', { class: 'num', text: i + 1 }), inp, ans,
      el('button', { class: 'iconbtn dice', title: 'สุ่มโจทย์และคำตอบ', onclick: () => { const [p, a] = randPair(settings.rounds.map(x => x.answer)); r.prompt = p; r.answer = a; inp.value = p; ans.value = a; summarize(); } }, '🎲'),
      sel,
      el('button', { class: 'iconbtn del', title: 'ลบรอบนี้', onclick: () => { if (settings.rounds.length > 1) { settings.rounds.splice(i, 1); renderRounds(); } } }, '✕')));
    // Hints: up to 3, written by the host, revealed one by one during drawing
    r.hints = Array.isArray(r.hints) ? r.hints : [];
    const hintInputs = [0, 1, 2].map(k => {
      const h = el('input', { class: 'input ans' + (showAnswers ? '' : ' masked'), maxlength: 80, type: 'text', autocomplete: 'off', spellcheck: 'false', lang: 'th', placeholder: `คำใบ้ ${k + 1}${k ? ' (ไม่ใส่ก็ได้)' : ' เช่น มีขนสีน้ำตาล'}` });
      h.value = r.hints[k] || '';
      h.addEventListener('input', () => { r.hints[k] = h.value; summarize(); });
      return h;
    });
    box.append(el('div', { class: 'hintrow' }, el('span', { class: 'hl', text: '💡 คำใบ้' }), ...hintInputs));
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
  const hintCount = s.rounds.reduce((a, r) => a + (r.hints || []).filter(h => String(h).trim()).length, 0);
  $('sumRoundsP').textContent = (hintCount ? `มีคำใบ้รวม ${hintCount} ข้อ (Host กดเปิดทีละข้อระหว่างวาด) · ` : '') + (n === 1
    ? `ทุกคนวาดบนมือถือ ${fmtDur(s.rounds[0].seconds)} จากนั้นรูปทั้งหมดจะขึ้นจอกลางพร้อมกัน`
    : `วาดรวม ${fmtDur(drawSec)} จบแต่ละรอบ รูปทุกคนจะขึ้นจอกลาง ก่อนไปโจทย์ถัดไป`);
  $('sumVote').textContent = MODE[s.mode];
  const missing = s.rounds.filter(r => !String(r.answer || '').trim()).length;
  $('sumVoteP').textContent = {
    answer: `จบแต่ละรอบ จอจะเฉลยคำตอบ แล้ว Host คลิกเลือกรูปที่ใกล้คำตอบที่สุด อันดับ 1–3 ได้ 3, 2, 1 คะแนน` + (missing ? ` · ยังไม่ได้ใส่คำตอบ ${missing} รอบ` : ''),
    vote: `ทุกคนมีเวลา ${fmtDur(s.voteSeconds)} โหวตรูปที่ชอบที่สุด (โหวตให้ตัวเองไม่ได้) แล้วประกาศผลบนจอ`,
    none: 'แค่วาดแล้วชมรูปบนจอกลาง ไม่ต้องแข่ง ทุกคนสนุกได้เท่ากัน',
  }[s.mode];
  $('sumWall').textContent = s.showNames ? 'มีชื่อ' : 'ไม่ระบุชื่อ';
  const songName = { jingle: 'Jingle Bells', wewish: 'We Wish You a Merry Christmas', deck: 'Deck the Halls', silent: 'Silent Night' }[s.music];
  $('sumWallP').textContent = (songName ? `เพลงคลอ ${songName} · ` : 'ไม่มีเพลงคลอ · ') + (s.showNames
    ? 'ทุกรูปบนจอกลางมีชื่อคนวาดกำกับ'
    : 'ซ่อนชื่อคนวาด ทายกันเองว่าใครวาดรูปไหน');
  $('voteSecWrap').classList.toggle('hidden', s.mode !== 'vote');
}

function loadBuilder() {
  $('title').value = settings.title; $('maxPlayers').value = settings.maxPlayers;
  $('mode').value = settings.mode || 'answer';
  $('music').value = settings.music || 'jingle'; $('voteSeconds').value = settings.voteSeconds;
  $('showNames').checked = settings.showNames; $('showPromptOnPhone').checked = settings.showPromptOnPhone;
  renderRounds();
}
['title', 'maxPlayers', 'mode', 'music', 'voteSeconds', 'showNames', 'showPromptOnPhone'].forEach(k => $(k).addEventListener('input', summarize));
$('toggleAns').onclick = () => {
  showAnswers = !showAnswers;
  $('toggleAns').textContent = showAnswers ? '🙈 ซ่อนคำตอบ' : '👁 แสดงคำตอบ';
  document.querySelectorAll('#rounds .ans').forEach(i => i.classList.toggle('masked', !showAnswers));
};
$('addRound').onclick = () => {
  if (settings.rounds.length >= 20) return;
  settings.rounds.push(newRound(settings.rounds.map(x => x.answer), settings.rounds.at(-1)?.seconds || 120));
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

function showLive() { stopPreview(); setTimeout(syncMusic, 0); $('builder').classList.add('hidden'); $('live').classList.remove('hidden'); document.body.classList.add('no-corners'); }
function showBuilder() { setTimeout(syncMusic, 0); $('live').classList.add('hidden'); $('builder').classList.remove('hidden'); document.body.classList.remove('no-corners'); loadBuilder(); window.scrollTo(0, 0); }

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
  document.body.classList.toggle('decor-back', id === 's-results' || id === 's-final');
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
function renderHints(box, hints) {
  if (box.dataset.n === String(hints.length)) return;
  box.textContent = '';
  hints.forEach((h, i) => box.append(el('span', { class: 'hint' + (i === hints.length - 1 && (+box.dataset.n || 0) < hints.length ? ' new' : ''), text: `💡 ${h}` })));
  box.dataset.n = hints.length;
}

function makeMedia(round, d, i, animate) {
  if (animate && d.anim) {
    const cv = el('canvas', { width: 720, height: 720 });
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 720, 720);
    loadStrokes(round, d.pid).then(st => st ? animateStrokes(cv, st, ANIM_MS, Math.min(i, 30) * 75)
      : cv.replaceWith(el('img', { src: imgUrl(round, d.pid), alt: '' })));
    return cv;
  }
  return el('img', { src: imgUrl(round, d.pid), alt: `รูปของ ${d.name}`, loading: 'lazy' });
}

// Pick a grid (columns x rows) that leaves a 2-3 cell wide center for the prompt and gives the biggest tiles
function boardLayout(n, W, H) {
  let best = null;
  for (let c = 4; c <= 11; c++) {
    const w = c % 2 ? 3 : (c >= 8 ? 4 : 2), h = 2;
    const r = Math.max(3, Math.ceil((n + w * h) / c));
    const cell = Math.min(W / c, H / r);
    if (!best || cell > best.cell + 0.5) best = { c, r, w, h, cell };
  }
  return best;
}

let lastBoard = null;
function renderBoard(round, drawings, players, { numbered = false, names = true, picks = null, animate = false } = {}) {
  const board = $('board');
  const key = `${state.code}:${round}`;
  if (board.dataset.key !== key) { board.querySelectorAll('.bt').forEach(n => n.remove()); board.dataset.key = key; }
  const have = new Map([...board.querySelectorAll('.bt')].map(c => [c.dataset.k, c]));
  const keep = new Set();
  drawings.forEach((d, i) => {
    const k = 'd:' + d.pid; keep.add(k);
    let t = have.get(k);
    if (have.has('m:' + d.pid)) have.get('m:' + d.pid).remove();
    if (!t) {
      t = el('div', { class: 'bt', style: `animation-delay:${Math.min(i, 20) * 60}ms` }, el('div', { class: 'md' }, makeMedia(round, d, i, animate)), el('div', { class: 'nm' }));
      t.dataset.k = k;
      t.addEventListener('click', () => state.phase === 'judging' ? socket.emit('host:pick', d.pid) : openLightbox(round, d, names ? d.name : ''));
      board.append(t);
    }
    t.querySelector('.nm').textContent = names ? d.name : '';
    t.querySelectorAll('.no,.rank').forEach(n => n.remove());
    const rank = picks ? picks.indexOf(d.pid) : -1;
    t.classList.toggle('picked', rank >= 0);
    if (rank >= 0) t.append(el('div', { class: 'rank', text: MEDALS[rank] }));
    if (numbered) t.append(el('div', { class: 'no', text: i + 1 }));
  });
  // Players in the room who didn't send a drawing get an empty dashed circle
  players.filter(p => p.connected && !drawings.some(d => d.pid === p.id)).forEach(p => {
    const k = 'm:' + p.id; keep.add(k);
    if (!have.has(k)) {
      const t = el('div', { class: 'bt miss' }, el('div', { class: 'md' }, el('div', { class: 'ring' })), el('div', { class: 'nm', text: names ? p.name : '' }));
      t.dataset.k = k; board.append(t);
    }
  });
  have.forEach((n, k) => { if (!keep.has(k)) n.remove(); });
  layoutBoard();
}
function layoutBoard() {
  const board = $('board');
  if ($('s-wall').classList.contains('hidden')) return;
  const n = board.querySelectorAll('.bt').length;
  const W = board.clientWidth - 44, H = board.clientHeight - 40;
  const L = boardLayout(n, W, H);
  board.style.gridTemplateColumns = `repeat(${L.c}, minmax(0, 1fr))`;
  board.style.gridTemplateRows = `repeat(${L.r}, minmax(0, 1fr))`;
  board.style.gridAutoFlow = 'row dense';
  const cs = Math.floor((L.c - L.w) / 2) + 1, rs = Math.floor((L.r - L.h) / 2) + 1;
  const center = $('boardCenter');
  center.style.gridColumn = `${cs} / span ${L.w}`;
  center.style.gridRow = `${rs} / span ${L.h}`;
  const promptLen = ($('bcPrompt').textContent || '').length;
  const size = Math.max(22, Math.min(L.cell * L.w / Math.max(6, promptLen * 0.62), L.cell * 0.42, 72));
  board.style.setProperty('--prompt-size', `${Math.round(size)}px`);
}
window.addEventListener('resize', layoutBoard);

function renderWall(box, round, drawings, { numbered = false, tally = null, names = true, picks = null, animate = false } = {}) {
  const key = `${state.code}:${round}`;
  if (box.dataset.key !== key) { box.textContent = ''; box.dataset.key = key; }
  box.style.setProperty('--tile', tileSize(drawings.length));
  const have = new Map([...box.children].map(c => [c.dataset.pid, c]));
  drawings.forEach((d, i) => {
    let t = have.get(d.pid);
    const name = names ? d.name : '';
    if (!t) {
      let media;
      if (animate && d.anim) {
        media = el('canvas', { width: 720, height: 720 });
        media.getContext('2d').fillStyle = '#fff'; media.getContext('2d').fillRect(0, 0, 720, 720);
        loadStrokes(round, d.pid).then(st => st ? animateStrokes(media, st, ANIM_MS, Math.min(i, 30) * 75)
          : media.replaceWith(el('img', { src: imgUrl(round, d.pid), alt: '' })));
      } else media = el('img', { src: imgUrl(round, d.pid), alt: `รูปของ ${d.name}`, loading: 'lazy' });
      t = el('div', { class: 'tile', style: `animation-delay:${Math.min(i, 20) * 70}ms` }, media);
      t.dataset.pid = d.pid;
      t.addEventListener('click', () => state.phase === 'judging' ? socket.emit('host:pick', d.pid) : openLightbox(round, d, name));
      box.append(t);
    }
    t.querySelectorAll('.nm,.no,.votes,.rank').forEach(n => n.remove());
    const rank = picks ? picks.indexOf(d.pid) : -1;
    t.classList.toggle('picked', rank >= 0);
    if (rank >= 0) t.append(el('div', { class: 'rank', text: MEDALS[rank] }));
    if (name) t.append(el('div', { class: 'nm', text: name }));
    if (numbered) t.append(el('div', { class: 'no', text: i + 1 }));
    if (tally) t.append(el('div', { class: 'votes', text: `${tally[d.pid] || 0}` }));
  });
  if (!drawings.length && !box.querySelector('.empty')) box.append(el('div', { class: 'empty', text: 'ยังไม่มีรูปในรอบนี้' }));
}

const MEDALS = ['🥇', '🥈', '🥉'];
const ANIM_MS = 3000; // stroke replay length (2x faster than before)

// ---- line-by-line replay of a player's strokes ----
const strokeCache = new Map();
function loadStrokes(r, pid) {
  const k = `${state.code}:${r}:${pid}`;
  if (!strokeCache.has(k)) strokeCache.set(k, fetch(`/strokes/${state.code}/${r}/${pid}`).then(x => x.ok ? x.json() : null).catch(() => null));
  return strokeCache.get(k);
}
function animateStrokes(canvas, strokes, duration = ANIM_MS, delay = 0) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const total = strokes.reduce((a, st) => a + st.p.length, 0);
  const token = {}; canvas._anim = token;
  if (!total) return;
  let si = 0, pi = 0, drawn = 0, t0 = null;
  const step = ts => {
    if (canvas._anim !== token) return; // a newer replay took over
    if (t0 == null) t0 = ts;
    const target = Math.min(total, Math.ceil(total * Math.min(1, (ts - t0) / duration)));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    while (drawn < target) {
      const st = strokes[si], p = st.p;
      ctx.strokeStyle = ctx.fillStyle = st.c; ctx.lineWidth = st.w;
      ctx.beginPath();
      if (pi === 0) { ctx.arc(p[0][0], p[0][1], st.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(p[pi - 1][0], p[pi - 1][1]); ctx.lineTo(p[pi][0], p[pi][1]); ctx.stroke(); }
      pi++; drawn++;
      if (pi >= p.length) { si++; pi = 0; }
    }
    if (drawn < total) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), delay);
}
// Enlarged view replays the drawing stroke by stroke when stroke data exists
function openLightbox(round, d, cap) {
  $('lbCap').textContent = cap;
  $('lbImg').classList.toggle('hidden', !!d.anim); $('lbCv').classList.toggle('hidden', !d.anim);
  if (d.anim) loadStrokes(round, d.pid).then(st => st && animateStrokes($('lbCv'), st, 2000));
  else $('lbImg').src = imgUrl(round, d.pid);
  $('lightbox').classList.remove('hidden');
}
$('lightbox').onclick = () => $('lightbox').classList.add('hidden');

let finalTab = 0;
function render() {
  const s = state; if (!s) return;
  const R = s.settings.rounds, r = s.round, total = R.length;
  const online = s.players.filter(p => p.connected);
  $('roomCode').textContent = s.code;
  $('roundInfo').textContent = r >= 0 && s.phase !== 'final' ? `รอบ ${r + 1}/${total}` : '';
  $('btnAdd').classList.toggle('hidden', !['drawing', 'voting'].includes(s.phase));
  $('btnReplay').classList.toggle('hidden', !(s.phase === 'gallery' && s.shown));
  const hintList = r >= 0 ? (R[r].hints || []) : [], shownHints = hintList.slice(0, s.hintsShown || 0);
  $('btnHint').classList.toggle('hidden', !(s.phase === 'drawing' && (s.hintsShown || 0) < hintList.length));
  $('btnHint').textContent = `💡 ให้คำใบ้ (${(s.hintsShown || 0) + 1}/${hintList.length})`;
  renderHints($('drawHints'), shownHints);
  renderHints($('bcHints'), shownHints);
  const nextLabel = {
    lobby: null, drawing: 'จบเวลาเลย →',
    gallery: !s.shown ? 'แสดงรูปวาด ▶' : s.settings.mode === 'answer' ? 'เฉลยคำตอบ →' : s.settings.mode === 'vote' ? 'เริ่มโหวต →' : (r + 1 < total ? `รอบที่ ${r + 2} →` : 'สรุปผล →'),
    voting: 'ปิดโหวต →', judging: 'ประกาศผล →', results: r + 1 < total ? `รอบที่ ${r + 2} →` : 'สรุปผล →',
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

  if (s.phase === 'gallery' && !s.shown) {
    show('s-drawing');
    $('drawLabel').textContent = `รอบ ${r + 1} จาก ${total}`;
    $('drawPrompt').textContent = R[r].prompt;
    $('drawTimer').textContent = 'หมดเวลา! ⏰'; $('drawTimer').classList.remove('low');
    $('drawBar').style.width = '0%';
    $('drawCount').textContent = `ส่งรูปเข้ามา ${s.drawings.length} รูป · กด "แสดงรูปวาด" เพื่อเปิดบนจอ`;
    chips($('drawChips'), s.players, 'draw');
  }

  if (s.phase === 'drawing') {
    show('s-drawing');
    $('drawLabel').textContent = `รอบ ${r + 1} จาก ${total} · วาดเลย!`;
    $('drawPrompt').textContent = R[r].prompt;
    const done = s.players.filter(p => p.submitted).length;
    $('drawCount').textContent = `ส่งรูปแล้ว ${done}/${online.length} คน`;
    chips($('drawChips'), s.players, 'draw');
  }

  if ((s.phase === 'gallery' && s.shown) || s.phase === 'voting' || s.phase === 'judging') {
    show('s-wall');
    const voting = s.phase === 'voting', judging = s.phase === 'judging';
    $('board').classList.toggle('judging', judging);
    $('boardPill').textContent = judging
      ? (s.picks?.length >= 3 ? 'เลือกครบแล้ว กด "ประกาศผล" ได้เลย' : `คลิกภาพที่ใกล้คำตอบที่สุด · อันดับ ${(s.picks?.length || 0) + 1}`)
      : voting ? 'โหวตภาพที่ชอบบนมือถือได้เลย' : `ผลงานทุกคน · ${s.drawings.length} ภาพ`;
    $('bcRound').textContent = `รอบ ${r + 1}/${total}`;
    $('bcPrompt').textContent = R[r].prompt;
    $('bcAnswer').classList.toggle('hidden', !judging || !R[r].answer);
    $('bcAnswerText').textContent = R[r].answer || '';
    $('bcTimer').classList.toggle('hidden', !voting);
    $('bcCount').textContent = voting ? `โหวตแล้ว ${s.players.filter(p => p.voted).length}/${online.length}` : '';
    renderBoard(r, s.drawings, s.players, { numbered: voting, names: s.settings.showNames, picks: judging ? s.picks : null, animate: s.phase === 'gallery' });
  }

  if (s.phase === 'results') {
    show('s-results');
    const isAns = s.settings.mode === 'answer', unit = isAns ? 'คะแนน' : 'โหวต';
    $('resLabel').textContent = `รอบ ${r + 1} · ${R[r].prompt}`;
    $('resTitle').textContent = isAns && R[r].answer ? `คำตอบคือ "${R[r].answer}" 🏆` : 'ผลรอบนี้ 🏆';
    const ranked = isAns
      ? s.picks.map(pid => s.drawings.find(d => d.pid === pid)).filter(Boolean)
      : [...s.drawings].sort((a, b) => (s.tally[b.pid] || 0) - (s.tally[a.pid] || 0)).filter(d => s.tally[d.pid]);
    const pod = $('podium'); pod.textContent = '';
    const order = [1, 0, 2].filter(i => ranked[i]);
    order.forEach(i => {
      const d = ranked[i];
      pod.append(el('div', { class: 'p' + (i === 0 ? ' first' : ''), style: `animation-delay:${(2 - i) * 350}ms` },
        el('div', { class: 'medal', text: ['🥇', '🥈', '🥉'][i] }),
        el('div', { class: 'tile' }, el('img', { src: imgUrl(r, d.pid), alt: '' }), el('div', { class: 'nm', text: d.name })),
        el('div', { class: 'vv', text: `${s.tally[d.pid]} ${unit}` })));
    });
    if (!ranked.length) pod.append(el('div', { class: 'empty', text: isAns ? 'รอบนี้ไม่มีผู้ชนะ' : 'ไม่มีใครโหวตในรอบนี้' }));
    renderWall($('resWall'), r, s.drawings, { tally: isAns ? null : s.tally, picks: isAns ? s.picks : null, names: true });
  }

  if (s.phase === 'final') {
    show('s-final');
    $('finalTitle').textContent = s.settings.title;
    $('finalLbWrap').classList.toggle('hidden', s.settings.mode === 'none');
    const unit = s.settings.mode === 'answer' ? 'คะแนน' : 'โหวต';
    const lb = $('finalLb'); lb.textContent = '';
    s.leaderboard.slice(0, 10).forEach((p, i) => lb.append(el('li', {}, el('span', { text: `${i + 1}. ${p.name}` }), el('span', { text: `${p.points} ${unit}` }))));
    const tabs = $('finalTabs'); tabs.textContent = '';
    finalTab = Math.min(finalTab, s.allRounds.length - 1);
    s.allRounds.forEach((rd, i) => tabs.append(el('button', { class: i === finalTab ? 'on' : '', text: `รอบ ${i + 1}: ${rd.prompt}${rd.answer && s.settings.mode === 'answer' ? ` (${rd.answer})` : ''}`, onclick: () => { finalTab = i; render(); } })));
    const rd = s.allRounds[finalTab];
    renderWall($('finalWall'), finalTab, rd.drawings, { names: true, tally: s.settings.mode === 'none' ? null : rd.tally });
  }
  // Put the host controls in the middle of whichever screen is showing
  const slot = (s.phase === 'drawing' || (s.phase === 'gallery' && !s.shown)) ? 'slotDraw'
    : ['gallery', 'voting', 'judging'].includes(s.phase) ? 'slotBoard' : s.phase === 'results' ? 'slotRes' : 'slotTop';
  if ($('ctrls').parentElement.id !== slot) { $(slot).append($('ctrls')); if (slot === 'slotBoard') layoutBoard(); }
  tick();
}

// ---- clock sound for the last 10 seconds (synthesized, no audio files) ----
let audioCtx = null, soundOn = localStorage.getItem('dp_sound') !== 'off', lastBeep = null;
function audio() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; audioCtx = new AC(); }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
// Browsers only allow sound after a click, so unlock audio on the host's first click
document.addEventListener('pointerdown', () => audio(), { once: true });
function tone(freq, dur, type = 'sine', vol = 0.35, when = 0) {
  const ac = audio(); if (!ac || !soundOn) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
}
function clockTick(sec) {
  // tick-tock, getting a little more urgent for the last 3 seconds
  const urgent = sec <= 3;
  tone(sec % 2 ? 1500 : 1150, 0.06, 'square', urgent ? 0.22 : 0.14);
  tone(sec % 2 ? 3000 : 2300, 0.03, 'sine', 0.08);
  if (urgent) tone(880, 0.12, 'triangle', 0.18, 0.02);
}
function timeUpBell() {
  [[1318, 0], [1568, 0.12], [2093, 0.24]].forEach(([f, w]) => { tone(f, 1.2, 'sine', 0.3, w); tone(f * 2, 0.6, 'sine', 0.06, w); });
}
function soundFor(left) {
  const key = `${state.code}:${state.round}:${state.phase}`;
  if (lastBeep && lastBeep.key === key && lastBeep.sec === left) return;
  const prev = lastBeep && lastBeep.key === key ? lastBeep.sec : null;
  lastBeep = { key, sec: left };
  if (prev === null) return; // never beep on the first frame after a refresh
  if (left >= 1 && left <= 10 && left < prev) clockTick(left);
  if (left === 0 && prev > 0) timeUpBell();
}

// ---- background music ----
let musicOn = localStorage.getItem('dp_music') !== 'off', previewing = false, musicLevel = 1;
function syncMusic() {
  if (previewing || !window.XmasMusic) return;
  const live = !$('live').classList.contains('hidden');
  const id = live && musicOn && state ? state.settings.music : 'none';
  if (id && id !== 'none') { if (XmasMusic.playing !== id) { XmasMusic.play(audio(), id); musicLevel = 1; } }
  else if (XmasMusic.playing) XmasMusic.stop();
}
function paintMusic() { $('btnMusic').textContent = musicOn ? '🎵 เพลง' : '🎵 ปิดเพลง'; $('btnMusic').style.opacity = musicOn ? 1 : .6; }
$('btnMusic').onclick = () => { musicOn = !musicOn; localStorage.setItem('dp_music', musicOn ? 'on' : 'off'); paintMusic(); syncMusic(); };
paintMusic();
$('musicTry').onclick = () => {
  if (previewing) { previewing = false; XmasMusic.stop(); $('musicTry').textContent = '▶ ฟัง'; return; }
  const id = $('music').value; if (id === 'none') return;
  previewing = true; XmasMusic.play(audio(), id); $('musicTry').textContent = '■ หยุด';
};
$('music').addEventListener('change', () => { if (previewing) { XmasMusic.play(audio(), $('music').value); if ($('music').value === 'none') { previewing = false; XmasMusic.stop(); $('musicTry').textContent = '▶ ฟัง'; } } });
function stopPreview() { if (previewing) { previewing = false; XmasMusic.stop(); $('musicTry').textContent = '▶ ฟัง'; } }

function tick() {
  if (!state) return;
  const s = state;
  const left = s.endsAt ? Math.max(0, Math.ceil((s.endsAt - (Date.now() + offset)) / 1000)) : 0;
  // keep the music soft under the last-10-seconds clock
  const lvl = (s.phase === 'drawing' || s.phase === 'voting') && s.endsAt && left <= 10 ? .25 : 1;
  if (lvl !== musicLevel && window.XmasMusic) { musicLevel = lvl; XmasMusic.setLevel(lvl); }
  if ((s.phase === 'drawing' || s.phase === 'voting') && s.endsAt) soundFor(left);
  const txt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (s.phase === 'drawing') {
    $('drawTimer').textContent = s.endsAt ? txt : 'หมดเวลา!';
    $('drawTimer').classList.toggle('low', left <= 10);
    const totalSec = s.settings.rounds[s.round].seconds;
    $('drawBar').style.width = `${s.endsAt ? (left / totalSec) * 100 : 0}%`;
  }
  if (s.phase === 'voting') { $('bcTimer').textContent = s.endsAt ? txt : '0:00'; $('bcTimer').classList.toggle('low', left <= 5); }
}
setInterval(tick, 250);

socket.on('state', s => { offset = s.serverNow - Date.now(); state = s; roomCode = s.code; render(); syncMusic(); });

$('btnNext').onclick = () => socket.emit('host:next');
$('btnStart').onclick = () => socket.emit('host:next');
$('btnReplay').onclick = () => { $('board').dataset.key = ''; render(); };
$('btnHint').onclick = () => socket.emit('host:hint');
$('btnAdd').onclick = () => socket.emit('host:addtime', 30);
$('btnEdit').onclick = showBuilder;
function paintSound() { $('btnSound').textContent = soundOn ? '🔊 เสียง' : '🔇 ปิดเสียง'; }
$('btnSound').onclick = () => { soundOn = !soundOn; localStorage.setItem('dp_sound', soundOn ? 'on' : 'off'); paintSound(); if (soundOn) tone(1500, 0.06, 'square', 0.14); };
paintSound();
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

// Glass ornaments around the edges of the screen (drawn in ornaments.js)
(function decorate() {
  const d = $('decor'); if (!d || !window.ORN) return;
  const orn = (k, css) => { const o = document.createElement('div'); o.className = 'orn'; o.style.cssText = css; o.innerHTML = ORN[k]; d.append(o); };
  const blob = (css, pink) => { const b = document.createElement('div'); b.className = 'blob' + (pink ? ' pink' : ''); b.style.cssText = css; d.append(b); };
  blob('width:130px;height:130px;left:-40px;top:-40px');
  blob('width:70px;height:70px;right:180px;top:-24px', true);
  blob('width:110px;height:110px;right:-36px;top:42%');
  orn('star', 'width:112px;left:2px;top:74px;transform:rotate(-12deg)');
  orn('flake', 'width:96px;right:4px;top:78px;transform:rotate(12deg);opacity:.95');
  orn('cane', 'width:78px;left:6px;bottom:8px;transform:rotate(-14deg)');
  orn('tree', 'width:76px;left:86px;bottom:-6px;transform:rotate(8deg)');
  orn('bauble', 'width:92px;right:16px;bottom:8px;--r:6deg;transform-origin:50% 0;animation:sway 4s ease-in-out infinite');
})();

loadBuilder();
