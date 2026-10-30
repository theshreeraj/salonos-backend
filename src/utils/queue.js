// Live queue rules: queue keys, refunds on cancel, simulated booking requests
import { BOOKING_FEE, CANCEL_REFUND_HOURS, RESPOND_WINDOW_MS } from '../config/catalog.js'
import { isoDate } from './dates.js'

// FNV-1a: stable pseudo-random numbers from a string, so simulated data is the same on every load
export function hash(str) {
  let h = 2166136261
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export const queueKey = (salonId, date) => `${salonId}|${date}`

// Today's queue starts from the salon's live numbers; future days start with a few pre-booked tokens
export function defaultQueue(salon, date) {
  if (date === isoDate()) return { ...salon.queue }
  const prebooked = [...salon.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4
  return { serving: 0, next: prebooked + 1 }
}

// When the booking starts, as epoch ms. Token bookings with no time count from the hour they were told to arrive,
// or from opening.
export function startsAt(booking, salon) {
  const mins = booking.slot ?? (booking.arriveAt != null ? booking.arriveAt * 60 : salon.hours[0] * 60)
  return new Date(`${booking.date}T00:00:00`).getTime() + mins * 60000
}

// Whether a customer cancelling now gets the booking fee back: always before the salon confirms,
// otherwise only CANCEL_REFUND_HOURS or more before the start. (A salon cancelling always refunds.)
export function refundsOnCancel(booking, salon, now = Date.now()) {
  if (booking.status === 'requested' || booking.status === 'proposed') return true
  return startsAt(booking, salon) - now >= CANCEL_REFUND_HOURS * 3600000
}

// ---- Simulated booking requests from other app customers (self-managed salons) ----

const NAMES = ['Aarav Kulkarni', 'Rohan Deshpande', 'Kabir Shaikh', 'Yash Pawar', 'Siddharth Joshi', 'Omkar Jadhav', 'Ishaan More', 'Arjun Kale', 'Vivaan Gokhale', 'Aditya Shinde']
const NOTES = ['First visit — want a low skin fade', 'Running 5 min late, please hold my spot', 'Same as last time, short on the sides', '', '', '']

export function makeRequest(salon, now = Date.now()) {
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  const count = Math.random() < 0.4 ? 2 : 1
  const services = [...salon.services].sort(() => Math.random() - 0.5).slice(0, count)
  return {
    id: `rq-${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    synthetic: true,
    customerName: pick(NAMES),
    salonId: salon.id,
    date: isoDate(),
    token: null,
    stylist: Math.random() < 0.6 ? 'Any available' : pick(salon.stylists).name,
    services: services.map(({ id, name, price, mins }) => ({ id, name, price, mins })),
    servicesTotal: services.reduce((sum, x) => sum + x.price, 0),
    fee: BOOKING_FEE,
    note: pick(NOTES),
    payment: { method: 'UPI', ref: `pay_${Math.random().toString(36).slice(2, 10).toUpperCase()}`, paidAt: now },
    status: 'requested',
    respondBy: now + RESPOND_WINDOW_MS,
    createdAt: now,
  }
}
