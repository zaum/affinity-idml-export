# Affinity to IDML exporter

An experimental Affinity script that exports a multi-page document to an IDML package with editable text, vector shapes and embedded raster images. Every run creates a uniquely named folder inside `Desktop/IDML Exports` containing the IDML file, a property-audit JSON report and page-preview PNGs.

The exporter is being developed against the Affinity 3.3 scripting API. It does not implement the full IDML format. See [the roadmap](IDML_EXPORT_ROADMAP.md) for feature status, known data loss and verification results.

## Run from Affinity

Install the newest file in [`finished scripts`](finished%20scripts) through Affinity Script Manager, then run it with the source document open. In that script's Script Editor settings, enable **Access the file system**. Also allow the Desktop folder under **Edit → Settings → Scripting → File System access**.

The script first opens a compact dialog, about half the previous width. Click **Start** to begin the export. The Start and **Open IDML in Affinity** buttons span the dialog content width; Affinity's scripting API does not expose placement in the native OK/Cancel footer row. The result shows the IDML path, output folder and a short content summary. The detailed diagnostics remain in the generated JSON sidecar and are not shown or linked in the dialog. Embedded Affinity artwork is rendered into its own transparent PNG, and raster nodes use Affinity's selection export to capture their own transparent PNG; each image stays at its source position in the object stack. Nested editability and original resource links are not retained. The exact modal appearance and direct Script Editor file access still need a UI check.

The Open IDML button currently sits inside the result content and does not dismiss the modal dialog. A native OK-row action with close-on-click remains open because the documented Affinity dialog API exposes no programmatic close operation.

## Run through the MCP bridge

From this project folder, with Affinity and its MCP bridge running:

```powershell
node tools/run_idml_export.cjs --check-import
```

The versioned `Export to IDML via MCP` launchers call the same runner. Bridge access does not grant file-system permission to the script when run directly from the Scripts panel.

## Test

```powershell
node --check "finished scripts/Export to IDML v1.31.0.js"
node tests/idml_export.cjs
```

The VM test covers IDML packaging, XML, text formatting, diagnostics and unique output folders. Host probes and sample fixtures are in `tests/`. A successful Affinity import does not establish InDesign layout fidelity.

## Project layout

- `finished scripts/` — versioned exporter sources and historical notes.
- `tests/` — regression harness, probes, fixtures and visual comparisons.
- `tools/` — MCP bridge runner.
- `IDML_EXPORT_ROADMAP.md` — English feature and verification status.
- `agents.md` — project workflow rules; the roadmap must be updated with every exporter, test or host-finding change.

The current exporter is **v1.31.0**. It retains the compact v1.30.0 dialog and uses Affinity's native Base64 conversion for embedded image data, with a portable fallback. This replaces a JavaScript character-by-character encoder in the large image path. A live-host benchmark on a 16 MiB buffer measured 59 ms with the host conversion versus 1,199 ms with the portable encoder (about 20× faster for Base64 conversion; outputs were identical). The open `electromax.afpub` contains a 7,100 × 4,734 px placed image; full-export timing and output fidelity for v1.31.0 still need a live export check. Script Manager lists v1.31.0 and its readback matches `tests/installed_idml_v1.31.0.js` and the source after line-ending normalization (SHA-256 `0739c823670e5d4dd5b82b0b804d53dd8792e194f320b2cefba54f5237e5a567`). v1.30.0 remains the rollback. InDesign layout remains unverified. **Do not run v1.17.0 or v1.18.0:** both were reported to freeze or close Affinity at launch, including on a one-circle document.

Local Affinity documents, generated IDML packages and comparison screenshots are kept out of the public repository.
