const $ = id => document.getElementById(id);
const socket = io();
const params = new URLSearchParams(location.search);
let state = null, offset = 0, me = null, joined = false;

const views = ['v-join', 'v-wait', 'v-draw', 'v-vote'];
const show = v => { views.forEach(x => $(x).classList.toggle('hidden', x !== v)); document.body.classList.toggle('busy', v === 'v-draw' || v === 'v-vote'); };
function wait(emoji, title, sub = '') { $('waitEmoji').textContent = emoji; $('waitTitle').textContent = title; $('waitSub').textContent = sub; show('v-wait'); }

// ---------------- join ----------------
$('code').value = (params.get('code') || localStorage.getItem('dp_code') || '').toUpperCase();
$('name').value = localStorage.getItem('dp_name') || '';
if ($('code').value) setTimeout(() => $('name').focus(), 50);

function doJoin(silent) {
  const code = $('code').value.trim().toUpperCase();
  const name = $('name').value.trim();
  const pid = localStorage.getItem('dp_pid_' + code);
  if (!silent && !code) return ($('err').textContent = 'ใส่รหัสห้อง 4 ตัวอักษร');
  if (!silent && !name && !pid) return ($('err').textContent = 'ใส่ชื่อก่อนนะ');
  $('join').disabled = true;
  socket.emit('player:join', { code, name, pid }, res => {
    $('join').disabled = false;
    if (!res.ok) {
      if (pid) { localStorage.removeItem('dp_pid_' + code); if (silent) return show('v-join'); return doJoin(false); }
      if (!silent) $('err').textContent = res.error || 'เข้าห้องไม่ได้';
      return show('v-join');
    }
    joined = true;
    localStorage.setItem('dp_pid_' + res.code, res.pid);
    localStorage.setItem('dp_code', res.code);
    if (name) localStorage.setItem('dp_name', name);
    $('err').textContent = '';
  });
}
$('join').onclick = () => doJoin(false);
$('name').addEventListener('keydown', e => e.key === 'Enter' && doJoin(false));
$('code').addEventListener('input', () => { $('code').value = $('code').value.toUpperCase(); });

socket.on('connect', () => {
  const code = $('code').value.trim().toUpperCase();
  if (code && localStorage.getItem('dp_pid_' + code)) doJoin(true);
});
socket.on('kicked', () => {
  joined = false; state = null;
  localStorage.removeItem('dp_pid_' + $('code').value.trim().toUpperCase());
  show('v-join'); $('err').textContent = 'คุณถูกเอาออกจากห้อง';
});

// ---------------- canvas ----------------
const cv = $('cv'), ctx = cv.getContext('2d');
const COLORS = ['#111111', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#d81b60', '#8d6e63', '#9e9e9e'];
const SIZES = [4, 10, 22, 44];
let color = COLORS[0], size = SIZES[1], erasing = false;
let strokes = [], cur = null, strokeKey = null, sent = false;

COLORS.forEach(c => {
  const b = document.createElement('button');
  b.className = 'sw' + (c === color ? ' on' : ''); b.style.background = c; b.title = c;
  b.onclick = () => { color = c; erasing = false; $('eraser').classList.remove('on'); document.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); };
  $('colors').append(b);
});
SIZES.forEach(s => {
  const b = document.createElement('button');
  b.className = 'tb' + (s === size ? ' on' : '');
  const d = document.createElement('span'); d.className = 'dot';
  const px = Math.max(4, Math.min(24, s / 2)); d.style.width = d.style.height = px + 'px';
  b.append(d);
  b.onclick = () => { size = s; document.querySelectorAll('#sizes .tb').forEach(x => x.classList.toggle('on', x === b)); };
  $('sizes').append(b);
});
$('eraser').onclick = () => { erasing = !erasing; $('eraser').classList.toggle('on', erasing); };
$('undo').onclick = () => { strokes.pop(); redraw(); save(); };
$('clear').onclick = () => { if (strokes.length && confirm('ล้างรูปทั้งหมด?')) { strokes = []; redraw(); save(); } };

