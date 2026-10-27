import { Router } from 'express'
import * as salonOps from '../controllers/salonOps.js'
import { requireStaff } from '../middleware/auth.js'

const router = Router()
const runners = requireStaff('frontdesk', 'stylist', 'manager', 'admin')

router.put('/salons/:id/booking-open', runners, salonOps.setBookingOpen)
// Suspended salons disappear from the customer app
router.put('/salons/:id/suspended', requireStaff('admin'), salonOps.setSuspended)
router.post('/salons/:id/queue/call-next', runners, salonOps.callNext)
router.post('/salons/:id/queue/no-show', runners, salonOps.noShow)
router.post('/salons/:id/queue/walk-ins', runners, salonOps.addWalkIn)

export default router
