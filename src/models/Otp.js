import mongoose from 'mongoose'

const { Schema, model } = mongoose

// One-time sign-in codes, stored hashed and removed by MongoDB when they expire
const otpSchema = new Schema({
  phone: { type: String, required: true, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } },
})

export const Otp = model('Otp', otpSchema)
