import ContinueWatching from '../components/ContinueWatching'
import Recommendations from '../components/Recommendations'
import Spotlight from '../components/Spotlight'
import { useDesign } from '../lib/design'
import '../styles/modern-browse.css'

export default function HomePage() {
  const design = useDesign()

  if (design === 'modern') {
    return (
      <div>
        <Spotlight />
        <ContinueWatching />
        <Recommendations />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Главная</h1>
      <Spotlight />
      <ContinueWatching />
      <Recommendations />
    </div>
  )
}
