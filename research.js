export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { competitor, question, domain } = body

    // Step 1: call Anthropic with web search
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: 'You are a competitive intelligence analyst. Always end your response with a valid JSON object and nothing else after it.',
        messages: [{ role: 'user', content: buildPrompt(competitor, question, domain) }],
      }),
    })

    // Step 2: check HTTP status
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return new Response(JSON.stringify({ 
        error: true, 
        debug: `Anthropic HTTP ${anthropicRes.status}: ${errText.slice(0, 500)}` 
      }), {
        status: 200, // return 200 so client sees the debug info
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const apiData = await anthropicRes.json()

    // Step 3: log the full raw response for debugging
    const debugInfo = {
      stop_reason: apiData.stop_reason,
      content_types: (apiData.content || []).map(b => b.type),
      text_blocks: (apiData.content || []).filter(b => b.type === 'text').map(b => b.text?.slice(0, 300)),
    }

    // Step 4: try to extract JSON from text blocks
    const textBlocks = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text || '')

    let parsed = null
    for (let i = textBlocks.length - 1; i >= 0; i--) {
      const text = textBlocks[i]
      if (!text.includes('{')) continue
      try {
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start !== -1 && end > start) {
          parsed = JSON.parse(text.slice(start, end + 1))
          break
        }
      } catch {
        continue
      }
    }

    if (!parsed) {
      // Return debug info so we can see what came back
      return new Response(JSON.stringify({ 
        error: true,
        debug: debugInfo
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: true, debug: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

function buildPrompt(competitor, question, domain) {
  const prompts = {
    summary: `Search the web for recent news about ${competitor} (${domain}). Then respond with ONLY this JSON, values replaced with real data:
{"pulse":75,"pulseDelta1m":5,"pulseDelta3m":10,"pulseDelta6m":20,"soWhat":"2-3 sentence insight about this competitor from Wonderful.ai perspective","threatLevel":"Medium"}`,

    product_features: `Search LinkedIn jobs and product announcements for ${competitor} (${domain}). Respond with ONLY this JSON:
{"title":"One sentence about their main product move","signals":[{"label":"Signal 1","text":"finding","source":"LinkedIn Jobs","date":"Mar 2026"},{"label":"Signal 2","text":"finding","source":"Blog","date":"Feb 2026"},{"label":"Signal 3","text":"finding","source":"LinkedIn","date":"Mar 2026"}]}`,

    icp: `Search for ${competitor} (${domain}) sales job postings and case studies. Respond with ONLY this JSON:
{"title":"One sentence about their target customers and geo focus","signals":[{"label":"Signal 1","text":"finding","source":"LinkedIn Jobs","date":"Mar 2026"},{"label":"Signal 2","text":"finding","source":"Website","date":"Feb 2026"},{"label":"Signal 3","text":"finding","source":"Press","date":"Jan 2026"}]}`,

    loves: `Search G2 and Capterra for positive reviews of ${competitor} (${domain}). Respond with ONLY this JSON:
{"title":"One sentence about what customers love","signals":[{"label":"G2 · Feb 26","text":"4.8/5 — positive quote","source":"G2","date":"Feb 2026"},{"label":"G2 · Mar 26","text":"4.5/5 — positive quote","source":"G2","date":"Mar 2026"},{"label":"Capterra · Jan 26","text":"4.7/5 — positive quote","source":"Capterra","date":"Jan 2026"}]}`,

    hates: `Search G2 and Capterra for negative reviews of ${competitor} (${domain}). Respond with ONLY this JSON:
{"title":"One sentence about top customer complaints","signals":[{"label":"G2 · Feb 26","text":"2.5/5 — negative quote","source":"G2","date":"Feb 2026"},{"label":"G2 · Mar 26","text":"2.8/5 — negative quote","source":"G2","date":"Mar 2026"},{"label":"Capterra · Jan 26","text":"3.0/5 — negative quote","source":"Capterra","date":"Jan 2026"}]}`,

    positioning: `Search the homepage and LinkedIn exec posts for ${competitor} (${domain}). Respond with ONLY this JSON:
{"title":"One sentence about their current positioning narrative","signals":[{"label":"Website · Mar 26","text":"their tagline or hero message","source":"Website","date":"Mar 2026"},{"label":"LinkedIn · Mar 26","text":"what their CEO posts about","source":"LinkedIn","date":"Mar 2026"},{"label":"Press · Feb 26","text":"how press covers them","source":"Press","date":"Feb 2026"}]}`,

    raw_linkedin: `Search LinkedIn jobs for ${competitor} (${domain}) last 30 days. Respond with ONLY this JSON:
{"items":[{"text":"Role title — Location","date":"Mar 12, 2026"},{"text":"Role title — Location","date":"Mar 8, 2026"},{"text":"Role title — Location","date":"Feb 28, 2026"}]}`,

    raw_g2: `Search G2 and Capterra reviews for ${competitor} (${domain}). Respond with ONLY this JSON:
{"items":[{"text":"4.8/5 — short quote","date":"Feb 2026"},{"text":"2.5/5 — short quote","date":"Mar 2026"},{"text":"3.2/5 — short quote","date":"Jan 2026"}]}`,

    raw_news: `Search recent news about ${competitor} (${domain}). Respond with ONLY this JSON:
{"items":[{"text":"News headline or summary (Source)","date":"Mar 10, 2026"},{"text":"News item (Source)","date":"Feb 20, 2026"},{"text":"News item (Source)","date":"Jan 30, 2026"}]}`,
  }
  return prompts[question] || prompts.summary
}
