// Loads the demo dataset. Runs automatically on an empty database, or on demand with `npm run seed`.
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { withServices } from '../../../shared/catalog.js'
import { historyOf } from '../../../shared/leads.js'
import { makeRequest } from '../../../shared/queue.js'
import { Booking, DESK_MODELS, Lead, Onboarding, Salon, StaffUser } from '../models/index.js'
import { RAW_SALONS, SALON_META, SEED_USERS, seedLeads, seedOnboardings } from './data.js'
import { createSalonFromOnboarding } from '../services/salons.js'
import { seedDesk } from './desk.js'

const docs = (list) => list.map(({ id, ...rest }) => ({ _id: id, ...rest }))

export async function seedDatabase({ force = false, log = console.log } = {}) {
  if (!force && (await Salon.estimatedDocumentCount()) > 0) return false
  if (force) await mongoose.connection.db.dropDatabase()

  const salons = RAW_SALONS.map((s) => withServices({ ...s, meta: SALON_META[s.id] }))
  await Salon.insertMany(docs(salons))

  const passwordHash = await bcrypt.hash(SEED_USERS[0].password, 10)
  await StaffUser.insertMany(docs(SEED_USERS.map(({ password: _password, ...u }) => ({ ...u, passwordHash }))))

  const applications = await Onboarding.insertMany(docs(seedOnboardings().map((o) => ({ ...o, history: historyOf(o) }))))
  // Approved applications are live salons, exactly as if a manager had just approved them
  for (const app of applications.filter((a) => a.status === 'approved')) {
    app.salonId = (await createSalonFromOnboarding(app))._id
    await app.save()
  }
  await Lead.insertMany(docs(seedLeads()))

  for (const salon of salons) {
    const frontDesk = SEED_USERS.filter((u) => u.role === 'frontdesk' && u.salonId === salon.id)
    const desk = seedDesk(salon, frontDesk)
    for (const [key, Model] of Object.entries(DESK_MODELS)) {
      if (desk[key]?.length) await Model.insertMany(desk[key].map((x) => ({ ...x, salonId: salon.id })))
    }
  }

  // Self-managed salons start with one booking request waiting, so the stylist app isn't empty
  await Booking.insertMany(docs(salons.filter((s) => s.confirmMode === 'manual').map((s) => makeRequest(s))))

  log(`Seeded ${salons.length} salons, ${SEED_USERS.length} portal users, demo leads, applications and back-office history.`)
  return true
}
