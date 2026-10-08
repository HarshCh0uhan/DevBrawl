import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import './index.css'
import App from './App.jsx'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/Login.jsx'
import { useAuthStore } from './store/authStore.js'
import RegisterPage from './pages/Registration.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RoomPage from './pages/Room.jsx'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" />
}

// Initialize auth session on app load
function AuthInitializer() {
  const restoreSession = useAuthStore((state) => state.restoreSession)

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  return null
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthInitializer />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/room/:inviteCode" element={
          <ProtectedRoute>
            <RoomPage />
          </ProtectedRoute>
        } />
    </Routes>
  </BrowserRouter>
)