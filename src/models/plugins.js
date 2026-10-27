// Shared schema settings. Ids are readable strings ("mirror-and-mane", "ld-1") shared with the web app,
// so the same id works in URLs, references and the UI.
export const opts = { minimize: false }

// Serialise as { id, ...fields } without Mongo internals
export function clean(schema, hide = []) {
  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id
      delete ret._id
      for (const key of hide) delete ret[key]
      return ret
    },
  })
  return schema
}
