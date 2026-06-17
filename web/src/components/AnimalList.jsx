import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

function exportarCSV(animales) {
  const encabezados = [
    'Crotal', 'Nombre', 'Tipo', 'Raza', 'Sexo', 'Estado',
    'Fecha Nacimiento', 'Edad', 'Peso (kg)', 'Partos',
    'Madre Crotal', 'Madre Nombre', 'Padre Crotal', 'Padre Nombre', 'Notas',
  ]
  const filas = animales.map(a => [
    a.crotal ?? '',
    a.nombre ?? '',
    a.tipo ?? '',
    a.raza ?? '',
    a.sexo ?? '',
    ESTADO_LABEL[a.estado] ?? a.estado ?? '',
    a.fecha_nacimiento ?? '',
    calcularEdad(a.fecha_nacimiento),
    a.peso ?? '',
    a.partos ?? '',
    a.madre_crotal ?? '',
    a.madre_nombre ?? '',
    a.padre_crotal ?? '',
    a.padre_nombre ?? '',
    a.notas ?? '',
  ])
  const csv = [encabezados, ...filas]
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ganadapp-animales-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportarPDF(animales) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(16)
  doc.text('GanadApp — Lista de animales', 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(
    `Exportado el ${new Date().toLocaleDateString('es-ES')} · ${animales.length} animal${animales.length !== 1 ? 'es' : ''}`,
    14, 23
  )
  autoTable(doc, {
    startY: 28,
    head: [['Crotal', 'Nombre', 'Tipo', 'Estado', 'Raza', 'Sexo', 'Edad', 'Peso']],
    body: animales.map(a => [
      a.crotal ?? '',
      a.nombre ?? '',
      a.tipo ? a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1) : '',
      ESTADO_LABEL[a.estado] ?? a.estado ?? '',
      a.raza ?? '',
      a.sexo === 'macho' ? 'Macho' : a.sexo === 'hembra' ? 'Hembra' : '',
      calcularEdad(a.fecha_nacimiento),
      a.peso ? `${a.peso} kg` : '',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 163, 74] },
  })
  doc.save(`ganadapp-animales-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default function AnimalList() {
  const [animales, setAnimales] = useState([])
  const [razas, setRazas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [raza, setRaza] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const cargar = useCallback(() => {
    setLoading(true)
    api.getAnimales({ busqueda, estado, raza }).then(data => {
      setAnimales(data)
      setLoading(false)
    })
  }, [busqueda, estado, raza])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    api.getRazas().then(setRazas)
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Animales</h1>
          <p className="page-subtitle">{animales.length} animal{animales.length !== 1 ? 'es' : ''} encontrado{animales.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => exportarCSV(animales)}
            disabled={animales.length === 0}
            title="Exportar como CSV"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => exportarPDF(animales)}
            disabled={animales.length === 0}
            title="Exportar como PDF"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF
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
          <div className="empty-state-text">No se encontraron animales</div>
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
    </div>
  )
}
