export function formatAge(birthDate) {
  if (!birthDate) return 'дата не указана'
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return birthDate
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()

  if (days < 0) {
    months -= 1
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    days += prevMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) parts.push(`${years} ${plural(years, 'год', 'года', 'лет')}`)
  if (months > 0) parts.push(`${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`)
  if (years <= 0 && months <= 0) parts.push(`${days} ${plural(days, 'день', 'дня', 'дней')}`)

  return parts.join(' ')
}

function plural(value, one, few, many) {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
