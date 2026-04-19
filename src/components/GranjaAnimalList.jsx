import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'

const ESTADOS = ['', 'en_produccion', 'seca', 'parida', 'ordenar_aparte']
const ESTADO_LABEL = {
  en_produccion: 'En producción',
  seca: 'Seca',
  parida: 'Parida',
  ordenar_aparte: 'Ordeñar aparte',
  vendido: 'Vendido',
  fallecido: 'Fallecido',
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return '-'
  const hoy = new Date()
  const nac = new Date(fechaNac)
  const meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth())
  if (meses < 1) return 'Recién nacido'
  if (meses < 24) return `${meses} m`
  return `${Math.floor(meses / 12)} años`
}

export default function GranjaAnimalList({ onGranjaChange }) {
  const { granjaId } = useParams()
  const navigate = useNavigate()

  const [granja, setGranja] = useState(null)
  const [animales, setAnimales] = useState([])
  const [razas, setRazas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [raza, setRaza] = useState('')
  const [loading, setLoading] = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showRenombrar, setShowRenombrar] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [savingNombre, setSavingNombre] = useState(false)

  useEffect(() => {
    window.api.getGranja(Number(granjaId)).then(setGranja)
    window.api.getRazas().then(setRazas)
  }, [granjaId])

  const cargar = useCallback(() => {
    setLoading(true)
    window.api.getAnimales({ busqueda, estado, raza, granja_id: Number(granjaId) }).then(data => {
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
    const updated = await window.api.updateGranja(Number(granjaId), { nombre })
    setGranja(updated)
    onGranjaChange?.()
    setShowRenombrar(false)
    setSavingNombre(false)
  }

  const handleDeleteGranja = async () => {
    await window.api.deleteGranja(Number(granjaId))
    onGranjaChange?.()
    navigate('/animales')
  }

  if (!granja) return <div className="loading">Cargando...</div>

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
          <button className="btn btn-secondary" onClick={() => { setNuevoNombre(granja.nombre); setShowRenombrar(true) }}>
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
          <input
            type="text"
            placeholder="Buscar por crotal o nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
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
                <th>Crotal</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Raza</th>
                <th>Sexo</th>
                <th>Edad</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {animales.map(a => (
                <tr key={a.id} onClick={() => navigate(`/animales/${a.id}`)}>
                  <td><span className="crotal-cell">{a.crotal}</span></td>
                  <td>{a.nombre || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td>{a.tipo ? a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1) : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
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
              <input
                type="text"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleRenombrarGranja()}
              />
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
              Se eliminarán también todos los animales que tiene dentro. Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmDelete(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteGranja}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
