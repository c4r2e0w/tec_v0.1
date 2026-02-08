const colorMap = {
  neutral: 'border border-border bg-surface text-grayText',
  sky: 'border border-accent/40 bg-accent/15 text-accent',
  emerald: 'border border-eco/50 bg-eco-light/70 text-accent',
  orange: 'border border-warning/40 bg-warning-light text-warning',
  red: 'border border-red-400/45 bg-red-950/40 text-red-300',
}

function Badge({ variant = 'neutral', className = '', children, ...props }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] uppercase'
  const variantClass = colorMap[variant] || colorMap.neutral
  return (
    <span {...props} className={[base, variantClass, className].join(' ')}>
      {children}
    </span>
  )
}

export default Badge
