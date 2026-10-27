// Two kinds of signed-in caller:
//   staff     — portal users, token in "Authorization: Bearer <jwt>"
//   customers — app users, token in "X-Customer-Token: <jwt>"
// A browser can hold both (a salon owner booking their own haircut), so they travel in separate headers.
import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { forbidden, unauthorized } from '../utils/http.js'
import { Customer, StaffUser } from '../models/index.js'

const TOKEN_TTL = { staff: '12h', customer: '30d' }

export const signToken = (kind, id) => jwt.sign({ sub: id, kind }, config.jwtSecret, { expiresIn: TOKEN_TTL[kind] })

function verify(token, kind) {
  if (!token) return null
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    return payload.kind === kind ? payload.sub : null
  } catch {
    return null
  }
}

// Attaches req.staff and/or req.customer when valid tokens are present; never rejects on its own
export async function identify(req, _res, next) {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  const staffId = verify(bearer, 'staff')
  const customerId = verify(req.get('x-customer-token'), 'customer')
  const [staff, customer] = await Promise.all([
    staffId ? StaffUser.findById(staffId) : null,
    customerId ? Customer.findById(customerId) : null,
  ])
  req.staff = staff?.active ? staff : null
  req.customer = customer
  next()
}

export function requireStaff(...roles) {
  return (req, _res, next) => {
    if (!req.staff) return next(unauthorized('Please sign in to the portal.'))
    if (roles.length && !roles.includes(req.staff.role)) return next(forbidden())
    next()
  }
}

export function requireCustomer(req, _res, next) {
  if (!req.customer) return next(unauthorized('Please sign in with your mobile number.'))
  next()
}
