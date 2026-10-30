// Field agent pipeline rules

// Stage after logging a contact with this outcome
export function stageAfter(stage, outcome) {
  if (outcome === 'interested') return 'interested'
  if (outcome === 'not-interested') return 'not-interested'
  if (outcome && stage === 'new') return 'contacted'
  return stage
}

// Review history for an application; older saved data has no history array
export function historyOf(app) {
  if (app.history?.length) return app.history
  return [
    { status: 'submitted', at: app.submittedAt },
    ...(app.reviewedAt ? [{ status: app.status, at: app.reviewedAt, note: app.reviewNote }] : []),
  ]
}
