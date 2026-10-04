# Workout completion and recovery

## Completion protocol

Set changes, extra sets, extra exercises, and cardio changes persist their local
snapshot and outbox entries in one IndexedDB transaction. Finishing freezes the
snapshot and writes one `COMPLETE_WORKOUT` mutation in the same transaction.
Repeated finish clicks reuse that pending operation. Background-sync registration
and network synchronization do not block navigation to the locally saved summary.

The server validates the snapshot against the authenticated user's session and
immutable load snapshots. Extra exercises must reference available catalogue
entries. All set, cardio, and completion writes run in the same PostgreSQL
transaction as the existing `ClientMutation` idempotency record. A failed field
rolls back the entire completion operation. Replaying an accepted operation with
the same ID and payload returns its existing receipt; a changed payload is rejected.

The local summary opens server history only after receiving an applied/duplicate
receipt for its own completion operation. A globally empty queue is not proof of
completion. Rejected or merely acknowledged operations remain locally available
for review. An accepted snapshot supersedes earlier set/cardio operations for that
session; timer errors remain separate because the snapshot does not replace raw
timer events.

Requests have a 45-second timeout. Temporary database failures and network failures
retain retryable work. Foreground retries back off from 5 to 60 seconds, with
additional retries on startup, focus, reconnection, and new outbox work. Browsers
supporting Web Locks coordinate upload across tabs. Account changes stop the old
upload flow before processing acknowledgements for the newly selected account.

## Recovery

The local summary offers **Export saved workout**, **Retry upload**, and, for a
rejected completion snapshot, **Review local workout**. Export includes the local
workout and pending payloads; treat the downloaded file as personal data.

Reviewing a local workout allows corrections before submitting a new completion
operation. The original rejected completion payload remains queued until a valid
snapshot is accepted. Do not reset browser storage to resolve synchronization.

Already-completed server sessions are not overwritten by a different completion
operation. Existing incidents in which older clients discarded updates require
comparison of exported local data and server history. This release cannot recreate
data that no longer exists on either side. A completed-session conflict remains
visible and requires reconciliation; retrying it does not overwrite history.

## Deployment and validation

No Prisma migration or production data reset is needed. Deploy server and client
together; reload the installed PWA to use snapshot completion. Older clients retain
the previous mutation protocol and do not gain the new completion guarantee until
updated.

Run `npm run check`, `npm run db:validate`, and `npm run build`.
`npm run verify:completion` requires a seeded, migrated, isolated PostgreSQL database
whose name ends in `_test`. It checks rollback on an invalid later set, typed loads,
cardio, duplicate receipt replay, completed-history protection, and ownership.
It creates and removes only its own test user's records. The GitHub validation
workflow supplies this database automatically.

Real mobile/browser interruption tests remain required before calling the release
fully production-verified. This implementation does not introduce a general
cross-device revision/merge protocol. Competing completion requests are rejected,
but concurrent in-progress edits across devices still need an explicit policy.
The separate legacy direct-finish route remains for older callers; modern clients
use snapshot completion through `/api/sync`.

## Subsequent optimisation work

Further work from the review includes a browser end-to-end suite, a cross-device
revision protocol, an admin reconciliation/diagnostics screen, paginated history,
measured database index changes, active-versus-elapsed duration semantics, durable
email jobs, broader authentication rate limits and expiry cleanup, and deployment
jobs separated from application startup. Backup and restore must be verified in
the deployment environment. These are not implied to be implemented by this change.
