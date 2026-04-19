const path = require('path')
const { app } = require('electron')

let db

function getDb() {
  if (db) return db

  const Database = require('better-sqlite3')
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'ganadapp.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema()
  return db
}

function addColumnIfMissing(table, column, type) {
  const exists = db.prepare(`SELECT COUNT(*) as n FROM pragma_table_info('${table}') WHERE name = ?`).get(column).n
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  }
}

function initSchema() {
  // Tablas base (sin columnas _ext — se añaden abajo para admitir bases de datos ya existentes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS animales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crotal TEXT NOT NULL UNIQUE,
      nombre TEXT,
      raza TEXT,
      fecha_nacimiento TEXT,
      sexo TEXT CHECK(sexo IN ('macho', 'hembra')),
      peso REAL,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'vendido', 'fallecido')),
      madre_id INTEGER REFERENCES animales(id) ON DELETE SET NULL,
      padre_id INTEGER REFERENCES animales(id) ON DELETE SET NULL,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historial_medico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      animal_id INTEGER NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK(tipo IN ('vacuna', 'tratamiento', 'revision', 'desparasitacion', 'analisis', 'cirugia')),
      fecha TEXT NOT NULL,
      descripcion TEXT,
      veterinario TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gestaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      animal_id INTEGER NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
      fecha_inseminacion TEXT NOT NULL,
      fecha_parto_estimada TEXT,
      nombre_toro TEXT,
      estado TEXT DEFAULT 'en_curso' CHECK(estado IN ('en_curso', 'parto_exitoso', 'aborto', 'reabsorcion')),
      observaciones TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS granjas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_animales_crotal ON animales(crotal);
    CREATE INDEX IF NOT EXISTS idx_animales_estado ON animales(estado);
    CREATE INDEX IF NOT EXISTS idx_historial_animal ON historial_medico(animal_id);
    CREATE INDEX IF NOT EXISTS idx_gestaciones_animal ON gestaciones(animal_id);
  `)

  // Migraciones acumulativas — seguras de ejecutar varias veces
  addColumnIfMissing('animales', 'madre_crotal_ext', 'TEXT')
  addColumnIfMissing('animales', 'madre_nombre_ext', 'TEXT')
  addColumnIfMissing('animales', 'padre_crotal_ext', 'TEXT')
  addColumnIfMissing('animales', 'padre_nombre_ext', 'TEXT')
  addColumnIfMissing('gestaciones', 'fecha_parto_real', 'TEXT')
  addColumnIfMissing('historial_medico', 'fecha_inicio', 'TEXT')
  addColumnIfMissing('historial_medico', 'fecha_fin', 'TEXT')
  // Migrar fecha existente → fecha_inicio para registros anteriores
  db.exec("UPDATE historial_medico SET fecha_inicio = fecha WHERE fecha_inicio IS NULL AND fecha IS NOT NULL AND fecha != ''")

  // Migrar estado 'activo' → nuevos estados de producción
  migrateEstadoProduccion()

  addColumnIfMissing('animales', 'estado_desde', 'TEXT')
  addColumnIfMissing('animales', 'estado_hasta', 'TEXT')
  addColumnIfMissing('animales', 'granja_id', 'INTEGER')
  addColumnIfMissing('animales', 'tipo', 'TEXT')
  addColumnIfMissing('animales', 'partos', 'INTEGER')
}

function migrateEstadoProduccion() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='animales'").get()
  if (!row || !row.sql || !row.sql.includes("'activo'")) return

  db.pragma('foreign_keys = OFF')
  const doMigrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE animales_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crotal TEXT NOT NULL UNIQUE,
        nombre TEXT,
        raza TEXT,
        fecha_nacimiento TEXT,
        sexo TEXT CHECK(sexo IN ('macho', 'hembra')),
        peso REAL,
        estado TEXT DEFAULT 'en_produccion' CHECK(estado IN ('en_produccion','seca','parida','ordenar_aparte','vendido','fallecido')),
        estado_desde TEXT,
        estado_hasta TEXT,
        madre_id INTEGER REFERENCES animales(id) ON DELETE SET NULL,
        padre_id INTEGER REFERENCES animales(id) ON DELETE SET NULL,
        notas TEXT,
        madre_crotal_ext TEXT,
        madre_nombre_ext TEXT,
        padre_crotal_ext TEXT,
        padre_nombre_ext TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
    const cols = db.prepare('PRAGMA table_info(animales)').all().map(c => c.name)
    const extCols = cols.includes('madre_crotal_ext')
      ? 'madre_crotal_ext, madre_nombre_ext, padre_crotal_ext, padre_nombre_ext'
      : 'NULL, NULL, NULL, NULL'
    db.exec(`
      INSERT INTO animales_new
        (id, crotal, nombre, raza, fecha_nacimiento, sexo, peso,
         estado, estado_desde, estado_hasta,
         madre_id, padre_id, notas,
         madre_crotal_ext, madre_nombre_ext, padre_crotal_ext, padre_nombre_ext,
         created_at, updated_at)
      SELECT id, crotal, nombre, raza, fecha_nacimiento, sexo, peso,
        CASE WHEN estado = 'activo' THEN 'en_produccion' ELSE estado END,
        NULL, NULL,
        madre_id, padre_id, notas,
        ${extCols},
        created_at, updated_at
      FROM animales
    `)
    db.exec('DROP TABLE animales')
    db.exec('ALTER TABLE animales_new RENAME TO animales')
    db.exec('CREATE INDEX IF NOT EXISTS idx_animales_crotal ON animales(crotal)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_animales_estado ON animales(estado)')
  })
  doMigrate()
  db.pragma('foreign_keys = ON')
}

// ---- Animales ----

function getEstadisticas() {
  const db = getDb()
  const total = db.prepare('SELECT COUNT(*) as n FROM animales').get().n
  const activos = db.prepare("SELECT COUNT(*) as n FROM animales WHERE estado NOT IN ('vendido','fallecido')").get().n
  const vendidos = db.prepare("SELECT COUNT(*) as n FROM animales WHERE estado = 'vendido'").get().n
  const fallecidos = db.prepare("SELECT COUNT(*) as n FROM animales WHERE estado = 'fallecido'").get().n
  const hembras = db.prepare("SELECT COUNT(*) as n FROM animales WHERE sexo = 'hembra' AND estado NOT IN ('vendido','fallecido')").get().n
  const machos = db.prepare("SELECT COUNT(*) as n FROM animales WHERE sexo = 'macho' AND estado NOT IN ('vendido','fallecido')").get().n
  const razas = db.prepare("SELECT raza, COUNT(*) as n FROM animales WHERE estado NOT IN ('vendido','fallecido') AND raza IS NOT NULL GROUP BY raza ORDER BY n DESC LIMIT 5").all()
  return { total, activos, vendidos, fallecidos, hembras, machos, razas }
}

function getAnimales({ busqueda = '', estado = '', raza = '', granja_id = null } = {}) {
  const db = getDb()
  let sql = `
    SELECT a.*,
      m.crotal as madre_crotal, m.nombre as madre_nombre,
      p.crotal as padre_crotal, p.nombre as padre_nombre
    FROM animales a
    LEFT JOIN animales m ON a.madre_id = m.id
    LEFT JOIN animales p ON a.padre_id = p.id
    WHERE 1=1
  `
  const params = []

  if (busqueda) {
    sql += ` AND (a.crotal LIKE ? OR a.nombre LIKE ?)`
    params.push(`%${busqueda}%`, `%${busqueda}%`)
  }
  if (estado) {
    sql += ` AND a.estado = ?`
    params.push(estado)
  }
  if (raza) {
    sql += ` AND a.raza = ?`
    params.push(raza)
  }
  if (granja_id !== null && granja_id !== undefined && granja_id !== '') {
    sql += ` AND a.granja_id = ?`
    params.push(Number(granja_id))
  }

  sql += ` ORDER BY a.crotal ASC`
  return db.prepare(sql).all(...params)
}

function getAnimal(id) {
  const db = getDb()
  const animal = db.prepare(`
    SELECT a.*,
      m.crotal as madre_crotal, m.nombre as madre_nombre,
      p.crotal as padre_crotal, p.nombre as padre_nombre
    FROM animales a
    LEFT JOIN animales m ON a.madre_id = m.id
    LEFT JOIN animales p ON a.padre_id = p.id
    WHERE a.id = ?
  `).get(id)
  return animal
}

function getAnimalByCrotal(crotal) {
  const db = getDb()
  return db.prepare('SELECT * FROM animales WHERE crotal = ?').get(crotal)
}

function getAnimalByNombre(nombre) {
  const db = getDb()
  return db.prepare('SELECT * FROM animales WHERE lower(nombre) = lower(?)').get(nombre)
}

function createAnimal(data) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO animales (crotal, nombre, raza, fecha_nacimiento, sexo, peso, estado,
      estado_desde, estado_hasta, granja_id, tipo, partos,
      madre_id, madre_crotal_ext, madre_nombre_ext,
      padre_id, padre_crotal_ext, padre_nombre_ext, notas)
    VALUES (@crotal, @nombre, @raza, @fecha_nacimiento, @sexo, @peso, @estado,
      @estado_desde, @estado_hasta, @granja_id, @tipo, @partos,
      @madre_id, @madre_crotal_ext, @madre_nombre_ext,
      @padre_id, @padre_crotal_ext, @padre_nombre_ext, @notas)
  `)
  const result = stmt.run(data)
  return getAnimal(result.lastInsertRowid)
}

