import { supabase } from './supabase'

const ANIMAL_SELECT = `
  *,
  madre:madre_id (crotal, nombre),
  padre:padre_id (crotal, nombre)
`

const ESTADOS_ACTIVOS = ['en_produccion', 'seca', 'parida', 'ordenar_aparte']

const ANIMAL_COLUMNS = [
  'crotal', 'nombre', 'raza', 'fecha_nacimiento', 'sexo', 'peso',
  'estado', 'estado_desde', 'estado_hasta', 'tipo', 'partos', 'granja_id',
  'madre_id', 'madre_crotal_ext', 'madre_nombre_ext',
  'padre_id', 'padre_crotal_ext', 'padre_nombre_ext',
  'notas',
]

function flattenAnimal(a) {
  if (!a) return null
  const { madre, padre, ...rest } = a
  return {
    ...rest,
    madre_crotal: madre?.crotal ?? null,
    madre_nombre: madre?.nombre ?? null,
    padre_crotal: padre?.crotal ?? null,
    padre_nombre: padre?.nombre ?? null,
  }
}

function pickAnimalColumns(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => ANIMAL_COLUMNS.includes(k))
  )
}

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user.id
}

export const api = {
  // ---- Estadísticas ----
  getEstadisticas: async () => {
    const [
      { count: total },
      { count: activos },
      { count: vendidos },
      { count: fallecidos },
      { count: hembras },
      { count: machos },
      { data: razaData },
    ] = await Promise.all([
      supabase.from('animales').select('*', { count: 'exact', head: true }),
      supabase.from('animales').select('*', { count: 'exact', head: true }).in('estado', ESTADOS_ACTIVOS),
      supabase.from('animales').select('*', { count: 'exact', head: true }).eq('estado', 'vendido'),
      supabase.from('animales').select('*', { count: 'exact', head: true }).eq('estado', 'fallecido'),
      supabase.from('animales').select('*', { count: 'exact', head: true }).eq('sexo', 'hembra').in('estado', ESTADOS_ACTIVOS),
      supabase.from('animales').select('*', { count: 'exact', head: true }).eq('sexo', 'macho').in('estado', ESTADOS_ACTIVOS),
      supabase.from('animales').select('raza').in('estado', ESTADOS_ACTIVOS).not('raza', 'is', null).neq('raza', ''),
    ])

    const razaMap = {}
    razaData?.forEach(({ raza }) => { if (raza) razaMap[raza] = (razaMap[raza] || 0) + 1 })
    const razas = Object.entries(razaMap)
      .map(([raza, n]) => ({ raza, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)

    return { total, activos, vendidos, fallecidos, hembras, machos, razas }
  },

  // ---- Animales ----
  getAnimales: async ({ busqueda = '', estado = '', raza = '', granja_id = null } = {}) => {
    let q = supabase.from('animales').select(ANIMAL_SELECT).order('crotal', { ascending: true })

    if (busqueda) q = q.or(`crotal.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`)
    if (estado) q = q.eq('estado', estado)
    if (raza) q = q.eq('raza', raza)
    if (granja_id != null && granja_id !== '') q = q.eq('granja_id', Number(granja_id))

    const { data } = await q
    return (data || []).map(flattenAnimal)
  },

  getAnimal: async (id) => {
    const { data } = await supabase.from('animales').select(ANIMAL_SELECT).eq('id', id).single()
    return flattenAnimal(data)
  },

  getAnimalByCrotal: async (crotal) => {
    const { data } = await supabase.from('animales').select('*').eq('crotal', crotal).maybeSingle()
    return data
  },

  getAnimalByNombre: async (nombre) => {
    const { data } = await supabase.from('animales').select('*').ilike('nombre', nombre).maybeSingle()
    return data
  },

  createAnimal: async (data) => {
    const userId = await getUserId()
    const { data: result, error } = await supabase
      .from('animales')
      .insert({ ...pickAnimalColumns(data), user_id: userId })
      .select(ANIMAL_SELECT)
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('UNIQUE constraint failed: animales.crotal')
      throw error
    }
    return flattenAnimal(result)
  },

  updateAnimal: async (id, data) => {
    const { data: result, error } = await supabase
      .from('animales')
      .update({ ...pickAnimalColumns(data), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(ANIMAL_SELECT)
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('UNIQUE constraint failed: animales.crotal')
      throw error
    }
    return flattenAnimal(result)
  },

  deleteAnimal: async (id) => {
    await supabase.from('animales').delete().eq('id', id)
  },

  getDescendencia: async (id) => {
    const { data } = await supabase
      .from('animales')
      .select('id, crotal, nombre, sexo, fecha_nacimiento, estado')
      .or(`madre_id.eq.${id},padre_id.eq.${id}`)
      .order('fecha_nacimiento', { ascending: true })
    return data || []
  },

  getRazas: async () => {
    const { data } = await supabase
      .from('animales')
      .select('raza')
      .not('raza', 'is', null)
      .neq('raza', '')
      .order('raza')
    const unique = [...new Set(data?.map(r => r.raza).filter(Boolean))]
    return unique
  },

  getAnimalesParaSelector: async () => {
    const { data } = await supabase.from('animales').select('id, crotal, nombre, sexo').order('crotal')
    return data || []
  },

  // ---- Historial médico ----
  getHistorialMedico: async (animalId) => {
    const { data } = await supabase
      .from('historial_medico')
      .select('*')
      .eq('animal_id', animalId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
    return data || []
  },

  createRegistroMedico: async (data) => {
    const userId = await getUserId()
    const payload = {
      ...data,
      user_id: userId,
      fecha: data.fecha_inicio || data.fecha_fin || '',
    }
    const { data: result, error } = await supabase.from('historial_medico').insert(payload).select().single()
    if (error) throw error
    return result
  },

  deleteRegistroMedico: async (id) => {
    await supabase.from('historial_medico').delete().eq('id', id)
  },

  // ---- Gestaciones ----
  getGestaciones: async (animalId) => {
    const { data } = await supabase
      .from('gestaciones')
      .select('*')
      .eq('animal_id', animalId)
      .order('fecha_inseminacion', { ascending: false })
      .order('id', { ascending: false })
    return data || []
  },

  createGestacion: async (data) => {
    const userId = await getUserId()
    const { data: result, error } = await supabase
      .from('gestaciones')
      .insert({ ...data, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return result
  },

  updateGestacion: async (id, data) => {
    const { data: result, error } = await supabase
      .from('gestaciones')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return result
  },

  deleteGestacion: async (id) => {
    await supabase.from('gestaciones').delete().eq('id', id)
  },

  getAllGestacionesCalendario: async () => {
    const { data } = await supabase
      .from('gestaciones')
      .select(`*, animal:animal_id (crotal, nombre, granja_id)`)
      .eq('estado', 'en_curso')
      .not('fecha_parto_estimada', 'is', null)
      .order('fecha_parto_estimada', { ascending: true })
    return (data || []).map(g => ({
      ...g,
      crotal: g.animal?.crotal,
      animal_nombre: g.animal?.nombre,
      granja_id: g.animal?.granja_id,
    }))
  },

  getAnimalesConEstadoHasta: async () => {
    const { data } = await supabase
      .from('animales')
      .select('id, crotal, nombre, estado, estado_desde, estado_hasta, granja_id')
      .not('estado_hasta', 'is', null)
      .neq('estado_hasta', '')
      .order('estado_hasta', { ascending: true })
    return data || []
  },

  // ---- Granjas ----
  getGranjas: async () => {
    const { data } = await supabase.from('granjas').select('*').order('nombre')
    return data || []
  },

  getGranja: async (id) => {
    const { data } = await supabase.from('granjas').select('*').eq('id', id).single()
    return data
  },

  createGranja: async (data) => {
    const userId = await getUserId()
    const { data: result } = await supabase
      .from('granjas')
      .insert({ ...data, user_id: userId })
      .select()
      .single()
    return result
  },

  updateGranja: async (id, data) => {
    const { data: result } = await supabase
      .from('granjas')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    return result
  },

  deleteGranja: async (id) => {
    const { data: animalesGranja } = await supabase
      .from('animales')
      .select('id')
      .eq('granja_id', id)

    const animalIds = animalesGranja?.map(a => a.id) || []
    if (animalIds.length > 0) {
      await supabase.from('animales').update({ madre_id: null }).in('madre_id', animalIds)
      await supabase.from('animales').update({ padre_id: null }).in('padre_id', animalIds)
      await supabase.from('animales').delete().in('id', animalIds)
    }
    await supabase.from('granjas').delete().eq('id', id)
  },

  getAnimalesPorGranja: async () => {
    const [{ data: granjas }, { data: animales }] = await Promise.all([
      supabase.from('granjas').select('id, nombre').order('nombre'),
      supabase.from('animales').select('granja_id').not('granja_id', 'is', null),
    ])
    const countMap = {}
    animales?.forEach(({ granja_id }) => {
      countMap[granja_id] = (countMap[granja_id] || 0) + 1
    })
    return (granjas || []).map(g => ({
      id: g.id,
      nombre: g.nombre,
      total: countMap[g.id] || 0,
    }))
  },
}
