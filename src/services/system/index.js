// Single platform bridge.
// - In the browser it falls back to standard Web APIs.
// - In the Windows desktop app the preload script exposes `window.desktop`.
// The rest of the app imports only from here, so UI code stays identical.

const bridge = typeof window !== 'undefined' ? window.desktop : undefined;

export const isDesktop = Boolean(bridge?.isDesktop);

export const platformLabel = isDesktop ? 'Windows Desktop' : 'Web';

export async function getAppInfo() {
  if (bridge) {
    return bridge.getAppInfo();
  }

  return {
    mode: 'web',
    platform: navigator.platform,
    language: navigator.language,
    userAgent: navigator.userAgent,
  };
}

export async function notify(title, body) {
  if (bridge) {
    return bridge.notify(title, body);
  }

  if (typeof Notification === 'undefined') {
    return { ok: false, reason: 'Notifications are not supported in this browser' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notification permission was denied' };
  }

  new Notification(title, { body });
  return { ok: true };
}
