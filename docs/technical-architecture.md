# OpenMods Technical Architecture

## 1. Architectural Principles
- **Self-sovereign by default**: Authors, players, and relays operate independently with no centralized custody of binaries, payments, or identities.
- **Metadata over infrastructure**: Relays transmit signed Nostr events only; binaries flow through BitTorrent swarms seeded by participants.
- **Composable protocols**: Lean on established standards (Nostr NIPs, BOLT Lightning, BitTorrent) so components can be swapped without refactoring the core.
- **Security at the edge**: Keys stay in author custody, verification happens on player machines, and incident response is broadcast through open events.
- **Extensible namespaces**: All identifiers carry a `gameId` prefix to allow future titles without schema rewrites.

## 2. System Landscape
- **Author environment**: Local workstation running the OpenMods CLI (TypeScript/Node) plus optional helper scripts for torrent generation and Lightning testing.
- **Signing & key management**: secp256k1 keys stored locally (encrypted file or delegated signer) for Nostr events; Lightning credentials remain with user-selected wallet.
- **Metadata relays**: Any Nostr relay accepting kinds `30078-30086`, `9734`, `9735`, etc. Operate in metadata-only mode; no binary storage.
- **Torrent distribution layer**: Magnet links and `.torrent` files generated per release; swarms seeded by authors and community nodes (seedboxes, home rigs).
- **Player clients**: Reference implementations (CLI/GUI) plus ecosystem integrations (mod managers) that read Nostr events, validate signatures, download torrents, and verify hashes.
- **Lightning payment infrastructure**: Author-provided LNURL/BOLT12 endpoints; zap flows follow NIP-57 with receipts for analytics.
- **Curation & governance layer**: Community-issued events (kinds `30081-30086`, `30100`) for reviews, compatibility notes, collections, policy declarations, and governance voting.

## 3. Component Details

### 3.1 Author Workstation
- **CLI responsibilities**:
  - Generate or import Nostr keys; store encrypted secret at `~/.config/openmods/<gameId>/<slug>.nsec`.
  - Scaffold metadata templates (`metadata/project.md`, `release/<version>.yaml`).
  - Produce release manifests (`kind 30079`) from structured files, including compatibility tags and magnet URIs.
  - Invoke torrent tooling (e.g., `mktorrent`, `webtorrent-hybrid`) to create `.torrent` files and magnet links, embedding SHA-256 digests from build artifacts.
  - Publish events to selected relays through a connection pool (NDK).
- **Local services**:
  - Optional Dockerized Nostr relay for staging (`nostr-rs-relay`).
  - Lightning regtest stack (Polar) for zap testing.
- **Key security**:
  - Support delegated signing via NIP-46 out of scope for PoC but reserved in design.

### 3.2 Metadata Relays
- Accept events in the `30xxx` namespace, `9734/9735`, `30100`, while rejecting binary payloads.
- Encourage operators to publish `kind 30086` policy events to advertise moderation stance, retention expectations, and jurisdiction.
- Configuration: enable parameterized replaceable events, allow large `content` payloads (up to ~128 KB) to carry manifest JSON and Markdown descriptions.
- Relay lists (NIP-65) curated per game to help discovery clients bootstrap.

### 3.3 Torrent Distribution
- Releases bundle `.torrent` files alongside magnet URIs, stored in `release/<version>/` directories and referenced via `["distribution","torrent:magnet:?xt=urn:btih:..."]` tags.
- Authors operate at least one always-on seed (home server, VPS, seedbox). Seed health is monitored via optional CLI command that queries tracker/peer counts.
- Community members may run mirror bots that subscribe to release events and automatically add new torrents to seedboxes.
- Optional IPFS pinning or HTTPS mirrors can be declared with additional `["distribution","https://..."]` tags but are not required.

### 3.4 Player Clients & Integrations
- Subscribe to relevant relays using filters on `gameId`, slug, and version tags.
- Validate signatures, check `created_at` vs. local time window, enforce `["supersedes"]` semantics.
- Fetch torrent metadata, join swarms, verify downloaded archive against `["hash","sha256:..."]`.
- Provide install instructions to mod managers; import `kind 30083` collections to build curated load orders.
- Capture zap receipts and display aggregated support metrics per release.

### 3.5 Curation & Collections
- Curators issue `kind 30083` events with deterministic IDs (`["d","<gameId>.collection.<slug>"]`), referencing specific release manifests.
- Reviews (`kind 30081`), compatibility reports (`30082`), and bug reports (`30084`) supply structured metadata for discovery clients.
- Governance proposals (`30100`) allow voting on schema or policy changes; tallies are processed off-chain by clients respecting chosen quorum rules.

