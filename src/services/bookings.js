// Customer bookings: the ₹20 booking fee holds a time with a stylist and a place in the salon's queue.
// Every paid booking ends confirmed in the queue or closed with the refund rules below:
//   salon declines, misses the 5-minute window, or the customer turns down a new time → refunded
//   customer cancels ≥ CANCEL_REFUND_HOURS before the start → refunded; later, or a no-show → fee kept
//   salon cancels → refunded; the slot went to someone else while the customer was paying → refunded
import { ANY_STYLIST, BOOKING_DAYS, DEFAULT_MINS, HOLD_MINS, durationOf, pickStylist } from '../../../shared/availability.js'
import { BOOKING_FEE, RESPOND_WINDOW_MS } from '../../../shared/catalog.js'
import { addDays, isoDate } from '../../../shared/format.js'
import { refundsOnCancel } from '../../../shared/queue.js'
import { Booking, Salon, SlotHold } from '../models/index.js'
import { badRequest, conflict, notFound, uid } from '../utils/http.js'
import { loadCalendar } from './availability.js'
import { withDayLock } from './dayLock.js'
import { createOrder, linkPayment, localPaymentId, paymentsLive, recordCapture, refundBooking, verifyCheckout } from './payments.js'
import { plain, takeToken } from './queue.js'

export const METHODS = ['UPI', 'Card', 'Net banking']
const OPEN = ['requested', 'proposed', 'active']
const ANY_LABEL = 'Any available'

const slotTaken = (extra) => conflict('That time was just taken. Please pick another.', { code: 'slot-taken', ...extra })
const wantedOf = (b) => (b.anyStylist || b.stylist === ANY_LABEL ? ANY_STYLIST : b.stylist)
const minsOf = (services) => durationOf(services) || DEFAULT_MINS

// Checks what the customer asked for against the salon's menu, team and booking window
function bookingRequest(salon, body) {
  const today = isoDate()
  const { date } = body
  const slot = body.slot == null ? null : Number(body.slot)
  const wanted = body.stylist || ANY_STYLIST
  if (salon.suspended || !salon.bookingOpen) throw conflict('This salon has paused online bookings. You can still walk in.')
  if (!date || date < today || date > addDays(today, BOOKING_DAYS - 1)) throw badRequest(`Pick a date within the next ${BOOKING_DAYS} days.`)
  if (slot != null && !Number.isInteger(slot)) throw badRequest('Pick a start time.')
  if (wanted !== ANY_STYLIST && !salon.stylists.some((p) => p.name === wanted)) throw badRequest('Choose a stylist from this salon.')

  const services = salon.services.filter((s) => (body.serviceIds ?? []).includes(s.id)).map(({ id, name, price, mins }) => ({ id, name, price, mins }))
  if ((body.serviceIds ?? []).length !== services.length) throw badRequest('Some services are no longer offered. Refresh and try again.')
  return { date, slot, services, wanted, note: String(body.note ?? '').trim().slice(0, 200) }
}

// Step 1: reserve the stylist and time for HOLD_MINS and open a payment order for the fee.
// Fails with 409 slot-taken before the customer is charged anything.
export async function holdSlot(salonDoc, customer, body) {
  const salon = plain(salonDoc)
  const { date, slot, services, wanted, note } = bookingRequest(salon, body)
  const mins = minsOf(services)

  const reserve = async () => {
    let stylist = wanted
    if (slot != null) {
      stylist = pickStylist(salon, date, await loadCalendar(salon, date), slot, mins, wanted)
      if (!stylist) throw slotTaken()
    }
    const now = Date.now()
    return SlotHold.create({
      _id: uid('hd'),
      salonId: salon.id,
      date,
      slot,
      mins,
      stylist,
      anyStylist: wanted === ANY_STYLIST,
      services,
      customerId: customer._id,
      customerName: customer.name,
      phone: customer.phone,
      note,
      expiresAt: new Date(now + HOLD_MINS * 60000),
      createdAt: now,
    })
  }
  // Token bookings (no time) take no stylist time, so only timed holds need the day's lock
  const hold = slot == null ? await reserve() : await withDayLock(salon.id, date, reserve)

  try {
    const order = await createOrder({ amount: BOOKING_FEE, receipt: hold._id, notes: { holdId: hold._id, salonId: salon.id } })
    hold.order = { id: order.id, amount: order.amount }
    await hold.save()
    return { hold, keyId: order.keyId }
  } catch (err) {
    await SlotHold.deleteOne({ _id: hold._id })
    throw err
  }
}