function drawStroke(s) {
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = s.p;
  if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  const last = p[p.length - 1]; ctx.lineTo(last[0], last[1]); ctx.stroke();
}
function redraw() {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  strokes.forEach(drawStroke);
  if (cur) drawStroke(cur);
}
function save() { if (strokeKey) try { localStorage.setItem(strokeKey, JSON.stringify(strokes)); } catch {} }
function pos(e) {
  const r = cv.getBoundingClientRect();
  return [Math.round((e.clientX - r.left) * cv.width / r.width), Math.round((e.clientY - r.top) * cv.height / r.height)];
}
cv.addEventListener('pointerdown', e => {
  if (sent) return;
  e.preventDefault(); cv.setPointerCapture(e.pointerId);
  cur = { c: erasing ? '#ffffff' : color, w: erasing ? size * 2 : size, p: [pos(e)] };
  redraw();
});
cv.addEventListener('pointermove', e => {
  if (!cur) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  evs.forEach(ev => cur.p.push(pos(ev)));
  redraw();
});
const end = () => { if (!cur) return; strokes.push(cur); cur = null; redraw(); save(); };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

function resetCanvasFor(key) {
  if (strokeKey === key) return;
  strokeKey = key; sent = false; cur = null;
  try { strokes = JSON.parse(localStorage.getItem(key) || '[]'); } catch { strokes = []; }
  redraw();
}

function submit(auto) {
  if (sent || !state || state.phase !== 'drawing') return;
  if (!auto && !strokes.length && !confirm('ยังไม่ได้วาดอะไรเลย ส่งกระดาษเปล่าเลยไหม?')) return;
  sent = true; end();
  $('send').disabled = true;
  const image = cv.toDataURL('image/jpeg', 0.82);
  socket.emit('player:submit', { round: state.round, image, strokes }, res => {
    $('send').disabled = false;
    if (!res?.ok) { sent = false; if (!auto) alert(res?.error || 'ส่งไม่สำเร็จ ลองอีกครั้ง'); }
    else localStorage.removeItem(strokeKey);
  });
}
$('send').onclick = () => submit(false);

// ---------------- render ----------------
let ballotKey = null;
function render() {
  const s = state; if (!s || !joined) return;
  me = s.me;
  const r = s.round, prompt = s.settings.rounds[r]?.prompt;

  if (s.phase === 'lobby') return wait('🙌', `เข้าห้องแล้ว ${me.name}!`, `มีผู้เล่น ${s.playerCount} คน · รอ Host เริ่มเกม`);

  if (s.phase === 'drawing') {
    resetCanvasFor(`dp_strokes_${s.code}_${r}_${me.id}`);
    if (me.submitted) return wait('✨', 'ส่งรูปแล้ว!', 'ดูจอกลางได้เลย รอเพื่อน ๆ วาดเสร็จ');
    $('dRound').textContent = `รอบ ${r + 1}/${s.settings.rounds.length}`;
    $('dPrompt').textContent = prompt || 'ดูโจทย์บนจอกลาง';
    // Hints revealed by the host so far; buzz the phone when a new one arrives
    const hints = s.hints || [], box = $('dHints'), had = +box.dataset.n || 0;
    if (had !== hints.length) {
      box.textContent = '';
      hints.forEach((h, i) => { const sp = document.createElement('span'); sp.textContent = `💡 ${h}`; if (i >= had) sp.className = 'new'; box.append(sp); });
      if (hints.length > had && had >= 0 && box.dataset.n !== undefined) navigator.vibrate?.(120);
      box.dataset.n = hints.length;
    }
    show('v-draw'); tick(); return;
  }

  if (s.phase === 'gallery') {
    if (!s.shown) return wait('⏰', 'หมดเวลา!', me.submitted ? 'ส่งรูปแล้ว รอ Host เปิดรูปบนจอกลาง' : 'รอบนี้คุณไม่ได้ส่งรูป');
    return wait('👀', 'ดูรูปทุกคนบนจอกลาง', 'รอเฉลยคำตอบ…');
  }

  if (s.phase === 'voting') {
    const others = s.drawings.map((d, i) => ({ ...d, no: i + 1 })).filter(d => d.pid !== me.id);
    if (!others.length) return wait('🗳️', 'กำลังโหวต', 'รอบนี้ไม่มีรูปให้คุณโหวต');
    $('vPrompt').textContent = prompt || `รอบ ${r + 1}`;
    const key = `${s.code}:${r}`;
    const box = $('ballot');
    if (ballotKey !== key) {
      ballotKey = key; box.textContent = '';
      others.forEach(d => {
        const b = document.createElement('button'); b.dataset.pid = d.pid;
        const img = document.createElement('img'); img.src = `/img/${s.code}/${r}/${d.pid}`; img.alt = `รูปหมายเลข ${d.no}`; img.loading = 'lazy';
        const no = document.createElement('span'); no.className = 'no'; no.textContent = d.no;
        b.append(img, no);
        b.onclick = () => socket.emit('player:vote', { round: r, target: d.pid });
        box.append(b);
      });
    }
    [...box.children].forEach(b => b.classList.toggle('on', b.dataset.pid === me.votedFor));
    show('v-vote'); tick(); return;
  }

  if (s.phase === 'judging') {
    return wait('🤔', s.answer ? `เฉลย: ${s.answer}` : 'เฉลยแล้ว!', 'Host กำลังเลือกรูปที่ใกล้คำตอบที่สุด…');
  }

  if (s.phase === 'results') {
    const n = s.myScore || 0;
    if (s.settings.mode === 'answer') {
      const sub = s.answer ? `คำตอบคือ "${s.answer}"` : 'ดูจอกลางได้เลย';
      if (s.myRank) return wait(['🥇', '🥈', '🥉'][s.myRank - 1], `คุณได้อันดับ ${s.myRank}! +${n} คะแนน`, sub);
      return wait('🎨', 'รอบนี้ยังไม่ติดอันดับ สู้ต่อ!', sub);
    }
    return wait(n ? '🏆' : '🎉', n ? `รูปของคุณได้ ${n} โหวต!` : 'ประกาศผลบนจอกลาง', 'ดูจอกลางได้เลย');
  }

  if (s.phase === 'final') {
    if (s.settings.mode === 'none') return wait('🎨', 'จบเกมแล้ว ขอบคุณที่ร่วมสนุก!', 'ดูรูปทุกคนบนจอกลาง');
    const unit = s.settings.mode === 'answer' ? 'คะแนน' : 'โหวต';
    const idx = s.leaderboard.findIndex(p => p.pid === me.id);
    const mine = s.leaderboard[idx];
    return wait(idx === 0 && mine?.points ? '👑' : '🎨', 'จบเกมแล้ว!', mine ? `คุณได้ ${mine.points} ${unit} · อันดับที่ ${idx + 1} จาก ${s.leaderboard.length}` : '');
  }
}

