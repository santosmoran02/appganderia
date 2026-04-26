import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_LABEL_CAL = {
  en_produccion: 'En producción', seca: 'Seca', parida: 'Parida',
  ordenar_aparte: 'Ordeñar aparte', vendido: 'Vendido', fallecido: 'Fallecido',
}

function isoFecha(date) {
  return date.toISOString().split('T')[0]
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

function formatFechaCal(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function unificarEventos(partos, estadosHasta) {
  return [
    ...partos.map(e => ({ ...e, tipo: 'parto', fecha: e.fecha_parto_estimada })),
    ...estadosHasta.map(e => ({ ...e, tipo: 'estado', fecha: e.estado_hasta })),
  ]
}

function PopupEvento({ evento, onClose, onIr }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const esParto = evento.tipo === 'parto'
  const nombre = esParto ? (evento.animal_nombre || evento.crotal) : (evento.nombre || evento.crotal)
  const animalId = esParto ? evento.animal_id : evento.id

  return (
    <div className="cal-popup-overlay">
      <div className="cal-popup" ref={ref}>
        <div className="cal-popup-header">
          <span className="cal-popup-icon">{esParto ? '🐄' : '🔔'}</span>
          <div style={{ flex: 1 }}>
            <div className="cal-popup-nombre">{nombre}</div>
            <div className="cal-popup-crotal">#{evento.crotal}</div>
          </div>
          <button className="cal-popup-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="cal-popup-body">
          {esParto ? (
            <>
              <div className="cal-popup-row">
                <span className="cal-popup-label">Parto estimado</span>
                <span className="cal-popup-value">{formatFechaCal(evento.fecha_parto_estimada)}</span>
              </div>
              {evento.fecha_inseminacion && (
                <div className="cal-popup-row">
                  <span className="cal-popup-label">Fecha inseminación</span>
                  <span className="cal-popup-value">{formatFechaCal(evento.fecha_inseminacion)}</span>
                </div>
              )}
              {evento.nombre_toro && (
                <div className="cal-popup-row">
                  <span className="cal-popup-label">Semilla / toro</span>
                  <span className="cal-popup-value">{evento.nombre_toro}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="cal-popup-row">
                <span className="cal-popup-label">Fin de estado</span>
                <span className="cal-popup-value">{formatFechaCal(evento.estado_hasta)}</span>
              </div>
              {evento.estado && (
                <div className="cal-popup-row">
                  <span className="cal-popup-label">Estado</span>
                  <span className="cal-popup-value">{ESTADO_LABEL_CAL[evento.estado] || evento.estado}</span>
                </div>
              )}
              {evento.estado_desde && (
                <div className="cal-popup-row">
                  <span className="cal-popup-label">Inicio del estado</span>
                  <span className="cal-popup-value">{formatFechaCal(evento.estado_desde)}</span>
                </div>
              )}
            </>
          )}
        </div>
        <button className="cal-popup-btn" onClick={() => onIr(animalId)}>
          Ver ficha del animal →
        </button>
      </div>
    </div>
  )
}

function EventoItem({ evento, onSelect }) {
  const esParto = evento.tipo === 'parto'
  return (
    <div
      className={`cal-evento ${esParto ? '' : 'cal-evento--estado'}`}
      onClick={(e) => { e.stopPropagation(); onSelect(evento) }}
    >
      <span className="cal-evento-icon">{esParto ? '🐄' : '🔔'}</span>
      <span className="cal-evento-label">
        {esParto ? (evento.animal_nombre || evento.crotal) : (evento.nombre || evento.crotal)}
      </span>
    </div>
  )
}

function VistaAnual({ eventos, año, onNavigate, onSelect }) {
  const porMes = {}
  for (let m = 0; m < 12; m++) porMes[m] = []
  eventos.forEach(e => {
    const d = new Date(e.fecha + 'T00:00:00')
    if (d.getFullYear() === año) porMes[d.getMonth()].push(e)
  })

  return (
    <div>
      <div className="cal-nav">
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="cal-nav-title">{año}</span>
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="cal-anual-grid">
        {MESES.map((mes, idx) => {
          const evts = porMes[idx]
          const nPartos = evts.filter(e => e.tipo === 'parto').length
          const nEstados = evts.filter(e => e.tipo === 'estado').length
          return (
            <div key={idx} className={`cal-mes-card ${evts.length > 0 ? 'cal-mes-card--activo' : ''}`}>
              <div className="cal-mes-header">
                <span className="cal-mes-nombre">{mes}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {nPartos > 0 && <span className="cal-mes-badge">{nPartos} parto{nPartos !== 1 ? 's' : ''}</span>}
                  {nEstados > 0 && <span className="cal-mes-badge cal-mes-badge--estado">{nEstados} estado{nEstados !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              {evts.length === 0 ? (
                <div className="cal-mes-vacio">Sin eventos</div>
              ) : (
                <div className="cal-mes-eventos">
                  {evts.map((e, i) => {
                    const d = new Date(e.fecha + 'T00:00:00')
                    const nombre = e.tipo === 'parto' ? (e.animal_nombre || e.crotal) : (e.nombre || e.crotal)
                    return (
                      <div key={i} className="cal-mes-evento-row" onClick={() => onSelect(e)}>
                        <span className="cal-mes-evento-dia">{d.getDate()}</span>
                        <span className="cal-mes-evento-icon">{e.tipo === 'parto' ? '🐄' : '🔔'}</span>
                        <span className="cal-mes-evento-animal">{nombre}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VistaMensual({ eventos, fecha, onNavigate, onSelect }) {
  const año = fecha.getFullYear()
  const mes = fecha.getMonth()
  const diasEnMes = new Date(año, mes + 1, 0).getDate()
  let startDow = new Date(año, mes, 1).getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const hoy = isoFecha(new Date())

  const porDia = {}
  eventos.forEach(e => {
    const d = new Date(e.fecha + 'T00:00:00')
    if (d.getFullYear() === año && d.getMonth() === mes) {
      const k = d.getDate()
      if (!porDia[k]) porDia[k] = []
      porDia[k].push(e)
    }
  })

  const celdas = [...Array(startDow).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)]

  return (
    <div>
      <div className="cal-nav">
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="cal-nav-title">{MESES[mes]} {año}</span>
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="cal-mensual">
        <div className="cal-semana-header">
          {DIAS_SEMANA.map(d => <div key={d} className="cal-semana-header-dia">{d}</div>)}
        </div>
        <div className="cal-mensual-grid">
          {celdas.map((dia, i) => {
            if (!dia) return <div key={`e${i}`} className="cal-dia cal-dia--vacio" />
            const fechaDia = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const evts = porDia[dia] || []
            return (
              <div key={dia} className={`cal-dia ${fechaDia === hoy ? 'cal-dia--hoy' : ''} ${evts.length > 0 ? 'cal-dia--tiene-eventos' : ''}`}>
                <div className="cal-dia-numero">{dia}</div>
                <div className="cal-dia-eventos">
                  {evts.map((e, i) => <EventoItem key={i} evento={e} onSelect={onSelect} />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function VistaSemanal({ eventos, fecha, onNavigate, onSelect }) {
  const lunes = startOfWeek(fecha)
  const dias = Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  const hoy = isoFecha(new Date())
  const lunesStr = lunes.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const domingoStr = dias[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const porDia = {}
  dias.forEach(d => { porDia[isoFecha(d)] = [] })
  eventos.forEach(e => { if (porDia[e.fecha]) porDia[e.fecha].push(e) })

  return (
    <div>
      <div className="cal-nav">
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(-7)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="cal-nav-title">{lunesStr} — {domingoStr}</span>
        <button className="btn btn-secondary cal-nav-btn" onClick={() => onNavigate(7)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="cal-semanal-grid">
        {dias.map((d, i) => {
          const iso = isoFecha(d)
          const evts = porDia[iso] || []
          return (
            <div key={iso} className={`cal-semana-dia ${iso === hoy ? 'cal-semana-dia--hoy' : ''}`}>
              <div className="cal-semana-dia-header">
                <span className="cal-semana-dow">{DIAS_SEMANA[i]}</span>
                <span className={`cal-semana-num ${iso === hoy ? 'cal-semana-num--hoy' : ''}`}>{d.getDate()}</span>
                <span className="cal-semana-mes">{MESES[d.getMonth()].substring(0, 3)}</span>
              </div>
              <div className="cal-semana-dia-body">
                {evts.length === 0
                  ? <div className="cal-semana-vacio">—</div>
                  : evts.map((e, i) => <EventoItem key={i} evento={e} onSelect={onSelect} />)
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Calendar() {
  const navigate = useNavigate()
  const [vista, setVista] = useState('mes')
  const [fecha, setFecha] = useState(new Date())
  const [partos, setPartos] = useState([])
  const [estadosHasta, setEstadosHasta] = useState([])
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)

  useEffect(() => {
    api.getAllGestacionesCalendario().then(setPartos)
    api.getAnimalesConEstadoHasta().then(setEstadosHasta)
  }, [])

  const eventos = unificarEventos(partos, estadosHasta)

  const handleNav = (delta) => {
    setFecha(prev => {
      const d = new Date(prev)
      if (vista === 'semana') d.setDate(d.getDate() + delta)
      else if (vista === 'mes') d.setMonth(d.getMonth() + delta)
      else d.setFullYear(d.getFullYear() + delta)
      return d
    })
  }

  return (
    <div>
      <div className="cal-page-header">
        <div>
          <h1 className="cal-titulo">Calendario</h1>
          <p className="cal-subtitulo">
            {partos.length} parto{partos.length !== 1 ? 's' : ''} · {estadosHasta.length} fin{estadosHasta.length !== 1 ? 'es' : ''} de estado
          </p>
        </div>
        <div className="cal-controles">
          <button className="btn btn-secondary" onClick={() => setFecha(new Date())}>Hoy</button>
          <div className="cal-vista-toggle">
            {[['semana', 'Semana'], ['mes', 'Mes'], ['año', 'Año']].map(([v, l]) => (
              <button key={v} className={`cal-vista-btn ${vista === v ? 'cal-vista-btn--activo' : ''}`} onClick={() => setVista(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cal-leyenda-item"><span className="cal-leyenda-dot cal-leyenda-dot--parto" />Parto estimado</div>
        <div className="cal-leyenda-item"><span className="cal-leyenda-dot cal-leyenda-dot--estado" />Fin de estado</div>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {vista === 'semana' && <VistaSemanal eventos={eventos} fecha={fecha} onNavigate={handleNav} onSelect={setEventoSeleccionado} />}
        {vista === 'mes' && <VistaMensual eventos={eventos} fecha={fecha} onNavigate={handleNav} onSelect={setEventoSeleccionado} />}
        {vista === 'año' && <VistaAnual eventos={eventos} año={fecha.getFullYear()} onNavigate={handleNav} onSelect={setEventoSeleccionado} />}
      </div>

      {eventoSeleccionado && (
        <PopupEvento
          evento={eventoSeleccionado}
          onClose={() => setEventoSeleccionado(null)}
          onIr={(id) => { setEventoSeleccionado(null); navigate(`/animales/${id}`) }}
        />
      )}
    </div>
  )
}
