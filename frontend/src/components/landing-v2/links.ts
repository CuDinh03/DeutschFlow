/**
 * Đích của mọi CTA "học thử / miễn phí" cho HỌC VIÊN.
 *
 * QA 2026-09-01 (F-13): CTA học viên phải vào phễu value-first `/v2/onboarding` (trang công khai,
 * ba thứ tiếng, có quick win và event PostHog) chứ không thả khách lạ thẳng vào form đăng ký.
 * Phễu tự đưa khách sang `/v2/register` ở bước cuối. CTA B2B ("Nhận tư vấn…") giữ `/v2/register`:
 * phễu này dành cho học viên, không dành cho trung tâm.
 */
export const START_HREF = '/v2/onboarding'

/** Email liên hệ hiển thị trên trang công khai. */
export const SUPPORT_EMAIL = 'support@mydeutschflow.com'
