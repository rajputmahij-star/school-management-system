import React, { useState, useEffect, useCallback } from 'react'
import { HiSave, HiCog, HiCurrencyRupee, HiCalendar, HiPlus, HiTrash, HiPencil, HiX, HiCheck, HiUserAdd, HiShieldCheck } from 'react-icons/hi'
import { getSettings, updateSettings, getFeeSettings, updateFeeSettings, getCustomFields, updateCustomFields, getFormOptions, updateFormOptions } from '../../firebase/firestore'
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp, getDocs, collection, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ChangePasswordForm from '../../components/ui/ChangePasswordForm'
import toast from 'react-hot-toast'
import { DEFAULT_FORM_OPTIONS } from '../../utils/helpers'

const SF = ({ label, type = 'text', value, onChange, note }) => (
  <div>
    <label className="label">{label}</label>
    <input type={type} value={value ?? ''} onChange={onChange} className="input-field" />
    {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
  </div>
)

// ── Custom Fields Manager subcomponent ────────────────────────────────────────
function CustomFieldsManager({ title, fields, onSave }) {
  const [localFields, setLocalFields] = useState(fields)
  const [editing, setEditing] = useState(null)  // null | index
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '' })
  const [addMode, setAddMode] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocalFields(fields) }, [fields])

  const handleAdd = () => {
    if (!newField.label.trim()) { toast.error('Field label is required'); return }
    const id = newField.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const f = {
      id,
      label: newField.label.trim(),
      type:  newField.type,
      options: newField.type === 'select' ? newField.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
    }
    setLocalFields((prev) => [...prev, f])
    setNewField({ label: '', type: 'text', options: '' })
    setAddMode(false)
  }

  const handleDelete = (idx) => {
    setLocalFields((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleEditSave = (idx, updated) => {
    setLocalFields((prev) => prev.map((f, i) => i === idx ? updated : f))
    setEditing(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(localFields)
      toast.success(`${title} saved`)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        <button onClick={() => setAddMode(true)} className="btn-secondary text-xs py-1.5">
          <HiPlus className="w-3.5 h-3.5" /> Add Field
        </button>
      </div>

      {/* Add new field form */}
      {addMode && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">New Custom Field</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Field Label *</label>
              <input type="text" value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
                className="input-field text-sm" placeholder="e.g. Blood Group" />
            </div>
            <div>
              <label className="label text-xs">Field Type</label>
              <select value={newField.type} onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value }))} className="input-field text-sm">
                <option value="text">Text Input</option>
                <option value="select">Dropdown</option>
              </select>
            </div>
            {newField.type === 'select' && (
              <div className="sm:col-span-2">
                <label className="label text-xs">Options (comma-separated)</label>
                <input type="text" value={newField.options} onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                  className="input-field text-sm" placeholder="e.g. A+, A-, B+, B-, O+, O-, AB+" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary text-xs py-1.5"><HiCheck className="w-3.5 h-3.5" /> Add</button>
            <button onClick={() => setAddMode(false)} className="btn-secondary text-xs py-1.5"><HiX className="w-3.5 h-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      {/* Field list */}
      {localFields.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No custom fields yet. Click "Add Field" to create one.</p>
      ) : (
        <div className="space-y-2">
          {localFields.map((f, idx) => (
            <FieldRow key={f.id} field={f} isEditing={editing === idx}
              onEdit={() => setEditing(idx)}
              onDelete={() => handleDelete(idx)}
              onSaveEdit={(updated) => handleEditSave(idx, updated)}
              onCancelEdit={() => setEditing(null)} />
          ))}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />} Save Changes
        </button>
      </div>
    </div>
  )
}

function FieldRow({ field, isEditing, onEdit, onDelete, onSaveEdit, onCancelEdit }) {
  const [draft, setDraft] = useState({ ...field, optionsStr: (field.options || []).join(', ') })

  useEffect(() => { if (isEditing) setDraft({ ...field, optionsStr: (field.options || []).join(', ') }) }, [isEditing])

  const saveEdit = () => {
    if (!draft.label.trim()) { toast.error('Label cannot be empty'); return }
    onSaveEdit({
      ...field,
      label: draft.label.trim(),
      type: draft.type,
      options: draft.type === 'select' ? draft.optionsStr.split(',').map((o) => o.trim()).filter(Boolean) : [],
    })
  }

  if (isEditing) return (
    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Label</label>
          <input type="text" value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} className="input-field text-sm" />
        </div>
        <div>
          <label className="label text-xs">Type</label>
          <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} className="input-field text-sm">
            <option value="text">Text Input</option>
            <option value="select">Dropdown</option>
          </select>
        </div>
        {draft.type === 'select' && (
          <div className="sm:col-span-2">
            <label className="label text-xs">Options (comma-separated)</label>
            <input type="text" value={draft.optionsStr} onChange={(e) => setDraft((p) => ({ ...p, optionsStr: e.target.value }))} className="input-field text-sm" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={saveEdit} className="btn-primary text-xs py-1"><HiCheck className="w-3.5 h-3.5" /> Save</button>
        <button onClick={onCancelEdit} className="btn-secondary text-xs py-1"><HiX className="w-3.5 h-3.5" /> Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{field.label}</p>
        <p className="text-xs text-gray-400">{field.type === 'select' ? `Dropdown: ${(field.options || []).join(', ')}` : 'Text input'}</p>
      </div>
      <div className="flex gap-1">
        <button onClick={onEdit} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
          <HiPencil className="w-4 h-4 text-blue-500" />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
          <HiTrash className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  )
}

// ── Form Options Manager — lets admin edit dropdown values for Student/Employee forms ──
function OptionsListEditor({ label, items, onChange }) {
  const [draft, setDraft] = useState([...items])
  const [newItem, setNewItem] = useState('')

  useEffect(() => { setDraft([...items]) }, [items])

  const add = () => {
    const v = newItem.trim()
    if (!v) return
    if (draft.includes(v)) { toast.error(`"${v}" already exists`); return }
    const updated = [...draft, v]
    setDraft(updated)
    onChange(updated)
    setNewItem('')
  }

  const remove = (i) => {
    const updated = draft.filter((_, idx) => idx !== i)
    setDraft(updated)
    onChange(updated)
  }

  const moveUp = (i) => {
    if (i === 0) return
    const updated = [...draft]
    ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
    setDraft(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {draft.map((item, i) => (
          <span key={item + i}
            className="flex items-center gap-1 pl-3 pr-1 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-800 dark:text-gray-200">
            {item}
            <button onClick={() => remove(i)}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-gray-400 hover:text-red-500 transition-colors">
              <HiX className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          className="input-field flex-1 text-sm" placeholder={`Add new ${label.toLowerCase()} option…`} />
        <button onClick={add} className="btn-primary text-sm px-3 py-2">
          <HiPlus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState({
    schoolName: 'Anand Special School', address: '', phone: '', email: '',
    principalName: '', workingDaysPerMonth: 26, academicYear: '2025-26',
    lateFeeBase: 250, lateFeePerDay: 25,
    paymentWebsiteUrl: '',
  })
  const [feeSettings, setFeeSettings] = useState({
    defaultMonthlyDueDay:   5,
    defaultQuarterlyDueDay: 10,
    lateFeeEnabled:         true,
    yearlyLateFeeEnabled:   false,
  })
  const [customFieldsDoc, setCustomFieldsDoc] = useState({ studentFields: [], employeeFields: [] })
  const [formOptions, setFormOptions] = useState(DEFAULT_FORM_OPTIONS)
  const [savingOptions, setSavingOptions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [savingFee, setSavingFee] = useState(false)

  // Stable field handlers — school settings
  const hSchoolName    = useCallback((e) => setSettings((p) => ({ ...p, schoolName:          e.target.value })), [])
  const hPrincipal     = useCallback((e) => setSettings((p) => ({ ...p, principalName:       e.target.value })), [])
  const hPhone         = useCallback((e) => setSettings((p) => ({ ...p, phone:               e.target.value })), [])
  const hEmail         = useCallback((e) => setSettings((p) => ({ ...p, email:               e.target.value })), [])
  const hAcademicYear  = useCallback((e) => setSettings((p) => ({ ...p, academicYear:        e.target.value })), [])
  const hWorkingDays   = useCallback((e) => setSettings((p) => ({ ...p, workingDaysPerMonth: Number(e.target.value) })), [])
  const hLateFeeBase   = useCallback((e) => setSettings((p) => ({ ...p, lateFeeBase:         Number(e.target.value) })), [])
  const hLateFeePerDay = useCallback((e) => setSettings((p) => ({ ...p, lateFeePerDay:       Number(e.target.value) })), [])
  const hAddress       = useCallback((e) => setSettings((p) => ({ ...p, address:             e.target.value })), [])
  const hPaymentUrl    = useCallback((e) => setSettings((p) => ({ ...p, paymentWebsiteUrl:  e.target.value })), [])

  // Fee billing handlers
  const hMonthlyDue    = useCallback((e) => setFeeSettings((p) => ({ ...p, defaultMonthlyDueDay:   Number(e.target.value) })), [])
  const hQuarterlyDue  = useCallback((e) => setFeeSettings((p) => ({ ...p, defaultQuarterlyDueDay: Number(e.target.value) })), [])
  const hLateFeeOn     = useCallback((e) => setFeeSettings((p) => ({ ...p, lateFeeEnabled:         e.target.checked })), [])
  const hYearlyLateOn  = useCallback((e) => setFeeSettings((p) => ({ ...p, yearlyLateFeeEnabled:   e.target.checked })), [])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, f, cf, fo] = await Promise.all([getSettings(), getFeeSettings(), getCustomFields(), getFormOptions()])
      if (s) setSettings(s)
      if (f) setFeeSettings(f)
      if (cf) setCustomFieldsDoc({ studentFields: cf.studentFields || [], employeeFields: cf.employeeFields || [] })
      if (fo) setFormOptions({ ...DEFAULT_FORM_OPTIONS, ...fo })
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSaveFormOptions = async () => {
    setSavingOptions(true)
    try {
      await updateFormOptions(formOptions)
      toast.success('Form options saved')
    } catch { toast.error('Failed to save form options') }
    finally { setSavingOptions(false) }
  }

  const saveStudentCustomFields = async (fields) => {
    const updated = { ...customFieldsDoc, studentFields: fields }
    await updateCustomFields(updated)
    setCustomFieldsDoc(updated)
  }

  const saveEmployeeCustomFields = async (fields) => {
    const updated = { ...customFieldsDoc, employeeFields: fields }
    await updateCustomFields(updated)
    setCustomFieldsDoc(updated)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings(settings)
      toast.success('School settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleSaveFee = async (e) => {
    e.preventDefault()
    if (feeSettings.defaultMonthlyDueDay < 1 || feeSettings.defaultMonthlyDueDay > 28) {
      toast.error('Monthly due day must be 1–28'); return
    }
    if (feeSettings.defaultQuarterlyDueDay < 1 || feeSettings.defaultQuarterlyDueDay > 28) {
      toast.error('Quarterly due day must be 1–28'); return
    }
    setSavingFee(true)
    try {
      await updateFeeSettings(feeSettings)
      toast.success('Fee billing settings saved')
    } catch { toast.error('Failed to save fee settings') }
    finally { setSavingFee(false) }
  }

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500">Configure school system settings</p>
      </div>

      {/* School Information */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <HiCog className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">School Information</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SF label="School Name"           value={settings.schoolName}          onChange={hSchoolName} />
            <SF label="Principal Name"        value={settings.principalName}       onChange={hPrincipal} />
            <SF label="Phone"       type="tel"   value={settings.phone}            onChange={hPhone} />
            <SF label="Email"       type="email" value={settings.email}            onChange={hEmail} />
            <SF label="Academic Year"         value={settings.academicYear}        onChange={hAcademicYear} />
            <SF label="Working Days / Month"  type="number" value={settings.workingDaysPerMonth} onChange={hWorkingDays} />
            <SF label="Late Fee Base (₹)"     type="number" value={settings.lateFeeBase}         onChange={hLateFeeBase} />
            <SF label="Late Fee Per Day (₹)"  type="number" value={settings.lateFeePerDay}       onChange={hLateFeePerDay} />
          </div>
          <SF label="Address" value={settings.address} onChange={hAddress} />
          <SF
            label="School Payment Website URL"
            value={settings.paymentWebsiteUrl}
            onChange={hPaymentUrl}
            note='Students will see an "Open School Payment Website" button linking here'
          />
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* Fee Billing Settings */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <HiCurrencyRupee className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Fee Billing Settings</h2>
        </div>
        <form onSubmit={handleSaveFee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SF
              label="Default Monthly Due Day"
              type="number"
              value={feeSettings.defaultMonthlyDueDay}
              onChange={hMonthlyDue}
              note="Day of month (1–28). Default: 5th"
            />
            <SF
              label="Default Quarterly Due Day"
              type="number"
              value={feeSettings.defaultQuarterlyDueDay}
              onChange={hQuarterlyDue}
              note="Day of first month in quarter (1–28). Default: 10th"
            />
          </div>

          {/* Toggle switches */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Late Fee — Monthly / Quarterly</p>
                <p className="text-xs text-gray-500">Apply late fee for overdue monthly and quarterly payments</p>
              </div>
              <input type="checkbox" checked={!!feeSettings.lateFeeEnabled} onChange={hLateFeeOn}
                className="w-5 h-5 accent-primary-600 cursor-pointer" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Late Fee — Yearly</p>
                <p className="text-xs text-gray-500">Apply late fee when yearly subscription expires and is not renewed</p>
              </div>
              <input type="checkbox" checked={!!feeSettings.yearlyLateFeeEnabled} onChange={hYearlyLateOn}
                className="w-5 h-5 accent-primary-600 cursor-pointer" />
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={savingFee} className="btn-primary">
              {savingFee ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
              Save Fee Settings
            </button>
          </div>
        </form>
      </div>

      {/* Custom Fields — Students */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <HiCog className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Custom Fields — Students</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          These fields automatically appear in Add/Edit Student forms and student profiles.
          Examples: Aadhaar Number, Blood Group, Disability Type, Emergency Contact.
        </p>
        <CustomFieldsManager
          title="Student Custom Fields"
          fields={customFieldsDoc.studentFields}
          onSave={saveStudentCustomFields}
        />
      </div>

      {/* Custom Fields — Employees */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <HiCog className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Custom Fields — Employees</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          These fields automatically appear in Add/Edit Employee forms and employee profiles.
          Examples: Passport Number, Emergency Contact, Qualification Details.
        </p>
        <CustomFieldsManager
          title="Employee Custom Fields"
          fields={customFieldsDoc.employeeFields}
          onSave={saveEmployeeCustomFields}
        />
      </div>

      {/* Form Options — editable dropdowns */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <HiCog className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Form Dropdown Options</h2>
          </div>
          <button onClick={handleSaveFormOptions} disabled={savingOptions} className="btn-primary text-sm">
            {savingOptions ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
            Save Options
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Edit the dropdown options that appear in Add/Edit Student and Employee forms.
          Add new options, remove existing ones. Changes apply immediately after saving.
        </p>
        <div className="space-y-6 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="pt-2">
            <OptionsListEditor label="Student Classes"
              items={formOptions.classes || []}
              onChange={(v) => setFormOptions((p) => ({ ...p, classes: v }))} />
          </div>
          <div className="pt-4">
            <OptionsListEditor label="NIOS Sub-Groups"
              items={formOptions.niosSubGroups || []}
              onChange={(v) => setFormOptions((p) => ({ ...p, niosSubGroups: v }))} />
          </div>
          <div className="pt-4">
            <OptionsListEditor label="Gender Options"
              items={formOptions.genders || []}
              onChange={(v) => setFormOptions((p) => ({ ...p, genders: v }))} />
          </div>
          <div className="pt-4">
            <OptionsListEditor label="Mode of Transport"
              items={formOptions.transportOptions || []}
              onChange={(v) => setFormOptions((p) => ({ ...p, transportOptions: v }))} />
          </div>
          <div className="pt-4">
            <OptionsListEditor label="Employee Designations"
              items={formOptions.designations || []}
              onChange={(v) => setFormOptions((p) => ({ ...p, designations: v }))} />
          </div>
        </div>
      </div>

      <ChangePasswordForm />

      {/* ── Admin Accounts ── */}
      <AdminAccountsSection />
    </div>
  )
}

// ── Secondary Firebase app for creating admins without signing out ─────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'anand-school-bca42.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'anand-school-bca42',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'anand-school-bca42.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '535898177762',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:535898177762:web:4fd931e574eee039bc9ebb',
}
const secondaryApp  = getApps().find((a) => a.name === 'secondary') || initializeApp(firebaseConfig, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

function AdminAccountsSection() {
  const [admins,   setAdmins]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => { loadAdmins() }, [])

  const loadAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'))
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      toast.error('Failed to load admins')
    } finally { setLoading(false) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim())             { toast.error('Name is required'); return }
    if (!form.email.trim())            { toast.error('Email is required'); return }
    if (form.password.length < 6)      { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password)
      const uid  = cred.user.uid
      await firebaseSignOut(secondaryAuth)
      await setDoc(doc(db, 'admins', uid), {
        adminName: form.name.trim(),
        email:     form.email.trim(),
        role:      'admin',
        createdAt: serverTimestamp(),
      })
      toast.success(`Admin "${form.name}" added successfully!`)
      setForm({ name: '', email: '', password: '' })
      loadAdmins()
    } catch (err) {
      toast.error(err.message || 'Failed to add admin')
    } finally { setSaving(false) }
  }

  const handleDelete = async (admin) => {
    if (admins.length <= 1) { toast.error('Cannot delete the only admin account'); return }
    setDeleting(admin.id)
    try {
      await deleteDoc(doc(db, 'admins', admin.id))
      toast.success(`Admin "${admin.adminName}" removed`)
      loadAdmins()
    } catch (err) {
      toast.error(err.message)
    } finally { setDeleting(null) }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <HiShieldCheck className="w-4 h-4 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Accounts</h2>
      </div>

      {/* Current admins list */}
      {loading ? <LoadingSpinner size="sm" /> : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600">
                  {admin.adminName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{admin.adminName}</p>
                  <p className="text-xs text-gray-500">{admin.email}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(admin)}
                disabled={deleting === admin.id || admins.length <= 1}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-40"
                title={admins.length <= 1 ? 'Cannot delete only admin' : 'Remove admin'}
              >
                {deleting === admin.id
                  ? <LoadingSpinner size="sm" />
                  : <HiTrash className="w-4 h-4 text-red-500" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new admin form */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <HiUserAdd className="w-4 h-4" /> Add New Admin
        </p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Admin Name"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="admin@email.com"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Min 6 characters"
              className="input-field"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <><LoadingSpinner size="sm" /> Adding…</> : <><HiUserAdd className="w-4 h-4" /> Add Admin</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
