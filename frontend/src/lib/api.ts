import axios from 'axios'
import { clearAuthCookies, syncAuthCookies } from '@/lib/authSession'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    // Tránh cache trình duyệt/proxy cho dữ liệu buổi học & tiến độ
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  },
})

// Attach access token tự động
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Request-Id'] = crypto.randomUUID()
  return config
})

// Auto refresh khi 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        syncAuthCookies(data)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        localStorage.clear()
        clearAuthCookies()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
