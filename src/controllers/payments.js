// Gateway callbacks. Razorpay signs the raw request body, so this route receives it unparsed.
import { handlePaymentEvent } from '../services/bookings.js'
import { verifyWebhook } from '../services/payments.js'
import { badRequest } from '../utils/http.js'

export async function webhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
  if (!verifyWebhook(raw, req.get('x-razorpay-signature'))) throw badRequest('Invalid signature.')
  await handlePaymentEvent(JSON.parse(raw))
  res.json({ ok: true })
}
