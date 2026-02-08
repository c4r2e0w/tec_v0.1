const colorMap = {
  neutral: 'border border-border bg-white text-grayText',
  sky: 'border border-accent/40 bg-accent/10 text-primary',
  emerald: 'border border-eco/40 bg-eco-light text-eco-dark',
  orange: 'border border-warning/40 bg-warning-light text-warning',
  red: 'border border-red-400/40 bg-red-50 text-red-700',
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
