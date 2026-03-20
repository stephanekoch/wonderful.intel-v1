import { useState, useEffect, useCallback } from 'react'
import { SEED_DATA } from '../data/competitors'

const CACHE_KEY = 'wonderful_intel_cache'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL) return {}
    return data || {}
  } catch {
    return {}
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* storage full, ignore */ }
}

const QUESTIONS = ['summary', 'product_features', 'icp', 'loves', 'hates', 'positioning', 'raw_linkedin', 'raw_g2', 'raw_news']

export function useResearch(competitors) {
  const [data, setData] = useState(() => {
    const cached = loadCache()
    // Start with seed data, overlay any cached real data
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
          // Persist to cache
          const cache = loadCache()
          saveCache({ ...cache, [competitorId]: { ...cache[competitorId], [question]: result } })
          return updated
        })
      }
    } catch (err) {
      console.error(`Failed to fetch ${competitorId}/${question}:`, err)
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }, [])

  const refreshCompetitor = useCallback(async (competitor) => {
    for (const q of QUESTIONS) {
      await fetchOne(competitor.id, competitor.domain, q)
    }
    setLastRefreshed(new Date())
  }, [fetchOne])

  const refreshAll = useCallback(async () => {
    for (const c of competitors.filter(c => c.active)) {
      await refreshCompetitor(c)
    }
  }, [competitors, refreshCompetitor])

  const isLoading = useCallback((competitorId) => {
    return QUESTIONS.some(q => loading[`${competitorId}_${q}`])
  }, [loading])

  const isAnyLoading = Object.values(loading).some(Boolean)

  return { data, loading, isLoading, isAnyLoading, refreshCompetitor, refreshAll, lastRefreshed }
}