export async function releaseHold(customer, holdId) {
  await SlotHold.deleteOne({ _id: holdId, customerId: customer._id, status: 'held' })
}

// Step 2: the fee is paid — turn the hold into a booking. Idempotent on the payment id, so the browser's confirmation
// and the gateway's webhook can both arrive. A lapsed hold is re-checked; if its time is gone the fee is refunded.
export async function confirmHold(hold, { paymentId, orderId, method }) {
  const existing = await Booking.findOne({ 'payment.ref': paymentId })
  if (existing) return existing
  const salonDoc = await Salon.findById(hold.salonId)
  if (!salonDoc) throw notFound('Salon')
  const salon = plain(salonDoc)
  await recordCapture({ paymentId, orderId, amount: BOOKING_FEE, method, salonId: salon.id, customerId: hold.customerId, holdId: hold._id })

  const write = async () => {
    const again = await Booking.findOne({ 'payment.ref': paymentId })
    if (again) return again
    const now = Date.now()
    const live = hold.status === 'held' && hold.expiresAt.getTime() > now
    let stylist = hold.stylist
    let lost = hold.status === 'confirmed' ? 'duplicate-payment' : null
    if (!lost && hold.slot != null && !live) {
      stylist = pickStylist(salon, hold.date, await loadCalendar(salon, hold.date, { holdId: hold._id }), hold.slot, hold.mins, hold.anyStylist ? ANY_STYLIST : hold.stylist)
      if (!stylist) lost = 'slot-taken'
    }

    const manual = salon.confirmMode === 'manual'
    const booking = new Booking({
      _id: uid('bk'),
      salonId: salon.id,
      date: hold.date,
      slot: hold.slot,
      token: null,
      stylist: stylist === ANY_STYLIST ? ANY_LABEL : stylist,
      anyStylist: hold.anyStylist,
      services: hold.services,
      servicesTotal: hold.services.reduce((sum, s) => sum + s.price, 0),
      fee: BOOKING_FEE,
      payment: { method, ref: paymentId, orderId, paidAt: now },
      holdId: hold._id,
      status: manual ? 'requested' : 'active',
      ...(manual ? { respondBy: now + RESPOND_WINDOW_MS } : { acceptedAt: now }),
      customerId: hold.customerId,
      customerName: hold.customerName,
      phone: hold.phone,
      note: hold.note,
      createdAt: now,
    })

    if (lost) {
      booking.status = 'cancelled'
      await refundBooking(booking, lost)
      await booking.save()
      await linkPayment(paymentId, booking._id)
      throw slotTaken({ refunded: true, bookingId: booking._id })
    }

    if (!manual) booking.token = await takeToken(salon, hold.date)
    await booking.save()
    await linkPayment(paymentId, booking._id)
    hold.status = 'confirmed'
    hold.bookingId = booking._id
    await hold.save()
    return booking
  }
  return hold.slot == null ? write() : withDayLock(salon.id, hold.date, write)
}

// The browser's confirmation after Razorpay Checkout (or, without keys, straight after the hold)
export async function payForHold(customer, body) {
  const hold = await SlotHold.findById(body.holdId)
  if (!hold || hold.customerId !== customer._id) throw notFound('Reservation')
  if (!METHODS.includes(body.method)) throw badRequest('Choose a payment method.')
  let paymentId = body.paymentId
  if (paymentsLive) {
    if (!verifyCheckout({ orderId: hold.order.id, paymentId, signature: body.signature })) throw badRequest('We couldn’t verify that payment. If you were charged, it will be refunded.')
  } else {
    paymentId ||= localPaymentId()
  }
  return confirmHold(hold, { paymentId, orderId: hold.order.id, method: body.method })
}

// Razorpay webhook: payment.captured confirms the hold even if the customer closed the browser before step 2
export async function handlePaymentEvent(event) {
  if (event.event !== 'payment.captured') return
  const p = event.payload?.payment?.entity
  const hold = p && (await SlotHold.findOne({ 'order.id': p.order_id }))
  if (!hold) return
  try {
    await confirmHold(hold, { paymentId: p.id, orderId: p.order_id, method: p.method })
  } catch (err) {
    // A lost slot is already refunded and recorded; anything else should be retried by the gateway
    if (err.extra?.code !== 'slot-taken') throw err
  }
}

