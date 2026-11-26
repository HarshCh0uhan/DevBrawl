import axios from 'axios'
import { useAuthStore, redirectToLogin } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
})

let refreshPromise = null
let isRefreshing = false
let queue = []

const flushQueue = (err, token = null) => {
  for (const { resolve, reject, config } of queue) {
    if (err) {
      reject(err)
    } else {
      config.headers ||= {}
      config.headers.Authorization = `Bearer ${token}`
      resolve(api(config))
    }
  }
  queue = []
}

const isAuthEndpoint = (url = '') =>
  /\/auth\/(login|refresh|logout)(?:\?|$)/.test(url)

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers ||= {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const code = error.response?.data?.code

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint(original.url)
    ) {
      return Promise.reject(error)
    }

    if (code === 'TOKEN_INVALID') {
      useAuthStore.getState().logout()
      redirectToLogin()
      return Promise.reject(error)
    }

    if (code === 'TOKEN_EXPIRED' || code === undefined) {
      if (isRefreshing) {
        original._retry = true
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject, config: original })
        })
      }

      original._retry = true
      isRefreshing = true
      try {
        refreshPromise ||= api.post('/auth/refresh').finally(() => {
          refreshPromise = null
        })
        const { data } = await refreshPromise
        const newToken = data.data.accessToken
        useAuthStore.getState().setToken(newToken)
        flushQueue(null, newToken)
        original.headers ||= {}
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshErr) {
        flushQueue(refreshErr, null)
        useAuthStore.getState().logout()
        redirectToLogin()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
