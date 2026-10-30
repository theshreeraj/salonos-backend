import { Router } from 'express'
import * as config from '../controllers/config.js'

const router = Router()

router.get('/config', config.getConfig)

export default router
