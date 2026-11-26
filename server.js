// Draw Party — server
// Host creates a room with their own settings; players draw on phones; drawings go to the big screen.
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const GRACE_MS = 2500;          // extra time for phones to auto-submit after time runs out
const MAX_IMAGE_BYTES = 1.5e6;  // per drawing
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 4e6 });

app.use(express.static(__dirname));
// LAN address, so the QR code works for phones when the host opened http://localhost
app.get('/info', (req, res) => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  }
  res.json({ ips, port: PORT });
});

app.get('/qr', async (req, res) => {
  const u = String(req.query.u || '');
  if (!/^https?:\/\//.test(u) || u.length > 300) return res.status(400).end();
  res.type('image/svg+xml').send(await QRCode.toString(u, { type: 'svg', margin: 1, color: { dark: '#0b1020', light: '#ffffff' } }));
});

// Drawings are served as images so they never clog the real-time socket
app.get('/img/:code/:round/:pid', (req, res) => {
  const room = rooms.get(String(req.params.code).toUpperCase());
  const d = room && room.drawings[+req.params.round] && room.drawings[+req.params.round][req.params.pid];
  if (!d) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400').type(d.mime).send(d.buf);
});

// ---------------- rooms ----------------
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(c));
  return c;
}
const id = () => crypto.randomBytes(8).toString('hex');

function cleanSettings(s = {}) {
  const rounds = (Array.isArray(s.rounds) ? s.rounds : []).slice(0, 20).map(r => ({
    prompt: String(r.prompt || '').trim().slice(0, 120) || 'วาดอะไรก็ได้ที่อยากวาด',
    seconds: Math.min(1800, Math.max(10, Math.round(+r.seconds || 60))),
  }));
  if (!rounds.length) rounds.push({ prompt: 'วาดอะไรก็ได้ที่อยากวาด', seconds: 60 });
  return {
    title: String(s.title || '').trim().slice(0, 60) || 'Draw Party',
    rounds,
    voting: !!s.voting,
    voteSeconds: Math.min(600, Math.max(10, Math.round(+s.voteSeconds || 30))),
    showNames: s.showNames !== false,
    showPromptOnPhone: s.showPromptOnPhone !== false,
    maxPlayers: Math.min(200, Math.max(2, Math.round(+s.maxPlayers || 50))),
  };
}

function clearTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; room.endsAt = null; }
function setTimer(room, ms, fn) {
  clearTimer(room);
  room.endsAt = Date.now() + ms;
  room.timer = setTimeout(() => { room.timer = null; room.endsAt = null; fn(); }, ms + GRACE_MS);
}

function playerList(room) {
  const r = room.round;
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, connected: p.sockets.size > 0,
    submitted: !!(room.drawings[r] && room.drawings[r][p.id]),
    voted: !!(room.votes[r] && room.votes[r][p.id]),
  }));
}

function roundDrawings(room, r) {
  const d = room.drawings[r] || {};
  return Object.keys(d).map(pid => ({ pid, name: room.players.get(pid)?.name || '?', t: d[pid].t }))
    .sort((a, b) => a.t - b.t);
}

function tally(room, r) {
  const count = {};
  for (const target of Object.values(room.votes[r] || {})) count[target] = (count[target] || 0) + 1;
  return count;
}

function leaderboard(room) {
  const total = {};
  room.settings.rounds.forEach((_, r) => {
    for (const [pid, n] of Object.entries(tally(room, r))) total[pid] = (total[pid] || 0) + n;
  });
  return [...room.players.values()].map(p => ({ pid: p.id, name: p.name, votes: total[p.id] || 0,
    drawings: room.settings.rounds.filter((_, r) => room.drawings[r]?.[p.id]).length }))
    .sort((a, b) => b.votes - a.votes || b.drawings - a.drawings);
}

function publicState(room) {
  const r = room.round;
  const st = {
    code: room.code, settings: room.settings, phase: room.phase, round: r,
    endsAt: room.endsAt, serverNow: Date.now(), players: playerList(room),
  };
  if (r >= 0 && ['drawing', 'gallery', 'voting', 'results'].includes(room.phase)) st.drawings = roundDrawings(room, r);
  if (room.phase === 'results') st.tally = tally(room, r);
  if (room.phase === 'final') {
    st.allRounds = room.settings.rounds.map((rd, i) => ({ prompt: rd.prompt, drawings: roundDrawings(room, i), tally: tally(room, i) }));
    st.leaderboard = leaderboard(room);
  }
  return st;
}