function updateAnimal(id, data) {
  const db = getDb()
  db.prepare(`
    UPDATE animales SET
      crotal = @crotal, nombre = @nombre, raza = @raza,
      fecha_nacimiento = @fecha_nacimiento, sexo = @sexo, peso = @peso,
      estado = @estado, estado_desde = @estado_desde, estado_hasta = @estado_hasta,
      granja_id = @granja_id, tipo = @tipo, partos = @partos,
      madre_id = @madre_id, madre_crotal_ext = @madre_crotal_ext, madre_nombre_ext = @madre_nombre_ext,
      padre_id = @padre_id, padre_crotal_ext = @padre_crotal_ext, padre_nombre_ext = @padre_nombre_ext,
      notas = @notas, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id })
  return getAnimal(id)
}

function deleteAnimal(id) {
  const db = getDb()
  db.prepare('DELETE FROM animales WHERE id = ?').run(id)
}

function getDescendencia(id) {
  const db = getDb()
  return db.prepare(`
    SELECT id, crotal, nombre, sexo, fecha_nacimiento, estado
    FROM animales
    WHERE madre_id = ? OR padre_id = ?
    ORDER BY fecha_nacimiento ASC
  `).all(id, id)
}

function getRazas() {
  const db = getDb()
  return db.prepare("SELECT DISTINCT raza FROM animales WHERE raza IS NOT NULL AND raza != '' ORDER BY raza").all().map(r => r.raza)
}

function getAnimalesParaSelector() {
  const db = getDb()
  return db.prepare("SELECT id, crotal, nombre, sexo FROM animales ORDER BY crotal ASC").all()
}

// ---- Historial médico ----

function getHistorialMedico(animalId) {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM historial_medico
    WHERE animal_id = ?
    ORDER BY fecha DESC, id DESC
  `).all(animalId)
}

