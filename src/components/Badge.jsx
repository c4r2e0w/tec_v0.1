const colorMap = {
  neutral: 'border border-white/10 bg-white/10 text-slate-100',
  sky: 'border border-sky-400/40 bg-sky-500/10 text-sky-100',
  emerald: 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  orange: 'border border-orange-300/40 bg-orange-500/10 text-orange-100',
  red: 'border border-red-400/40 bg-red-500/10 text-red-100',
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
