import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'

const EMPTY = {
  crotal: '', nombre: '', raza: '', fecha_nacimiento: '',
  sexo: '', peso: '',
  estado: 'en_produccion', estado_desde: '', estado_hasta: '', tipo: '',
  partos: '',
  madre_crotal: '', madre_nombre: '',
  padre_crotal: '', padre_nombre: '',
  notas: '',
  granja_id: null,
}

export default function AnimalForm({ onGranjaChange }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = Boolean(id)

  // Contexto de granja (cuando se viene desde una granja concreta)
  const granjaIdInicial = location.state?.granjaId ?? null
  // Si venimos desde "Añadir descendiente", el progenitor llega en location.state
  const progenitorInicial = location.state?.progenitor ?? null

  const initialForm = () => {
    const base = { ...EMPTY, granja_id: granjaIdInicial }
    if (!isEdit && progenitorInicial) {
      const esMadre = progenitorInicial.sexo === 'hembra'
      return {
        ...base,
        madre_crotal: esMadre ? progenitorInicial.crotal : '',
        madre_nombre: esMadre ? (progenitorInicial.nombre || '') : '',
        padre_crotal: !esMadre ? progenitorInicial.crotal : '',
        padre_nombre: !esMadre ? (progenitorInicial.nombre || '') : '',
      }
    }
    return base
  }

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      window.api.getAnimal(Number(id)).then(a => {
        if (a) setForm({
          crotal: a.crotal || '',
          nombre: a.nombre || '',
          raza: a.raza || '',
          fecha_nacimiento: a.fecha_nacimiento || '',
          sexo: a.sexo || '',
          peso: a.peso != null ? String(a.peso) : '',
          estado: a.estado || 'en_produccion',
          estado_desde: a.estado_desde || '',
          estado_hasta: a.estado_hasta || '',
          tipo: a.tipo || '',
          partos: a.partos != null ? String(a.partos) : '',
          granja_id: a.granja_id || null,
          // Mostrar crotal/nombre del progenitor: del vinculado si existe, si no el externo
          madre_crotal: a.madre_crotal || a.madre_crotal_ext || '',
          madre_nombre: a.madre_nombre || a.madre_nombre_ext || '',
          padre_crotal: a.padre_crotal || a.padre_crotal_ext || '',
          padre_nombre: a.padre_nombre || a.padre_nombre_ext || '',
          notas: a.notas || '',
        })
      })
    }
  }, [id])

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.crotal.trim()) e.crotal = 'El crotal es obligatorio'
    if (form.peso && isNaN(Number(form.peso))) e.peso = 'El peso debe ser un número'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)

    try {
      // El texto que escribe el usuario siempre se guarda.
      // Si el crotal coincide con un animal de la cuadra se crea además el enlace interno.
      const resolverProgenitor = async (crotal, nombre) => {
        const c = (crotal || '').trim()
        const n = (nombre || '').trim()
        let linkedId = null
        if (c) {
          try {
            const encontrado = await window.api.getAnimalByCrotal(c)
            if (encontrado) linkedId = encontrado.id
          } catch (_) { /* si falla la búsqueda, seguimos sin enlace */ }
        }
        return { id: linkedId, crotal_ext: c || null, nombre_ext: n || null }
      }

      const [resMadre, resPadre] = await Promise.all([
        resolverProgenitor(form.madre_crotal, form.madre_nombre),
        resolverProgenitor(form.padre_crotal, form.padre_nombre),
      ])

      const granjaId = form.granja_id
      const payload = {
        crotal: form.crotal.trim(),
        nombre: form.nombre.trim() || null,
        raza: form.raza.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        sexo: form.sexo || null,
        peso: form.peso !== '' ? Number(form.peso) : null,
        estado: form.estado,
        estado_desde: form.estado_desde || null,
        estado_hasta: form.estado_hasta || null,
        tipo: form.tipo || null,
        partos: form.partos !== '' ? Number(form.partos) : null,
        granja_id: granjaId || null,
        madre_id: resMadre.id,
        madre_crotal_ext: resMadre.crotal_ext,
        madre_nombre_ext: resMadre.nombre_ext,
        padre_id: resPadre.id,
        padre_crotal_ext: resPadre.crotal_ext,
        padre_nombre_ext: resPadre.nombre_ext,
        notas: form.notas.trim() || null,
      }

      if (isEdit) {
        await window.api.updateAnimal(Number(id), payload)
        if (granjaId) navigate(`/granjas/${granjaId}`)
        else navigate(`/animales/${id}`)
      } else {
        await window.api.createAnimal(payload)
        if (granjaId) navigate(`/granjas/${granjaId}`)
        else navigate('/animales')
      }
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        setErrors({ crotal: 'Ya existe un animal con ese crotal' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to={isEdit ? `/animales/${id}` : (form.granja_id ? `/granjas/${form.granja_id}` : '/animales')} className="back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        {isEdit ? 'Volver a la ficha' : form.granja_id ? 'Volver a la granja' : 'Volver a la lista'}
      </Link>

      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Editar animal' : 'Nuevo animal'}</h1>
      </div>

      {!isEdit && progenitorInicial && (
        <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--green-700)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Descendiente de <strong style={{ marginLeft: 4 }}>{progenitorInicial.nombre || progenitorInicial.crotal}</strong>. El progenitor ya está pre-rellenado en genealogía.
        </div>
      )}

      <form className="form-card" style={{ maxWidth: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr auto', gap: 0, padding: 0 }} onSubmit={handleSubmit}>

        {/* ── Columna izquierda: datos del animal ── */}
        <div style={{ padding: 28, borderRight: '1px solid var(--gray-200)', overflowY: 'auto' }}>

          <div className="form-section">
            <div className="form-section-title">Identificación</div>
            <div className="form-row">
              <div className="form-group">
                <label>Crotal <span className="required">*</span></label>
                <input type="text" value={form.crotal} onChange={e => set('crotal', e.target.value)} placeholder="Ej: ES123456789" />
                {errors.crotal && <span className="form-error">{errors.crotal}</span>}
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Características</div>
            <div className="form-row">
              <div className="form-group">
                <label>Raza</label>
                <input type="text" value={form.raza} onChange={e => set('raza', e.target.value)} placeholder="Ej: Frisona, Limusín..." />
              </div>
              <div className="form-group">
                <label>Sexo</label>
                <select value={form.sexo} onChange={e => set('sexo', e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="hembra">♀ Hembra</option>
                  <option value="macho">♂ Macho</option>
                </select>
              </div>
              <div className="form-group">
                <label>Partos</label>
                <input type="number" min="0" step="1" value={form.partos} onChange={e => set('partos', e.target.value)} placeholder="Nº de partos" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha de nacimiento</label>
                <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" min="0" value={form.peso} onChange={e => set('peso', e.target.value)} placeholder="Ej: 450" />
                {errors.peso && <span className="form-error">{errors.peso}</span>}
              </div>
            </div>
          </div>

          <div className="form-section" style={{ marginBottom: 0 }}>
            <div className="form-section-title">Genealogía <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gray-400)' }}>— rellena solo lo que sepas</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-500)', marginBottom: 10 }}>♀ Madre</div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label style={{ color: 'var(--gray-500)' }}>Crotal</label>
                  <input
                    type="text"
                    value={form.madre_crotal}
                    onChange={e => set('madre_crotal', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--gray-500)' }}>Nombre</label>
                  <input
                    type="text"
                    value={form.madre_nombre}
                    onChange={e => set('madre_nombre', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-500)', marginBottom: 10 }}>♂ Padre</div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label style={{ color: 'var(--gray-500)' }}>Crotal</label>
                  <input
                    type="text"
                    value={form.padre_crotal}
                    onChange={e => set('padre_crotal', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--gray-500)' }}>Nombre</label>
                  <input
                    type="text"
                    value={form.padre_nombre}
                    onChange={e => set('padre_nombre', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Columna derecha: observaciones ── */}
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>
          <div className="form-section-title" style={{ marginBottom: 16 }}>Observaciones</div>
          <textarea
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            placeholder="Cualquier observación relevante sobre el animal: comportamiento, incidencias, notas de manejo..."
            style={{ flex: 1, resize: 'none', minHeight: 280 }}
          />
        </div>

        {/* ── Pie: botones (ancho completo) ── */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 28px', borderTop: '1px solid var(--gray-200)' }}>
          <Link to={isEdit ? `/animales/${id}` : (form.granja_id ? `/granjas/${form.granja_id}` : '/animales')} className="btn btn-secondary">Cancelar</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear animal'}
          </button>
        </div>

      </form>
    </div>
  )
}
