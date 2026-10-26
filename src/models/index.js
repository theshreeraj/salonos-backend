// MongoDB models. Ids are readable strings ("mirror-and-mane", "ld-1") shared with the web app,
// so the same id works in URLs, references and the UI.
import mongoose from 'mongoose'

const { Schema, model } = mongoose
const Mixed = Schema.Types.Mixed

// Serialise as { id, ...fields } without Mongo internals
function clean(schema) {
  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id
      delete ret._id
      return ret
    },
  })
}

const opts = { minimize: false }

// ---- Catalogue ----

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
clean(salonSchema)

// ---- People ----

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
staffUserSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.passwordHash
    return ret
  },
})

const customerSchema = new Schema(
  {
    _id: String,
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    favourites: [String],
  },
  { ...opts, timestamps: true },
)
clean(customerSchema)

const otpSchema = new Schema({
  phone: { type: String, required: true, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } },
})

// ---- Bookings & queues ----

const bookingSchema = new Schema(
  {
    _id: String,
    salonId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    token: { type: Number, default: null },
    slot: { type: Number, default: null },
    stylist: String,
    anyStylist: Boolean,
    services: [{ _id: false, id: String, name: String, price: Number, mins: Number }],
    servicesTotal: Number,
    fee: Number,
    payment: { method: String, ref: String, paidAt: Number },
    status: { type: String, enum: ['requested', 'proposed', 'active', 'cancelled', 'declined', 'expired'], index: true },
    respondBy: Number,
    acceptedAt: Number,
    proposal: { date: String, hour: Number },
    arriveAt: Number,
    declineReason: String,
    refunded: Boolean,
    customerId: { type: String, index: true },
    customerName: String,
    phone: String,
    note: String,
    // Created by the simulation to keep demo salons busy
    synthetic: Boolean,
    createdAt: Number,
  },
  opts,
)
clean(bookingSchema)

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
clean(queueSchema)

// ---- Field onboarding ----

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
clean(onboardingSchema)

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
clean(leadSchema)

// ---- Salon back office ----
// Ids are unique within a salon ("cl-1" exists at every salon), so each record carries salonId + id.

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

export const Salon = model('Salon', salonSchema)
export const StaffUser = model('StaffUser', staffUserSchema)
export const Customer = model('Customer', customerSchema)
export const Otp = model('Otp', otpSchema)
export const Booking = model('Booking', bookingSchema)
export const Queue = model('Queue', queueSchema)
export const Onboarding = model('Onboarding', onboardingSchema)
export const Lead = model('Lead', leadSchema)

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
