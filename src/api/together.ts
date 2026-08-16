// Watch Together — client for the host-authoritative sync rooms.
// The React app owns this socket; the player <iframe> exchanges playback ticks
// with React via postMessage (see PlayerPage).

const PROXY_KEY = 'd3ffb0843f89eedefe80efec1dda7a2b97fa9645934a3ce4'
const WS_URL = `wss://aniapi.denanz.fun:8444/api/v1/together?key=${PROXY_KEY}`

export interface WtContent {
  releaseId: string
  sourceId: number
  position: number
  episodeName: string
  releaseName?: string
  dubberName?: string
  sourceName?: string
  totalEpisodes?: number
  kodikUrl?: string // host-resolved stream url — lets guests play without a token
  titleOriginal?: string
  animelibTeam?: string
}
// `at` — server clock at the moment this was recorded. Needed to correct for
// however long the message has been in flight before a guest applies it
// (see WatchRoom.estimateElapsedMs) — applying `time` as-is has the guest
// permanently landing behind by however much the message took to arrive,
// which is exactly the "lags a couple seconds then snaps forward" pattern.
export interface WtPlayback { time: number; paused: boolean; at?: number }

export interface WtHandlers {
  onCreated?: (room: string) => void
  onJoined?: (data: { room: string; content: WtContent | null; pb: WtPlayback | null; queue: WtContent[]; host: boolean }) => void
  onContent?: (content: WtContent) => void
  onPlayback?: (pb: WtPlayback) => void
  onQueue?: (queue: WtContent[]) => void
  onPeers?: (count: number) => void
  onHostLeft?: () => void
  onError?: (error: string) => void
  onClose?: () => void
  onOpen?: () => void
  // Connection recovery — distinct from onClose/onOpen so the UI can show
  // "переподключаюсь…" instead of just going silent (see the file header).
  onReconnecting?: (attempt: number) => void
  onReconnected?: () => void
  onReconnectFailed?: () => void
}

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000, 8000]
const SYNC_INTERVAL_MS = 15_000

export class WatchRoom {
  private ws: WebSocket | null = null
  private handlers: WtHandlers
  role: 'host' | 'guest' | null = null
  code: string | null = null
  private hostToken: string | null = null
  private closedByUser = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  // Estimated (serverNow - clientNow) and one-way network latency, refined
  // every SYNC_INTERVAL_MS via the 'sync' echo — same idea as an NTP offset.
  private clockOffsetMs = 0
  private latencyMs = 100

  constructor(handlers: WtHandlers) {
    this.handlers = handlers
  }

  private startSync() {
    const ping = () => this.send({ t: 'sync', ct: Date.now() })
    ping()
    this.syncTimer = setInterval(ping, SYNC_INTERVAL_MS)
  }

  private stopSync() {
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.syncTimer = null
  }

  private handleSync(ct: number, st: number) {
    const now = Date.now()
    const rtt = Math.max(0, now - ct)
    this.latencyMs = rtt / 2
    this.clockOffsetMs = st - ct - this.latencyMs
  }

  /** How many ms have elapsed (in server time) since a playback state with
   *  server-timestamp `at` was recorded — 0 if `at` is missing (older/local
   *  state) so callers degrade to today's exact-time behavior. */
  estimateElapsedMs(at?: number): number {
    if (!at) return 0
    const serverNow = Date.now() + this.clockOffsetMs
    return Math.max(0, serverNow - at)
  }

  private connect(onOpen: () => void) {
    const ws = new WebSocket(WS_URL)
    this.ws = ws
    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.startSync()
      this.handlers.onOpen?.()
      onOpen()
    }
    ws.onclose = () => {
      this.stopSync()
      this.handlers.onClose?.()
      if (!this.closedByUser) this.scheduleReconnect()
    }
    ws.onerror = () => this.handlers.onError?.('connection')
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>
      try { m = JSON.parse(ev.data) } catch { return }
      switch (m.t) {
        case 'sync':
          this.handleSync(Number(m.ct) || 0, Number(m.st) || 0); break
        case 'created': {
          this.code = String(m.room); this.role = 'host'
          if (typeof m.hostToken === 'string') this.hostToken = m.hostToken
          // The server marks a successful 'rejoin_host' with resumed:true —
          // a fresh 'create' never sets it, so this alone tells creation and
          // reconnection apart without tracking our own attempt count here.
          if (m.resumed) this.handlers.onReconnected?.()
          else this.handlers.onCreated?.(this.code)
          break
        }
        case 'joined':
          this.code = String(m.room); this.role = 'guest'
          this.handlers.onJoined?.({
            room: this.code,
            content: (m.content as WtContent) ?? null,
            pb: (m.pb as WtPlayback) ?? null,
            queue: (m.queue as WtContent[]) ?? [],
            host: !!m.host,
          })
          if (this.reconnectAttempt > 0) this.handlers.onReconnected?.()
          break
        case 'content': this.handlers.onContent?.(m.content as WtContent); break
        case 'pb': this.handlers.onPlayback?.({ time: Number(m.time) || 0, paused: !!m.paused, at: Number(m.at) || undefined }); break
        case 'queue': this.handlers.onQueue?.((m.queue as WtContent[]) ?? []); break
        case 'peers': this.handlers.onPeers?.(Number(m.count) || 0); break
        case 'host_left': this.handlers.onHostLeft?.(); break
        case 'error': this.handlers.onError?.(String(m.error)); break
      }
    }
  }

  private scheduleReconnect() {
    if (!this.code || this.reconnectTimer) return
    if (this.reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      this.handlers.onReconnectFailed?.()
      return
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt]!
    this.reconnectAttempt += 1
    this.handlers.onReconnecting?.(this.reconnectAttempt)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closedByUser || !this.code) return
      if (this.role === 'host' && this.hostToken) {
        this.connect(() => this.send({ t: 'rejoin_host', room: this.code, token: this.hostToken }))
      } else if (this.role === 'guest') {
        this.connect(() => this.send({ t: 'join', room: this.code }))
      }
    }, delay)
  }

  private send(obj: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  create() { this.connect(() => this.send({ t: 'create' })) }
  join(code: string) { this.code = code.toUpperCase(); this.connect(() => this.send({ t: 'join', room: this.code })) }

  sendContent(content: WtContent) { this.send({ t: 'content', content }) }
  sendPlayback(pb: WtPlayback) { this.send({ t: 'pb', time: pb.time, paused: pb.paused }) }
  sendQueue(queue: WtContent[]) { this.send({ t: 'queue', queue }) }

  close() {
    this.closedByUser = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopSync()
    try { this.ws?.close() } catch { /* ignore */ }
    this.ws = null
  }
}
