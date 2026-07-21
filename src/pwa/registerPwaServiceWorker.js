import { getPwaServiceWorkerUrl, isPwaActivated } from './pwaConfig.js';

const PWA_CACHE_PREFIXES = ['ipawcus-app-shell', 'ipawcus-static'];

function canRegisterServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    return false;
  }

  return window.isSecureContext
    || window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1';
}

async function clearPwaCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => (
    PWA_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
      ? caches.delete(cacheName)
      : null
  )));
}

async function deactivatePwaServiceWorker() {
  if (!canRegisterServiceWorker()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration('/');

  if (!registration) {
    await clearPwaCaches();
    return null;
  }

  const subscription = registration.pushManager
    ? await registration.pushManager.getSubscription().catch(() => null)
    : null;

  if (subscription) {
    return navigator.serviceWorker
      .register(getPwaServiceWorkerUrl({ pwaEnabled: false }), { scope: '/' })
      .then(async (nextRegistration) => {
        await clearPwaCaches();
        return nextRegistration;
      })
      .catch((error) => {
        console.warn('iPawcus PWA service worker deactivation failed:', error);
        return null;
      });
  }

  await registration.unregister().catch((error) => {
    console.warn('iPawcus PWA service worker unregister failed:', error);
  });
  await clearPwaCaches();

  return null;
}

export function registerPwaServiceWorker() {
  if (!isPwaActivated()) {
    return deactivatePwaServiceWorker();
  }

  if (!canRegisterServiceWorker()) {
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register(getPwaServiceWorkerUrl({ pwaEnabled: true }), { scope: '/' })
    .catch((error) => {
      console.warn('iPawcus PWA service worker registration failed:', error);
      return null;
    });
}
