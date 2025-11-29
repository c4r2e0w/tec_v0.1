import './index.css'
import { Outlet } from 'react-router-dom'
import Layout from './components/Layout'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Layout>
        <Outlet />
      </Layout>
    </div>
  )
}

export default App
