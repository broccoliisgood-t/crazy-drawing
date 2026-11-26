// Christmas background music, synthesized with Web Audio (music box + bells + soft bass).
// All four melodies are traditional / public domain (written 1818–1857 or earlier).
(function () {
  const N = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const freq = n => { const m = /^([A-G](?:#|b)?)(\d)$/.exec(n); return 440 * Math.pow(2, (N[m[1]] + (+m[2] + 1) * 12 - 69) / 12); };
  const seq = str => str.trim().split(/\s+/).map(t => { const [n, b] = t.split(':'); return [n, +(b || 1)]; });
  const CH = { C: ['C3', 'G3', 'E4'], F: ['F2', 'C3', 'A3'], G: ['G2', 'D3', 'B3'], D: ['D3', 'A3', 'F#4'], Em: ['E3', 'B3', 'G4'], Am: ['A2', 'E3', 'C4'] };

  const TRACKS = {
    jingle: {
      title: 'Jingle Bells', mood: 'สนุก คึกคัก', bpm: 132, bells: true,
      melody: seq(`E5 E5 E5:2 E5 E5 E5:2 E5 G5 C5:1.5 D5:.5 E5:4
                   F5 F5 F5:1.5 F5:.5 F5 E5 E5 E5:.5 E5:.5 E5 D5 D5 E5 D5:2 G5:2
                   E5 E5 E5:2 E5 E5 E5:2 E5 G5 C5:1.5 D5:.5 E5:4
                   F5 F5 F5:1.5 F5:.5 F5 E5 E5 E5:.5 E5:.5 G5 G5 F5 D5 C5:4`),
      chords: seq('C:4 C:4 C:4 C:4 F:4 C:4 D:4 G:4 C:4 C:4 C:4 C:4 F:4 C:4 G:4 C:4'),
    },
    wewish: {
      title: 'We Wish You a Merry Christmas', mood: 'ร่าเริง น่ารัก', bpm: 150,
      melody: seq(`D4 G4 G4:.5 A4:.5 G4:.5 F#4:.5 E4 E4 E4 A4 A4:.5 B4:.5 A4:.5 G4:.5 F#4 D4 D4
                   B4 B4:.5 C5:.5 B4:.5 A4:.5 G4 E4 D4:.5 D4:.5 E4 A4 F#4 G4:2
                   D4 G4 G4 G4 F#4:2 F#4 G4 F#4 E4 D4:2 A4
                   B4 A4:.5 A4:.5 G4:.5 G4:.5 D5 D4 D4:.5 D4:.5 E4 A4 F#4 G4:2`),
      chords: seq('G:1 G:3 C:3 D:3 D:3 Em:3 C:3 D:3 G:3 G:3 D:3 Em:3 D:3 G:3 D:3 D:3 G:2'),
    },
    deck: {
      title: 'Deck the Halls', mood: 'สดใส เป็นจังหวะ', bpm: 138,
      melody: seq(`G4:1.5 F4:.5 E4 D4 C4 D4 E4 C4 D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5 C4 B3 C4:2
                   G4:1.5 F4:.5 E4 D4 C4 D4 E4 C4 D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5 C4 B3 C4:2
                   D4:1.5 E4:.5 F4 D4 E4:1.5 F4:.5 G4 D4 E4:.5 F#4:.5 G4 A4:.5 B4:.5 C5 B4 A4 G4:2
                   G4:1.5 F4:.5 E4 D4 C4 D4 E4 C4 A4:.5 A4:.5 A4:.5 A4:.5 G4:1.5 F4:.5 E4 D4 C4:2`),
      chords: seq('C:4 C:4 G:4 C:4 C:4 C:4 G:4 C:4 G:4 C:4 D:4 G:4 C:4 C:4 F:4 C:4'),
    },
    silent: {
      title: 'Silent Night', mood: 'อบอุ่น ผ่อนคลาย', bpm: 84, soft: true,
      melody: seq(`G4:1.5 A4:.5 G4 E4:3 G4:1.5 A4:.5 G4 E4:3 D5:2 D5 B4:3 C5:2 C5 G4:3
                   A4:2 A4 C5:1.5 B4:.5 A4 G4:1.5 A4:.5 G4 E4:3 A4:2 A4 C5:1.5 B4:.5 A4 G4:1.5 A4:.5 G4 E4:3
                   D5:2 D5 F5:1.5 D5:.5 B4 C5:3 E5:3 C5:1.5 G4:.5 E4 G4:1.5 F4:.5 D4 C4:6`),
      chords: seq('C:6 C:6 G:6 C:6 F:6 C:6 F:6 C:6 G:6 C:6 G:6 C:6'),
    },
  };
  for (const t of Object.values(TRACKS)) t.beats = t.melody.reduce((a, [, b]) => a + b, 0);

  // ---- instruments ----
  function musicBox(ctx, out, f, t, dur, vol) {
    [[1, 1], [2, .35], [3.01, .12], [4.2, .05]].forEach(([h, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * h;
      const d = Math.min(2.2, dur + .9) / h ** .4;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + .05);
    });
  }
  function bass(ctx, out, f, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + dur * .95);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur);
  }
  let noiseBuf = null;
  function sleighBell(ctx, out, t, vol) {
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    s.connect(hp).connect(g).connect(out); s.start(t); s.stop(t + .2);
  }

  // Schedule one full pass of a track starting at time t0; returns its length in seconds
  function scheduleLoop(ctx, out, id, t0) {
    const tr = TRACKS[id], spb = 60 / tr.bpm, mv = tr.soft ? .16 : .2;
    let t = t0;
    for (const [n, b] of tr.melody) { musicBox(ctx, out, freq(n), t, b * spb, mv); t += b * spb; }
    t = t0;
    for (const [c, b] of tr.chords) {
      const notes = CH[c];
      bass(ctx, out, freq(notes[0]), t, b * spb, .16);
      // gentle broken chord on the off-beats
      for (let k = 1; k < b; k += (tr.soft ? 1 : 2)) notes.slice(1).forEach((n, j) => musicBox(ctx, out, freq(n), t + (k + j * .02) * spb, spb, .045));
      t += b * spb;
    }
    if (tr.bells) for (let k = 0; k < tr.beats; k++) sleighBell(ctx, out, t0 + k * spb, k % 2 ? .05 : .09);
    return tr.beats * spb;
  }

  let ctxRef = null, master = null, timer = null, current = null, vol = .55;
  function play(ctx, id) {
    stop();
    if (!ctx || !TRACKS[id]) return;
    ctxRef = ctx; current = id;
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    const out = master;
    let next = ctx.currentTime + .15;
    const loop = () => {
      if (current !== id || master !== out) return;
      const len = scheduleLoop(ctx, out, id, next);
      next += len + 1.2; // short breath between repeats
      timer = setTimeout(loop, (next - ctx.currentTime - 2) * 1000);
    };
    loop();
  }
  function stop() {
    clearTimeout(timer); timer = null; current = null;
    if (master) { const m = master; m.gain.setTargetAtTime(0, m.context.currentTime, .15); setTimeout(() => m.disconnect(), 600); master = null; }
  }
  // Duck the music (e.g. under the countdown ticks) without stopping it
  function setLevel(level) { if (master) master.gain.setTargetAtTime(vol * level, master.context.currentTime, .2); }

  window.XmasMusic = { TRACKS, play, stop, setLevel, scheduleLoop, get playing() { return current; } };
})();
