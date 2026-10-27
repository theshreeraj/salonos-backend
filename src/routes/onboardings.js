import { Router } from 'express'
import * as onboardings from '../controllers/onboardings.js'
import { requireStaff } from '../middleware/auth.js'

const router = Router()

router.get('/onboardings', requireStaff(), onboardings.list)
router.post('/onboardings', requireStaff('agent'), onboardings.create)
// Agent fixes an application the manager sent back
router.post('/onboardings/:id/resubmit', requireStaff('agent'), onboardings.resubmit)
router.post('/onboardings/:id/review', requireStaff('manager', 'admin'), onboardings.review)

export default router
