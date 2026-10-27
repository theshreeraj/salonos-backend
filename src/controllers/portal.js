// Portal sign-in and user management
import bcrypt from 'bcryptjs'
import { badRequest, conflict, forbidden, notFound, requireFields, uid, unauthorized } from '../utils/http.js'
import { signToken } from '../middleware/auth.js'
import { Salon, StaffUser } from '../models/index.js'
import { userFilter } from '../services/scope.js'

const ROLE_LABEL = { frontdesk: 'Front desk', stylist: 'Stylist', agent: 'Field agent', manager: 'District manager', admin: 'Super admin' }
const SALON_ROLES = ['frontdesk', 'stylist']
const DISTRICT_ROLES = ['agent', 'manager']

export async function login(req, res) {
  const { identifier = '', password = '', role } = req.body
  const id = String(identifier).trim().toLowerCase()
  const user = await StaffUser.findOne({ $or: [{ email: id }, { phone: id.replace(/\D/g, '') || '-' }] })
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) throw unauthorized('Those details don’t match an account.')
  if (!user.active) throw forbidden('This account has been deactivated. Contact your administrator.')
  if (role && user.role !== role) throw forbidden(`This account signs in as ${ROLE_LABEL[user.role]}, not ${ROLE_LABEL[role]}.`)
  res.json({ token: signToken('staff', user._id), user: user.toJSON() })
}

export const me = (req, res) => res.json(req.staff.toJSON())

export async function listUsers(req, res) {
  const users = await StaffUser.find(userFilter(req.staff)).sort({ role: 1, name: 1 })
  res.json(users.map((u) => u.toJSON()))
}

export async function createUser(req, res) {
  requireFields(req.body, ['name', 'email', 'phone', 'role', 'password'])
  const { name, phone, role, password, salonId, district } = req.body
  const email = String(req.body.email).trim().toLowerCase()
  if (!ROLE_LABEL[role]) throw badRequest('Unknown role.')
  if (!/^\d{10}$/.test(phone)) throw badRequest('Enter a 10-digit mobile number.')
  if (String(password).length < 8) throw badRequest('Use a password of at least 8 characters.')
  if (await StaffUser.exists({ email })) throw conflict('Someone already uses that email.')
  if (SALON_ROLES.includes(role) && !(await Salon.exists({ _id: salonId }))) throw badRequest('Choose a salon.')
  if (DISTRICT_ROLES.includes(role) && !district) throw badRequest('Choose a district.')

  const user = await StaffUser.create({
    _id: uid('u'),
    name: String(name).trim(),
    email,
    phone,
    role,
    passwordHash: await bcrypt.hash(String(password), 10),
    ...(SALON_ROLES.includes(role) && { salonId }),
    ...(DISTRICT_ROLES.includes(role) && { district }),
  })
  res.status(201).json(user.toJSON())
}

export async function updateUser(req, res) {
  const user = await StaffUser.findById(req.params.id)
  if (!user) throw notFound('User')
  if (req.body.active !== undefined) {
    if (user._id === req.staff._id && !req.body.active) throw badRequest("You can't deactivate your own account.")
    user.active = Boolean(req.body.active)
  }
  await user.save()
  res.json(user.toJSON())
}

