// Keeps demo salons alive: walk-ins arrive, tokens get served, self-managed salons receive booking requests,
// and requests nobody answered expire with a refund. Disable with SIMULATE=false once real salons drive the queues.
import { isOpenNow, isoDate } from '../../../shared/format.js'
import { makeRequest, queueKey } from '../../../shared/queue.js'
import { Booking, Queue, Salon } from '../models/index.js'
import { expireRequests } from './bookings.js'
import { ensureQueue, plain } from './queue.js'

const TICK_MS = 10_000
const MAX_PENDING = 2

async function tick() {
  const now = Date.now()
  const today = isoDate()
  await expireRequests(now)

  for (const doc of await Salon.find({ suspended: false })) {
    const salon = plain(doc)
    if (!isOpenNow(salon.hours)) continue
    const _id = await ensureQueue(salon, today)
    const q = await Queue.findById(_id).lean()
    const inc = {}
    if (Math.random() < 0.3) inc.next = 1
    // Once a front desk calls tokens itself (manual), only arrivals are simulated
    if (!q.manual && Math.random() < 0.45 && q.serving < q.next - 1) inc.serving = 1
    if (Object.keys(inc).length) await Queue.updateOne({ _id: queueKey(salon.id, today) }, { $inc: inc })

    if (salon.confirmMode === 'manual' && salon.bookingOpen && Math.random() < 0.2) {
      const pending = await Booking.countDocuments({ salonId: salon.id, synthetic: true, status: 'requested' })
      if (pending < MAX_PENDING) {
        const { id, ...request } = makeRequest(salon, now)
        await Booking.create({ _id: id, ...request })
      }
    }
  }
}

export function startSimulation({ simulate }) {
  const run = () => (simulate ? tick() : expireRequests()).catch((err) => console.error('simulation tick failed', err))
  run()
  return setInterval(run, TICK_MS)
}
