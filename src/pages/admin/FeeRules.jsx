import React, { useState, useEffect } from 'react'
import { HiPlus, HiPencil, HiTrash, HiSave, HiX, HiInformationCircle } from 'react-icons/hi'
import { getFeeRules, saveFeeRule, deleteFeeRule } from '../../firebase/firestore'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatCurrency } from '../../utils/helpers'
import toast from 'react-hot-toast'

// ─── Empty bracket template ───────────────────────────────────────────────────
const emptyBracket = () => ({ minAge: '', maxAge: '', fee: '' })

// ─── Inline form panel — shown instead of a modal ────────────────────────────
// Kept at module scope so it never remounts on parent rerender.
const RuleForm = ({ initial, existingYears, onSave, onCancel, saving }) => {
  const isEdit = !!initial
  const [year, setYear]         = useState(initial?.academicYear ?? '')
  const [brackets, setBrackets] = useState(
    initial?.brackets?.length
      ? initial.brackets.map((b) => ({ minAge: String(b.minAge), maxAge: b.maxAge !== undefined ? String(b.maxAge) : '', fee: String(b.fee) }))
      : [emptyBracket()]
  )

  const addBracket = () => setBrackets((p) => [...p, emptyBracket()])

  const removeBracket = (i) => setBrackets((p) => p.filter((_, idx) => idx !== i))

  const updateField = (i, field, val) =>
    setBrackets((p) => p.map((b, idx) => idx === i ? { ...b, [field]: val } : b))

  const handleSave = (e) => {
    e.preventDefault()
    const trimmedYear = year.trim()
    if (!trimmedYear) { toast.error('Academic year is required, e.g. 2025-2026'); return }
    // Validate year format
    if (!/^\d{4}-\d{4}$/.test(trimmedYear)) { toast.error('Format must be YYYY-YYYY, e.g. 2025-2026'); return }
    // Duplicate check — only on add
    if (!isEdit && existingYears.includes(trimmedYear)) {
      toast.error(`${trimmedYear} already exists. Click Edit to modify it.`); return
    }
    for (const [i, b] of brackets.entries()) {
      if (b.minAge === '' || b.minAge === undefined) { toast.error(`Row ${i + 1}: Min Age is required`); return }
      if (b.fee === '' || b.fee === undefined)        { toast.error(`Row ${i + 1}: Fee is required`); return }
    }
    onSave({
      academicYear: trimmedYear,
      brackets: brackets.map((b) => ({
        minAge: Number(b.minAge),
        maxAge: b.maxAge !== '' ? Number(b.maxAge) : '',
        fee:    Number(b.fee),
      })),
    })
  }

  return (
    <form onSubmit={handleSave} className="card p-4 sm:p-6 space-y-5 border-2 border-primary-200 dark:border-primary-800">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
          {isEdit ? `Edit: ${initial.academicYear}` : 'Add New Academic Year'}
        </h3>
        <button type="button" onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <HiX className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Academic Year */}
      <div>
        <label className="label">Academic Year <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={year}
          onChange={(e) => !isEdit && setYear(e.target.value)}
          placeholder="e.g. 2026-2027"
          className={`input-field ${isEdit ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
          readOnly={isEdit}
        />
        {isEdit && <p className="text-xs text-gray-400 mt-1">Year cannot be changed. Delete and recreate to rename.</p>}
      </div>

      {/* Age Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="label mb-0">Age Categories</label>
          <button type="button" onClick={addBracket}
            className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 font-medium flex items-center gap-1">
            <HiPlus className="w-3.5 h-3.5" /> Add Category
          </button>
        </div>

        {/* Header row — hidden on mobile since each row gets labels there */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_40px] gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Age (yrs)</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Age (yrs)</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Fee (₹)</span>
          <span />
        </div>

        {brackets.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] sm:grid-cols-[1fr_1fr_1fr_40px] gap-2 items-center">
            <input type="number" min="0" max="100"
              value={b.minAge}
              onChange={(e) => updateField(i, 'minAge', e.target.value)}
              placeholder="Min Age"
              className="input-field text-sm"
            />
            <input type="number" min="0" max="100"
              value={b.maxAge}
              onChange={(e) => updateField(i, 'maxAge', e.target.value)}
              placeholder="Max Age"
              className="input-field text-sm"
            />
            <input type="number" min="0"
              value={b.fee}
              onChange={(e) => updateField(i, 'fee', e.target.value)}
              placeholder="Fee ₹"
              className="input-field text-sm"
            />
            <button type="button" onClick={() => removeBracket(i)}
              disabled={brackets.length === 1}
              className="w-9 h-9 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30">
              <HiX className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ))}

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <HiInformationCircle className="w-3.5 h-3.5" />
          Enter the <strong>monthly</strong> fee. Quarterly = ×3, Yearly = ×11 — calculated automatically.
          Leave Max Age blank in the last row to match all ages above Min Age.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
          {saving
            ? <><LoadingSpinner size="sm" /> Saving…</>
            : <><HiSave className="w-4 h-4" /> Save Rule</>}
        </button>
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeeRules() {
  const [rules, setRules]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  // formMode: null | 'add' | academicYear string (edit)
  const [formMode, setFormMode]   = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, year: '' })

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      setRules(await getFeeRules())
    } catch (err) {
      toast.error(`Failed to load fee rules: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data) => {
    setSaving(true)
    try {
      await saveFeeRule(data)
      toast.success(formMode === 'add' ? 'Fee rule added' : 'Fee rule updated')
      setFormMode(null)
      load()
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
      console.error('Fee rule save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteFeeRule(deleteDialog.year)
      toast.success('Fee rule deleted')
      setDeleteDialog({ open: false, year: '' })
      if (formMode === deleteDialog.year) setFormMode(null)
      load()
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const existingYears = rules.map((r) => r.academicYear)
  const editingRule   = formMode && formMode !== 'add'
    ? rules.find((r) => r.academicYear === formMode)
    : null

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Rule Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Set age-based <strong>monthly</strong> fee brackets per academic year.
            Quarterly = ×3, Yearly = ×11. Calculated automatically.
          </p>
        </div>
        {!formMode && (
          <button onClick={() => setFormMode('add')} className="btn-primary text-sm">
            <HiPlus className="w-4 h-4" /> Add Academic Year
          </button>
        )}
      </div>

      {/* Inline Add Form */}
      {formMode === 'add' && (
        <RuleForm
          initial={null}
          existingYears={existingYears}
          onSave={handleSave}
          onCancel={() => setFormMode(null)}
          saving={saving}
        />
      )}

      {/* Rules List */}
      {loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
      ) : rules.length === 0 && !formMode ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg font-medium mb-2">No fee rules configured yet</p>
          <p className="text-sm mb-5">Add an academic year with age brackets to get started.</p>
          <button onClick={() => setFormMode('add')} className="btn-primary text-sm mx-auto">
            <HiPlus className="w-4 h-4" /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.academicYear}>
              {/* Inline Edit Form for this rule */}
              {formMode === rule.academicYear ? (
                <RuleForm
                  initial={editingRule}
                  existingYears={existingYears}
                  onSave={handleSave}
                  onCancel={() => setFormMode(null)}
                  saving={saving}
                />
              ) : (
                /* Rule display card */
                <div className="card p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Academic Year: {rule.academicYear}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">{rule.brackets.length} age bracket(s)</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setFormMode(rule.academicYear)}
                        disabled={!!formMode}
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-40"
                        title="Edit"
                      >
                        <HiPencil className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => setDeleteDialog({ open: true, year: rule.academicYear })}
                        disabled={!!formMode}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-40"
                        title="Delete"
                      >
                        <HiTrash className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Brackets display */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Age Range</th>
                          <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {rule.brackets.map((b, i) => {
                          const minLabel = `${b.minAge} yrs`
                          const maxLabel = (b.maxAge !== '' && b.maxAge !== undefined) ? `${b.maxAge} yrs` : 'and above'
                          return (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                              <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                                {minLabel} – {maxLabel}
                              </td>
                              <td className="py-2.5 text-right font-semibold text-primary-600 dark:text-primary-400">
                                {formatCurrency(b.fee)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, year: '' })}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Fee Rule"
        message={`Delete fee rule for "${deleteDialog.year}"? All student fee calculations using this year will show ₹0. This cannot be undone.`}
      />
    </div>
  )
}
