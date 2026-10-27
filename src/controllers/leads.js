// Field agents' pipeline of salons not yet onboarded
import { isoDate } from '../../../shared/format.js'
import { CONTACT_KINDS, LEAD_SOURCES, OUTCOMES, stageAfter } from '../../../shared/leads.js'
import { badRequest, notFound, uid } from '../utils/http.js'
import { Lead } from '../models/index.js'
import { scopedAgentIds } from '../services/scope.js'

const TYPES = ['Men', 'Women', 'Unisex']
const isDate = (s) => s == null || /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function list(req, res) {
  const leads = await Lead.find({ agentId: { $in: await scopedAgentIds(req.staff) } }).sort({ createdAt: -1 })
  res.json(leads.map((l) => l.toJSON()))
}

// One lead or a bulk import: { leads: [...] }. Rows with a bad or duplicate phone are skipped and reported.
export async function create(req, res) {
  const rows = Array.isArray(req.body.leads) ? req.body.leads : [req.body]
  if (rows.length > 500) throw badRequest('Import at most 500 leads at a time.')
  const known = new Set((await Lead.find({ agentId: req.staff._id }, { phone: 1 }).lean()).map((l) => l.phone))
  const today = isoDate()
  const now = Date.now()
  const created = []
  const skipped = []

  rows.forEach((row, i) => {
    const phone = String(row.phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
    const name = String(row.name ?? '').trim()
    if (!name) return skipped.push({ row: i + 1, reason: 'Salon name missing' })
    if (!/^[6-9]\d{9}$/.test(phone)) return skipped.push({ row: i + 1, reason: 'Phone must be a 10-digit mobile' })
    if (known.has(phone)) return skipped.push({ row: i + 1, reason: 'Already in your leads' })
    known.add(phone)
    const note = String(row.note ?? '').trim()
    created.push({
      _id: uid('ld'),
      agentId: req.staff._id,
      district: req.staff.district,
      name,
      type: TYPES.includes(row.type) ? row.type : 'Unisex',
      area: String(row.area ?? '').trim(),
      address: String(row.address ?? '').trim(),
      owner: String(row.owner ?? '').trim(),
      phone,
      source: LEAD_SOURCES.includes(row.source) ? row.source : 'Walk-by',
      stage: 'new',
      nextFollowUp: isDate(row.nextFollowUp) && row.nextFollowUp ? row.nextFollowUp : today,
      onboardingId: null,
      createdAt: today,
      activities: note ? [{ id: uid('ac'), at: now, kind: 'note', outcome: null, note }] : [],
    })
  })

  const docs = created.length ? await Lead.insertMany(created) : []
  res.status(201).json({ created: docs.map((d) => d.toJSON()), skipped })
}

async function ownLead(req) {
  const lead = await Lead.findOne({ _id: req.params.id, agentId: req.staff._id })
  if (!lead) throw notFound('Lead')
  return lead
}

// Logs a call, visit, message or note; the outcome moves the stage and schedules the next follow-up
export async function addActivity(req, res) {
  const lead = await ownLead(req)
  const { kind, note = '', nextFollowUp = null } = req.body
  const outcome = req.body.outcome ?? null
  if (!CONTACT_KINDS[kind] || kind === 'onboarding') throw badRequest('Choose call, WhatsApp, visit or note.')
  if (outcome && !OUTCOMES[outcome]) throw badRequest('Unknown outcome.')
  if (kind !== 'note' && !outcome) throw badRequest('Pick what happened.')
  if (kind === 'note' && !String(note).trim()) throw badRequest('Write the note.')
  if (!isDate(nextFollowUp)) throw badRequest('Follow-up date is invalid.')

  lead.stage = stageAfter(lead.stage, outcome)
  lead.nextFollowUp = outcome === 'not-interested' ? null : nextFollowUp
  lead.activities.push({ id: uid('ac'), at: Date.now(), kind, outcome, note: String(note).trim() })
  await lead.save()
  res.json(lead.toJSON())
}

export async function update(req, res) {
  const lead = await ownLead(req)
  if (req.body.nextFollowUp !== undefined) {
    if (!isDate(req.body.nextFollowUp)) throw badRequest('Follow-up date is invalid.')
    lead.nextFollowUp = req.body.nextFollowUp || null
  }
  // Only reopening is allowed directly; other stage changes come from logged contacts
  if (req.body.stage === 'contacted' && lead.stage === 'not-interested') lead.stage = 'contacted'
  await lead.save()
  res.json(lead.toJSON())
}

