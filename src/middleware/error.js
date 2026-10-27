import { HttpError } from '../utils/http.js'

export const notFoundRoute = (_req, _res, next) => next(new HttpError(404, 'No such API route.'))

// Express 5 forwards rejected promises from async handlers here. Errors are JSON: { error, ...extra }
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' })
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
}
