// Customer bookings and the salon's answers to them
import { Router } from 'express'
import { DECLINE_REASONS } from '../../../shared/catalog.js'
import { addDays, isoDate } from '../../../shared/format.js'
import { badRequest, conflict, forbidden, notFound, requireFields } from '../lib/http.js'
import { requireCustomer } from '../middleware/auth.js'
import { Booking, Salon } from '../models/index.js'
import { acceptBooking, answerProposal, createBooking } from '../services/bookings.js'
import { canRunSalon } from '../services/scope.js'

const router = Router()

async function load(id) {
  const booking = await Booking.findById(id)
  if (!booking) throw notFound('Booking')
  const salon = await Salon.findById(booking.salonId)
  return { booking, salon }
}

const isOwner = (req, booking) => req.customer && booking.customerId === req.customer._id

router.post('/bookings', requireCustomer, async (req, res) => {
  requireFields(req.body, ['salonId', 'date', 'method'])
  if (!req.customer.name) throw badRequest('Add your name before booking.')
  const salon = await Salon.findById(req.body.salonId)
  if (!salon) throw notFound('Salon')
  const booking = await createBooking(salon, req.customer.toJSON(), req.body)
  res.status(201).json(booking.toJSON())
})

// Customer or salon cancels. Cancelling before the salon confirms refunds the booking fee.
router.post('/bookings/:id/cancel', async (req, res) => {
  const { booking, salon } = await load(req.params.id)
  if (!isOwner(req, booking) && !canRunSalon(req.staff, salon)) throw forbidden()
  if (!['requested', 'proposed', 'active'].includes(booking.status)) throw conflict('This booking is already closed.')
  if (booking.status === 'requested' || booking.status === 'proposed') booking.refunded = true
  booking.status = 'cancelled'
  await booking.save()
  res.json(booking.toJSON())
})

// Customer answers a new time the salon suggested
router.post('/bookings/:id/respond', requireCustomer, async (req, res) => {
  const { booking, salon } = await load(req.params.id)
  if (!isOwner(req, booking)) throw forbidden()
  res.json((await answerProposal(booking, salon, Boolean(req.body.accept))).toJSON())
})

// ---- Self-managed salons answer requests ----

async function loadForSalon(req) {
  const found = await load(req.params.id)
  if (!canRunSalon(req.staff, found.salon)) throw forbidden()
  return found
}

router.post('/bookings/:id/accept', async (req, res) => {
  const { booking, salon } = await loadForSalon(req)
  res.json((await acceptBooking(booking, salon)).toJSON())
})

router.post('/bookings/:id/decline', async (req, res) => {
  const { booking } = await loadForSalon(req)
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  const reason = String(req.body.reason ?? '').trim()
  if (!reason) throw badRequest(`Give a reason, e.g. ${DECLINE_REASONS[0]}.`)
  Object.assign(booking, { status: 'declined', declineReason: reason, refunded: true })
  await booking.save()
  res.json(booking.toJSON())
})

router.post('/bookings/:id/propose', async (req, res) => {
  const { booking, salon } = await loadForSalon(req)
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  const { date, hour } = req.body
  const today = isoDate()
  if (!date || date < today || date > addDays(today, 7)) throw badRequest('Suggest a day in the next week.')
  if (!(hour >= salon.hours[0] && hour < salon.hours[1])) throw badRequest('Suggest a time within opening hours.')
  Object.assign(booking, { status: 'proposed', proposal: { date, hour: Number(hour) } })
  await booking.save()
  res.json(booking.toJSON())
})

export default router
