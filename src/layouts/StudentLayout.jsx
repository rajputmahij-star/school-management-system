import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { HiHome, HiCalendar, HiUser, HiMenu, HiLogout, HiMoon, HiSun, HiCurrencyRupee, HiClipboardList, HiTable } from 'react-icons/hi'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/student/dashboard',  label: 'Dashboard',         icon: HiHome },
  { path: '/student/profile',    label: 'Profile',           icon: HiUser },
  { path: '/student/attendance', label: 'Attendance',        icon: HiCalendar },
  { path: '/student/timetable',  label: 'Timetable',         icon: HiTable },
  { path: '/student/fees',       label: 'Fees & Payment',    icon: HiCurrencyRupee },
  { path: '/student/payments',   label: 'Payment History',   icon: HiClipboardList },
  { path: '/student/leave',      label: 'Leave Information', icon: HiCalendar },
]

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { userData, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — navy + orange accent */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-30 transform transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
        style={{ background: 'linear-gradient(180deg, #16377A 0%, #0b1b40 100%)' }}>

        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-center">
          <p className="text-orange-300 font-semibold tracking-widest uppercase" style={{ fontSize: '11px' }}>Student Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/20 flex items-center justify-center">
              {userData?.photo
                ? <img src={userData.photo} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-white">{(userData?.studentName || 'S')[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userData?.studentName}</p>
              <p className="text-xs text-gray-400">{userData?.className}</p>
            </div>
            <button onClick={handleLogout}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400">
              <HiLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-blue-800 shadow-md"
          style={{ background: 'linear-gradient(90deg, #16377A 0%, #1e4da1 100%)' }}>
          <div className="px-4 py-2 flex items-center justify-between">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0">
              <HiMenu className="w-5 h-5 text-white" />
            </button>

            {/* School branding */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center">
              <img src="/Trust Logo.avif" alt="Trust"
                className="w-7 h-7 sm:w-12 sm:h-12 object-contain rounded-lg flex-shrink-0" />
              <img src="/image.png" alt="School"
                className="w-7 h-7 sm:w-12 sm:h-12 object-contain rounded-lg flex-shrink-0" />
              <div className="text-center">
                <p className="font-school font-bold text-orange-400 leading-tight uppercase tracking-wide"
                  style={{ fontSize: 'clamp(11px, 3.5vw, 24px)' }}>
                  ANAND SPECIAL SCHOOL
                </p>
                <p className="font-school text-blue-200 leading-tight"
                  style={{ fontSize: 'clamp(8px, 2.2vw, 15px)' }}>
                  Mngd. by Anand Rehabilitation Trust
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                {theme === 'dark'
                  ? <HiSun className="w-5 h-5 text-yellow-300" />
                  : <HiMoon className="w-5 h-5 text-blue-200" />}
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
