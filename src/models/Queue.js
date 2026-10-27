import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose
const Mixed = Schema.Types.Mixed

// One document per salon per day: the token counter plus desk walk-ins and no-show marks, keyed by token
const queueSchema = new Schema(
  {
    _id: String,
    salonId: { type: String, index: true },
    date: { type: String, index: true },
    serving: Number,
    next: Number,
    manual: Boolean,
    walkIns: { type: Mixed, default: {} },
    marks: { type: Mixed, default: {} },
  },
  opts,
)

export const Queue = model('Queue', clean(queueSchema))
