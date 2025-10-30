# OpenMods Functional Requirements Document (FRD)

## 1. Context
- **Vision**: Open, decentralized mod distribution and tipping network for any moddable game, enabling direct author ⇄ player value transfer via Nostr and Lightning while removing centralized gatekeepers.
- **Ethos alignment**: Censorship resistance, user sovereignty, bitcoin-native value transfer, minimal reliance on trusted intermediaries.
- **Stakeholders**:
  - Mod authors (publishers, maintainers, collaborators)
  - Players (consumers, testers, tippers)
  - Relay operators (infrastructure stewards)

## 2. Initial Proof of Concept Scope
- Demonstrate the vision using a single Skyrim SE mod project with one downloadable release.
- Publish mod metadata, release notes, and asset references via Nostr events.
- Provide verifiable download path with integrity checks.
- Allow sats streaming (zaps) from players to the mod author.

## 3. Open Questions & Assumptions
- Reputation and trust signals without central moderation (see Sections 6 & 12).
- Minimal, voluntary moderation/tooling for curated relays.
- Lightning onboarding expectations for authors and players (see Section 9).

## 4. Workstreams
- **Event Schema Design** – Define Nostr events for projects, releases, discovery.
- **Development Environment** – Relays, Lightning test stack, developer tooling.
- **Author Tooling** – CLI or lightweight client for publishing mods.
- **Player Experience** – Discovery, verification, install guidance, tipping UX.

## 5. Functional Use Cases & Patterns

### 5.1 Mod Author Lifecycle
- **Author onboarding**: Provide a trusted path for creators leaving NexusMods to generate/import Nostr keys, register Lightning addresses, and configure preferred relays without exposing secrets.
- **Project creation & migration**: Enable authors to define canonical slugs, import historical metadata (changelogs, version history), and signal official mirrors so players can confidently follow the new channel.
- **Collaboration management**: Support co-maintainers, translators, and asset contributors through shared signing (multiple pubkeys), delegation (NIP-46), or handoff flows while preserving project continuity.
- **Release preparation**: Offer tooling to validate archives, compute hashes, sign manifests, capture dependency metadata, and upload binaries to decentralized or self-hosted storage.
- **Release publication**: Publish project definitions and release manifests atomically, announce to configured relay lists, and optionally queue staged releases for timed publication.
- **Hotfixes & rollbacks**: Allow authors to deprecate or patch releases, mark known issues, and steer players toward fixed versions without deleting historical data.
- **Support & feedback loops**: Surface canonical support channels (Matrix, Discord, issues), collect player bug reports, and broadcast resolutions or FAQs via structured events.
- **Monetization patterns**: Facilitate Lightning zap splits between collaborators, offer suggested tipping tiers, and expose aggregate zap receipts so authors can replace NexusMods paywalls with voluntary support.
- **Analytics & reach**: Provide opt-in metrics (download counts, relay propagation status) that help authors understand adoption without relying on a centralized dashboard.

### 5.2 Player Lifecycle
- **Discovery & trust**: Allow players to browse curated relay lists, filter by tags, and verify mod authenticity through cryptographic signatures, hash checks, and reputation markers.
- **Evaluation**: Present release summaries, compatibility notes, dependency requirements, screenshots, and changelog highlights so players can quickly judge fit.
- **Acquisition**: Provide resilient download options (IPFS, author-hosted HTTPS, BitTorrent magnet links or .torrent files) with fallback mirrors, resumable transfers, and clear license terms.
- **Installation & management**: Deliver machine-readable install manifests that mod managers can consume, including file layout, load-order hints, conflict warnings, and optional post-install scripts.
- **Updates & notifications**: Let players subscribe to release channels, receive alerts when new versions drop, and preview breaking changes or save incompatibilities before upgrading.
- **Support & escalation**: Offer structured feedback mechanisms (zap-driven priority, tagged bug reports) and route players back to author support events.
- **Tipping & recurring support**: Enable one-off zaps, recurring pledges, and shared tipping across contributor teams; expose per-release or per-feature tipping contexts.
- **Collections & modpacks**: Allow players to compose personal loadouts or public modpacks referencing canonical release events, capturing locked versions and dependency graphs for reproducible setups.

