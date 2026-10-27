// Salon back office. Ids are unique within a salon ("cl-1" exists at every salon), so each record carries salonId + id.
import mongoose from 'mongoose'
import { opts } from './plugins.js'

const { Schema, model } = mongoose

function deskModel(name, fields) {
  const schema = new Schema({ salonId: { type: String, required: true }, id: { type: String, required: true }, ...fields }, { ...opts, strict: true })
  schema.index({ salonId: 1, id: 1 }, { unique: true })
  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret._id
      delete ret.salonId
      return ret
    },
  })
  return model(name, schema)
}

const item = { _id: false, kind: String, refId: String, name: String, qty: Number, price: Number, staffId: String }

export const DeskStaff = deskModel('DeskStaff', {
  name: String,
  email: String,
  phone: String,
  role: String,
  title: String,
  color: String,
  salary: Number,
  commission: Number,
  shiftStart: String,
  shiftEnd: String,
  offDays: [Number],
  active: { type: Boolean, default: true },
})
export const DeskService = deskModel('DeskService', { name: String, category: String, mins: Number, price: Number, active: { type: Boolean, default: true } })
export const Client = deskModel('Client', {
  name: String,
  phone: String,
  email: String,
  points: { type: Number, default: 0 },
  createdAt: String,
  notes: [{ _id: false, id: String, title: String, body: String, at: Number }],
})
export const Product = deskModel('Product', { name: String, sku: String, category: String, price: Number, cost: Number, stock: Number, lowAt: Number, active: { type: Boolean, default: true } })
export const Appointment = deskModel('Appointment', {
  clientId: String,
  staffId: String,
  anyStylist: Boolean,
  serviceIds: [String],
  date: { type: String, index: true },
  start: Number,
  mins: Number,
  chair: Number,
  status: String,
  notes: String,
  invoiceId: String,
  createdAt: Number,
})
export const Invoice = deskModel('Invoice', {
  number: Number,
  clientId: String,
  appointmentId: String,
  token: { date: String, token: Number },
  customerName: String,
  items: [item],
  discount: Number,
  tax: Number,
  tip: Number,
  total: Number,
  method: String,
  at: Number,
})
export const Attendance = deskModel('Attendance', { staffId: String, in: Number, out: Number })
export const Leave = deskModel('Leave', { staffId: String, type: String, from: String, to: String, reason: String, status: String, createdAt: String })
export const Expense = deskModel('Expense', { date: String, category: String, amount: Number, note: String })
// Queue customers who left the chair without paying ("bill later")
export const PendingBill = deskModel('PendingBill', { date: String, token: Number })

// Everything GET /desk returns, keyed as the web app expects
export const DESK_MODELS = {
  staff: DeskStaff,
  services: DeskService,
  clients: Client,
  products: Product,
  appointments: Appointment,
  invoices: Invoice,
  attendance: Attendance,
  leave: Leave,
  expenses: Expense,
  pendingBills: PendingBill,
}
