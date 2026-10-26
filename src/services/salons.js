// Approving an onboarding application puts the salon live in the customer app
import { PHOTOS, withServices } from '../../../shared/catalog.js'
import { isoDate } from '../../../shared/format.js'
import { Salon } from '../models/index.js'

const PHOTO_SETS = {
  Men: [PHOTOS.interiorBrick, PHOTOS.barberCut, PHOTOS.shave],
  Women: [PHOTOS.interiorPink, PHOTOS.facial, PHOTOS.manicure],
  Unisex: [PHOTOS.interiorNoir, PHOTOS.blowdry, PHOTOS.washSmile],
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function uniqueId(name) {
  const base = slugify(name) || 'salon'
  let id = base
  for (let n = 2; await Salon.exists({ _id: id }); n++) id = `${base}-${n}`
  return id
}

export async function createSalonFromOnboarding(app) {
  if (app.salonId) return Salon.findById(app.salonId)
  const id = await uniqueId(app.name)
  const salon = withServices({
    id,
    name: app.name,
    type: app.type,
    area: app.area,
    address: app.address,
    // Distance and reviews fill in once customers start using the salon
    distanceKm: null,
    rating: 0,
    reviews: 0,
    hours: app.hours,
    tier: 1,
    avgMins: 25,
    queue: { serving: 0, next: 1 },
    photos: PHOTO_SETS[app.type] ?? PHOTO_SETS.Unisex,
    categories: app.categories,
    facilities: app.facilities,
    stylists: [{ name: app.owner, role: 'Owner', years: 0 }],
    about: `${app.name} in ${app.area}, onboarded on SalonOS.`,
    phone: `+91 ${app.ownerPhone}`,
    meta: { district: app.district, agentId: app.agentId, owner: app.owner, onboardedOn: app.reviewedAt ?? isoDate(), chairs: app.chairs },
    onboardingId: app._id,
  })
  const { id: _id, ...rest } = salon
  return Salon.create({ _id, ...rest })
}
