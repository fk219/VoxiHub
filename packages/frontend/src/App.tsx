import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import AgentList from '@/pages/AgentList'
import MultiStepAgentBuilder from '@/pages/MultiStepAgentBuilder'
import AgentDeployment from '@/pages/AgentDeployment'
import AgentTestingNew from '@/pages/AgentTestingNew'
import AdminDashboard from '@/pages/AdminDashboard'
import ConversationMonitoring from '@/pages/ConversationMonitoring'
import PerformanceAnalytics from '@/pages/PerformanceAnalytics'
import PrivacyDashboard from '@/pages/PrivacyDashboard'
import FunctionManagement from '@/pages/FunctionManagement'
import KnowledgeBase from '@/pages/KnowledgeBase'
import KnowledgeBaseDetail from '@/pages/KnowledgeBaseDetail'
import './App.css'

function App() {
  return (
    <div className="App">
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<AgentList />} />
          <Route path="/agents/new" element={<MultiStepAgentBuilder />} />
          <Route path="/agents/:id" element={<MultiStepAgentBuilder />} />
          <Route path="/agents/:id/deploy" element={<AgentDeployment />} />
          <Route path="/agents/:id/test" element={<AgentTestingNew />} />
          <Route path="/agents/:id/stats" element={<PerformanceAnalytics />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/conversations" element={<ConversationMonitoring />} />
          <Route path="/analytics" element={<PerformanceAnalytics />} />
          <Route path="/privacy" element={<PrivacyDashboard />} />
          <Route path="/functions" element={<FunctionManagement />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetail />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </div>
  )
}

export default App