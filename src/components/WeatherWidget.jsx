import { useEffect, useState } from 'react'

const WEATHER_API =
  'https://api.open-meteo.com/v1/forecast?latitude=58.05&longitude=102.74&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia/Irkutsk'

const weatherCodes = {
  0: 'Ясно',
  1: 'Преим. ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Туман с изморозью',
  51: 'Морось слабая',
  53: 'Морось',
  55: 'Морось сильная',
  61: 'Дождь слабый',
  63: 'Дождь',
  65: 'Дождь сильный',
  71: 'Снег слабый',
  73: 'Снег',
  75: 'Снег сильный',
  80: 'Ливни слабые',
  81: 'Ливни',
  82: 'Ливни сильные',
}

function WeatherWidget() {
  const [data, setData] = useState({ loading: true, error: '', payload: null })

  useEffect(() => {
    let active = true
    async function fetchWeather() {
      try {
        const res = await fetch(WEATHER_API)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!active) return
        setData({ loading: false, error: '', payload: json.current })
      } catch (err) {
        if (!active) return
        setData({ loading: false, error: err.message, payload: null })
      }
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 15 * 60 * 1000) // обновляем раз в 15 минут
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (data.loading) return <span className="text-xs text-white/80">Погода: ...</span>
  if (data.error) return <span className="text-xs text-red-100">Погода: ошибка</span>

  const w = data.payload || {}
  const status = weatherCodes[w.weather_code] || '—'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white">
      <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">Усть-Илимск</span>
      <span className="font-semibold text-white">{Math.round(w.temperature_2m)}°C</span>
      <span className="text-white/90">{status}</span>
      <span className="text-white/70">ветер {w.wind_speed_10m ?? '—'} м/с</span>
    </div>
  )
}

export default WeatherWidget
