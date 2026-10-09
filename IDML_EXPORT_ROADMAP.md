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

- 🟢 v1.14.0 creates a unique Desktop folder for each run. The IDML file, diagnostics JSON and retained page-preview PNGs are written into that folder. The report records their full paths.
- 🟢 Syntax and VM tests passed, including nested layer paths, source order, group-separated vector clips and image-parent bounds. An Affinity-host export/import passed on `FB-tavasz-820x360.ai` with one image, five text frames and nested groups.
- 🟢 v1.14.0 is installed in Affinity Script Manager. The installed copy in `tests/installed_idml_v1.14.0.js` matches the source SHA-256 hash.
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

- Verify that the real Affinity host exposes the source property.
- Verify the generated IDML property through InDesign or a stated fallback, and record any loss.
- Keep a small reproducible regression fixture and inspect the affected real project page visually.
- Update this roadmap. Install the versioned script through Script Manager and compare the installed code hash with the source.

## Project files

- Exporter: `finished scripts/Export to IDML v1.14.0.js`
- Runner: `tools/run_idml_export.cjs`
- Tests and probes: `tests/idml_export.cjs`, `tests/probe_idml_*.js`
- Shared API references: `I:\Affinity\scripts\workspace\docs`
