import React, { useState, useEffect, useRef, memo } from 'react'
import { HiPencil, HiSave, HiX, HiDownload, HiPrinter, HiCheck } from 'react-icons/hi'
import { getTimetable, saveTimetable } from '../../firebase/timetable'
import { downloadTimetablePDF } from '../../utils/timetablePdf'
import { DAYS, TIME_SLOTS, DAY_COLORS, DEFAULT_TIMETABLE } from './timetableConfig'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

// ── Cell value schema ─────────────────────────────────────────────────────────
// Each cell is stored as:
//   { text: string, bold: bool, italic: bool, underline: bool,
//     color: '#xxxxxx'|'', bgColor: '#xxxxxx'|'' }
// Legacy: plain strings are auto-migrated to this shape on load.

const EMPTY_CELL = { text: '', bold: false, italic: false, underline: false, color: '', bgColor: '' }

/** Normalise whatever is stored (plain string or rich object) to a cell object */
const toCell = (v) => {
  if (!v) return { ...EMPTY_CELL }
  if (typeof v === 'string') {
    // strip legacy HTML tags and wrap in object
    const text = v.replace(/<[^>]*>/g, '')
    return { ...EMPTY_CELL, text }
  }
  return { ...EMPTY_CELL, ...v }
}

/** Build CSS style object from a cell's formatting */
const cellStyle = (cell) => ({
  fontWeight:     cell.bold      ? 'bold'      : 'normal',
  fontStyle:      cell.italic    ? 'italic'    : 'normal',
  textDecoration: cell.underline ? 'underline' : 'none',
  color:          cell.color     || undefined,
  backgroundColor: cell.bgColor  || undefined,
})

// ── Preset colour swatches ────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default',  val: '' },
  { label: 'Black',    val: '#1a1a1a' },
  { label: 'Dark Blue',val: '#1e3a8a' },
  { label: 'Blue',     val: '#2563eb' },
  { label: 'Green',    val: '#16a34a' },
  { label: 'Red',      val: '#dc2626' },
  { label: 'Orange',   val: '#ea580c' },
  { label: 'Purple',   val: '#7c3aed' },
  { label: 'Pink',     val: '#db2777' },
  { label: 'Gray',     val: '#6b7280' },
]

const BG_COLORS = [
  { label: 'None',        val: '' },
  { label: 'Light Yellow',val: '#fef9c3' },
  { label: 'Light Green', val: '#dcfce7' },
  { label: 'Light Blue',  val: '#dbeafe' },
  { label: 'Light Pink',  val: '#fce7f3' },
  { label: 'Light Purple',val: '#ede9fe' },
  { label: 'Light Orange',val: '#ffedd5' },
  { label: 'Light Gray',  val: '#f3f4f6' },
  { label: 'Peach',       val: '#fed7aa' },
  { label: 'Mint',        val: '#a7f3d0' },
]

// ── Colour swatch picker ──────────────────────────────────────────────────────
function SwatchPicker({ label, swatches, value, onChange }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {swatches.map((s) => (
          <button
            key={s.val}
            type="button"
            title={s.label}
            onClick={() => onChange(s.val)}
            className={`w-6 h-6 rounded-md border-2 transition-all ${
              value === s.val
                ? 'border-blue-500 scale-110 shadow-md'
                : 'border-gray-200 dark:border-gray-600 hover:scale-105'
            }`}
            style={{
              backgroundColor: s.val || '#ffffff',
              outline: s.val === '' ? '1px dashed #d1d5db' : undefined,
            }}
          />
        ))}
        {/* Custom colour via native colour input */}
        <label title="Custom colour" className="w-6 h-6 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden">
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute w-0 h-0"
          />
          <span className="text-[10px] text-gray-400">+</span>
        </label>
      </div>
    </div>
  )
}

