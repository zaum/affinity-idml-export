# Agents Guide — IDML export project

Project root: `I:\Affinity\scripts\idml export script`.

The parent `I:\Affinity\scripts\agents.md` also applies. Shared Affinity API documentation stays at `I:\Affinity\scripts\workspace\docs`.

## Required workflow

1. Keep all IDML-export scripts, runners, fixtures, probes, reports and project documentation under this project root. Work here for all subsequent IDML-export changes.
2. **Update `IDML_EXPORT_ROADMAP.md` in English every time the exporter, tests, host findings, or known limitations change.** Record the actual state with the existing 🟢/🟡/🔴/🔍 icons; do not mark a feature complete solely because code exists. Note what was and was not verified in the real Affinity host and InDesign.
3. Bump the script's `Version:` and `version:` metadata and use a new versioned filename for every script change. Keep the contribution header and source links at the top. All text inside the script, including comments and user-facing messages, must be in English.
4. Update `tools/run_idml_export.cjs` and `tests/idml_export.cjs` to target the newest script. Run `node --check` and the VM test. Use a small live Affinity document for a host probe when possible.
5. Reinstall the new version through Affinity Script Manager. Confirm that Script Manager lists it, save the installed copy into `tests`, and compare its SHA-256 hash with the source. A local file alone is not an installed script.
6. Never force-restart Affinity. Its Script Manager rereads scripts on the next run. Preserve the open document and report any real-host API behavior that remains unverified.

## Project layout

- `finished scripts/` — versioned Affinity exporter scripts and historical notes.
- `tests/` — VM tests, host probes, fixtures, visual comparisons and installed snapshots.
- `tools/run_idml_export.cjs` — MCP bridge runner.
- `Export to IDML via MCP v*.cmd` — launchers.
- `IDML_EXPORT_ROADMAP.md` — authoritative feature and verification status.

Each export run must use one uniquely named folder on the Desktop. Keep its IDML, diagnostics JSON and page-preview PNGs together there, and show the complete paths in the result dialog. Update the roadmap when this output contract changes.

The Affinity Script Editor needs per-script **Access the file system** permission and Desktop folder access for direct export. The MCP bridge can be used for host probes when the script panel lacks permission; do not treat bridge success as proof that direct Script Editor execution has permission.
