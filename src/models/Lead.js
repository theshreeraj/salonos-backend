import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// A salon a field agent is working on but hasn't onboarded yet
const leadSchema = new Schema(
  {
    _id: String,
    agentId: { type: String, index: true },
    district: { type: String, index: true },
    name: String,
    type: String,
    area: String,
    address: String,
    owner: String,
    phone: String,
    source: String,
    stage: { type: String, enum: ['new', 'contacted', 'interested', 'not-interested'] },
    nextFollowUp: { type: String, default: null },
    onboardingId: { type: String, default: null },
    createdAt: String,
    activities: [{ _id: false, id: String, at: Number, kind: String, outcome: String, note: String }],
  },
  opts,
)

export const Lead = model('Lead', clean(leadSchema))
