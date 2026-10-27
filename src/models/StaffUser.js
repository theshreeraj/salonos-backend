import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

// Portal staff: front desk, stylists, field agents, district managers, super admins
const staffUserSchema = new Schema(
  {
    _id: String,
    role: { type: String, enum: ['frontdesk', 'stylist', 'agent', 'manager', 'admin'], required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, index: true },
    passwordHash: { type: String, required: true },
    salonId: String,
    district: String,
    active: { type: Boolean, default: true },
  },
  { ...opts, timestamps: true },
)

export const StaffUser = model('StaffUser', clean(staffUserSchema, ['passwordHash']))
