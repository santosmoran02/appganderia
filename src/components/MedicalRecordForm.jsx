import { useState } from 'react'

const TIPOS = [
  { value: 'vacuna', label: 'Vacuna' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'revision', label: 'Revisión' },
  { value: 'desparasitacion', label: 'Desparasitación' },
  { value: 'analisis', label: 'Análisis' },
  { value: 'cirugia', label: 'Cirugía' },
]

export default function MedicalRecordForm({ animalId, onClose, onSaved }) {
  const [form, setForm] = useState({ tipo: 'revision', fecha_inicio: '', fecha_fin: '', descripcion: '', veterinario: '' })
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    const payload = {
      animal_id: animalId,
      tipo: form.tipo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      descripcion: form.descripcion.trim() || null,
      veterinario: form.veterinario.trim() || null,
    }
    try {
      const reg = await window.api.createRegistroMedico(payload)
      onSaved(reg)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Nuevo registro médico</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha de fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Descripción</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Detalles del procedimiento, medicamento, dosis..." rows={3} />
          </div>

          <div className="form-group" style={{ marginBottom: 6 }}>
            <label>Veterinario</label>
            <input type="text" value={form.veterinario} onChange={e => set('veterinario', e.target.value)} placeholder="Nombre del veterinario (opcional)" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
