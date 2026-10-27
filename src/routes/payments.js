import express, { Router } from 'express'
import * as payments from '../controllers/payments.js'

// Mounted before the JSON body parser: the webhook signature is over the raw bytes
const router = Router()

router.post('/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), payments.webhook)

export default router
