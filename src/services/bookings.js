// Customer bookings: the ₹20 booking fee holds a time with a stylist and a place in the salon's queue
import { ANY_STYLIST, BOOKING_DAYS, DEFAULT_MINS, busyMap, daySlots, durationOf, freeStylists } from '../../../shared/availability.js'
import { BOOKING_FEE, RESPOND_WINDOW_MS } from '../../../shared/catalog.js'
import { addDays, isoDate } from '../../../shared/format.js'
import { badRequest, conflict, uid } from '../lib/http.js'
import { Booking } from '../models/index.js'
import { plain, takeToken } from './queue.js'

const METHODS = ['UPI', 'Card', 'Net banking']
const paymentRef = () => `pay_${Math.random().toString(36).slice(2, 10).toUpperCase()}`

// Bookings that hold stylist time on a day, in the shape shared/availability.js expects
async function takenOn(salonId, date) {
  const list = await Booking.find({ salonId, date, slot: { $ne: null } }, { _id: 1, salonId: 1, date: 1, slot: 1, stylist: 1, services: 1, status: 1 }).lean()
  return list.map(({ _id, ...b }) => ({ id: _id, ...b }))
}

export async function createBooking(salonDoc, customer, body) {
  const salon = plain(salonDoc)
  const today = isoDate()
  const { date, method, stylist: wanted = ANY_STYLIST } = body
  const slot = body.slot == null ? null : Number(body.slot)

  if (salon.suspended || !salon.bookingOpen) throw conflict('This salon has paused online bookings. You can still walk in.')
  if (!date || date < today || date > addDays(today, BOOKING_DAYS - 1)) throw badRequest(`Pick a date within the next ${BOOKING_DAYS} days.`)
  if (!METHODS.includes(method)) throw badRequest('Choose a payment method.')

  const services = salon.services.filter((s) => (body.serviceIds ?? []).includes(s.id)).map(({ id, name, price, mins }) => ({ id, name, price, mins }))
  if ((body.serviceIds ?? []).length !== services.length) throw badRequest('Some services are no longer offered. Refresh and try again.')

  // Appointment bookings re-check the slot so two customers can't pay for the same stylist and time
  let stylist = wanted
  if (slot != null) {
    if (!daySlots(salon, date).includes(slot)) throw conflict('That time is no longer available.', { code: 'slot-taken' })
    const free = freeStylists(salon, slot, durationOf(services) || DEFAULT_MINS, busyMap(salon, date, await takenOn(salon.id, date)))
    const chosen = wanted === ANY_STYLIST ? free[0] : free.find((p) => p.name === wanted)
    if (!chosen) throw conflict('That time was just taken. Please pick another.', { code: 'slot-taken' })
    stylist = chosen.name
  } else if (wanted !== ANY_STYLIST && !salon.stylists.some((p) => p.name === wanted)) {
    throw badRequest('Choose a stylist from this salon.')
  }

  const now = Date.now()
  const needsConfirmation = salon.confirmMode === 'manual'
  const booking = {
    _id: uid('bk'),
    salonId: salon.id,
    date,
    slot,
    token: needsConfirmation ? null : await takeToken(salon, date),
    stylist: stylist === ANY_STYLIST ? 'Any available' : stylist,
    anyStylist: wanted === ANY_STYLIST,
    services,
    servicesTotal: services.reduce((sum, s) => sum + s.price, 0),
    fee: BOOKING_FEE,
    payment: { method, ref: paymentRef(), paidAt: now },
    status: needsConfirmation ? 'requested' : 'active',
    ...(needsConfirmation ? { respondBy: now + RESPOND_WINDOW_MS } : { acceptedAt: now }),
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    createdAt: now,
  }
  return Booking.create(booking)
}

// Self-managed salon accepts a request: it joins that day's queue
export async function acceptBooking(booking, salon) {
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  booking.token = await takeToken(salon, booking.date)
  booking.status = 'active'
  booking.acceptedAt = Date.now()
  return booking.save()
}

export async function answerProposal(booking, salon, accept) {
  if (booking.status !== 'proposed') throw conflict('There is no new time to answer.')
  if (!accept) {
    booking.status = 'cancelled'
    booking.refunded = true
    return booking.save()
  }
  booking.date = booking.proposal.date
  booking.arriveAt = booking.proposal.hour
  booking.token = await takeToken(salon, booking.date)
  booking.status = 'active'
  booking.acceptedAt = Date.now()
  return booking.save()
}
