import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// Ledger of booking-fee payments, keyed by the gateway's payment id. Captures and refunds are recorded once each,
// so a webhook delivered twice or a retried refund never moves money twice. The admin fee audit reads from here.
const paymentSchema = new Schema(
  {
    _id: String,
    provider: { type: String, enum: ['razorpay', 'local'], required: true },
    orderId: String,
    amount: Number,
    method: String,
    salonId: { type: String, index: true },
    customerId: String,
    holdId: String,
    bookingId: String,
    status: { type: String, enum: ['captured', 'refunded'], default: 'captured', index: true },
    refund: { id: String, amount: Number, reason: String, at: Number },
    capturedAt: Number,
  },
  opts,
)

export const Payment = model('Payment', clean(paymentSchema))
