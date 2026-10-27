import cors from 'cors'
import express from 'express'
import { config } from './config/env.js'
import { errorHandler, notFoundRoute } from './middleware/error.js'
import api from './routes/index.js'
import payments from './routes/payments.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: config.clientOrigins, allowedHeaders: ['Content-Type', 'Authorization', 'X-Customer-Token'] }))
  // Gateway webhooks need the raw body for their signature, so they're mounted before JSON parsing
  app.use('/api', payments)
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', api, notFoundRoute)
  app.use(errorHandler)
  return app
}
