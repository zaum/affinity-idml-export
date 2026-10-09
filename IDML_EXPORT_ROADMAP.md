# Affinity to IDML Export Roadmap

Updated: 2026-10-09. Project root: `I:\Affinity\scripts\idml export script`. Current exporter: `finished scripts/Export to IDML v1.14.0.js`. Shared Affinity API references remain in `I:\Affinity\scripts\workspace\docs`.

## Status key

- 🟢 Implemented in code; real document accuracy still needs verification.
- 🟡 Partially implemented or implemented through an approximation.
- 🔴 Not implemented.
- 🔍 Requires an Affinity API probe.

These icons describe implementation progress. They do not certify visual or typographic equivalence in InDesign.

## Document and pages

| Feature | Status | Remaining work |
|---|---|---|
| Multiple pages, page dimensions, orientation, document DPI | 🟢 | Verify mixed page sizes and exact point values. |
| Measurement units | 🟢 | Complete the Affinity enum to IDML mapping. |
| Bleed | 🟢 | Test asymmetric and page-specific values. |
| Document RGB/CMYK profile name | 🟡 | Compare the profile in InDesign; the name is not embedded ICC data. |
| Margins and columns | 🟡 | Margins are inferred from text frame positions and applied equally on four sides. Read native page settings. |
| Facing-page spreads | 🔴 | The exporter currently stops when a spread contains more than one page. |
| Master pages, sections, page numbering | 🔴 | Probe the Affinity API, then add an IDML model. |

## Text and typography

| Feature | Status | Remaining work |
|---|---|---|
| Editable text frames, Unicode and paragraph boundaries | 🟢 | Check empty paragraphs and end-of-story formatting visually. |
| Font family, face, PostScript name and size | 🟢 | Test missing and variable fonts. Font files are not packaged. |
| Tracking, automatic and manual kerning, scaling, skew, baseline shift | 🟡 | Compare zero, Auto and manual values through a round trip. |
| Paragraph spacing, indents, leading and auto leading | 🟡 | Fixed paragraph leading is now written on character ranges, including empty paragraph markers. Compare its layout in InDesign and check glyph overrides. |
| Hyphenation, alignment, word and letter spacing, keep options | 🟡 | Verify the full value range for each mapped property. |
| Named paragraph and character styles, inheritance and overrides | 🔴 | Only local formatting and IDML default styles are written today. |
| Linked text frames and story threading | 🔴 | Each frame currently becomes an independent story. |
| Tabs, lists, numbering, drop caps and paragraph rules | 🔴 | Probe source API and map supported properties. |
| Language, OpenType options, writing direction, vertical text | 🔴 | Probe source API and matching IDML values. |
| Inline objects, footnotes and tables | 🔴 | Probe the API; document any necessary fallback. |

## Layers, vectors and effects

| Feature | Status | Remaining work |
|---|---|---|
| Object position and size | 🟢 | Check rotation, shear, nonuniform scale and off-page objects. |
| Visibility | 🟡 | Source layer visibility and object visibility are written separately. Hidden groups are still flattened. |
| Groups, layer names and hierarchy, locks and print state | 🟡 | ContainerNode names become flat IDML layers; nested names become a joined path, and source locks are copied when readable. Group nodes are flattened. Identically named paths may merge. |
| Object stacking order | 🟡 | Text, vectors and images now follow source traversal order in spread XML. Compare visual stacking in InDesign. |
| Vector paths and closed shapes | 🟡 | Check holes, compound paths, open lines and transforms. |
| Stroke weight, fill and stroke colour | 🟡 | Check alignment, caps, joins, dashes and arrowheads. |
| Colour gradients | 🟡 | Check stops, colour spaces, transforms and gradient strokes. |
| Opacity, blend modes and layer effects | 🟡 | Linear image transparency is baked into PNG alpha; general object effects are missing. |

## Images and resources

| Feature | Status | Remaining work |
|---|---|---|
| Embedded raster image, placement and size | 🟢 | Compare pixel dimensions, PPI and colour appearance. The source is re-encoded as PNG. |
| Image clipping path | 🟡 | Closed shape/polycurve ancestors work across intervening groups. An image parent uses its rectangular bounds; its pixel alpha is not transferred as a clip mask. Test compound, transformed and real nested clips. |
| Per-image ICC profile | 🟡 | The resource exposes a profile name, but non-sRGB ICC bytes are not embedded. |
| Image gradient transparency | 🟡 | Only a local linear gradient is supported; it is baked into alpha. |
| Original image format, link and source path | 🔴 | The API exposes metadata; implement a safe packaging and link policy. |
| Embedded documents, PDF/SVG and rasterized effects | 🔴 | Decide per object whether editable IDML or a declared image fallback is possible. |

## Diagnostics and verification

1. 🟢 **Object inventory v1:** each `.diagnostics.json` report lists objects by page, type, description, parent, visibility, opacity, bounds, export status, IDML ID and reasons for omissions or approximations. Containers are counted separately.
2. 🟢 **Property audit v1:** `propertyAudit` covers document, page and object properties with source examples, target IDML field, status and explanation. `summary.byProperty` aggregates results. Statuses are `exported`, `approximated`, `notMapped`, `unavailable`, `unknown` and `notProbed`. A `notMapped` property is not serialized; the InDesign default may still match its source value. Further Affinity API coverage is 🟡 pending.
3. 🟡 **Round-trip tests:** small property-specific probes exist; full attribute and image comparisons remain open.
4. 🔴 **Real project document:** a page-by-page difference report for `kisokos-toltheto...` remains open.

