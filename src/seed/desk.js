// Demo back-office history for a salon: team, catalogue, clients, bookings, sales, attendance, leave and expenses.
// Seeded from the salon id so every reseed tells the same story.
import { STAFF_COLORS } from '../config/catalog.js'
import { addDays, atMins, isoDate, nowMins, toHHMM, toMins } from '../utils/dates.js'
import { freeChair, isOffDay, isOnLeave, lineTotal } from '../utils/desk.js'
import { getCategory } from '../utils/catalog.js'
import { hash } from '../utils/queue.js'

const CLIENT_NAMES = [
  'Aditya Verma',
  'Ishaan Nair',
  'Meera Joshi',
  'Priya Sharma',
  'Rahul Kapoor',
  'Sneha Iyer',
  'Kabir Malhotra',
  'Tanvi Deshpande',
  'Arjun Mehta',
  'Riya Kulkarni',
  'Omkar Jadhav',
  'Nisha Rao',
]
const MORE_FIRST = ['Aarav', 'Diya', 'Vivaan', 'Saanvi', 'Kunal', 'Ritika', 'Yash', 'Anika', 'Siddharth', 'Kavya', 'Harsh', 'Ira', 'Varun', 'Neha']
const MORE_LAST = ['Patil', 'Gokhale', 'Shinde', 'Bhosale', 'Menon', 'Chopra']
const ALL_CLIENTS = [...CLIENT_NAMES, ...MORE_FIRST.flatMap((f, i) => [`${f} ${MORE_LAST[i % 6]}`, `${f} ${MORE_LAST[(i + 3) % 6]}`])]

// stock is what's on the shelf today, after the seeded sales
const PRODUCTS = [
  { name: 'Biotique Dry Shampoo', sku: 'DS-001', category: 'Hair care', price: 500, cost: 290, stock: 2, lowAt: 5 },
  { name: "L'Oreal Sea Salt Texturizing Spray", sku: 'SP-001', category: 'Styling', price: 550, cost: 330, stock: 4, lowAt: 5 },
  { name: 'Matrix Opti Care Conditioner', sku: 'CN-001', category: 'Hair care', price: 650, cost: 380, stock: 26, lowAt: 6 },
  { name: 'Streax Heat Protectant Serum', sku: 'SR-001', category: 'Styling', price: 750, cost: 420, stock: 20, lowAt: 5 },
  { name: 'WOW Argan Oil Shampoo', sku: 'SH-001', category: 'Hair care', price: 650, cost: 360, stock: 30, lowAt: 6 },
  { name: 'Beardo Beard Growth Oil', sku: 'BO-001', category: 'Grooming', price: 450, cost: 240, stock: 9, lowAt: 4 },
]

