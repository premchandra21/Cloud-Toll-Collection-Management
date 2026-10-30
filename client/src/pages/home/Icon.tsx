import type { ReactNode } from 'react'

const PATHS: Record<string, ReactNode> = {
  wallet: (<><path d="M3 7a2 2 0 0 1 2-2h13v3" /><rect x="3" y="7" width="18" height="12" rx="2" /><circle cx="16.5" cy="13" r="1" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  bell: (<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  ledger: (<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  check: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  monitor: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  layers: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  database: (<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  radio: (<><circle cx="12" cy="12" r="2" /><path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9M4.5 4.5a10 10 0 0 0 0 15M19.5 4.5a10 10 0 0 1 0 15" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  car: (<><path d="M3 15v-3l2-5h14l2 5v3z" /><circle cx="7.5" cy="16.5" r="1.5" /><circle cx="16.5" cy="16.5" r="1.5" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>),
}

export default function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
