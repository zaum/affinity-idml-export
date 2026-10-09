# Affinity to IDML exporter

An experimental Affinity script that exports a multi-page document to an IDML package with editable text, vector shapes and embedded raster images. Every run creates a uniquely named folder on the Desktop containing the IDML file, a property-audit JSON report and page-preview PNGs.

The exporter is being developed against the Affinity 3.3 scripting API. It does not implement the full IDML format. See [the roadmap](IDML_EXPORT_ROADMAP.md) for feature status, known data loss and verification results.

## Run from Affinity

Install the newest file in [`finished scripts`](finished%20scripts) through Affinity Script Manager, then run it with the source document open. In that script's Script Editor settings, enable **Access the file system**. Also allow the Desktop folder under **Edit → Settings → Scripting → File System access**.

The script starts exporting immediately and shows the full output paths when it finishes. The result dialog includes an **Open IDML in Affinity** button. The direct Script Editor permission and dialog interaction still require a real-host check for the current version.

## Run through the MCP bridge

From this project folder, with Affinity and its MCP bridge running:

```powershell
node tools/run_idml_export.cjs --check-import
```

The versioned `Export to IDML via MCP` launchers call the same runner. Bridge access does not grant file-system permission to the script when run directly from the Scripts panel.

## Test

```powershell
node --check "finished scripts/Export to IDML v1.13.0.js"
node tests/idml_export.cjs
```

The VM test covers IDML packaging, XML, text formatting, diagnostics and unique output folders. Host probes and sample fixtures are in `tests/`. A successful Affinity import does not establish InDesign layout fidelity.

## Project layout

- `finished scripts/` — versioned exporter sources and historical notes.
- `tests/` — regression harness, probes, fixtures and visual comparisons.
- `tools/` — MCP bridge runner.
- `IDML_EXPORT_ROADMAP.md` — English feature and verification status.
- `agents.md` — project workflow rules; the roadmap must be updated with every exporter, test or host-finding change.

The newest exporter is **v1.13.0**. It writes fixed paragraph leading to IDML character ranges, including empty paragraph markers. Named text styles, threaded text frames, facing-page spreads and full colour-profile preservation remain open work.

Local Affinity documents, generated IDML packages and comparison screenshots are kept out of the public repository.
