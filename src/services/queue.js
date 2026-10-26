// Daily queue documents: created on first use, tokens handed out with an atomic counter
import { defaultQueue, queueKey } from '../../../shared/queue.js'
import { Queue } from '../models/index.js'

export const plain = (doc) => (doc?.toJSON ? doc.toJSON() : doc)

export async function ensureQueue(salon, date) {
  const s = plain(salon)
  const _id = queueKey(s.id, date)
  const start = defaultQueue(s, date)
  await Queue.updateOne(
    { _id },
    { $setOnInsert: { salonId: s.id, date, serving: start.serving, next: start.next, manual: false, walkIns: {}, marks: {} } },
    { upsert: true },
  )
  return _id
}

// Returns the token number issued
export async function takeToken(salon, date) {
  const _id = await ensureQueue(salon, date)
  const before = await Queue.findOneAndUpdate({ _id }, { $inc: { next: 1 } }, { returnDocument: 'before' })
  return before.next
}
