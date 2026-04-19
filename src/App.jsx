import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import AnimalList from './components/AnimalList'
import AnimalDetail from './components/AnimalDetail'
import AnimalForm from './components/AnimalForm'
import GranjaAnimalList from './components/GranjaAnimalList'
import Calendar from './components/Calendar'

export default function App() {
  const navigate = useNavigate()
  const [granjas, setGranjas] = useState([])
  const [showNuevaGranja, setShowNuevaGranja] = useState(false)
  const [nombreGranja, setNombreGranja] = useState('')
  const [savingGranja, setSavingGranja] = useState(false)

  const cargarGranjas = () => window.api.getGranjas().then(setGranjas)

  useEffect(() => { cargarGranjas() }, [])

  const handleCreateGranja = async () => {
    const nombre = nombreGranja.trim()
    if (!nombre) return
    setSavingGranja(true)
    const nueva = await window.api.createGranja({ nombre })
    setGranjas(gs => [...gs, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNombreGranja('')
    setShowNuevaGranja(false)
    setSavingGranja(false)
    navigate(`/granjas/${nueva.id}`)
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🐄</span>
          <span className="logo-text">GanadApp</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Resumen
          </NavLink>
          <NavLink to="/animales" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Animales
          </NavLink>
          <NavLink to="/calendario" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Calendario
          </NavLink>

          {/* ── Sección Granjas ── */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">Granjas</span>
            <button className="sidebar-section-add" title="Nueva granja" onClick={() => { setNombreGranja(''); setShowNuevaGranja(true) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          {granjas.length === 0 ? (
            <div className="sidebar-empty">Sin granjas creadas</div>
          ) : (
            granjas.map(g => (
              <NavLink key={g.id} to={`/granjas/${g.id}`} className={({ isActive }) => isActive ? 'nav-item nav-subitem active' : 'nav-item nav-subitem'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {g.nombre}
              </NavLink>
            ))
          )}
        </nav>

      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/animales" element={<AnimalList />} />
          <Route path="/animales/nuevo" element={<AnimalForm onGranjaChange={cargarGranjas} />} />
          <Route path="/animales/:id" element={<AnimalDetail />} />
          <Route path="/animales/:id/editar" element={<AnimalForm onGranjaChange={cargarGranjas} />} />
          <Route path="/granjas/:granjaId" element={<GranjaAnimalList onGranjaChange={cargarGranjas} />} />
          <Route path="/calendario" element={<Calendar />} />
        </Routes>
      </main>

      {/* Modal nueva granja */}
      {showNuevaGranja && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNuevaGranja(false)}>
          <div className="modal">
            <div className="modal-title">Nueva granja</div>
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                value={nombreGranja}
                onChange={e => setNombreGranja(e.target.value)}
                placeholder="Ej: Cuadra Norte, Finca El Pino..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateGranja()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNuevaGranja(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateGranja} disabled={!nombreGranja.trim() || savingGranja}>
                {savingGranja ? 'Creando...' : 'Crear granja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
