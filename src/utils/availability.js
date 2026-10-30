// Stylist availability for appointment slots. Each day's calendar is built from real records (staff shifts, weekly offs,
// approved leave, desk appointments, app bookings, payment holds, chairs); bookings and desk changes are checked against it.

import { ANY_STYLIST, DEFAULT_MINS, RELEASED, SLOT_MINS } from '../config/catalog.js'
import { isoDate, toMins } from './dates.js'
import { isOffDay, isOnLeave } from './desk.js'

const blocks = (mins) => Math.max(1, Math.ceil(mins / SLOT_MINS))

export const durationOf = (services) => services.reduce((sum, s) => sum + s.mins, 0)

// 30-minute block starts touched by something running from `start` for `mins` (desk times can start on the quarter hour)
export function coveringBlocks(start, mins) {
  const out = []
  for (let b = Math.floor(start / SLOT_MINS) * SLOT_MINS; b < start + Math.max(mins, 1); b += SLOT_MINS) out.push(b)
  return out
}

// Every bookable start time for a day, as minutes after midnight. Today hides slots starting in the next 15 minutes.
export function daySlots(salon, date, now = new Date()) {
  const [open, close] = salon.hours
  const earliest = date === isoDate(now) ? now.getHours() * 60 + now.getMinutes() + 15 : 0
  const slots = []
  for (let m = open * 60; m < close * 60; m += SLOT_MINS) if (m >= earliest) slots.push(m)
  return slots
}

// One day's calendar for a salon: { stylists: { name: [busy block starts] }, full: [blocks with every chair taken] }.
//   staff        — the salon's DeskStaff records, matched to salon.stylists by name (shifts, weekly offs, archived)
//   leave        — the salon's leave requests (only approved leave counts)
//   appointments — desk appointments that day; bookings — app bookings that day; holds — unexpired payment holds that day
// A stylist with no staff record (a salon onboarded without its team yet) is free whenever the salon is open.
export function dayCalendar({ salon, date, staff = [], leave = [], appointments = [], bookings = [], holds = [] }) {
  const [open, close] = salon.hours
  const chairs = salon.meta?.chairs || Infinity
  const team = staff.filter((s) => s.role !== 'frontdesk')
  const names = new Set([...salon.stylists.map((p) => p.name), ...team.filter((s) => s.active).map((s) => s.name)])
  const busy = new Map([...names].map((n) => [n, new Set()]))
  const nameOf = new Map(team.map((s) => [s.id, s.name]))
  const inUse = new Map()

  for (const s of team) {
    const taken = busy.get(s.name)
    if (!taken) continue
    const away = !s.active || isOffDay(s, date) || isOnLeave(leave, s.id, date)
    const [from, to] = [toMins(s.shiftStart), toMins(s.shiftEnd)]
    for (let m = open * 60; m < close * 60; m += SLOT_MINS) if (away || m < from || m + SLOT_MINS > to) taken.add(m)
  }

  const occupy = (name, start, mins) => {
    for (const b of coveringBlocks(start, mins)) {
      busy.get(name)?.add(b)
      inUse.set(b, (inUse.get(b) ?? 0) + 1)
    }
  }
  for (const a of appointments) if (a.date === date && a.status !== 'cancelled' && a.status !== 'no-show') occupy(nameOf.get(a.staffId), a.start, a.mins)
  for (const b of bookings) if (b.date === date && b.slot != null && !RELEASED.includes(b.status)) occupy(b.stylist, b.slot, durationOf(b.services) || DEFAULT_MINS)
  for (const h of holds) if (h.date === date && h.slot != null) occupy(h.stylist, h.slot, h.mins)

  const sorted = (set) => [...set].sort((a, b) => a - b)
  return {
    stylists: Object.fromEntries([...busy].map(([name, set]) => [name, sorted(set)])),
    full: sorted(new Set([...inUse].filter(([, n]) => n >= chairs).map(([b]) => b))),
  }
}

// stylist name → Set of block starts that can't be booked, from a dayCalendar result.
// Blocks where every chair is taken are busy for everyone. No calendar yet (still loading) = nothing busy.
export function busyMap(salon, calendar) {
  const full = calendar?.full ?? []
  return new Map(salon.stylists.map((p) => [p.name, new Set([...(calendar?.stylists?.[p.name] ?? []), ...full])]))
}

// Stylists who can take the whole appointment starting at `slot` and still finish before closing
export function freeStylists(salon, slot, mins, busy) {
  if (slot + mins > salon.hours[1] * 60) return []
  return salon.stylists.filter((p) => {
    const taken = busy.get(p.name)
    for (let i = 0; i < blocks(mins); i++) if (taken?.has(slot + i * SLOT_MINS)) return false
    return true
  })
}

// The stylist who gets an app booking at `slot`: the one asked for, or the first free one for "any". Null when nobody can.
export function pickStylist(salon, date, calendar, slot, mins, wanted, now = new Date()) {
  if (!daySlots(salon, date, now).includes(slot)) return null
  const free = freeStylists(salon, slot, mins, busyMap(salon, calendar))
  return (wanted === ANY_STYLIST ? free[0] : free.find((p) => p.name === wanted))?.name ?? null
}

// Desk check for one named staff member at any start time (desk times needn't sit on the 30-minute grid)
export function isFree(calendar, name, start, mins) {
  const taken = new Set([...(calendar.stylists[name] ?? []), ...calendar.full])
  return coveringBlocks(start, mins).every((b) => !taken.has(b))
}

export const isChairFree = (calendar, start, mins) => coveringBlocks(start, mins).every((b) => !calendar.full.includes(b))

