import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api from '../utils/axios'
import { socket } from '../utils/socket'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,

      isTokenExpired: (token) => {
        if (!token) return true
        try {
          const decoded = jwtDecode(token)
          return decoded.exp * 1000 < Date.now()
        } catch {
          return true
        }
      },

      login: async (email, password) => {
        try {
          const response = await api.post('/users/login', { email, password })
          const { user, accessToken } = response.data.data

          set({
            user,
            token: accessToken,
            isAuthenticated: true,
          })

          socket.auth = { token: accessToken }
          if (!socket.connected) socket.connect()

          return { success: true }
        } catch (error) {
          const msg = error?.response?.data?.message || error.message || "Invalid credentials"
          console.error("Login client error:", msg)
          return { success: false, error: msg }
        }
      },

      register: async (formData) => {
        try {
          await api.post('/users/register', formData)
          return { success: true }
        } catch (error) {
          return {
            success: false,
            error: error?.response?.data?.message || "Registration failed."
          }
        }
      },

      // Runs on app mount. Synchronously validates the persisted token.
      restoreSession: () => {
        const { token, isTokenExpired } = get()

        if (!token || isTokenExpired(token)) {
          // Token missing or expired — clear silently, no API call
          set({ user: null, token: null, isAuthenticated: false })
          return false
        }

        socket.auth = { token }
        if (!socket.connected) socket.connect()
        return true
      },

      setHasHydrated: (v) => set({ hasHydrated: v }),

      logout: () => {
        if (socket.connected) socket.disconnect()
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)