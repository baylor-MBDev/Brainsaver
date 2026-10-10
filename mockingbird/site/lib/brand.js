import { raw } from './html.js';

// The Mockingbird mark: a perched northern mockingbird drawn on a 32-unit
// grid. Gray body, dark wing with the bird's signature white wing bar,
// standing on a song-blue perch. Shapes are kept chunky enough to read at
// 16px. Colors come from CSS custom properties (--mark-*) so the inline
// mark follows light/dark mode; the favicon bakes them in.

const BODY = 'M31 8.7 26.2 7.4C25.6 5.3 23.7 4.2 21.8 4.4 19.6 4.6 18.3 6.2 18 8 17.6 10.6 15.2 13.4 12.2 16.4L2.2 27.8 4.4 29.4 13.6 21.6C16.6 22.6 20.6 21.4 22.8 18 24.6 15.2 25 12.2 26.2 10Z';
const WING = 'M19.4 9.6C18.2 13.4 14.2 18 8.4 22.8 14.2 20.8 19.2 18.4 21.4 13.6 21.9 12 21 10 19.4 9.6Z';
const BAR = 'M16.9 14.3 15.6 15.8 14.7 16.9 16.8 18.9 17.9 18.1 19.3 16.7Z';
const LEGS = 'M16.4 21.2h1.2v3h-1.2zM19 20.4h1.2v3.8H19z';

function birdShapes({ eye = true } = {}) {
  return [
    `<path class="mark-body" d="${BODY}"/>`,
    `<path class="mark-wing" d="${WING}"/>`,
    `<path class="mark-bar" d="${BAR}"/>`,
    `<path class="mark-legs" d="${LEGS}"/>`,
    eye ? '<circle class="mark-eye" cx="23" cy="7.6" r=".8"/>' : '',
  ].join('');
}

export function mark({ className = 'mark', size = 32 } = {}) {
  return raw(
    `<svg class="${className}" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false">${birdShapes()}<rect class="mark-perch" x="10" y="23.6" width="18" height="2" rx="1"/></svg>`,
  );
}

/** Standalone favicon: the mark on a paper tile so it reads on dark and light tabs. */
export function faviconSvg(colors) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${colors.paper}"/><g transform="translate(1.2 .6) scale(.92)"><path fill="${colors.slate}" d="${BODY}"/><path fill="${colors.ink}" d="${WING}"/><path fill="#FFFFFF" d="${BAR}"/><path fill="${colors.ink}" d="${LEGS}"/><rect fill="${colors.accent}" x="10" y="23.6" width="18" height="2" rx="1"/></g></svg>\n`;
}

// Mockingbirds sing in phrases: one syllable repeated a few times, then a new
// one. Three phrases, one per service. Upsweeps for websites, a trill for
// automations, hooked chirps for apps.
const PHRASES = {
  websites: 'M3 15C6 15 8 12 9.5 5M15 15C18 15 20 12 21.5 5M27 15C30 15 32 12 33.5 5',
  automation: 'M2 10 4.5 5 7.5 15 10.5 5 13.5 15 16.5 5 19.5 15 22.5 5 25.5 15 28.5 5 31.5 15 34 10',
  apps: 'M3 6C4 12 6 14 10 13M15 6C16 12 18 14 22 13M27 6C28 12 30 14 34 13',
};

export function phrase(key, { className = 'phrase' } = {}) {
  const d = PHRASES[key] ?? PHRASES.websites;
  return raw(
    `<svg class="${className}" viewBox="0 0 37 20" width="37" height="20" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  );
}

/** The song line: a hairline that breaks into the three phrases. Used as a
 * divider, sparingly. */
export function songLine({ className = 'songline' } = {}) {
  const groups = Object.entries(PHRASES)
    .map(([key, d], i) => `<path class="songline-${key}" transform="translate(${i * 44} 0)" d="${d}" pathLength="1"/>`)
    .join('');
  return raw(
    `<div class="${className}" aria-hidden="true"><svg viewBox="0 0 124 20" width="124" height="20" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${groups}</g></svg></div>`,
  );
}

/** Large hero illustration: the mark perched on a long wire. */
export function perchedBird({ className = 'perched' } = {}) {
  return raw(
    `<svg class="${className}" viewBox="0 0 40 32" aria-hidden="true" focusable="false"><line class="perched-wire" x1="0" y1="24.6" x2="40" y2="24.6" stroke-width=".35"/><g transform="translate(6 0)">${birdShapes()}<rect class="mark-perch" x="10" y="23.8" width="18" height="1.6" rx=".8"/></g></svg>`,
  );
}
