import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/axios'
import { socket } from '../utils/socket'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // --- LOGIN ACTION ---
      login: async (email, password) => {
        try {
          // 1. Call your authentication backend route
          const response = await api.post('/users/login', { email, password });
          
          // Tailor these based on your exact backend API response shape
          const { user, accessToken } = response.data.data; 


          
          // 2. Commit data to store state (persist middleware syncs this to localStorage)
          set({
            user,
            token: accessToken,
            isAuthenticated: true,
          });
          socket.auth = { token: accessToken };
          socket.connect();

          return { success: true };
        } catch (error) {
          console.error("Login client error:", error?.response?.data?.message || error.message);
          return { 
            success: false, 
            error: error?.response?.data?.message || "Invalid credentials. Please try again." 
          };
        }
      },

      // --- REGISTER ACTION ---
        register: async (formData) => {
        try {
            await api.post('/users/register', formData);
            return { success: true }; // just return success, redirect to login
        } catch (error) {
            return { 
            success: false, 
            error: error?.response?.data?.message || "Registration failed." 
            };
        }
},
      // --- LOGOUT ACTION ---
      logout: () => {
        // Clear everything smoothly
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage', // Key name within browser LocalStorage keyspace
    }
  )
)