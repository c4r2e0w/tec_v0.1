import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StartPage from './pages/StartPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import EquipmentPage from './pages/EquipmentPage.jsx'
import RosterPage from './pages/RosterPage.jsx'
import { SupabaseProvider } from './context/SupabaseProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import UnitSectionPage from './pages/UnitSectionPage.jsx'
import UnitLandingPage from './pages/UnitLandingPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SupabaseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<StartPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route
              path="equipment"
              element={
                <ProtectedRoute>
                  <EquipmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="roster"
              element={
                <ProtectedRoute>
                  <RosterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path=":unit"
              element={
                <ProtectedRoute>
                  <UnitLandingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path=":unit/:section"
              element={
                <ProtectedRoute>
                  <UnitSectionPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </SupabaseProvider>
  </StrictMode>,
)
