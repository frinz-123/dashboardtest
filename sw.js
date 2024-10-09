// public/sw.js
self.addEventListener('push', (event) => {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    }
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  })
  