function broadcast(room) {
  room.touched = Date.now();
  const st = publicState(room);
  io.to(`h:${room.code}`).emit('state', st);
  for (const p of room.players.values()) {
    const mine = {
      ...st,
      players: undefined,
      playerCount: st.players.length,
      me: { id: p.id, name: p.name,
        submitted: !!room.drawings[room.round]?.[p.id],
        votedFor: room.votes[room.round]?.[p.id] || null },
    };
    // Hide the prompt on phones if the host wants it shown only on the big screen
    if (!room.settings.showPromptOnPhone) mine.settings = { ...room.settings, rounds: room.settings.rounds.map(x => ({ seconds: x.seconds, prompt: '' })) };
    if (room.phase === 'results') mine.myVotes = st.tally[p.id] || 0;
    if (room.phase === 'final') { mine.leaderboard = st.leaderboard; mine.allRounds = undefined; mine.myRounds = room.settings.rounds.map((_, i) => !!room.drawings[i]?.[p.id]); }
    for (const sid of p.sockets) io.to(sid).emit('state', mine);
  }
}

// ---------------- game flow ----------------
function startDrawing(room, r) {
  room.round = r;
  room.phase = 'drawing';
  room.drawings[r] = room.drawings[r] || {};
  setTimer(room, room.settings.rounds[r].seconds * 1000, () => toGallery(room));
  broadcast(room);
}
function toGallery(room) { clearTimer(room); room.phase = 'gallery'; broadcast(room); }
function startVoting(room) {
  if (Object.keys(room.drawings[room.round] || {}).length < 2) return nextRound(room); // nothing to vote on
  room.phase = 'voting';
  room.votes[room.round] = room.votes[room.round] || {};
  setTimer(room, room.settings.voteSeconds * 1000, () => toResults(room));
  broadcast(room);
}
function toResults(room) { clearTimer(room); room.phase = 'results'; broadcast(room); }
function nextRound(room) {
  if (room.round + 1 < room.settings.rounds.length) startDrawing(room, room.round + 1);
  else { clearTimer(room); room.phase = 'final'; broadcast(room); }
}
function hostNext(room) {
  switch (room.phase) {
    case 'lobby': return startDrawing(room, 0);
    case 'drawing': // end now, but give phones the grace window to auto-submit what they drew
      if (room.endsAt && room.endsAt > Date.now()) { setTimer(room, 0, () => toGallery(room)); broadcast(room); }
      return;
    case 'gallery': return room.settings.voting ? startVoting(room) : nextRound(room);
    case 'voting': return toResults(room);
    case 'results': return nextRound(room);
  }
}

function everyoneDone(room, kind) {
  const active = [...room.players.values()].filter(p => p.sockets.size > 0);
  if (!active.length) return false;
  if (kind === 'draw') return active.every(p => room.drawings[room.round]?.[p.id]);
  const eligible = active.filter(p => Object.keys(room.drawings[room.round] || {}).some(pid => pid !== p.id));
  return eligible.every(p => room.votes[room.round]?.[p.id]);
}

