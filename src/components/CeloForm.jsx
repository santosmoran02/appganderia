import { api } from '../api'
import { useState } from 'react'

const DIAS_CICLO_CELO = 21

function sumarDias(fechaStr, dias) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

const EMPTY = {
  fecha_celo: '',
  fecha_proximo_celo: '',
  observaciones: '',
}

export default function CeloForm({ animalId, celo, onClose, onSaved }) {
  const isEdit = Boolean(celo)
  const [form, setForm] = useState(
    isEdit
      ? {
          fecha_celo: celo.fecha_celo || '',
          fecha_proximo_celo: celo.fecha_proximo_celo || '',
          observaciones: celo.observaciones || '',
        }
      : EMPTY
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'fecha_celo') {
        next.fecha_proximo_celo = value ? sumarDias(value, DIAS_CICLO_CELO) : ''
      }
      return next
    })
    setErrors(e => ({ ...e, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.fecha_celo) e.fecha_celo = 'La fecha del celo es obligatoria'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    const payload = {
      animal_id: animalId,
      fecha_celo: form.fecha_celo,
      fecha_proximo_celo: form.fecha_proximo_celo || null,
      observaciones: form.observaciones.trim() || null,
    }

    try {
      let resultado
      if (isEdit) {
        resultado = await api.updateCelo(celo.id, payload)
      } else {
        resultado = await api.createCelo(payload)
      }
      onSaved(resultado)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-title">{isEdit ? 'Editar celo' : 'Registrar celo'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Fecha del celo <span className="required">*</span></label>
              <input
                type="date"
                value={form.fecha_celo}
                onChange={e => set('fecha_celo', e.target.value)}
              />
              {errors.fecha_celo && <span className="form-error">{errors.fecha_celo}</span>}
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Próximo celo estimado
                <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 99 }}>
                  📅 calendario
                </span>
              </label>
              <input
                type="date"
                value={form.fecha_proximo_celo}
                onChange={e => set('fecha_proximo_celo', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                Se calcula automáticamente (+21 días)
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 6 }}>
            <label>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas sobre el celo..."
              rows={3}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
