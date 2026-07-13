import { Settings } from 'lucide-react'

interface TopBarProps {
  onToggleSettings: () => void
}

export default function TopBar({ onToggleSettings }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-goldkit-border bg-goldkit-surface px-6 py-4">
      <div className="flex items-center gap-3">
        <img
          src="./prismlogo.png"
          alt="Prism"
          className="h-10 w-10 rounded-lg object-cover"
        />
        <div>
          <p className="text-xs uppercase tracking-widest text-goldkit-muted">GoldKit</p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Prism</h1>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSettings}
        className="rounded-lg p-2 text-zinc-400 transition hover:bg-goldkit-bg hover:text-goldkit-gold"
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  )
}
