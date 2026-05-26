/**
 * Test JWT tokens used in E2E specs to inject pre-authenticated sessions.
 *
 * These are signed with a dev/test JWT_SECRET (not production).
 * All tokens use `localhost` as cookie domain and expire well in the future.
 *
 * To regenerate (replace E2E_JWT_SECRET with whatever your test server uses):
 *   node -e "
 *     const { SignJWT } = require('jose');
 *     const secret = new TextEncoder().encode(process.env.E2E_JWT_SECRET ?? 'change-me');
 *     new SignJWT({ role: 'STUDENT', sub: '1' })
 *       .setProtectedHeader({ alg: 'HS256' })
 *       .setIssuedAt()
 *       .setExpirationTime('365d')
 *       .sign(secret)
 *       .then(console.log);
 *   "
 */

/** STUDENT role, sub=1, expires 2027-05-26 (update yearly or use E2E_JWT_SECRET) */
export const STUDENT_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEiLCJleHAiOjE3NzkwMjgyODF9.tketgaKuI7Mbm_Tbu4bYBzxUTUBtcEt25f5gaD53dJY';

/** TEACHER role, sub=2, expires 2027-05-26 */
export const TEACHER_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVEVBQ0hFUiIsInN1YiI6IjIiLCJpYXQiOjE3Nzg5NDMxNjUsImV4cCI6MTc3OTAyOTU2NX0.F8Bt8I_VNf7HNOMDbpGwNaUyyXHOMY1qoPcUF19MgdM';

/** Minimal STUDENT JWT with FAKESIGNATURE — for mocked-route tests only (middleware not reached) */
export const MOCK_STUDENT_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEifQ.FAKESIGNATURE';

export function studentCookies(domain = 'localhost') {
  return [
    { name: 'auth_access', value: STUDENT_TOKEN, domain, path: '/' },
    { name: 'auth_role', value: 'STUDENT', domain, path: '/' },
    { name: 'auth_logged_in', value: '1', domain, path: '/' },
  ];
}

export function teacherCookies(domain = 'localhost') {
  return [
    { name: 'auth_access', value: TEACHER_TOKEN, domain, path: '/' },
    { name: 'auth_role', value: 'TEACHER', domain, path: '/' },
    { name: 'auth_logged_in', value: '1', domain, path: '/' },
  ];
}
