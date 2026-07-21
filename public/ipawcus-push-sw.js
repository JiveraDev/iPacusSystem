const IPAWCUS_PUSH_DB = 'ipawcus-push';
const IPAWCUS_PUSH_STORE = 'settings';
const IPAWCUS_PUSH_KEY = 'current';
const IPAWCUS_APP_CACHE = 'ipawcus-app-shell-v1';
const IPAWCUS_STATIC_CACHE = 'ipawcus-static-v1';
const IPAWCUS_OFFLINE_URL = '/pwa/offline.html';
const IPAWCUS_PWA_ENABLED = new URL(self.location.href).searchParams.get('pwa') === '1';
const IPAWCUS_APP_SHELL_URLS = [
    '/',
    '/landing',
    '/dashboard',
    '/pwa/manifest.webmanifest',
    IPAWCUS_OFFLINE_URL,
    '/pwa/icons/icon-192.png',
    '/pwa/icons/icon-512.png',
    '/pwa/icons/icon-maskable-512.png',
    '/pwa/icons/apple-touch-icon.png',
    '/favicon.svg'
];

function isSameOriginRequest(request) {
    try {
        return new URL(request.url).origin === self.location.origin;
    } catch {
        return false;
    }
}

function isApiRoute(pathname) {
    return pathname.startsWith('/php/')
        || pathname.startsWith('/api/')
        || pathname.startsWith('/notifications');
}

function isNavigationRequest(request) {
    return request.mode === 'navigate'
        || (request.headers.get('accept') || '').includes('text/html');
}

function isStaticAppRequest(request) {
    if (!isSameOriginRequest(request)) {
        return false;
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (isApiRoute(pathname)) {
        return false;
    }

    return pathname.startsWith('/assets/')
        || pathname.startsWith('/pwa/')
        || pathname === '/favicon.svg'
        || pathname === '/icons.svg'
        || request.destination === 'manifest';
}

async function cacheAppShell() {
    const cache = await caches.open(IPAWCUS_APP_CACHE);
    const cacheJobs = IPAWCUS_APP_SHELL_URLS.map((url) => (
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
    ));

    await Promise.all(cacheJobs);
}

async function networkFirstNavigation(request) {
    const cache = await caches.open(IPAWCUS_APP_CACHE);

    try {
        const response = await fetch(request);

        if (response && response.ok && response.type === 'basic') {
            await cache.put(request, response.clone());
        }

        return response;
    } catch {
        return caches.match(request)
            || caches.match('/dashboard')
            || caches.match('/')
            || caches.match(IPAWCUS_OFFLINE_URL);
    }
}

async function cacheFirstStatic(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    const response = await fetch(request);

    if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(IPAWCUS_STATIC_CACHE);
        await cache.put(request, response.clone());
    }

    return response;
}

self.addEventListener('install', event => {
    if (IPAWCUS_PWA_ENABLED) {
        event.waitUntil(cacheAppShell());
    }
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    const keepCaches = IPAWCUS_PWA_ENABLED
        ? new Set([IPAWCUS_APP_CACHE, IPAWCUS_STATIC_CACHE])
        : new Set();

    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => (
            cacheName.startsWith('ipawcus-') && !keepCaches.has(cacheName) ? caches.delete(cacheName) : null
        )));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (!IPAWCUS_PWA_ENABLED) {
        return;
    }

    const { request } = event;

    if (request.method !== 'GET' || !isSameOriginRequest(request)) {
        return;
    }

    const pathname = new URL(request.url).pathname;

    if (isApiRoute(pathname)) {
        return;
    }

    if (isNavigationRequest(request)) {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (isStaticAppRequest(request)) {
        event.respondWith(cacheFirstStatic(request));
    }
});

function openPushDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IPAWCUS_PUSH_DB, 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore(IPAWCUS_PUSH_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readPushSettings() {
    const db = await openPushDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IPAWCUS_PUSH_STORE, 'readonly');
        const request = transaction.objectStore(IPAWCUS_PUSH_STORE).get(IPAWCUS_PUSH_KEY);

        request.onsuccess = () => resolve(request.result || {});
        request.onerror = () => reject(request.error);
    });
}

