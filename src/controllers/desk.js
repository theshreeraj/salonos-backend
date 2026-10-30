// The front desk's back office for its own salon: clients, appointments, checkout, team, catalogue, stock and people ops
import { isoDate } from '../utils/dates.js'
import { Appointment, Attendance, Client, DESK_MODELS, DeskStaff, Expense, Leave, PendingBill } from '../models/index.js'
import * as desk from '../services/desk.js'
import { badRequest, conflict, notFound, pick, requireFields, uid } from '../utils/http.js'

const json = (doc) => doc.toJSON()
const sid = (req) => req.staff.salonId

async function findOne(Model, req, id = req.params.id, what = 'Record') {
  const doc = await Model.findOne({ salonId: sid(req), id })
  if (!doc) throw notFound(what)
  return doc
}

// Everything the back office pages need, in one request
export async function overview(req, res) {
  const salonId = sid(req)
  const entries = await Promise.all(Object.entries(DESK_MODELS).map(async ([key, Model]) => [key, (await Model.find({ salonId })).map(json)]))
  res.json(Object.fromEntries(entries))
}

// ---- Clients ----

export async function createClient(req, res) {
  const client = await Client.create(desk.newClient(sid(req), req.body))
  res.status(201).json(json(client))
}

export async function updateClient(req, res) {
  const client = await findOne(Client, req, req.params.id, 'Client')
  Object.assign(client, pick(req.body, ['name', 'phone', 'email']))
  await client.save()
  res.json(json(client))
}

export async function addClientNote(req, res) {
  const client = await findOne(Client, req, req.params.id, 'Client')
  if (!String(req.body.title ?? '').trim()) throw badRequest('Give the note a title.')
  client.notes.unshift({ id: uid('nt'), title: req.body.title.trim(), body: String(req.body.body ?? '').trim(), at: Date.now() })
  await client.save()
  res.json(json(client))
}

// ---- Appointments ----

export async function saveAppointment(req, res) {
  const appointment = await desk.saveAppointment(sid(req), req.body)
  res.status(req.body.id ? 200 : 201).json({ appointment: json(appointment) })
}

export async function setAppointmentStatus(req, res) {
  const status = req.body.status
  if (!['booked', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(status)) throw badRequest('Unknown status.')
  const appt = await findOne(Appointment, req, req.params.id, 'Appointment')
  appt.status = status
  await appt.save()
  res.json(json(appt))
}

// ---- Checkout ----

export async function checkout(req, res) {
  res.status(201).json(json(await desk.checkout(sid(req), req.body)))
}

// Queue customers who left the chair without paying yet ("bill later")
export async function addPendingBill(req, res) {
  const { date, token } = req.body
  requireFields(req.body, ['date', 'token'])
  const bill = await PendingBill.findOneAndUpdate(
    { salonId: sid(req), date, token },
    { $setOnInsert: { salonId: sid(req), id: `${date}#${token}`, date, token } },
    { upsert: true, returnDocument: 'after' },
  )
  res.status(201).json(json(bill))
}

// ---- Team & catalogue: create, edit, archive ----

// Archive with { active: false } rather than deleting, so old bookings and invoices keep their names
export function records(Model, fields, prefix, what) {
  return {
    async create(req, res) {
      if (!String(req.body.name ?? '').trim()) throw badRequest(`Enter the ${what.toLowerCase()} name.`)
      const doc = await Model.create({ salonId: sid(req), id: uid(prefix), active: true, ...pick(req.body, fields) })
      res.status(201).json(json(doc))
    },
    async update(req, res) {
      const doc = await findOne(Model, req, req.params.id, what)
      Object.assign(doc, pick(req.body, fields))
      await doc.save()
      res.json(json(doc))
    },
  }
}

// ---- People ops ----

export async function clockIn(req, res) {
  await findOne(DeskStaff, req, req.body.staffId, 'Staff member')
  const open = await Attendance.findOne({ salonId: sid(req), staffId: req.body.staffId, out: null })
  if (open) throw conflict('Already clocked in.')
  const entry = await Attendance.create({ salonId: sid(req), id: uid('at'), staffId: req.body.staffId, in: Date.now(), out: null })
  res.status(201).json(json(entry))
}

export async function clockOut(req, res) {
  const entry = await findOne(Attendance, req, req.params.id, 'Attendance entry')
  if (entry.out) throw conflict('Already clocked out.')
  entry.out = Date.now()
  await entry.save()
  res.json(json(entry))
}

export async function requestLeave(req, res) {
  requireFields(req.body, ['staffId', 'type', 'from'])
  await findOne(DeskStaff, req, req.body.staffId, 'Staff member')
  const { staffId, type, from } = req.body
  const to = req.body.to && req.body.to >= from ? req.body.to : from
  const leave = await Leave.create({ salonId: sid(req), id: uid('lv'), staffId, type, from, to, reason: String(req.body.reason ?? '').trim(), status: 'pending', createdAt: isoDate() })
  res.status(201).json(json(leave))
}

export async function setLeaveStatus(req, res) {
  if (!['approved', 'rejected', 'cancelled'].includes(req.body.status)) throw badRequest('Unknown status.')
  const leave = await findOne(Leave, req, req.params.id, 'Leave request')
  leave.status = req.body.status
  await leave.save()
  res.json(json(leave))
}

// Petty cash going out of the till
export async function addExpense(req, res) {
  requireFields(req.body, ['category', 'amount'])
  const amount = Number(req.body.amount)
  if (!(amount > 0)) throw badRequest('Enter an amount above zero.')
  const expense = await Expense.create({ salonId: sid(req), id: uid('ex'), date: req.body.date ?? isoDate(), category: String(req.body.category).trim(), amount, note: String(req.body.note ?? '').trim() })
  res.status(201).json(json(expense))
}
