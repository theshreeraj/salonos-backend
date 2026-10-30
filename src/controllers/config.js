// Constants the web app needs before it renders: fees, booking rules, the catalogue vocabulary and districts
import * as catalog from '../config/catalog.js'
import { config } from '../config/env.js'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../seed/data.js'

export function getConfig(_req, res) {
  res.json({
    bookingFee: catalog.BOOKING_FEE,
    cancelRefundHours: catalog.CANCEL_REFUND_HOURS,
    booking: {
      slotMins: catalog.SLOT_MINS,
      bookingDays: catalog.BOOKING_DAYS,
      defaultMins: catalog.DEFAULT_MINS,
    },
    photos: catalog.PHOTOS,
    cities: catalog.CITIES,
    districts: catalog.DISTRICTS,
    categories: catalog.CATEGORIES,
    facilities: catalog.FACILITIES,
    declineReasons: catalog.DECLINE_REASONS,
    leadSources: catalog.LEAD_SOURCES,
    outcomes: catalog.OUTCOMES,
    // Demo sign-ins only exist in a seeded development database
    demo: config.production ? null : { password: DEMO_PASSWORD, accounts: DEMO_ACCOUNTS },
  })
}
