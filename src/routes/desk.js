// The front desk's back office for its own salon: clients, appointments, checkout, team, catalogue, stock and people ops
import { Router } from 'express'
import { WEEKDAYS, freeChair, isBookable, isOffDay, isOnLeave, lineTotal, staffBusy } from '../../../shared/desk.js'
import { isoDate } from '../../../shared/format.js'
import { badRequest, conflict, notFound, pick, requireFields, uid } from '../lib/http.js'
import { requireStaff } from '../middleware/auth.js'
import { Appointment, Attendance, Client, DESK_MODELS, DeskService, DeskStaff, Invoice, Leave, PendingBill, Product, Salon } from '../models/index.js'

const router = Router()
router.use('/desk', requireStaff('frontdesk'))

const json = (doc) => doc.toJSON()
const sid = (req) => req.staff.salonId

async function findOne(Model, req, id = req.params.id, what = 'Record') {
  const doc = await Model.findOne({ salonId: sid(req), id })
  if (!doc) throw notFound(what)
  return doc
}

// Everything the back office pages need, in one request
router.get('/desk', async (req, res) => {
  const salonId = sid(req)
  const entries = await Promise.all(Object.entries(DESK_MODELS).map(async ([key, Model]) => [key, (await Model.find({ salonId })).map(json)]))
  res.json(Object.fromEntries(entries))
})

// ---- Clients ----

function newClient(salonId, { name, phone = '', email = '' }, createdAt = isoDate()) {
  if (!String(name ?? '').trim()) throw badRequest('Enter the client’s name.')
  return { salonId, id: uid('cl'), name: String(name).trim(), phone: String(phone).trim(), email: String(email).trim(), points: 0, createdAt, notes: [] }
}

router.post('/desk/clients', async (req, res) => {
  const client = await Client.create(newClient(sid(req), req.body))
  res.status(201).json(json(client))
})

router.patch('/desk/clients/:id', async (req, res) => {
  const client = await findOne(Client, req, req.params.id, 'Client')
  Object.assign(client, pick(req.body, ['name', 'phone', 'email']))
  await client.save()
  res.json(json(client))
})

router.post('/desk/clients/:id/notes', async (req, res) => {
  const client = await findOne(Client, req, req.params.id, 'Client')
  if (!String(req.body.title ?? '').trim()) throw badRequest('Give the note a title.')
  client.notes.unshift({ id: uid('nt'), title: req.body.title.trim(), body: String(req.body.body ?? '').trim(), at: Date.now() })
  await client.save()
  res.json(json(client))
})

// ---- Appointments ----

// Creates or reschedules (when id is given). Checks leave, weekly offs, double-booking and free chairs.
router.post('/desk/appointments', async (req, res) => {
  const salonId = sid(req)
  const f = req.body
  requireFields(f, ['date', 'start'])
  const start = Number(f.start)
  const [salon, services, staff, leave, sameDay] = await Promise.all([
    Salon.findById(salonId).lean(),
    DeskService.find({ salonId }).lean(),
    DeskStaff.find({ salonId }).lean(),
    Leave.find({ salonId }).lean(),
    Appointment.find({ salonId, date: f.date }).lean(),
  ])
  const chosen = services.filter((s) => (f.serviceIds ?? []).includes(s.id))
  if (!chosen.length) throw badRequest('Pick at least one service.')
  const mins = chosen.reduce((sum, s) => sum + s.mins, 0) || 30
  const canTake = (s) => !isOffDay(s, f.date) && !isOnLeave(leave, s.id, f.date) && !staffBusy(sameDay, s.id, f.date, start, mins, f.id)

  let staffId = f.staffId
  if (f.anyStylist) {
    staffId = staff.filter(isBookable).find(canTake)?.id
    if (!staffId) throw conflict('No stylist is free for that slot. Try another time.')
  } else {
    const s = staff.find((x) => x.id === staffId)
    if (!s) throw badRequest('Choose a stylist.')
    if (isOnLeave(leave, s.id, f.date)) throw conflict(`${s.name} is on leave that day.`)
    if (isOffDay(s, f.date)) throw conflict(`${s.name} has a weekly off on ${WEEKDAYS[new Date(`${f.date}T00:00:00`).getDay()]}.`)
    if (staffBusy(sameDay, s.id, f.date, start, mins, f.id)) throw conflict(`${s.name} already has a booking in that slot.`)
  }
  const chair = freeChair(sameDay, salon.meta.chairs, f.date, start, mins, f.id)
  if (chair == null) throw conflict(`All ${salon.meta.chairs} chairs are taken in that slot.`)

  let clientId = f.clientId
  if (f.newClient) {
    const client = await Client.create(newClient(salonId, f.newClient, f.date))
    clientId = client.id
  }
  if (!clientId) throw badRequest('Choose a client.')

  const fields = { clientId, staffId, anyStylist: Boolean(f.anyStylist), serviceIds: chosen.map((s) => s.id), date: f.date, start, mins, chair, notes: f.notes ?? '' }
  const appointment = f.id
    ? await Appointment.findOneAndUpdate({ salonId, id: f.id }, { $set: fields }, { returnDocument: 'after' })
    : await Appointment.create({ salonId, id: uid('ap'), status: 'booked', createdAt: Date.now(), ...fields })
  if (!appointment) throw notFound('Appointment')
  res.status(f.id ? 200 : 201).json({ appointment: json(appointment) })
})

