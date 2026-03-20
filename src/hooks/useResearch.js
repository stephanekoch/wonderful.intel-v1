import { useState, useCallback, useRef } from 'react'
import { SEED_DATA } from '../data/competitors'

const CACHE_KEY = 'wonderful_intel_cache'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL) return {}
    return data || {}
  } catch { return {} }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {}
}

const QUESTIONS = ['summary', 'product_features', 'icp', 'loves', 'hates', 'positioning', 'raw_linkedin', 'raw_g2', 'raw_news']

export function useResearch(competitors) {
  const [data, setData] = useState(() => {
    const cached = loadCache()
    const merged = { ...SEED_DATA }
    for (const [k, v] of Object.entries(cached)) {
      merged[k] = { ...merged[k], ...v }
    }
    return merged
  })
  const [loading, setLoading] = useState({})
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const fetchOne = useCallback(async (competitorId, domain, question) => {
    const key = `${competitorId}_${question}`
    setLoading(l => ({ ...l, [key]: true }))
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor: competitorId, question, domain }),
      })
      const result = await res.json()
      if (!result.error) {
        setData(prev => {
          const updated = {
            ...prev,
            [competitorId]: { ...prev[competitorId], [question]: result },
          }
          const cache = loadCache()
          saveCache({ ...cache, [competitorId]: { ...cache[competitorId], [question]: result } })
          return updated
        })
      }
    } catch (err) {
      console.error(`Failed ${competitorId}/${question}:`, err)
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }, [])

  const refreshCompetitor = useCallback(async (competitor) => {
    // Run all 9 questions in parallel for this competitor
    await Promise.all(QUESTIONS.map(q => fetchOne(competitor.id, competitor.domain, q)))
    setLastRefreshed(new Date())
  }, [fetchOne])

  const refreshAll = useCallback(async () => {
    const active = competitors.filter(c => c.active)
    // Run all competitors in parallel
    await Promise.all(active.map(c => refreshCompetitor(c)))
    setLastRefreshed(new Date())
  }, [competitors, refreshCompetitor])

  const isLoading = useCallback((competitorId) => {
    return QUESTIONS.some(q => loading[`${competitorId}_${q}`])
  }, [loading])

  const isAnyLoading = Object.values(loading).some(Boolean)

  return { data, loading, isLoading, isAnyLoading, refreshCompetitor, refreshAll, lastRefreshed }
}