## Output and current verification

- 🟡 v1.17.0 addresses Script Panel startup freezes: document objects are scanned in timer-driven slices, page previews yield between pages, and direct JavaScript image encoding has an 8-megapixel document-wide budget. Images beyond that budget trigger the page raster fallback and are not separately editable in IDML. The synchronous MCP path remains available in code. Syntax and VM tests cover the scheduled launch. Script Manager installation and a read-only listing timed out through the Affinity MCP endpoint. The user confirmed all documents were saved and authorized an Affinity restart; after relaunch the local MCP port listened again but Script Manager calls still timed out. Installed version, real Script Panel responsiveness and the result dialog after a timer callback remain unverified.
- 🟡 v1.16.0 removes the FB-tavasz content-mix trigger and fallback-only text scaling. Typography is read as point-valued host data on every document; page geometry alone uses 72/DPI. Artistic text frames receive composition room on every document. Raster fallback is selected per page by vector-gradient presence, including pages without text, while unaffected pages retain their editable artwork. Syntax and VM tests passed. A separate 144-DPI host document exposed glyph heights of 92 and 40 point-like units, independently supporting the unit correction; visual round-trip verification remains open.
- 🟡 A separate PSD exported successfully but Affinity could not reopen its IDML from a decomposed-Unicode folder name. The same package imported successfully from an ASCII path. v1.16.0 folds export folder/file names to ASCII; its live round-trip check is pending. The larger `terra-jcb-fb-caroussel` document exceeded the MCP request timeout during a full export.
- 🟢 v1.16.0 was saved to Affinity Script Manager. The read-back source in `tests/installed_idml_v1.16.0.js` matches the release source SHA-256 hash.
- 🟢 v1.15.0 creates a unique Desktop folder for each run. The IDML file, diagnostics JSON and retained page-preview PNGs are written into that folder. The report records their full paths.
- 🟡 FB-tavasz-820x360.ai exposed a severe visual mismatch hidden by the formerly visible full-page proof: gradients became a large solid polygon, and editable text was too small and overset. v1.15.0 hides the full-page proof and, for pages with text, images and gradient vectors, places an artwork-only PNG behind corrected editable text. Original vectors and images remain on a hidden layer. The artwork PNG from the v1.15.0 host export is pixel-identical to the independently verified diagnostic artwork render. The final v1.15.0 IDML was imported and rendered in Affinity: the artwork matches visually, while text position and glyph shape still differ slightly from the source preview. InDesign rendering remains unverified.
- 🟡 Hybrid text metrics use the source document DPI divided by 72 for point size, leading and baseline shift, and enlarge artistic text frames to prevent overset. Verify against other documents and InDesign before generalizing this fallback.
- 🟢 Syntax and VM tests passed, including nested layer paths, source order, group-separated vector clips and image-parent bounds. An Affinity-host export/import passed on `FB-tavasz-820x360.ai` with one image, five text frames and nested groups.
- 🟢 v1.14.0 was installed in Affinity Script Manager; its installed copy in `tests/installed_idml_v1.14.0.js` matches the source SHA-256 hash.
- 🟢 v1.15.0 passed syntax and VM checks and a real Affinity export/import/render on FB-tavasz-820x360.ai. Script Manager saved the script to its library; the read-back copy in `tests/installed_idml_v1.15.0.js` matches the source SHA-256 hash. The imported render is in the export folder.
- 🟡 No real image-inside-image or image-inside-vector fixture was available in the open host documents. The nested clip behavior is verified in the VM only. Visual stacking and InDesign fidelity remain unverified.
- 🟡 Direct Script Editor permission and the result dialog have not been retested in the real host for v1.14.0.
- 🔴 Moving the **Open IDML** action into the native OK button row and closing the modal when it is clicked is unresolved. The documented `DialogApi` has no programmatic close method; use a host-verified interaction pattern before marking this done.
- 🟢 The public project repository is `https://github.com/zaum/affinity-idml-export`. Local Affinity documents, generated IDML files and comparison screenshots are excluded from Git.

## Next implementation order

1. Resolve the result dialog action with a supported, host-tested layout and close behaviour.
2. Preserve named text styles, then verify fixed leading, kerning and terminal paragraph formatting in InDesign.
3. Read real page margins and handle facing-page spreads.
4. Preserve image ICC data and improve clipping/transparency mapping.
5. Rebuild group hierarchy, resolve duplicate layer paths, preserve image alpha masks, vector stroke properties and effects.
6. Add less common structures only after confirming their Affinity API access.

## Completion rule for each feature

- Implement feature handling as a document-independent rule derived from source properties or a documented IDML limitation; sample documents are regression fixtures, never behavior switches. Verify the rule against a contrasting fixture.
- Verify that the real Affinity host exposes the source property.
- Verify the generated IDML property through InDesign or a stated fallback, and record any loss.
- Keep a small reproducible regression fixture and inspect the affected real project page visually.
- Update this roadmap. Install the versioned script through Script Manager and compare the installed code hash with the source.

## Project files

- Exporter: `finished scripts/Export to IDML v1.17.0.js`
- Runner: `tools/run_idml_export.cjs`
- Tests and probes: `tests/idml_export.cjs`, `tests/probe_idml_*.js`
- Shared API references: `I:\Affinity\scripts\workspace\docs`
