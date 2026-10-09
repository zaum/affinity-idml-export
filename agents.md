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
7. Build a general exporter. Every fix must follow an Affinity object type, readable property, or documented IDML limitation and apply consistently to every affected document and page. Never trigger behavior from a document title, filename, sample-specific object combination, or hard-coded measurements. Use named documents only as regression fixtures. Before accepting a fix, test the general rule with a contrasting fixture (for example, another DPI, a page without text, or a page without the unsupported feature), and record the rule and remaining limits in the roadmap.
8. After installing and verifying a new version in Affinity Script Manager, remove the installed version two releases earlier (for example, after verifying v1.17.0, remove installed v1.15.0). Keep the immediately previous installed version as a rollback. Verify the old library entry is gone. Keep historical source files and installed snapshots in Git unless the user explicitly asks to delete project history. If Script Manager is unavailable, record installation and cleanup as pending in the roadmap; never claim the library changed based only on local files.

## Project layout

- `finished scripts/` — versioned Affinity exporter scripts and historical notes.
- `tests/` — VM tests, host probes, fixtures, visual comparisons and installed snapshots.
- `tools/run_idml_export.cjs` — MCP bridge runner.
- `Export to IDML via MCP v*.cmd` — launchers.
- `IDML_EXPORT_ROADMAP.md` — authoritative feature and verification status.

Each export run must use one uniquely named folder on the Desktop. Keep its IDML, diagnostics JSON and page-preview PNGs together there, and show the complete paths in the result dialog. Update the roadmap when this output contract changes.

The Affinity Script Editor needs per-script **Access the file system** permission and Desktop folder access for direct export. The MCP bridge can be used for host probes when the script panel lacks permission; do not treat bridge success as proof that direct Script Editor execution has permission.