async function writePushSettings(settings) {
    const db = await openPushDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IPAWCUS_PUSH_STORE, 'readwrite');
        const request = transaction.objectStore(IPAWCUS_PUSH_STORE).put(settings, IPAWCUS_PUSH_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function normalizeApiBase(apiBase) {
    const base = String(apiBase || '').trim().replace(/\/+$/, '');

    if (!base) {
        return `${self.location.origin}/api`;
    }

    if (base.endsWith('/api')) {
        return base;
    }

    if (base.endsWith('/php/index.php')) {
        return `${base}/api`;
    }

    try {
        const url = new URL(base, self.location.origin);
        if (url.pathname === '/' || url.pathname === '') {
            return `${url.origin}/api`;
        }
    } catch {
        return '/api';
    }

    return base;
}

function buildApiUrl(apiBase, path) {
    return `${normalizeApiBase(apiBase)}${path}`;
}

async function fetchLatestNotification(settings) {
    if (!settings.userId) {
        return null;
    }

    const query = new URLSearchParams({
        userId: String(settings.userId),
        limit: '5'
    });
    const response = await fetch(buildApiUrl(settings.apiBase, `/notifications?${query.toString()}`), {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error('Notifications could not be loaded.');
    }

    const data = await response.json();
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];

    return notifications.find(notification => !notification.readAt) || notifications[0] || null;
}

async function showIpaWcusNotification() {
    let settings = {};
    let notification = null;

    try {
        settings = await readPushSettings();
        notification = await fetchLatestNotification(settings);
    } catch (error) {
        console.error('[iPawcus push worker] Could not load latest notification for push display.', error);
        notification = null;
    }

    const title = notification?.pushTitle || notification?.title || 'iPawcus update';
    const body = notification?.pushMessage || notification?.message || 'You have a new iPawcus notification.';
    const redirectPath = notification?.petRedirectPath || notification?.redirectPath || '/dashboard';

    await self.registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: notification?.notificationId ? `ipawcus-${notification.notificationId}` : `ipawcus-${Date.now()}`,
        data: {
            apiBase: settings.apiBase || '',
            appOrigin: settings.appOrigin || self.location.origin,
            notificationId: notification?.notificationId || null,
            redirectPath,
            userId: settings.userId || null
        }
    });
}

async function markNotificationRead(data) {
    if (!data?.notificationId || !data?.userId) {
        return;
    }

    await fetch(buildApiUrl(data.apiBase, `/notifications/${data.notificationId}/read`), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: data.userId })
    }).catch((error) => {
        console.error('[iPawcus push worker] Could not mark notification as read.', error);
    });
}

async function openNotificationTarget(data) {
    const appOrigin = data?.appOrigin || self.location.origin;
    const redirectPath = data?.redirectPath || '/dashboard';
    const targetUrl = new URL(redirectPath, appOrigin);
    const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    });

    for (const client of windows) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === targetUrl.origin) {
            await client.focus();
            if ('navigate' in client) {
                return client.navigate(targetUrl.href);
            }
            return null;
        }
    }

    return clients.openWindow(targetUrl.href);
}

self.addEventListener('message', event => {
    if (event.data?.type !== 'IPAWCUS_PUSH_CONTEXT') {
        return;
    }

    const writeTask = writePushSettings({
        userId: event.data.userId || '',
        apiBase: event.data.apiBase || '',
        appOrigin: event.data.appOrigin || self.location.origin
    });

    if (typeof event.waitUntil === 'function') {
        event.waitUntil(writeTask);
    }
});

self.addEventListener('push', event => {
    event.waitUntil(showIpaWcusNotification().catch((error) => {
        console.error('[iPawcus push worker] Push event handling failed.', error);
    }));
});

self.addEventListener('notificationclick', event => {
    const data = event.notification.data || {};

    event.notification.close();
    event.waitUntil((async () => {
        await markNotificationRead(data);
        await openNotificationTarget(data);
    })().catch((error) => {
        console.error('[iPawcus push worker] Notification click handling failed.', error);
    })());
});