function tick() {
  const s = state; if (!s || !joined) return;
  const left = s.endsAt ? Math.max(0, (s.endsAt - (Date.now() + offset)) / 1000) : 0;
  const L = Math.ceil(left), txt = `${Math.floor(L / 60)}:${String(L % 60).padStart(2, '0')}`;
  if (s.phase === 'drawing' && !s.me.submitted) {
    $('dTime').textContent = txt; $('dTime').classList.toggle('low', L <= 10);
    $('dBar').style.width = `${(left / s.settings.rounds[s.round].seconds) * 100}%`;
    if (s.endsAt && left <= 0.3) submit(true); // time's up: send whatever is on the canvas
  }
  if (s.phase === 'voting') { $('vTime').textContent = txt; $('vTime').classList.toggle('low', L <= 5); }
}
setInterval(tick, 200);

socket.on('state', s => { offset = s.serverNow - Date.now(); state = s; render(); });
socket.on('disconnect', () => { if (joined) wait('📡', 'กำลังเชื่อมต่อใหม่…', 'อย่าปิดหน้านี้นะ'); });
// Keep the screen from sleeping while drawing, where supported
document.addEventListener('pointerdown', () => navigator.wakeLock?.request('screen').catch(() => {}), { once: true });

// A few glass ornaments; hidden while drawing or voting so they never cover the tools
(function decorate() {
  const d = $('decor'); if (!d || !window.ORN) return;
  const orn = (k, css) => { const o = document.createElement('div'); o.className = 'orn'; o.style.cssText = css; o.innerHTML = ORN[k]; d.append(o); };
  const b = document.createElement('div'); b.className = 'blob'; b.style.cssText = 'width:90px;height:90px;right:-30px;top:-24px'; d.append(b);
  orn('star', 'width:64px;left:10px;top:18px;transform:rotate(-14deg)');
  orn('bauble', 'width:58px;right:16px;bottom:18px;--r:6deg;transform-origin:50% 0;animation:sway 4s ease-in-out infinite');
  orn('cane', 'width:46px;left:12px;bottom:18px;transform:rotate(-14deg)');
})();
