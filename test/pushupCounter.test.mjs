import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushupCounter, jointAngle, torsoTilt } from '../src/exercise/pushupCounter.js';

const FRAME_MS = 66; // ~15 fps, what the camera view emits

// A side-on body with the given elbow angle. `plank` puts the hip level
// with the shoulder; otherwise the hip sits straight below it (standing).
function frame(elbowDeg, { t = 0, plank = true, visibility = 0.9 } = {}) {
  const lm = new Array(33 * 3).fill(0);
  const set = (i, x, y, v) => {
    lm[i * 3] = x;
    lm[i * 3 + 1] = y;
    lm[i * 3 + 2] = v;
  };
  const shoulder = { x: 0.4, y: 0.5 };
  const hip = plank ? { x: 0.7, y: 0.5 } : { x: 0.4, y: 0.8 };
  const elbow = { x: 0.4, y: 0.6 };
  const rad = (elbowDeg * Math.PI) / 180;
  const wrist = { x: elbow.x + Math.sin(rad) * 0.1, y: elbow.y - Math.cos(rad) * 0.1 };
  set(11, shoulder.x, shoulder.y, visibility);
  set(13, elbow.x, elbow.y, visibility);
  set(15, wrist.x, wrist.y, visibility);
  set(23, hip.x, hip.y, visibility);
  // Far side mostly hidden, as it is from a side view.
  set(12, shoulder.x, shoulder.y, 0.1);
  set(14, elbow.x, elbow.y, 0.1);
  set(16, wrist.x, wrist.y, 0.1);
  set(24, hip.x, hip.y, 0.1);
  return { t, width: 1000, height: 1000, lm };
}

// Feeds angles one frame apart and returns the last result.
function feed(counter, angles, opts = {}) {
  let clock = opts.start ?? 0;
  let last;
  for (const a of angles) {
    last = counter.update(frame(a, { ...opts, t: clock }));
    clock += opts.dt ?? FRAME_MS;
  }
  return { last, clock };
}

const down = (n = 8) => Array.from({ length: n }, (_, i) => 170 - ((170 - 80) * (i + 1)) / n);
const up = (n = 8) => Array.from({ length: n }, (_, i) => 80 + ((170 - 80) * (i + 1)) / n);
const rep = () => [...down(), ...up()];

test('geometry helpers', () => {
  assert.equal(Math.round(jointAngle({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 })), 90);
  assert.equal(Math.round(jointAngle({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 180);
  assert.equal(Math.round(torsoTilt({ x: 0, y: 0 }, { x: 1, y: 0 })), 0);
  assert.equal(Math.round(torsoTilt({ x: 0, y: 0 }, { x: 0, y: 1 })), 90);
  // The synthetic frame builder produces the angle it was asked for.
  const f = frame(120);
  const p = (i) => ({ x: f.lm[i * 3] * 1000, y: f.lm[i * 3 + 1] * 1000 });
  assert.equal(Math.round(jointAngle(p(11), p(13), p(15))), 120);
});

test('counts ten clean pushups', () => {
  const c = createPushupCounter();
  const angles = [170, 170];
  for (let i = 0; i < 10; i++) angles.push(...rep());
  const { last } = feed(c, angles);
  assert.equal(last.reps, 10);
  assert.equal(last.status, 'lower');
});

test('jitter at the bottom does not add reps', () => {
  const c = createPushupCounter();
  const wobble = [85, 125, 90, 130, 88, 120, 86];
  const angles = [170, 170];
  for (let i = 0; i < 3; i++) angles.push(...down(), ...wobble, ...up());
  assert.equal(feed(c, angles).last.reps, 3);
});

test('arm curls while standing never count', () => {
  const c = createPushupCounter();
  const angles = [170];
  for (let i = 0; i < 10; i++) angles.push(...rep());
  const { last } = feed(c, angles, { plank: false });
  assert.equal(last.reps, 0);
  assert.equal(last.status, 'position');
});

test('a barely visible body never counts', () => {
  const c = createPushupCounter();
  const angles = [170];
  for (let i = 0; i < 5; i++) angles.push(...rep());
  const { last } = feed(c, angles, { visibility: 0.2 });
  assert.equal(last.reps, 0);
  assert.equal(last.status, 'searching');
});

test('arm flapping faster than a real rep is rejected', () => {
  const c = createPushupCounter();
  const flap = [170, 170, 80, 80, 80, 170, 170, 170];
  const angles = [];
  for (let i = 0; i < 6; i++) angles.push(...flap);
  assert.equal(feed(c, angles, { dt: 30 }).last.reps, 0);
});

test('starting at the bottom needs a lockout before the first rep counts', () => {
  const c = createPushupCounter();
  let { clock } = feed(c, [80, 80, 80, ...up()]);
  assert.equal(c.reps, 0);
  ({ clock } = feed(c, rep(), { start: clock }));
  assert.equal(c.reps, 1);
});

test('dropping out of frame mid-set keeps earned reps', () => {
  const c = createPushupCounter();
  let { clock } = feed(c, [170, ...rep(), ...rep()]);
  assert.equal(c.reps, 2);
  assert.equal(c.update(null).status, 'searching');
  assert.equal(c.update({ t: clock, width: 1, height: 1, lm: [] }).status, 'searching');
  ({ clock } = feed(c, [170, 170, ...rep()], { start: clock + FRAME_MS }));
  assert.equal(c.reps, 3);
});

test('standing up mid-set requires a fresh lockout', () => {
  const c = createPushupCounter();
  let { clock } = feed(c, [170, ...rep()]);
  assert.equal(c.reps, 1);
  // Stand, then drop straight back into a half-rep from the bottom.
  ({ clock } = feed(c, [170, 170], { start: clock, plank: false }));
  ({ clock } = feed(c, [80, 80, ...up()], { start: clock }));
  assert.equal(c.reps, 1);
});
