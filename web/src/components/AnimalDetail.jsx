import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../api'
import MedicalRecordForm from './MedicalRecordForm'
import GestacionForm from './GestacionForm'

const TIPO_LABEL = {
  vacuna: 'Vacuna', tratamiento: 'Tratamiento', revision: 'Revisión',
  desparasitacion: 'Desparasitación', analisis: 'Análisis', cirugia: 'Cirugía',
}

const ESTADO_LABEL = {
  en_produccion: 'En producción', seca: 'Seca', parida: 'Parida', ordenar_aparte: 'Ordeñar aparte',
}

const ESTADO_LABEL_COMPLETO = {
  en_produccion: 'En producción', seca: 'Seca', parida: 'Parida',
  ordenar_aparte: 'Ordeñar aparte', vendido: 'Vendido', fallecido: 'Fallecido',
}

const ESTADOS_PRODUCCION = ['en_produccion', 'seca', 'parida', 'ordenar_aparte']

const GESTACION_ESTADO_LABEL = {
  en_curso: 'En curso', parto_exitoso: 'Parto exitoso', aborto: 'Aborto', reabsorcion: 'Reabsorción',
}

const GESTACION_ESTADO_BADGE = {
  en_curso: { bg: '#dbeafe', color: '#1e40af' },
  parto_exitoso: { bg: '#dcfce7', color: '#15803d' },
  aborto: { bg: '#fee2e2', color: '#991b1b' },
  reabsorcion: { bg: '#fef9c3', color: '#92400e' },
}

function formatFecha(iso) {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  const meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth())
  if (meses < 1) return 'Recién nacido'
  if (meses < 24) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const m = meses % 12
  return m > 0 ? `${años} años y ${m} meses` : `${años} años`
}

function parseFechaHistorial(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr + 'T00:00:00')
  return { day: d.getDate(), month: d.toLocaleString('es-ES', { month: 'short' }).replace('.', ''), year: d.getFullYear() }
}

function calcularSemanas(fechaInseminacion) {
  if (!fechaInseminacion) return null
  const hoy = new Date()
  const ins = new Date(fechaInseminacion + 'T00:00:00')
  const dias = Math.floor((hoy - ins) / (1000 * 60 * 60 * 24))
  if (dias < 0) return null
  const semanas = Math.floor(dias / 7)
  const diasRest = dias % 7
  if (semanas === 0) return `${dias} día${dias !== 1 ? 's' : ''}`
  return diasRest > 0 ? `${semanas} sem. ${diasRest} día${diasRest !== 1 ? 's' : ''}` : `${semanas} semanas`
}

function calcularTiempoEstado(desde) {
  if (!desde) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(desde + 'T00:00:00')
  if (hoy < inicio) return null
  if (hoy.getTime() === inicio.getTime()) return 'Hoy empieza'
  let años = hoy.getFullYear() - inicio.getFullYear()
  let meses = hoy.getMonth() - inicio.getMonth()
  let dias = hoy.getDate() - inicio.getDate()
  if (dias < 0) { meses--; dias += new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate() }
  if (meses < 0) { años--; meses += 12 }
  const partes = []
  if (años > 0) partes.push(`${años} año${años > 1 ? 's' : ''}`)
  if (meses > 0) partes.push(`${meses} mes${meses > 1 ? 'es' : ''}`)
  if (dias > 0) partes.push(`${dias} día${dias > 1 ? 's' : ''}`)
  if (partes.length === 0) return 'Hoy empieza'
  if (partes.length === 1) return partes[0]
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1]
}

function calcularTiempoHastaFin(hasta) {
  if (!hasta) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fin = new Date(hasta + 'T00:00:00')
  const pasado = fin < hoy
  const [desde, hacia] = pasado ? [fin, hoy] : [hoy, fin]
  let años = hacia.getFullYear() - desde.getFullYear()
  let meses = hacia.getMonth() - desde.getMonth()
  let dias = hacia.getDate() - desde.getDate()
  if (dias < 0) { meses--; dias += new Date(hacia.getFullYear(), hacia.getMonth(), 0).getDate() }
  if (meses < 0) { años--; meses += 12 }
  const partes = []
  if (años > 0) partes.push(`${años} año${años > 1 ? 's' : ''}`)
  if (meses > 0) partes.push(`${meses} mes${meses > 1 ? 'es' : ''}`)
  if (dias > 0) partes.push(`${dias} día${dias > 1 ? 's' : ''}`)
  if (partes.length === 0) return { texto: 'Hoy', pasado: false }
  const texto = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1]
  return { texto, pasado }
}

