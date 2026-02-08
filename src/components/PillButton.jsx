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
    'bg-primary text-white border border-primary shadow-sm hover:bg-primary-hover'
  const inactiveStyles =
    inactiveClassName || 'border border-border bg-white text-dark hover:border-accent/60 hover:text-primary'

  return (
    <button {...props} className={[base, active ? activeStyles : inactiveStyles, className].join(' ')}>
      {children}
    </button>
  )
}

export default PillButton
