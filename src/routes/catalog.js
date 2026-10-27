import { Router } from 'express'
import * as catalog from '../controllers/catalog.js'

const router = Router()

router.get('/salons', catalog.listSalons)
router.get('/salons/:id/availability', catalog.availability)
router.get('/live', catalog.live)

export default router
