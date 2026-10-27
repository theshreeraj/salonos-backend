// Running a salon's day: the live queue, walk-ins and the online-booking switch
import { isoDate } from '../../../shared/format.js'
import { badRequest, conflict, notFound } from '../utils/http.js'
import { Queue, Salon } from '../models/index.js'
import { markBookingNoShow } from '../services/bookings.js'
import { ensureQueue, takeToken } from '../services/queue.js'
import { salonForStaff } from '../services/scope.js'

export async function setBookingOpen(req, res) {
  const salon = await salonForStaff(req.staff, req.params.id)
  salon.bookingOpen = Boolean(req.body.open)
  await salon.save()
  res.json(salon.toJSON())
}

// Suspended salons disappear from the customer app
export async function setSuspended(req, res) {
  const salon = await Salon.findById(req.params.id)
  if (!salon) throw notFound('Salon')
  salon.suspended = Boolean(req.body.suspended)
  await salon.save()
  res.json(salon.toJSON())
}

async function queueFor(req) {
  const salon = await salonForStaff(req.staff, req.params.id)
  const date = req.body.date ?? isoDate()
  const _id = await ensureQueue(salon, date)
  return { salon, date, _id, queue: await Queue.findById(_id) }
}

const queueJson = (q) => ({ serving: q.serving, next: q.next, manual: Boolean(q.manual) })

export async function callNext(req, res) {
  const { _id, queue } = await queueFor(req)
  // serving === next means the last customer is done and the chair is empty
  if (queue.serving >= queue.next) throw conflict('Nobody is waiting.')
  const updated = await Queue.findByIdAndUpdate(_id, { $inc: { serving: 1 }, $set: { manual: true } }, { returnDocument: 'after' })
  res.json(queueJson(updated))
}

export async function noShow(req, res) {
  const { salon, date, _id, queue } = await queueFor(req)
  const token = Number(req.body.token)
  if (!(token >= 1 && token < queue.next)) throw badRequest('Unknown token.')
  await markBookingNoShow(salon._id, date, token)
  const skip = token === queue.serving && queue.serving < queue.next - 1
  const updated = await Queue.findByIdAndUpdate(
    _id,
    { $set: { [`marks.${token}`]: 'no-show', manual: true }, ...(skip && { $inc: { serving: 1 } }) },
    { returnDocument: 'after' },
  )
  res.json(queueJson(updated))
}

export async function addWalkIn(req, res) {
  const { salon, date, _id } = await queueFor(req)
  const name = String(req.body.name ?? '').trim()
  if (!name) throw badRequest('Enter the customer’s name.')
  const serviceIds = (req.body.serviceIds ?? []).filter((id) => salon.services.some((s) => s.id === id))
  const token = await takeToken(salon, date)
  const walkIn = { name, phone: String(req.body.phone ?? '').trim(), serviceIds, stylist: req.body.stylist || 'Any available', source: req.body.source ?? 'walk-in', createdAt: Date.now() }
  await Queue.updateOne({ _id }, { $set: { [`walkIns.${token}`]: walkIn, manual: true } })
  res.status(201).json({ token })
}