function createRegistroMedico(data) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO historial_medico (animal_id, tipo, fecha, fecha_inicio, fecha_fin, descripcion, veterinario)
    VALUES (@animal_id, @tipo, @fecha, @fecha_inicio, @fecha_fin, @descripcion, @veterinario)
  `)
  const result = stmt.run({
    ...data,
    // fecha mantiene compatibilidad con la columna NOT NULL del esquema original
    fecha: data.fecha_inicio || data.fecha_fin || '',
  })
  return db.prepare('SELECT * FROM historial_medico WHERE id = ?').get(result.lastInsertRowid)
}

function deleteRegistroMedico(id) {
  const db = getDb()
  db.prepare('DELETE FROM historial_medico WHERE id = ?').run(id)
}

// ---- Gestaciones ----

function getGestaciones(animalId) {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM gestaciones
    WHERE animal_id = ?
    ORDER BY fecha_inseminacion DESC, id DESC
  `).all(animalId)
}

function createGestacion(data) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO gestaciones (animal_id, fecha_inseminacion, fecha_parto_estimada, fecha_parto_real, nombre_toro, estado, observaciones)
    VALUES (@animal_id, @fecha_inseminacion, @fecha_parto_estimada, @fecha_parto_real, @nombre_toro, @estado, @observaciones)
  `).run(data)
  return db.prepare('SELECT * FROM gestaciones WHERE id = ?').get(result.lastInsertRowid)
}

function updateGestacion(id, data) {
  const db = getDb()
  db.prepare(`
    UPDATE gestaciones SET
      fecha_inseminacion = @fecha_inseminacion,
      fecha_parto_estimada = @fecha_parto_estimada,
      fecha_parto_real = @fecha_parto_real,
      nombre_toro = @nombre_toro,
      estado = @estado,
      observaciones = @observaciones
    WHERE id = @id
  `).run({ ...data, id })
  return db.prepare('SELECT * FROM gestaciones WHERE id = ?').get(id)
}

function deleteGestacion(id) {
  const db = getDb()
  db.prepare('DELETE FROM gestaciones WHERE id = ?').run(id)
}

function getAnimalesConEstadoHasta() {
  const db = getDb()
  return db.prepare(`
    SELECT id, crotal, nombre, estado, estado_desde, estado_hasta, granja_id
    FROM animales
    WHERE estado_hasta IS NOT NULL AND estado_hasta != ''
    ORDER BY estado_hasta ASC
  `).all()
}

function getAnimalesPorGranja() {
  const db = getDb()
  return db.prepare(`
    SELECT g.id, g.nombre, COUNT(a.id) as total
    FROM granjas g
    LEFT JOIN animales a ON a.granja_id = g.id
    GROUP BY g.id, g.nombre
    ORDER BY g.nombre ASC
  `).all()
}

function getAllGestacionesCalendario() {
  const db = getDb()
  return db.prepare(`
    SELECT g.id, g.animal_id, g.fecha_inseminacion, g.fecha_parto_estimada,
           g.fecha_parto_real, g.nombre_toro, g.estado, g.observaciones,
           a.crotal, a.nombre as animal_nombre, a.granja_id
    FROM gestaciones g
    JOIN animales a ON g.animal_id = a.id
    WHERE g.estado = 'en_curso' AND g.fecha_parto_estimada IS NOT NULL
    ORDER BY g.fecha_parto_estimada ASC
  `).all()
}

// ---- Granjas ----

function getGranjas() {
  const db = getDb()
  return db.prepare('SELECT * FROM granjas ORDER BY nombre ASC').all()
}

function getGranja(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM granjas WHERE id = ?').get(id)
}

function createGranja(data) {
  const db = getDb()
  const result = db.prepare('INSERT INTO granjas (nombre) VALUES (@nombre)').run(data)
  return getGranja(result.lastInsertRowid)
}

function updateGranja(id, data) {
  const db = getDb()
  db.prepare('UPDATE granjas SET nombre = @nombre WHERE id = @id').run({ ...data, id })
  return getGranja(id)
}

function deleteGranja(id) {
  const db = getDb()
  const doDelete = db.transaction(() => {
    const ids = db.prepare('SELECT id FROM animales WHERE granja_id = ?').all(id).map(a => a.id)
    for (const animalId of ids) {
      db.prepare('DELETE FROM historial_medico WHERE animal_id = ?').run(animalId)
      db.prepare('DELETE FROM gestaciones WHERE animal_id = ?').run(animalId)
      db.prepare('UPDATE animales SET madre_id = NULL WHERE madre_id = ?').run(animalId)
      db.prepare('UPDATE animales SET padre_id = NULL WHERE padre_id = ?').run(animalId)
      db.prepare('DELETE FROM animales WHERE id = ?').run(animalId)
    }
    db.prepare('DELETE FROM granjas WHERE id = ?').run(id)
  })
  doDelete()
}

module.exports = {
  getEstadisticas,
  getAnimales,
  getAnimal,
  getAnimalByCrotal,
  getAnimalByNombre,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  getDescendencia,
  getRazas,
  getAnimalesParaSelector,
  getHistorialMedico,
  createRegistroMedico,
  deleteRegistroMedico,
  getGestaciones,
  createGestacion,
  updateGestacion,
  deleteGestacion,
  getAnimalesConEstadoHasta,
  getAnimalesPorGranja,
  getAllGestacionesCalendario,
  getGranjas,
  getGranja,
  createGranja,
  updateGranja,
  deleteGranja,
}
