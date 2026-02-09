import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import UnionPage from './pages/UnionPage.jsx'
import ShiftTodayPage from './pages/ShiftTodayPage.jsx'
import RoundsTodayPage from './pages/RoundsTodayPage.jsx'
import RoundRunPage from './pages/RoundRunPage.jsx'
import RoundsHistoryPage from './pages/RoundsHistoryPage.jsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
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
                path="union"
                element={
                  <ProtectedRoute>
                    <UnionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="shift/today"
                element={
                  <ProtectedRoute>
                    <ShiftTodayPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rounds/today"
                element={
                  <ProtectedRoute>
                    <RoundsTodayPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rounds/:id"
                element={
                  <ProtectedRoute>
                    <RoundRunPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rounds/history"
                element={
                  <ProtectedRoute>
                    <RoundsHistoryPage />
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
    </QueryClientProvider>
  </StrictMode>,
)
