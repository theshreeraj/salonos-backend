// Customer bookings and the salon's answers to them. Rules live in services/bookings.js.
import { DECLINE_REASONS } from '../config/catalog.js'
import { Booking, Salon } from '../models/index.js'
import * as bookings from '../services/bookings.js'
import { canRunSalon } from '../services/scope.js'
import { badRequest, forbidden, notFound, requireFields } from '../utils/http.js'

async function load(id) {
  const booking = await Booking.findById(id)
  if (!booking) throw notFound('Booking')
  const salon = await Salon.findById(booking.salonId)
  return { booking, salon }
}

const isOwner = (req, booking) => req.customer && booking.customerId === req.customer._id

async function salonFor(req) {
  requireFields(req.body, ['salonId', 'date'])
  if (!req.customer.name) throw badRequest('Add your name before booking.')
  const salon = await Salon.findById(req.body.salonId)
  if (!salon) throw notFound('Salon')
  return salon
}

// Step 1 of paying: reserve the time and get a payment order. { hold, order: { id, amount }, keyId }
export async function hold(req, res) {
  const { hold, keyId } = await bookings.holdSlot(await salonFor(req), req.customer, req.body)
  res.status(201).json({ hold: hold.toJSON(), order: hold.order, keyId, expiresAt: hold.expiresAt })
}

export async function releaseHold(req, res) {
  await bookings.releaseHold(req.customer, req.params.id)
  res.status(204).end()
}

// Step 2: { holdId, method, paymentId, signature } from Razorpay Checkout
export async function pay(req, res) {
  requireFields(req.body, ['holdId'])
  res.status(201).json((await bookings.payForHold(req.customer, req.body)).toJSON())
}

// Development shortcut: hold + local payment + confirm in one call
export async function create(req, res) {
  const booking = await bookings.createBooking(await salonFor(req), req.customer, req.body)
  res.status(201).json(booking.toJSON())
}

// The customer, or staff who run the salon. Refund rules depend on who cancels and when.
export async function cancel(req, res) {
  const { booking, salon } = await load(req.params.id)
  const by = isOwner(req, booking) ? 'customer' : canRunSalon(req.staff, salon) ? 'salon' : null
  if (!by) throw forbidden()
  res.json((await bookings.cancelBooking(booking, salon, by)).toJSON())
}

// Customer answers a new time the salon suggested
export async function respond(req, res) {
  const { booking, salon } = await load(req.params.id)
  if (!isOwner(req, booking)) throw forbidden()
  res.json((await bookings.answerProposal(booking, salon, Boolean(req.body.accept))).toJSON())
}

// ---- Self-managed salons answer requests ----

async function loadForSalon(req) {
  const found = await load(req.params.id)
  if (!canRunSalon(req.staff, found.salon)) throw forbidden()
  return found
}

export async function accept(req, res) {
  const { booking, salon } = await loadForSalon(req)
  res.json((await bookings.acceptBooking(booking, salon)).toJSON())
}

export async function decline(req, res) {
  const { booking } = await loadForSalon(req)
  const reason = String(req.body.reason ?? '').trim()
  if (!reason) throw badRequest(`Give a reason, e.g. ${DECLINE_REASONS[0]}.`)
  res.json((await bookings.declineBooking(booking, reason)).toJSON())
}

export async function propose(req, res) {
  const { booking, salon } = await loadForSalon(req)
  res.json((await bookings.proposeTime(booking, salon, req.body)).toJSON())
}
