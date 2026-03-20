import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { COMPETITORS, WONDERFUL, SEED_DATA } from './data/competitors'
import { useResearch } from './hooks/useResearch'

Chart.register(...registerables)

const CHART_PERIODS = {
  '1m': { labels: ['Feb 24', 'Mar 3', 'Mar 10', 'Mar 17', 'Mar 19'], points: [0.93, 0.95, 0.97, 0.99, 1] },
  '3m': { labels: ['Jan 1', 'Jan 19', 'Feb 5', 'Feb 19', 'Mar 5', 'Mar 19'], points: [0.85, 0.88, 0.90, 0.94, 0.97, 1] },
  '6m': { labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'], points: [0.65, 0.74, 0.80, 0.86, 0.94, 1] },
}

const WONDERFUL_HISTORY = { '1m': [78,80,81,83,84], '3m': [72,74,76,79,82,84], '6m': [55,62,67,72,79,84] }
const WONDERFUL_DELTAS = { '1m': 6, '3m': 12, '6m': 29 }

function favicon(domain, size=32) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

function Tag({ children, variant='neutral', className='' }) {
  const v = {
    neutral:'bg-[#f0f0f8] text-[#6b6490]', green:'bg-[#e4f7f0] text-[#00b894]',
    red:'bg-[#fceaea] text-[#e17055]', amber:'bg-[#fdf2e3] text-[#e0963a]',
    accent:'bg-[#f0eeff] text-[#6c5ce7]', blue:'bg-[#e3f0fb] text-[#0984e3]',
    purple:'bg-purple-100 text-purple-700', sky:'bg-sky-100 text-sky-600',
  }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap ${v[variant]||v.neutral} ${className}`}>{children}</span>
}

function CompRow({ color, label, text }) {
  return (
    <div className="flex items-start gap-3 py-[11px] border-b border-[#f0ecf8] last:border-0 last:pb-0">
      <div className="w-2 h-2 rounded-full mt-[6px] flex-shrink-0" style={{background:color}}/>
      <div className="text-[13px] font-semibold text-[#6b6490] w-[90px] flex-shrink-0">{label}</div>
      <div className="text-[14px] text-[#16112e] leading-snug flex-1">{text}</div>
    </div>
  )
}

function SignalCard({ tag, tagVariant, desc, title, signals, dotColor }) {
  return (
    <div className="bg-white border border-[#e8e4f4] rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <Tag variant={tagVariant}>{tag}</Tag>
        <p className="text-[12px] text-[#b0a8cc] mt-[7px] mb-[10px] leading-relaxed">{desc}</p>
        <h3 className="font-['Lora'] text-[17px] font-normal leading-snug text-[#16112e]">{title}</h3>
      </div>
      {signals?.map((s,i) => <CompRow key={i} color={dotColor} label={s.label} text={s.text}/>)}
    </div>
  )
}

function PulseTile({ competitors, data, period, onPeriodChange }) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if(!chartRef.current) return
    const ctx = chartRef.current.getContext('2d')
    if(chartInstance.current) chartInstance.current.destroy()
    const {labels, points} = CHART_PERIODS[period]
    const datasets = [
      { label:'Wonderful', data:WONDERFUL_HISTORY[period], borderColor:'#c4baff', backgroundColor:'#c4baff22', tension:0.4, pointRadius:3, fill:false, borderWidth:2.5, pointBackgroundColor:'#c4baff' },
      ...competitors.filter(c=>c.active).map(c=>{
        const pulse = data[c.id]?.pulse || 60
        return { label:c.name, data:points.map(p=>Math.round(pulse*p*0.85+pulse*0.15)), borderColor:c.color+'cc', backgroundColor:c.color+'18', tension:0.4, pointRadius:3, fill:false, borderWidth:2.5, pointBackgroundColor:c.color+'cc' }
      }),
    ]
    chartInstance.current = new Chart(ctx, { type:'line', data:{labels,datasets}, options:{
      responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(22,17,46,0.92)', borderColor:'rgba(162,155,254,0.3)', borderWidth:1, titleColor:'rgba(255,255,255,0.5)', bodyColor:'#fff', titleFont:{family:'Plus Jakarta Sans',size:12,weight:'600'}, bodyFont:{family:'Plus Jakarta Sans',size:13}, padding:12 } },
      scales:{ x:{grid:{color:'rgba(255,255,255,0.06)'},ticks:{color:'rgba(255,255,255,0.3)',font:{family:'Plus Jakarta Sans',size:11}}}, y:{min:30,max:100,grid:{color:'rgba(255,255,255,0.06)'},ticks:{color:'rgba(255,255,255,0.3)',font:{family:'Plus Jakarta Sans',size:11}}} }
    }})
    return () => chartInstance.current?.destroy()
  }, [competitors, data, period])

  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:'linear-gradient(135deg,#1a0f3c 0%,#2d1f6e 35%,#1e1855 65%,#2a1040 100%)',boxShadow:'0 2px 8px rgba(108,92,231,0.08),0 8px 32px rgba(108,92,231,0.07)'}}>
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(162,155,254,0.18) 0%,transparent 65%)'}}/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[15px] font-bold text-white/95">Threat Pulse</div>
            <div className="text-[12px] text-white/40 mt-0.5">Hiring velocity · review sentiment · news activity</div>
          </div>
          <div className="flex gap-0.5 bg-white/[0.08] border border-white/[0.12] rounded-lg p-1">
            {['1m','3m','6m'].map(p=>(
              <button key={p} onClick={()=>onPeriodChange(p)} className={`px-3 py-1 rounded-md text-[12px] font-bold transition-all cursor-pointer ${period===p?'bg-white/20 text-white':'text-white/40 hover:text-white/60'}`}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 mb-5" style={{gridTemplateColumns:`repeat(${1+competitors.filter(c=>c.active).length},1fr)`}}>
          <div className="bg-white/[0.06] border border-white/10 rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Wonderful</div>
            <div className="font-['Lora'] text-[30px] font-semibold leading-none mb-1 text-[#c4baff]">{WONDERFUL_HISTORY[period].at(-1)}</div>
            <div className="text-[11px] font-bold text-[#5effd4]">↑ +{WONDERFUL_DELTAS[period]}</div>
          </div>
          {competitors.filter(c=>c.active).map(c=>{
            const pulse = data[c.id]?.pulse||60
            const deltaKey = `pulseDelta${period}`
            const delta = data[c.id]?.[deltaKey]??0
            return (
              <div key={c.id} className="bg-white/[0.06] border border-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 truncate">{c.name}</div>
                <div className="font-['Lora'] text-[30px] font-semibold leading-none mb-1" style={{color:c.color+'cc'}}>{pulse}</div>
                <div className={`text-[11px] font-bold ${delta>0?'text-[#5effd4]':delta<0?'text-[#ffaa95]':'text-white/30'}`}>{delta>0?`↑ +${delta}`:delta<0?`↓ ${delta}`:'→ flat'}</div>
              </div>
            )
          })}
        </div>
        <div style={{height:190}}><canvas ref={chartRef}/></div>
        <div className="flex gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/45"><div className="w-4 h-[2.5px] rounded-sm bg-[#c4baff]"/>Wonderful</div>
          {competitors.filter(c=>c.active).map(c=>(
            <div key={c.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-white/45"><div className="w-4 h-[2.5px] rounded-sm" style={{background:c.color+'cc'}}/>{c.name}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SummaryTab({ competitors, data, period, onPeriodChange }) {
  const active = competitors.filter(c=>c.active)
  const summaryCards = [
    { tag:'Product features', variant:'amber', desc:'Engineering hires, changelogs, and exec posts — last 30 days.', key:'product_features', title:'Key product movements across competitors.' },
    { tag:'ICP', variant:'accent', desc:'Geo and vertical signals from open sales roles, case studies, and press releases.', key:'icp', title:'Where each competitor is expanding and who they target.' },
    { tag:'What customers love', variant:'green', desc:'Positive review themes from G2 and Capterra, last 90 days.', key:'loves', title:'Top praised attributes across all competitors.' },
    { tag:'What customers hate', variant:'red', desc:"Negative review themes from G2 and Capterra — Wonderful's clearest openings.", key:'hates', title:"Competitors' recurring pain points — Wonderful's attack surface." },
  ]
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.7fr] gap-5 mb-5">
        <div className="rounded-2xl p-8 relative overflow-hidden border border-[#e4deff]" style={{background:'linear-gradient(150deg,#ffffff 0%,#f5f2ff 55%,#ede8ff 100%)'}}>
          <div className="absolute -top-[70px] -right-[70px] w-60 h-60 rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(108,92,231,0.12) 0%,transparent 70%)'}}/>
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6c5ce7] mb-4">
              <span className="w-[7px] h-[7px] bg-[#6c5ce7] rounded-full animate-pulse"/>Summary
            </div>
            <h2 className="font-['Lora'] text-[20px] font-normal leading-[1.48] text-[#16112e] mb-4">
              ElevenLabs is making a <em className="italic text-[#6c5ce7]">hard push into enterprise CX</em> — the most urgent signal this month.
            </h2>
            <p className="text-[14px] leading-[1.8] text-[#6b6490]">{data?.elevenlabs?.soWhat||'Loading intelligence...'}</p>
          </div>
        </div>
        <PulseTile competitors={active} data={data} period={period} onPeriodChange={onPeriodChange}/>
      </div>
      {summaryCards.map((card,idx)=>(
        <div key={idx} className="bg-white border border-[#e8e4f4] rounded-2xl p-6 shadow-sm mb-4">
          <div className="mb-4">
            <Tag variant={card.variant}>{card.tag}</Tag>
            <p className="text-[12px] text-[#b0a8cc] mt-[7px] mb-[10px]">{card.desc}</p>
            <h3 className="font-['Lora'] text-[17px] font-normal leading-snug text-[#16112e]">{card.title}</h3>
          </div>
          {active.map(c=><CompRow key={c.id} color={c.color} label={c.name} text={data[c.id]?.[card.key]?.title||'—'}/>)}
        </div>
      ))}
      <div className="bg-white border border-[#e8e4f4] rounded-2xl p-6 shadow-sm">
        <div className="mb-4">
          <Tag variant="blue">Positioning</Tag>
          <p className="text-[12px] text-[#b0a8cc] mt-[7px] mb-[10px]">Homepage copy, LinkedIn exec posts, and press releases — Mar 2026.</p>
          <h3 className="font-['Lora'] text-[17px] font-normal leading-snug text-[#16112e]">How each competitor is telling their story right now.</h3>
        </div>
        <div className="grid gap-0" style={{gridTemplateColumns:`repeat(${active.length},1fr)`}}>
          {active.map((c,i)=>(
            <div key={c.id} className={`py-3 ${i<active.length-1?'pr-6 border-r border-[#f0ecf8]':''} ${i>0?'pl-6':''}`}>
              <div className="text-[12px] font-bold mb-1.5" style={{color:c.color}}>{c.name}</div>
              <div className="text-[14px] text-[#16112e] leading-snug">{data[c.id]?.positioning?.title||'—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompetitorTab({ competitor, data, onRefresh, isLoading }) {
  const d = data[competitor.id]
  if(!d) return null
  const cards = [
    { tag:'Product features', variant:'amber', desc:'Engineering hires, changelog entries, and exec posts — last 30 days.', key:'product_features' },
    { tag:'ICP', variant:'accent', desc:'Sales hire locations, case study verticals, and press releases.', key:'icp' },
    { tag:'What customers love', variant:'green', desc:'G2 and Capterra positive reviews, last 90 days.', key:'loves' },
    { tag:'What customers hate', variant:'red', desc:"G2 and Capterra negative reviews — Wonderful's clearest openings.", key:'hates' },
  ]
  const delta = d.pulseDelta3m||0
  return (
    <div>
      <div className="flex items-center gap-5 mb-5 p-6 bg-white border border-[#e8e4f4] rounded-2xl shadow-sm">
        <div className="w-[52px] h-[52px] rounded-[13px] bg-[#f8f8f8] flex items-center justify-center flex-shrink-0">
          <img src={favicon(competitor.domain,64)} alt={competitor.name} className="w-9 h-9 rounded-md"/>
        </div>
        <div>
          <h2 className="font-['Lora'] text-[24px] font-semibold mb-0.5">{competitor.name}</h2>
          <p className="text-[13px] text-[#6b6490]">{competitor.meta}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Tag variant={d.threatLevel==='High'?'red':d.threatLevel==='Emerging'?'purple':'amber'}>{d.threatLevel||'Medium'} threat</Tag>
          <Tag variant={competitor.tagColor}>Pulse {d.pulse} {delta>0?`↑ +${delta}`:delta<0?`↓ ${delta}`:'→ flat'}</Tag>
          <button onClick={onRefresh} disabled={isLoading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#e8e4f4] text-[#6b6490] hover:border-[#6c5ce7] hover:text-[#6c5ce7] transition-all cursor-pointer disabled:opacity-50">
            {isLoading?'⟳ Refreshing...':'↺ Refresh'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {cards.map(card=>(
          <SignalCard key={card.key} tag={card.tag} tagVariant={card.variant} desc={card.desc} title={d[card.key]?.title||'—'} signals={d[card.key]?.signals||[]} dotColor={competitor.color}/>
        ))}
      </div>
      <div className="bg-white border border-[#e8e4f4] rounded-2xl p-6 shadow-sm mb-4">
        <div className="mb-4">
          <Tag variant="blue">Positioning</Tag>
          <p className="text-[12px] text-[#b0a8cc] mt-[7px] mb-[10px]">Homepage copy, LinkedIn exec posts, and press releases — Mar 2026.</p>
          <h3 className="font-['Lora'] text-[17px] font-normal leading-snug text-[#16112e]">{d.positioning?.title||'—'}</h3>
        </div>
        {d.positioning?.signals?.map((s,i)=><CompRow key={i} color={competitor.color} label={s.label} text={s.text}/>)}
      </div>
      <div className="bg-white border border-[#e8e4f4] rounded-2xl p-6 shadow-sm">
        <div className="mb-4 pb-3 border-b border-[#e8e4f4]"><Tag variant="neutral">Raw signals</Tag></div>
        <div className="grid grid-cols-3 gap-0">
          {[
            {fav:'linkedin.com',name:'LinkedIn Jobs',type:'Job postings · last 30 days',key:'raw_linkedin'},
            {fav:'g2.com',name:'G2 Reviews',type:'Customer reviews · last 90 days',key:'raw_g2'},
            {fav:'nytimes.com',name:'News & Press',type:'Press releases, TechCrunch, LinkedIn',key:'raw_news'},
          ].map((src,i)=>(
            <div key={i} className={`${i<2?'pr-5 border-r border-[#f0ecf8]':''} ${i>0?'pl-5':''}`}>
              <div className="flex items-center gap-2.5 mb-3">
                <img src={favicon(src.fav,32)} alt={src.name} className="w-5 h-5 rounded-[4px]"/>
                <div>
                  <div className="text-[13px] font-bold text-[#16112e]">{src.name}</div>
                  <div className="text-[11px] text-[#b0a8cc]">{src.type}</div>
                </div>
              </div>
              {(d[src.key]?.items||[]).map((item,j)=>(
                <div key={j} className="flex gap-2.5 py-2 border-b border-[#f0ecf8] last:border-0 last:pb-0 text-[13px]">
                  <div className="flex-1 text-[#16112e] leading-snug">{item.text}</div>
                  <div className="text-[10px] font-bold text-[#b0a8cc] bg-[#f8f7ff] border border-[#e8e4f4] rounded px-1.5 py-0.5 self-start flex-shrink-0 whitespace-nowrap">{item.date}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ competitors, onToggle, onAdd }) {
  const [newName,setNewName] = useState('')
  const [newDomain,setNewDomain] = useState('')
  const handleAdd = () => { if(!newName.trim()||!newDomain.trim()) return; onAdd(newName.trim(),newDomain.trim()); setNewName(''); setNewDomain('') }
  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-5 items-start">
      <div className="bg-white border border-[#e8e4f4] rounded-2xl p-7 shadow-sm">
        <h2 className="font-['Lora'] text-[19px] font-normal mb-1.5">Competitors</h2>
        <p className="text-[14px] text-[#6b6490] mb-5 leading-relaxed">Toggle competitors on or off. Active ones appear in the dashboard and are included in the refresh cycle.</p>
        {competitors.map(c=>(
          <div key={c.id} className={`flex items-center justify-between py-3 border-b border-[#f0ecf8] last:border-0 ${!c.active?'opacity-50':''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center overflow-hidden">
                <img src={favicon(c.domain,64)} alt={c.name} className="w-6 h-6 rounded"/>
              </div>
              <div>
                <div className="text-[15px] font-semibold mb-0.5">{c.name}</div>
                <div className="text-[12px] text-[#6b6490]">{c.domain}</div>
              </div>
            </div>
            <label className="relative w-11 h-6 cursor-pointer flex-shrink-0">
              <input type="checkbox" className="sr-only" checked={c.active} onChange={()=>onToggle(c.id)}/>
              <div className={`absolute inset-0 rounded-full transition-all ${c.active?'bg-gradient-to-r from-[#6c5ce7] to-[#a29bfe]':'bg-[#e8e4f4]'}`}/>
              <div className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${c.active?'translate-x-[22px]':'translate-x-[3px]'}`}/>
            </label>
          </div>
        ))}
        <div className="flex gap-2 mt-5">
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Company name" onKeyDown={e=>e.key==='Enter'&&handleAdd()} className="flex-1 bg-[#f8f7ff] border border-[#e8e4f4] rounded-[10px] px-4 py-2.5 text-[14px] outline-none focus:border-[#6c5ce7]"/>
          <input value={newDomain} onChange={e=>setNewDomain(e.target.value)} placeholder="domain.com" onKeyDown={e=>e.key==='Enter'&&handleAdd()} className="flex-1 bg-[#f8f7ff] border border-[#e8e4f4] rounded-[10px] px-4 py-2.5 text-[14px] outline-none focus:border-[#6c5ce7]"/>
          <button onClick={handleAdd} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white cursor-pointer" style={{background:'linear-gradient(135deg,#6c5ce7 0%,#a29bfe 100%)',boxShadow:'0 2px 8px rgba(108,92,231,0.35)'}}>+ Add</button>
        </div>
      </div>
      <div className="bg-white border border-[#e8e4f4] rounded-2xl p-7 shadow-sm">
        <h2 className="font-['Lora'] text-[19px] font-normal mb-1.5">Refresh schedule</h2>
        <p className="text-[14px] text-[#6b6490] mb-5 leading-relaxed">How often should the dashboard pull new signals for active competitors.</p>
        <div className="flex flex-col gap-2">
          {['Daily','Weekly','Manual only'].map(opt=>(
            <button key={opt} className={`w-full text-left px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all cursor-pointer ${opt==='Weekly'?'text-white':'bg-white text-[#6b6490] border border-[#e8e4f4] hover:border-[#6c5ce7] hover:text-[#6c5ce7]'}`} style={opt==='Weekly'?{background:'linear-gradient(135deg,#6c5ce7 0%,#a29bfe 100%)',boxShadow:'0 2px 8px rgba(108,92,231,0.35)'}:{}}>{opt}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab,setActiveTab] = useState('summary')
  const [period,setPeriod] = useState('3m')
  const [competitors,setCompetitors] = useState(COMPETITORS)
  const { data, isLoading, isAnyLoading, refreshCompetitor, refreshAll, lastRefreshed } = useResearch(competitors)
  const active = competitors.filter(c=>c.active)
  const handleToggle = (id) => setCompetitors(p=>p.map(c=>c.id===id?{...c,active:!c.active}:c))
  const handleAdd = (name,domain) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g,'')
    const colors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6']
    setCompetitors(p=>[...p,{id,name,domain,color:colors[p.length%colors.length],tagColor:'neutral',meta:`${domain} · AI platform`,active:true}])
  }
  const refreshTime = lastRefreshed ? lastRefreshed.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'Seed data'
  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}>
      <header className="sticky top-0 z-50 flex items-center justify-between px-10 h-16 border-b border-[#e8e4f4]" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(16px)'}}>
        <div className="flex items-center gap-2.5 font-['Lora'] text-[20px] font-semibold text-[#16112e]">
          <span className="w-2.5 h-2.5 rounded-full" style={{background:'linear-gradient(135deg,#6c5ce7,#a29bfe)',boxShadow:'0 0 8px rgba(108,92,231,0.5)'}}/>
          wonderful.intel
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-[#6b6490]">Refreshed {refreshTime}</span>
          <button onClick={refreshAll} disabled={isAnyLoading} className="px-[18px] py-2 rounded-[10px] text-[14px] font-semibold bg-white text-[#6b6490] border border-[#e8e4f4] hover:border-[#6c5ce7] hover:text-[#6c5ce7] transition-all cursor-pointer disabled:opacity-50">
            {isAnyLoading?'⟳ Refreshing...':'↺ Refresh all'}
          </button>
          <button onClick={()=>setActiveTab('settings')} className="px-[18px] py-2 rounded-[10px] text-[14px] font-semibold text-white cursor-pointer" style={{background:'linear-gradient(135deg,#6c5ce7 0%,#a29bfe 100%)',boxShadow:'0 2px 8px rgba(108,92,231,0.35)'}}>
            ⚙ Settings
          </button>
        </div>
      </header>
      <nav className="bg-white border-b border-[#e8e4f4] flex items-center px-10 overflow-x-auto">
        <button onClick={()=>setActiveTab('summary')} className={`flex items-center gap-2 px-5 py-4 text-[14px] font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab==='summary'?'text-[#6c5ce7] border-[#6c5ce7] font-bold':'text-[#6b6490] border-transparent hover:text-[#16112e]'}`}>Summary</button>
        {active.map(c=>(
          <button key={c.id} onClick={()=>setActiveTab(c.id)} className={`flex items-center gap-2 px-5 py-4 text-[14px] font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab===c.id?'text-[#6c5ce7] border-[#6c5ce7] font-bold':'text-[#6b6490] border-transparent hover:text-[#16112e]'}`}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c.color}}/>
            {c.name}
            {isLoading(c.id)&&<span className="text-[10px]">⟳</span>}
          </button>
        ))}
      </nav>
      <main className="px-10 py-8 max-w-[1440px] mx-auto">
        {activeTab==='summary'&&<SummaryTab competitors={active} data={data} period={period} onPeriodChange={setPeriod}/>}
        {active.map(c=>activeTab===c.id&&<CompetitorTab key={c.id} competitor={c} data={data} onRefresh={()=>refreshCompetitor(c)} isLoading={isLoading(c.id)}/>)}
        {activeTab==='settings'&&<SettingsTab competitors={competitors} onToggle={handleToggle} onAdd={handleAdd}/>}
      </main>
    </div>
  )
}
