import { Router } from 'express'
import * as customers from '../controllers/customers.js'
import { requireCustomer } from '../middleware/auth.js'

const router = Router()

router.post('/auth/otp', customers.requestOtp)
router.post('/auth/verify', customers.verifyOtp)
router.get('/me', requireCustomer, customers.me)
router.patch('/me', requireCustomer, customers.updateMe)
router.put('/me/favourites/:salonId', requireCustomer, customers.toggleFavourite)

export default router
