import { Router } from 'express'
import * as bookings from '../controllers/bookings.js'
import { requireCustomer } from '../middleware/auth.js'

const router = Router()

// Customer: reserve → pay → booking (or one step with local payments in development)
router.post('/bookings/holds', requireCustomer, bookings.hold)
router.delete('/bookings/holds/:id', requireCustomer, bookings.releaseHold)
router.post('/bookings/pay', requireCustomer, bookings.pay)
router.post('/bookings', requireCustomer, bookings.create)
router.post('/bookings/:id/respond', requireCustomer, bookings.respond)

// Customer or salon staff (checked in the controller)
router.post('/bookings/:id/cancel', bookings.cancel)

// Self-managed salons answer requests (scope checked in the controller)
router.post('/bookings/:id/accept', bookings.accept)
router.post('/bookings/:id/decline', bookings.decline)
router.post('/bookings/:id/propose', bookings.propose)

export default router
