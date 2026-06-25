import { api } from '../api'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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

const ESTADO_LABEL_INVERSO = Object.fromEntries(Object.entries(ESTADO_LABEL).map(([k, v]) => [v, k]))
const GESTACION_ESTADO_LABEL_INVERSO = Object.fromEntries(Object.entries(GESTACION_ESTADO_LABEL).map(([k, v]) => [v, k]))

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

function desdeAnsi(bytes) {
  // BOM UTF-8 al principio => el archivo se reguardó con otra herramienta en UTF-8
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3))
  }
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

function parsearCSV(texto) {
  // quita la línea "sep=;" si está presente y parsea respetando comillas
  const t = texto.replace(/^sep=.\r?\n/, '')
  const filas = []
  let fila = [], campo = '', dentroComillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (dentroComillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else dentroComillas = false }
      else campo += c
    } else if (c === '"') dentroComillas = true
    else if (c === ';') { fila.push(campo); campo = '' }
    else if (c === '\r') { /* ignorar, el \n que sigue cierra la fila */ }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }

  const [cabecera, ...resto] = filas.filter(f => f.length > 1 || f[0] !== '')
  if (!cabecera) return []
  return resto.map(fila => Object.fromEntries(cabecera.map((h, i) => [h, fila[i] ?? ''])))
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
  const [animales, historial, gestaciones, granjas] = await Promise.all([
    api.getAnimales(),
    api.getAllHistorialMedico(),
    api.getAllGestaciones(),
    api.getGranjas(),
  ])
  const granjaNombre = id => granjas.find(g => g.id === id)?.nombre ?? ''

  const zip = new JSZip()
  zip.file('animales.csv', aAnsi(crearCSV(
    ['Crotal', 'Nombre', 'Tipo', 'Raza', 'Sexo', 'Estado', 'Fecha Nacimiento', 'Peso (kg)', 'Partos', 'Madre Crotal', 'Madre Nombre', 'Padre Crotal', 'Padre Nombre', 'Notas', 'Granja', 'Estado Desde', 'Estado Hasta'],
    animales.map(a => [a.crotal, a.nombre, a.tipo, a.raza, a.sexo, ESTADO_LABEL[a.estado] ?? a.estado, a.fecha_nacimiento, a.peso, a.partos, a.madre_crotal, a.madre_nombre, a.padre_crotal, a.padre_nombre, a.notas, granjaNombre(a.granja_id), a.estado_desde, a.estado_hasta])
  )))
  zip.file('historial_medico.csv', aAnsi(crearCSV(
    ['Crotal Animal', 'Nombre Animal', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Descripción', 'Veterinario'],
    historial.map(h => [h.animal?.crotal, h.animal?.nombre, h.tipo, h.fecha_inicio, h.fecha_fin, h.descripcion, h.veterinario])
  )))
  zip.file('gestaciones.csv', aAnsi(crearCSV(
    ['Crotal Animal', 'Nombre Animal', 'Fecha Inseminación', 'Fecha Parto Estimada', 'Fecha Parto Real', 'Toro / Semilla', 'Estado', 'Observaciones', 'Fecha Secado Estimada'],
    gestaciones.map(g => [g.animal?.crotal, g.animal?.nombre, g.fecha_inseminacion, g.fecha_parto_estimada, g.fecha_parto_real, g.nombre_toro, GESTACION_ESTADO_LABEL[g.estado] ?? g.estado, g.observaciones, g.fecha_secado_estimada])
  )))

  const blob = await zip.generateAsync({ type: 'blob' })
  descargar(blob, `ganadapp-backup-${new Date().toISOString().slice(0, 10)}.zip`)
}

function numeroOVacio(valor) {
  const v = (valor || '').trim()
  if (v === '' || isNaN(Number(v))) return null
  return Number(v)
}

function resolverEtiqueta(valor, mapaInverso, mapaDirecto, porDefecto = null) {
  const v = (valor || '').trim()
  if (!v) return porDefecto
  if (mapaInverso[v] != null) return mapaInverso[v]
  if (mapaDirecto[v] != null) return v
  return v
}

