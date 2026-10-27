import { Router } from 'express'
import * as desk from '../controllers/desk.js'
import { requireStaff } from '../middleware/auth.js'
import { DeskService, DeskStaff, Product } from '../models/index.js'

const router = Router()
router.use('/desk', requireStaff('frontdesk'))

router.get('/desk', desk.overview)

router.post('/desk/clients', desk.createClient)
router.patch('/desk/clients/:id', desk.updateClient)
router.post('/desk/clients/:id/notes', desk.addClientNote)

// Creates, or reschedules when the body has an id
router.post('/desk/appointments', desk.saveAppointment)
router.patch('/desk/appointments/:id/status', desk.setAppointmentStatus)

router.post('/desk/checkout', desk.checkout)
router.post('/desk/pending-bills', desk.addPendingBill)

const STAFF_FIELDS = ['name', 'email', 'phone', 'role', 'title', 'color', 'salary', 'commission', 'shiftStart', 'shiftEnd', 'offDays', 'active']
for (const [path, handlers] of [
  ['staff', desk.records(DeskStaff, STAFF_FIELDS, 'st', 'Staff member')],
  ['services', desk.records(DeskService, ['name', 'category', 'mins', 'price', 'active'], 'sv', 'Service')],
  ['products', desk.records(Product, ['name', 'sku', 'category', 'price', 'cost', 'stock', 'lowAt', 'active'], 'pr', 'Product')],
]) {
  router.post(`/desk/${path}`, handlers.create)
  router.patch(`/desk/${path}/:id`, handlers.update)
}

router.post('/desk/attendance', desk.clockIn)
router.post('/desk/attendance/:id/out', desk.clockOut)
router.post('/desk/leave', desk.requestLeave)
router.patch('/desk/leave/:id', desk.setLeaveStatus)
router.post('/desk/expenses', desk.addExpense)

export default router
