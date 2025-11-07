import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Bot, 
  MessageSquare, 
  BarChart3, 
  Settings,
  Shield,
  Menu,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-lime-50/20">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
            <Link to="/" className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-lime-400 to-lime-600 rounded-lg blur-sm opacity-50"></div>
                <div className="relative bg-gradient-to-br from-lime-400 to-lime-600 p-2 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <span className="text-lg font-light bg-gradient-to-r from-lime-600 to-lime-500 bg-clip-text text-transparent">
                  VoxiHub
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-light
                    transition-all duration-200
                    ${active
                      ? 'bg-gradient-to-r from-lime-500 to-lime-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {active && <ChevronRight className="w-4 h-4" />}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-slate-50">
              <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-lime-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-light text-white">JD</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-light text-slate-900 truncate">John Doe</p>
                <p className="text-xs text-slate-500 truncate">john@example.com</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between h-full px-4 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-400 hover:text-slate-600"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div>
                <h1 className="text-xl font-light text-slate-900">
                  {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-lime-50 rounded-full">
                <div className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-light text-lime-700">All Systems Operational</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
