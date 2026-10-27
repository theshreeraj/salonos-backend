// Every API route under /api. Each file maps paths and access rules to controllers; the work happens in services.
import { Router } from 'express'
import mongoose from 'mongoose'
import { identify } from '../middleware/auth.js'
import bookings from './bookings.js'
import catalog from './catalog.js'
import customers from './customers.js'
import desk from './desk.js'
import leads from './leads.js'
import onboardings from './onboardings.js'
import portal from './portal.js'
import salonOps from './salonOps.js'

const api = Router()

api.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1, name: mongoose.connection.name }))
api.use(identify)
for (const routes of [catalog, customers, bookings, salonOps, portal, onboardings, leads, desk]) api.use(routes)

export default api