// One-step booking for development: hold, "pay" locally and confirm. With real payment keys, use hold → pay.
export async function createBooking(salonDoc, customer, body) {
  if (paymentsLive) throw badRequest('Reserve with POST /bookings/holds, pay, then confirm with POST /bookings/pay.')
  if (!METHODS.includes(body.method)) throw badRequest('Choose a payment method.')
  const { hold } = await holdSlot(salonDoc, customer, body)
  return confirmHold(hold, { paymentId: localPaymentId(), orderId: hold.order.id, method: body.method })
}

// ---- The salon answers requests (self-managed salons) ----

export async function acceptBooking(booking, salon) {
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  booking.token = await takeToken(salon, booking.date)
  booking.status = 'active'
  booking.acceptedAt = Date.now()
  return booking.save()
}

export async function declineBooking(booking, reason) {
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  booking.status = 'declined'
  booking.declineReason = reason
  await refundBooking(booking, 'declined')
  return booking.save()
}

// The new time must be free for the stylist asked for (or anyone, for "any") when it's suggested
export async function proposeTime(booking, salonDoc, { date, hour }) {
  if (booking.status !== 'requested') throw conflict('This request was already answered.')
  const salon = plain(salonDoc)
  const today = isoDate()
  if (!date || date < today || date > addDays(today, 7)) throw badRequest('Suggest a day in the next week.')
  if (!(hour >= salon.hours[0] && hour < salon.hours[1])) throw badRequest('Suggest a time within opening hours.')
  const calendar = await loadCalendar(salon, date, { bookingId: booking._id })
  if (!pickStylist(salon, date, calendar, Number(hour) * 60, minsOf(booking.services), wantedOf(booking))) {
    throw conflict('Nobody is free for the whole appointment then. Suggest another time.')
  }
  booking.status = 'proposed'
  booking.proposal = { date, hour: Number(hour) }
  return booking.save()
}

// Customer answers a suggested time. Accepting re-checks it: if it filled up meanwhile, the fee is refunded.
export async function answerProposal(booking, salonDoc, accept) {
  if (booking.status !== 'proposed') throw conflict('There is no new time to answer.')
  if (!accept) {
    booking.status = 'cancelled'
    booking.cancelledBy = 'customer'
    await refundBooking(booking, 'proposal-declined')
    return booking.save()
  }
  const salon = plain(salonDoc)
  const { date, hour } = booking.proposal
  return withDayLock(salon.id, date, async () => {
    const slot = hour * 60
    const calendar = await loadCalendar(salon, date, { bookingId: booking._id })
    const stylist = pickStylist(salon, date, calendar, slot, minsOf(booking.services), wantedOf(booking))
    if (!stylist) {
      booking.status = 'cancelled'
      await refundBooking(booking, 'slot-taken')
      await booking.save()
      throw conflict('That time has just been taken, so your booking fee has been refunded.', { code: 'slot-taken', refunded: true })
    }
    Object.assign(booking, { date, slot, stylist, arriveAt: hour, status: 'active', acceptedAt: Date.now() })
    booking.token = await takeToken(salon, date)
    return booking.save()
  })
}

// ---- Closing bookings ----

export async function cancelBooking(booking, salonDoc, by) {
  if (!OPEN.includes(booking.status)) throw conflict('This booking is already closed.')
  const refund = by === 'salon' || refundsOnCancel(booking, plain(salonDoc))
  booking.status = 'cancelled'
  booking.cancelledBy = by
  if (refund) await refundBooking(booking, by === 'salon' ? 'cancelled-by-salon' : 'cancelled-in-time')
  return booking.save()
}

// The desk marked a queue token as a no-show; if it was an app booking, its fee is kept
export const markBookingNoShow = (salonId, date, token) => Booking.updateOne({ salonId, date, token, status: 'active' }, { $set: { status: 'no-show' } })

// Requests the salon didn't answer in time are refunded
export async function expireRequests(now = Date.now()) {
  for (const booking of await Booking.find({ status: 'requested', respondBy: { $lt: now } })) {
    booking.status = 'expired'
    await refundBooking(booking, 'expired')
    await booking.save()
  }
}
