// Firefox exposes the promise-based `browser` namespace, Chrome exposes `chrome`
// (which also returns promises in Manifest V3).
export const api = globalThis.browser ?? globalThis.chrome;

const origin = api.runtime.getURL('');
export const BROWSER = origin.startsWith('moz-extension:') ? 'firefox' : origin.startsWith('safari-web-extension:') ? 'safari' : 'chrome';

// What this build can do, read from its own manifest rather than guessed from the browser.
const manifest = api.runtime.getManifest();
const permissions = manifest.permissions ?? [];
export const FEATURES = Object.freeze({
  capture: permissions.includes('tabCapture'),
  chromeFavicons: permissions.includes('favicon'),
  optionalHostAccess: (manifest.optional_host_permissions ?? []).length > 0,
});
