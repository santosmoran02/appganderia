import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'

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

const GESTACION_ESTADO_LABEL = {
  en_curso: 'En curso',
  parto_exitoso: 'Parto exitoso',
  aborto: 'Aborto',
  reabsorcion: 'Reabsorción',
}

function crearCSV(encabezados, filas) {
  // Excel en español usa ';' como separador de columnas (la ',' es el decimal),
  // así que sin esto los datos aparecen amontonados en una sola columna.
  return 'sep=;\r\n' + [encabezados, ...filas]
    .map(fila => fila.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
}

function aAnsi(texto) {
  // Al abrir un CSV con doble clic, Excel ignora el BOM UTF-8 y lo lee como
  // ANSI (Windows-1252), lo que rompe las tildes. Codificamos directamente en
  // Windows-1252 (coincide con Latin-1 para los caracteres del español) para
  // que se vean bien sin depender de que Excel respete el BOM.
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i)
    bytes[i] = code <= 0xff ? code : 0x3f
  }
  return bytes
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

async function exportarBackupCSV() {
  const [animales, historial, gestaciones] = await Promise.all([
    api.getAnimales(),
    api.getAllHistorialMedico(),
    api.getAllGestaciones(),
  ])

  const zip = new JSZip()
  zip.file('animales.csv', aAnsi(crearCSV(
    ['Crotal', 'Nombre', 'Tipo', 'Raza', 'Sexo', 'Estado', 'Fecha Nacimiento', 'Peso (kg)', 'Partos', 'Madre Crotal', 'Madre Nombre', 'Padre Crotal', 'Padre Nombre', 'Notas'],
    animales.map(a => [a.crotal, a.nombre, a.tipo, a.raza, a.sexo, ESTADO_LABEL[a.estado] ?? a.estado, a.fecha_nacimiento, a.peso, a.partos, a.madre_crotal, a.madre_nombre, a.padre_crotal, a.padre_nombre, a.notas])
  )))
  zip.file('historial_medico.csv', aAnsi(crearCSV(
    ['Crotal Animal', 'Nombre Animal', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Descripción', 'Veterinario'],
    historial.map(h => [h.animal?.crotal, h.animal?.nombre, h.tipo, h.fecha_inicio, h.fecha_fin, h.descripcion, h.veterinario])
  )))
  zip.file('gestaciones.csv', aAnsi(crearCSV(
    ['Crotal Animal', 'Nombre Animal', 'Fecha Inseminación', 'Fecha Parto Estimada', 'Fecha Parto Real', 'Toro / Semilla', 'Estado', 'Observaciones'],
    gestaciones.map(g => [g.animal?.crotal, g.animal?.nombre, g.fecha_inseminacion, g.fecha_parto_estimada, g.fecha_parto_real, g.nombre_toro, GESTACION_ESTADO_LABEL[g.estado] ?? g.estado, g.observaciones])
  )))

  const blob = await zip.generateAsync({ type: 'blob' })
  descargar(blob, `ganadapp-backup-${new Date().toISOString().slice(0, 10)}.zip`)
}

async function exportarBackupPDF() {
  const [animales, historial, gestaciones] = await Promise.all([
    api.getAnimales(),
    api.getAllHistorialMedico(),
    api.getAllGestaciones(),
  ])

  const doc = new jsPDF({ orientation: 'landscape' })
  const fecha = new Date().toLocaleDateString('es-ES')
  const tableStyle = { fontSize: 8 }
  const headStyle = { fillColor: [22, 163, 74] }

  // Sección 1: Animales
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text('GanadApp — Copia de seguridad', 14, 14)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Exportado el ${fecha}`, 14, 20)
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Animales (${animales.length})`, 14, 29)
  autoTable(doc, {
    startY: 33,
    head: [['Crotal', 'Nombre', 'Tipo', 'Estado', 'Raza', 'Sexo', 'Edad', 'Peso', 'Partos', 'Madre', 'Padre', 'Notas']],
    body: animales.map(a => [
      a.crotal ?? '', a.nombre ?? '',
      a.tipo ? a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1) : '',
      ESTADO_LABEL[a.estado] ?? a.estado ?? '',
      a.raza ?? '',
      a.sexo === 'macho' ? 'Macho' : a.sexo === 'hembra' ? 'Hembra' : '',
      calcularEdad(a.fecha_nacimiento),
      a.peso ? `${a.peso} kg` : '',
      a.partos ?? '',
      [a.madre_crotal, a.madre_nombre].filter(Boolean).join(' ') || '',
      [a.padre_crotal, a.padre_nombre].filter(Boolean).join(' ') || '',
      a.notas ?? '',
    ]),
    styles: tableStyle,
    headStyles: headStyle,
  })

  // Sección 2: Historial médico
  doc.addPage()
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Historial médico (${historial.length} registros)`, 14, 14)
  autoTable(doc, {
    startY: 18,
    head: [['Crotal', 'Nombre Animal', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Descripción', 'Veterinario']],
    body: historial.map(h => [
      h.animal?.crotal ?? '', h.animal?.nombre ?? '',
      h.tipo ?? '', h.fecha_inicio ?? '', h.fecha_fin ?? '',
      h.descripcion ?? '', h.veterinario ?? '',
    ]),
    styles: tableStyle,
    headStyles: headStyle,
    columnStyles: { 5: { cellWidth: 80 } },
  })

  // Sección 3: Gestaciones
  doc.addPage()
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Gestaciones (${gestaciones.length} registros)`, 14, 14)
  autoTable(doc, {
    startY: 18,
    head: [['Crotal', 'Nombre Animal', 'F. Inseminación', 'F. Parto Estimada', 'F. Parto Real', 'Toro / Semilla', 'Estado', 'Observaciones']],
    body: gestaciones.map(g => [
      g.animal?.crotal ?? '', g.animal?.nombre ?? '',
      g.fecha_inseminacion ?? '', g.fecha_parto_estimada ?? '', g.fecha_parto_real ?? '',
      g.nombre_toro ?? '',
      GESTACION_ESTADO_LABEL[g.estado] ?? g.estado ?? '',
      g.observaciones ?? '',
    ]),
    styles: tableStyle,
    headStyles: headStyle,
    columnStyles: { 7: { cellWidth: 60 } },
  })

  descargar(
    new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }),
    `ganadapp-backup-${new Date().toISOString().slice(0, 10)}.pdf`
  )
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
            className="btn btn-secondary"
            onClick={exportarBackupCSV}
            title="Copia de seguridad en CSV (ZIP con animales, historial médico y gestaciones)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Copia CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportarBackupPDF}
            title="Copia de seguridad en PDF (animales, historial médico y gestaciones)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Copia PDF
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
