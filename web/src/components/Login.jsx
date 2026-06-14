import { useState } from 'react'
import { supabase } from '../supabase'

export function UpdatePassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      onDone()
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🐄</div>
          <h1 className="login-title">GanadApp</h1>
          <p className="login-subtitle">Establece tu nueva contraseña</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              minLength={6}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setError(''); setSuccess(''); setPassword(''); setConfirmPassword('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden.')
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Cuenta creada. Revisa tu correo para confirmar el registro antes de iniciar sesión.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        })
        if (error) throw error
        setSuccess('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo.')
      }
    } catch (err) {
      const msgs = {
        'Invalid login credentials': 'Email o contraseña incorrectos.',
        'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
        'User already registered': 'Ya existe una cuenta con ese email.',
      }
      setError(msgs[err.message] || err.message)
    } finally {
      setLoading(false)
    }
  }

  const subtitles = { login: 'Inicia sesión en tu cuenta', register: 'Crea una cuenta nueva', forgot: 'Recupera tu contraseña' }
  const buttonLabels = { login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Enviar enlace' }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🐄</div>
          <h1 className="login-title">GanadApp</h1>
          <p className="login-subtitle">{subtitles[mode]}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group" style={{ marginBottom: mode === 'register' ? 16 : 24 }}>
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={6}
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
            disabled={loading}
          >
            {loading ? 'Cargando...' : buttonLabels[mode]}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' && (
            <>
              <button className="login-switch-btn" style={{ display: 'block', margin: '0 auto 8px' }} onClick={() => { setMode('forgot'); reset() }}>
                ¿Olvidaste tu contraseña?
              </button>
              ¿No tienes cuenta?{' '}
              <button className="login-switch-btn" onClick={() => { setMode('register'); reset() }}>
                Regístrate
              </button>
            </>
          )}
          {mode === 'register' && (
            <>
              ¿Ya tienes cuenta?{' '}
              <button className="login-switch-btn" onClick={() => { setMode('login'); reset() }}>
                Inicia sesión
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button className="login-switch-btn" onClick={() => { setMode('login'); reset() }}>
              Volver al inicio de sesión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
