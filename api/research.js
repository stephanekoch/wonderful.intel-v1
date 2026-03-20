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
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
        system: `You are a competitive intelligence analyst for Wonderful.ai, an enterprise AI agent platform that operates exclusively outside the US (Europe, MENA, APAC, LATAM). Your job is to research competitors and extract sharp, specific signals. Always return valid JSON only — no markdown, no preamble, no trailing text.`,
      }),
    })

    const data = await response.json()

    // Extract the final text response (after tool use)
    const textBlock = data.content?.findLast(b => b.type === 'text')
    const raw = textBlock?.text || '{}'

    // Clean and parse
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

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
    summary: `Research ${competitor} (${domain}) and return a JSON object with this exact shape:
{
  "pulse": <number 0-100 representing competitive threat to Wonderful.ai>,
  "pulseDelta1m": <number, change in pulse vs 1 month ago>,
  "pulseDelta3m": <number, change vs 3 months ago>,
  "pulseDelta6m": <number, change vs 6 months ago>,
  "soWhat": "<2-3 sentence summary of the single most important signal about this competitor right now, from Wonderful's perspective>",
  "threatLevel": "<High|Medium|Low>"
}
Search for recent news, job postings, and product announcements. Be specific and current.`,

    product_features: `Search LinkedIn jobs and recent product announcements for ${competitor} (${domain}). Return JSON:
{
  "title": "<one sharp sentence summarising their main product move right now>",
  "signals": [
    { "label": "Signal 1", "text": "<specific finding>", "source": "<LinkedIn Jobs|Blog|Changelog>", "date": "<Mon YYYY>" },
    { "label": "Signal 2", "text": "<specific finding>", "source": "<source>", "date": "<Mon YYYY>" },
    { "label": "Signal 3", "text": "<specific finding>", "source": "<source>", "date": "<Mon YYYY>" }
  ]
}`,

    icp: `Search for ${competitor} (${domain}) job postings (especially sales roles) and recent case studies to understand their ICP and geographic expansion. Return JSON:
{
  "title": "<one sharp sentence about their geographic and vertical focus>",
  "signals": [
    { "label": "Signal 1", "text": "<specific geo/vertical finding>", "source": "<source>", "date": "<Mon YYYY>" },
    { "label": "Signal 2", "text": "<specific finding>", "source": "<source>", "date": "<Mon YYYY>" },
    { "label": "Signal 3", "text": "<specific finding>", "source": "<source>", "date": "<Mon YYYY>" }
  ]
}`,

    loves: `Search G2 and Capterra for positive reviews of ${competitor} (${domain}) from the last 90 days. Return JSON:
{
  "title": "<one sentence summarising what customers consistently praise>",
  "signals": [
    { "label": "G2 · <month yr>", "text": "<verbatim-style quote or paraphrase with star rating>", "source": "G2", "date": "<Mon YYYY>" },
    { "label": "G2 · <month yr>", "text": "<another positive review>", "source": "G2", "date": "<Mon YYYY>" },
    { "label": "Capterra · <month yr>", "text": "<positive review>", "source": "Capterra", "date": "<Mon YYYY>" }
  ]
}`,

    hates: `Search G2 and Capterra for negative reviews of ${competitor} (${domain}) from the last 90 days. These represent Wonderful.ai's competitive attack surface. Return JSON:
{
  "title": "<one sentence summarising the biggest pain points>",
  "signals": [
    { "label": "G2 · <month yr>", "text": "<verbatim-style negative quote or paraphrase>", "source": "G2", "date": "<Mon YYYY>" },
    { "label": "G2 · <month yr>", "text": "<negative review>", "source": "G2", "date": "<Mon YYYY>" },
    { "label": "Capterra · <month yr>", "text": "<negative review>", "source": "Capterra", "date": "<Mon YYYY>" }
  ]
}`,

    positioning: `Search the homepage, recent press releases, and LinkedIn posts by ${competitor} executives (${domain}). Return JSON:
{
  "title": "<one sentence describing their current narrative/positioning>",
  "signals": [
    { "label": "Website · <month yr>", "text": "<what their homepage hero/tagline says>", "source": "Website", "date": "<Mon YYYY>" },
    { "label": "LinkedIn · <month yr>", "text": "<what their CEO/execs are posting about>", "source": "LinkedIn", "date": "<Mon YYYY>" },
    { "label": "<Press/TechCrunch> · <month yr>", "text": "<how they were positioned in recent coverage>", "source": "Press", "date": "<Mon YYYY>" }
  ]
}`,

    raw_linkedin: `Search LinkedIn job postings for ${competitor} (${domain}) from the last 30 days. Return JSON:
{
  "items": [
    { "text": "<role title + location + count if multiple>", "date": "<full date>" },
    { "text": "<another posting>", "date": "<full date>" },
    { "text": "<another posting>", "date": "<full date>" }
  ]
}`,

    raw_g2: `Search G2 and Capterra reviews for ${competitor} (${domain}) from the last 90 days, mix of positive and negative. Return JSON:
{
  "items": [
    { "text": "<star rating + short quote>", "date": "<Mon YYYY>" },
    { "text": "<star rating + short quote>", "date": "<Mon YYYY>" },
    { "text": "<star rating + short quote>", "date": "<Mon YYYY>" }
  ]
}`,

    raw_news: `Search for recent news, press releases, and executive LinkedIn posts about ${competitor} (${domain}). Return JSON:
{
  "items": [
    { "text": "<headline or summary of the news item + source name>", "date": "<full date>" },
    { "text": "<another news item>", "date": "<full date>" },
    { "text": "<another item>", "date": "<full date>" }
  ]
}`,
  }

  return prompts[question] || prompts.summary
}
