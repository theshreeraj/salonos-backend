// npm run seed — wipes the database and loads fresh demo data
import '../config/env.js'
import mongoose from 'mongoose'
import { connectDb } from '../config/database.js'
import { seedDatabase } from './index.js'

await connectDb()
await seedDatabase({ force: true })
await mongoose.disconnect()
