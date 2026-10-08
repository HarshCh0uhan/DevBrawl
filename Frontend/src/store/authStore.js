import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/axios'
import { socket } from '../utils/socket'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      // --- Helper: Check if token is expired ---
      isTokenExpired: (token) => {
        if (!token) return true
        try {
          const decoded = jwtDecode(token)
          return decoded.exp * 1000 < Date.now()
        } catch {
          return true
        }
      },

      // --- Helper: Refresh access token ---
      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          console.warn('No refresh token available')
          return false
        }

        try {
          const response = await api.post('/users/refresh-token', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken } = response.data.data

          set({ token: accessToken, refreshToken: newRefreshToken })
          socket.auth = { token: accessToken }
          return true
        } catch (error) {
          console.error('Token refresh failed:', error)
          // Refresh failed - logout user
          get().logout()
          return false
        }
      },

      // --- Ensure valid token before socket connection ---
      ensureValidToken: async () => {
        const { token, isTokenExpired, refreshAccessToken } = get()
        
        if (!token) return false
        
        if (isTokenExpired(token)) {
          console.log('🔄 Access token expired, refreshing...')
          return await refreshAccessToken()
        }
        return true
      },

      // --- LOGIN ACTION ---
      login: async (email, password) => {
        try {
          const response = await api.post('/users/login', { email, password })
          
          const { user, accessToken, refreshToken } = response.data.data

          set({
            user,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
          })
          
          // Connect socket with fresh token
          socket.auth = { token: accessToken }
          socket.connect()

          return { success: true }
        } catch (error) {
          console.error("Login client error:", error?.response?.data?.message || error.message)
          return { 
            success: false, 
            error: error?.response?.data?.message || "Invalid credentials. Please try again." 
          }
        }
      },

      // --- REGISTER ACTION ---
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

      // --- RESTORE SESSION (call on app init) ---
      restoreSession: async () => {
        const { token, refreshToken, isTokenExpired, refreshAccessToken } = get()
        
        if (!token || !refreshToken) {
          return false
        }

        if (isTokenExpired(token)) {
          console.log('🔄 Restoring session: token expired, refreshing...')
          return await refreshAccessToken()
        }
        
        // Token still valid, connect socket
        socket.auth = { token }
        socket.connect()
        return true
      },

      // --- LOGOUT ACTION ---
      logout: () => {
        socket.disconnect()
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)