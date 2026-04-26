-- ============================================================
-- GanadApp — Schema para Supabase
-- Pega esto en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Granjas
CREATE TABLE IF NOT EXISTS granjas (
  id        BIGSERIAL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Animales
CREATE TABLE IF NOT EXISTS animales (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crotal           TEXT NOT NULL,
  nombre           TEXT,
  raza             TEXT,
  fecha_nacimiento TEXT,
  sexo             TEXT CHECK(sexo IN ('macho', 'hembra')),
  peso             REAL,
  estado           TEXT DEFAULT 'en_produccion'
                   CHECK(estado IN ('en_produccion','seca','parida','ordenar_aparte','vendido','fallecido')),
  estado_desde     TEXT,
  estado_hasta     TEXT,
  tipo             TEXT,
  partos           INTEGER,
  granja_id        BIGINT REFERENCES granjas(id) ON DELETE SET NULL,
  madre_id         BIGINT REFERENCES animales(id) ON DELETE SET NULL,
  madre_crotal_ext TEXT,
  madre_nombre_ext TEXT,
  padre_id         BIGINT REFERENCES animales(id) ON DELETE SET NULL,
  padre_crotal_ext TEXT,
  padre_nombre_ext TEXT,
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, crotal)
);

CREATE INDEX IF NOT EXISTS idx_animales_estado ON animales(estado);
CREATE INDEX IF NOT EXISTS idx_animales_user   ON animales(user_id);

-- Historial médico
CREATE TABLE IF NOT EXISTS historial_medico (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id  BIGINT NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK(tipo IN ('vacuna','tratamiento','revision','desparasitacion','analisis','cirugia')),
  fecha      TEXT,
  fecha_inicio TEXT,
  fecha_fin    TEXT,
  descripcion  TEXT,
  veterinario  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_animal ON historial_medico(animal_id);

-- Gestaciones
CREATE TABLE IF NOT EXISTS gestaciones (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animal_id            BIGINT NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  fecha_inseminacion   TEXT NOT NULL,
  fecha_parto_estimada TEXT,
  fecha_parto_real     TEXT,
  nombre_toro          TEXT,
  estado               TEXT DEFAULT 'en_curso'
                       CHECK(estado IN ('en_curso','parto_exitoso','aborto','reabsorcion')),
  observaciones        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gestaciones_animal ON gestaciones(animal_id);

-- ============================================================
-- Row Level Security (cada usuario solo ve sus propios datos)
-- ============================================================

ALTER TABLE granjas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE animales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_medico ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestaciones    ENABLE ROW LEVEL SECURITY;

-- Granjas
CREATE POLICY "granjas_select" ON granjas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "granjas_insert" ON granjas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "granjas_update" ON granjas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "granjas_delete" ON granjas FOR DELETE USING (auth.uid() = user_id);

-- Animales
CREATE POLICY "animales_select" ON animales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "animales_insert" ON animales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "animales_update" ON animales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "animales_delete" ON animales FOR DELETE USING (auth.uid() = user_id);

-- Historial médico
CREATE POLICY "historial_select" ON historial_medico FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "historial_insert" ON historial_medico FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "historial_update" ON historial_medico FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "historial_delete" ON historial_medico FOR DELETE USING (auth.uid() = user_id);

-- Gestaciones
CREATE POLICY "gestaciones_select" ON gestaciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gestaciones_insert" ON gestaciones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gestaciones_update" ON gestaciones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "gestaciones_delete" ON gestaciones FOR DELETE USING (auth.uid() = user_id);