// ---------------- sockets ----------------
io.on('connection', socket => {
  let role = null, room = null, player = null;

  const ack = (cb, v) => typeof cb === 'function' && cb(v);
  const isHost = () => role === 'host' && room;

  socket.on('host:create', (settings, cb) => {
    const code = newCode();
    room = { code, hostToken: id(), settings: cleanSettings(settings), phase: 'lobby', round: -1,
      players: new Map(), drawings: {}, votes: {}, timer: null, endsAt: null, touched: Date.now() };
    rooms.set(code, room);
    role = 'host';
    socket.join(`h:${code}`);
    ack(cb, { ok: true, code, token: room.hostToken });
    broadcast(room);
  });

  socket.on('host:resume', ({ code, token } = {}, cb) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r || r.hostToken !== token) return ack(cb, { ok: false });
    room = r; role = 'host';
    socket.join(`h:${r.code}`);
    ack(cb, { ok: true });
    broadcast(r);
  });

  socket.on('host:settings', (settings, cb) => {
    if (!isHost() || room.phase !== 'lobby') return ack(cb, { ok: false });
    room.settings = cleanSettings(settings);
    broadcast(room); ack(cb, { ok: true });
  });
  socket.on('host:next', () => isHost() && hostNext(room));
  socket.on('host:addtime', (sec) => {
    if (!isHost() || !room.endsAt || !['drawing', 'voting'].includes(room.phase)) return;
    const remaining = room.endsAt - Date.now() + Math.max(5, Math.min(300, +sec || 30)) * 1000;
    const after = room.phase === 'drawing' ? () => toGallery(room) : () => toResults(room);
    setTimer(room, remaining, after);
    broadcast(room);
  });
  socket.on('host:kick', pid => {
    if (!isHost()) return;
    const p = room.players.get(pid);
    if (!p) return;
    for (const sid of p.sockets) io.to(sid).emit('kicked');
    room.players.delete(pid);
    broadcast(room);
  });
  socket.on('host:restart', () => {
    if (!isHost()) return;
    clearTimer(room);
    room.phase = 'lobby'; room.round = -1; room.drawings = {}; room.votes = {};
    broadcast(room);
  });

  socket.on('player:join', ({ code, name, pid } = {}, cb) => {
    const r = rooms.get(String(code || '').trim().toUpperCase());
    if (!r) return ack(cb, { ok: false, error: 'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง' });
    let p = pid && r.players.get(pid);
    if (!p) {
      name = String(name || '').trim().slice(0, 20);
      if (!name) return ack(cb, { ok: false, error: 'ใส่ชื่อก่อนนะ' });
      if (r.players.size >= r.settings.maxPlayers) return ack(cb, { ok: false, error: 'ห้องเต็มแล้ว' });
      p = { id: id(), name, sockets: new Set() };
      r.players.set(p.id, p);
    }
    room = r; player = p; role = 'player';
    p.sockets.add(socket.id);
    ack(cb, { ok: true, pid: p.id, code: r.code });
    broadcast(r);
  });

  socket.on('player:submit', ({ round, image } = {}, cb) => {
    if (role !== 'player' || !room || room.phase !== 'drawing' || round !== room.round) return ack(cb, { ok: false });
    if (room.drawings[round][player.id]) return ack(cb, { ok: true, already: true });
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
    if (!m) return ack(cb, { ok: false });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_IMAGE_BYTES) return ack(cb, { ok: false, error: 'รูปใหญ่เกินไป' });
    room.drawings[round][player.id] = { buf, mime: m[1], t: Date.now() };
    ack(cb, { ok: true });
    broadcast(room);
    if (everyoneDone(room, 'draw')) { clearTimer(room); setTimeout(() => room.phase === 'drawing' && room.round === round && toGallery(room), 1200); }
  });

  socket.on('player:vote', ({ round, target } = {}, cb) => {
    if (role !== 'player' || !room || room.phase !== 'voting' || round !== room.round) return ack(cb, { ok: false });
    if (target === player.id || !room.drawings[round]?.[target]) return ack(cb, { ok: false });
    room.votes[round][player.id] = target;
    ack(cb, { ok: true });
    broadcast(room);
    if (everyoneDone(room, 'vote')) { clearTimer(room); setTimeout(() => room.phase === 'voting' && room.round === round && toResults(room), 1200); }
  });

  socket.on('disconnect', () => {
    if (role === 'player' && player) { player.sockets.delete(socket.id); if (rooms.has(room.code)) broadcast(room); }
  });
});

// Drop rooms that have been idle for hours
setInterval(() => {
  for (const [code, r] of rooms) if (Date.now() - r.touched > ROOM_TTL_MS) { clearTimer(r); rooms.delete(code); }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`\n  Draw Party พร้อมแล้ว!`);
  console.log(`  จอกลาง (Host):  http://localhost:${PORT}/host.html`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`  ในวง Wi-Fi เดียวกัน:  http://${n.address}:${PORT}`);
  console.log('');
});
