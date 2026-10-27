import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Short lease on one salon's calendar for one day ("salonId|date"). Bookings, holds and desk appointments take it
// while they check and write, so two of them can never both pass the same availability check.
const dayLockSchema = new Schema({ _id: String, owner: String, until: Number }, { versionKey: false })

export const DayLock = model('DayLock', dayLockSchema)
