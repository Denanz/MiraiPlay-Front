import { useState } from 'react'
import { img } from '../lib/img'

interface Props {
  src?: string
  alt?: string
  className?: string
  /** classes for the inner <img> (e.g. hover scale) */
  imgClassName?: string
  /** route through the image proxy (default true) */
  proxy?: boolean
}

// Image with a shimmering placeholder + fade-in on load. Avoids layout shift
// (parent reserves the box) and the "pop" of images snapping in.
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
