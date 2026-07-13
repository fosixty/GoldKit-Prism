import { ABOUT_TEXT, GOLDKIT_URL, LOG_LEVELS } from '@shared/constants'
import type { Preferences } from '@shared/types'
import { ExternalLink, FolderOpen, X } from 'lucide-react'

interface SettingsPanelProps {
  preferences: Preferences
  onChange: (prefs: Partial<Preferences>) => void
  onClose: () => void
}

export default function SettingsPanel({ preferences, onChange, onClose }: SettingsPanelProps) {
  const handleBrowseDefaultOutput = async () => {
    const dir = await window.prism.openOutputDir()
    if (dir) {
      onChange({ defaultOutputDir: dir })
    }
  }

  const handleOpenGoldKit = async () => {
    await window.prism.openExternal(GOLDKIT_URL)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="panel w-full max-w-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-goldkit-muted hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="defaultOutput" className="mb-1 block text-sm text-goldkit-muted">
              Default Output Folder
            </label>
            <div className="flex gap-2">
              <input
                id="defaultOutput"
                type="text"
                readOnly
                value={preferences.defaultOutputDir}
                placeholder="No default folder selected"
                className="w-full rounded-lg border border-goldkit-border bg-goldkit-bg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleBrowseDefaultOutput}
                className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={preferences.autoOrganize}
              onChange={(e) => onChange({ autoOrganize: e.target.checked })}
              className="rounded border-goldkit-border"
            />
            Auto-organize exports by session name
          </label>

          <div>
            <label htmlFor="logLevel" className="mb-1 block text-sm text-goldkit-muted">
              Logging Level
            </label>
            <select
              id="logLevel"
              value={preferences.logLevel}
              onChange={(e) => onChange({ logLevel: e.target.value as Preferences['logLevel'] })}
              className="w-full rounded-lg border border-goldkit-border bg-goldkit-bg px-3 py-2 text-sm"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 border-t border-goldkit-border pt-4 text-sm text-goldkit-muted">
          <p className="font-medium text-zinc-200">{ABOUT_TEXT.title} v{ABOUT_TEXT.version}</p>
          <p className="mt-1">{ABOUT_TEXT.description}</p>
          <p className="mt-2 text-xs">{ABOUT_TEXT.disclaimer}</p>
          <button
            type="button"
            onClick={handleOpenGoldKit}
            className="mt-3 inline-flex items-center gap-1 text-goldkit-gold hover:underline"
          >
            GoldKit tools
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
