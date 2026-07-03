import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  HiPlus, HiSearch, HiPencil, HiTrash, HiEye,
  HiDownload, HiKey, HiUserRemove, HiUserAdd,
  HiUpload, HiTemplate, HiCheckCircle, HiExclamation,
} from 'react-icons/hi'
import { getEmployees, getCustomFields, getFormOptions, setDocument, deleteDocument } from '../../firebase/firestore'
import {
  createEmployeeAccount, updateEmployeeRecord, deleteEmployeeRecord,
  deactivateEmployee, activateEmployee, adminSetPassword,
} from '../../firebase/adminAuth'
import { uploadPhoto } from '../../firebase/storage'
import { formatDate, generateEmployeeId, formatCurrency, paginate } from '../../utils/helpers'
import { exportEmployeesToExcel } from '../../utils/excelExport'
import { parseExcelFile, mapRowsToEmployees, downloadEmployeeImportTemplate } from '../../utils/excelImport'
import { generateEmployeeReport } from '../../utils/pdfExport'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import ImageUpload from '../../components/ui/ImageUpload'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Timestamp, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

import { SCHOOL_CLASSES, DEFAULT_FORM_OPTIONS } from '../../utils/helpers'

const DESIGNATIONS = [
  'Principal',
  'Co-ordinator',
  'Special Educator',
  'Educator',
  'Assistant Educator',
  'Helper',
  'Office Assistant',
  'Intern',
  'Driver',
  'Guard',
]

const EMPTY = {
  email: '', password: '', employeeId: '', photo: '',
  employeeName: '', designation: '', joiningDate: '', monthlySalary: '',
  panNumber: '', bankName: '', bankAccount: '', ifscCode: '',
  assignedClass: '',
}

