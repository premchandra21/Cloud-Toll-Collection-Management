import { useState } from 'react'
import Icon from './Icon'

// Shows a photo from /public/images. If the file is missing the box stays tidy (grey panel + icon),
// so the page never shows a broken-image symbol.
export default function Photo({ file, alt, className = '' }: { file: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = `${import.meta.env.BASE_URL}images/${file}`
  return (
    <figure className={`lp-photo ${className}`}>
      {failed ? (
        <div className="lp-photo__empty" role="img" aria-label={alt}>
          <Icon name="image" size={34} />
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </figure>
  )
}
