// Date helpers. Dates are local (Asia/Kolkata, see config/env.js) yyyy-mm-dd strings; times of day are minutes after midnight.

// Local-date ISO string (yyyy-mm-dd); toISOString alone would shift dates across the UTC boundary
export function isoDate(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function isOpenNow([open, close], now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60
  return h >= open && h < close
}

export function toMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
export const nowMins = (d = new Date()) => d.getHours() * 60 + d.getMinutes()
export const atMins = (date, mins) => new Date(`${date}T00:00:00`).getTime() + mins * 60000
export const weekday = (date) => new Date(`${date}T00:00:00`).getDay()
