// Environment with local-development defaults
const env = process.env

// Dates ("today") and opening hours are Indian local time regardless of where the server runs
process.env.TZ = env.TZ || 'Asia/Kolkata'

const production = env.NODE_ENV === 'production'

export const config = {
  production,
  port: Number(env.PORT) || 4000,
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salonos',
  jwtSecret: env.JWT_SECRET || 'salonos-dev-secret',
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  simulate: env.SIMULATE !== 'false',
  otpDevEcho: !production && env.OTP_DEV_ECHO !== 'false',
}

if (production && config.jwtSecret === 'salonos-dev-secret') {
  throw new Error('Set JWT_SECRET in production')
}
