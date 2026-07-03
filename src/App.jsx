import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import NotFound from './pages/NotFound'
import AdminLayout from './layouts/AdminLayout'
import EmployeeLayout from './layouts/EmployeeLayout'
import StudentLayout from './layouts/StudentLayout'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import Students from './pages/admin/Students'
import Employees from './pages/admin/Employees'
import EmployeeAttendancePage from './pages/admin/EmployeeAttendance'
import AdminStudentAttendancePage from './pages/admin/StudentAttendance'
import SalaryManagement from './pages/admin/SalaryManagement'
import FeeManagement from './pages/admin/FeeManagement'
import FeeRules from './pages/admin/FeeRules'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'
import AdminTimetable from './pages/admin/Timetable'
import AdminLeaveManagement from './pages/admin/LeaveManagement'
import AdminAttendanceViewer from './pages/admin/AttendanceViewer'

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard'
import StudentAttendancePage from './pages/employee/StudentAttendance'
import EmployeeProfile from './pages/employee/Profile'
import EmployeeTimetable from './pages/employee/Timetable'
import EmployeeLeaveRequest from './pages/employee/LeaveRequest'

// Student Pages
import StudentDashboard from './pages/student/Dashboard'
import StudentProfile from './pages/student/Profile'
import StudentAttendanceView from './pages/student/Attendance'
import StudentFees from './pages/student/Fees'
import PaymentHistory from './pages/student/PaymentHistory'
import StudentTimetable from './pages/student/Timetable'
import StudentLeaveInfo from './pages/student/LeaveInfo'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { borderRadius: '10px', fontSize: '14px' },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<Students />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employee-attendance" element={<EmployeeAttendancePage />} />
              <Route path="student-attendance" element={<AdminStudentAttendancePage />} />
              <Route path="salary" element={<SalaryManagement />} />
              <Route path="fees" element={<FeeManagement />} />
              <Route path="fee-rules" element={<FeeRules />} />
              <Route path="reports" element={<Reports />} />
              <Route path="timetable" element={<AdminTimetable />} />
              <Route path="leave-management" element={<AdminLeaveManagement />} />
              <Route path="attendance-viewer" element={<AdminAttendanceViewer />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Employee Routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="timetable" element={<EmployeeTimetable />} />
              <Route path="leave" element={<EmployeeLeaveRequest />} />
              <Route path="profile" element={<EmployeeProfile />} />
            </Route>

            {/* Student Routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="attendance" element={<StudentAttendanceView />} />
              <Route path="fees" element={<StudentFees />} />
              <Route path="payments" element={<PaymentHistory />} />
              <Route path="timetable" element={<StudentTimetable />} />
              <Route path="leave" element={<StudentLeaveInfo />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
