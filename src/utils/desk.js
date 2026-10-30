// Front desk rules: staff schedules, leave, chairs and bills
import { weekday } from './dates.js'

export const isBookable = (s) => s.active && s.role !== 'frontdesk'
export const isLive = (a) => a.status !== 'cancelled' && a.status !== 'no-show'
export const overlaps = (a, start, mins) => a.start < start + mins && start < a.start + a.mins

export const isOffDay = (staff, date) => staff.offDays.includes(weekday(date))

export const isOnLeave = (leave, staffId, date) =>
  leave.some((l) => l.staffId === staffId && l.status === 'approved' && l.from <= date && date <= l.to)

// First chair (0-based) with nothing booked in the slot, or null when the salon is full
export function freeChair(appointments, chairs, date, start, mins, ignoreId) {
  const taken = new Set(
    appointments.filter((a) => a.id !== ignoreId && a.date === date && isLive(a) && overlaps(a, start, mins)).map((a) => a.chair),
  )
  for (let c = 0; c < chairs; c++) if (!taken.has(c)) return c
  return null
}

export const lineTotal = (items) => items.reduce((sum, i) => sum + i.qty * i.price, 0)