async function leerCSVDelZip(zip, nombre) {
  const entrada = zip.file(nombre)
  if (!entrada) return []
  return parsearCSV(desdeAnsi(await entrada.async('uint8array')))
}

async function importarBackupCSV(file) {
  const zip = await JSZip.loadAsync(file)
  const [filasAnimales, filasHistorial, filasGestaciones] = await Promise.all([
    leerCSVDelZip(zip, 'animales.csv'),
    leerCSVDelZip(zip, 'historial_medico.csv'),
    leerCSVDelZip(zip, 'gestaciones.csv'),
  ])
  const [granjas, historialExistente, gestacionesExistentes] = await Promise.all([
    api.getGranjas(),
    api.getAllHistorialMedico(),
    api.getAllGestaciones(),
  ])

  const avisos = []
  const granjaPorNombre = new Map(granjas.map(g => [g.nombre.trim().toLowerCase(), g.id]))
  const resolverGranjaId = async (nombre) => {
    const n = (nombre || '').trim()
    if (!n) return null
    const clave = n.toLowerCase()
    if (granjaPorNombre.has(clave)) return granjaPorNombre.get(clave)
    const creada = await api.createGranja({ nombre: n })
    granjaPorNombre.set(clave, creada.id)
    return creada.id
  }

  // ---- Animales: paso 1, upsert por crotal ----
  const crotalAId = new Map()
  let animalesCreados = 0, animalesActualizados = 0

  for (const fila of filasAnimales) {
    const crotal = (fila['Crotal'] || '').trim()
    if (!crotal) { avisos.push('Hay una fila de animales.csv sin crotal; se omitió.'); continue }
    try {
      const payload = {
        crotal,
        nombre: (fila['Nombre'] || '').trim() || null,
        tipo: (fila['Tipo'] || '').trim() || null,
        raza: (fila['Raza'] || '').trim() || null,
        sexo: (fila['Sexo'] || '').trim() || null,
        estado: resolverEtiqueta(fila['Estado'], ESTADO_LABEL_INVERSO, ESTADO_LABEL, 'en_produccion'),
        fecha_nacimiento: (fila['Fecha Nacimiento'] || '').trim() || null,
        peso: numeroOVacio(fila['Peso (kg)']),
        partos: numeroOVacio(fila['Partos']),
        notas: (fila['Notas'] || '').trim() || null,
        granja_id: await resolverGranjaId(fila['Granja']),
        estado_desde: (fila['Estado Desde'] || '').trim() || null,
        estado_hasta: (fila['Estado Hasta'] || '').trim() || null,
        madre_id: null,
        madre_crotal_ext: (fila['Madre Crotal'] || '').trim() || null,
        madre_nombre_ext: (fila['Madre Nombre'] || '').trim() || null,
        padre_id: null,
        padre_crotal_ext: (fila['Padre Crotal'] || '').trim() || null,
        padre_nombre_ext: (fila['Padre Nombre'] || '').trim() || null,
      }

      const existente = await api.getAnimalByCrotal(crotal)
      if (existente) {
        await api.updateAnimal(existente.id, payload)
        crotalAId.set(crotal, existente.id)
        animalesActualizados++
      } else {
        const creado = await api.createAnimal(payload)
        crotalAId.set(crotal, creado.id)
        animalesCreados++
      }
    } catch (err) {
      avisos.push(`Animal ${crotal}: ${err.message || 'no se pudo guardar'}`)
    }
  }

  // ---- Animales: paso 2, enlazar madre/padre ahora que todos existen ----
  for (const fila of filasAnimales) {
    const crotal = (fila['Crotal'] || '').trim()
    const id = crotalAId.get(crotal)
    if (!id) continue
    const madreCrotal = (fila['Madre Crotal'] || '').trim()
    const padreCrotal = (fila['Padre Crotal'] || '').trim()
    if (!madreCrotal && !padreCrotal) continue
    try {
      const cambios = {}
      if (madreCrotal) {
        const madreId = crotalAId.get(madreCrotal) ?? (await api.getAnimalByCrotal(madreCrotal))?.id
        if (madreId) cambios.madre_id = madreId
      }
      if (padreCrotal) {
        const padreId = crotalAId.get(padreCrotal) ?? (await api.getAnimalByCrotal(padreCrotal))?.id
        if (padreId) cambios.padre_id = padreId
      }
      if (Object.keys(cambios).length) await api.updateAnimal(id, cambios)
    } catch (err) {
      avisos.push(`No se pudo enlazar la genealogía de ${crotal}: ${err.message || 'error'}`)
    }
  }

  const resolverAnimalId = async (crotal) => {
    const c = (crotal || '').trim()
    if (!c) return null
    if (crotalAId.has(c)) return crotalAId.get(c)
    const encontrado = await api.getAnimalByCrotal(c)
    const id = encontrado?.id ?? null
    crotalAId.set(c, id)
    return id
  }

  // ---- Historial médico: se añade como nuevo, deduplicando por contenido ----
  const claveHistorial = h => `${h.tipo || ''}|${h.fecha_inicio || ''}|${h.fecha_fin || ''}|${(h.descripcion || '').trim()}`
  const historialVistos = new Set(historialExistente.map(h => `${h.animal_id}|${claveHistorial(h)}`))
  let historialCreados = 0, historialOmitidos = 0

  for (const fila of filasHistorial) {
    const animalId = await resolverAnimalId(fila['Crotal Animal'])
    if (!animalId) {
      avisos.push(`Historial médico: no se encontró ningún animal con crotal "${fila['Crotal Animal']}"; se omitió.`)
      historialOmitidos++
      continue
    }
    const payload = {
      animal_id: animalId,
      tipo: (fila['Tipo'] || '').trim() || 'revision',
      fecha_inicio: (fila['Fecha Inicio'] || '').trim() || null,
      fecha_fin: (fila['Fecha Fin'] || '').trim() || null,
      descripcion: (fila['Descripción'] || '').trim() || null,
      veterinario: (fila['Veterinario'] || '').trim() || null,
    }
    const clave = `${animalId}|${claveHistorial(payload)}`
    if (historialVistos.has(clave)) { historialOmitidos++; continue }
    try {
      await api.createRegistroMedico(payload)
      historialVistos.add(clave)
      historialCreados++
    } catch (err) {
      avisos.push(`Historial médico de ${fila['Crotal Animal']}: ${err.message || 'no se pudo guardar'}`)
    }
  }

  // ---- Gestaciones: se añaden como nuevas, deduplicando por contenido ----
  const claveGestacion = g => `${g.fecha_inseminacion || ''}|${g.estado || ''}|${(g.nombre_toro || '').trim()}`
  const gestacionesVistas = new Set(gestacionesExistentes.map(g => `${g.animal_id}|${claveGestacion(g)}`))
  let gestacionesCreadas = 0, gestacionesOmitidas = 0

  for (const fila of filasGestaciones) {
    const animalId = await resolverAnimalId(fila['Crotal Animal'])
    if (!animalId) {
      avisos.push(`Gestación: no se encontró ningún animal con crotal "${fila['Crotal Animal']}"; se omitió.`)
      gestacionesOmitidas++
      continue
    }
    const payload = {
      animal_id: animalId,
      fecha_inseminacion: (fila['Fecha Inseminación'] || '').trim() || null,
      fecha_secado_estimada: (fila['Fecha Secado Estimada'] || '').trim() || null,
      fecha_parto_estimada: (fila['Fecha Parto Estimada'] || '').trim() || null,
      fecha_parto_real: (fila['Fecha Parto Real'] || '').trim() || null,
      nombre_toro: (fila['Toro / Semilla'] || '').trim() || null,
      estado: resolverEtiqueta(fila['Estado'], GESTACION_ESTADO_LABEL_INVERSO, GESTACION_ESTADO_LABEL, 'en_curso'),
      observaciones: (fila['Observaciones'] || '').trim() || null,
    }
    if (!payload.fecha_inseminacion) {
      avisos.push(`Gestación de ${fila['Crotal Animal']}: sin fecha de inseminación; se omitió.`)
      gestacionesOmitidas++
      continue
    }
    const clave = `${animalId}|${claveGestacion(payload)}`
    if (gestacionesVistas.has(clave)) { gestacionesOmitidas++; continue }
    try {
      await api.createGestacion(payload)
      gestacionesVistas.add(clave)
      gestacionesCreadas++
    } catch (err) {
      avisos.push(`Gestación de ${fila['Crotal Animal']}: ${err.message || 'no se pudo guardar'}`)
    }
  }

  return { animalesCreados, animalesActualizados, historialCreados, historialOmitidos, gestacionesCreadas, gestacionesOmitidas, avisos }
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

export default function AnimalList({ onGranjaChange }) {
  const [animales, setAnimales] = useState([])
  const [razas, setRazas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [raza, setRaza] = useState('')
  const [loading, setLoading] = useState(true)
  const [restaurando, setRestaurando] = useState(false)
  const [resultadoRestauracion, setResultadoRestauracion] = useState(null)
  const fileInputRef = useRef(null)
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

  const handleArchivoRestauracion = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const confirmado = window.confirm(
      'Vas a restaurar una copia de seguridad.\n\n' +
      '- Los animales que ya existan (mismo crotal) se actualizarán con los datos del archivo.\n' +
      '- Los registros médicos y de gestación se añadirán como nuevos: si subes la misma copia dos veces, se detectan y no se duplican mientras el contenido sea idéntico.\n\n' +
      '¿Quieres continuar?'
    )
    if (!confirmado) return

    setRestaurando(true)
    setResultadoRestauracion(null)
    try {
      const resumen = await importarBackupCSV(file)
      setResultadoRestauracion({ tipo: 'ok', resumen })
      cargar()
      api.getRazas().then(setRazas)
      onGranjaChange?.()
    } catch (err) {
      setResultadoRestauracion({ tipo: 'error', mensaje: err.message || 'No se pudo leer el archivo. Asegúrate de subir un ZIP de copia de seguridad generado por GanadApp.' })
    } finally {
      setRestaurando(false)
    }
  }

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
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={restaurando}
            title="Restaurar una copia de seguridad (sube el .zip exportado desde GanadApp)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {restaurando ? 'Restaurando...' : 'Restaurar copia'}
          </button>
          <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleArchivoRestauracion} />
        </div>
      </div>

      {resultadoRestauracion && (
        <div
          style={{
            background: resultadoRestauracion.tipo === 'ok' ? 'var(--green-50)' : 'var(--red-100)',
            border: `1px solid ${resultadoRestauracion.tipo === 'ok' ? 'var(--green-100)' : 'var(--red-500)'}`,
            borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13,
            color: resultadoRestauracion.tipo === 'ok' ? 'var(--green-700)' : '#991b1b',
            display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between',
          }}
        >
          <div>
            {resultadoRestauracion.tipo === 'ok' ? (
              <>
                <strong>Copia restaurada.</strong> Animales: {resultadoRestauracion.resumen.animalesCreados} creados, {resultadoRestauracion.resumen.animalesActualizados} actualizados.
                {' '}Historial médico: {resultadoRestauracion.resumen.historialCreados} añadidos{resultadoRestauracion.resumen.historialOmitidos ? `, ${resultadoRestauracion.resumen.historialOmitidos} omitidos` : ''}.
                {' '}Gestaciones: {resultadoRestauracion.resumen.gestacionesCreadas} añadidas{resultadoRestauracion.resumen.gestacionesOmitidas ? `, ${resultadoRestauracion.resumen.gestacionesOmitidas} omitidas` : ''}.
                {resultadoRestauracion.resumen.avisos.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {resultadoRestauracion.resumen.avisos.slice(0, 5).map((a, i) => <li key={i}>{a}</li>)}
                    {resultadoRestauracion.resumen.avisos.length > 5 && <li>y {resultadoRestauracion.resumen.avisos.length - 5} más...</li>}
                  </ul>
                )}
              </>
            ) : (
              <><strong>No se pudo restaurar la copia.</strong> {resultadoRestauracion.mensaje}</>
            )}
          </div>
          <button onClick={() => setResultadoRestauracion(null)} className="btn btn-secondary" style={{ padding: '4px 10px', flexShrink: 0 }}>Cerrar</button>
        </div>
      )}

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