function diasParaParto(fechaPartoEstimada) {
  if (!fechaPartoEstimada) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const parto = new Date(fechaPartoEstimada + 'T00:00:00')
  return Math.floor((parto - hoy) / (1000 * 60 * 60 * 24))
}

export default function AnimalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [animal, setAnimal] = useState(null)
  const [historial, setHistorial] = useState([])
  const [descendencia, setDescendencia] = useState([])
  const [gestaciones, setGestaciones] = useState([])
  const [tab, setTab] = useState('info')
  const [showMedForm, setShowMedForm] = useState(false)
  const [showGestacionForm, setShowGestacionForm] = useState(false)
  const [editingGestacion, setEditingGestacion] = useState(null)
  const [savingEstado, setSavingEstado] = useState(false)
  const [estadoDesde, setEstadoDesde] = useState('')
  const [estadoHasta, setEstadoHasta] = useState('')
  const [granjas, setGranjas] = useState([])
  const [savingGranja, setSavingGranja] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [confirmDeleteDesc, setConfirmDeleteDesc] = useState(null)

  const cargar = () => {
    api.getAnimal(Number(id)).then(setAnimal)
    api.getHistorialMedico(Number(id)).then(setHistorial)
    api.getDescendencia(Number(id)).then(setDescendencia)
    api.getGestaciones(Number(id)).then(setGestaciones)
  }

  useEffect(() => { cargar() }, [id, location.key])
  useEffect(() => { api.getGranjas().then(setGranjas) }, [])
  useEffect(() => {
    if (animal) {
      setEstadoDesde(animal.estado_desde || '')
      setEstadoHasta(animal.estado_hasta || '')
    }
  }, [animal?.id, animal?.estado_desde, animal?.estado_hasta])

  const handleDeleteAnimal = async () => {
    await api.deleteAnimal(Number(id))
    navigate('/animales')
  }

  const handleDeleteRegistro = async (regId) => {
    await api.deleteRegistroMedico(regId)
    setHistorial(h => h.filter(r => r.id !== regId))
  }

  const handleDeleteGestacion = async (gId) => {
    await api.deleteGestacion(gId)
    setGestaciones(g => g.filter(x => x.id !== gId))
  }

  const handleCambiarEstado = async (nuevoEstado) => {
    if (nuevoEstado === animal.estado) return
    setSavingEstado(true)
    const updated = await api.updateAnimal(animal.id, { ...animal, estado: nuevoEstado, estado_desde: null, estado_hasta: null })
    setAnimal(updated)
    setSavingEstado(false)
  }

  const handleGuardarEstadoDesde = async (valor) => {
    const updated = await api.updateAnimal(animal.id, { ...animal, estado_desde: valor || null })
    setAnimal(updated)
  }

  const handleGuardarEstadoHasta = async (valor) => {
    const updated = await api.updateAnimal(animal.id, { ...animal, estado_hasta: valor || null })
    setAnimal(updated)
  }

  const handleCambiarGranja = async (nuevaGranjaId) => {
    setSavingGranja(true)
    const updated = await api.updateAnimal(animal.id, { ...animal, granja_id: nuevaGranjaId })
    setAnimal(updated)
    setSavingGranja(false)
  }

  const handleDeleteDescendiente = async (descId) => {
    await api.deleteAnimal(descId)
    setDescendencia(d => d.filter(x => x.id !== descId))
  }

  const handleAddDescendiente = () => {
    navigate('/animales/nuevo', {
      state: { progenitor: { id: animal.id, crotal: animal.crotal, nombre: animal.nombre, sexo: animal.sexo } }
    })
  }

  if (!animal) return <div className="loading">Cargando...</div>

  const avatarEmoji = animal.sexo === 'hembra' ? '🐄' : animal.sexo === 'macho' ? '🐂' : '🐄'

  return (
    <div>
      <Link to="/animales" className="back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a la lista
      </Link>

      <div className="animal-header">
        <div className="animal-avatar">{avatarEmoji}</div>
        <div className="animal-header-info">
          <div className="animal-crotal">#{animal.crotal}</div>
          <div className="animal-name">{animal.nombre || 'Sin nombre'}</div>
          <div className="animal-badges">
            {animal.sexo && <span className={`badge badge-${animal.sexo}`}>{animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'}</span>}
            <span className={`badge badge-${animal.estado}`}>{ESTADO_LABEL_COMPLETO[animal.estado]}</span>
            {animal.raza && <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>{animal.raza}</span>}
          </div>
        </div>
        <div className="animal-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/animales/${id}/editar`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button className="btn btn-danger" onClick={() => setShowConfirmDelete(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Eliminar
          </button>
        </div>
      </div>

      <div className="tabs">
        {[['info','Información'],['estado','Estado'],['inseminacion',`Inseminación${gestaciones.length > 0 ? ` (${gestaciones.length})` : ''}`],['historial',`Historial médico${historial.length > 0 ? ` (${historial.length})` : ''}`],['genealogia','Genealogía'],['cuadra','Cambio de cuadra']].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card">
          <div className="info-grid">
            <div className="info-item"><span className="info-label">Crotal</span><span className="info-value" style={{ fontFamily: 'Courier New, monospace' }}>{animal.crotal}</span></div>
            <div className="info-item"><span className="info-label">Nombre</span><span className={`info-value ${!animal.nombre ? 'empty' : ''}`}>{animal.nombre || 'Sin nombre'}</span></div>
            <div className="info-item"><span className="info-label">Raza</span><span className={`info-value ${!animal.raza ? 'empty' : ''}`}>{animal.raza || 'No especificada'}</span></div>
            <div className="info-item"><span className="info-label">Sexo</span><span className={`info-value ${!animal.sexo ? 'empty' : ''}`}>{animal.sexo ? (animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra') : 'No especificado'}</span></div>
            <div className="info-item"><span className="info-label">Tipo</span><span className={`info-value ${!animal.tipo ? 'empty' : ''}`}>{animal.tipo ? animal.tipo.charAt(0).toUpperCase() + animal.tipo.slice(1) : 'No especificado'}</span></div>
            <div className="info-item"><span className="info-label">Partos</span><span className={`info-value ${animal.partos == null ? 'empty' : ''}`}>{animal.partos != null ? animal.partos : 'No registrado'}</span></div>
            <div className="info-item"><span className="info-label">Fecha de nacimiento</span><span className={`info-value ${!animal.fecha_nacimiento ? 'empty' : ''}`}>{animal.fecha_nacimiento ? formatFecha(animal.fecha_nacimiento) : 'No registrada'}</span></div>
            <div className="info-item"><span className="info-label">Edad</span><span className={`info-value ${!animal.fecha_nacimiento ? 'empty' : ''}`}>{calcularEdad(animal.fecha_nacimiento) || 'No calculable'}</span></div>
            <div className="info-item"><span className="info-label">Peso</span><span className={`info-value ${!animal.peso ? 'empty' : ''}`}>{animal.peso ? `${animal.peso} kg` : 'No registrado'}</span></div>
          </div>
          {animal.notas && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-200)' }}>
              <div className="info-label" style={{ marginBottom: 6 }}>Notas</div>
              <p style={{ fontSize: 13.5, color: 'var(--gray-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{animal.notas}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'estado' && (
        <div className="card">
          <div style={{ marginBottom: 24 }}>
            <div className="info-label" style={{ marginBottom: 12 }}>Estado actual</div>
            <div className="estado-opciones-grid">
              {Object.entries(ESTADO_LABEL).map(([valor, etiqueta]) => (
                <button key={valor} className={`estado-opcion estado-opcion--${valor} ${animal.estado === valor ? 'estado-opcion--activo' : ''}`} onClick={() => handleCambiarEstado(valor)} disabled={savingEstado}>
                  <span className="estado-opcion-check">
                    {animal.estado === valor && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="estado-fecha-row">
              <div style={{ flex: 1 }}>
                <div className="info-label" style={{ marginBottom: 6 }}>Inicio del estado</div>
                <input type="date" value={estadoDesde} onChange={e => setEstadoDesde(e.target.value)} onBlur={e => handleGuardarEstadoDesde(e.target.value)} style={{ maxWidth: 200 }} />
                {estadoDesde && <button onClick={() => { setEstadoDesde(''); handleGuardarEstadoDesde('') }} style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Borrar fecha</button>}
              </div>
              {estadoDesde && calcularTiempoEstado(estadoDesde) && (
                <div className="estado-tiempo-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {calcularTiempoEstado(estadoDesde)} en este estado
                </div>
              )}
            </div>

            <div>
              <div className="info-label" style={{ marginBottom: 6 }}>
                Fin previsto del estado
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 99, textTransform: 'none', letterSpacing: 0 }}>📅 aparece en el calendario</span>
              </div>
              <div className="estado-fecha-row">
                <div style={{ flex: 1 }}>
                  <input type="date" value={estadoHasta} onChange={e => setEstadoHasta(e.target.value)} onBlur={e => handleGuardarEstadoHasta(e.target.value)} style={{ maxWidth: 200 }} />
                  {estadoHasta && <button onClick={() => { setEstadoHasta(''); handleGuardarEstadoHasta('') }} style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Borrar fecha</button>}
                </div>
                {estadoHasta && (() => {
                  const r = calcularTiempoHastaFin(estadoHasta)
                  if (!r) return null
                  return (
                    <div className="estado-tiempo-badge" style={r.pasado ? { background: '#fee2e2', color: '#991b1b' } : {}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {r.pasado ? `Hace ${r.texto}` : `Faltan ${r.texto}`}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'inseminacion' && (
        <div>
          <div className="historial-header">
            <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{gestaciones.length} registro{gestaciones.length !== 1 ? 's' : ''}</div>
            <button className="btn btn-primary" onClick={() => { setEditingGestacion(null); setShowGestacionForm(true) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Registrar inseminación
            </button>
          </div>
          {gestaciones.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">💉</div><div className="empty-state-text">Sin inseminaciones registradas</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {gestaciones.map(g => {
                const semanas = g.estado === 'en_curso' ? calcularSemanas(g.fecha_inseminacion) : null
                const diasParto = g.estado === 'en_curso' && g.fecha_parto_estimada ? diasParaParto(g.fecha_parto_estimada) : null
                const badge = GESTACION_ESTADO_BADGE[g.estado]
                return (
                  <div key={g.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>{GESTACION_ESTADO_LABEL[g.estado]}</span>
                          {g.nombre_toro && <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>🧬 Semilla: <strong>{g.nombre_toro}</strong></span>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: g.observaciones ? 12 : 0 }}>
                          <div className="info-item"><span className="info-label">Inseminación</span><span className="info-value">{formatFecha(g.fecha_inseminacion)}</span></div>
                          {g.fecha_parto_estimada && <div className="info-item"><span className="info-label">Parto estimado</span><span className="info-value">{formatFecha(g.fecha_parto_estimada)}</span></div>}
                          {g.fecha_parto_real && <div className="info-item"><span className="info-label">Parto real</span><span className="info-value" style={{ color: 'var(--green-600)', fontWeight: 600 }}>{formatFecha(g.fecha_parto_real)}</span></div>}
                          {semanas && <div className="info-item"><span className="info-label">Tiempo de gestación</span><span className="info-value" style={{ color: 'var(--blue-500)', fontWeight: 600 }}>{semanas}</span></div>}
                          {diasParto !== null && (
                            <div className="info-item">
                              <span className="info-label">Para el parto</span>
                              <span className="info-value" style={{ color: diasParto <= 14 ? 'var(--red-500)' : diasParto <= 30 ? 'var(--amber-500)' : 'var(--gray-700)', fontWeight: 600 }}>
                                {diasParto < 0 ? `Hace ${Math.abs(diasParto)} días` : diasParto === 0 ? '¡Hoy!' : `${diasParto} días`}
                              </span>
                            </div>
                          )}
                        </div>
                        {g.observaciones && (
                          <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '10px 12px', borderLeft: '3px solid var(--gray-300)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-400)', marginBottom: 4 }}>Observaciones</div>
                            <p style={{ fontSize: 13.5, color: 'var(--gray-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{g.observaciones}</p>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn-icon" title="Editar" onClick={() => { setEditingGestacion(g); setShowGestacionForm(true) }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn-icon" title="Eliminar" style={{ color: 'var(--red-500)' }} onClick={() => handleDeleteGestacion(g.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div>
          <div className="historial-header">
            <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{historial.length} registro{historial.length !== 1 ? 's' : ''}</div>
            <button className="btn btn-primary" onClick={() => setShowMedForm(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Añadir registro
            </button>
          </div>
          {historial.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">Sin registros médicos todavía</div></div>
          ) : (
            <div className="historial-list">
              {historial.map(r => {
                const fechaPrimaria = r.fecha_inicio || r.fecha
                const fi = parseFechaHistorial(fechaPrimaria)
                const ff = parseFechaHistorial(r.fecha_fin)
                return (
                  <div key={r.id} className="historial-item">
                    <div className="historial-date-col">
                      {fi ? (<><span className="historial-day">{fi.day}</span><span className="historial-month">{fi.month}</span><span className="historial-year">{fi.year}</span>{ff && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 4, textAlign: 'center', lineHeight: 1.3 }}>→ {ff.day} {ff.month} {ff.year}</span>}</>)
                        : ff ? (<><span style={{ fontSize: 10, color: 'var(--gray-400)', textAlign: 'center' }}>hasta</span><span className="historial-day">{ff.day}</span><span className="historial-month">{ff.month}</span><span className="historial-year">{ff.year}</span></>)
                        : <span style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'center' }}>Sin fecha</span>}
                    </div>
                    <div className="historial-divider" />
                    <div className="historial-body">
                      <div className="historial-tipo-row"><span className={`badge badge-${r.tipo}`}>{TIPO_LABEL[r.tipo]}</span></div>
                      {r.descripcion && <p className="historial-desc">{r.descripcion}</p>}
                      {r.veterinario && <p className="historial-vet">Veterinario: <strong>{r.veterinario}</strong></p>}
                    </div>
                    <button className="historial-del-btn" title="Eliminar registro" onClick={() => handleDeleteRegistro(r.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'genealogia' && (
        <div className="genealogy-tree">
          <div className="card">
            <div className="genea-section-title">Progenitores</div>
            <div className="genea-parent-row">
              {(animal.madre_id || animal.madre_crotal_ext || animal.madre_nombre_ext) ? (
                <div className={`genea-card ${animal.madre_id ? '' : 'empty'}`} style={animal.madre_id ? {} : { cursor: 'default' }} onClick={() => animal.madre_id && navigate(`/animales/${animal.madre_id}`)}>
                  <div className="genea-role">♀ Madre {animal.madre_id ? <span style={{ fontSize: 10, background: 'var(--green-100)', color: 'var(--green-700)', padding: '1px 6px', borderRadius: 99, fontWeight: 600, marginLeft: 4 }}>En cuadra</span> : <span style={{ fontSize: 10, background: 'var(--gray-100)', color: 'var(--gray-500)', padding: '1px 6px', borderRadius: 99, fontWeight: 600, marginLeft: 4 }}>Externa</span>}</div>
                  {(animal.madre_crotal || animal.madre_crotal_ext) && <div className="genea-crotal">{animal.madre_crotal || animal.madre_crotal_ext}</div>}
                  {(animal.madre_nombre || animal.madre_nombre_ext) && <div className="genea-nombre">{animal.madre_nombre || animal.madre_nombre_ext}</div>}
                </div>
              ) : (
                <div className="genea-card empty" style={{ cursor: 'default' }}><div className="genea-role">♀ Madre</div><div className="genea-nombre">No registrada</div></div>
              )}
              {(animal.padre_id || animal.padre_crotal_ext || animal.padre_nombre_ext) ? (
                <div className={`genea-card ${animal.padre_id ? '' : 'empty'}`} style={animal.padre_id ? {} : { cursor: 'default' }} onClick={() => animal.padre_id && navigate(`/animales/${animal.padre_id}`)}>
                  <div className="genea-role">♂ Padre {animal.padre_id ? <span style={{ fontSize: 10, background: 'var(--green-100)', color: 'var(--green-700)', padding: '1px 6px', borderRadius: 99, fontWeight: 600, marginLeft: 4 }}>En cuadra</span> : <span style={{ fontSize: 10, background: 'var(--gray-100)', color: 'var(--gray-500)', padding: '1px 6px', borderRadius: 99, fontWeight: 600, marginLeft: 4 }}>Externo</span>}</div>
                  {(animal.padre_crotal || animal.padre_crotal_ext) && <div className="genea-crotal">{animal.padre_crotal || animal.padre_crotal_ext}</div>}
                  {(animal.padre_nombre || animal.padre_nombre_ext) && <div className="genea-nombre">{animal.padre_nombre || animal.padre_nombre_ext}</div>}
                </div>
              ) : (
                <div className="genea-card empty" style={{ cursor: 'default' }}><div className="genea-role">♂ Padre</div><div className="genea-nombre">No registrado</div></div>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="genea-section-title" style={{ marginBottom: 0 }}>Descendencia ({descendencia.length})</div>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={handleAddDescendiente}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Añadir descendiente
              </button>
            </div>
            {descendencia.length === 0 ? (
              <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Sin descendencia registrada</div>
            ) : (
              <div className="descendencia-grid">
                {descendencia.map(d => (
                  <div key={d.id} className="desc-card" style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn-icon" style={{ width: 24, height: 24, background: 'var(--gray-100)' }} title="Editar" onClick={() => navigate(`/animales/${d.id}/editar`)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn-icon" style={{ width: 24, height: 24, background: 'var(--red-100)', color: 'var(--red-500)' }} title="Eliminar" onClick={() => setConfirmDeleteDesc(d.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                    <div onClick={() => navigate(`/animales/${d.id}`)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{d.sexo === 'macho' ? '♂' : d.sexo === 'hembra' ? '♀' : ''}</div>
                      <div className="genea-crotal">{d.crotal}</div>
                      {d.nombre && <div className="genea-nombre">{d.nombre}</div>}
                      <div style={{ marginTop: 6 }}><span className={`badge badge-${d.estado}`} style={{ fontSize: 10 }}>{ESTADO_LABEL_COMPLETO[d.estado] || d.estado}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'cuadra' && (
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <div className="info-label" style={{ marginBottom: 4 }}>Cuadra actual</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-800)', marginBottom: 20 }}>
              {granjas.find(g => g.id === animal.granja_id)?.nombre ?? <span style={{ color: 'var(--gray-400)', fontWeight: 400, fontStyle: 'italic' }}>Sin cuadra asignada</span>}
            </div>
            <div className="info-label" style={{ marginBottom: 12 }}>Selecciona la nueva cuadra</div>
            <div className="estado-opciones-grid">
              <button className={`estado-opcion ${!animal.granja_id ? 'estado-opcion--activo estado-opcion--fallecido' : ''}`} style={!animal.granja_id ? { borderColor: 'var(--gray-500)', background: 'var(--gray-100)', color: 'var(--gray-800)' } : {}} onClick={() => handleCambiarGranja(null)} disabled={savingGranja || !animal.granja_id}>
                <span className="estado-opcion-check">{!animal.granja_id && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</span>
                Sin cuadra
              </button>
              {granjas.map(g => (
                <button key={g.id} className={`estado-opcion ${animal.granja_id === g.id ? 'estado-opcion--activo estado-opcion--en_produccion' : ''}`} onClick={() => handleCambiarGranja(g.id)} disabled={savingGranja || animal.granja_id === g.id}>
                  <span className="estado-opcion-check">{animal.granja_id === g.id && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.6 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {g.nombre}
                </button>
              ))}
            </div>
            {granjas.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13, marginTop: 8 }}>No hay cuadras creadas todavía. Créalas desde el menú lateral.</div>}
          </div>
        </div>
      )}

      {showMedForm && <MedicalRecordForm animalId={Number(id)} onClose={() => setShowMedForm(false)} onSaved={(reg) => { setHistorial(h => [reg, ...h]); setShowMedForm(false) }} />}

      {showGestacionForm && (
        <GestacionForm
          animalId={Number(id)}
          gestacion={editingGestacion}
          onClose={() => { setShowGestacionForm(false); setEditingGestacion(null) }}
          onSaved={(g) => {
            setGestaciones(prev => editingGestacion ? prev.map(x => x.id === g.id ? g : x) : [g, ...prev])
            setShowGestacionForm(false)
            setEditingGestacion(null)
          }}
        />
      )}

      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Eliminar animal</div>
            <p className="confirm-text">¿Estás seguro de que quieres eliminar a <strong>{animal.nombre || animal.crotal}</strong>? Esta acción también eliminará todo su historial médico y no se puede deshacer.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmDelete(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteAnimal}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDesc !== null && (() => {
        const desc = descendencia.find(d => d.id === confirmDeleteDesc)
        return (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-title">Eliminar descendiente</div>
              <p className="confirm-text">¿Eliminar a <strong>{desc?.nombre || desc?.crotal}</strong>? Se borrará del registro general y de esta genealogía. Esta acción no se puede deshacer.</p>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDeleteDesc(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={async () => { await handleDeleteDescendiente(confirmDeleteDesc); setConfirmDeleteDesc(null) }}>Eliminar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
