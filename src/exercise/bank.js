// Earned screen time. Exercise credits minutes to a daily bank; the gate can
// spend them instead of typing. Pure functions so they're testable in Node.

export const PUSHUP_GOAL = 10;
export const PUSHUP_REWARD_MIN = 10;
export const STEP_GOAL = 1000;
export const STEP_REWARD_MIN = 10;
export const BANK_CAP_MIN = 60; // no hoarding a whole evening of scrolling

export function creditBank(bank, minutes) {
  return Math.min(Math.max(0, bank) + minutes, BANK_CAP_MIN);
}

// Spends up to `wanted` minutes; returns what was spent and what's left.
export function spendBank(bank, wanted) {
  const minutes = Math.max(0, Math.min(bank, wanted));
  return { minutes, bank: bank - minutes };
}

// The hardware step counter is cumulative since boot. A reading below the
// walk's baseline means the phone rebooted mid-walk, so the reading itself
// is the best available count.
export function walkSteps(baseline, current) {
  if (baseline == null || current == null) return 0;
  return Math.round(current >= baseline ? current - baseline : current);
}
