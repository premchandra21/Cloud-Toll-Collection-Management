import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreatePlaza, useUpdatePlaza } from '../../hooks/usePlazas'
import type { Plaza } from '../../types/plaza'
import { getErrorMessage } from '../../utils/getErrorMessage'

interface FormValues {
  name: string
  code: string
  location: string
}

interface Props {
  plaza?: Plaza // present = edit mode
  onDone: () => void
}

// Used for both "Add plaza" and "Edit plaza".
export default function PlazaForm({ plaza, onDone }: Props) {
  const create = useCreatePlaza()
  const update = useUpdatePlaza()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: plaza?.name ?? '',
      code: plaza?.code ?? '',
      location: plaza?.location ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      if (plaza) {
        await update.mutateAsync({ id: plaza.id, input: values })
      } else {
        await create.mutateAsync(values)
        reset({ name: '', code: '', location: '' })
      }
      onDone()
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form form--inline">
      {serverError && <div className="alert alert--error">{serverError}</div>}

      <label>
        Plaza name
        <input
          placeholder="Puri Plaza"
          {...register('name', { required: 'Plaza name is required' })}
        />
        {errors.name && <span className="error">{errors.name.message}</span>}
      </label>

      <label>
        Code
        <input placeholder="PUR-01" {...register('code', { required: 'Code is required' })} />
        {errors.code && <span className="error">{errors.code.message}</span>}
      </label>

      <label>
        Location
        <input
          placeholder="NH-316, Puri"
          {...register('location', { required: 'Location is required' })}
        />
        {errors.location && <span className="error">{errors.location.message}</span>}
      </label>

      <div className="form__actions">
        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : plaza ? 'Save changes' : 'Add plaza'}
        </button>
        {plaza && (
          <button type="button" className="btn btn--ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}