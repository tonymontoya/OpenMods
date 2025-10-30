# OpenMods Project Management & Implementation Plan

## 1. Guiding Themes
- **Documentation-first**: Finalize requirements and architecture artifacts before writing production code.
- **Self-sovereign delivery**: Prioritize work that reinforces decentralized ownership (torrent-first distribution, metadata-only relays, edge security).
- **Incremental validation**: Target a functional PoC with a single flagship mod, then iterate based on live feedback.
- **Community collaboration**: Involve authors, players, and relay operators in review checkpoints; track deferred validation items separately.

## 2. Phase Overview
- **Phase 0 – Documentation Alignment (In Progress)**
  - Deliverables: FRD (v1), Technical Architecture, Project Management Plan, Implementation Roadmap.
  - Exit criteria: All documents reviewed, high-priority risks logged, scope for PoC frozen.
- **Phase 1 – PoC Tooling & Infrastructure**
  - Focus: Author CLI foundation, torrent generation workflow, metadata publishing, zap testing path.
  - Exit criteria: End-to-end publish/install/zap flow for one Skyrim SE mod using community relays and torrents.
- **Phase 2 – Community Pilot & Feedback**
  - Focus: Recruit small group of mod authors + players, gather qualitative feedback, refine docs.
  - Exit criteria: Feedback synthesized, backlog reprioritized, decision on expanding to additional mods.
- **Phase 3 – Post-PoC Enhancements**
  - Focus: Governance processes, multi-game extensibility, automation (seedboxes, delegated signing), accessibility improvements.
  - Exit criteria: Core feature set hardened, governance council formed, roadmap refreshed for broader rollout.

## 3. Milestones & Deliverables

### Milestone M0 – Documentation (Weeks 1–2)
- Finalize FRD updates (self-sovereign distribution, security, governance) – *Owner: Product Lead*.
- Publish Technical Architecture doc – *Owner: Lead Engineer*.
- Draft Project Plan & Implementation Roadmap – *Owner: Program Manager*.
- Define success metrics + KPIs in FRD Section 12 – *Owner: Product Lead*.

### Milestone M1 – PoC Foundation (Weeks 3–6)
- Scaffold CLI architecture (TypeScript) with `openmods init` baseline – *Owner: Lead Engineer*.
- Implement torrent generation pipeline (CLI integration with `mktorrent` or Node module) – *Owner: Tooling Engineer*.
- Publish `kind 30078/30079` events to test relay; validate schema compliance – *Owner: Protocol Engineer*.
- Integrate zap test command (`kind 9734/9735`) against regtest Lightning stack – *Owner: Lightning Engineer*.
- Author seedbox setup guide and scripts for always-on seeding – *Owner: Infrastructure Engineer*.

### Milestone M2 – PoC Validation (Weeks 7–9)
- Publish flagship mod release end-to-end using OpenMods pipeline – *Owner: Author Partner*.
- Run internal “player install” walkthrough, capture feedback – *Owner: UX Researcher*.
- Document known gaps and open questions; update `docs/backlog.md` – *Owner: Program Manager*.
- Decide on next game candidate and record requirements snapshot – *Owner: Product Lead*.

### Milestone M3 – Community Pilot (Weeks 10–14)
- Onboard 3–5 external authors; support migrations and feedback loops – *Owner: Community Lead*.
- Collect structured feedback via interviews/surveys (deferred plan) – *Owner: UX Researcher*.
- Iterate CLI based on pilot outcomes (key management, seeding scripts) – *Owner: Engineering Team*.
- Prepare public documentation (getting started, seeding best practices) – *Owner: Technical Writer*.

### Milestone M4 – Post-PoC Enhancements (Weeks 15+)
- Launch governance council pilot and publish proposal workflow – *Owner: Community Lead*.
- Implement multi-game adapters in CLI (`gameId` support) – *Owner: Lead Engineer*.
- Add delegated signing (NIP-46) support for hardware wallets – *Owner: Security Engineer*.
- Automate seedbox orchestration (Docker/Ansible scripts) – *Owner: Infrastructure Engineer*.
- Reassess roadmap with community vote; publish next-phase commitments – *Owners: Product Lead + Governance Council*.

## 4. Roles & Responsibilities
- **Product Lead**: Owns FRD, prioritization, multi-game strategy, success metrics.
- **Lead Engineer**: Owns technical architecture, CLI core, integration standards.
- **Tooling Engineer**: Builds torrent workflow, CLI UX, seeding automation.
- **Protocol Engineer**: Maintains schema definitions, relay interoperability testing.
- **Lightning Engineer**: Ensures zap flows, LNURL/BOLT12 support, regtest environment.
- **Infrastructure Engineer**: Guides authors on seedboxes, publishes resilience playbooks.
- **Program Manager**: Tracks milestones, maintains backlog, coordinates cross-team checkpoints.
- **Community Lead**: Handles author/player relations, onboarding, governance processes.
- **UX Researcher**: Manages interviews, surveys, and user feedback synthesis.
- **Technical Writer**: Produces public-facing guides, release notes, and knowledge base.

## 5. Governance & Checkpoints
- **Bi-weekly architecture sync**: Validate new schema proposals, align implementation tasks with FRD.
- **Monthly community review**: Share progress with pilot authors/players, collect feedback, adjust backlog.
- **Security tabletop drills (quarterly)**: Simulate key compromise and incident response using `kind 30085`.
- **Governance council kickoff (Phase 3)**: Establish voting rules, proposal lifecycle, and schema ratification process.

## 6. Risk Register (Snapshot)
- **R1 – Swarm health degradation**: Mitigation—seedbox guide, community co-seeders, swarm monitoring scripts.
- **R2 – Key compromise**: Mitigation—document rotation process, prioritize delegated signing support.
- **R3 – Author adoption lag**: Mitigation—early flagship mod success story, strong documentation, community outreach.
- **R4 – Relay attrition**: Mitigation—metadata-only posture lowers burden; encourage multiple relays and local caching.
- **R5 – Lightning onboarding friction**: Mitigation—custodial onboarding path with clear migration guidance.

## 7. Work Tracking & Backlog
- Use `docs/backlog.md` for major follow-ups; maintain supporting tickets in issue tracker (GitHub/Jira) once development begins.
- Tag backlog items by phase (`[pre-MVP]`, `[post-MVP]`, `[future]`) to align with roadmap priorities in FRD Section 15.
- Update backlog after each milestone review; archive completed items for transparency.

## 8. Communication Plan
- **Docs repo** remains source of truth; every major decision captured in markdown before implementation.
- **Async updates**: Weekly status note summarizing progress, blockers, upcoming milestones.
- **Synchronous touchpoints**:
  - Standup-lite (2x/week) during active implementation phases.
  - Architecture review (bi-weekly).
  - Community town hall (monthly) once pilot begins.
- **Incident communications**: When security advisories occur, publish via `kind 30085` and mirror summary in docs/logbook.

## 9. Exit Criteria & Next Actions
- Complete Phase 0 documentation set (in progress).
- Secure agreement on Phase 1 scope and resource assignments.
- Create detailed implementation tickets derived from Milestone M1 deliverables.
- Prepare seeding playbook draft to unblock torrent-first PoC work.
