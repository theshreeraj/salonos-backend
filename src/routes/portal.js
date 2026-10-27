import { Router } from 'express'
import * as portal from '../controllers/portal.js'
import { requireStaff } from '../middleware/auth.js'

const router = Router()

router.post('/portal/login', portal.login)
router.get('/portal/me', requireStaff(), portal.me)
router.get('/users', requireStaff(), portal.listUsers)
router.post('/users', requireStaff('admin'), portal.createUser)
router.patch('/users/:id', requireStaff('admin'), portal.updateUser)

export default router
