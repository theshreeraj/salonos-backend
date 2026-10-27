import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// A field agent's application to put a salon live; a district manager approves or sends it back
const onboardingSchema = new Schema(
  {
    _id: String,
    name: String,
    type: String,
    area: String,
    address: String,
    district: { type: String, index: true },
    owner: String,
    ownerPhone: String,
    ownerEmail: String,
    gstin: String,
    chairs: Number,
    hours: [Number],
    categories: [String],
    facilities: [String],
    agentId: { type: String, index: true },
    leadId: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], index: true },
    reviewNote: String,
    submittedAt: String,
    reviewedAt: String,
    history: [{ _id: false, status: String, at: String, note: String }],
    salonId: String,
  },
  opts,
)

export const Onboarding = model('Onboarding', clean(onboardingSchema))
