// Salon onboarding: agents submit, district managers review, approval puts the salon live
import { CATEGORIES, FACILITIES } from '../../../shared/catalog.js'
import { isoDate } from '../../../shared/format.js'
import { historyOf } from '../../../shared/leads.js'
import { badRequest, conflict, forbidden, notFound, uid } from '../utils/http.js'
import { Lead, Onboarding } from '../models/index.js'
import { createSalonFromOnboarding } from '../services/salons.js'
import { onboardingFilter } from '../services/scope.js'

export async function list(req, res) {
  const list = await Onboarding.find(onboardingFilter(req.staff)).sort({ submittedAt: -1 })
  res.json(list.map((o) => o.toJSON()))
}

// The application form, checked the same way the wizard checks it
function applicationFields(body) {
  const f = {
    name: String(body.name ?? '').trim(),
    type: body.type,
    area: String(body.area ?? '').trim(),
    address: String(body.address ?? '').trim(),
    owner: String(body.owner ?? '').trim(),
    ownerPhone: String(body.ownerPhone ?? ''),
    ownerEmail: String(body.ownerEmail ?? '').trim(),
    gstin: String(body.gstin ?? '').trim().toUpperCase(),
    chairs: Number(body.chairs),
    hours: (body.hours ?? []).map(Number),
    categories: (body.categories ?? []).filter((c) => CATEGORIES.some((x) => x.id === c)),
    facilities: (body.facilities ?? []).filter((x) => FACILITIES[x]),
  }
  if (!f.name || !f.area || !f.address) throw badRequest('Salon name, area and address are required.')
  if (!['Men', 'Women', 'Unisex'].includes(f.type)) throw badRequest('Choose who the salon serves.')
  if (!(f.chairs >= 1 && f.chairs <= 40)) throw badRequest('Chairs must be between 1 and 40.')
  if (f.hours.length !== 2 || !(f.hours[1] > f.hours[0])) throw badRequest('Closing time must be after opening time.')
  if (!f.categories.length) throw badRequest('Pick at least one service category.')
  if (!f.owner || !/^\d{10}$/.test(f.ownerPhone)) throw badRequest('Owner name and a 10-digit mobile are required.')
  return f
}

export async function create(req, res) {
  const today = isoDate()
  const leadId = req.body.leadId ?? null
  const lead = leadId ? await Lead.findOne({ _id: leadId, agentId: req.staff._id }) : null
  if (leadId && !lead) throw badRequest('Unknown lead.')
  if (lead?.onboardingId) throw conflict('This lead was already submitted.')

  const app = await Onboarding.create({
    _id: uid('ob'),
    ...applicationFields(req.body),
    district: req.staff.district,
    agentId: req.staff._id,
    leadId,
    status: 'pending',
    submittedAt: today,
    history: [{ status: 'submitted', at: today }],
  })
  if (lead) {
    lead.onboardingId = app._id
    lead.nextFollowUp = null
    lead.activities.push({ id: uid('ac'), at: Date.now(), kind: 'onboarding', outcome: null, note: 'Submitted for approval.' })
    await lead.save()
  }
  res.status(201).json(app.toJSON())
}

// Agent fixes an application the manager sent back
export async function resubmit(req, res) {
  const app = await Onboarding.findOne({ _id: req.params.id, agentId: req.staff._id })
  if (!app) throw notFound('Application')
  if (app.status !== 'rejected') throw conflict('Only applications sent back for changes can be resubmitted.')
  Object.assign(app, applicationFields(req.body), { status: 'pending', reviewNote: '', history: [...historyOf(app.toJSON()), { status: 'resubmitted', at: isoDate() }] })
  await app.save()
  res.json(app.toJSON())
}

export async function review(req, res) {
  const app = await Onboarding.findById(req.params.id)
  if (!app) throw notFound('Application')
  if (req.staff.role === 'manager' && app.district !== req.staff.district) throw forbidden()
  if (app.status !== 'pending') throw conflict('This application was already reviewed.')
  const { status } = req.body
  const note = String(req.body.note ?? '').trim()
  if (!['approved', 'rejected'].includes(status)) throw badRequest('Approve or send back.')
  if (status === 'rejected' && !note) throw badRequest('Tell the agent what to fix.')

  const today = isoDate()
  Object.assign(app, { status, reviewNote: note, reviewedAt: today, history: [...historyOf(app.toJSON()), { status, at: today, note }] })
  if (status === 'approved') app.salonId = (await createSalonFromOnboarding(app))._id
  await app.save()
  res.json(app.toJSON())
}

