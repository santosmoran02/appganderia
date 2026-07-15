import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../api'

const ESTADOS = ['', 'en_produccion', 'seca', 'parida', 'ordenar_aparte', 'otro']
const ESTADO_LABEL = {
  en_produccion: 'En producción',
  seca: 'Seca',
  parida: 'Parida',
  ordenar_aparte: 'Ordeñar aparte',
  otro: 'Otro',
  vendido: 'Vendido',
  fallecido: 'Fallecido',
}

const TIPOS_MEDICO = [
  { value: 'vacuna', label: 'Vacuna' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'revision', label: 'Revisión' },
  { value: 'desparasitacion', label: 'Desparasitación' },
  { value: 'analisis', label: 'Análisis' },
  { value: 'cirugia', label: 'Cirugía' },
  { value: 'patas', label: 'Patas' },
]

function calcularEdad(fechaNac) {
  if (!fechaNac) return '-'
  const hoy = new Date()
  const nac = new Date(fechaNac)
  const meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth())
  if (meses < 1) return 'Recién nacido'
  if (meses < 24) return `${meses} m`
  return `${Math.floor(meses / 12)} años`
}

function ModalRegistroMedicoBulk({ cantidad, onClose, onSave }) {
  const [form, setForm] = useState({ tipo: 'revision', fecha_inicio: '', fecha_fin: '', descripcion: '', veterinario: '' })
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      await onSave({
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        descripcion: form.descripcion.trim() || null,
        veterinario: form.veterinario.trim() || null,
      })
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Registro médico para {cantidad} animal{cantidad !== 1 ? 'es' : ''}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS_MEDICO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : `Aplicar a ${cantidad} animal${cantidad !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalMoverGranja({ granjas, granjaActualId, cantidad, onClose, onConfirm }) {
  const [destino, setDestino] = useState('')
  const [saving, setSaving] = useState(false)
  const opciones = granjas.filter(g => g.id !== granjaActualId)

  const handleConfirmar = async () => {
    if (!destino) return
    setSaving(true)
    try {
      await onConfirm(Number(destino))
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Mover {cantidad} animal{cantidad !== 1 ? 'es' : ''} a otra granja</div>
        <div className="form-group">
          <label>Granja de destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)}>
            <option value="">Selecciona una granja...</option>
            {opciones.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirmar} disabled={!destino || saving}>
            {saving ? 'Moviendo...' : 'Mover'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GranjaAnimalList({ onGranjaChange }) {
  const { granjaId } = useParams()
  const navigate = useNavigate()

  const [granja, setGranja] = useState(null)
  const [granjas, setGranjas] = useState([])
  const [animales, setAnimales] = useState([])
  const [razas, setRazas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [raza, setRaza] = useState('')
  const [loading, setLoading] = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showConfirmVaciar, setShowConfirmVaciar] = useState(false)
  const [vaciando, setVaciando] = useState(false)
  const [showRenombrar, setShowRenombrar] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [savingNombre, setSavingNombre] = useState(false)
  const [errorNombre, setErrorNombre] = useState('')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [showRegistroMedicoBulk, setShowRegistroMedicoBulk] = useState(false)
  const [showMoverGranja, setShowMoverGranja] = useState(false)

  useEffect(() => {
    api.getGranja(Number(granjaId)).then(setGranja)
    api.getGranjas().then(setGranjas)
    api.getRazas().then(setRazas)
    setSeleccionados(new Set())
  }, [granjaId])

  const cargar = useCallback(() => {
    setLoading(true)
    api.getAnimales({ busqueda, estado, raza, granja_id: Number(granjaId) }).then(data => {
      setAnimales(data)
      setLoading(false)
    })
  }, [busqueda, estado, raza, granjaId])

  useEffect(() => { cargar() }, [cargar])

  const handleNuevoAnimal = () => {
    navigate('/animales/nuevo', { state: { granjaId: Number(granjaId) } })
  }

  const handleRenombrarGranja = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setSavingNombre(true)
    setErrorNombre('')
    try {
      const updated = await api.updateGranja(Number(granjaId), { nombre })
      setGranja(updated)
      onGranjaChange?.()
      setShowRenombrar(false)
    } catch (err) {
      setErrorNombre(err.message?.includes('UNIQUE') ? 'Ya existe una granja con ese nombre' : 'No se pudo cambiar el nombre')
    } finally {
      setSavingNombre(false)
    }
  }

  const handleDeleteGranja = async () => {
    await api.deleteGranja(Number(granjaId))
    onGranjaChange?.()
    navigate('/animales')
  }

  const handleVaciarGranja = async () => {
    setVaciando(true)
    await api.deleteAnimalesGranja(Number(granjaId))
    setVaciando(false)
    setShowConfirmVaciar(false)
    cargar()
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSeleccionarTodos = () => {
    setSeleccionados(prev => {
      const todosSeleccionados = animales.length > 0 && animales.every(a => prev.has(a.id))
      if (todosSeleccionados) return new Set()
      return new Set(animales.map(a => a.id))
    })
  }

  const handleGuardarRegistroMedicoBulk = async (payload) => {
    await Promise.all([...seleccionados].map(id => api.createRegistroMedico({ ...payload, animal_id: id })))
    setSeleccionados(new Set())
    setShowRegistroMedicoBulk(false)
  }

  const handleMoverGranjaBulk = async (destinoId) => {
    await Promise.all([...seleccionados].map(id => api.updateAnimal(id, { granja_id: destinoId })))
    setSeleccionados(new Set())
    setShowMoverGranja(false)
    cargar()
    onGranjaChange?.()
  }

  if (!granja) return <div className="loading">Cargando...</div>

  const todosSeleccionados = animales.length > 0 && animales.every(a => seleccionados.has(a.id))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{granja.nombre}</h1>
          <p className="page-subtitle">{animales.length} animal{animales.length !== 1 ? 'es' : ''} encontrado{animales.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" onClick={() => setShowConfirmDelete(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Eliminar granja
          </button>
          <button className="btn btn-danger" onClick={() => setShowConfirmVaciar(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            Vaciar granja
          </button>
          <button className="btn btn-secondary" onClick={() => { setNuevoNombre(granja.nombre); setErrorNombre(''); setShowRenombrar(true) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Cambiar nombre
          </button>
          <button className="btn btn-primary" onClick={handleNuevoAnimal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo animal
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar por crotal o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="filter-select" value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.filter(Boolean).map(e => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
        <select className="filter-select" value={raza} onChange={e => setRaza(e.target.value)}>
          <option value="">Todas las razas</option>
          {razas.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {seleccionados.size > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--green-50)' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}</span>
          <button className="btn btn-secondary" onClick={() => setShowRegistroMedicoBulk(true)}>Añadir registro médico</button>
          <button className="btn btn-secondary" onClick={() => setShowMoverGranja(true)}>Mover a otra granja</button>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSeleccionados(new Set())}>Cancelar selección</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando animales...</div>
      ) : animales.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🐄</div>
          <div className="empty-state-text">
            {busqueda || estado || raza ? 'No se encontraron animales con esos filtros' : 'Esta granja no tiene animales todavía'}
          </div>
          {!busqueda && !estado && !raza && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleNuevoAnimal}>
              Añadir primer animal
            </button>
          )}
        </div>
      ) : (
        <div className="animals-table-wrap">
          <table className="animals-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={todosSeleccionados} onChange={toggleSeleccionarTodos} style={{ cursor: 'pointer' }} />
                </th>
                <th>Crotal</th><th>Nombre</th><th>Estado</th><th>Raza</th><th>Sexo</th><th>Edad</th><th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {animales.map(a => (
                <tr key={a.id} onClick={() => navigate(`/animales/${a.id}`, { state: { from: `/granjas/${granjaId}` } })}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(a.id)}
                      onChange={() => toggleSeleccion(a.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td><span className="crotal-cell">{a.crotal}</span></td>
                  <td>{a.nombre || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td><span className={`badge badge-${a.estado}`}>{ESTADO_LABEL[a.estado]}</span></td>
                  <td>{a.raza || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td>
                    {a.sexo
                      ? <span className={`badge badge-${a.sexo}`}>{a.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'}</span>
                      : <span style={{ color: 'var(--gray-400)' }}>—</span>
                    }
                  </td>
                  <td>{calcularEdad(a.fecha_nacimiento)}</td>
                  <td>{a.peso ? `${a.peso} kg` : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRenombrar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRenombrar(false)}>
          <div className="modal">
            <div className="modal-title">Cambiar nombre de la cuadra</div>
            <div className="form-group">
              <label>Nuevo nombre</label>
              <input type="text" value={nuevoNombre} onChange={e => { setNuevoNombre(e.target.value); setErrorNombre('') }} autoFocus onKeyDown={e => e.key === 'Enter' && handleRenombrarGranja()} />
              {errorNombre && <span className="form-error">{errorNombre}</span>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRenombrar(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRenombrarGranja} disabled={!nuevoNombre.trim() || savingNombre}>
                {savingNombre ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Eliminar granja</div>
            <p className="confirm-text">
              ¿Seguro que quieres eliminar <strong>{granja.nombre}</strong>?
              Se eliminarán también todos los animales que tiene dentro, y sus descendientes que se hayan quedado sin granja asignada. Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmDelete(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteGranja}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmVaciar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Vaciar granja</div>
            <p className="confirm-text">
              ¿Seguro que quieres eliminar <strong>todos</strong> los animales de <strong>{granja.nombre}</strong>?
              Se borrarán también su historial médico, inseminaciones, celos, y los descendientes suyos que se hayan quedado sin granja asignada. Esto afecta a todos los animales de la granja, aunque tengas un filtro aplicado en la lista. La granja en sí no se elimina, se queda vacía. Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmVaciar(false)} disabled={vaciando}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleVaciarGranja} disabled={vaciando}>
                {vaciando ? 'Vaciando...' : 'Vaciar granja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegistroMedicoBulk && (
        <ModalRegistroMedicoBulk
          cantidad={seleccionados.size}
          onClose={() => setShowRegistroMedicoBulk(false)}
          onSave={handleGuardarRegistroMedicoBulk}
        />
      )}

      {showMoverGranja && (
        <ModalMoverGranja
          granjas={granjas}
          granjaActualId={Number(granjaId)}
          cantidad={seleccionados.size}
          onClose={() => setShowMoverGranja(false)}
          onConfirm={handleMoverGranjaBulk}
        />
      )}
    </div>
  )
}