// ── Stable field components — defined at MODULE SCOPE to prevent remounting ──
const TextField = ({ label, type = 'text', value, onChange, required, placeholder }) => (
  <div>
    <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
    <input type={type} value={value} onChange={onChange}
      className="input-field" required={required} placeholder={placeholder} />
  </div>
)
const SelectField = ({ label, value, onChange, options, required }) => (
  <div>
    <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
    <select value={value} onChange={onChange} className="input-field" required={required}>
      <option value="">Select {label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
)

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [formOptions, setFormOptions]   = useState(DEFAULT_FORM_OPTIONS)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')   // all | active | left
  const [page, setPage]           = useState(1)
  const [form, setForm]           = useState({ ...EMPTY, employeeId: generateEmployeeId() })
  const [editData, setEditData]   = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewOpen, setViewOpen]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [pwModal, setPwModal]     = useState({ open: false, emp: null })
  const [pwForm, setPwForm]       = useState({ current: '', newPw: '', confirm: '' })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, uid: null, name: '' })
  const [importModal,  setImportModal]  = useState(false)
  const [importRows,   setImportRows]   = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing,    setImporting]    = useState(false)
  const [importDone,   setImportDone]   = useState(0)
  const fileInputRef = useRef(null)

  // Stable handlers — prevent input remounting on every keystroke
  const handleEmail         = useCallback((e) => setForm((p) => ({ ...p, email:         e.target.value })), [])
  const handlePassword      = useCallback((e) => setForm((p) => ({ ...p, password:      e.target.value })), [])
  const handleEmployeeId    = useCallback((e) => setForm((p) => ({ ...p, employeeId:    e.target.value })), [])
  const handleEmployeeName  = useCallback((e) => setForm((p) => ({ ...p, employeeName:  e.target.value })), [])
  const handleDesignation   = useCallback((e) => setForm((p) => ({ ...p, designation:   e.target.value })), [])
  const handleJoiningDate   = useCallback((e) => setForm((p) => ({ ...p, joiningDate:   e.target.value })), [])
  const handleMonthlySalary = useCallback((e) => setForm((p) => ({ ...p, monthlySalary: e.target.value })), [])
  const handlePanNumber     = useCallback((e) => setForm((p) => ({ ...p, panNumber:     e.target.value })), [])
  const handleBankName      = useCallback((e) => setForm((p) => ({ ...p, bankName:      e.target.value })), [])
  const handleBankAccount   = useCallback((e) => setForm((p) => ({ ...p, bankAccount:   e.target.value })), [])
  const handleIfscCode      = useCallback((e) => setForm((p) => ({ ...p, ifscCode:      e.target.value })), [])

  const handleAssignedClass  = useCallback((e) => setForm((p) => ({ ...p, assignedClass:   e.target.value })), [])

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [emps, cf, fo] = await Promise.all([getEmployees(), getCustomFields(), getFormOptions()])
      setEmployees(emps)
      setCustomFields(cf?.employeeFields || [])
      if (fo) setFormOptions({ ...DEFAULT_FORM_OPTIONS, ...fo })
    } catch (err) {
      toast.error(`Failed to load employees: ${err.message}`)
    } finally { setLoading(false) }
  }

  // Status: active = no leaveDate, left = has leaveDate
  const statusCounts = useMemo(() => ({
    all:    employees.length,
    active: employees.filter((e) => !e.leaveDate).length,
    left:   employees.filter((e) => !!e.leaveDate).length,
  }), [employees])

  const filtered = useMemo(() => employees.filter((e) => {
    const q = search.toLowerCase()
    const matchQ = !q || [e.employeeName, e.employeeId, e.designation, e.email]
      .some((v) => v?.toLowerCase().includes(q))
    const matchF =
      filter === 'all'    ||
      (filter === 'active' && !e.leaveDate) ||
      (filter === 'left'   && !!e.leaveDate)
    return matchQ && matchF
  }), [employees, search, filter])

  const paged = useMemo(() => paginate(filtered, page, 10), [filtered, page])

  const openAdd = () => {
    setEditData(null)
    setForm({ ...EMPTY, employeeId: generateEmployeeId() })
    setPhotoFile(null)
    setModalOpen(true)
  }

  const openEdit = (emp) => {
    setEditData(emp)
    const customValues = {}
    customFields.forEach((f) => { customValues[`custom_${f.id}`] = emp[`custom_${f.id}`] || '' })
    setForm({
      email:         emp.email          || '',
      password:      '',
      employeeId:    emp.employeeId     || '',
      photo:         emp.photo          || '',
      employeeName:  emp.employeeName   || '',
      designation:   emp.designation    || '',
      joiningDate:   emp.joiningDate    ? formatDate(emp.joiningDate, 'yyyy-MM-dd') : '',
      monthlySalary: emp.monthlySalary  != null ? String(emp.monthlySalary) : '',
      panNumber:     emp.panNumber      || '',
      bankName:      emp.bankName       || '',
      bankAccount:   emp.bankAccount    || '',
      ifscCode:      emp.ifscCode       || '',
      assignedClass: emp.assignedClass  || '',
      ...customValues,
    })
    setPhotoFile(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.employeeName.trim()) { toast.error('Employee name is required'); return }
    if (!form.designation)         { toast.error('Designation is required'); return }
    if (!editData) {
      if (!form.email.trim())       { toast.error('Email is required'); return }
      if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    }
    setSaving(true)
    try {
      let photo = form.photo
      if (photoFile) {
        const id = editData ? (editData.uid || editData.id) : form.employeeId
        photo = await uploadPhoto(photoFile, 'employees', id)
      }
      const customData = {}
      customFields.forEach((f) => { customData[`custom_${f.id}`] = form[`custom_${f.id}`] || '' })
      const data = {
        employeeId:    form.employeeId.trim(),
        photo,
        employeeName:  form.employeeName.trim(),
        designation:   form.designation,
        joiningDate:   form.joiningDate ? Timestamp.fromDate(new Date(form.joiningDate)) : null,
        monthlySalary: Number(form.monthlySalary) || 0,
        panNumber:     form.panNumber.trim(),
        bankName:      form.bankName.trim(),
        bankAccount:   form.bankAccount.trim(),
        ifscCode:      form.ifscCode.trim().toUpperCase(),
        assignedClass: form.assignedClass || '',
        ...customData,
      }
      if (editData) {
        await updateEmployeeRecord(editData.uid || editData.id, data)
        toast.success('Employee updated successfully')
      } else {
        await createEmployeeAccount(form.email.trim(), form.password, data)
        toast.success(`Account created for ${form.employeeName}`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Operation failed')
      console.error('Employee save error:', err)
    } finally { setSaving(false) }
  }

  // Mark as left — set leaveDate to today
  const markAsLeft = async (emp) => {
    const uid = emp.uid || emp.id
    try {
      await updateEmployeeRecord(uid, {
        leaveDate: Timestamp.fromDate(new Date()),
        status: 'left',
      })
      toast.success(`${emp.employeeName} marked as Left`)
      load()
    } catch (err) { toast.error(`Failed: ${err.message}`) }
  }

  // Rejoin — remove leaveDate
  const markAsActive = async (emp) => {
    const uid = emp.uid || emp.id
    try {
      await updateEmployeeRecord(uid, { leaveDate: null, status: 'active' })
      toast.success(`${emp.employeeName} marked as Active`)
      load()
    } catch (err) { toast.error(`Failed: ${err.message}`) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const emp    = employees.find((e) => (e.uid || e.id) === deleteDialog.uid)
    const undoUid = deleteDialog.uid
    try {
      if (emp) {
        await setDocument('deleted_employees', undoUid, { ...emp, deletedAt: new Date().toISOString() })
      }
      await deleteEmployeeRecord(undoUid)
      toast.success(
        <div className="flex items-center gap-3">
          <span>Employee deleted</span>
          <button
            onClick={async () => {
              if (emp) {
                await setDocument('employees', undoUid, { ...emp })
                await deleteDocument('deleted_employees', undoUid)
                load()
                toast.success('Employee restored!')
              }
            }}
            className="text-xs bg-white text-gray-800 px-2 py-1 rounded font-semibold hover:bg-gray-100"
          >Undo</button>
        </div>,
        { duration: 8000 }
      )
      setDeleteDialog({ open: false, uid: null, name: '' })
      load()
    } catch (err) { toast.error(`Failed to delete: ${err.message}`) }
    finally { setDeleting(false) }
  }

  const handleResetPw = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6)         { toast.error('Min 6 characters'); return }
    setSaving(true)
    try {
      await adminSetPassword(pwModal.emp.email, pwForm.current, pwForm.newPw)
      toast.success('Password reset successfully')
      setPwModal({ open: false, emp: null })
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      toast.error(err.message || 'Reset failed')
    } finally { setSaving(false) }
  }

  // ─── Import handling ──────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const rows = await parseExcelFile(file)
      const { employees: mapped, errors } = mapRowsToEmployees(rows)
      setImportRows(mapped)
      setImportErrors(errors)
      setImportDone(0)
      if (errors.length === 0) {
        toast.success(`${mapped.length} employees ready to import`)
      } else {
        toast.error(`Found ${errors.length} error(s) — check and fix`)
      }
    } catch (err) {
      toast.error(err.message)
      setImportRows([])
      setImportErrors([err.message])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (importRows.length === 0) { toast.error('No employees to import'); return }
    if (importErrors.length > 0) {
      toast.error('Fix errors before importing'); return
    }
    setImporting(true)
    let success = 0
    try {
      for (const employee of importRows) {
        // Generate employee ID if missing
        if (!employee.employeeId) employee.employeeId = generateEmployeeId()
        
        // Set defaults
        if (!employee.designation) employee.designation = 'Staff'
        if (!employee.joiningDate) {
          employee.joiningDate = Timestamp.fromDate(new Date())
        }
        
        // Generate email if missing
        if (!employee.email) {
          const cleanId = employee.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')
          employee.email = `${cleanId}@school.com`
        }
        
        // Use employeeId as document ID
        const docId = employee.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')
        
        await setDoc(doc(db, 'employees', docId), {
          ...employee,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
        
        success++
        setImportDone(success)
      }
      toast.success(`${success} employees imported successfully!`)
      setImportModal(false)
      setImportRows([])
      setImportErrors([])
      load()
    } catch (err) {
      toast.error(`Import failed after ${success} employees: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Management</h1>
          <p className="text-sm text-gray-500">{employees.length} total employees</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => generateEmployeeReport(employees)} className="btn-secondary text-sm">
            <HiDownload className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => exportEmployeesToExcel(employees)} className="btn-secondary text-sm">
            <HiDownload className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => { setImportRows([]); setImportErrors([]); setImportDone(0); setImportModal(true) }} className="btn-secondary text-sm">
            <HiUpload className="w-4 h-4" /> Import Excel
          </button>
          <button onClick={openAdd} className="btn-primary text-sm">
            <HiPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search name, ID, designation, email…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input-field pl-9" />
      </div>

      {/* Filter pills — Active and Left only */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',    label: 'All Employees', active: 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',   inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200' },
          { key: 'active', label: 'Active',         active: 'bg-green-600 text-white',  inactive: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100' },
          { key: 'left',   label: 'Left',           active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-yellow-100' },
        ].map(({ key, label, active, inactive }) => (
          <button key={key} onClick={() => { setFilter(key); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === key ? active : inactive}`}>
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filter === key ? 'bg-white/30' : 'bg-black/10 dark:bg-white/10'}`}>
              {statusCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="table-header">Employee</th>
                    <th className="table-header">Designation</th>
                    <th className="table-header hidden md:table-cell">Joining Date</th>
                    <th className="table-header hidden lg:table-cell">Salary</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paged.data.length === 0
                    ? <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-12">No employees found</td></tr>
                    : paged.data.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                              {emp.photo
                                ? <img src={emp.photo} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{emp.employeeName?.[0]}</div>
                              }
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{emp.employeeName}</p>
                              <p className="text-xs text-gray-500">{emp.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell"><span className="badge-info">{emp.designation}</span></td>
                        <td className="table-cell hidden md:table-cell">{formatDate(emp.joiningDate)}</td>
                        <td className="table-cell hidden lg:table-cell">{formatCurrency(emp.monthlySalary)}</td>
                        <td className="table-cell">
                          {emp.leaveDate
                            ? <span className="badge-warning">Left</span>
                            : <span className="badge-success">Active</span>
                          }
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSelected(emp); setViewOpen(true) }}
                              title="View" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                              <HiEye className="w-4 h-4 text-gray-500" />
                            </button>
                            {!emp.leaveDate && <button onClick={() => openEdit(emp)}
                              title="Edit" className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                              <HiPencil className="w-4 h-4 text-blue-500" />
                            </button>}
                            <button
                              onClick={() => { setPwModal({ open: true, emp }); setPwForm({ current: '', newPw: '', confirm: '' }) }}
                              title="Reset Password" className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg">
                              <HiKey className="w-4 h-4 text-purple-500" />
                            </button>
                            {emp.leaveDate
                              ? <>
                                  <button onClick={() => markAsActive(emp)} title="Mark Active"
                                    className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                                    <HiUserAdd className="w-4 h-4 text-green-500" />
                                  </button>
                                  <button onClick={() => setDeleteDialog({ open: true, uid: emp.uid || emp.id, name: emp.employeeName })}
                                    title="Delete" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                    <HiTrash className="w-4 h-4 text-red-500" />
                                  </button>
                                </>
                              : <button onClick={() => markAsLeft(emp)} title="Mark as Left"
                                  className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg">
                                  <HiUserRemove className="w-4 h-4 text-yellow-500" />
                                </button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
              <span>Showing {paged.data.length} of {paged.total}</span>
              <Pagination currentPage={page} totalPages={paged.totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)}
        title={editData ? 'Edit Employee' : 'Add New Employee'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex justify-center">
            <ImageUpload currentUrl={form.photo} onUpload={(file) => setPhotoFile(file)} />
          </div>
          {!editData && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                🔐 Login Credentials (set by Admin)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Email Address"          type="email"    value={form.email}    onChange={handleEmail}    required placeholder="employee@school.com" />
                <TextField label="Password (min 6 chars)" type="password" value={form.password} onChange={handlePassword} required placeholder="Min 6 characters" />
              </div>
            </div>
          )}
          {editData && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500">
              📧 Email: <strong className="text-gray-700 dark:text-gray-300">{form.email}</strong>
              — use <strong>🔑 Reset Password</strong> to change password.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Employee ID"          type="text"   value={form.employeeId}    onChange={handleEmployeeId}    required />
            <TextField label="Employee Name"        type="text"   value={form.employeeName}  onChange={handleEmployeeName}  required />
            <SelectField label="Designation"                      value={form.designation}   onChange={handleDesignation}   options={formOptions.designations || DEFAULT_FORM_OPTIONS.designations} required />
            <TextField label="Joining Date"         type="date"   value={form.joiningDate}   onChange={handleJoiningDate} />
            <TextField label="Monthly Salary (Rs.)" type="number" value={form.monthlySalary} onChange={handleMonthlySalary} />
            <TextField label="PAN Card Number"      type="text"   value={form.panNumber}     onChange={handlePanNumber}    placeholder="e.g. ABCDE1234F" />
            <TextField label="Bank Name"            type="text"   value={form.bankName}      onChange={handleBankName}     placeholder="e.g. State Bank of India" />
            <TextField label="Bank Account Number"  type="text"   value={form.bankAccount}   onChange={handleBankAccount}  placeholder="Account number" />
            <TextField label="IFSC Code"            type="text"   value={form.ifscCode}      onChange={handleIfscCode}     placeholder="e.g. SBIN0001234" />
            <div>
              <label className="label">Assigned Class</label>
              <select value={form.assignedClass} onChange={handleAssignedClass} className="input-field">
                <option value="">-- No Class Assigned --</option>
                {SCHOOL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Educator can only manage attendance and timetable for this class.</p>
            </div>
          </div>
          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">🔧 Additional Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.map((f) => (
                  <div key={f.id}>
                    <label className="label">{f.label}</label>
                    {f.type === 'select' ? (
                      <select value={form[`custom_${f.id}`] || ''} onChange={(e) => setForm((p) => ({ ...p, [`custom_${f.id}`]: e.target.value }))} className="input-field">
                        <option value="">Select {f.label}</option>
                        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form[`custom_${f.id}`] || ''} onChange={(e) => setForm((p) => ({ ...p, [`custom_${f.id}`]: e.target.value }))} className="input-field" placeholder={f.label} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary min-w-[160px] justify-center">
              {saving
                ? <><LoadingSpinner size="sm" /> {editData ? 'Updating…' : 'Creating…'}</>
                : editData ? 'Update Employee' : 'Create Employee Account'
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Modal ── */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Employee Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {selected.photo
                  ? <img src={selected.photo} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300">{selected.employeeName?.[0]}</div>
                }
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selected.employeeName}</h3>
                <span className="badge-info">{selected.designation}</span>
                <p className="text-xs text-gray-400 mt-1">{selected.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Employee ID',   selected.employeeId],
                ['Salary',        formatCurrency(selected.monthlySalary)],
                ['PAN Number',    selected.panNumber || 'N/A'],
                ['Bank Name',     selected.bankName  || 'N/A'],
                ['Account No.',   selected.bankAccount || 'N/A'],
                ['IFSC Code',     selected.ifscCode  || 'N/A'],
                ['Assigned Class', selected.assignedClass || 'None'],
                ['Status',        selected.leaveDate ? `Left on ${formatDate(selected.leaveDate)}` : 'Active'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 break-words">{value || 'N/A'}</p>
                </div>
              ))}
            </div>
            {customFields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">🔧 Additional Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customFields.map((f) => (
                    <div key={f.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-medium">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selected[`custom_${f.id}`] || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal isOpen={pwModal.open} onClose={() => !saving && setPwModal({ open: false, emp: null })}
        title="Reset Employee Password" size="sm">
        {pwModal.emp && (
          <form onSubmit={handleResetPw} className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{pwModal.emp.employeeName}</p>
              <p className="text-xs text-gray-500">{pwModal.emp.email}</p>
            </div>
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                className="input-field" required placeholder="Employee's current password" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" value={pwForm.newPw}
                onChange={(e) => setPwForm((p) => ({ ...p, newPw: e.target.value }))}
                className="input-field" required minLength={6} placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                className="input-field" required placeholder="Repeat new password" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPwModal({ open: false, emp: null })} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <><LoadingSpinner size="sm" /> Resetting…</> : <><HiKey className="w-4 h-4" /> Reset Password</>}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, uid: null, name: '' })}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Employee"
        message={`Delete record for "${deleteDialog.name}"? This cannot be undone.`}
      />

      {/* ── Excel Import Modal ── */}
      <Modal isOpen={importModal} onClose={() => !importing && setImportModal(false)}
        title="Import Employees from Excel" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Upload an Excel (.xlsx) file to bulk-import employees into Firebase.
            Each row becomes one employee record.
          </p>

          {/* Step 1: Download template */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Step 1 — Download Template</p>
              <p className="text-xs text-blue-500 mt-0.5">Fill in the template with your employee data, then upload it below.</p>
            </div>
            <button
              onClick={downloadEmployeeImportTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap"
            >
              <HiTemplate className="w-4 h-4" /> Download Template
            </button>
          </div>

          {/* Step 2: Upload file */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Step 2 — Upload Filled Excel File</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="emp-excel-import-input"
            />
            <label
              htmlFor="emp-excel-import-input"
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
            >
              <HiUpload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Click to choose .xlsx file</p>
              <p className="text-xs text-gray-400 mt-0.5">Supports .xlsx and .xls</p>
            </label>
          </div>

          {/* Errors */}
          {importErrors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl space-y-1 max-h-36 overflow-y-auto">
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <HiExclamation className="w-4 h-4" /> {importErrors.length} Error(s)
              </p>
              {importErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">{e}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {importRows.length > 0 && importErrors.length === 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <HiCheckCircle className="w-4 h-4 text-green-500" />
                  {importRows.length} employees ready to import
                </p>
                {importing && (
                  <p className="text-xs text-blue-500">{importDone} / {importRows.length} saved…</p>
                )}
              </div>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl max-h-52">
                <table className="w-full text-xs min-w-[500px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {['#', 'Employee ID', 'Name', 'Designation', 'Salary', 'Joining Date'].map((h) => (
                        <th key={h} className="p-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {importRows.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2 font-mono text-gray-700 dark:text-gray-300">{e.employeeId || '—'}</td>
                        <td className="p-2 font-medium text-gray-900 dark:text-white">{e.employeeName}</td>
                        <td className="p-2 text-gray-500">{e.designation || '—'}</td>
                        <td className="p-2 text-gray-500">{e.monthlySalary ? `₹${e.monthlySalary}` : '—'}</td>
                        <td className="p-2 text-gray-500">{e.joiningDate ? formatDate(e.joiningDate) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Re-importing the same Employee ID will update the existing record.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setImportModal(false)}
              disabled={importing}
              className="btn-secondary flex-1 justify-center"
            >Cancel</button>
            <button
              onClick={handleImport}
              disabled={importing || importRows.length === 0 || importErrors.length > 0}
              className="btn-primary flex-1 justify-center"
            >
              {importing
                ? <><LoadingSpinner size="sm" /> Importing {importDone}/{importRows.length}…</>
                : <><HiUpload className="w-4 h-4" /> Import {importRows.length > 0 ? `${importRows.length} Employees` : ''}</>
              }
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
