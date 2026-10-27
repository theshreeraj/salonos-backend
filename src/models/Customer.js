import mongoose from 'mongoose'
import { clean, opts } from './plugins.js'

const { Schema, model } = mongoose

const customerSchema = new Schema(
  {
    _id: String,
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    favourites: [String],
  },
  { ...opts, timestamps: true },
)

export const Customer = model('Customer', clean(customerSchema))
