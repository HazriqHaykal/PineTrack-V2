import { LucideIcon } from 'lucide-react'

/** Square, neutral icon button used in table action columns */
export default function IconButton({ icon: Icon, label, onClick, danger, disabled, disabledReason }: {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  /** Tooltip explaining why the action is unavailable */
  disabledReason?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-500 ${
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  )
}
