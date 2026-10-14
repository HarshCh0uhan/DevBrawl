import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/Login.jsx'
import { useAuthStore } from './store/authStore.js'
import RegisterPage from './pages/Registration.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RoomPage from './pages/Room.jsx'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs uppercase tracking-widest">
        Loading session...
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

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
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/room/:inviteCode" element={
          <ProtectedRoute>
            <RoomPage />
          </ProtectedRoute>
        } />
    </Routes>
  </BrowserRouter>
)