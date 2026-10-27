import { config } from './config/env.js'
import mongoose from 'mongoose'
import { createApp } from './app.js'
import { connectDb } from './config/database.js'
import { seedDatabase } from './seed/index.js'
import { paymentsLive } from './services/payments.js'
import { startSimulation } from './services/simulation.js'

await connectDb()
// A fresh database gets the demo dataset so every screen has something to show
await seedDatabase()
startSimulation({ simulate: config.simulate })

createApp().listen(config.port, () => {
  console.log(`SalonOS API on http://localhost:${config.port}/api · database ${mongoose.connection.name} · payments ${paymentsLive ? 'Razorpay' : 'local (no charge)'} · simulation ${config.simulate ? 'on' : 'off'}`)
})
