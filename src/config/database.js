import mongoose from 'mongoose'
import { config } from './env.js'

// Local MongoDB, database "salonosdb" unless MONGODB_URI says otherwise
export async function connectDb() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(config.mongoUri)
  return mongoose.connection
}