// Small seeded PRNG (mulberry32)
function rng(seed) {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// salon: catalogue document; frontDesk: the salon's front desk portal users
export function seedDesk(salon, frontDesk, now = new Date()) {
  const salonId = salon.id
  const meta = salon.meta
  const rand = rng(salonId)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const phone = () => `9${String(between(10000000, 99999999))}${between(0, 9)}`
  const today = isoDate(now)
  const [open, close] = salon.hours
  const domain = `${salon.name.toLowerCase().replace(/[^a-z]/g, '')}.in`
  const emailFor = (name) => `${name.replace(/^Dr\.\s*/, '').toLowerCase().split(' ').join('.')}@${domain}`

  const staff = [
    ...salon.stylists.map((p, i) => {
      const owner = p.name === meta.owner
      const early = i % 2 === 0
      return {
        id: `st-${i + 1}`,
        name: p.name,
        email: emailFor(p.name),
        phone: phone(),
        role: owner ? 'owner' : 'stylist',
        title: p.role,
        color: STAFF_COLORS[i % STAFF_COLORS.length],
        salary: owner ? 0 : Math.round((16000 + p.years * 1500) / 500) * 500,
        commission: owner ? 0 : 10,
        shiftStart: toHHMM((early ? open : Math.max(open, close - 9)) * 60),
        shiftEnd: toHHMM((early ? Math.min(close, open + 9) : close) * 60),
        offDays: [(i + 2) % 7],
        active: true,
      }
    }),
    ...frontDesk.map((u, i) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: 'frontdesk',
      title: 'Receptionist',
      color: STAFF_COLORS[(salon.stylists.length + i) % STAFF_COLORS.length],
      salary: 16000,
      commission: 0,
      shiftStart: toHHMM(open * 60),
      shiftEnd: toHHMM(Math.min(close, open + 9) * 60),
      offDays: [1],
      active: true,
    })),
  ]
  const stylists = staff.filter((s) => s.role !== 'frontdesk')

  const services = salon.services.map((s) => ({
    id: s.id,
    name: s.name,
    category: getCategory(s.category).name,
    mins: s.mins,
    price: s.price,
    active: true,
  }))

  const clients = ALL_CLIENTS.map((name, i) => ({
    id: `cl-${i + 1}`,
    name,
    phone: phone(),
    email: i % 3 === 2 ? '' : `${name.toLowerCase().replace(' ', '.')}@example.com`,
    points: 0,
    createdAt: addDays(today, -between(40, 400)),
    notes: i === 2 ? [{ id: 'nt-1', title: 'Allergy', body: 'Sensitive scalp — patch test before any colour.', at: atMins(addDays(today, -30), 660) }] : [],
  }))

  const products = PRODUCTS.map((p, i) => ({ ...p, id: `pr-${i + 1}`, active: true }))

  const leave = [
    { id: 'lv-1', staffId: stylists[1 % stylists.length].id, type: 'sick', from: addDays(today, -6), to: addDays(today, -6), reason: 'Fever', status: 'approved', createdAt: addDays(today, -6) },
    { id: 'lv-2', staffId: stylists[0].id, type: 'vacation', from: addDays(today, 12), to: addDays(today, 13), reason: 'Family trip', status: 'pending', createdAt: addDays(today, -1) },
    { id: 'lv-3', staffId: stylists[2 % stylists.length].id, type: 'personal', from: addDays(today, 4), to: addDays(today, 4), reason: 'Bank and passport work', status: 'pending', createdAt: today },
    { id: 'lv-4', staffId: stylists[stylists.length - 1].id, type: 'unpaid', from: addDays(today, -15), to: addDays(today, -14), reason: 'Travelling home for a wedding', status: 'approved', createdAt: addDays(today, -25) },
  ]

  const appointments = []
  const invoices = []
  const nowM = nowMins(now)

  for (let d = -35; d <= 6; d++) {
    const date = addDays(today, d)
    for (const s of stylists) {
      if (isOffDay(s, date) || isOnLeave(leave, s.id, date)) continue
      const end = toMins(s.shiftEnd)
      let cursor = toMins(s.shiftStart) + between(0, 3) * 15
      for (let n = 0; n < 5; n++) {
        const first = pick(services)
        const second = rand() < 0.25 ? pick(services.filter((x) => x.id !== first.id)) : null
        const chosen = second ? [first, second] : [first]
        const mins = chosen.reduce((sum, x) => sum + x.mins, 0)
        if (cursor + mins > end) break
        const chair = freeChair(appointments, meta.chairs, date, cursor, mins)
        if (chair == null) break
        const client = pick(clients)
        const ended = d < 0 || (d === 0 && cursor + mins <= nowM)
        const roll = rand()
        let status = rand() < 0.5 ? 'confirmed' : 'booked'
        if (ended) status = roll < 0.05 ? 'no-show' : roll < 0.09 ? 'cancelled' : 'completed'

        const appt = {
          id: `ap-${appointments.length + 1}`,
          clientId: client.id,
          staffId: s.id,
          anyStylist: false,
          serviceIds: chosen.map((x) => x.id),
          date,
          start: cursor,
          mins,
          chair,
          status,
          notes: '',
          createdAt: atMins(addDays(date, -between(0, 4)), 600),
        }

        if (status === 'completed') {
          const items = chosen.map((x) => ({ kind: 'service', refId: x.id, name: x.name, qty: 1, price: x.price, staffId: s.id }))
          if (rand() < 0.2) {
            const p = pick(products)
            items.push({ kind: 'product', refId: p.id, name: p.name, qty: 1, price: p.price, staffId: s.id })
          }
          const subtotal = lineTotal(items)
          const tax = Math.round(subtotal * 0.18)
          const tip = rand() < 0.2 ? pick([50, 100, 200]) : 0
          const invoice = {
            id: `inv-${invoices.length + 1}`,
            number: 1001 + invoices.length,
            clientId: client.id,
            appointmentId: appt.id,
            items,
            discount: 0,
            tax,
            tip,
            total: subtotal + tax + tip,
            method: pick(['upi', 'upi', 'cash', 'card']),
            at: atMins(date, cursor + mins + 5),
          }
          invoices.push(invoice)
          appt.invoiceId = invoice.id
          client.points += Math.floor(invoice.total / 100)
        }
        appointments.push(appt)
        cursor += mins + pick([0, 15, 30, 45, 60, 90])
      }
    }
  }

  const attendance = []
  for (let d = -40; d <= 0; d++) {
    const date = addDays(today, d)
    for (const s of staff) {
      if (isOffDay(s, date) || isOnLeave(leave, s.id, date)) continue
      const start = toMins(s.shiftStart)
      const end = toMins(s.shiftEnd)
      if (d < 0) {
        if (rand() < 0.06) continue
        attendance.push({ id: `at-${attendance.length + 1}`, staffId: s.id, in: atMins(date, start + between(-10, 25)), out: atMins(date, end + between(-15, 30)) })
      } else if (nowM > start && rand() < 0.85) {
        const inAt = Math.min(start + between(-10, 20), nowM - 1)
        attendance.push({ id: `at-${attendance.length + 1}`, staffId: s.id, in: atMins(date, inAt), out: nowM > end ? atMins(date, end + between(0, 20)) : null })
      }
    }
  }

  const expenses = []
  for (let d = -90; d <= 0; d++) {
    const date = addDays(today, d)
    const dom = Number(date.slice(8))
    const add = (category, amount, note) => expenses.push({ id: `ex-${expenses.length + 1}`, date, category, amount, note })
    if (dom === 1) add('Rent', meta.chairs * 11000, 'Monthly shop rent')
    if (dom === 5) add('Utilities', between(9, 15) * 1000, 'Electricity and water')
    if (dom === 10) add('Marketing', 5000, 'Instagram promotions')
    if (dom % 7 === 3) add('Supplies', between(15, 60) * 100, pick(['Colour tubes and developer', 'Towels and capes', 'Disposables and gloves', 'Wax and strips']))
    if (dom === 15 || dom === 28) add('Laundry', 1800, 'Towel laundry service')
  }

  return { staff, services, clients, products, appointments, invoices, attendance, leave, expenses }
}
