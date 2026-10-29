// Pure helpers shared by the background, the popup and the tests.
// Nothing in here touches browser APIs.

export const MIN_PERCENT = 0;
const NEUTRAL_PERCENT = 100;
export const MAX_PERCENT = 500;
export const STEP_PERCENT = 10;

// Slider scale. Loudness is heard on a log scale, so the slider is not linear:
// 0-100% (quieter) fills the first 40% of the track, and above 100% every equal
// distance adds the same number of decibels.
export const UNITY_POSITION = 0.4;

export function percentToPosition(percent) {
  const p = clampPercent(percent);
  if (p <= NEUTRAL_PERCENT) return (p / NEUTRAL_PERCENT) * UNITY_POSITION;
  return UNITY_POSITION + ((1 - UNITY_POSITION) * Math.log(p / NEUTRAL_PERCENT)) / Math.log(MAX_PERCENT / NEUTRAL_PERCENT);
}

// Levels the slider snaps to while dragging, with how close (as a share of the
// track) the thumb has to be. 100% pulls hardest; 200% and 300% pull gently, so
// nearby values stay reachable.
export const SNAP_POINTS = Object.freeze([
  Object.freeze({ percent: 100, zone: 0.015 }),
  Object.freeze({ percent: 200, zone: 0.0075 }),
  Object.freeze({ percent: 300, zone: 0.0075 }),
]);

// The level a dragged slider position snaps to, or null when it is not near one.
export function snapPercent(position) {
  const hit = SNAP_POINTS.find(({ percent, zone }) => Math.abs(position - percentToPosition(percent)) <= zone);
  return hit ? hit.percent : null;
}

export function positionToPercent(position) {
  const x = Math.min(1, Math.max(0, Number(position) || 0));
  if (x <= UNITY_POSITION) return clampPercent((x / UNITY_POSITION) * NEUTRAL_PERCENT);
  const exponent = (x - UNITY_POSITION) / (1 - UNITY_POSITION);
  return clampPercent(NEUTRAL_PERCENT * (MAX_PERCENT / NEUTRAL_PERCENT) ** exponent);
}

// One sound mode at a time: 'default' (untouched), 'voice' or 'bass'.
export const EFFECTS = Object.freeze(['default', 'voice', 'bass']);

export const NEUTRAL = Object.freeze({ percent: NEUTRAL_PERCENT, effect: 'default' });

export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NEUTRAL.percent;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(n)));
}

// Builds a clean settings object from untrusted input; missing or invalid
// fields fall back to `base`.
export function sanitizeSettings(input, base = NEUTRAL) {
  const src = input !== null && typeof input === 'object' ? input : {};
  return {
    percent: Number.isFinite(src.percent) ? clampPercent(src.percent) : clampPercent(base.percent),
    effect: EFFECTS.includes(src.effect) ? src.effect : EFFECTS.includes(base.effect) ? base.effect : NEUTRAL.effect,
  };
}

export function isNeutral(settings) {
  return settings.percent === NEUTRAL.percent && settings.effect === NEUTRAL.effect;
}

export function sameSettings(a, b) {
  return a.percent === b.percent && a.effect === b.effect;
}

// The key used to remember a volume per website. Only real web pages qualify.
export function siteKey(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname;
  } catch {
    // not a URL
  }
  return null;
}

// Hosts where browsers never let extensions touch the page.
const STORE_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org',
  'microsoftedge.microsoft.com',
]);

export function isRestrictedUrl(url) {
  if (!url) return false; // unknown: let the engine decide
  let u;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (!['http:', 'https:', 'file:'].includes(u.protocol)) return true;
  return STORE_HOSTS.has(u.hostname);
}

export function levelOf(percent) {
  if (percent <= 100) return 'normal';
  if (percent <= 300) return 'boost';
  return 'high';
}
