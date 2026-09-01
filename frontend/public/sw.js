/**
 * Service worker TỰ HUỶ (self-destroying) — thay cho bản Workbox/next-pwa cũ.
 *
 * VÌ SAO: bản trước là artifact build sinh bởi `@ducanh2912/next-pwa` và bị commit thẳng vào repo
 * từ PR #28. Nó mang một precache manifest CỐ ĐỊNH trỏ tới các chunk của một build đã chết
 * (`/_next/static/chunks/app/student/…`, `/admin/…`, `/login/…`), nên với mọi người dùng còn giữ
 * đăng ký SW cũ, nó vẫn cố nạp hàng trăm URL 404 và phục vụ HTML v1 từ cache. Đợt 3 xoá hẳn cây v1
 * khiến những URL đó chắc chắn không bao giờ quay lại — và next-pwa đã không còn được nối vào
 * `next.config.mjs` từ lâu, tức PWA đã tắt, chỉ file này còn sót lại và vẫn được phục vụ ở `/sw.js`.
 *
 * File này KHÔNG cache gì cả: nó gỡ chính đăng ký của mình, xoá sạch Cache Storage do bản cũ để
 * lại, rồi tải lại các tab đang mở để chúng lấy HTML thật từ mạng. Sau lần đó trình duyệt không
 * còn service worker nào cho origin này nữa.
 *
 * ĐỪNG xoá file — phải giữ ở `/sw.js` đủ lâu để mọi trình duyệt còn đăng ký SW cũ ghé qua và tự
 * dọn (đăng ký cũ chỉ biến mất khi nó tải được bản mới này). Xoá sớm = 404, và SW cũ sống tiếp.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()

      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))

      // Tab đang mở vẫn đang hiển thị HTML lấy từ cache của SW cũ → nạp lại để thấy bản thật.
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.navigate(client.url)
      }
    })(),
  )
})
