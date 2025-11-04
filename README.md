# OpenMods

OpenMods is an initiative to build a self-sovereign mod distribution and tipping network that empowers authors and players across any moddable game. We are currently aligning requirements, architecture, and delivery plans before resuming code work. This README serves as an entry point for collaborators—especially Nostr developers—to review the approach and offer feedback.

## Vision

> **Excerpt from `docs/openmods-frd.md`**  
> *“Open, decentralized mod distribution and tipping network for any moddable game, enabling direct author ⇄ player value transfer via Nostr and Lightning while removing centralized gatekeepers.”*

Our immediate proof of concept focuses on a single Skyrim SE mod to validate the flow end-to-end, while the overall architecture is intentionally multi-game.

## Guiding Philosophy

The project is grounded in the sovereignty principles captured in `docs/SOVEREIGN_ENGINEERING_PRINCIPLES.md`, emphasizing:
- Protocols over platforms
- Metadata-only relays and peer-to-peer binaries (BitTorrent-first)
- User-controlled keys, self-custody Lightning payments, and easy exits
- Rapid iteration backed by transparent documentation

## Technical Approach (Current Draft)

Highlights from `docs/technical-architecture.md`:
- **Author workflow**: TypeScript/Node CLI to manage metadata, generate torrents, and publish Nostr events (`kind 30078/30079`).
- **Distribution**: Binaries distributed exclusively via BitTorrent swarms; relays handle signed metadata only.
- **Payments**: Lightning zaps (NIP-57) with LNURL/BOLT12 endpoints supplied by authors.
- **Curation**: Structured events (`kind 30081-30086`, `30100`) for reviews, compatibility reports, collections, and governance.
- **Multi-game readiness**: Deterministic IDs carry a `gameId` prefix, and CLI modules will support future titles beyond the Skyrim SE PoC.

## Delivery Roadmap

`docs/project-management-plan.md` outlines four phases:
1. **Documentation alignment** (current): finalize FRD, architecture, and planning docs.
2. **PoC tooling**: deliver the CLI foundation, torrent workflow, and zap testing path.
3. **Community pilot**: onboard a small group of authors/players for feedback.
4. **Post-PoC enhancements**: governance processes, delegated signing, multi-game adapters.

Backlog follow-ups—including UX blueprinting and security hardening—are tracked in `docs/backlog.md`.

## Feedback Wanted

We’re actively collecting input on:
- The feasibility of the BitTorrent + Nostr + Lightning combo at scale.
- Schema design for new event kinds (reviews, compatibility reports, incident advisories).
- UX expectations for both authors and players, especially around key management and seeding.
- Governance and incentive mechanisms that keep the network sustainable without central gatekeepers.

### How to Engage

1. Review the core docs:
   - Functional Requirements: `docs/openmods-frd.md`
   - Technical Architecture: `docs/technical-architecture.md`
   - Project Management Plan: `docs/project-management-plan.md`
   - Sovereign Engineering Principles: `docs/SOVEREIGN_ENGINEERING_PRINCIPLES.md`
   - Backlog & Open Questions: `docs/backlog.md`
2. Open an issue or discussion with your findings, or submit a PR with suggested edits.

## CLI Getting Started

```bash
cd cli
pnpm install
pnpm dev -- --help
# Optional: pnpm validate:samples
```

Key commands (dry-run by default until relay integration lands):

- `openmods init --slug <project-slug> --author-pubkey <npub>` – scaffold `openmods.json` with relay defaults.
- `openmods project scaffold` – generate `project/project.json` populated from config (safe to re-run with `--force`).
- `openmods project publish --manifest project/project.json [--summary] [--no-dry-run]` – sign or stage a kind 30078 project definition; add `--no-dry-run` (and optional `--relay wss://...`) to push to relays once signed.
- `openmods project inspect` – preview project manifest metadata before publishing.
- `openmods release scaffold --version 0.1.0` – create `artifacts/changelog.md` + stub release manifest.
- `openmods release build --artifact artifacts/mod.zip --generate-torrents --tracker udp://tracker.opentrackr.org:1337/announce` – emit a release manifest with hashes and auto-generate torrent metadata into `artifacts/torrents/`.
- `openmods release publish --manifest artifacts/release/manifest.json [--summary] [--no-dry-run --relay-timeout 7000 --relay-retries 3 --relay-backoff 500]` – prepare a signed kind 30079 release event; combine with `--no-dry-run` (and `--relay wss://...`) to broadcast with configurable retry/backoff.
- `openmods release verify --event artifacts/release/event-30079.json` – confirm signature validity and manifest parity.
- `openmods release inspect` – review release manifest hashes, artifacts, and dependencies at a glance.
- `openmods validate config|project-manifest|release-manifest` – lint local files against bundled schemas.
- `openmods lint release --manifest artifacts/release/manifest.json [--skip-tracker-checks]` – verify artifact files, hashes, and tracker health before publishing.
- `openmods config rotate-author-key <npub>` – replace the project’s signing key reference in `openmods.json`.
- `openmods config set-signer --mode delegated --relay <url> --remote-pubkey <npub>` – record delegated signer metadata for future NIP-46 flows (defaults to local signing).
- `openmods zap simulate --release-event artifacts/release/event-30079.json --amount 500 [--summary] [--secret/--pubkey --lnurl-metadata … --receipt-secret … --invoke-callback]` – craft a kind 9734 zap request (with LNURL metadata hashing, optional LNURL callback, and receipt).
- `openmods diff project <base> <head> [--summary --format json]` / `openmods diff release <base> <head> [--summary --format json]` – compare manifest versions before publishing.
- `openmods seed status <torrent-or-magnet> [--tracker ... --transmission-url ... --qbittorrent-url ... --deluge-url ...]` – query tracker health plus Transmission/qBittorrent/Deluge stats, complementing the seeding playbook.

Project and release manifest schemas live in `docs/schemas/`; refer to `docs/seeding-playbook.md` for PoC seeding guidance.

## Status

- ✅ Project documentation phase underway  
- ✅ CLI scaffolding plus project/release workflows staged under `cli/`  
- 🔄 Feedback collection in progress  

Stay tuned as we iterate on the blueprint. Your input now will directly shape the implementation path as we evolve the PoC build. Sovereign mod distribution only works if the community co-designs it—thanks for weighing in!
