// Business constants owned by the API: fees, booking rules, the service menu, facilities, districts and lead pipeline
// values. The web app reads the public ones from GET /api/config rather than keeping its own copy.

const photo = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const PHOTOS = {
  fade: photo('photo-1622286342621-4bd786c2447c'),
  shave: photo('photo-1503951914875-452162b0f3f1'),
  barberCut: photo('photo-1599351431202-1e0f0137899a'),
  longHair: photo('photo-1522337360788-8b13dee7a37e'),
  wash: photo('photo-1634449571010-02389ed0f9b0'),
  washSmile: photo('photo-1595476108010-b4d1f102b1b1'),
  blowdry: photo('photo-1562322140-8baeececf3df'),
  facial: photo('photo-1570172619644-dfd03ed5d881'),
  makeup: photo('photo-1487412947147-5cebf100ffc2'),
  brushes: photo('photo-1516975080664-ed2fc6a32937'),
  manicure: photo('photo-1604654894610-df63bc536371'),
  nails: photo('photo-1607779097040-26e80aa78e66'),
  pedicure: photo('photo-1519415510236-718bdfcd89c8'),
  massage: photo('photo-1544161515-4ab6ce6db874'),
  tools: photo('photo-1527799820374-dcf8d9d4a388'),
  interiorPink: photo('photo-1521590832167-7bcbfaa6381f'),
  interiorMono: photo('photo-1560066984-138dadb4c035'),
  interiorBrick: photo('photo-1585747860715-2ba37e788b70'),
  interiorNoir: photo('photo-1600948836101-f9ffda59d250'),
  interiorLux: photo('photo-1633681926022-84c23e8cb2d6'),
}

export const BOOKING_FEE = 20

// Self-managed salons (no receptionist) confirm each online booking within this window
export const RESPOND_WINDOW_MS = 5 * 60 * 1000

// A customer who cancels at least this long before their time gets the booking fee back; later cancels and no-shows keep it
export const CANCEL_REFUND_HOURS = 2

export const DECLINE_REASONS = ['Fully booked today', 'Stylist not available', 'Closing soon', "Service isn't offered"]

export const CITIES = ['Pune', 'Mumbai', 'Bengaluru', 'Hyderabad']

export const DISTRICTS = [
  { id: 'pune-west', name: 'Pune West', city: 'Pune' },
  { id: 'pune-east', name: 'Pune East', city: 'Pune' },
]

export const CATEGORIES = [
  { id: 'haircut', name: 'Haircut', photo: PHOTOS.fade },
  { id: 'beard', name: 'Beard & Shave', photo: PHOTOS.shave },
  { id: 'hair-colour', name: 'Hair Colour', photo: PHOTOS.longHair },
  { id: 'hair-spa', name: 'Hair Spa', photo: PHOTOS.wash },
  { id: 'styling', name: 'Blow-dry & Styling', photo: PHOTOS.blowdry },
  { id: 'facial', name: 'Facial & Skin', photo: PHOTOS.facial },
  { id: 'makeup', name: 'Makeup', photo: PHOTOS.makeup },
  { id: 'manicure', name: 'Manicure', photo: PHOTOS.manicure },
  { id: 'pedicure', name: 'Pedicure', photo: PHOTOS.pedicure },
  { id: 'nails', name: 'Nail Art', photo: PHOTOS.nails },
  { id: 'massage', name: 'Spa & Massage', photo: PHOTOS.massage },
]

export const FACILITIES = {
  ac: { label: 'Air conditioned', icon: 'snow' },
  wifi: { label: 'Free Wi-Fi', icon: 'wifi' },
  parking: { label: 'Parking available', icon: 'parking' },
  payments: { label: 'UPI, cards & cash', icon: 'card' },
  hygiene: { label: 'Sterilised tools, fresh towels', icon: 'shield' },
  beverages: { label: 'Complimentary beverages', icon: 'coffee' },
  lounge: { label: 'Waiting lounge', icon: 'sofa' },
  products: { label: 'Premium branded products', icon: 'sparkle' },
  female: { label: 'Female staff available', icon: 'user' },
  accessible: { label: 'Wheelchair accessible', icon: 'accessible' },
}

