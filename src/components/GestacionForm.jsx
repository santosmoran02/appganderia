import { api } from '../api'
import { useEffect, useState } from 'react'

// Gestación bovina media: 283 días
const DIAS_GESTACION = 283
// Secado: se deja de ordeñar ~2 meses antes del parto, 7 meses tras la inseminación
const MESES_SECADO = 7
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
  toro: '',
  estado: 'en_curso',
  observaciones: '',
}

const ESTADO_LABEL = {
  en_curso: 'En curso',
  parto_exitoso: 'Parto exitoso',
  nacido_muerto: 'Nacido muerto',
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
          toro: gestacion.toro || '',
          estado: gestacion.estado || 'en_curso',
          observaciones: gestacion.observaciones || '',
        }
      : EMPTY
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [sugerenciasToros, setSugerenciasToros] = useState([])

  useEffect(() => {
    Promise.all([api.getAnimalesParaSelector(), api.getNombresToros()]).then(([animales, nombres]) => {
      const machos = animales.filter(a => a.sexo === 'macho').map(a => a.nombre || a.crotal)
      setSugerenciasToros([...new Set([...machos, ...nombres].filter(Boolean))])
    })
  }, [])

  const set = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      // Auto-calcular fecha de secado y de parto al cambiar fecha de inseminación
      if (field === 'fecha_inseminacion' && value) {
        next.fecha_secado_estimada = sumarMeses(value, MESES_SECADO)
        next.fecha_parto_estimada = sumarDias(value, DIAS_GESTACION)
      }
      return next
    })
    setErrors(e => ({ ...e, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.fecha_inseminacion) e.fecha_inseminacion = 'La fecha de inseminación es obligatoria'
    if (form.estado === 'parto_exitoso' && !form.fecha_parto_real) {
      e.fecha_parto_real = 'Indica la fecha real del parto para poder crear el descendiente'
    }
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
      toro: form.toro.trim() || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
    }

    try {
      let resultado
      if (isEdit) {
        resultado = await api.updateGestacion(gestacion.id, payload)
      } else {
        resultado = await api.createGestacion(payload)
      }
      onSaved(resultado)
    } catch (err) {
      setErrors(e => ({ ...e, general: err.message || 'No se pudo guardar la inseminación' }))
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
              <input
                type="date"
                value={form.fecha_inseminacion}
                onChange={e => set('fecha_inseminacion', e.target.value)}
              />
              {errors.fecha_inseminacion && <span className="form-error">{errors.fecha_inseminacion}</span>}
            </div>
            <div className="form-group">
              <label>Fecha estimada de secado</label>
              <input
                type="date"
                value={form.fecha_secado_estimada}
                onChange={e => set('fecha_secado_estimada', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                Se calcula automáticamente (+7 meses)
              </span>
            </div>
            <div className="form-group">
              <label>Fecha estimada de parto</label>
              <input
                type="date"
                value={form.fecha_parto_estimada}
                onChange={e => set('fecha_parto_estimada', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                Se calcula automáticamente (+283 días)
              </span>
            </div>
            <div className="form-group">
              <label>Fecha real del parto</label>
              <input
                type="date"
                value={form.fecha_parto_real}
                onChange={e => set('fecha_parto_real', e.target.value)}
              />
              {errors.fecha_parto_real ? (
                <span className="form-error">{errors.fecha_parto_real}</span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                  Rellenar cuando ocurra el parto (aunque sea antes o después de lo estimado)
                </span>
              )}
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Semilla</label>
              <input
                type="text"
                value={form.nombre_toro}
                onChange={e => set('nombre_toro', e.target.value)}
                placeholder="Ej: Semilla nº 45, Frisón Premium..."
              />
            </div>
            <div className="form-group">
              <label>Toro</label>
              <input
                type="text"
                list="lista-toros"
                value={form.toro}
                onChange={e => set('toro', e.target.value)}
                placeholder="Ej: Bravo III"
              />
              <datalist id="lista-toros">
                {sugerenciasToros.map(t => <option key={t} value={t} />)}
              </datalist>
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

          <div className="form-group" style={{ marginBottom: 6 }}>
            <label>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Ej: Aborto previo con este toro, parto difícil, gemelar, parto sin asistencia..."
              rows={4}
            />
          </div>

          {errors.general && <span className="form-error" style={{ display: 'block', marginBottom: 10 }}>{errors.general}</span>}

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