### 5.3 Community Curation & Ecosystem Integrations
- **Curated collections & endorsements**: Let community curators publish signed recommendation sets (collections), highlight verified authors, and share themed bundles (e.g., graphics overhaul pack).
- **Reviews & quality signals**: Support structured review notes or endorsements linked to release events, enabling rich metadata without central moderation.
- **Third-party tooling hooks**: Provide APIs/templates for mod managers, patchers, and analytics dashboards to consume OpenMods events and extend the ecosystem.
- **Content provenance**: Allow lore-friendly modpacks, translation releases, or patch ESPs to reference upstream projects, making derivative work attribution transparent.

### 5.4 Relay Operator & Infrastructure Patterns
- **Admission & moderation policies**: Document how relays whitelist publishers, apply rate limits, or filter spam while preserving permissionless access at the network level.
- **Retention & replication**: Specify storage expectations, pruning strategies for large file descriptors, and cross-relay synchronization patterns so content remains discoverable.
- **Observability & maintenance**: Expose health metrics, zap volume summaries, and event ingestion stats to reassure authors that their content propagates reliably.
- **Compliance & safety**: Provide guidance for responding to takedown requests, handling NSFW content flags, and coordinating with authors when legal concerns arise without recreating NexusMods' centralized control.

### 5.5 Governance & Community Sustainability
- **Dispute resolution**: Define processes for handling impersonation, key compromise, or contested ownership of a project slug.
- **Funding shared infrastructure**: Outline how relay operators and community maintainers receive support (e.g., zap pools, donations) so the network remains sustainable without paywalls.
- **Ecosystem incentives**: Encourage community contributions (bug fixes, translations) through recognition events, bounty listings, or zap splits tied to merged work.

## 6. Security Architecture
- **Threat model overview**: Document attack surfaces spanning key compromise, malicious binaries, replay/timestamp manipulation, and relay-level tampering.
- **Key management & rotation**:
  - Encourage hardware-backed storage or delegated signing (NIP-46) for production deployments.
  - Provide CLI support for rotating keys, re-signing project definitions, and broadcasting revocation notices (`kind 30085`) when compromise is detected.
  - Maintain recovery procedures that leverage signed delegation or multisig guardian events.
- **Supply chain defenses**:
  - Require SHA-256 hashes plus optional PGP signatures on release manifests; encourage reproducible build attestations (links to Sigstore or Minisign artifacts).
  - Sandbox execution guidance recommending Mod Organizer 2/Vortex profiles, highlighting minimal permissions and scanning heuristics.
- **Replay & tampering protection**:
  - Enforce strict timestamp validation (`created_at` within ±5 minutes) and unique `d` tags per version to prevent stale updates.
  - Encourage relays to filter duplicate or downgraded events unless accompanied by explicit rollback intents.
- **Incident response**:
  - Define triage checklist for compromised authors (revoke keys, publish incident event, alert collections).
  - Provide escalation contacts for relay operators and curators; maintain shared advisories list referencing affected releases.

## 7. Scalability & Performance Strategy
- **Binary distribution architecture**:
  - Primary: BitTorrent swarms seeded by authors and voluntary mirrors. Release manifests carry magnet links or `.torrent` hashes as canonical distribution pointers so binaries never touch relay infrastructure.
  - Optional: Community-operated IPFS pins or author-hosted HTTPS mirrors may supplement the swarm, but the network assumes torrents as the default and only requirement.
- **Cost & bandwidth considerations**:
  - Authors plan their own seeding bandwidth or coordinate with trusted community seedboxes; provide guidance on lightweight seeding setups instead of centralized storage purchases.
  - Relay operators host metadata only, eliminating large egress costs and limiting operational exposure to signed text events.
- **Caching & replaceable events**:
  - Define cache invalidation strategy for `kind 30078/30079` updates using event timestamps and explicit `["supersedes","<event id>"]` tags.
  - Recommend clients persist release manifests locally so they can continue retrieving torrents while offline or when relays are unreachable.
- **Performance benchmarks**:
  - Target fast metadata sync (sub-second event retrieval) and healthy swarms capable of delivering multi-gigabyte archives on community-grade uplinks, scaling with peer count rather than centralized hosting.
- **Retention policies**:
  - Metadata retained indefinitely; binary availability derives from swarm participation. Encourage authors to maintain at least one always-on seed and recruit community co-seeders, using swarm health metrics instead of quarterly storage audits.

