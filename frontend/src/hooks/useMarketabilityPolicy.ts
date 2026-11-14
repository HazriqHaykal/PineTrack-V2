import { useEffect, useState } from 'react'
import { apiClient } from '../services/api'
import { MarketabilityPolicy } from '../types'

/** The current marketability policy, or null while loading or if it could not be loaded */
export function useMarketabilityPolicy() {
  const [policy, setPolicy] = useState<MarketabilityPolicy | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    apiClient.getMarketabilityPolicy()
      .then((p) => { if (active) setPolicy(p) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])

  return { policy, failed }
}
