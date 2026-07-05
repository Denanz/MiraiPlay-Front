import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { KodikQuality } from '../api/kodik'

interface Props {
  qualities: KodikQuality[]
  defaultLabel: string
  onProgress?: (percent: number) => void
}

export default function VideoPlayer({ qualities, defaultLabel, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel)
  const progressReported = useRef(false)

  const currentQuality = qualities.find(q => q.label === selectedLabel) || qualities[0]

  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentQuality) return

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = currentQuality.url

    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls()
        hls.loadSource(url)
        hls.attachMedia(video)
        hlsRef.current = hls
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
      }
    } else {
      video.src = url
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [currentQuality?.url])

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current
    if (!video || !onProgress) return

    const saveProgress = () => {
      if (video.duration && video.duration > 0) {
        const percent = (video.currentTime / video.duration) * 100
        onProgress(percent)
        if (percent >= 90 && !progressReported.current) {
          progressReported.current = true
        }
      }
    }

    const progressKey = `video_progress_${currentQuality?.url}`
    const saved = localStorage.getItem(progressKey)
    if (saved) {
      video.currentTime = parseFloat(saved)
    }

    const handleTimeUpdate = () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100
        localStorage.setItem(progressKey, String(video.currentTime))
        saveProgress()
        onProgress(percent)
      }
    }

    const interval = setInterval(handleTimeUpdate, 5000)
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      clearInterval(interval)
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [currentQuality?.url, onProgress])

  const handleFullscreen = () => {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  if (qualities.length === 0) {
    return <div className="text-gray-400 text-center py-8">Нет доступных потоков</div>
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full max-h-[70vh]"
        controls
        autoPlay
      />
      <div className="flex items-center gap-2 p-3 bg-card">
        <span className="text-sm text-gray-400 mr-2">Качество:</span>
        {qualities.map(q => (
          <button
            key={q.label}
            onClick={() => setSelectedLabel(q.label)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              selectedLabel === q.label
                ? 'bg-accent text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {q.label}
          </button>
        ))}
        <button
          onClick={handleFullscreen}
          className="ml-auto px-3 py-1 text-sm rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Полный экран
        </button>
      </div>
    </div>
  )
}