## 8. Legal & Sovereignty Considerations
- **Relay operator posture**:
  - Relays index signed metadata only and do not host binaries or mediate value transfer. Operators define their own moderation stance (including hands-off) and can announce it via `kind 30086` policy events for transparency.
  - Provide optional DMCA/takedown response templates for operators who choose to process such requests, but make clear that compliance choices are entirely local.
- **Author responsibility**:
  - Authors control what they publish and should disclose licenses via `["license","MIT"]` tags so downstream users can decide which content to consume.
  - Offer guidance on respecting third-party IP while affirming that enforcement is a community-level responsibility, not a protocol mandate.
- **Self-sovereign defaults**:
  - Emphasize peer-to-peer distribution and individual agency; the protocol does not adjudicate legality. Users, curators, and relay operators decide which content to share or subscribe to.
  - Encourage communities to curate their own relay lists and collections that reflect local norms rather than relying on centralized policy boards.
- **Contributor agreements**:
  - Recommend lightweight agreements for teams sharing zap revenue or signing authority, while noting these remain optional and outside protocol enforcement.

## 9. User Experience & Accessibility
- **Progressive onboarding**:
  - Offer custodial Lightning options (Alby, Wallet of Satoshi) for newcomers with a clear migration path to self-custody.
  - Guided CLI setup with beginner mode that auto-selects recommended relays and storage defaults.
- **Key management support**:
  - Provide printable backup kits, secret sharing templates, and optional key escrow (delegated signing) for high-risk authors.
- **Offline & limited connectivity**:
  - Allow players to sync collections via exportable manifest bundles (`.openmods-collection`) and share over LAN/USB.
- **Accessibility requirements**:
  - Ensure CLI and future GUI surfaces support screen readers, high-contrast themes, and keyboard-only navigation.
  - Include descriptive metadata for media assets (alt text tags).
- **Localization**:
  - Encourage multi-language release notes; see schema enhancements for language tags.

## 10. Data Integrity & Availability
- **Redundancy goals**:
  - Rely on resilient torrent swarms by default; authors keep a persistent seed online and coordinate with community seedboxes for redundancy.
  - Encourage community-operated archival relays dedicated to metadata preservation while leaving binary replication to the swarm layer.
- **Archival strategy**:
  - Flag discontinued mods with archival events; invite community members to snapshot torrents or generate cold-storage bundles if they value long-term access, without imposing centralized retention.
- **Backup & recovery**:
  - Authors maintain encrypted backups of manifests and signing keys; relay operators snapshot databases and publish recovery playbooks.
  - Provide optional tooling for authors to regenerate torrents and reseed if local nodes fail, ensuring continuity without centralized custody.
- **Service-level expectations**:
  - Relay operators publish uptime targets for metadata availability only; binary uptime is a function of swarm health and not subject to relay SLAs.
- **Historical integrity**:
  - Maintain immutable audit trail of release history even when superseded; discourage deletion except where local jurisdiction compels action.

## 11. Event Schema Enhancements
- **Tag additions**:
  - `["game-version-range",">=1.6.1170,<1.7.0"]` for compatibility bounds.
  - `["conflicts","skyrim-se.other-mod",">=2.0.0"]` to signal incompatibilities.
  - `["cw","violence"]`, `["cw","nsfw"]` for content warnings.
  - `["lang","en"]`, `["lang","es","translator npub1..."]` for localization metadata.
- **New event kinds**:
  - `kind 30081` – *Mod Review*: structured rating (`["rating","4"]`), comments, and version reference.
  - `kind 30082` – *Compatibility Report*: user-submitted test results linking to specific load orders or platforms.
  - `kind 30083` – *Mod Collection*: curated packs referencing multiple `kind 30079` events with locked version ranges.
  - `kind 30084` – *Bug/Issue Report*: structured issue with severity/tag references.
  - `kind 30085` – *Security Incident*: author-issued advisory or key revocation notice.
  - `kind 30086` – *Relay Policy Declaration*: operator-stated moderation, jurisdiction, and retention policies.
- **Schema governance**:
  - Establish standards committee (Section 12) to ratify new tags/kinds and maintain versioned JSON schemas in `docs/schemas/`.

## 12. Governance & Economic Model
- **Protocol governance**:
  - Form a community standards council of authors, relay operators, and player reps to manage schema evolution and major upgrades.
  - Implement signaling events (`kind 30100`) for proposal voting with tallying rules.
- **Relay coordination**:
  - Operate shared status board for relay health, maintenance announcements, and policy changes.
