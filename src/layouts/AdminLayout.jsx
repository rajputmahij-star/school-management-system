import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  HiHome, HiAcademicCap, HiUsers, HiCalendar, HiCurrencyRupee,
  HiDocumentReport, HiCog, HiMenu, HiLogout,
  HiMoon, HiSun, HiClipboardList, HiTable, HiViewGrid,
} from 'react-icons/hi'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/admin/dashboard',           label: 'Dashboard',           icon: HiHome },
  { path: '/admin/students',            label: 'Students',            icon: HiAcademicCap },
  { path: '/admin/employees',           label: 'Employees',           icon: HiUsers },
  { path: '/admin/employee-attendance', label: 'Employee Attendance', icon: HiCalendar },
  { path: '/admin/student-attendance',  label: 'Student Attendance',  icon: HiClipboardList },
  { path: '/admin/attendance-viewer',   label: 'Attendance Viewer',   icon: HiViewGrid },
  { path: '/admin/leave-management',    label: 'Leave Management',    icon: HiCalendar },
  { path: '/admin/timetable',           label: 'Timetable',           icon: HiTable },
  { path: '/admin/salary',              label: 'Salary',              icon: HiCurrencyRupee },
  { path: '/admin/fees',                label: 'Fee Management',      icon: HiClipboardList },
  { path: '/admin/fee-rules',           label: 'Fee Rules',           icon: HiCurrencyRupee },
  { path: '/admin/reports',             label: 'Reports',             icon: HiDocumentReport },
  { path: '/admin/settings',            label: 'Settings',            icon: HiCog },
]

export default function AdminLayout() {
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

      {/* Sidebar — brand navy gradient */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-30 transform transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
        style={{ background: 'linear-gradient(180deg, #16377A 0%, #0b1b40 100%)' }}>

        {/* Sidebar portal label */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-center">
          <p className="text-primary-400 font-semibold tracking-widest uppercase" style={{ fontSize: '11px' }}>Admin Portal</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-400">
                {(userData?.adminName || userData?.name || 'A')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userData?.adminName || userData?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400 capitalize">{userData?.role}</p>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400">
              <HiLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-10 border-b border-blue-800 shadow-md backdrop-blur-md"
          style={{ background: 'linear-gradient(90deg, #16377A 0%, #1e4da1 100%)' }}>
          <div className="px-4 py-2 flex items-center justify-between">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0">
              <HiMenu className="w-5 h-5 text-white" />
            </button>

            {/* School branding — stretches to fill available space */}
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

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
