const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const PWA_SERVICE_WORKER_PATH = '/ipawcus-push-sw.js';
export const PWA_MANIFEST_PATH = '/pwa/manifest.webmanifest';
export const PWA_APPLE_TOUCH_ICON_PATH = '/pwa/icons/apple-touch-icon.png';

export function isPwaActivated() {
  const value = import.meta.env.PWAACTIVATOR ?? import.meta.env.VITE_PWAACTIVATOR ?? '';

  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

export function getPwaServiceWorkerUrl({ pwaEnabled = false } = {}) {
  return `${PWA_SERVICE_WORKER_PATH}?pwa=${pwaEnabled ? '1' : '0'}`;
}

function upsertHeadElement(selector, createElement) {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.head.querySelector(selector)) {
    return;
  }

  document.head.appendChild(createElement());
}

export function ensurePwaHeadTags() {
  if (!isPwaActivated() || typeof document === 'undefined') {
    return;
  }

  upsertHeadElement('meta[name="apple-mobile-web-app-capable"]', () => {
    const element = document.createElement('meta');
    element.name = 'apple-mobile-web-app-capable';
    element.content = 'yes';
    return element;
  });

  upsertHeadElement('meta[name="apple-mobile-web-app-title"]', () => {
    const element = document.createElement('meta');
    element.name = 'apple-mobile-web-app-title';
    element.content = 'iPawcus';
    return element;
  });

  upsertHeadElement('meta[name="apple-mobile-web-app-status-bar-style"]', () => {
    const element = document.createElement('meta');
    element.name = 'apple-mobile-web-app-status-bar-style';
    element.content = 'default';
    return element;
  });

  upsertHeadElement('link[rel="manifest"]', () => {
    const element = document.createElement('link');
    element.rel = 'manifest';
    element.href = PWA_MANIFEST_PATH;
    return element;
  });

  upsertHeadElement('link[rel="apple-touch-icon"]', () => {
    const element = document.createElement('link');
    element.rel = 'apple-touch-icon';
    element.href = PWA_APPLE_TOUCH_ICON_PATH;
    return element;
  });
}
