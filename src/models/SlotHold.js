import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// A stylist and time reserved for one customer while they pay the booking fee (HOLD_MINS).
// Unexpired holds count as busy in every availability check. MongoDB deletes them a day after they lapse.
const slotHoldSchema = new Schema(
  {
    _id: String,
    salonId: { type: String, required: true },
    date: { type: String, required: true },
    slot: { type: Number, default: null },
    mins: Number,
    stylist: String,
    anyStylist: Boolean,
    services: [{ _id: false, id: String, name: String, price: Number, mins: Number }],
    customerId: String,
    customerName: String,
    phone: String,
    note: String,
    order: { id: String, amount: Number },
    status: { type: String, enum: ['held', 'confirmed'], default: 'held' },
    bookingId: String,
    expiresAt: { type: Date, required: true },
    createdAt: Number,
  },
  opts,
)
slotHoldSchema.index({ salonId: 1, date: 1, status: 1 })
slotHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 })
slotHoldSchema.index({ 'order.id': 1 })

export const SlotHold = model('SlotHold', clean(slotHoldSchema))
