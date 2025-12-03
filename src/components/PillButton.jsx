function PillButton({
  active = false,
  children,
  className = '',
  activeClassName = '',
  inactiveClassName = '',
  ...props
}) {
  const base = 'rounded-full px-1.5 py-0.5 text-[10px] transition'
  const activeStyles =
    activeClassName ||
    'bg-sky-500 text-slate-950 border border-sky-500 shadow-sm shadow-sky-900/30 hover:bg-sky-400'
  const inactiveStyles =
    inactiveClassName || 'border border-white/10 bg-slate-900 text-slate-100 hover:border-sky-400/60 hover:text-white'

  return (
    <button {...props} className={[base, active ? activeStyles : inactiveStyles, className].join(' ')}>
      {children}
    </button>
  )
}

export default PillButton
