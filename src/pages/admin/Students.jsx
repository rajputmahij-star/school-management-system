import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { HiPlus, HiSearch, HiPencil, HiTrash, HiEye, HiDownload, HiKey, HiUserRemove, HiUserAdd, HiExclamation, HiCheckCircle, HiUpload, HiTemplate, HiX } from 'react-icons/hi'
import { getStudents, getFeeRules, getCustomFields, getFormOptions, setDocument, deleteDocument } from '../../firebase/firestore'
import { createStudentAccount, updateStudentRecord, deleteStudentRecord, adminSetPassword } from '../../firebase/adminAuth'
import { uploadPhoto } from '../../firebase/storage'
import { formatDate, calculateAge, getStudentStatus, generateStudentId, paginate, formatCurrency, calculateStudentFee, getAcademicYear } from '../../utils/helpers'
import { exportStudentsToExcel } from '../../utils/excelExport'
import { parseExcelFile, mapRowsToStudents, downloadImportTemplate } from '../../utils/excelImport'
import { generateStudentReport } from '../../utils/pdfExport'
import { db } from '../../firebase/config'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import ImageUpload from '../../components/ui/ImageUpload'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Timestamp, doc, updateDoc, serverTimestamp as serverTs } from 'firebase/firestore'
import { db } from '../../firebase/config'

import { SCHOOL_CLASSES, NIOS_SUBGROUPS, isNiosGroup, DEFAULT_FORM_OPTIONS } from '../../utils/helpers'

const CLASSES = SCHOOL_CLASSES

const TRANSPORT_OPTIONS = [
   'Van', 'Auto Rickshaw', 'Bicycle', 'Walking',
  'Parent Drop/Pickup', 'Private Vehicle', 'Other',
]

const EMPTY = {
  // credentials
  email: '', password: '',
  // basic
  studentId: '', photo: '',
  studentName: '', dob: '',
  gender: '', nationality: '', placeOfBirth: '', religion: '', motherTongue: '',
  aadharNumber: '',
  className: '', classEducator: '', grNumber: '',
  admissionDate: '', leaveDate: '',
  caseHistoryDate: '',
  modeOfTransport: '',
  customDueDate: '',
  feeAmount: '',       // auto-calculated from fee rules
  admissionFee: '',    // one-time — admin enters manually
  depositFee: '',      // one-time — admin enters manually
  niosSubGroup: '',    // NIOS Group sub-category
  niosFee: '',         // NIOS Group custom monthly fee
  // parent info
  fatherName: '', motherName: '',
  fatherQualification: '', motherQualification: '',
  fatherOccupation: '', motherOccupation: '',
  fatherOfficeAddress: '', motherOfficeAddress: '',
  fatherContact: '', motherContact: '',
  homeAddress: '',
}

// ── Defined at module scope — NEVER re-created on parent re-render ──────────
// This is the ROOT CAUSE fix for input focus loss.
const TF = ({ label, type = 'text', value, onChange, req, placeholder }) => (
  <div>
    <label className="label">{label}{req && <span className="text-red-500 ml-1">*</span>}</label>
    <input type={type} value={value} onChange={onChange} className="input-field" required={req} placeholder={placeholder} />
  </div>
)
const SF = ({ label, value, onChange, options, req }) => (
  <div>
    <label className="label">{label}{req && <span className="text-red-500 ml-1">*</span>}</label>
    <select value={value} onChange={onChange} className="input-field" required={req}>
      <option value="">Select {label}</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
)
const TAF = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="label">{label}</label>
    <textarea value={value} onChange={onChange} className="input-field resize-none" rows={2} placeholder={placeholder} />
  </div>
)

