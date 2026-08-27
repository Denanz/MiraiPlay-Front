import axios from 'axios'

// Отдельный порт API, минуя SNI-проксирование на 443: так бэкенд видит настоящий
// IP клиента и может банить по нему. Iframe плеера остаётся на обычном 443.
const BASE = 'https://aniapi.denanz.fun:8444'

// Ключ шлюза, должен совпадать с PROXY_KEY на бэкенде. Лежит в бандле и секретом
// не является, но не даёт использовать домен как бесплатный открытый прокси.
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
