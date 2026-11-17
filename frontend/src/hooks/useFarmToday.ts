import { useEffect, useState } from 'react'
import { apiClient } from '../services/api'
import { authService } from '../services/auth'
import { todayIn } from '../components/schedule/taskMeta'

/**
 * Today's date (YYYY-MM-DD) in the farm's configured timezone.
 *
 * The timezone lives in /settings, which only admins can read. Workers, or an
 * admin whose settings fail to load, fall back to the browser's timezone;
 * `timeZone` is null in that case so pages can say which zone is in use.
 */
export function useFarmToday() {
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [today, setToday] = useState(() => todayIn())

  useEffect(() => {
    if (!authService.isAdmin()) return
    let active = true
    apiClient.getSettings()
      .then((s) => {
        if (!active || !s.timezone) return
        setTimeZone(s.timezone)
        setToday(todayIn(s.timezone))
      })
      .catch(() => { /* keep the browser's date */ })
    return () => { active = false }
  }, [])

  // Roll over at midnight if the page stays open
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayIn(timeZone ?? undefined)), 60_000)
    return () => window.clearInterval(id)
  }, [timeZone])

  return { today, timeZone }
}