### 3.6 Lightning Integration
- Authors declare zap targets in project definitions via `["zap","lnurlp://..."]` or rely on NIP-57 data in their `kind 0` profile.
- Player clients send `9734` zap requests referencing the `30079` event via `["a","30079:<pubkey>:<slug>@<version>"]`.
- Relay returns `9735` receipts which clients store locally; optional analytics scripts aggregate totals without central dashboards.
- Custodial options (Alby, Wallet of Satoshi) supported for onboarding; documentation encourages migration to self-custody.

## 4. Key Data Flows

### 4.1 Author Publish Flow
1. Author prepares release assets locally, ensuring deterministic build output.
2. CLI command `openmods release build` (future) hashes artifacts, generates torrent, and writes manifest JSON.
3. Author signs `kind 30079` event referencing magnet URI, dependencies, and hashes.
4. CLI publishes `30078` (if updated) and `30079` to configured relays; events propagate through relay mesh.
5. Author announces availability via optional `kind 1` note or curated lists.

### 4.2 Player Install Flow
1. Player client subscribes to relays for desired `gameId` and slug.
2. Upon receiving `30079`, client validates signature, checks `"supersedes"` chain, and surfaces changelog.
3. Client downloads torrent metadata, joins swarm, and retrieves archive.
4. After download, client verifies SHA-256 hash and applies install instructions, optionally via mod manager integration.

### 4.3 Zap (Tipping) Flow
1. Player selects release or collection entry; client reads zap target from project definition.
2. Client constructs `9734` zap request referencing release `["a"]` tag and desired amount; LNURL/BOLT12 invoice resolved via wallet.
3. Relay forwards request; Lightning node completes payment.
4. Relay emits `9735` receipt; client logs it and notifies author (optional `kind 30080` support message).

### 4.4 Security Incident Flow
1. Author detects compromise or malicious release.
2. CLI issues `kind 30085` incident event with summary, affected versions, and revocation instructions.
3. Curators update collections to exclude impacted releases; players receive alerts via subscribed clients.
4. Authors rotate keys, republish project definition, and reseed clean torrents.

## 5. Security Architecture Implementation
- **Key handling**: Encrypted local key files with `0600` permissions; future integration with OS keychain or hardware signing via NIP-46.
- **Manifest integrity**: Release events embed SHA-256 digests; optional PGP signatures stored under `["sig","pgp:<fingerprint>"]`. Clients verify both hash and signature where available.
- **Replay protection**: Clients enforce monotonic `created_at` timestamps and ignore downgraded `["version"]` values unless paired with explicit rollback events.
- **Supply chain controls**: Encourage reproducible builds and publish `kind 30082` compatibility reports that can flag compromised binaries.
- **Exposure minimization**: Relays never host binaries; torrents distribute payloads without centralized chokepoints.

## 6. Scalability & Performance Considerations
- **Relays**: Light load due to metadata-only events; encourage horizontal scaling via multiple community relays and client relay lists.
- **Torrent swarms**: Performance tied to number of seeders. Provide automation hooks for authors to recruit co-seeders and monitor swarm health.
- **Client caching**: Local caches of manifests and torrents allow offline usage; stale caches refreshed using `["supersedes"]` tags.
- **Analytics**: No central telemetry; optional open-source tooling can aggregate zap receipts and download stats locally.

## 7. Deployment Environments
- **Local development**: Docker-compose bundle for nostr-rs-relay, webtorrent tracker (optional), and Lightning regtest node.
- **Staging**: Small set of community relays (metadata only) plus seedboxes for shared torrents.
- **Production**: Authors choose relays and seeding infrastructure; protocol supports permissionless additions without coordination.

## 8. Multi-Game Support
- `openmods.json` carries `gameId`, defaulting to `"skyrim-se"` for the PoC.
- All deterministic IDs use `<gameId>.<slug>`; collections may aggregate entries across games.
- Game-specific metadata (e.g., load-order hints, toolchain requirements) housed in per-game schema extensions referenced from release manifests.
- CLI organized with pluggable adapters: `games/skyrim-se`, `games/fallout-4`, each providing manifest templates and validation rules.

## 9. Tooling Roadmap Alignment
- **PoC**: Deliver CLI commands for init, release build/publish, torrent generation hooks, and zap tests. Ship documentation for seeding best practices.
- **Post-PoC**: Add automated seedbox integration, delegated signing, and GUI client prototypes.
- **Long-term**: Ecosystem SDKs for mod managers, governance tooling for schema evolution, analytics dashboards that respect self-sovereignty.

## 10. Open Questions
- Preferred open tracker infrastructure or adoption of trackerless (DHT) swarms for resilience.
- Standardized torrent metadata extensions for embedding additional verification data (e.g., Merkle proofs).
- Best approach for cross-relay synchronization of incident events to avoid stale insecure releases.
- Incentive mechanisms (zap splits, badges) for community seeders who sustain swarm health.
