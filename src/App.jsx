         import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MOCK_AUDIT_RESPONSE } from './mockResults'
import {
  AlertTriangle,
  Bot,
  Boxes,
  CircleAlert,
  Flame,
  Leaf,
  PackageSearch,
  Radar,
  ShieldAlert,
  Waves,
} from 'lucide-react'

const STAT_CONFIG = [
  { key: 'risks', label: 'Active Risks', icon: CircleAlert, tone: 'red' },
  { key: 'stockHealth', label: 'Stock Health %', icon: Boxes, tone: 'amber' },
  { key: 'wasteSaved', label: 'Daily Waste Saved', icon: Waves, tone: 'green' },
  { key: 'efficiency', label: 'Operational Efficiency Index', icon: Radar, tone: 'green' },
]

const INITIAL_METRICS = {
  risks: 1,
  stockHealth: 93,
  wasteSaved: '$1,920',
  efficiency: 97,
}

const INITIAL_WASTE_SENSE = 84
const AUDIT_PROMPT =
  'You are a Senior B2B Kitchen Auditor. Analyze this specific zone feed. Return ONLY a JSON object: { "detection": "Short Bold Description", "status": "Critical/Warning/Healthy", "action": "Professional command (e.g., Deploy Sanitation)", "aura_score": number from -100 to 100 }.'
const LIVE_AUDIT_PROMPT =
  'You are the SousVision Autonomous Auditor. Look at the image being held up to the camera (likely from a mobile phone screen). Identify if it shows a Floor Spill, Low Stock Crates, Hygiene Hazard, or Food Waste. Return ONLY a JSON object: { "detection": "Short Bold Title", "status": "Critical/Warning/Healthy", "action": "Professional Command", "aura_score": -100 to 100 }.'
const GEMINI_MODELS = ['gemini-2.0-flash']
const GEMINI_MODEL_PATHS = ['models/gemini-2.0-flash']

const ZONES = [
  { id: 'A', name: 'Prep Station', image: '/hazard.jpg' },
  { id: 'B', name: 'Cooking', image: '/spill.jpg' },
  { id: 'C', name: 'Storage', image: '/stock.jpg' },
  { id: 'D', name: 'Waste Area', image: '/waste.jpg' },
]

const INITIAL_INVENTORY = [
  { name: 'Flour', stock: 42, status: 'Drafting Order' },
  { name: 'Tomatoes', stock: 58, status: 'Optimized' },
  { name: 'Olive Oil', stock: 33, status: 'Drafting Order' },
  { name: 'Chicken Stock', stock: 76, status: 'Optimized' },
  { name: 'Parmesan', stock: 19, status: 'Expedite Required' },
]

const INITIAL_EVENTS = [
  {
    id: 1,
    type: 'hazard',
    title: 'Liquid Spill detected in Zone B',
    timestamp: '09:41:12',
    critical: true,
  },
  {
    id: 2,
    type: 'logistics',
    title: 'Stock Level: Flour at 8%',
    timestamp: '09:39:03',
    critical: false,
  },
  {
    id: 3,
    type: 'compliance',
    title: 'Cross-contamination risk at Station 1',
    timestamp: '09:34:45',
    critical: true,
  },
]

const toneClasses = {
  green: 'text-emerald-400 border-emerald-500/30',
  amber: 'text-amber-400 border-amber-500/30',
  red: 'text-red-400 border-red-500/30',
}

const statusStyles = {
  Optimized: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  'Drafting Order': 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  'Expedite Required': 'text-red-300 bg-red-500/15 border-red-500/30',
}

const eventStyles = {
  hazard: {
    icon: AlertTriangle,
    border: 'border-red-500/40',
    iconColor: 'text-red-400',
  },
  logistics: {
    icon: PackageSearch,
    border: 'border-amber-500/40',
    iconColor: 'text-amber-300',
  },
  compliance: {
    icon: ShieldAlert,
    border: 'border-emerald-500/40',
    iconColor: 'text-emerald-300',
  },
}

function getTimeStamp() {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { hour12: false })
}