- **Economic incentives**:
  - Define optional relay service fees (e.g., zap percentage) disclosed via policy events.
  - Support zap splits across collaborators and infrastructure funds using `["zap-split","npub...", "percentage"]` tags.
  - Explore anti-spam fees (PoW or micro-zaps) for publishing to high-traffic relays.
- **Success metrics & KPIs**:
  - Track active projects, download counts, zap volume, relay uptime, and time-to-fix for reported issues.

## 13. Migration Strategy
- **Data import/export**:
  - Provide tooling to ingest NexusMods metadata (description, changelog, images) into OpenMods schemas.
  - Support export of OpenMods data back into JSON/CSV for audit or parallel platform usage.
- **Verification procedures**:
  - Cross-check migrated versions with original hashes; prompt community verification events.
- **Coexistence period**:
  - Allow dual publishing with mirrored links until authors fully transition; mark authoritative channel via project tags.
- **Author playbook**:
  - Publish step-by-step migration guide (post-PoC) including communication templates for player communities.

## 14. Documentation & Risk Management
- **Document segmentation**:
  - Maintain this FRD for requirements; spin up complementary docs post-PoC: Technical Architecture, Security Framework, Migration Guide.
- **Glossary & stakeholder map**:
  - Add glossary appendix linking key Nostr/Lightning terms; expand stakeholder table to include mod manager developers, legal advisors, content curators.
- **Risk assessment**:
  - Maintain risk matrix covering likelihood/impact for security, legal, performance, and adoption risks; update alongside roadmap.
- **Rollback procedures**:
  - Document steps to pause publishing, revert to previous manifest, and inform users via incident events.

## 15. Priority Roadmap
- **High priority (pre-MVP)**:
  - Finalize binary distribution approach (Section 7) and implement multi-tier storage.
  - Deliver threat model and key management tooling (Section 6).
  - Clarify legal compliance expectations and licensing tags (Section 8).
  - Establish data redundancy targets and archival workflow (Section 10).
- **Medium priority (post-MVP)**:
  - Formalize governance council, migration automation, and advanced discovery/collection tooling.
  - Enhance accessibility/localization features and zap analytics.
  - Design reusable game abstraction (namespaces, asset pipelines, CLI configuration) to enable additional titles without major refactor.
- **Low priority (future iterations)**:
  - Advanced economic products (subscriptions, bounties), enterprise publishing, and comprehensive moderation dashboards.

## 16. Multi-Game Extensibility
- **Namespacing strategy**:
  - Reserve a global `gameId` prefix for all deterministic slugs (`["d","<gameId>.<slug>"]`) and enforce consistent tagging (`["game","skyrim-se"]`) so additional games can reuse schemas without conflicts.
  - Maintain per-game relay suggestions via `["relays","wss://relay.example","game:skyrim-se"]` tags, allowing targeted distribution.
- **Schema adaptability**:
  - Parameterize compatibility tags (`["game-version-range",">=1.6.1170"]`) to accept multiple game identifiers and version formats.
  - Support multi-game collections where `kind 30083` events list entries across titles, each referencing the appropriate `gameId`.
- **CLI architecture**:
  - Configure `openmods.json` with `gameId`, version constraints, and storage defaults so the same commands operate across games with minimal branching.
  - Organize CLI services with pluggable game modules (e.g., install manifest generators) enabling future Skyrim SE–specific logic to coexist with other titles.
- **Storage & distribution**:
  - Keep asset pipelines abstracted (IPFS, BitTorrent, HTTPS) and game-agnostic; only metadata templates differ per game.
- **Roadmap alignment**:
  - Document requirements for the next target game (candidate: Fallout 4) and ensure schema additions remain backwards compatible.

## 17. Validation & Testing Plan *(Deferred until post-PoC)*
- **Status**: Deferred while the initial proof of concept is built; revisit once we have live user feedback.
- **Author interviews**: Schedule 3–5 sessions with mod creators (including at least two currently on NexusMods) to validate onboarding, migration, monetization, and collaboration flows; capture feedback in shared notes and translate into CLI issues.
- **Player focus group**: Recruit Skyrim SE players with varying mod manager experience to walk through discovery, trust, and installation scenarios using FRD narratives; log friction points and desired metadata upgrades.
- **Relay operator review**: Engage two relay admins to examine infrastructure requirements, retention policies, and moderation guidance; adjust schema tags or relay recommendations based on feasibility.
- **Async survey**: Distribute a structured questionnaire summarizing key lifecycle steps (authors, players, curators) with Likert-scale confidence ratings to prioritize backlog adjustments.
- **Validation checkpoint**: Host a cross-stakeholder review meeting post-feedback synthesis, confirm that identified gaps are mapped to roadmap items, and only then freeze the FRD for development.