// audience: who the service is offered to — filtered by salon type
export const MENU = {
  haircut: [
    { name: "Men's haircut", price: 250, mins: 30, audience: 'men' },
    { name: 'Kids haircut', price: 180, mins: 20, audience: 'all' },
    { name: "Women's haircut", price: 600, mins: 45, audience: 'women' },
    { name: 'Haircut + wash', price: 400, mins: 45, audience: 'all' },
  ],
  beard: [
    { name: 'Beard trim & shape', price: 150, mins: 20, audience: 'men' },
    { name: 'Hot towel shave', price: 250, mins: 30, audience: 'men' },
  ],
  'hair-colour': [
    { name: 'Root touch-up', price: 900, mins: 60, audience: 'all' },
    { name: 'Global colour', price: 2200, mins: 120, audience: 'all' },
    { name: 'Highlights', price: 3000, mins: 150, audience: 'women' },
  ],
  'hair-spa': [
    { name: 'Classic hair spa', price: 800, mins: 45, audience: 'all' },
    { name: 'Keratin treatment', price: 4500, mins: 180, audience: 'women' },
  ],
  styling: [
    { name: 'Blow-dry', price: 450, mins: 30, audience: 'women' },
    { name: 'Ironing / curls', price: 700, mins: 45, audience: 'women' },
    { name: 'Hair styling', price: 300, mins: 20, audience: 'men' },
  ],
  facial: [
    { name: 'Clean-up', price: 700, mins: 40, audience: 'all' },
    { name: 'Hydrating facial', price: 1500, mins: 60, audience: 'all' },
    { name: 'De-tan pack', price: 500, mins: 30, audience: 'all' },
  ],
  makeup: [
    { name: 'Party makeup', price: 2500, mins: 60, audience: 'women' },
    { name: 'Bridal trial', price: 5000, mins: 120, audience: 'women' },
  ],
  manicure: [
    { name: 'Classic manicure', price: 500, mins: 30, audience: 'all' },
    { name: 'Gel polish', price: 900, mins: 45, audience: 'women' },
  ],
  pedicure: [
    { name: 'Classic pedicure', price: 600, mins: 40, audience: 'all' },
    { name: 'Spa pedicure', price: 1100, mins: 60, audience: 'all' },
  ],
  nails: [
    { name: 'Nail art (per set)', price: 1200, mins: 60, audience: 'women' },
    { name: 'Extensions', price: 2000, mins: 90, audience: 'women' },
  ],
  massage: [
    { name: 'Head & shoulder massage', price: 400, mins: 20, audience: 'all' },
    { name: 'Full body massage', price: 2200, mins: 60, audience: 'all' },
  ],
}

// ---- Appointment booking rules ----

export const SLOT_MINS = 30
export const BOOKING_DAYS = 30
export const ANY_STYLIST = 'any'
// Length held for a booking with no services picked yet
export const DEFAULT_MINS = 30
// How long a slot stays reserved for a customer while they pay
export const HOLD_MINS = 10
// Booking statuses that no longer hold stylist time
export const RELEASED = ['cancelled', 'declined', 'expired', 'no-show']

// ---- Field agent sales pipeline ----

export const LEAD_SOURCES = ['Walk-by', 'Referral', 'Google Maps', 'Instagram', 'Bulk import']

// Contact kinds an agent can log; 'onboarding' entries are written by the API when an application is submitted
export const CONTACT_KINDS = ['call', 'whatsapp', 'visit', 'note', 'onboarding']

// Outcome of a contact, and the follow-up gap it suggests (days; null = no follow-up)
export const OUTCOMES = {
  interested: { label: 'Interested', followUp: 2 },
  callback: { label: 'Call back later', followUp: 3 },
  'no-answer': { label: 'No answer', followUp: 1 },
  'not-interested': { label: 'Not interested', followUp: null },
}

// ---- Front desk ----

export const STAFF_COLORS = ['peach', 'blue', 'mint', 'lavender', 'rose']
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
