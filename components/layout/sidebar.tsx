'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { 
  LayoutDashboard, 
  Users,
  Menu,
  X,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const menuItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    name: 'Leads',
    href: '/leads',
    icon: Users
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMenuCollapsed, setIsDesktopMenuCollapsed] = useState(false)
  const { user, signOut } = useAuth()

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed')
    if (savedState !== null) {
      setIsDesktopMenuCollapsed(JSON.parse(savedState))
    }
  }, [])

  // Save collapsed state to localStorage when it changes
  const toggleDesktopMenu = () => {
    const newState = !isDesktopMenuCollapsed
    setIsDesktopMenuCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState))
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      // Sign out failed - continue anyway for UX
    }
  }

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-1/2 left-4 z-50 p-2 bg-white rounded-md shadow-md transform -translate-y-1/2"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Desktop Toggle Button - Always visible */}
      <button
        onClick={toggleDesktopMenu}
        className={`hidden lg:block fixed top-4 z-50 p-2 bg-white rounded-md shadow-lg border transition-all duration-300 hover:bg-gray-50 ${
          isDesktopMenuCollapsed ? 'left-4' : 'left-52'
        }`}
        title={isDesktopMenuCollapsed ? 'Expand menu' : 'Collapse menu'}
      >
        {isDesktopMenuCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-gray-900 transform transition-all duration-300 ease-in-out w-64
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDesktopMenuCollapsed ? 'lg:w-16' : 'lg:w-56'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center justify-center h-20 px-4 bg-white border-b border-gray-200 ${
            isDesktopMenuCollapsed ? 'lg:px-2' : ''
          }`}>
            <div className={`flex items-center ${isDesktopMenuCollapsed ? 'lg:flex-col lg:space-x-0 lg:space-y-1' : 'space-x-4'}`}>
              <Image
                src="/logo.png"
                alt="Logo"
                width={isDesktopMenuCollapsed ? 32 : 56}
                height={isDesktopMenuCollapsed ? 32 : 56}
                className={`${isDesktopMenuCollapsed ? 'lg:h-8 lg:w-8' : 'h-14 w-14'}`}
              />
              {!isDesktopMenuCollapsed && (
                <h2 className="text-2xl font-semibold text-gray-800 lg:block hidden">CRM</h2>
              )}
            </div>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors relative group
                    ${isActive 
                      ? 'bg-gray-800 text-white' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                    ${isDesktopMenuCollapsed ? 'lg:justify-center lg:px-2' : ''}
                  `}
                  title={isDesktopMenuCollapsed ? item.name : ''}
                >
                  <Icon className={`h-5 w-5 ${isDesktopMenuCollapsed ? 'lg:mr-0' : 'mr-3'}`} />
                  <span className={`${isDesktopMenuCollapsed ? 'lg:hidden' : ''}`}>
                    {item.name}
                  </span>
                  
                  {/* Tooltip for collapsed state */}
                  {isDesktopMenuCollapsed && (
                    <div className="hidden lg:group-hover:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className={`flex-shrink-0 p-4 border-t border-gray-800 ${
            isDesktopMenuCollapsed ? 'lg:px-2' : ''
          }`}>
            <div className={`flex items-center ${
              isDesktopMenuCollapsed ? 'lg:flex-col lg:space-y-2' : 'justify-between'
            }`}>
              {!isDesktopMenuCollapsed ? (
                <>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-[#FE8F00] rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">
                        {user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-xs text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="hidden lg:flex flex-col items-center space-y-2">
                  <div className="w-8 h-8 bg-[#FE8F00] rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}