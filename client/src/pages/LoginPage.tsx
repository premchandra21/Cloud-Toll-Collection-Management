import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { getErrorMessage } from '../utils/getErrorMessage'
import { roleHome } from '../utils/roleHome'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>()

  const from = (location.state as { from?: string } | null)?.from

  // Already logged in (or just logged in): go to the page they wanted, else their dashboard
  if (user) return <Navigate to={from ?? roleHome(user.role)} replace />

  const onSubmit = async (values: LoginForm) => {
    setServerError(null)
    try {
      await login(values)
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="auth-card card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        {serverError && <div className="alert alert--error">{serverError}</div>}

        <label>
          Email
          <input
            type="email"
            placeholder="you@example.com"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <span className="error">{errors.email.message}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="••••••••"
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="auth-card__footer">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </div>
  )
}