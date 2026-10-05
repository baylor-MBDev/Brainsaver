// Counts pushups from pose landmarks streamed by the native camera view.
//
// A frame is { t, width, height, lm }, where lm is MediaPipe's 33 pose
// landmarks flattened to [x, y, visibility, ...] with x/y normalized to the
// upright camera image. Kept free of React Native imports so it runs (and is
// tested) in plain Node.

const SIDES = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24 },
};

export const DEFAULTS = {
  downAngle: 100, // elbow angle at or below this is the bottom of a rep
  upAngle: 150, // at or above this the arms are locked out
  minVisibility: 0.5, // weakest of shoulder/elbow/wrist/hip on the best side
  maxTorsoTilt: 45, // degrees from horizontal; steeper means not in a plank
  minRepMs: 250, // bottom to lockout faster than this is arm flapping
  smoothing: 0.5, // EMA weight given to the newest elbow angle
};

function point(frame, index) {
  const { lm, width, height } = frame;
  return { x: lm[index * 3] * width, y: lm[index * 3 + 1] * height, v: lm[index * 3 + 2] };
}

// Interior angle at b, in degrees.
export function jointAngle(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return null;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

// 0 = shoulder and hip level (plank), 90 = shoulder straight above hip.
export function torsoTilt(shoulder, hip) {
  const dx = Math.abs(hip.x - shoulder.x);
  const dy = Math.abs(hip.y - shoulder.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// The camera usually sees one side clearly; use whichever side's weakest
// landmark is most visible.
function bestSide(frame, minVisibility) {
  let best = null;
  for (const indices of Object.values(SIDES)) {
    const pts = {
      shoulder: point(frame, indices.shoulder),
      elbow: point(frame, indices.elbow),
      wrist: point(frame, indices.wrist),
      hip: point(frame, indices.hip),
    };
    const visibility = Math.min(pts.shoulder.v, pts.elbow.v, pts.wrist.v, pts.hip.v);
    if (visibility >= minVisibility && (!best || visibility > best.visibility)) {
      best = { ...pts, visibility };
    }
  }
  return best;
}

// Status values drive the on-screen hint:
//   searching - no body in frame
//   position  - body visible but not in a plank (anti-cheat for arm waving)
//   ready     - in a plank, waiting for arms to lock out before counting
//   lower     - at the top, go down
//   push      - at the bottom, push up
export function createPushupCounter(options = {}) {
  const o = { ...DEFAULTS, ...options };
  let reps = 0;
  let phase = 'unknown';
  let smoothed = null;
  let bottomAt = 0;

  const snapshot = (status) => ({ reps, phase, angle: smoothed, status });

  function update(frame) {
    if (!frame || !frame.lm || frame.lm.length < 99) {
      smoothed = null;
      return snapshot('searching');
    }
    const side = bestSide(frame, o.minVisibility);
    if (!side) {
      smoothed = null;
      return snapshot('searching');
    }
    if (torsoTilt(side.shoulder, side.hip) > o.maxTorsoTilt) {
      // Standing up or waving at the camera. Keep the reps already earned,
      // but require a fresh lockout before counting again.
      phase = 'unknown';
      smoothed = null;
      return snapshot('position');
    }
    const raw = jointAngle(side.shoulder, side.elbow, side.wrist);
    if (raw == null) return snapshot('searching');
    smoothed = smoothed == null ? raw : smoothed + o.smoothing * (raw - smoothed);

    const t = frame.t ?? 0;
    if (smoothed >= o.upAngle) {
      if (phase === 'down' && t - bottomAt >= o.minRepMs) reps += 1;
      phase = 'up';
    } else if (smoothed <= o.downAngle && phase === 'up') {
      phase = 'down';
      bottomAt = t;
    }

    if (phase === 'up') return snapshot('lower');
    if (phase === 'down') return snapshot('push');
    return snapshot('ready');
  }

  return { update, get reps() { return reps; } };
}
