# OpenMods Backlog

- **Stakeholder validation (post-PoC)**: Once the MVP is in testers' hands, run the deferred validation plan from `docs/openmods-frd.md:203` to confirm lifecycle assumptions and feed real feedback into the roadmap.
- **Security hardening**: Implement key rotation tooling, security incident events (`kind 30085`), and supply chain protections outlined in `docs/openmods-frd.md:68`.
- **Legal framework build-out**: Draft DMCA/takedown templates, license matrix, and relay policy disclosure process from `docs/openmods-frd.md:100`.
- **Data redundancy automation**: Provide scripts or services to verify three-way storage replication per release as described in `docs/openmods-frd.md:128`.
- **Governance bootstrapping**: Convene the standards council, define proposal workflow, and publish governance events per `docs/openmods-frd.md:157`.
- **Multi-game extensibility**: Implement namespacing, CLI configuration, and schema hooks to unlock additional game support without refactor per `docs/openmods-frd.md:204`.
- **UX blueprint & prototyping**: Develop detailed author/player flows, accessibility requirements, and CLI UX mockups prior to Phase 1 build; capture findings in a dedicated UX design doc that complements `docs/project-management-plan.md:45`.
- **Torrent build pipeline [done]**: Embedded `.torrent` generation and tracker configuration into `openmods release build`; follow-up documentation noted in `docs/seeding-playbook.md`.
- **Relay publishing integration [phase1-ready]**: Wire CLI `project publish`/`release publish` commands into nostr relay clients (NDK) with retry/backoff, capturing results for test/dry-run flows. *(Task breakdown in `docs/phase1-ready-work.md`.)*
- **Delegated signing support**: Extend config key rotation to handle NIP-46 delegated signers and hardware wallet flows; document handshake + storage.
- **Zap regtest integration [phase1-ready]**: Wire `openmods zap simulate` into the Lightning regtest stack (docs/dev-environment.md) and capture resulting events/logs for validation. *(Tasks outlined in `docs/phase1-ready-work.md`.)*
- **Seed telemetry**: Expand `openmods seed status` to query UDP trackers and local clients, publishing optional nostr health events.
