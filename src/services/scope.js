// What each portal role may see and change
import { forbidden, notFound } from '../utils/http.js'
import { Salon, StaffUser } from '../models/index.js'

// Mongo filter for salons in the staff member's scope
export function salonFilter(staff) {
  switch (staff.role) {
    case 'admin':
      return {}
    case 'manager':
      return { 'meta.district': staff.district }
    case 'agent':
      return { 'meta.agentId': staff._id }
    default:
      return { _id: staff.salonId }
  }
}

export async function scopedSalonIds(staff) {
  const salons = await Salon.find(salonFilter(staff), { _id: 1 }).lean()
  return salons.map((s) => s._id)
}

// Staff who run a salon day to day, plus the manager of its district and admins
export function canRunSalon(staff, salon) {
  if (!staff || !salon) return false
  if (staff.role === 'admin') return true
  if (staff.role === 'manager') return salon.meta?.district === staff.district
  return (staff.role === 'frontdesk' || staff.role === 'stylist') && staff.salonId === salon._id
}

export async function salonForStaff(staff, salonId) {
  const salon = await Salon.findById(salonId)
  if (!salon) throw notFound('Salon')
  if (!canRunSalon(staff, salon)) throw forbidden()
  return salon
}

// Field agents visible to a manager (their district) or admin (all); agents see only themselves
export async function scopedAgentIds(staff) {
  if (staff.role === 'agent') return [staff._id]
  if (staff.role !== 'admin' && staff.role !== 'manager') return []
  const filter = { role: 'agent', ...(staff.role === 'manager' && { district: staff.district }) }
  return (await StaffUser.find(filter, { _id: 1 }).lean()).map((u) => u._id)
}

export function userFilter(staff) {
  switch (staff.role) {
    case 'admin':
      return {}
    case 'manager':
      return { $or: [{ district: staff.district }, { role: 'admin' }] }
    case 'agent':
      return { _id: staff._id }
    default:
      return { salonId: staff.salonId }
  }
}

export function onboardingFilter(staff) {
  if (staff.role === 'admin') return {}
  if (staff.role === 'manager') return { district: staff.district }
  if (staff.role === 'agent') return { agentId: staff._id }
  return { _id: null }
}