---

## Appendix A – Event Schema Notes
- **Key NIPs**: NIP-01 (event format), NIP-12 (replaceable events), NIP-94 (file metadata), NIP-98 (HTTP auth), NIP-57 (zaps), NIP-65 (relay lists), NIP-13 (optional PoW).
- **Namespace**: Reserve custom kinds in `30xxx` range to avoid collisions.
  - `kind 30078` – *Mod Project Definition* (parameterized replaceable event keyed by slug).
  - `kind 30079` – *Mod Release Manifest* (parameterized replaceable event keyed by project slug + semantic version).
  - `kind 30080` – *Mod Support Note* (short-form support info, optional).
  - `kind 30081` – *Mod Review* (see Section 11).
  - `kind 30082` – *Compatibility Report* (see Section 11).
  - `kind 30083` – *Mod Collection* (see Section 11).
  - `kind 30084` – *Bug/Issue Report* (see Section 11).
  - `kind 30085` – *Security Incident* (see Section 6).
  - `kind 30086` – *Relay Policy Declaration* (see Section 8).
- **Project Definition (kind 30078)**:
  - `tags`:
    - `["d","skyrim-se.<slug>"]` — deterministic slug.
    - `["name","<Display Name>"]`
    - `["summary","<One-line summary>"]`
    - `["t","skyrim-se"]`, optional genre tags (`["t","quest"]`, etc.).
    - `["p","<collaborator npub>", "<role?>"]` for co-maintainers.
    - `["relays","wss://relay.example"]` optional publishing relay hints (NIP-65).
    - `["zap","<lightning address or lnurlp>"]` (as fallback if profile 0 not available).
    - `["license","MIT"]` required licensing disclosure.
    - `["cw","violence"]`, `["cw","nsfw"]` for content warnings.
    - `["lang","en"]` default language; add additional entries per translation.
    - `["policy","30086:<relay pubkey>:<relay identifier>"]` to reference host relay policies.
  - `content`: Extended description in Markdown or manifest JSON string.
  - Replaceable semantics allow latest project metadata to supersede older events.
- **Release Manifest (kind 30079)**:
  - Parameterized by `["d","skyrim-se.<slug>@<semver>"]`.
  - Tags:
    - `["a","30078:<author pubkey>:skyrim-se.<slug>"]` link back to project definition.
    - `["version","<semver>"]`
    - `["game-build","SkyrimSE-1.6.1170"]`
    - `["game-version-range",">=1.6.1170,<1.7.0"]`
    - `["requires","skse64 2.2.6"]` repeated per dependency.
    - `["conflicts","skyrim-se.other-mod",">=2.0.0"]` repeated for known incompatibilities.
    - `["hash","sha256:<digest>"]` for main archive.
    - `["size","<bytes>"]` optional.
    - `["file","nip94:<event id>"]` referencing file metadata events.
    - `["distribution","torrent:magnet:?xt=urn:btih:..."]` for BitTorrent links.
    - `["supersedes","<event id>"]` when deprecating a prior release.
    - `["sig","pgp:<fingerprint>"]` optional external signature pointer.
  - `content`: JSON manifest with structured install instructions, file layout hints, changelog.
  - Only author updates (same key) supersede content, ensuring immutability per version; new versions publish new `d` values.
- **File Metadata (NIP-94, kind 1063)**:
  - Upload binary to storage (IPFS/HTTPS) and create file descriptor event with `url`, `type`, `size`, `hash`.
  - Link from release manifest via `["file","nip94:<event id>"]`.
- **Discovery/Bookmarking**:
  - Players can publish `kind 10001` bookmark sets with `["a","30079:<pubkey>:skyrim-se.<slug>@<semver>"]`.
  - Curators can broadcast collections via `kind 30083` (see Section 11) scoped to Skyrim SE.
- **Zap Flow (NIP-57)**:
  - Author profile (kind 0) includes `["lud16","name@domain"]` or `["zap","lnurlp://..."]`.
  - `kind 9734` zap request references release manifest (`"a"` tag) and optional amount.
  - Relay returns `kind 9735` zap receipt; clients aggregate per release.
