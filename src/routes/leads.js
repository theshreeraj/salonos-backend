import { Router } from 'express'
import * as leads from '../controllers/leads.js'
import { requireStaff } from '../middleware/auth.js'

const router = Router()

router.get('/leads', requireStaff('agent', 'manager', 'admin'), leads.list)
// One lead or a bulk import: { leads: [...] }
router.post('/leads', requireStaff('agent'), leads.create)
router.post('/leads/:id/activities', requireStaff('agent'), leads.addActivity)
router.patch('/leads/:id', requireStaff('agent'), leads.update)

export default router
