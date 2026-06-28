import { useState } from 'react'
import { api } from '../api'

const DIAS_GESTACION = 283
const MESES_SECADO = 7
// Ciclo estral bovino: ~21 días
const DIAS_CICLO_CELO = 21

function sumarDias(fechaStr, dias) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function sumarMeses(fechaStr, meses) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().split('T')[0]
}

const EMPTY = {
  fecha_inseminacion: '',
  fecha_secado_estimada: '',
  fecha_parto_estimada: '',
  fecha_parto_real: '',
  nombre_toro: '',
  estado: 'en_curso',
  observaciones: '',
  fecha_celo: '',
  fecha_proximo_celo: '',
}

const ESTADO_LABEL = {
  en_curso: 'En curso',
  parto_exitoso: 'Parto exitoso',
  aborto: 'Aborto',
  reabsorcion: 'Reabsorción',
}

export default function GestacionForm({ animalId, gestacion, onClose, onSaved }) {
  const isEdit = Boolean(gestacion)
  const [form, setForm] = useState(
    isEdit
      ? {
          fecha_inseminacion: gestacion.fecha_inseminacion || '',
          fecha_secado_estimada: gestacion.fecha_secado_estimada || '',
          fecha_parto_estimada: gestacion.fecha_parto_estimada || '',
          fecha_parto_real: gestacion.fecha_parto_real || '',
          nombre_toro: gestacion.nombre_toro || '',
          estado: gestacion.estado || 'en_curso',
          observaciones: gestacion.observaciones || '',
          fecha_celo: gestacion.fecha_celo || '',
          fecha_proximo_celo: gestacion.fecha_proximo_celo || '',
        }
      : EMPTY
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'fecha_inseminacion' && value) {
        next.fecha_secado_estimada = sumarMeses(value, MESES_SECADO)
        next.fecha_parto_estimada = sumarDias(value, DIAS_GESTACION)
      }
      // Auto-calcular próximo celo al cambiar fecha de celo
      if (field === 'fecha_celo') {
        next.fecha_proximo_celo = value ? sumarDias(value, DIAS_CICLO_CELO) : ''
      }
      return next
    })
    setErrors(e => ({ ...e, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.fecha_inseminacion) e.fecha_inseminacion = 'La fecha de inseminación es obligatoria'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    const payload = {
      animal_id: animalId,
      fecha_inseminacion: form.fecha_inseminacion,
      fecha_secado_estimada: form.fecha_secado_estimada || null,
      fecha_parto_estimada: form.fecha_parto_estimada || null,
      fecha_parto_real: form.fecha_parto_real || null,
      nombre_toro: form.nombre_toro.trim() || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
      fecha_celo: form.fecha_celo || null,
      fecha_proximo_celo: form.fecha_proximo_celo || null,
    }

    try {
      let resultado
      if (isEdit) {
        resultado = await api.updateGestacion(gestacion.id, payload)
      } else {
        resultado = await api.createGestacion(payload)
      }
      onSaved(resultado)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-title">{isEdit ? 'Editar inseminación' : 'Registrar inseminación'}</div>
        <form onSubmit={handleSubmit}>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Fecha de inseminación <span className="required">*</span></label>
              <input type="date" value={form.fecha_inseminacion} onChange={e => set('fecha_inseminacion', e.target.value)} />
              {errors.fecha_inseminacion && <span className="form-error">{errors.fecha_inseminacion}</span>}
            </div>
            <div className="form-group">
              <label>Fecha estimada de secado</label>
              <input type="date" value={form.fecha_secado_estimada} onChange={e => set('fecha_secado_estimada', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>Se calcula automáticamente (+7 meses)</span>
            </div>
            <div className="form-group">
              <label>Fecha estimada de parto</label>
              <input type="date" value={form.fecha_parto_estimada} onChange={e => set('fecha_parto_estimada', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>Se calcula automáticamente (+283 días)</span>
            </div>
            <div className="form-group">
              <label>Fecha real del parto</label>
              <input type="date" value={form.fecha_parto_real} onChange={e => set('fecha_parto_real', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>Rellenar cuando ocurra el parto</span>
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Tipo de semilla / toro</label>
              <input type="text" value={form.nombre_toro} onChange={e => set('nombre_toro', e.target.value)} placeholder="Ej: Semilla nº 45, Bravo III..." />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {Object.entries(ESTADO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-400)', marginBottom: 12 }}>
              Ciclo de celos
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha del celo</label>
                <input
                  type="date"
                  value={form.fecha_celo}
                  onChange={e => set('fecha_celo', e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                  Fecha en que se detectó el celo
                </span>
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
          </div>

          <div className="form-group" style={{ marginBottom: 6 }}>
            <label>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Ej: Aborto previo con este toro, parto difícil..." rows={4} />
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
