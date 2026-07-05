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
}
export interface WtPlayback { time: number; paused: boolean }

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
}

export class WatchRoom {
  private ws: WebSocket | null = null
  private handlers: WtHandlers
  role: 'host' | 'guest' | null = null
  code: string | null = null

  constructor(handlers: WtHandlers) {
    this.handlers = handlers
  }

  private connect(onOpen: () => void) {
    const ws = new WebSocket(WS_URL)
    this.ws = ws
    ws.onopen = () => { this.handlers.onOpen?.(); onOpen() }
    ws.onclose = () => this.handlers.onClose?.()
    ws.onerror = () => this.handlers.onError?.('connection')
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>
      try { m = JSON.parse(ev.data) } catch { return }
      switch (m.t) {
        case 'created':
          this.code = String(m.room); this.role = 'host'
          this.handlers.onCreated?.(this.code); break
        case 'joined':
          this.code = String(m.room); this.role = 'guest'
          this.handlers.onJoined?.({
            room: this.code,
            content: (m.content as WtContent) ?? null,
            pb: (m.pb as WtPlayback) ?? null,
            queue: (m.queue as WtContent[]) ?? [],
            host: !!m.host,
          }); break
        case 'content': this.handlers.onContent?.(m.content as WtContent); break
        case 'pb': this.handlers.onPlayback?.({ time: Number(m.time) || 0, paused: !!m.paused }); break
        case 'queue': this.handlers.onQueue?.((m.queue as WtContent[]) ?? []); break
        case 'peers': this.handlers.onPeers?.(Number(m.count) || 0); break
        case 'host_left': this.handlers.onHostLeft?.(); break
        case 'error': this.handlers.onError?.(String(m.error)); break
      }
    }
  }

  private send(obj: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  create() { this.connect(() => this.send({ t: 'create' })) }
  join(code: string) { this.connect(() => this.send({ t: 'join', room: code.toUpperCase() })) }

  sendContent(content: WtContent) { this.send({ t: 'content', content }) }
  sendPlayback(pb: WtPlayback) { this.send({ t: 'pb', time: pb.time, paused: pb.paused }) }
  sendQueue(queue: WtContent[]) { this.send({ t: 'queue', queue }) }
  sendControl(pb: WtPlayback) { this.send({ t: 'control', time: pb.time, paused: pb.paused }) }

  close() { try { this.ws?.close() } catch { /* ignore */ } this.ws = null }
}
