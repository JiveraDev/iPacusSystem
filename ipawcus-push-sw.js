const IPAWCUS_PUSH_DB = 'ipawcus-push';
const IPAWCUS_PUSH_STORE = 'settings';
const IPAWCUS_PUSH_KEY = 'current';

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

function buildApiUrl(apiBase, path) {
    const base = apiBase || self.location.origin;
    return `${String(base).replace(/\/+$/, '')}${path}`;
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
    }).catch(() => {});
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
    event.waitUntil(showIpaWcusNotification());
});

self.addEventListener('notificationclick', event => {
    const data = event.notification.data || {};

    event.notification.close();
    event.waitUntil((async () => {
        await markNotificationRead(data);
        await openNotificationTarget(data);
    })());
});
