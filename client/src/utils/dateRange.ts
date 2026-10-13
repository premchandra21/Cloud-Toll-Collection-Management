// <input type="date"> gives "YYYY-MM-DD". The API wants full timestamps, and "today" must mean
// today in the USER's timezone, so build them from local midnight.
function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m - 1, d]
}

// Start of that local day (inclusive).
export function startOfDayIso(date: string): string {
  const [y, m, d] = parts(date)
  return new Date(y, m, d).toISOString()
}

// Start of the NEXT local day, because the API treats `to` as exclusive and the user's end date as inclusive.
export function endOfDayIso(date: string): string {
  const [y, m, d] = parts(date)
  return new Date(y, m, d + 1).toISOString()
}