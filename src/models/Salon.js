import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

const salonSchema = new Schema(
  {
    _id: String,
    name: { type: String, required: true },
    type: { type: String, enum: ['Men', 'Women', 'Unisex'], required: true },
    area: String,
    address: String,
    city: { type: String, default: 'Pune' },
    distanceKm: Number,
    rating: Number,
    reviews: Number,
    hours: [Number],
    tier: Number,
    avgMins: Number,
    // Where today's queue starts when the day's queue document is first created
    queue: { serving: Number, next: Number },
    confirmMode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    photos: [String],
    categories: [String],
    facilities: [String],
    stylists: [{ _id: false, name: String, role: String, years: Number }],
    about: String,
    phone: String,
    services: [{ _id: false, id: String, category: String, name: String, mins: Number, price: Number }],
    startingPrice: Number,
    meta: { district: String, agentId: String, owner: String, onboardedOn: String, chairs: Number },
    bookingOpen: { type: Boolean, default: true },
    suspended: { type: Boolean, default: false },
    onboardingId: String,
  },
  opts,
)

export const Salon = model('Salon', clean(salonSchema))
