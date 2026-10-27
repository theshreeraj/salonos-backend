// Serialises writes to one salon's calendar for one day. Taking the lock is a single atomic upsert:
// it matches only an absent or lapsed lease, and a live lease makes the insert fail on the duplicate _id.
// The lease lapses on its own, so a crashed request can't block the day for more than LEASE_MS.
import { DayLock } from '../models/index.js'
import { conflict, uid } from '../utils/http.js'

const LEASE_MS = 5000
const WAIT_MS = 3000
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withDayLock(salonId, date, fn) {
  const _id = `${salonId}|${date}`
  const owner = uid('lk')
  const giveUpAt = Date.now() + WAIT_MS
  for (;;) {
    const now = Date.now()
    try {
      await DayLock.findOneAndUpdate({ _id, until: { $lt: now } }, { $set: { owner, until: now + LEASE_MS } }, { upsert: true })
      break
    } catch (err) {
      if (err.code !== 11000) throw err
    }
    if (Date.now() > giveUpAt) throw conflict('Lots of people are booking this salon right now. Please try again.', { code: 'busy' })
    await pause(30 + Math.random() * 70)
  }
  try {
    return await fn()
  } finally {
    await DayLock.updateOne({ _id, owner }, { $set: { until: 0 } })
  }
}
