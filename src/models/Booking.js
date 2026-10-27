import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// A customer's paid booking. Every one ends in the salon's queue (active) or closed: cancelled, declined, expired
// or no-show — refunded or not as recorded in `refund`.
const bookingSchema = new Schema(
  {
    _id: String,
    salonId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    token: { type: Number, default: null },
    slot: { type: Number, default: null },
    stylist: String,
    anyStylist: Boolean,
    services: [{ _id: false, id: String, name: String, price: Number, mins: Number }],
    servicesTotal: Number,
    fee: Number,
    // ref = the gateway's payment id, unique so a retried payment confirmation can't create a second booking
    payment: { method: String, ref: String, orderId: String, paidAt: Number },
    holdId: String,
    status: { type: String, enum: ['requested', 'proposed', 'active', 'cancelled', 'declined', 'expired', 'no-show'], index: true },
    respondBy: Number,
    acceptedAt: Number,
    proposal: { date: String, hour: Number },
    arriveAt: Number,
    declineReason: String,
    cancelledBy: { type: String, enum: ['customer', 'salon', null], default: null },
    refunded: Boolean,
    refund: { id: String, amount: Number, reason: String, at: Number },
    customerId: { type: String, index: true },
    customerName: String,
    phone: String,
    note: String,
    // Created by the simulation to keep demo salons busy
    synthetic: Boolean,
    createdAt: Number,
  },
  opts,
)
bookingSchema.index({ 'payment.ref': 1 }, { unique: true, partialFilterExpression: { 'payment.ref': { $type: 'string' } } })
bookingSchema.index({ salonId: 1, date: 1, token: 1 })

export const Booking = model('Booking', clean(bookingSchema))
