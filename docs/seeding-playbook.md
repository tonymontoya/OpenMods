# OpenMods Seeding Playbook (PoC Draft)

## 1. Purpose
This playbook captures the minimum viable workflow for authors (and volunteer seeders) to keep PoC torrents for the flagship Skyrim SE mod available at all times. It complements `docs/technical-architecture.md` Section 3.3 and is referenced by Milestone M1 in the implementation plan.

## 2. Prerequisites
- Linux, macOS, or Windows host with stable broadband (≥5 Mbps up).
- Installed torrent client capable of headless seeding (Transmission, qBittorrent-nox, rtorrent).
- Persistent storage with at least 2× the release size for working copy + backup.
- OpenMods CLI (Phase 1 build) with `openmods release build` output directory containing `.torrent` and archive assets.

## 3. Author Workflow
1. **Build artifacts**: Run `openmods release build --artifact <path> --generate-torrents` to emit deterministic archives *and* `.torrent` metadata. The CLI writes torrents to the directory configured in `openmods.json` (`release.torrentsDir` by default) and logs each info hash so you can reference it in change notes.
2. **Verify hashes**: Confirm the SHA-256 in the manifest matches the local archive using `shasum -a 256 <file>`.
3. **Seedbox prep**: Copy the release directory to the seed host. Maintain a `/srv/openmods/skyrim-se/<slug>/<version>/` layout to match CLI defaults.
4. **Client configuration**:
   - Disable DHT only if local policy requires it; otherwise leave enabled for resilience.
   - Supply at least two trackers when generating torrents (mix UDP + HTTPS). Use the CLI flags `--tracker <url>` (multiple times) and `--torrent-comment "<note>"` to embed provenance. Appendix A lists the baseline public/PoC trackers; authors may add additional private trackers for controlled distribution.
   - Set upload slots ≥4 and throttle only if link saturation impacts other services.
5. **Start seeding**: Load the `.torrent` file, point the client at the verified archive path, and force a re-check before seeding.
6. **Health monitoring**: Enable periodic stats export (Transmission RPC, qBittorrent web API). The CLI command `openmods seed status <torrent>` parses `.torrent` or magnet metadata, surfaces tracker hints, and can query Transmission (`--transmission-url http://localhost:9091/...`) or qBittorrent (`--qbittorrent-url http://localhost:8080`) for live peer counts.
7. **Update procedure**: When publishing a new release, keep seeding the previous version for at least 7 days to cover staggered client updates. Mark superseded torrents using the CLI once the new swarm is healthy.

## 4. Community Co-Seeders
- Subscribe to the author’s release relay list to receive torrent URIs immediately.
- Use the same directory structure to simplify future automation (`/srv/openmods/<gameId>/<slug>/<version>/`).
- Optionally enable automatic import by watching the release directory with a script that adds new `.torrent` files to the client.
- Publish voluntary availability notes via `kind 30086` policy events if operating a public seedbox.

## 5. Security & Sovereignty Considerations
- Keep seed hosts patched and restricted to required services (SSH, torrent ports). Use key-based SSH auth only.
- Store release archives on encrypted disks when possible to honor mod author licensing terms.
- Do not rely on centralized trackers; ensure at least one trackerless peer discovery mechanism (DHT/PEX) stays enabled.
- Never distribute modified binaries; reseed only the exact files covered by the published hashes.

## 6. Incident Response
- If a security advisory (`kind 30085`) flags a compromised release:
  1. Stop seeding the affected torrent immediately.
  2. Remove the archive and regenerate from trusted source if a fixed version is issued.
  3. Publish an acknowledgment (optional `kind 1` note) pointing to the advisory.
- Maintain a local log of seeded versions to accelerate post-mortem analysis.

## 7. Next Steps
- Integrate CLI automation for seedbox provisioning (tracked in `docs/backlog.md`).
- Document tracker recommendations and port-forwarding guidance per ISP. *(In progress: authors should publish at least one UDP + one HTTPS tracker via `--tracker` flags, ensure TCP/UDP port-forwarding is enabled on seed hosts, and avoid embedding tracker URLs that require authentication unless coordinating with trusted co-seeders.)*
- Capture real-world metrics during the PoC to refine bandwidth and uptime targets.

---

**Appendix A – Initial Tracker List (Draft)**
- `udp://tracker.opentrackr.org:1337/announce`
- `udp://tracker.openmods.dev:6969/announce` *(community-operated, PoC scope)*

Keep the list lightweight; authors may add private trackers via release metadata tags when necessary.
