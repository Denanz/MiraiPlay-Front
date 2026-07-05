import { Capacitor, registerPlugin } from '@capacitor/core'

interface WidgetBridgePlugin {
  sync(options: { kind: string; json: Record<string, unknown>; images: Record<string, string> }): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

// Pushes a small JSON snapshot (+ optional image URLs) to the native home-
// screen widgets. No-op outside the Android app. See WidgetBridge.java —
// there's no periodic background refresh; widgets show data as of the last
// time the matching page loaded it. Images are downloaded natively (plain
// https URL in, cached JPEG out) rather than fetched here — a WebView fetch()
// needs the server's CORS response to be readable, native HTTP doesn't care.
export async function syncWidget(
  kind: 'continue' | 'schedule' | 'stats' | 'screenshot',
  json: Record<string, unknown>,
  imageUrls?: Record<string, string>,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await WidgetBridge.sync({ kind, json, images: imageUrls || {} })
  } catch {
    /* best-effort — widgets just show stale/placeholder data */
  }
}