router.patch('/desk/appointments/:id/status', async (req, res) => {
  const status = req.body.status
  if (!['booked', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(status)) throw badRequest('Unknown status.')
  const appt = await findOne(Appointment, req, req.params.id, 'Appointment')
  appt.status = status
  await appt.save()
  res.json(json(appt))
})

// ---- Checkout ----

// token: { date, token } when billing a live-queue customer; customerName covers walk-ins with no client profile
router.post('/desk/checkout', async (req, res) => {
  const salonId = sid(req)
  const { clientId = null, appointmentId = null, token = null, customerName, method } = req.body
  const items = (req.body.items ?? []).map((i) => pick(i, ['kind', 'refId', 'name', 'qty', 'price', 'staffId']))
  if (!items.length) throw badRequest('Add at least one item.')
  if (!['upi', 'cash', 'card'].includes(method)) throw badRequest('Choose how they paid.')
  const discount = Number(req.body.discount) || 0
  const tax = Number(req.body.tax) || 0
  const tip = Number(req.body.tip) || 0
  const total = Math.max(0, lineTotal(items) - discount + tax + tip)
  const number = 1001 + (await Invoice.countDocuments({ salonId }))

  const invoice = await Invoice.create({ salonId, id: uid('inv'), number, clientId, appointmentId, token, customerName, items, discount, tax, tip, total, method, at: Date.now() })

  const sold = items.filter((i) => i.kind === 'product')
  await Promise.all([
    ...sold.map((i) => Product.updateOne({ salonId, id: i.refId }, [{ $set: { stock: { $max: [0, { $subtract: ['$stock', i.qty] }] } } }], { updatePipeline: true })),
    token && PendingBill.deleteOne({ salonId, date: token.date, token: token.token }),
    appointmentId && Appointment.updateOne({ salonId, id: appointmentId }, { $set: { status: 'completed', invoiceId: invoice.id } }),
    clientId && Client.updateOne({ salonId, id: clientId }, { $inc: { points: Math.floor(total / 100) } }),
  ])
  res.status(201).json(json(invoice))
})

// Queue customers who left the chair without paying yet ("bill later")
router.post('/desk/pending-bills', async (req, res) => {
  const { date, token } = req.body
  requireFields(req.body, ['date', 'token'])
  const bill = await PendingBill.findOneAndUpdate(
    { salonId: sid(req), date, token },
    { $setOnInsert: { salonId: sid(req), id: `${date}#${token}`, date, token } },
    { upsert: true, returnDocument: 'after' },
  )
  res.status(201).json(json(bill))
})

// ---- Team & catalogue ----

const STAFF_FIELDS = ['name', 'email', 'phone', 'role', 'title', 'color', 'salary', 'commission', 'shiftStart', 'shiftEnd', 'offDays', 'active']

function crud(path, Model, fields, prefix, what) {
  router.post(`/desk/${path}`, async (req, res) => {
    if (!String(req.body.name ?? '').trim()) throw badRequest(`Enter the ${what.toLowerCase()} name.`)
    const doc = await Model.create({ salonId: sid(req), id: uid(prefix), active: true, ...pick(req.body, fields) })
    res.status(201).json(json(doc))
  })
  // Archive with { active: false } rather than deleting, so old bookings and invoices keep their names
  router.patch(`/desk/${path}/:id`, async (req, res) => {
    const doc = await findOne(Model, req, req.params.id, what)
    Object.assign(doc, pick(req.body, fields))
    await doc.save()
    res.json(json(doc))
  })
}

crud('staff', DeskStaff, STAFF_FIELDS, 'st', 'Staff member')
crud('services', DeskService, ['name', 'category', 'mins', 'price', 'active'], 'sv', 'Service')
crud('products', Product, ['name', 'sku', 'category', 'price', 'cost', 'stock', 'lowAt', 'active'], 'pr', 'Product')

// ---- People ops ----

router.post('/desk/attendance', async (req, res) => {
  await findOne(DeskStaff, req, req.body.staffId, 'Staff member')
  const open = await Attendance.findOne({ salonId: sid(req), staffId: req.body.staffId, out: null })
  if (open) throw conflict('Already clocked in.')
  const entry = await Attendance.create({ salonId: sid(req), id: uid('at'), staffId: req.body.staffId, in: Date.now(), out: null })
  res.status(201).json(json(entry))
})

router.post('/desk/attendance/:id/out', async (req, res) => {
  const entry = await findOne(Attendance, req, req.params.id, 'Attendance entry')
  if (entry.out) throw conflict('Already clocked out.')
  entry.out = Date.now()
  await entry.save()
  res.json(json(entry))
})

router.post('/desk/leave', async (req, res) => {
  requireFields(req.body, ['staffId', 'type', 'from'])
  await findOne(DeskStaff, req, req.body.staffId, 'Staff member')
  const { staffId, type, from } = req.body
  const to = req.body.to && req.body.to >= from ? req.body.to : from
  const leave = await Leave.create({ salonId: sid(req), id: uid('lv'), staffId, type, from, to, reason: String(req.body.reason ?? '').trim(), status: 'pending', createdAt: isoDate() })
  res.status(201).json(json(leave))
})

router.patch('/desk/leave/:id', async (req, res) => {
  if (!['approved', 'rejected', 'cancelled'].includes(req.body.status)) throw badRequest('Unknown status.')
  const leave = await findOne(Leave, req, req.params.id, 'Leave request')
  leave.status = req.body.status
  await leave.save()
  res.json(json(leave))
})

export default router
