import { Suspense, StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { SupabaseProvider } from './context/SupabaseProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const StartPage = lazy(() => import('./pages/StartPage.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage.jsx'))
const RosterPage = lazy(() => import('./pages/RosterPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const UnitSectionPage = lazy(() => import('./pages/UnitSectionPage.jsx'))
const UnitLandingPage = lazy(() => import('./pages/UnitLandingPage.jsx'))
const UnionPage = lazy(() => import('./pages/UnionPage.jsx'))
const ShiftTodayPage = lazy(() => import('./pages/ShiftTodayPage.jsx'))
const RoundsTodayPage = lazy(() => import('./pages/RoundsTodayPage.jsx'))
const RoundRunPage = lazy(() => import('./pages/RoundRunPage.jsx'))
const RoundsHistoryPage = lazy(() => import('./pages/RoundsHistoryPage.jsx'))
const ShiftTopicsPage = lazy(() => import('./pages/ShiftTopicsPage.jsx'))
const SocialHubPage = lazy(() => import('./pages/SocialHubPage.jsx'))
const EmployeeWorkspacePage = lazy(() => import('./pages/EmployeeWorkspacePage.jsx'))
const WorkplacePage = lazy(() => import('./pages/WorkplacePage.jsx'))
const TrainingPage = lazy(() => import('./pages/TrainingPage.jsx'))

const queryClient = new QueryClient()
const loadingFallback = (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="rounded-full border border-border bg-white px-4 py-2 text-sm text-grayText shadow-sm">
      Загрузка...
    </div>
  </div>
)

const withSuspense = (node) => <Suspense fallback={loadingFallback}>{node}</Suspense>
const withProtectedSuspense = (node) => <ProtectedRoute>{withSuspense(node)}</ProtectedRoute>

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={withSuspense(<StartPage />)} />
              <Route path="login" element={withSuspense(<LoginPage />)} />
              <Route
                path="hub"
                element={withProtectedSuspense(<SocialHubPage />)}
              />
              <Route
                path="equipment"
                element={withProtectedSuspense(<EquipmentPage />)}
              />
              <Route
                path="roster"
                element={withProtectedSuspense(<RosterPage />)}
              />
              <Route
                path="profile"
                element={withProtectedSuspense(<ProfilePage />)}
              />
              <Route
                path="union"
                element={withProtectedSuspense(<UnionPage />)}
              />
              <Route
                path="training"
                element={withProtectedSuspense(<TrainingPage />)}
              />
              <Route
                path="people/:employeeId"
                element={withProtectedSuspense(<EmployeeWorkspacePage />)}
              />
              <Route
                path="workplaces/:unit/:workplaceId"
                element={withProtectedSuspense(<WorkplacePage />)}
              />
              <Route
                path="shift/today"
                element={withProtectedSuspense(<ShiftTodayPage />)}
              />
              <Route
                path="rounds/today"
                element={withProtectedSuspense(<RoundsTodayPage />)}
              />
              <Route
                path="rounds/:id"
                element={withProtectedSuspense(<RoundRunPage />)}
              />
              <Route
                path="rounds/history"
                element={withProtectedSuspense(<RoundsHistoryPage />)}
              />
              <Route
                path="topics"
                element={withProtectedSuspense(<ShiftTopicsPage />)}
              />
              <Route
                path=":unit"
                element={withProtectedSuspense(<UnitLandingPage />)}
              />
              <Route
                path=":unit/:section"
                element={withProtectedSuspense(<UnitSectionPage />)}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </SupabaseProvider>
    </QueryClientProvider>
  </StrictMode>,
)
