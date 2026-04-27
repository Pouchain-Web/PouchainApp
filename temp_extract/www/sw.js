/*
 * Service Worker for PouchainApp Mobile (VAPK)
 * Handles Push Notifications
 */

self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
    console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);

    let title = 'PouchainApp';
    let options = {
        body: event.data.text(),
        icon: 'favicon.png',
        badge: 'favicon.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            { action: 'explore', title: 'Voir l\'app', icon: 'favicon.png' },
            { action: 'close', title: 'Fermer', icon: 'favicon.png' },
        ]
    };

    // Try to parse JSON data if available
    try {
        const data = event.data.json();
        title = data.title || title;
        options.body = data.body || options.body;
        if (data.icon) options.icon = data.icon;
    } catch (e) {
        // Fallback to text if not JSON
    }

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click Received.');

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
