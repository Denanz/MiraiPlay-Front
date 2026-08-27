import { useState } from 'react'
import { img } from '../lib/img'

interface Props {
  src?: string
  alt?: string
  className?: string
  /** классы для внутреннего <img> */
  imgClassName?: string
  /** гнать ли через прокси картинок, по умолчанию да */
  proxy?: boolean
}

// Картинка с мерцающей заглушкой и плавным появлением. Родитель держит размер,
// поэтому вёрстка не прыгает.
export default function Img({ src, alt = '', className = '', imgClassName = '', proxy = true }: Props) {
  const [loaded, setLoaded] = useState(false)
  const finalSrc = src ? (proxy ? img(src) : src) : ''
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-white/[0.05] animate-pulse" />}
      {finalSrc && (
        <img
          src={finalSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      )}
    </div>
  )
}
