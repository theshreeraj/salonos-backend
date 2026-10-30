// Salon menu and derived catalogue fields
import { CATEGORIES, MENU } from '../config/catalog.js'

export function buildServices(categories, type, tier) {
  return categories.flatMap((category) =>
    MENU[category]
      .filter((s) => s.audience === 'all' || type === 'Unisex' || s.audience === type.toLowerCase())
      .map((s, i) => ({
        id: `${category}-${i}`,
        category,
        name: s.name,
        mins: s.mins,
        price: Math.round((s.price * tier) / 10) * 10,
      })),
  )
}

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id)

// Fills in the derived fields every salon document carries (menu, starting price)
export function withServices(salon) {
  const services = buildServices(salon.categories, salon.type, salon.tier ?? 1)
  return { confirmMode: 'auto', city: 'Pune', ...salon, services, startingPrice: Math.min(...services.map((x) => x.price)) }
}
