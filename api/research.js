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

    const prompt = buildPrompt(competitor, question, domain)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        system: `You are a competitive intelligence analyst for Wonderful.ai. Research the requested competitor and return ONLY a valid JSON object — no markdown, no code fences, no explanation, no preamble. Just the raw JSON object starting with { and ending with }.`,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', response.status, errText)
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const data = await response.json()

    // Extract all text blocks and find the last one with JSON
    const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text)
    
    let parsed = null
    // Try each text block from last to first
    for (let i = textBlocks.length - 1; i >= 0; i--) {
      const text = textBlocks[i]
      if (!text || !text.includes('{')) continue
      try {
        // Strip any markdown fences if present
        const cleaned = text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()
        // Find the first { and last } to extract the JSON object
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(cleaned.slice(start, end + 1))
          break
        }
      } catch {
        continue
      }
    }

    if (!parsed) {
      console.error('Could not parse JSON from response. Content blocks:', JSON.stringify(data.content?.map(b => ({ type: b.type, text: b.text?.slice(0, 200) }))))
      return new Response(JSON.stringify({ error: 'Could not parse response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Research API error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

function buildPrompt(competitor, question, domain) {
  const prompts = {
    summary: `Search the web for recent news and information about ${competitor} (website: ${domain}). Then return ONLY this JSON object with no other text:
{"pulse":75,"pulseDelta1m":5,"pulseDelta3m":10,"pulseDelta6m":20,"soWhat":"2-3 sentence summary of the most important competitive signal about this company right now from Wonderful.ai's perspective","threatLevel":"Medium"}
Replace all values with real researched data. threatLevel must be one of: High, Medium, Low, Emerging.`,

    product_features: `Search LinkedIn jobs and recent product announcements for ${competitor} (${domain}) to find what they are building. Return ONLY this JSON with no other text:
{"title":"One sharp sentence summarising their main product move right now","signals":[{"label":"Signal 1","text":"specific finding about product or engineering","source":"LinkedIn Jobs","date":"Mar 2026"},{"label":"Signal 2","text":"specific finding","source":"Blog","date":"Feb 2026"},{"label":"Signal 3","text":"specific finding","source":"LinkedIn","date":"Mar 2026"}]}`,

    icp: `Search for ${competitor} (${domain}) job postings especially sales roles, and recent case studies to understand their target customers and geographic expansion. Return ONLY this JSON with no other text:
{"title":"One sharp sentence about their geographic and vertical focus","signals":[{"label":"Signal 1","text":"specific geo or vertical finding","source":"LinkedIn Jobs","date":"Mar 2026"},{"label":"Signal 2","text":"specific finding","source":"Website","date":"Feb 2026"},{"label":"Signal 3","text":"specific finding","source":"Press","date":"Jan 2026"}]}`,

    loves: `Search G2 and Capterra for positive reviews of ${competitor} (${domain}) from the last 90 days. Return ONLY this JSON with no other text:
{"title":"One sentence summarising what customers consistently praise","signals":[{"label":"G2 · Feb 26","text":"4.8/5 — quote or paraphrase of positive review","source":"G2","date":"Feb 2026"},{"label":"G2 · Mar 26","text":"another positive review with rating","source":"G2","date":"Mar 2026"},{"label":"Capterra · Jan 26","text":"positive review with rating","source":"Capterra","date":"Jan 2026"}]}`,

    hates: `Search G2 and Capterra for negative reviews of ${competitor} (${domain}) from the last 90 days. Return ONLY this JSON with no other text:
{"title":"One sentence summarising the biggest customer pain points","signals":[{"label":"G2 · Feb 26","text":"2.5/5 — quote or paraphrase of negative review","source":"G2","date":"Feb 2026"},{"label":"G2 · Mar 26","text":"another negative review with rating","source":"G2","date":"Mar 2026"},{"label":"Capterra · Jan 26","text":"negative review with rating","source":"Capterra","date":"Jan 2026"}]}`,

    positioning: `Search the homepage, recent press releases, and LinkedIn posts by ${competitor} executives (${domain}). Return ONLY this JSON with no other text:
{"title":"One sentence describing their current narrative and positioning","signals":[{"label":"Website · Mar 26","text":"what their homepage hero or tagline says","source":"Website","date":"Mar 2026"},{"label":"LinkedIn · Mar 26","text":"what their CEO or execs are posting about","source":"LinkedIn","date":"Mar 2026"},{"label":"Press · Feb 26","text":"how they were positioned in recent press coverage","source":"Press","date":"Feb 2026"}]}`,

    raw_linkedin: `Search LinkedIn job postings for ${competitor} (${domain}) from the last 30 days. Return ONLY this JSON with no other text:
{"items":[{"text":"Role title and location","date":"Mar 12, 2026"},{"text":"Another role and location","date":"Mar 8, 2026"},{"text":"Another role and location","date":"Feb 28, 2026"}]}`,

    raw_g2: `Search G2 and Capterra reviews for ${competitor} (${domain}) from the last 90 days. Return ONLY this JSON with no other text:
{"items":[{"text":"4.8/5 — short quote from positive review","date":"Feb 2026"},{"text":"2.5/5 — short quote from negative review","date":"Mar 2026"},{"text":"3.2/5 — short quote from mixed review","date":"Jan 2026"}]}`,

    raw_news: `Search for recent news articles, press releases, and executive LinkedIn posts about ${competitor} (${domain}). Return ONLY this JSON with no other text:
{"items":[{"text":"Headline or summary of news item plus source name","date":"Mar 10, 2026"},{"text":"Another news item","date":"Feb 20, 2026"},{"text":"Another item","date":"Jan 30, 2026"}]}`,
  }

  return prompts[question] || prompts.summary
}
