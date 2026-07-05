import { api } from '../api'
import { useEffect, useState, useMemo } from 'react'

const ESTADOS_CUENTAN = ['en_curso', 'parto_exitoso']

export default function Recuentos() {
  const [gestaciones, setGestaciones] = useState(null)
  const [anio, setAnio] = useState('')

  useEffect(() => {
    api.getAllGestaciones().then(setGestaciones)
  }, [])

  const validas = useMemo(() => {
    if (!gestaciones) return []
    return gestaciones.filter(g => g.nombre_toro?.trim() && ESTADOS_CUENTAN.includes(g.estado) && g.fecha_inseminacion)
  }, [gestaciones])

  const anios = useMemo(() => {
    const set = new Set(validas.map(g => g.fecha_inseminacion.slice(0, 4)))
    return [...set].sort((a, b) => b - a)
  }, [validas])

  useEffect(() => {
    if (!anio && anios.length > 0) setAnio(anios[0])
  }, [anios, anio])

  const recuento = useMemo(() => {
    if (!anio) return []
    const conteo = new Map()
    for (const g of validas) {
      if (g.fecha_inseminacion.slice(0, 4) !== anio) continue
      const key = g.nombre_toro.trim().toLowerCase()
      if (!conteo.has(key)) conteo.set(key, { nombre: g.nombre_toro.trim(), total: 0 })
      conteo.get(key).total++
    }
    return [...conteo.values()].sort((a, b) => b.total - a.total)
  }, [validas, anio])

  const totalAnio = recuento.reduce((s, r) => s + r.total, 0)

  if (gestaciones === null) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recuentos</h1>
          <p className="page-subtitle">Semillas empleadas por año (inseminaciones en curso o con parto exitoso)</p>
        </div>
      </div>

      {anios.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧬</div>
          <div className="empty-state-text">Todavía no hay inseminaciones con semilla registrada</div>
        </div>
      ) : (
        <>
          <div className="filters-bar">
            <select className="filter-select" value={anio} onChange={e => setAnio(e.target.value)}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {recuento.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧬</div>
              <div className="empty-state-text">Sin semillas registradas en {anio}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recuento.map(r => (
                <div key={r.nombre} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>🧬 {r.nombre}</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-700)' }}>{r.total}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>usos</div>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                Total {anio}: {totalAnio} inseminaciones
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
