// Booking-fee payments. Razorpay when RAZORPAY_* keys are set; otherwise a local stand-in that "captures" at once,
// so development and the demo run without a gateway. Every capture and refund is written to the Payment ledger once.
import crypto from 'node:crypto'
import { config } from '../config/env.js'
import { Payment } from '../models/index.js'
import { HttpError, badRequest, uid } from '../utils/http.js'

const { keyId, keySecret, webhookSecret } = config.razorpay
export const paymentsLive = Boolean(keyId && keySecret)
const provider = paymentsLive ? 'razorpay' : 'local'

async function razorpay(path, body) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(502, `Payment gateway error: ${data.error?.description ?? res.status}`)
  return data
}

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex')

function sameHex(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8')
  const y = Buffer.from(String(b ?? ''), 'utf8')
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Amounts are whole rupees here; Razorpay counts paise
export async function createOrder({ amount, receipt, notes }) {
  if (!paymentsLive) return { id: uid('order'), amount, keyId: null }
  const order = await razorpay('/orders', { amount: amount * 100, currency: 'INR', receipt, notes })
  return { id: order.id, amount, keyId }
}

// Razorpay Checkout returns these three; the signature proves the payment belongs to our order
export function verifyCheckout({ orderId, paymentId, signature }) {
  if (!paymentsLive) return true
  return sameHex(hmac(keySecret, `${orderId}|${paymentId}`), signature)
}

export function verifyWebhook(rawBody, signature) {
  if (!webhookSecret) return false
  return sameHex(hmac(webhookSecret, rawBody), signature)
}

// A payment id for the local stand-in, which charges nobody
export const localPaymentId = () => `pay_local_${uid('p').slice(2)}`

// Records a captured fee. Safe to call again for the same payment id: the first record wins.
export async function recordCapture({ paymentId, orderId, amount, method, salonId, customerId, holdId }) {
  if (!paymentId) throw badRequest('Missing payment id.')
  return Payment.findOneAndUpdate(
    { _id: paymentId },
    { $setOnInsert: { provider, orderId, amount, method, salonId, customerId, holdId, status: 'captured', capturedAt: Date.now() } },
    { upsert: true, returnDocument: 'after' },
  )
}

export const linkPayment = (paymentId, bookingId) => Payment.updateOne({ _id: paymentId }, { $set: { bookingId } })

// Gives a booking its fee back and marks it refunded. Does nothing if it already was; the caller saves the booking.
// Bookings with no ledger entry (simulated demo requests) are only marked.
export async function refundBooking(booking, reason) {
  if (booking.refunded) return booking
  const at = Date.now()
  const entry = booking.payment?.ref ? await Payment.findById(booking.payment.ref) : null
  let refundId = entry?.refund?.id ?? uid('rfnd')
  if (entry && entry.status !== 'refunded') {
    if (entry.provider === 'razorpay') {
      refundId = (await razorpay(`/payments/${entry._id}/refund`, { amount: entry.amount * 100, notes: { bookingId: booking._id, reason } })).id
    }
    entry.status = 'refunded'
    entry.refund = { id: refundId, amount: entry.amount, reason, at }
    await entry.save()
  }
  booking.refunded = true
  booking.refund = { id: refundId, amount: booking.fee, reason, at }
  return booking
}
