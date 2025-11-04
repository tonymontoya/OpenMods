# Phase 1 Ready Work Items

## Torrent Build Pipeline (`openmods release build`)
- [x] Add CLI flag to opt into torrent generation and configure default trackers.
- [x] Implement torrent builder service that emits `.torrent` files into `release.torrentsDir` using config defaults.
- [x] Ensure generated torrents are appended to release manifests with deterministic SHA-256 hashes.
- [x] Add smoke tests covering torrent creation flow and manifest updates.
- [x] Document tracker best practices and required environment tooling in `docs/seeding-playbook.md`.

## Relay Publishing Integration (`project publish` / `release publish`)
- [ ] Introduce retry/backoff strategy plus granular relay result reporting.
- [ ] Capture relay telemetry (latency, error reasons) for optional JSON/log output.
- [ ] Allow per-command override of timeout/backoff and persist defaults in config.
- [ ] Extend dry-run mode to emit planned relay operations and expected payload hashes.
- [ ] Update docs with guidance on minimum healthy relay fan-out.

## Zap Regtest Integration (`zap simulate`)
- [ ] Wire command into Lightning regtest stack, reusing endpoints from `docs/dev-environment`.
- [ ] Capture zap request/receipt artifacts and surface in CLI output for verification.
- [ ] Provide option to auto-invoke LNURL callbacks against local stack with sensible retries.
- [ ] Add regression tests exercising simulated zaps against fixture relay responses.
- [ ] Document setup checklist for engineers standing up the zap regtest environment.
