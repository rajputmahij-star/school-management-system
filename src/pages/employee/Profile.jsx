import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { HiUser, HiBriefcase, HiCalendar, HiCurrencyRupee, HiDownload, HiEye } from 'react-icons/hi'
import ChangePasswordForm from '../../components/ui/ChangePasswordForm'
import { getCollection, getSettings, where } from '../../firebase/firestore'
import { downloadSalarySlip, viewSalarySlip } from '../../utils/salarySlip'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

export default function EmployeeProfile() {
  const { userData, refreshUserData } = useAuth()
  const now = new Date()
  const [salaries,    setSalaries]    = useState([])
  const [salLoading,  setSalLoading]  = useState(false)
  const [selYear,     setSelYear]     = useState(now.getFullYear())
  const [selMonth,    setSelMonth]    = useState(now.getMonth() + 1)
  const [settings,    setSettings]    = useState({})

  const uid = userData?.uid || userData?.id

  // Refresh user data on mount to pick up any photo changes made by admin
  useEffect(() => {
    refreshUserData().catch(() => {})
  }, [])

  useEffect(() => {
    getSettings().then((s) => setSettings(s || {})).catch(() => {})
  }, [])

  useEffect(() => {
    if (!uid) return
    loadSalary()
  }, [uid, selYear, selMonth])

  const loadSalary = async () => {
    setSalLoading(true)
    try {
      const docs = await getCollection('salaries', [
        where('employeeId', '==', uid),
        where('month', '==', selMonth),
        where('year',  '==', selYear),
      ])
      setSalaries(docs)
    } catch (err) {
      toast.error('Failed to load salary')
    } finally { setSalLoading(false) }
  }

  if (!userData) return null

  const salary = salaries[0] || null
  const years  = []
  for (let y = 2024; y <= now.getFullYear(); y++) years.push(y)

  const fields = [
    { icon: HiUser,          label: 'Employee ID',    value: userData.employeeId },
    { icon: HiBriefcase,     label: 'Designation',    value: userData.designation },
    { icon: HiCalendar,      label: 'Joining Date',   value: formatDate(userData.joiningDate) },
    { icon: HiCurrencyRupee, label: 'Monthly Salary', value: formatCurrency(userData.monthlySalary) },
    { icon: HiUser,          label: 'Status',         value: userData.status },
    { icon: HiUser,          label: 'Email',          value: userData.email },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>

      {/* Profile card */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700">
            {userData.photo ? (
              <img src={userData.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
                {userData.employeeName?.[0]}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userData.employeeName}</h2>
            <span className="badge-info mt-1">{userData.designation}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value || 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Salary History */}
      <div className="card p-4 sm:p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Salary History</h2>

        {/* Year + Month selectors */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label">Year</label>
            <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="input-field w-28">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="input-field w-36">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Salary slip display */}
        {salLoading ? (
          <div className="flex justify-center p-6"><LoadingSpinner size="md" /></div>
        ) : !salary ? (
          <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-sm">No salary record for {MONTHS[selMonth - 1]} {selYear}</p>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Monthly Salary</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(salary.monthlySalary)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Present Days</p>
                <p className="font-semibold text-gray-900 dark:text-white">{salary.presentDays} / {salary.monthDays}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Salary Earned</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(salary.salaryEarned)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Deduction (5%)</p>
                <p className="font-semibold text-red-500">- {formatCurrency(salary.deduction)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Professional SMC Tax</p>
                <p className="font-semibold text-red-500">- {formatCurrency(salary.smcTax || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Salary</p>
                <p className="font-bold text-green-600 text-base">{formatCurrency(salary.netSalary)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${salary.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                {salary.status}
              </span>
              <div className="flex gap-2">
                <button onClick={() => viewSalarySlip(salary, userData, settings)}
                  className="btn-secondary text-xs py-1.5 px-3">
                  <HiEye className="w-3.5 h-3.5" /> View
                </button>
                <button onClick={() => downloadSalarySlip(salary, userData, settings)}
                  className="btn-primary text-xs py-1.5 px-3">
                  <HiDownload className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ChangePasswordForm />
    </div>
  )
}
