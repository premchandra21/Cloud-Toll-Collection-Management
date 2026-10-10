import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateVehicle, useUpdateVehicle } from '../../hooks/useVehicles'
import { VEHICLE_TYPE_LABELS } from '../../types/vehicle'
import type { Vehicle, VehicleType } from '../../types/vehicle'
import { getErrorMessage } from '../../utils/getErrorMessage'

interface FormValues {
  vehicleNumber: string
  vehicleType: VehicleType
  rfidTag: string
}

interface Props {
  vehicle?: Vehicle // present = edit mode
  onDone: () => void
}

// Used for both "Add vehicle" and "Edit vehicle".
export default function VehicleForm({ vehicle, onDone }: Props) {
  const create = useCreateVehicle()
  const update = useUpdateVehicle()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      vehicleNumber: vehicle?.vehicleNumber ?? '',
      vehicleType: vehicle?.vehicleType ?? 'CAR',
      rfidTag: vehicle?.rfidTag ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      if (vehicle) {
        await update.mutateAsync({ id: vehicle.id, input: values })
      } else {
        await create.mutateAsync(values)
        reset({ vehicleNumber: '', vehicleType: 'CAR', rfidTag: '' })
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
        Vehicle number
        <input
          placeholder="OD02AB1234"
          {...register('vehicleNumber', { required: 'Vehicle number is required' })}
        />
        {errors.vehicleNumber && <span className="error">{errors.vehicleNumber.message}</span>}
      </label>

      <label>
        Vehicle type
        <select {...register('vehicleType', { required: true })}>
          {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((t) => (
            <option key={t} value={t}>
              {VEHICLE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label>
        RFID tag
        <input
          placeholder="RFID-0004"
          {...register('rfidTag', { required: 'RFID tag is required' })}
        />
        {errors.rfidTag && <span className="error">{errors.rfidTag.message}</span>}
      </label>

      <div className="form__actions">
        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : vehicle ? 'Save changes' : 'Add vehicle'}
        </button>
        {vehicle && (
          <button type="button" className="btn btn--ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}