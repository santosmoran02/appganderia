import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const ESTADO_LABEL_CAL = {
  en_produccion: 'En producción', seca: 'Seca', parida: 'Parida',
  ordenar_aparte: 'Ordeñar aparte', otro: 'Otro', vendido: 'Vendido', fallecido: 'Fallecido',
}

const ICONO_EVENTO = { parto: '🐄', secado: '🥛', estado: '🔔', celo: '🔴', actividad: '📌' }
const LABEL_EVENTO = { parto: 'Parto estimado', secado: 'Secado estimado', celo: 'Próximo celo' }

function isoFecha(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatFechaCorta(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

function unificarEventosSemana(partos, estadosHasta, celos, actividades) {
  return [
    ...partos.map(e => ({ ...e, tipo: 'parto', fecha: e.fecha_parto_estimada, key: `parto-${e.id}` })),
    ...partos.filter(e => e.fecha_secado_estimada).map(e => ({ ...e, tipo: 'secado', fecha: e.fecha_secado_estimada, key: `secado-${e.id}` })),
    ...estadosHasta.map(e => ({ ...e, tipo: 'estado', fecha: e.estado_hasta, key: `estado-${e.id}` })),
    ...celos.map(e => ({ ...e, tipo: 'celo', fecha: e.fecha_proximo_celo, key: `celo-${e.id}` })),
    ...actividades.map(e => ({ ...e, tipo: 'actividad', fecha: e.fecha, key: `actividad-${e.id}` })),
  ]
}

export default function Dashboard() {
  const [total, setTotal] = useState(null)
  const [porGranja, setPorGranja] = useState([])
  const [eventosSemana, setEventosSemana] = useState(null)
  const [completados, setCompletados] = useState(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    api.getEstadisticas().then(s => setTotal(s.total))
    api.getAnimalesPorGranja().then(setPorGranja)

    Promise.all([
      api.getAllGestacionesCalendario(),
      api.getAnimalesConEstadoHasta(),
      api.getAllCelosCalendario(),
      api.getAllActividades(),
      api.getEventosCompletados(),
    ]).then(([partos, estadosHasta, celos, actividades, completadosSet]) => {
      const lunes = startOfWeek(new Date())
      const inicioIso = isoFecha(lunes)
      const finIso = isoFecha(addDays(lunes, 6))
      const eventos = unificarEventosSemana(partos, estadosHasta, celos, actividades)
        .filter(e => e.fecha && e.fecha >= inicioIso && e.fecha <= finIso)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      setEventosSemana(eventos)
      setCompletados(completadosSet)
    })
  }, [])

  const toggleCompletado = (key) => {
    setCompletados(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        api.desmarcarEventoCompletado(key)
      } else {
        next.add(key)
        api.marcarEventoCompletado(key)
      }
      return next
    })
  }

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

      {eventosSemana && eventosSemana.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Esta semana en el calendario</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eventosSemana.map(e => {
              const esGestacion = e.tipo === 'parto' || e.tipo === 'secado'
              const esActividad = e.tipo === 'actividad'
              const nombre = esActividad ? e.nombre : (esGestacion || e.tipo === 'celo') ? (e.animal_nombre || e.crotal) : (e.nombre || e.crotal)
              const animalId = esActividad ? null : (esGestacion || e.tipo === 'celo') ? e.animal_id : e.id
              const hecho = completados.has(e.key)
              const label = esActividad ? e.vaca : e.tipo === 'estado' ? `Fin de estado (${ESTADO_LABEL_CAL[e.estado] || e.estado})` : LABEL_EVENTO[e.tipo]
              return (
                <div
                  key={e.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 6, background: hecho ? 'var(--gray-50)' : 'var(--green-50)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hecho}
                    onChange={() => toggleCompletado(e.key)}
                    style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONO_EVENTO[e.tipo]}</span>
                  <span
                    style={{
                      flex: 1, cursor: animalId ? 'pointer' : 'default', fontSize: 13,
                      textDecoration: hecho ? 'line-through' : 'none',
                      color: hecho ? 'var(--gray-400)' : 'var(--gray-800)',
                    }}
                    onClick={() => animalId && navigate(`/animales/${animalId}`)}
                  >
                    <strong>{nombre}</strong>{label ? ` — ${label}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', flexShrink: 0 }}>{formatFechaCorta(e.fecha)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
