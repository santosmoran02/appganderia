import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Dashboard() {
  const [total, setTotal] = useState(null)
  const [porGranja, setPorGranja] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.getEstadisticas().then(s => setTotal(s.total))
    api.getAnimalesPorGranja().then(setPorGranja)
  }, [])

  if (total === null) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen del rebaño</h1>
          <p className="page-subtitle">Estado actual de todos los animales registrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/animales/nuevo')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo animal
        </button>
      </div>

      <div className="resumen-grid">
        <div className="resumen-card resumen-card--total">
          <span className="resumen-card-label">Total de animales</span>
          <span className="resumen-card-num">{total}</span>
        </div>
        {porGranja.map(g => (
          <div key={g.id} className="resumen-card" onClick={() => navigate(`/granjas/${g.id}`)} style={{ cursor: 'pointer' }}>
            <div className="resumen-card-granja-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="resumen-card-label">{g.nombre}</span>
            <span className="resumen-card-num">{g.total}</span>
            <span className="resumen-card-sublabel">animal{g.total !== 1 ? 'es' : ''}</span>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="card" style={{ marginTop: 20, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
            No hay animales registrados todavía
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            Empieza añadiendo tu primer animal al sistema
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/animales/nuevo')}>
            Añadir primer animal
          </button>
        </div>
      )}
    </div>
  )
}
