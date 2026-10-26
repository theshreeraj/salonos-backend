import { config } from './config.js'
import { createApp } from './app.js'
import { connectDb } from './db.js'
import { seedDatabase } from './seed/index.js'
import { startSimulation } from './services/simulation.js'

await connectDb()
// A fresh database gets the demo dataset so every screen has something to show
await seedDatabase()
startSimulation({ simulate: config.simulate })

createApp().listen(config.port, () => {
  console.log(`SalonOS API on http://localhost:${config.port}/api (simulation ${config.simulate ? 'on' : 'off'})`)
})
