import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import AgentList from '@/pages/AgentList'
import AgentBuilder from '@/pages/AgentBuilder'
import AgentDeployment from '@/pages/AgentDeployment'
import AdminDashboard from '@/pages/AdminDashboard'
import ConversationMonitoring from '@/pages/ConversationMonitoring'
import PerformanceAnalytics from '@/pages/PerformanceAnalytics'
import PrivacyDashboard from '@/pages/PrivacyDashboard'
import FunctionManagement from '@/pages/FunctionManagement'
import KnowledgeBase from '@/pages/KnowledgeBase'
import './App.css'

function App() {
  return (
    <div className="App">
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<AgentList />} />
          <Route path="/agents/new" element={<AgentBuilder />} />
          <Route path="/agents/:id" element={<AgentBuilder />} />
          <Route path="/agents/:id/deploy" element={<AgentDeployment />} />
          <Route path="/agents/:id/stats" element={<PerformanceAnalytics />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/conversations" element={<ConversationMonitoring />} />
          <Route path="/analytics" element={<PerformanceAnalytics />} />
          <Route path="/privacy" element={<PrivacyDashboard />} />
          <Route path="/functions" element={<FunctionManagement />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </div>
  )
}

export default App