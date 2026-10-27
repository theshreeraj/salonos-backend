// Errors with an HTTP status, turned into JSON responses by the error handler in app.js
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export const badRequest = (message, extra) => new HttpError(400, message, extra)
export const unauthorized = (message = 'Please sign in.') => new HttpError(401, message)
export const forbidden = (message = "You don't have access to this.") => new HttpError(403, message)
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`)
export const conflict = (message, extra) => new HttpError(409, message, extra)

export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Keeps only the listed keys that are present in the request body
export function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body?.[k] !== undefined) out[k] = body[k]
  return out
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body[f] === null || body[f] === '')
  if (missing.length) throw badRequest(`Missing ${missing.join(', ')}.`)
}
