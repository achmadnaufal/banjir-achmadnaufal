/*
 * Web Push handlers, loaded into the Workbox-generated service worker with
 * importScripts('push-sw.js'). Payloads come from the alerts service:
 * { title, body, tag, url }.
 *
 * Every push must show a notification: iOS revokes the subscription of a web
 * app that receives pushes without showing one. So bad or empty data still
 * produces a generic notification.
 */
const FALLBACK = {
  title: 'Monitor Banjir',
  body: 'Buka untuk melihat tinggi muka air terbaru.',
  tag: 'banjir-update',
  url: '/?source=push',
}

function readPayload(data) {
  if (!data) return FALLBACK
  try {
    const p = data.json()
    if (!p || typeof p.title !== 'string' || p.title === '') return FALLBACK
    return {
      title: p.title,
      body: typeof p.body === 'string' ? p.body : '',
      tag: typeof p.tag === 'string' ? p.tag : FALLBACK.tag,
      url: typeof p.url === 'string' ? p.url : FALLBACK.url,
    }
  } catch {
    return FALLBACK
  }
}

self.addEventListener('push', (event) => {
  const p = readPayload(event.data)
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      // An hourly update replaces the last one with the same tag; still sound it.
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: p.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => typeof w.focus === 'function')
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
