import { useForm } from 'react-hook-form'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  // Placeholder: real login is wired up in Slice 3 (Auth module)
  const onSubmit = (values: LoginForm) => {
    console.log('Login submitted (not connected yet):', values.email)
    alert('Login will be connected in the Auth slice.')
  }

  return (
    <div className="auth-card card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
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
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'At least 6 characters' },
            })}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        <button type="submit" className="btn">
          Sign in
        </button>
      </form>
    </div>
  )
}