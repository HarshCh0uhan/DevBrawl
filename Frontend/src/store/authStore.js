import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/axios'
import { socket } from '../utils/socket'

export const redirectToLogin = () => {
  if (!['/login', '/register'].includes(window.location.pathname)) {
    window.location.href = '/login'
  }
}

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,

      setToken: (token) => set({ token, isAuthenticated: Boolean(token) }),
      setHasHydrated: (value) => set({ hasHydrated: value }),

      login: async (email, password) => {
        try {
          const res = await api.post('/auth/login', { email, password })
          const { user, accessToken } = res.data.data
          set({ user, token: accessToken, isAuthenticated: true })
          if (!socket.connected) socket.connect()
          return { success: true }
        } catch (err) {
          return {
            success: false,
            error: err?.response?.data?.message || err.message || 'Login failed',
          }
        }
      },

      register: async (formData) => {
        try {
          await api.post('/users/register', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          return { success: true }
        } catch (err) {
          return {
            success: false,
            error: err?.response?.data?.message || 'Registration failed',
          }
        }
      },

      restoreSession: async () => {
        try {
          const res = await api.post('/auth/refresh')
          const { accessToken } = res.data.data
          set({ token: accessToken, isAuthenticated: true })

          const meRes = await api.get('/auth/me')
          set({ user: meRes.data.data.user })
          if (!socket.connected) socket.connect()
          return true
        } catch {
          socket.disconnect()
          set({ user: null, token: null, isAuthenticated: false })
          return false
        } finally {
          set({ hasHydrated: true })
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {}
        socket.disconnect()
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      // Versioned migration discards any access token persisted by the old store.
      version: 1,
      migrate: (persistedState) => ({ user: persistedState?.user ?? null }),
      partialize: (state) => ({ user: state.user }),
    }
  )
)

socket.auth = (cb) => cb({ token: useAuthStore.getState().token })
socket.on('connect_error', (err) => {
  if (err?.data?.code === 'TOKEN_INVALID') {
    useAuthStore.getState().logout()
    redirectToLogin()
  }
})
