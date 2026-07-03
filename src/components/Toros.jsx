import { api } from '../api'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ESTADOS_INACTIVOS = ['vendido', 'fallecido']

export default function Toros() {
  const [toros, setToros] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.getAnimales(), api.getGranjas()]).then(([animales, granjas]) => {
      const granjaNombre = id => granjas.find(g => g.id === id)?.nombre ?? 'Sin granja'
      const activos = animales.filter(a => !ESTADOS_INACTIVOS.includes(a.estado))
      const grupos = new Map()

      for (const a of activos) {
        const externo = a.padre_nombre_ext || a.padre_crotal_ext
        const key = a.padre_id ? `id:${a.padre_id}` : externo ? `ext:${externo.trim().toLowerCase()}` : null
        if (!key) continue
        if (!grupos.has(key)) {
          grupos.set(key, {
            animalId: a.padre_id || null,
            nombre: a.padre_nombre || a.padre_nombre_ext || a.padre_crotal_ext,
            crotal: a.padre_crotal || a.padre_crotal_ext || null,
            hijos: 0,
            hijas: 0,
            porGranja: new Map(),
          })
        }
        const t = grupos.get(key)
        if (a.sexo === 'macho') t.hijos++
        else if (a.sexo === 'hembra') t.hijas++
        const gn = granjaNombre(a.granja_id)
        t.porGranja.set(gn, (t.porGranja.get(gn) || 0) + 1)
      }

      const lista = [...grupos.values()]
        .map(t => ({ ...t, total: t.hijos + t.hijas }))
        .sort((a, b) => b.total - a.total)
      setToros(lista)
    })
  }, [])

  if (toros === null) return <div className="loading">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Toros</h1>
          <p className="page-subtitle">Descendencia activa en las granjas, por toro (madres/padres vendidos o fallecidos no cuentan)</p>
        </div>
      </div>

      {toros.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🐂</div>
          <div className="empty-state-text">Todavía no hay animales con un padre registrado en Genealogía</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {toros.map(t => (
            <div
              key={t.animalId ?? t.nombre}
              className="card"
              style={{ padding: 16, cursor: t.animalId ? 'pointer' : 'default' }}
              onClick={() => t.animalId && navigate(`/animales/${t.animalId}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>🐂 {t.nombre || t.crotal}</span>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                        background: t.animalId ? 'var(--green-50)' : 'var(--gray-100)',
                        color: t.animalId ? 'var(--green-700)' : 'var(--gray-500)',
                      }}
                    >
                      {t.animalId ? 'Registrado en la cuadra' : 'Externo'}
                    </span>
                  </div>
                  {t.crotal && t.animalId && (
                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Crotal: {t.crotal}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {[...t.porGranja.entries()].map(([g, n]) => `${g} (${n})`).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-700)' }}>{t.hijos}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>hijos</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-700)' }}>{t.hijas}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>hijas</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
