// Chạy một bước dọn dẹp mà không để nó phá thao tác chính đứng sau.
//
// Không phụ thuộc gì (cố ý): các module gọi nó — interceptor auth, auth store —
// đều nhạy cảm với module graph, và test cần dùng BẢN THẬT của nó trong khi vẫn
// mock được phần dọn dẹp.

/** Trần chờ dọn dẹp; quá hạn thì bỏ dở phần còn lại chứ không giữ người dùng lại. */
export const CLEANUP_TIMEOUT_MS = 3000

/**
 * Cần CẢ HAI lớp:
 *  - `.catch` cho ca work() reject.
 *  - trần thời gian cho ca work() TREO — đây mới là chế độ hỏng thật khi phần
 *    dọn bọc `Promise.allSettled` (không bao giờ reject) nhưng một lời gọi
 *    native qua bridge có thể không bao giờ settle.
 * Thiếu lớp thứ hai thì `await` treo vĩnh viễn và lệnh điều hướng/đổi state phía
 * sau không chạy: người dùng kẹt ở màn đã-đăng-nhập với token đã bị xoá.
 */
export function runCleanupBestEffort(work: () => Promise<void>): Promise<unknown> {
  return Promise.race([
    work().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, CLEANUP_TIMEOUT_MS)),
  ])
}