// ── Cell editor modal ─────────────────────────────────────────────────────────
const CellEditor = memo(function CellEditor({ cellData, day, slot, dayColor, onSave, onClose }) {
  const [cell, setCell] = useState({ ...toCell(cellData) })
  const textareaRef = useRef(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  const toggle = (key) => setCell((c) => ({ ...c, [key]: !c[key] }))
  const set    = (key, val) => setCell((c) => ({ ...c, [key]: val }))

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(cell) }
    if (e.key === 'Escape') onClose()
  }

  const previewStyle = {
    fontWeight:      cell.bold      ? 'bold'      : 'normal',
    fontStyle:       cell.italic    ? 'italic'    : 'normal',
    textDecoration:  cell.underline ? 'underline' : 'none',
    color:           cell.color     || 'inherit',
    backgroundColor: cell.bgColor   || 'transparent',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800"
          style={{ borderTop: `4px solid ${dayColor}` }}>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{day}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{slot}</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <HiX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Text formatting ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Text Style</p>
            <div className="flex items-center gap-1.5">
              {[
                { key: 'bold',      label: 'B', cls: 'font-bold' },
                { key: 'italic',    label: 'I', cls: 'italic' },
                { key: 'underline', label: 'U', cls: 'underline' },
              ].map(({ key, label, cls }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${cls} ${
                    cell[key]
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto">Ctrl+S to save</span>
            </div>
          </div>

          {/* ── Text colour ── */}
          <SwatchPicker
            label="Text Colour"
            swatches={TEXT_COLORS}
            value={cell.color}
            onChange={(v) => set('color', v)}
          />

          {/* ── Cell background colour ── */}
          <SwatchPicker
            label="Cell Background"
            swatches={BG_COLORS}
            value={cell.bgColor}
            onChange={(v) => set('bgColor', v)}
          />

          {/* ── Textarea ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Content</p>
            <textarea
              ref={textareaRef}
              value={cell.text}
              onChange={(e) => set('text', e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Enter subject / activity…"
              style={previewStyle}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder-gray-300 dark:placeholder-gray-600 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">↑ Live preview of your formatting</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(cell)}
            className="btn-primary flex-1 justify-center text-sm text-white"
            style={{ backgroundColor: dayColor }}
          >
            <HiCheck className="w-4 h-4" /> Save Cell
          </button>
        </div>
      </div>
    </div>
  )
})

// ── Migrate a full schedule (all cells) to rich format ────────────────────────
const migrateSchedule = (raw) => {
  if (!raw) return null
  return Object.fromEntries(
    Object.entries(raw).map(([day, slots]) => [
      day,
      Object.fromEntries(
        Object.entries(slots).map(([slotId, v]) => [slotId, toCell(v)])
      ),
    ])
  )
}

// ── Main TimetableView ────────────────────────────────────────────────────────
export default function TimetableView({ className, canEdit = false }) {
  const [timetable, setTimetable] = useState(null)
  const [draft,     setDraft]     = useState(null)
  const [editMode,  setEditMode]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)

  useEffect(() => {
    if (!className) { setLoading(false); return }
    loadTimetable()
  }, [className])

  const loadTimetable = async () => {
    setLoading(true)
    try {
      const data = await getTimetable(className)
      const raw = data?.schedule || DEFAULT_TIMETABLE
      const migrated = migrateSchedule(raw)
      setTimetable(migrated)
      setDraft(JSON.parse(JSON.stringify(migrated)))
      setDirty(false)
    } catch (err) {
      toast.error('Failed to load timetable')
    } finally { setLoading(false) }
  }

  const startEdit  = () => { setEditMode(true); setDirty(false) }
  const cancelEdit = () => {
    setDraft(JSON.parse(JSON.stringify(timetable)))
    setEditMode(false); setEditing(null); setDirty(false)
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      await saveTimetable(className, { schedule: draft })
      setTimetable(JSON.parse(JSON.stringify(draft)))
      setEditMode(false); setEditing(null); setDirty(false)
      toast.success('Timetable saved!')
    } catch (err) {
      toast.error('Failed to save: ' + err.message)
    } finally { setSaving(false) }
  }

  const openCellEditor = (day, slotId, slotLabel) => {
    if (!editMode) return
    setEditing({ day, slotId, slotLabel })
  }

  const handleCellSave = (newCell) => {
    if (!editing) return
    setDraft((prev) => ({
      ...prev,
      [editing.day]: { ...prev[editing.day], [editing.slotId]: newCell },
    }))
    setDirty(true)
    setEditing(null)
  }

  if (!className) return (
    <div className="card p-12 text-center text-gray-400">
      <HiPrinter className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>Select a class to view its timetable</p>
    </div>
  )

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>

  const current = editMode ? draft : timetable

  return (
    <div className="space-y-3">
      {/* Page toolbar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            Timetable — <span className="text-blue-600 dark:text-blue-400">{className}</span>
          </h2>
          {editMode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              ✏️ Edit Mode{dirty ? ' • Unsaved' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="btn-secondary text-sm">
            <HiPrinter className="w-4 h-4" /> Print
          </button>
          <button onClick={() => downloadTimetablePDF(className, timetable)} className="btn-secondary text-sm">
            <HiDownload className="w-4 h-4" /> PDF
          </button>
          {canEdit && !editMode && (
            <button onClick={startEdit} className="btn-primary text-sm">
              <HiPencil className="w-4 h-4" /> Edit Timetable
            </button>
          )}
          {canEdit && editMode && (
            <>
              <button onClick={cancelEdit} className="btn-secondary text-sm">
                <HiX className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSaveAll} disabled={saving} className="btn-primary text-sm">
                {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
                Save All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit hint banner */}
      {editMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
          <HiPencil className="w-4 h-4 flex-shrink-0" />
          Click any cell to edit text, formatting and colours. Press <strong className="mx-1">Save All</strong> when done.
        </div>
      )}

      {/* Timetable grid */}
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 print-area">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '620px' }}>
          <colgroup>
            <col style={{ width: '11%' }} />
            {DAYS.map((d) => <col key={d} style={{ width: '17.8%' }} />)}
          </colgroup>

          <thead>
            {/* School banner */}
            <tr>
              <td colSpan={6} className="text-center py-3 px-4"
                style={{ background: 'linear-gradient(135deg, #16377A 0%, #1e4da1 100%)' }}>
                <p className="text-white font-bold text-base sm:text-lg tracking-wide">ANAND SPECIAL SCHOOL</p>
                <p className="text-blue-200 text-xs font-medium mt-0.5">(Mngd. By Anand Rehabilitation Trust)</p>
                <p className="text-blue-300 text-xs font-medium mt-0.5">TIME TABLE — {className.toUpperCase()}</p>
              </td>
            </tr>
            {/* Day headers */}
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center text-xs font-bold text-gray-600 dark:text-gray-300 p-2">
                TIME
              </th>
              {DAYS.map((day) => {
                const { bg, text } = DAY_COLORS[day]
                return (
                  <th key={day}
                    className="border border-gray-200 dark:border-gray-700 text-center text-xs font-bold p-2 tracking-wider"
                    style={{ backgroundColor: bg, color: text }}>
                    {day}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {TIME_SLOTS.map((slot, si) => (
              <tr key={slot.id}>
                {/* Time column */}
                <td className="border border-gray-200 dark:border-gray-700 p-2 text-center align-middle bg-gray-50 dark:bg-gray-800/80">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap leading-tight block">
                    {slot.label}
                  </span>
                </td>

                {/* Day cells */}
                {DAYS.map((day) => {
                  const raw    = current?.[day]?.[slot.id]
                  const cell   = toCell(raw)
                  const isEmpty = !cell.text.trim()
                  const { bg } = DAY_COLORS[day]

                  // Base background: alternate rows, overridden by cell.bgColor
                  const baseBg = si % 2 === 0 ? undefined : 'rgba(0,0,0,0.02)'
                  const bg2    = cell.bgColor || baseBg

                  return (
                    <td
                      key={day}
                      onClick={() => openCellEditor(day, slot.id, slot.label)}
                      className={`border border-gray-200 dark:border-gray-700 p-0 align-top transition-all ${
                        editMode ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-blue-400' : ''
                      }`}
                      style={{ borderLeft: `3px solid ${bg}`, overflow: 'hidden' }}
                    >
                      <div
                        className="px-2 py-2 min-h-[52px] text-[11px] leading-snug whitespace-pre-wrap break-words"
                        style={{
                          ...cellStyle(cell),
                          backgroundColor: bg2,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {isEmpty
                          ? editMode
                            ? <span className="text-gray-300 dark:text-gray-600 text-[10px] italic not-italic font-normal" style={{ fontWeight:'normal', fontStyle:'italic', textDecoration:'none', color: '#9ca3af' }}>Click to edit…</span>
                            : <span className="text-gray-200 dark:text-gray-700 text-[10px]">—</span>
                          : cell.text
                        }
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={6} className="p-2 text-center"
                style={{ background: '#f8faff', borderTop: '2px solid #16377A' }}>
                <span className="text-xs text-blue-800 dark:text-blue-400 font-medium italic">
                  Play • Learn • Grow Together
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cell editor modal */}
      {editing && (
        <CellEditor
          cellData={draft?.[editing.day]?.[editing.slotId]}
          day={editing.day}
          slot={editing.slotLabel}
          dayColor={DAY_COLORS[editing.day]?.bg || '#16377A'}
          onSave={handleCellSave}
          onClose={() => setEditing(null)}
        />
      )}

      <style>{`
        @media print {
          body > *:not(.print-area) { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
    </div>
  )
}
