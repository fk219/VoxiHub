import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  MdDashboard, 
  MdSmartToy, 
  MdChat, 
  MdAnalytics, 
  MdSecurity, 
  MdSettings,
  MdMenu,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdFunctions
} from 'react-icons/md'
import { HiSparkles } from 'react-icons/hi2'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: MdDashboard },
    { name: 'Agents', href: '/agents', icon: MdSmartToy },
    { name: 'Conversations', href: '/conversations', icon: MdChat },
    { name: 'Analytics', href: '/analytics', icon: MdAnalytics },
    { name: 'Functions', href: '/functions', icon: MdFunctions },
    { name: 'Privacy', href: '/privacy', icon: MdSecurity },
    { name: 'Settings', href: '/settings', icon: MdSettings },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <HiSparkles size={20} />
          </div>
          {!sidebarCollapsed && (
            <div className="logo-text">VoxiHub</div>
          )}
          <button 
            className="mobile-close"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <MdClose size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
                onClick={() => setMobileSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : ''}
              >
                <Icon className="nav-icon" size={20} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="sidebar-user">
            <div className="user-info">
              <div className="user-avatar">JD</div>
              <div className="user-details">
                <div className="user-name">John Doe</div>
                <div className="user-email">john@example.com</div>
              </div>
            </div>
          </div>
        )}

        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <MdChevronRight size={20} /> : <MdChevronLeft size={20} />}
        </button>
      </aside>

      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="top-bar">
          <div className="top-bar-left">
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <MdMenu size={24} />
            </button>
            <h1 className="page-title">
              {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
            </h1>
          </div>
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>All Systems Operational</span>
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
