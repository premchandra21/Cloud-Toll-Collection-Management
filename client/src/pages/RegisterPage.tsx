import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { getErrorMessage } from '../utils/getErrorMessage'
import { roleHome } from '../utils/roleHome'

interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const { user, register: registerUser } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>()

  if (user) return <Navigate to={roleHome(user.role)} replace />

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null)
    try {
      await registerUser({ name: values.name, email: values.email, password: values.password })
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="auth-card card">
      <h2>Create account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        {serverError && <div className="alert alert--error">{serverError}</div>}

        <label>
          Full name
          <input
            type="text"
            placeholder="Your name"
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'At least 2 characters' },
            })}
          />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </label>

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
            placeholder="At least 8 characters"
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
            })}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        <label>
          Confirm password
          <input
            type="password"
            placeholder="Repeat password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) => v === getValues('password') || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && (
            <span className="error">{errors.confirmPassword.message}</span>
          )}
        </label>

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <p className="auth-card__footer">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}