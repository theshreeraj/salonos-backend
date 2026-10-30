// Loads the records behind each day's calendar and hands them to utils/availability.js, which decides what's free.
// The same calendar answers the customer app (GET /salons/:id/availability), app bookings, and the front desk.
import { BOOKING_DAYS, RELEASED } from '../config/catalog.js'
import { addDays } from '../utils/dates.js'
import { dayCalendar } from '../utils/availability.js'
import { Appointment, Booking, DeskStaff, Leave, SlotHold } from '../models/index.js'
import { plain } from './queue.js'

// ignore: { bookingId, holdId, appointmentId } — the record being moved or confirmed doesn't block itself
async function records(salonId, dates, ignore = {}) {
  const inDays = { $in: dates }
  const [staff, leave, appointments, bookings, holds] = await Promise.all([
    DeskStaff.find({ salonId }).lean(),
    Leave.find({ salonId, status: 'approved' }).lean(),
    Appointment.find({ salonId, date: inDays, status: { $nin: ['cancelled', 'no-show'] }, ...(ignore.appointmentId && { id: { $ne: ignore.appointmentId } }) }).lean(),
    Booking.find(
      { salonId, date: inDays, slot: { $ne: null }, status: { $nin: RELEASED }, ...(ignore.bookingId && { _id: { $ne: ignore.bookingId } }) },
      { date: 1, slot: 1, stylist: 1, services: 1, status: 1 },
    ).lean(),
    SlotHold.find({ salonId, date: inDays, status: 'held', expiresAt: { $gt: new Date() }, ...(ignore.holdId && { _id: { $ne: ignore.holdId } }) }).lean(),
  ])
  return { staff, leave, appointments, bookings, holds }
}

export async function loadCalendar(salonDoc, date, ignore) {
  const salon = plain(salonDoc)
  return dayCalendar({ salon, date, ...(await records(salon.id, [date], ignore)) })
}

// date → calendar for `days` days from `from`
export async function loadCalendars(salonDoc, from, days = BOOKING_DAYS) {
  const salon = plain(salonDoc)
  const dates = Array.from({ length: Math.min(Math.max(days, 1), BOOKING_DAYS) }, (_, i) => addDays(from, i))
  const all = await records(salon.id, dates)
  return Object.fromEntries(dates.map((date) => [date, dayCalendar({ salon, date, ...all })]))
}
