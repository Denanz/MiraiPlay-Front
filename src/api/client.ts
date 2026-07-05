import axios from 'axios'

// Dedicated, directly-bound API port (not behind the 443 SNI passthrough) so the
// backend sees the real client IP — enables IP-based blocking. Player iframe stays
// on the standard 443 port (see PlayerPage).
const BASE = 'https://aniapi.denanz.fun:8444'

// Shared gateway key — must match backend PROXY_KEY. Embedded in the bundle
// (so not a real secret), but it locks the proxy to our own frontend and stops
// the domain from being used as a free open proxy by random clients/scanners.
const PROXY_KEY = 'd3ffb0843f89eedefe80efec1dda7a2b97fa9645934a3ce4'

export const api = axios.create({
  baseURL: BASE,
  headers: { 'X-Proxy-Key': PROXY_KEY },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('anixart_token')
  if (token) {
    config.params = { ...config.params, token }
  }
  return config
})
