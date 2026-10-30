// Catalogue, availability and the live feed every screen polls
import { BOOKING_DAYS, RELEASED } from '../config/catalog.js'
import { addDays, isoDate } from '../utils/dates.js'
import { Booking, Queue, Salon } from '../models/index.js'
import { loadCalendars } from '../services/availability.js'
import { scopedSalonIds } from '../services/scope.js'
import { badRequest, notFound } from '../utils/http.js'

const HISTORY_DAYS = 45
const toJson = (list) => list.map((b) => b.toJSON())

// Every salon, including suspended ones (flagged) so staff screens can show them; the app hides them.
// Who onboarded a salon and its owner are internal, so only staff get them.
export async function listSalons(req, res) {
  const salons = (await Salon.find().sort({ 'meta.onboardedOn': 1 })).map((s) => s.toJSON())
  if (!req.staff) for (const s of salons) s.meta = { district: s.meta.district, onboardedOn: s.meta.onboardedOn, chairs: s.meta.chairs }
  res.json(salons)
}

// GET /salons/:id/availability?from=YYYY-MM-DD&days=N → { [date]: { stylists: { name: [busy blocks] }, full: [blocks] } }
// Anonymous: busy times only, never who booked them.
export async function availability(req, res) {
  const salon = await Salon.findById(req.params.id)
  if (!salon) throw notFound('Salon')
  const today = isoDate()
  const from = req.query.from ?? today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < today) throw badRequest('`from` must be a date from today on.')
  const days = Number(req.query.days ?? BOOKING_DAYS)
  res.json(await loadCalendars(salon, from, Number.isFinite(days) ? days : BOOKING_DAYS))
}

// Queues, booking switches and the bookings this caller may see:
//   everyone  — anonymous upcoming slots
//   customers — their own bookings in full
//   staff     — full bookings plus walk-ins and no-show marks for salons in their scope
export async function live(req, res) {
  const today = isoDate()
  const [salons, queues, slots] = await Promise.all([
    Salon.find({}, { bookingOpen: 1 }).lean(),
    Queue.find({ date: { $gte: today } }),
    Booking.find({ date: { $gte: today }, slot: { $ne: null }, status: { $nin: RELEASED } }, { salonId: 1, date: 1, slot: 1, stylist: 1, services: 1, status: 1 }),
  ])

  const byId = new Map(toJson(slots).map((b) => [b.id, b]))
  let mine = []
  if (req.customer) {
    mine = toJson(await Booking.find({ customerId: req.customer._id }).sort({ createdAt: -1 }))
    for (const b of mine) byId.set(b.id, b)
  }

  const walkIns = {}
  const marks = {}
  if (req.staff) {
    const ids = await scopedSalonIds(req.staff)
    const visible = await Booking.find({
      salonId: { $in: ids },
      $or: [{ date: { $gte: addDays(today, -HISTORY_DAYS) } }, { status: { $in: ['requested', 'proposed'] } }],
    })
    for (const b of toJson(visible)) byId.set(b.id, b)
    for (const q of queues) {
      if (!ids.includes(q.salonId)) continue
      walkIns[q._id] = q.walkIns
      marks[q._id] = q.marks
    }
  }

  res.json({
    now: Date.now(),
    queues: Object.fromEntries(queues.map((q) => [q._id, { serving: q.serving, next: q.next, manual: Boolean(q.manual) }])),
    bookingOpen: Object.fromEntries(salons.map((s) => [s._id, s.bookingOpen !== false])),
    bookings: [...byId.values()],
    mine,
    walkIns,
    marks,
  })
}
