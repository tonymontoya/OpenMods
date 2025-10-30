# OpenMods

OpenMods is a documentation-driven initiative to build a self-sovereign mod distribution and tipping network that empowers authors and players across any moddable game. We are currently aligning requirements, architecture, and delivery plans before resuming code work. This README serves as an entry point for collaborators—especially Nostr developers—to review the approach and offer feedback.

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
3. Reach out on Nostr (DM @tonymontoya) for synchronous conversations or to join upcoming review calls.

## Status

- ✅ Documentation-first phase underway  
- 🔄 Feedback collection in progress  
- ⏳ CLI scaffolding paused until documentation is validated  

Stay tuned as we iterate on the blueprint. Your input now will directly shape the implementation path once we move into the PoC build. Sovereign mod distribution only works if the community co-designs it—thanks for weighing in!