export default function Students() {
  const [students, setStudents]   = useState([])
  const [feeRules, setFeeRules]   = useState([])
  const [customFields, setCustomFields] = useState([])
  const [formOptions, setFormOptions]   = useState(DEFAULT_FORM_OPTIONS)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [page, setPage]           = useState(1)
  const [form, setForm]           = useState({ ...EMPTY, studentId: generateStudentId() })
  const [editData, setEditData]   = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewOpen, setViewOpen]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [pwModal, setPwModal]     = useState({ open: false, student: null })
  const [pwForm, setPwForm]       = useState({ current: '', newPw: '', confirm: '' })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, uid: null, name: '' })
  const [importModal, setImportModal]   = useState(false)
  const [importRows,  setImportRows]    = useState([])   // parsed preview rows
  const [importErrors, setImportErrors] = useState([])
  const [importing,   setImporting]     = useState(false)
  const [importDone,  setImportDone]    = useState(0)
  const fileInputRef = useRef(null)

  // Stable handlers — each is memoised so TF/SF never remounts
  const h = useCallback((field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value })), [])

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [s, r, cf, fo] = await Promise.all([getStudents(), getFeeRules(), getCustomFields(), getFormOptions()])
      setStudents(s)
      setFeeRules(r)
      setCustomFields(cf?.studentFields || [])
      if (fo) setFormOptions({ ...DEFAULT_FORM_OPTIONS, ...fo })
    } catch (err) {
      toast.error(`Failed to load students: ${err.message}`)
    } finally { setLoading(false) }
  }

  // Auto-calculate fee whenever dob or admissionDate changes (skip NIOS Group)
  useEffect(() => {
    if (isNiosGroup(form.className)) return  // NIOS uses custom fee — don't auto-calc
    if (!form.dob || !form.admissionDate || feeRules.length === 0) return
    const tempStudent = {
      dob:           form.dob,
      admissionDate: form.admissionDate,
    }
    const { fee } = calculateStudentFee(feeRules, tempStudent)
    setForm((p) => ({ ...p, feeAmount: fee > 0 ? fee : '' }))
  }, [form.dob, form.admissionDate, form.className, feeRules])

  const counts = useMemo(() => ({
    all:    students.length,
    active: students.filter((s) => !s.leaveDate).length,
    left:   students.filter((s) => !!s.leaveDate).length,
  }), [students])

  const filtered = useMemo(() => students.filter((s) => {
    const q = search.toLowerCase()
    const mQ = !q || [s.studentName, s.studentId, s.grNumber, s.className, s.fatherName, s.email].some((v) => v?.toLowerCase().includes(q))
    const mF = filter === 'all' || (filter === 'active' && !s.leaveDate) || (filter === 'left' && !!s.leaveDate)
    return mQ && mF
  }), [students, search, filter])

  const paged = useMemo(() => paginate(filtered, page, 10), [filtered, page])

  const openAdd = () => {
    setEditData(null)
    setForm({ ...EMPTY, studentId: generateStudentId() })
    setPhotoFile(null)
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditData(s)
    // build custom field values from stored data
    const customValues = {}
    ;(customFields || []).forEach((f) => { customValues[`custom_${f.id}`] = s[`custom_${f.id}`] || '' })
    setForm({
      email: s.email || '', password: '',
      studentId: s.studentId || '', photo: s.photo || '',
      studentName: s.studentName || '',
      dob: s.dob ? formatDate(s.dob, 'yyyy-MM-dd') : '',
      gender: s.gender || '',
      nationality: s.nationality || '',
      placeOfBirth: s.placeOfBirth || '',
      religion: s.religion || '',
      motherTongue: s.motherTongue || '',
      aadharNumber: s.aadharNumber || '',
      className: s.className || '', classEducator: s.classEducator || s.classTeacher || '',
      grNumber: s.grNumber || '',
      caseHistoryDate: s.caseHistoryDate ? formatDate(s.caseHistoryDate, 'yyyy-MM-dd') : '',
      leaveDate: s.leaveDate ? formatDate(s.leaveDate, 'yyyy-MM-dd') : '',
      modeOfTransport: s.modeOfTransport || '',
      customDueDate: s.customDueDate || '',
      feeAmount: s.feeAmount || '',
      admissionFee: s.admissionFee || '',
      depositFee: s.depositFee || '',
      niosSubGroup: s.niosSubGroup || '',
      niosFee: s.niosFee != null ? String(s.niosFee) : '',
      // ── parent info ──
      fatherName: s.fatherName || '',
      motherName: s.motherName || '',
      fatherQualification: s.fatherQualification || '', motherQualification: s.motherQualification || '',
      fatherOccupation: s.fatherOccupation || '', motherOccupation: s.motherOccupation || '',
      fatherOfficeAddress: s.fatherOfficeAddress || '', motherOfficeAddress: s.motherOfficeAddress || '',
      fatherContact: s.fatherContact || '', motherContact: s.motherContact || '',
      homeAddress: s.homeAddress || '',
      ...customValues,
    })
    setPhotoFile(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editData && form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (!form.studentName.trim())               { toast.error('Student name is required'); return }
    if (form.aadharNumber && !/^\d{12}$/.test(form.aadharNumber)) { toast.error('Aadhar number must be exactly 12 digits'); return }
    setSaving(true)
    try {
      let photo = form.photo
      if (photoFile) {
        photo = await uploadPhoto(photoFile, 'students', editData ? (editData.uid || editData.id) : form.studentId)
      }
      const customData = {}
      customFields.forEach((f) => { customData[`custom_${f.id}`] = form[`custom_${f.id}`] || '' })
      const data = {
        studentId:    form.studentId    || '',
        photo:        photo             || '',
        studentName:  form.studentName.trim(),
        dob:          form.dob ? Timestamp.fromDate(new Date(form.dob)) : null,
        gender:       form.gender       || '',
        nationality:  form.nationality  || '',
        placeOfBirth: form.placeOfBirth || '',
        religion:     form.religion     || '',
        motherTongue: form.motherTongue || '',
        aadharNumber: form.aadharNumber || '',
        className:    form.className    || '',
        classEducator: form.classEducator || '',
        grNumber:     form.grNumber     || '',
        admissionDate: form.admissionDate ? Timestamp.fromDate(new Date(form.admissionDate)) : null,
        caseHistoryDate: form.caseHistoryDate ? Timestamp.fromDate(new Date(form.caseHistoryDate)) : null,
        leaveDate:     form.leaveDate    ? Timestamp.fromDate(new Date(form.leaveDate))    : null,
        modeOfTransport: form.modeOfTransport || '',
        customDueDate: form.customDueDate ? Number(form.customDueDate) : null,
        feeAmount:    form.feeAmount    ? Number(form.feeAmount)
                    : (editData && editData.feeAmount > 0) ? editData.feeAmount   // preserve existing fee on update
                    : 0,
        academicYear: form.admissionDate ? getAcademicYear(form.admissionDate) : null,
        admissionFee: form.admissionFee ? Number(form.admissionFee) : 0,
        depositFee:   form.depositFee   ? Number(form.depositFee)   : 0,
        niosSubGroup: form.niosSubGroup || '',
        niosFee:      isNiosGroup(form.className) && form.niosFee ? Number(form.niosFee) : 0,
        // parent info — all guarded so undefined never reaches Firestore
        fatherName:          form.fatherName          || '',
        motherName:          form.motherName          || '',
        fatherQualification: form.fatherQualification || '',
        motherQualification: form.motherQualification || '',
        fatherOccupation:    form.fatherOccupation    || '',
        motherOccupation:    form.motherOccupation    || '',
        fatherOfficeAddress: form.fatherOfficeAddress || '',
        motherOfficeAddress: form.motherOfficeAddress || '',
        fatherContact:       form.fatherContact       || '',
        motherContact:       form.motherContact       || '',
        homeAddress:         form.homeAddress         || '',
        ...customData,
      }
      if (editData) {
        await updateStudentRecord(editData.uid || editData.id, data)
        toast.success('Student updated successfully')
      } else {
        await createStudentAccount(form.email.trim(), form.password, data)
        toast.success(`Account created for ${form.studentName}`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Operation failed')
      console.error('Student save error:', err)
    } finally { setSaving(false) }
  }

  const markAsLeft = async (s) => {
    try {
      await updateDoc(doc(db, 'students', s.uid || s.id), {
        leaveDate: Timestamp.fromDate(new Date()),
        updatedAt: serverTs(),
      })
      toast.success(`${s.studentName} marked as Left`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const markAsActive = async (s) => {
    try {
      await updateDoc(doc(db, 'students', s.uid || s.id), {
        leaveDate: null,
        updatedAt: serverTs(),
      })
      toast.success(`${s.studentName} marked as Active`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const student = students.find((s) => (s.uid || s.id) === deleteDialog.uid)
    const undoUid  = deleteDialog.uid
    try {
      if (student) {
        await setDocument('deleted_students', undoUid, { ...student, deletedAt: new Date().toISOString() })
      }
      await deleteStudentRecord(undoUid)
      toast.success(
        <div className="flex items-center gap-3">
          <span>Student deleted</span>
          <button
            onClick={async () => {
              if (student) {
                await setDocument('students', undoUid, { ...student })
                await deleteDocument('deleted_students', undoUid)
                load()
                toast.success('Student restored!')
              }
            }}
            className="text-xs bg-white text-gray-800 px-2 py-1 rounded font-semibold hover:bg-gray-100"
          >Undo</button>
        </div>,
        { duration: 8000 }
      )
      setDeleteDialog({ open: false, uid: null, name: '' })
      load()
    } catch (err) { toast.error(`Delete failed: ${err.message}`) }
    finally { setDeleting(false) }
  }

  const handleResetPw = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6)         { toast.error('Min 6 characters'); return }
    setSaving(true)
    try {
      await adminSetPassword(pwModal.student.email, pwForm.current, pwForm.newPw)
      toast.success('Password reset successfully')
      setPwModal({ open: false, student: null })
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) { toast.error(err.message || 'Reset failed') }
    finally { setSaving(false) }
  }

  // ─── Import handling ──────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const rows = await parseExcelFile(file)
      const { students: mapped, errors } = mapRowsToStudents(rows)
      setImportRows(mapped)
      setImportErrors(errors)
      setImportDone(0)
      if (errors.length === 0) {
        toast.success(`${mapped.length} students ready to import`)
      } else {
        toast.error(`Found ${errors.length} error(s) — check and fix`)
      }
    } catch (err) {
      toast.error(err.message)
      setImportRows([])
      setImportErrors([err.message])
    }
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (importRows.length === 0) { toast.error('No students to import'); return }
    if (importErrors.length > 0) {
      toast.error('Fix errors before importing'); return
    }
    setImporting(true)
    let success = 0
    try {
      for (const student of importRows) {
        // Generate a unique student ID if not provided
        if (!student.studentId) student.studentId = generateStudentId()
        
        // Set defaults for required fields if missing
        if (!student.className) student.className = 'Not Assigned'
        if (!student.caseHistoryDate && student.dob) {
          // Default admission date to 2020-04-01 if not provided
          student.caseHistoryDate = Timestamp.fromDate(new Date('2020-04-01'))
        }
        if (!student.gender) student.gender = ''
        if (!student.nationality) student.nationality = 'Indian'
        
        // Generate email if not provided (using studentId)
        if (!student.email) {
          const cleanId = student.studentId.toLowerCase().replace(/[^a-z0-9]/g, '')
          student.email = `${cleanId}@school.edu`
        }
        
        // Use studentId as document ID to avoid duplicates
        const docId = student.studentId.toLowerCase().replace(/[^a-z0-9]/g, '')
        
        await setDoc(doc(db, 'students', docId), {
          ...student,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
        
        success++
        setImportDone(success)
      }
      toast.success(`${success} students imported successfully!`)
      setImportModal(false)
      setImportRows([])
      setImportErrors([])
      load() // Refresh the list
    } catch (err) {
      toast.error(`Import failed after ${success} students: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Management</h1>
          <p className="text-sm text-gray-500">{students.length} total students</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => generateStudentReport(students)} className="btn-secondary text-sm"><HiDownload className="w-4 h-4" /> PDF</button>
          <button onClick={() => exportStudentsToExcel(students)} className="btn-secondary text-sm"><HiDownload className="w-4 h-4" /> Excel</button>
          <button onClick={() => { setImportRows([]); setImportErrors([]); setImportDone(0); setImportModal(true) }} className="btn-secondary text-sm"><HiUpload className="w-4 h-4" /> Import Excel</button>
          <button onClick={openAdd} className="btn-primary text-sm"><HiPlus className="w-4 h-4" /> Add Student</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search name, ID, GR, class, email…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input-field pl-9" />
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',    label: 'All Students', ac: 'bg-gray-700 text-white', ic: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
          { key: 'active', label: 'Active',        ac: 'bg-green-600 text-white', ic: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
          { key: 'left',   label: 'Left',          ac: 'bg-yellow-500 text-white', ic: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
        ].map(({ key, label, ac, ic }) => (
          <button key={key} onClick={() => { setFilter(key); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === key ? ac : ic}`}>
            {label}
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-black/10 dark:bg-white/10">{counts[key]}</span>
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
                    <th className="table-header">Student</th>
                    <th className="table-header hidden sm:table-cell">Class</th>
                    <th className="table-header hidden md:table-cell">GR No.</th>
                    <th className="table-header hidden lg:table-cell">Age</th>
                    <th className="table-header hidden lg:table-cell">Fee</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paged.data.length === 0
                    ? <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">No students found</td></tr>
                    : paged.data.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                              {s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{s.studentName?.[0]?.toUpperCase()}</div>}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{s.studentName}</p>
                              <p className="text-xs text-gray-500">{s.studentId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell hidden sm:table-cell">{s.className}</td>
                        <td className="table-cell hidden md:table-cell">{s.grNumber}</td>
                        <td className="table-cell hidden lg:table-cell">{calculateAge(s.dob) !== 'N/A' ? `${calculateAge(s.dob)} yrs` : '—'}</td>
                        <td className="table-cell hidden lg:table-cell">
                          {(() => {
                            if (isNiosGroup(s.className)) {
                              return s.niosFee ? (
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(s.niosFee)}</p>
                                  <p className="text-xs text-blue-500">NIOS · {s.niosSubGroup || '—'}</p>
                                </div>
                              ) : <span className="text-xs text-gray-400">Set NIOS fee</span>
                            }
                            const { fee, bracket } = calculateStudentFee(feeRules, s)
                            if (fee > 0) return (
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(fee)}</p>
                                <p className="text-xs text-gray-400">{s.billingType || 'Monthly'}</p>
                              </div>
                            )
                            if (s.feeAmount) return (
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(s.feeAmount)}</p>
                                <p className="text-xs text-gray-400">stored</p>
                              </div>
                            )
                            return <span className="text-xs text-gray-400">No rule</span>
                          })()}
                        </td>
                        <td className="table-cell">
                          {s.leaveDate ? <span className="badge-warning">Left</span> : <span className="badge-success">Active</span>}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSelected(s); setViewOpen(true) }} title="View" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><HiEye className="w-4 h-4 text-gray-500" /></button>
                            {!s.leaveDate && <button onClick={() => openEdit(s)} title="Edit" className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><HiPencil className="w-4 h-4 text-blue-500" /></button>}
                            <button onClick={() => { setPwModal({ open: true, student: s }); setPwForm({ current: '', newPw: '', confirm: '' }) }} title="Reset Password" className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"><HiKey className="w-4 h-4 text-purple-500" /></button>
                            {s.leaveDate
                              ? <>
                                  <button onClick={() => markAsActive(s)} title="Mark Active" className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><HiUserAdd className="w-4 h-4 text-green-500" /></button>
                                  <button onClick={() => setDeleteDialog({ open: true, uid: s.uid || s.id, name: s.studentName })} title="Delete" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><HiTrash className="w-4 h-4 text-red-500" /></button>
                                </>
                              : <button onClick={() => markAsLeft(s)} title="Mark as Left" className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg"><HiUserRemove className="w-4 h-4 text-yellow-500" /></button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))}
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

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)}
        title={editData ? 'Edit Student' : 'Add New Student'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <ImageUpload currentUrl={form.photo} onUpload={(file) => setPhotoFile(file)} />
          </div>

          {/* Login Credentials (add only) */}
          {!editData && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">🔐 Login Credentials</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TF label="Email Address" type="email" value={form.email} onChange={h('email')} req placeholder="student@school.com" />
                <TF label="Password (min 6)" type="password" value={form.password} onChange={h('password')} req placeholder="Min 6 characters" />
              </div>
            </div>
          )}
          {editData && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500">
              📧 Login: <strong className="text-gray-700 dark:text-gray-300">{form.email}</strong> — use 🔑 Reset Password to change it.
            </div>
          )}

          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">📋 Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TF label="Student ID"           value={form.studentId}     onChange={h('studentId')}     req />
              <TF label="Student Name"         value={form.studentName}   onChange={h('studentName')}   req />
              <TF label="Date of Birth"        type="date" value={form.dob} onChange={h('dob')} />
              <SF label="Gender"               value={form.gender}        onChange={h('gender')}        options={formOptions.genders || DEFAULT_FORM_OPTIONS.genders} />
              <TF label="Nationality"          value={form.nationality}   onChange={h('nationality')}   placeholder="e.g. Indian" />
              <TF label="Place of Birth"       value={form.placeOfBirth}  onChange={h('placeOfBirth')}  placeholder="City / Town" />
              <TF label="Religion"             value={form.religion}      onChange={h('religion')}      placeholder="e.g. Hindu" />
              <TF label="Mother Tongue"        value={form.motherTongue}  onChange={h('motherTongue')}  placeholder="e.g. Hindi" />
              <div>
                <label className="label">Aadhar Card Number</label>
                <input
                  type="text"
                  value={form.aadharNumber}
                  onChange={(e) => { if (/^\d{0,12}$/.test(e.target.value)) setForm((p) => ({ ...p, aadharNumber: e.target.value })) }}
                  className="input-field"
                  maxLength={12}
                  placeholder="12-digit Aadhar number"
                />
              </div>
              <SF label="Class"                value={form.className}     onChange={h('className')}     options={formOptions.classes || DEFAULT_FORM_OPTIONS.classes} req />
              {/* NIOS Group: sub-group + custom fee */}
              {isNiosGroup(form.className) && (
                <>
                  <div>
                    <label className="label">NIOS Sub-Group <span className="text-red-500">*</span></label>
                    <select
                      value={form.niosSubGroup}
                      onChange={h('niosSubGroup')}
                      className="input-field"
                      required
                    >
                      <option value="">Select Sub-Group</option>
                      {(formOptions.niosSubGroups || DEFAULT_FORM_OPTIONS.niosSubGroups).map((sg) => <option key={sg} value={sg}>{sg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">NIOS Monthly Fee (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="0"
                      value={form.niosFee}
                      onChange={(e) => setForm((p) => ({ ...p, niosFee: e.target.value }))}
                      className="input-field"
                      placeholder="Enter monthly fee for this student"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      NIOS students are not subject to the standard fee rules. Enter the agreed monthly fee.
                    </p>
                  </div>
                </>
              )}
              <TF label="Class Educator"       value={form.classEducator} onChange={h('classEducator')} />
              <TF label="GR Number"            value={form.grNumber}      onChange={h('grNumber')}      req />
              <TF label="Date of Admission"  type="date" value={form.admissionDate} onChange={h('admissionDate')} />
              <TF label="Case History Date"  type="date" value={form.caseHistoryDate} onChange={h('caseHistoryDate')} />
              <TF label="Leave Date (if left)" type="date" value={form.leaveDate}     onChange={h('leaveDate')} />
              <SF label="Mode of Transport"    value={form.modeOfTransport} onChange={h('modeOfTransport')} options={formOptions.transportOptions || DEFAULT_FORM_OPTIONS.transportOptions} />

              {/* ── Auto-calculated fee banner (not shown for NIOS Group) ── */}
              {!isNiosGroup(form.className) && form.dob && form.caseHistoryDate && (
              <div className="sm:col-span-2">
                {(() => {
                  const tempStudent = { dob: form.dob, caseHistoryDate: form.caseHistoryDate }
                  const { fee, academicYear, bracket } = calculateStudentFee(feeRules, tempStudent)
                  if (fee === 0) return (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                      <HiExclamation className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">No fee rule found for this combination</p>
                        <p className="mt-0.5">Academic year: <strong>{academicYear || '—'}</strong>. Go to Fee Rules and add a bracket for this age / year.</p>
                      </div>
                    </div>
                  )
                  return (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                        <HiCheckCircle className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Monthly fee auto-calculated</span>
                          <span className="ml-2 text-green-600 dark:text-green-400">AY {academicYear} · Age {bracket?.minAge}{bracket?.maxAge !== '' ? `–${bracket?.maxAge}` : '+'}  yrs</span>
                        </div>
                      </div>
                      <span className="font-bold text-green-700 dark:text-green-300 text-sm whitespace-nowrap">{formatCurrency(fee)}/month</span>
                    </div>
                  )
                })()}
              </div>
              )}

              {/* Fee amount field (auto-filled, admin can override) — not shown for NIOS */}
              {!isNiosGroup(form.className) && (
              <div>
                <label className="label">Fee Amount (₹) <span className="text-xs font-normal text-gray-400">— auto-filled from fee rules</span></label>
                <input
                  type="number"
                  min="0"
                  value={form.feeAmount}
                  onChange={(e) => setForm((p) => ({ ...p, feeAmount: e.target.value }))}
                  className="input-field"
                  placeholder="Auto-calculated or enter manually"
                />
              </div>
              )}

              {/* One-time fees */}
              <div>
                <label className="label">Admission Fee (₹) <span className="text-xs font-normal text-gray-400">— one-time</span></label>
                <input
                  type="number" min="0"
                  value={form.admissionFee}
                  onChange={(e) => setForm((p) => ({ ...p, admissionFee: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <label className="label">Deposit Fee (₹) <span className="text-xs font-normal text-gray-400">— one-time</span></label>
                <input
                  type="number" min="0"
                  value={form.depositFee}
                  onChange={(e) => setForm((p) => ({ ...p, depositFee: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. 2000"
                />
              </div>

              {/* One-time fee summary (shown only when both are set) */}
              {(Number(form.admissionFee) > 0 || Number(form.depositFee) > 0) && (
                <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                    {Number(form.admissionFee) > 0 && <p>Admission Fee: <strong>{formatCurrency(Number(form.admissionFee))}</strong></p>}
                    {Number(form.depositFee)   > 0 && <p>Deposit Fee: <strong>{formatCurrency(Number(form.depositFee))}</strong></p>}
                  </div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    Total one-time: {formatCurrency((Number(form.admissionFee) || 0) + (Number(form.depositFee) || 0))}
                  </p>
                </div>
              )}
              <div>
                <label className="label">Custom Due Date (day of month)</label>
                <input
                  type="number" min="1" max="28"
                  value={form.customDueDate}
                  onChange={(e) => setForm((p) => ({ ...p, customDueDate: e.target.value }))}
                  className="input-field"
                  placeholder="Leave blank to use system default"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Monthly default: 5th · Quarterly default: 10th. Enter 1–28 to override.
                </p>
              </div>
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
                      <select value={form[`custom_${f.id}`] || ''} onChange={h(`custom_${f.id}`)} className="input-field">
                        <option value="">Select {f.label}</option>
                        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form[`custom_${f.id}`] || ''} onChange={h(`custom_${f.id}`)} className="input-field" placeholder={f.label} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parent Info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">👨‍👩‍👧 Parent Information</p>

            {/* Father */}
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Father's Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <TF label="Father's Name"              value={form.fatherName}           onChange={h('fatherName')}           req />
              <TF label="Father's Qualification"     value={form.fatherQualification}  onChange={h('fatherQualification')}  placeholder="e.g. B.Com" />
              <TF label="Father's Occupation"        value={form.fatherOccupation}     onChange={h('fatherOccupation')}     placeholder="e.g. Business" />
              <TF label="Father's Contact Number"    value={form.fatherContact}        onChange={h('fatherContact')}        placeholder="10-digit mobile" type="tel" />
              <div className="sm:col-span-2">
                <TAF label="Father's Office Address" value={form.fatherOfficeAddress}  onChange={h('fatherOfficeAddress')}  placeholder="Office / work address" />
              </div>
            </div>

            {/* Mother */}
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mother's Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <TF label="Mother's Name"              value={form.motherName}           onChange={h('motherName')} />
              <TF label="Mother's Qualification"     value={form.motherQualification}  onChange={h('motherQualification')}  placeholder="e.g. B.A." />
              <TF label="Mother's Occupation"        value={form.motherOccupation}     onChange={h('motherOccupation')}     placeholder="e.g. Homemaker" />
              <TF label="Mother's Contact Number"    value={form.motherContact}        onChange={h('motherContact')}        placeholder="10-digit mobile" type="tel" />
              <div className="sm:col-span-2">
                <TAF label="Mother's Office Address" value={form.motherOfficeAddress}  onChange={h('motherOfficeAddress')}  placeholder="Office / work address" />
              </div>
            </div>

            {/* Shared home address */}
            <TAF label="Home Address (Family Residence)" value={form.homeAddress} onChange={h('homeAddress')} placeholder="Full residential address" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary min-w-[180px] justify-center">
              {saving ? <><LoadingSpinner size="sm" /> {editData ? 'Updating…' : 'Creating Account…'}</>
                      : editData ? 'Update Student' : 'Create Student Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Student Details" size="md">
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {selected.photo ? <img src={selected.photo} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300">{selected.studentName?.[0]}</div>}
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selected.studentName}</h3>
                <p className="text-sm text-gray-500">{selected.studentId}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selected.email}</p>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['Date of Birth',  formatDate(selected.dob)],
                  ['Age',            `${calculateAge(selected.dob)} years`],
                  ['Gender',         selected.gender],
                  ['Nationality',    selected.nationality],
                  ['Place of Birth', selected.placeOfBirth],
                  ['Religion',       selected.religion],
                  ['Mother Tongue',  selected.motherTongue],
                  ['Aadhar Number',  selected.aadharNumber],
                  ['Class',          selected.className],
                  ['Class Educator', selected.classEducator || selected.classTeacher],
                  ['GR Number',      selected.grNumber],
                  ['Date of Admission', formatDate(selected.admissionDate)],
                  ['Case History Date', formatDate(selected.caseHistoryDate)],
                  ['Mode of Transport', selected.modeOfTransport],
                  ['Status',         selected.leaveDate ? `Left on ${formatDate(selected.leaveDate)}` : 'Active'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Fields */}
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

            {/* Fee Summary */}
            {(() => {
              const { fee, academicYear, bracket } = calculateStudentFee(feeRules, selected)
              const hasAdmissionFee = selected.admissionFee > 0
              const hasDepositFee   = selected.depositFee   > 0
              return (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">💰 Fee Information</p>

                  {/* Calculated fee from rules */}
                  {fee > 0 ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl mb-3 flex items-center justify-between">
                      <div className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                        <p className="font-semibold flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" /> Fee rule matched</p>
                        <p>Academic Year: <strong>{academicYear}</strong></p>
                        <p>Age Bracket: <strong>{bracket?.minAge}{bracket?.maxAge !== '' && bracket?.maxAge != null ? `–${bracket.maxAge}` : '+'} yrs</strong></p>
                        <p>Billing: <strong>{selected.billingType || 'Monthly'}</strong></p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(fee)}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">per period</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl mb-3 flex items-start gap-2">
                      <HiExclamation className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-700 dark:text-yellow-300">
                        <p className="font-semibold">No fee rule matched</p>
                        <p className="mt-0.5">
                          {academicYear
                            ? `No rule found for AY ${academicYear}. Check Fee Rules.`
                            : 'Admission date or date of birth missing.'}
                        </p>
                        {selected.feeAmount > 0 && (
                          <p className="mt-1">Stored fee: <strong>{formatCurrency(selected.feeAmount)}</strong></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* One-time fees */}
                  {(hasAdmissionFee || hasDepositFee) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {hasAdmissionFee && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Admission Fee</p>
                          <p className="text-base font-bold text-blue-700 dark:text-blue-300 mt-0.5">{formatCurrency(selected.admissionFee)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">One-time</p>
                        </div>
                      )}
                      {hasDepositFee && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Deposit Fee</p>
                          <p className="text-base font-bold text-purple-700 dark:text-purple-300 mt-0.5">{formatCurrency(selected.depositFee)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Refundable</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Parent Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent Information</p>
              <p className="text-xs font-medium text-gray-500 mb-1">Father</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {[
                  ["Father's Name",           selected.fatherName],
                  ["Father's Qualification",  selected.fatherQualification],
                  ["Father's Occupation",     selected.fatherOccupation],
                  ["Father's Contact",        selected.fatherContact],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value || 'N/A'}</p>
                  </div>
                ))}
                {selected.fatherOfficeAddress && (
                  <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">Father's Office Address</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selected.fatherOfficeAddress}</p>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">Mother</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {[
                  ["Mother's Name",           selected.motherName],
                  ["Mother's Qualification",  selected.motherQualification],
                  ["Mother's Occupation",     selected.motherOccupation],
                  ["Mother's Contact",        selected.motherContact],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value || 'N/A'}</p>
                  </div>
                ))}
                {selected.motherOfficeAddress && (
                  <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium">Mother's Office Address</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selected.motherOfficeAddress}</p>
                  </div>
                )}
              </div>
              {selected.homeAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Home Address</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selected.homeAddress}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={pwModal.open} onClose={() => !saving && setPwModal({ open: false, student: null })} title="Reset Student Password" size="sm">
        {pwModal.student && (
          <form onSubmit={handleResetPw} className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{pwModal.student.studentName}</p>
              <p className="text-xs text-gray-500">{pwModal.student.email}</p>
            </div>
            {[['Current Password', 'current', "Student's current password"], ['New Password', 'newPw', 'Min 6 characters'], ['Confirm New Password', 'confirm', 'Repeat new password']].map(([label, key, ph]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="password" value={pwForm[key]} onChange={(e) => setPwForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="input-field" required placeholder={ph} />
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPwModal({ open: false, student: null })} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <><LoadingSpinner size="sm" /> Resetting…</> : <><HiKey className="w-4 h-4" /> Reset Password</>}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, uid: null, name: '' })}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Student"
        message={`Delete "${deleteDialog.name}"? This cannot be undone.`}
      />

      {/* ── Excel Import Modal ── */}
      <Modal isOpen={importModal} onClose={() => !importing && setImportModal(false)}
        title="Import Students from Excel" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Upload an Excel (.xlsx) file to bulk-import students into Firebase. 
            Each row becomes one student record.
          </p>

          {/* Step 1: Download template */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Step 1 — Download Template</p>
              <p className="text-xs text-blue-500 mt-0.5">Fill in the template with your student data, then upload it below.</p>
            </div>
            <button
              onClick={downloadImportTemplate}
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
              id="excel-import-input"
            />
            <label
              htmlFor="excel-import-input"
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
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><HiExclamation className="w-4 h-4" /> {importErrors.length} Error(s)</p>
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
                  {importRows.length} students ready to import
                </p>
                {importing && (
                  <p className="text-xs text-blue-500">{importDone} / {importRows.length} saved…</p>
                )}
              </div>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl max-h-52">
                <table className="w-full text-xs min-w-[500px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {['#', 'Student ID', 'Name', 'Class', 'GR Number', 'Father Name', 'DOB'].map((h) => (
                        <th key={h} className="p-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {importRows.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2 font-mono text-gray-700 dark:text-gray-300">{s.studentId || '—'}</td>
                        <td className="p-2 font-medium text-gray-900 dark:text-white">{s.studentName}</td>
                        <td className="p-2 text-gray-500">{s.className || '—'}</td>
                        <td className="p-2 text-gray-500">{s.grNumber || '—'}</td>
                        <td className="p-2 text-gray-500">{s.fatherName || '—'}</td>
                        <td className="p-2 text-gray-500">{s.dob ? formatDate(s.dob) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Note: Students are saved using Student ID as the document key. Re-importing the same ID will update the record.
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
                : <><HiUpload className="w-4 h-4" /> Import {importRows.length > 0 ? `${importRows.length} Students` : ''}</>
              }
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