function App() {
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [inventory] = useState(INITIAL_INVENTORY)
  const [events, setEvents] = useState(INITIAL_EVENTS)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [hazardMode, setHazardMode] = useState(false)
  const [wasteSenseScore, setWasteSenseScore] = useState(INITIAL_WASTE_SENSE)
  const [zoneAudits, setZoneAudits] = useState({})
  const [isAnalyzingMap, setIsAnalyzingMap] = useState({})
  const [selectedZone, setSelectedZone] = useState(null)
  const [toast, setToast] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isLiveAuditing, setIsLiveAuditing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMockMode, setIsMockMode] = useState(true)
  const [isReporting, setIsReporting] = useState(false)
  const [liveAuditResult, setLiveAuditResult] = useState(null)
  const [flashFrame, setFlashFrame] = useState(false)
  const [dashboardStatus, setDashboardStatus] = useState('Healthy')
  const [systemLog, setSystemLog] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const dominantAccent =
    dashboardStatus === 'Critical'
      ? 'shadow-[0_0_45px_rgba(239,68,68,0.35)]'
      : dashboardStatus === 'Warning'
        ? 'shadow-[0_0_45px_rgba(245,158,11,0.28)]'
        : 'shadow-[0_0_45px_rgba(16,185,129,0.30)]'
  const geminiApiKey = 'AIzaSyCMrbPsFcabhh9jh663gAb_jAc5kPV7j6o'
  const genAI = useMemo(() => new GoogleGenerativeAI(geminiApiKey), [geminiApiKey])

  const architectureFlow = useMemo(
    () => ['Kitchen Cameras', 'AI Vision Engine', 'Backend Intelligence', 'Dashboard'],
    [],
  )

  const openReorder = () => {
    setModalOpen(true)
    setModalLoading(true)
    window.setTimeout(() => setModalLoading(false), 1400)
  }

  const prependEvent = (event) => {
    setEvents((current) => [{ ...event, id: Date.now() }, ...current].slice(0, 8))
  }

  const showToast = (message, tone = 'emerald') => {
    setToast({ message, tone, id: Date.now() })
    window.setTimeout(() => setToast(null), 2600)
  }

  const sendFinalReport = async () => {
    if (isReporting) return

    setIsReporting(true)
    try {
      const flaggedInventory = inventory.filter((item) => item.status !== 'Optimized')
      const flaggedInventoryText =
        flaggedInventory.length > 0
          ? flaggedInventory.map((item) => `- ${item.name}: ${item.stock}% (${item.status})`).join('\n')
          : '- All inventory items currently optimized.'
      const reportBody = [
        'SousVision AI: Autonomous Infrastructure Shift Audit',
        '',
        `Generated At: ${new Date().toLocaleString('en-US')}`,
        '',
        'KPI SUMMARY',
        `- Active Risks: ${metrics.risks}`,
        `- Operational Efficiency Index: ${metrics.efficiency}%`,
        `- Daily Waste Saved: ${metrics.wasteSaved}`,
        '',
        'INVENTORY REQUIRING ACTION',
        flaggedInventoryText,
      ].join('\n')

      const reportPayload = {
        to_email: 'manager@sousvision.ai',
        report_title: 'SousVision AI: Autonomous Infrastructure Shift Audit',
        report_body: reportBody,
        active_risks: String(metrics.risks),
        efficiency: `${metrics.efficiency}%`,
        waste_saved: String(metrics.wasteSaved),
        flagged_inventory: flaggedInventoryText,
      }

      await sleep(2000)
      console.log('Finalized Shift Report Payload:', reportPayload)
      showToast('Report Compiled & Dispatched to Manager Console', 'emerald')
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`)
      showToast('Manager report dispatch failed', 'red')
    } finally {
      setIsReporting(false)
    }
  }

  const statusTone = (status) => {
    if (status === 'Critical') return 'red'
    if (status === 'Warning') return 'amber'
    return 'green'
  }

  const statusClasses = (status) => {
    if (status === 'Critical') return 'text-red-300 border-red-500/40 bg-red-500/10 shadow-[0_0_18px_rgba(239,68,68,0.25)]'
    if (status === 'Warning') return 'text-amber-300 border-amber-500/40 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.22)]'
    return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.22)]'
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraReady(true)
      setCameraError('')
    } catch {
      setCameraError('Camera access blocked. Please allow webcam permissions.')
      setCameraReady(false)
    }
  }

  const imageUrlToBase64 = async (url) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unable to load image: ${url}`)
    }
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const raw = String(reader.result || '')
        resolve(raw.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''))
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const analyzeWithGemini = async (zone) => {
    const imagePath = zone.image
    const base64Image = await imageUrlToBase64(imagePath)
    let lastError = new Error('Gemini request failed')

    for (const modelPath of GEMINI_MODEL_PATHS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1/${modelPath}:generateContent?key=${geminiApiKey}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${AUDIT_PROMPT}\nZone: ${zone.id} - ${zone.name}` },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        lastError = new Error(`Gemini request failed for ${modelPath}`)
        continue
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      const clean = String(text || '').replace(/```json|```/g, '').trim()
      return JSON.parse(clean)
    }

    throw lastError
  }

  const createMockAudit = (zoneId) => {
    if (zoneId === 'B') {
      return {
        detection: 'Bold Spill Risk On Cooking Lane',
        status: 'Critical',
        action: 'Deploy Sanitation',
        aura_score: -68,
      }
    }
    if (zoneId === 'C') {
      return {
        detection: 'Bold Low Stock Velocity Pattern',
        status: 'Warning',
        action: 'Issue Smart Reorder Draft',
        aura_score: 18,
      }
    }
    if (zoneId === 'D') {
      return {
        detection: 'Bold Waste Sorting Opportunity',
        status: 'Warning',
        action: 'Activate Waste Diversion Protocol',
        aura_score: 36,
      }
    }
    return {
      detection: 'Bold Hazard Pattern At Prep Boundary',
      status: 'Healthy',
      action: 'Maintain Observational Audit',
      aura_score: 44,
    }
  }

  const runZoneAudit = async (zone, fromSimulation = false) => {
    setIsAnalyzingMap((prev) => ({ ...prev, [zone.id]: true }))
    try {
      const result = geminiApiKey
        ? await analyzeWithGemini(zone)
        : createMockAudit(zone.id)
      setZoneAudits((prev) => ({ ...prev, [zone.id]: result }))

      if (zone.id === 'B' && result.status === 'Critical') {
        setHazardMode(true)
        setMetrics((current) => ({ ...current, risks: Math.max(1, current.risks + 1) }))
        prependEvent({
          type: 'hazard',
          title: 'Hazard Detected: Spill risk on Cooking feed',
          timestamp: getTimeStamp(),
          critical: true,
        })
        showToast('Hazard Detected', 'red')
      }

      if (zone.id === 'C') {
        setMetrics((current) => ({ ...current, stockHealth: result.status === 'Healthy' ? 91 : 78 }))
        prependEvent({
          type: 'logistics',
          title: 'Storage audit completed with stock trend update',
          timestamp: getTimeStamp(),
          critical: false,
        })
      }

      if (zone.id === 'D') {
        setWasteSenseScore((current) => Math.max(60, Math.min(99, current + Math.round(result.aura_score / 20))))
        prependEvent({
          type: 'compliance',
          title: 'WasteSense card updated from Deep Audit',
          timestamp: getTimeStamp(),
          critical: false,
        })
      }
    } catch {
      const fallback = createMockAudit(zone.id)
      setZoneAudits((prev) => ({ ...prev, [zone.id]: fallback }))
      showToast(`Gemini unavailable for Zone ${zone.id}`, 'amber')
    } finally {
      setIsAnalyzingMap((prev) => ({ ...prev, [zone.id]: false }))
      if (fromSimulation) {
        setSelectedZone(zone)
      }
    }
  }

  const runAllAudits = async () => {
    await Promise.all(ZONES.map((zone) => runZoneAudit(zone)))
  }

  useEffect(() => {
    startCamera()
    return () => {
      streamRef.current?.getTracks()?.forEach((track) => track.stop())
    }
  }, [])

  const kitchenAuraScore = useMemo(() => {
    const audits = ZONES.map((zone) => zoneAudits[zone.id]).filter(Boolean)
    if (audits.length === 0) return 0
    const total = audits.reduce((sum, audit) => sum + Number(audit.aura_score || 0), 0)
    return Math.round(total / audits.length)
  }, [zoneAudits])

  const selectedAudit = selectedZone ? zoneAudits[selectedZone.id] : null
  const activeAudit = selectedAudit || liveAuditResult

  const openSimulationByType = async (type) => {
    if (type === 'spill') {
      await runZoneAudit(ZONES[1], true)
      return
    }
    if (type === 'stock') {
      await runZoneAudit(ZONES[2], true)
      return
    }
    if (type === 'hazard') {
      await runZoneAudit(ZONES[0], true)
      return
    }
    if (type === 'waste') {
      await runZoneAudit(ZONES[3], true)
      return
    }
  }

  const parseGeminiText = (text) => {
    const clean = String(text || '').replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const getMockAuditResult = () => {
    const mockStatus = MOCK_AUDIT_RESPONSE?.results?.riskLevel === 'High' ? 'Critical' : 'Warning'
    return {
      detection: MOCK_AUDIT_RESPONSE?.results?.detection || 'Liquid Spill',
      status: mockStatus,
      action: MOCK_AUDIT_RESPONSE?.results?.action || 'Immediate Cleanup Required',
      aura_score: Number(MOCK_AUDIT_RESPONSE?.auraScore || 72),
    }
  }

  const applyLiveAuditResult = (result) => {
    setLiveAuditResult(result)
    setDashboardStatus(result.status || 'Healthy')
    setSystemLog('[SECURE_LOG]: Audit completed. Action dispatched.')
    showToast('Live audit completed', statusTone(result.status || 'Healthy'))
    prependEvent({
      type: result.status === 'Critical' ? 'hazard' : result.status === 'Warning' ? 'logistics' : 'compliance',
      title: `Live Audit: ${result.detection}`,
      timestamp: getTimeStamp(),
      critical: result.status === 'Critical',
    })
  }

  const isRateLimitError = (error) => {
    const message = String(
      (error && typeof error === 'object' && 'message' in error && error.message) || error || ''
    )
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number(error.status)
        : Number.NaN

    return status === 429 || /429|resource_exhausted|rate limit/i.test(message)
  }

  const performLiveAudit = async () => {
    if (isAnalyzing) return

    const videoEl = videoRef.current
    const canvas = canvasRef.current
    if (!videoEl || !canvas || !cameraReady) {
      showToast('Live feed unavailable', 'amber')
      return
    }

    setIsAnalyzing(true)
    setFlashFrame(true)
    window.setTimeout(() => setFlashFrame(false), 180)
    setIsLiveAuditing(true)

    try {
      canvas.width = videoEl.videoWidth || 1280
      canvas.height = videoEl.videoHeight || 720
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5)
      const imageData = dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')

      let result
      if (isMockMode) {
        await sleep(2000)
        result = getMockAuditResult()
      } else if (genAI) {
        let lastError = new Error('Gemini live audit failed')

        for (const modelName of GEMINI_MODELS) {
          try {
            const liveAuditPrompt = `${LIVE_AUDIT_PROMPT}\nReturn ONLY valid JSON with no markdown fences.`
            const model = genAI.getGenerativeModel(
              {
                model: modelName,
              },
              { apiVersion: 'v1' }
            );
            const response = await model.generateContent([
              { text: liveAuditPrompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageData } },
            ])
            result = parseGeminiText(response.response.text())
            break
          } catch (error) {
            lastError = error instanceof Error ? error : new Error('Gemini live audit failed')
          }
        }

        if (!result) {
          throw lastError
        }
      } else {
        result = getMockAuditResult()
      }

      applyLiveAuditResult(result)
    } catch (error) {
      if (!isMockMode && isRateLimitError(error)) {
        setIsMockMode(true)
        applyLiveAuditResult(getMockAuditResult())
        showToast('Gemini rate-limited. Switched to Mock Mode.', 'amber')
        return
      }
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`)
      showToast('Audit failed - check Gemini key', 'red')
    } finally {
      setIsAnalyzing(false)
      setIsLiveAuditing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <main className={`mx-auto flex w-full max-w-[1920px] flex-col gap-4 p-4 lg:p-6 ${dominantAccent}`}>
        <header className="glass-card p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-wide text-zinc-100 lg:text-2xl">
              SousVision AI - Autonomous Kitchen Infrastructure
            </h1>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1 text-xs uppercase tracking-[0.25em] text-zinc-400">
                Command Center Live
              </span>
              <span className={`rounded-full border px-3 py-1 font-mono text-xs ${kitchenAuraScore < 0 ? 'border-red-500/40 text-red-300' : kitchenAuraScore < 35 ? 'border-amber-500/40 text-amber-300' : 'border-emerald-500/40 text-emerald-300'}`}>
                Kitchen Aura Score: {kitchenAuraScore}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STAT_CONFIG.map(({ key, label, icon, tone }) => {
              const isCritical = tone === 'red' || (key === 'stockHealth' && metrics.stockHealth < 80)
              return (
                <Motion.article
                  key={key}
                  animate={isCritical ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                  transition={{ repeat: isCritical ? Infinity : 0, duration: 1.8 }}
                  className={`glass-card border p-4 ${toneClasses[tone]}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{label}</p>
                    {createElement(icon, { size: 18, className: toneClasses[tone].split(' ')[0] })}
                  </div>
                  <p className="font-mono text-2xl font-semibold text-zinc-100">
                    {typeof metrics[key] === 'number' && key !== 'risks' ? `${metrics[key]}${key === 'efficiency' || key === 'stockHealth' ? '%' : ''}` : metrics[key]}
                  </p>
                </Motion.article>
              )
            })}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <aside className="space-y-4 xl:col-span-3">
            <div className="glass-card p-4">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
                System Flow Representation
              </h2>
              <div className="space-y-2 text-sm">
                {architectureFlow.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <p>{step}</p>
                    {index < architectureFlow.length - 1 && <span className="ml-auto text-zinc-500">→</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Leaf size={16} className="text-violet-300" />
                <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
                  WasteSense
                </h2>
              </div>
              <p className="font-mono text-3xl text-violet-200">{wasteSenseScore}</p>
              <p className="mt-1 text-xs text-zinc-400">Sustainability Score</p>
            </div>

            <div className="glass-card p-4">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
                Autonomous Inventory Matrix
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="pb-2">Ingredient Name</th>
                      <th className="pb-2">Current Stock %</th>
                      <th className="pb-2">AI Action Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {inventory.map((item) => (
                      <tr key={item.name}>
                        <td className="py-3 font-medium text-zinc-200">{item.name}</td>
                        <td className="py-3">
                          <div className="w-44">
                            <div className="mb-1 flex items-center justify-between font-mono text-xs">
                              <span>{item.stock}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-800">
                              <Motion.div
                                initial={false}
                                animate={{ width: `${item.stock}%` }}
                                transition={{ duration: 0.7 }}
                                className={`h-full rounded-full ${
                                  item.stock < 20
                                    ? 'bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                                    : item.stock < 40
                                      ? 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                                      : 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`rounded-md border px-2 py-1 text-xs ${statusStyles[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={openReorder}
                            className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:border-emerald-500/40 hover:text-emerald-300"
                          >
                            Smart Reorder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card p-4">
              <button
                onClick={sendFinalReport}
                disabled={isReporting}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReporting && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-emerald-300/40 border-t-emerald-200" />
                )}
                {isReporting ? 'COMPILING DATA...' : 'GENERATE FINAL MANAGER REPORT'}
              </button>
            </div>
          </aside>

          <section className="glass-card relative overflow-hidden p-4 xl:col-span-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
                Omni-Eye Vision Feed
              </h2>
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Neural Inference Active
              </div>
            </div>
            <div className="feed-card relative mb-3 h-72 overflow-hidden rounded-xl border border-zinc-700/70">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover [transform:scaleX(-1)]"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute left-3 top-3 z-20 rounded-md bg-zinc-950/80 px-2 py-1 text-xs font-bold text-white">
                CCTV Monitor - Live Capture
              </div>
              <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                LIVE FEED
              </div>
              <Motion.div
                className="pointer-events-none absolute left-0 top-0 z-20 h-full w-1 bg-cyan-300/50"
                animate={{ x: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
              />
              <Motion.div
                className="pointer-events-none absolute left-0 z-20 h-8 w-full bg-gradient-to-b from-cyan-300/50 via-cyan-300/25 to-transparent"
                animate={{ y: ['-12%', '105%'] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
              />
              {cameraError && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-red-300">
                  {cameraError}
                </div>
              )}
              {isLiveAuditing && (
                <div className="absolute inset-0 z-30 flex items-end bg-black/40 p-3">
                  <p className="rounded-md bg-zinc-950/80 px-3 py-1 font-mono text-xs text-cyan-300">
                    Processing Neural Feed...
                  </p>
                </div>
              )}
              <AnimatePresence>
                {flashFrame && (
                  <Motion.div
                    initial={{ opacity: 0.7 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0 z-40 bg-white"
                  />
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={performLiveAudit}
              disabled={isAnalyzing || !cameraReady}
              className="mb-3 w-full rounded-lg border border-cyan-300/50 bg-cyan-400/15 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : 'Perform AI Audit'}
            </button>
            <div className="relative mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {ZONES.map((zone) => {
                const audit = zoneAudits[zone.id]
                const tone = statusTone(audit?.status)
                return (
                  <Motion.button
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    animate={
                      tone === 'red'
                        ? { boxShadow: ['0 0 0 rgba(239,68,68,0.1)', '0 0 24px rgba(239,68,68,0.4)', '0 0 0 rgba(239,68,68,0.1)'] }
                        : tone === 'amber'
                          ? { boxShadow: ['0 0 0 rgba(245,158,11,0.1)', '0 0 24px rgba(245,158,11,0.35)', '0 0 0 rgba(245,158,11,0.1)'] }
                          : { boxShadow: ['0 0 0 rgba(16,185,129,0.08)', '0 0 24px rgba(16,185,129,0.3)', '0 0 0 rgba(16,185,129,0.08)'] }
                    }
                    transition={{ repeat: Infinity, duration: 1.9 }}
                    className={`feed-card relative h-56 overflow-hidden rounded-xl border border-zinc-700/70 text-left ${selectedZone?.id === zone.id ? 'ring-1 ring-cyan-300/40' : ''}`}
                  >
                    <img src={zone.image} alt={`${zone.name} feed`} className="h-full w-full object-cover opacity-85" />
                    <div className="absolute left-3 top-3 z-20 rounded-md bg-zinc-950/80 px-2 py-1 text-xs font-bold text-white">
                      Zone {zone.id} - {zone.name}
                    </div>
                    <div className={`absolute right-3 top-3 z-20 rounded-md border px-2 py-1 text-[11px] ${statusClasses(audit?.status || 'Healthy')}`}>
                      {audit?.status || 'Monitoring'}
                    </div>
                    <svg className="absolute inset-0 z-10 h-full w-full">
                      <Motion.rect
                        x="16%"
                        y="24%"
                        width="26%"
                        height="30%"
                        stroke={tone === 'red' ? '#ef4444' : tone === 'amber' ? '#f59e0b' : '#10b981'}
                        fill="transparent"
                        strokeWidth="2"
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ repeat: Infinity, duration: 1.3 }}
                      />
                    </svg>
                    <Motion.div
                      className="pointer-events-none absolute left-0 top-0 z-20 h-full w-1 bg-cyan-300/50"
                      animate={{ x: ['0%', '100%', '0%'] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    />
                    <Motion.div
                      className="pointer-events-none absolute left-0 z-20 h-8 w-full bg-gradient-to-b from-cyan-300/45 via-cyan-300/25 to-transparent"
                      animate={{ y: ['-12%', '106%'] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                    />
                    <AnimatePresence>
                      {isAnalyzingMap[zone.id] && (
                        <Motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-30 flex items-end bg-black/45 p-3"
                        >
                          <p className="rounded-md bg-zinc-950/80 px-3 py-1 font-mono text-xs text-cyan-300">
                            Processing Neural Feed...
                          </p>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </Motion.button>
                )
              })}
            </div>

            <div className="glass-card mt-3 border p-3">
              <div className="mb-2 flex items-center gap-2 text-zinc-300">
                <Bot size={14} />
                <p className="text-xs uppercase tracking-[0.15em]">The Audit Brain</p>
              </div>
              {activeAudit ? (
                <div className={`space-y-1 rounded-lg border p-3 ${statusClasses(activeAudit.status)}`}>
                  <p className="text-xs"><span className="font-bold text-white">Detection:</span> <span className="font-mono">{activeAudit.detection}</span></p>
                  <p className="text-xs"><span className="font-bold text-white">Status:</span> <span className="font-mono">{activeAudit.status}</span></p>
                  <p className="text-xs"><span className="font-bold text-white">Action:</span> <span className="font-mono">{activeAudit.action}</span></p>
                  <p className="font-mono text-xs"><span className="font-bold text-white">Aura Score:</span> {activeAudit.aura_score}</p>
                  {selectedZone?.id === 'C' && (
                    <button className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.13em] text-emerald-300">
                      Draft Order
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Select a zone for a deep audit snapshot.</p>
              )}
            </div>
          </section>

          <aside className="glass-card h-[620px] p-4 xl:col-span-3">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
              Real-time Incident Stream
            </h2>
            <div className="h-[560px] space-y-3 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {events.map((event) => {
                  const style = eventStyles[event.type]
                  const EventIcon = style.icon
                  return (
                    <Motion.article
                      key={event.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.25 }}
                      className={`glass-card border-l-2 p-3 ${style.border}`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                        <EventIcon size={14} className={style.iconColor} />
                        <span className="font-mono">{event.timestamp}</span>
                      </div>
                      <Motion.p
                        animate={event.critical ? { opacity: [1, 0.75, 1] } : { opacity: 1 }}
                        transition={{ repeat: event.critical ? Infinity : 0, duration: 1.4 }}
                        className="text-sm text-zinc-200"
                      >
                        {event.title}
                      </Motion.p>
                    </Motion.article>
                  )
                })}
              </AnimatePresence>
            </div>
          </aside>
        </section>

        <footer className="glass-card sticky bottom-3 z-40 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Flame size={16} className={hazardMode ? 'text-red-400' : 'text-emerald-400'} />
            <span>{hazardMode ? 'Emergency Response Mode' : 'Optimized Autonomous Operations'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openSimulationByType('spill')}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/20"
            >
              Simulate Leak
            </button>
            <button
              onClick={() => openSimulationByType('stock')}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300 transition hover:bg-amber-500/20"
            >
              Simulate Stock Out
            </button>
            <button
              onClick={() => openSimulationByType('hazard')}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/20"
            >
              Simulate Hazard
            </button>
            <button
              onClick={() => openSimulationByType('waste')}
              className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300 transition hover:bg-violet-500/20"
            >
              Simulate Waste
            </button>
            <button
              onClick={runAllAudits}
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:bg-cyan-500/20"
            >
              Re-Audit All Zones
            </button>
          </div>
        </footer>
        <div className="px-1 pb-1 font-mono text-xs text-zinc-300">
          {systemLog || '[SECURE_LOG]: Awaiting audit execution.'}
        </div>
      </main>

      <AnimatePresence>
        {selectedZone && selectedAudit && (
          <Motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedZone(null)}
          >
            <Motion.div
              onClick={(event) => event.stopPropagation()}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className={`glass-card w-full max-w-2xl border p-5 ${statusClasses(selectedAudit.status)}`}
            >
              <h3 className="mb-3 text-lg font-semibold text-zinc-100">
                Deep Audit - Zone {selectedZone.id} ({selectedZone.name})
              </h3>
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-400">
                Full Gemini JSON
              </p>
              <pre className="overflow-auto rounded-md border border-zinc-700/80 bg-zinc-950/70 p-3 font-mono text-xs text-zinc-200">
                {JSON.stringify(selectedAudit, null, 2)}
              </pre>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setSelectedZone(null)}
                  className="rounded-md border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs uppercase tracking-[0.12em]"
                >
                  Close
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[60] rounded-lg border px-4 py-2 text-sm ${
              toast.tone === 'red'
                ? 'border-red-500/40 bg-red-500/15 text-red-200'
                : toast.tone === 'amber'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {toast.message}
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <Motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Motion.div
              className="glass-card w-full max-w-xl border border-white/15 p-6"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
            >
              <h3 className="mb-4 text-lg font-semibold text-zinc-100">Smart Reorder Assistant</h3>
              {modalLoading ? (
                <Motion.p
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="font-mono text-emerald-300"
                >
                  Gemini is thinking...
                </Motion.p>
              ) : (
                <div className="space-y-3 text-sm text-zinc-200">
                  <p className="font-semibold">Subject: Ingredient Reorder Request</p>
                  <p>Dear Supplier,</p>
                  <p>Based on current kitchen consumption patterns we need to restock:</p>
                  <p className="pl-2">
                    • Flour - 25kg
                    <br />• Tomatoes - 15kg
                  </p>
                  <p>Please confirm availability.</p>
                  <p>Regards<br />Kitchen Ops</p>
                  <div className="flex justify-end gap-2 pt-3">
                    <button className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
                      Send Email
                    </button>
                    <button
                      onClick={() => setModalOpen(false)}
                      className="rounded-md border border-zinc-600 bg-zinc-900/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
