// Customer sign-in with a one-time code sent to their mobile, and their profile
import crypto from 'node:crypto'
import { Router } from 'express'
import { config } from '../config.js'
import { badRequest, HttpError, uid } from '../lib/http.js'
import { requireCustomer, signToken } from '../middleware/auth.js'
import { Customer, Otp, Salon } from '../models/index.js'

const router = Router()
const OTP_TTL_MS = 10 * 60 * 1000
const RESEND_AFTER_MS = 30 * 1000
const MAX_ATTEMPTS = 5

const digest = (code) => crypto.createHmac('sha256', config.jwtSecret).update(code).digest('hex')
const validPhone = (phone) => /^[6-9]\d{9}$/.test(phone ?? '')

router.post('/auth/otp', async (req, res) => {
  const phone = String(req.body.phone ?? '').replace(/\D/g, '')
  if (!validPhone(phone)) throw badRequest('Enter a 10-digit mobile number.')
  const last = await Otp.findOne({ phone }).sort({ expiresAt: -1 })
  if (last && last.expiresAt.getTime() - OTP_TTL_MS > Date.now() - RESEND_AFTER_MS) throw new HttpError(429, 'Please wait a few seconds before asking for another code.')

  const code = String(crypto.randomInt(1000, 10000))
  await Otp.deleteMany({ phone })
  await Otp.create({ phone, codeHash: digest(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) })
  // TODO: send the code by SMS (MSG91, Twilio…). Until then development builds return it so the demo works.
  res.json({ sent: true, ...(config.otpDevEcho && { devCode: code }) })
})

router.post('/auth/verify', async (req, res) => {
  const phone = String(req.body.phone ?? '').replace(/\D/g, '')
  const code = String(req.body.code ?? '')
  const otp = await Otp.findOne({ phone }).sort({ expiresAt: -1 })
  if (!otp || otp.expiresAt < new Date()) throw badRequest('That code has expired. Tap Resend for a new one.')
  if (otp.attempts >= MAX_ATTEMPTS) throw badRequest('Too many wrong tries. Tap Resend for a new code.')
  if (otp.codeHash !== digest(code)) {
    otp.attempts += 1
    await otp.save()
    throw badRequest('The code you entered is incorrect. Please try again.')
  }
  await Otp.deleteMany({ phone })

  const customer = (await Customer.findOne({ phone })) ?? (await Customer.create({ _id: uid('cu'), phone, favourites: [] }))
  res.json({ token: signToken('customer', customer._id), customer: customer.toJSON() })
})

router.get('/me', requireCustomer, (req, res) => res.json(req.customer.toJSON()))

router.patch('/me', requireCustomer, async (req, res) => {
  const name = String(req.body.name ?? '').trim()
  if (name.length < 2) throw badRequest('Enter your name.')
  req.customer.name = name
  await req.customer.save()
  res.json(req.customer.toJSON())
})

// Toggles a salon in the customer's favourites
router.put('/me/favourites/:salonId', requireCustomer, async (req, res) => {
  const { salonId } = req.params
  if (!(await Salon.exists({ _id: salonId }))) throw badRequest('Unknown salon.')
  const favs = req.customer.favourites
  req.customer.favourites = favs.includes(salonId) ? favs.filter((x) => x !== salonId) : [...favs, salonId]
  await req.customer.save()
  res.json(req.customer.toJSON())
})

export default router
