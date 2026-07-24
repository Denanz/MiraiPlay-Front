import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import ThemePicker from '../components/ThemePicker'
import DesignPicker from '../components/DesignPicker'
import ListBackup from '../components/ListBackup'
import NotifySettings from '../components/NotifySettings'
import ShikimoriSettings from '../components/ShikimoriSettings'
import ShikimoriMigrate from '../components/ShikimoriMigrate'
import FeedbackForm from '../components/FeedbackForm'
import { APP_VERSION } from '../lib/changelog'
import { useDesign } from '../lib/design'

export default function SettingsPage() {
  const { session } = useAuth()
  const modern = useDesign() === 'modern'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Настройки</h1>
      <DesignPicker />
      <ThemePicker />
      {session && <NotifySettings />}
      {session && <ShikimoriSettings />}
      {session && <ShikimoriMigrate />}
      <ListBackup />
      <FeedbackForm />

      <Link
        to="/changelog"
        className={
          modern
            ? 'mdk-glass mdk-pad flex items-center justify-between hover:border-accent/40 transition-colors'
            : 'panel p-5 flex items-center justify-between hover:border-accent/40 transition-colors'
        }
      >
        <div>
          <h2 className="text-base font-semibold">История изменений</h2>
          <p className="text-xs text-muted mt-0.5">Что нового в каждой версии приложения</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-muted shrink-0">
          v{APP_VERSION}
          <span className="text-lg leading-none">›</span>
        </span>
      </Link>
    </div>
  )
}
