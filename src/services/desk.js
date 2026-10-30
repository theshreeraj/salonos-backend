// Front desk rules that touch more than one record: booking a stylist and chair, and checking out a bill
import { WEEKDAYS } from '../config/catalog.js'
import { freeChair, isBookable, isOffDay, isOnLeave, lineTotal } from '../utils/desk.js'
import { isChairFree, isFree } from '../utils/availability.js'
import { isoDate, toMins } from '../utils/dates.js'
import { Appointment, Client, Counter, DeskService, DeskStaff, Invoice, Leave, PendingBill, Product, Salon } from '../models/index.js'
import { badRequest, conflict, notFound, pick, requireFields, uid } from '../utils/http.js'
import { loadCalendar } from './availability.js'
import { withDayLock } from './dayLock.js'

export function newClient(salonId, { name, phone = '', email = '' }, createdAt = isoDate()) {
  if (!String(name ?? '').trim()) throw badRequest('Enter the client’s name.')
  return { salonId, id: uid('cl'), name: String(name).trim(), phone: String(phone).trim(), email: String(email).trim(), points: 0, createdAt, notes: [] }
}

// Creates or reschedules (when f.id is given). The stylist must be on shift, not on leave or a weekly off, and free —
// counting desk appointments, app bookings and payment holds — and a chair must be free for the whole appointment.
export async function saveAppointment(salonId, f) {
  requireFields(f, ['date', 'start'])
  const start = Number(f.start)
  const [salon, services, staff] = await Promise.all([Salon.findById(salonId), DeskService.find({ salonId }).lean(), DeskStaff.find({ salonId }).lean()])
  const chosen = services.filter((s) => (f.serviceIds ?? []).includes(s.id))
  if (!chosen.length) throw badRequest('Pick at least one service.')
  const mins = chosen.reduce((sum, s) => sum + s.mins, 0) || 30

  return withDayLock(salonId, f.date, async () => {
    const [leave, sameDay, calendar] = await Promise.all([
      Leave.find({ salonId }).lean(),
      Appointment.find({ salonId, date: f.date }).lean(),
      loadCalendar(salon, f.date, { appointmentId: f.id }),
    ])
    const chairs = salon.meta.chairs
    if (!isChairFree(calendar, start, mins)) throw conflict(`All ${chairs} chairs are taken in that slot.`)

    const onShift = (s) => start >= toMins(s.shiftStart) && start + mins <= toMins(s.shiftEnd)
    const canTake = (s) => !isOffDay(s, f.date) && !isOnLeave(leave, s.id, f.date) && onShift(s) && isFree(calendar, s.name, start, mins)

    let staffId = f.staffId
    if (f.anyStylist) {
      staffId = staff.filter(isBookable).find(canTake)?.id
      if (!staffId) throw conflict('No stylist is free for that slot. Try another time.')
    } else {
      const s = staff.find((x) => x.id === staffId)
      if (!s) throw badRequest('Choose a stylist.')
      if (isOnLeave(leave, s.id, f.date)) throw conflict(`${s.name} is on leave that day.`)
      if (isOffDay(s, f.date)) throw conflict(`${s.name} has a weekly off on ${WEEKDAYS[new Date(`${f.date}T00:00:00`).getDay()]}.`)
      if (!onShift(s)) throw conflict(`${s.name} works ${s.shiftStart}–${s.shiftEnd}.`)
      if (!isFree(calendar, s.name, start, mins)) throw conflict(`${s.name} already has a booking in that slot.`)
    }
    const chair = freeChair(sameDay, chairs, f.date, start, mins, f.id)
    if (chair == null) throw conflict(`All ${chairs} chairs are taken in that slot.`)

    let clientId = f.clientId
    if (f.newClient) clientId = (await Client.create(newClient(salonId, f.newClient, f.date))).id
    if (!clientId) throw badRequest('Choose a client.')

    const fields = { clientId, staffId, anyStylist: Boolean(f.anyStylist), serviceIds: chosen.map((s) => s.id), date: f.date, start, mins, chair, notes: f.notes ?? '' }
    const appointment = f.id
      ? await Appointment.findOneAndUpdate({ salonId, id: f.id }, { $set: fields }, { returnDocument: 'after' })
      : await Appointment.create({ salonId, id: uid('ap'), status: 'booked', createdAt: Date.now(), ...fields })
    if (!appointment) throw notFound('Appointment')
    return appointment
  })
}

// Next number in a salon's invoice series. The counter starts after the highest invoice already on file.
async function nextInvoiceNumber(salonId) {
  const _id = `invoice|${salonId}`
  if (!(await Counter.exists({ _id }))) {
    const last = await Invoice.findOne({ salonId }).sort({ number: -1 }).lean()
    await Counter.updateOne({ _id }, { $setOnInsert: { seq: last?.number ?? 1000 } }, { upsert: true }).catch((err) => {
      if (err.code !== 11000) throw err
    })
  }
  return (await Counter.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { returnDocument: 'after' })).seq
}

// token: { date, token } when billing a live-queue customer; customerName covers walk-ins with no client profile.
// Sells stock, closes the appointment or pending bill, and adds a loyalty point per ₹100.
export async function checkout(salonId, body) {
  const { clientId = null, appointmentId = null, token = null, customerName, method } = body
  const items = (body.items ?? []).map((i) => pick(i, ['kind', 'refId', 'name', 'qty', 'price', 'staffId']))
  if (!items.length) throw badRequest('Add at least one item.')
  if (!['upi', 'cash', 'card'].includes(method)) throw badRequest('Choose how they paid.')
  const discount = Number(body.discount) || 0
  const tax = Number(body.tax) || 0
  const tip = Number(body.tip) || 0
  const total = Math.max(0, lineTotal(items) - discount + tax + tip)
  const number = await nextInvoiceNumber(salonId)

  const invoice = await Invoice.create({ salonId, id: uid('inv'), number, clientId, appointmentId, token, customerName, items, discount, tax, tip, total, method, at: Date.now() })

  const sold = items.filter((i) => i.kind === 'product')
  await Promise.all([
    ...sold.map((i) => Product.updateOne({ salonId, id: i.refId }, [{ $set: { stock: { $max: [0, { $subtract: ['$stock', i.qty] }] } } }], { updatePipeline: true })),
    token && PendingBill.deleteOne({ salonId, date: token.date, token: token.token }),
    appointmentId && Appointment.updateOne({ salonId, id: appointmentId }, { $set: { status: 'completed', invoiceId: invoice.id } }),
    clientId && Client.updateOne({ salonId, id: clientId }, { $inc: { points: Math.floor(total / 100) } }),
  ])
  return invoice
}
