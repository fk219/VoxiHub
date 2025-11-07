import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Bot, 
  MessageSquare, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Sparkles
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Agents', href: '/agents', icon: Bot },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Privacy', href: '/privacy', icon: Shield },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-lime-50/30">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 sidebar-modern transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-lime-400 to-lime-600 rounded-xl blur opacity-50"></div>
                <div className="relative bg-gradient-to-br from-lime-400 to-lime-600 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <span className="text-xl font-light tracking-tight gradient-text">VoxiHub</span>
                <p className="text-xs text-gray-400 font-light">AI Platform</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  <span className="text-sm">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center space-x-3 px-3 py-2 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-lime-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-light text-white">JD</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-light text-gray-900 truncate">John Doe</p>
                <p className="text-xs text-gray-400 truncate">john@example.com</p>
              </div>
            </div>
            <button className="nav-item w-full">
              <LogOut className="w-4 h-4 mr-3" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-between ml-4 lg:ml-0">
            <div>
              <h1 className="text-2xl font-light text-gray-900 tracking-tight">
                {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
              </h1>
              <p className="text-sm text-gray-400 font-light mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-lime-50 to-lime-100/50 rounded-full">
                <div className="w-2 h-2 bg-lime-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-light text-lime-700">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6 lg:p-8 fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