- **Integrity & Trust**:
  - Optional `kind 10002` contact lists highlight trusted authors/relays.
  - Consider `kind 9802` (proof-of-work difficulty) if enforcing anti-spam.
- **Sample Release Manifest payload**:

```json
{
  "displayName": "OpenMods Sample Mod",
  "changelog": "Initial release adding POC content.",
  "install": {
    "type": "manual",
    "instructions": [
      "Extract archive into <SkyrimSE>/Data",
      "Enable esp file via mod manager"
    ]
  },
  "assets": [
    {
      "label": "Main Archive",
      "hash": "sha256:...",
      "nip94": "note1...",
      "size": 245678901
    }
  ]
}
```
- **Reference templates**:
  - `docs/schemas/project-kind-30078.json`
  - `docs/schemas/release-kind-30079.json`
  - `docs/schemas/file-kind-1063.json`
- **Validation workflow**:
  1. Draft JSON manifest in text editor.
  2. Use `nostr-tools` or `ndk` to load JSON, compute `id`, and sign with author `nsec`.
  3. Run schema sanity check script (future) ensuring required tags exist and hashes follow `<algo>:<digest>` format.
  4. Publish to staging relay and confirm retrieval using subscription filter `{"kinds":[30079],"#d":["skyrim-se.sample-mod@1.0.0"]}`.
  5. Dry-run scripts and walkthrough: `docs/dry-run-guide.md`.

## Appendix B – Development Environment Notes
- Detailed setup instructions: `docs/dev-environment.md`
- **Relay stack**:
  - Run `nostr-rs-relay` locally via Docker; configure whitelist for author pubkey, enable SQLite backend for persistence, expose `wss://localhost:4848`.
  - Secondary option: `strfry` for high-performance replication; evaluate later.
  - Logging + metrics via Prometheus exporter (optional at POC stage).
- **Developer tools**:
  - `nostr-tools` CLI for quick event inspection (`nkey`, `nrelay`, `nevent` utilities).
  - `nostcat` or `nostr_console` for manual publish/subscribe tests.
  - Lightning dev: `lnd` or `Core Lightning` regtest node with `lncli`/`lightning-cli`.
  - Wallet UX: `Zeus` or `Alby` test credentials for zap end-to-end tests.
- **Local Lightning setup**:
  - Spin up Polar stack (regtest) with `lnd` + `rtl` UI for invoices.
  - Expose LNURL endpoint via `lnurl-node` or simple Express proxy that signs invoices using regtest node.
  - Map LNURL to author profile `lud16`.
- **Storage integration**:
  - IPFS local node (`go-ipfs`) with pinning; record CID in NIP-94 event.
  - Alternative: MinIO S3-compatible bucket; sign URLs using NIP-98 flow.
- **Testing workflow**:
  - Step 1: Publish project definition to local relay.
  - Step 2: Upload dummy ZIP to IPFS, emit NIP-94 file event.
  - Step 3: Publish release manifest referencing file event.
  - Step 4: Player client subscribes and verifies hash; optionally download via IPFS gateway.
  - Step 5: Execute zap from regtest wallet and confirm receipt event.

## Appendix C – Author CLI Notes
- Detailed plan: `docs/author-cli-plan.md`
- **Language choice**: Start with TypeScript + NDK for rapid iteration, Node-based CLI; Rust SDK considered for future hardened tooling.
- **Core capabilities** (MVP):
  - Generate/import secp256k1 keypair (support `nsec` import via env).
  - Publish/update project definition (kind 30078).
  - Upload archive to storage (IPFS pin or S3) and emit NIP-94 descriptor.
  - Publish release manifest, referencing project + file events.
  - Trigger optional broadcast to curated relay list.
- **Workflow**:
  1. `openmods init` — create project slug, manage metadata template.
  2. `openmods publish` — bundle metadata, upload assets, emit events.
  3. `openmods zap-test` — request zap using regtest LNURL to validate Lightning wiring.
- **Security considerations**:
  - Keep signing keys in memory only; support `nostr` signing devices later (NIP-46 delegation).
  - Validate storage upload integrity before publishing manifest.
  - Optionally support detached PGP signing for install manifest.
- **Future enhancements**:
  - Plugin interface for popular mod managers (Mod Organizer 2, Vortex).
  - Release rollback command that emits deprecation event (soft delete).
