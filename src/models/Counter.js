import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Named sequences ("invoice|<salonId>") incremented atomically, so two checkouts never share a number
const counterSchema = new Schema({ _id: String, seq: Number }, { versionKey: false })

export const Counter = model('Counter', counterSchema)
