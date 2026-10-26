import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { config } from './config.js'
import { HttpError } from './lib/http.js'
import { identify } from './middleware/auth.js'
import bookings from './routes/bookings.js'
import customer from './routes/customer.js'
import desk from './routes/desk.js'
import leads from './routes/leads.js'
import onboardings from './routes/onboardings.js'
import portal from './routes/portal.js'
import publicRoutes from './routes/public.js'
import salonOps from './routes/salonOps.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: config.clientOrigins, allowedHeaders: ['Content-Type', 'Authorization', 'X-Customer-Token'] }))
  app.use(express.json({ limit: '1mb' }))

  const api = express.Router()
  api.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }))
  api.use(identify)
  for (const routes of [publicRoutes, customer, bookings, salonOps, portal, onboardings, leads, desk]) api.use(routes)
  api.use((_req, _res, next) => next(new HttpError(404, 'No such API route.')))
  app.use('/api', api)

  // Express 5 forwards rejected promises from async handlers here
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra })
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' })
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
  })
  return app
}
