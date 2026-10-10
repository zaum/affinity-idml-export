/*
Script Name: Probe Inline Vector SVG
Description: Exports one text frame with pinned vectors as SVG for IDML API analysis.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(item => item.title === 'terra-gepszerelo-hirdetes');
if (!doc) throw new Error('Source document is not open.');
const frame = Array.from(doc.layers.all).find(node => {
    if (!(node.isFrameTextNode || node.isArtTextNode)) return false;
    const range = node.storyRange;
    for (let p = range.begin; p < range.end; p++)
        if (node.story.getGlyph(p).isPinGlyph) return true;
    return false;
});
if (!frame) throw new Error('No frame with pinned objects was found.');
console.log('FRAME ' + String(frame.text).slice(0, 50));
const folder = 'C:/Users/peter/Desktop/IDML Exports/terra-gepszerelo-hirdetes IDML export 2';
console.log('SVG PRESETS ' + JSON.stringify(FileExportOptions.allPresetNames.filter(name =>
    String(name).toLowerCase().includes('svg'))));
const before = doc.selection;
try {
    const selected = Selection.create(doc, [frame]);
    console.log('SELECTION ' + selected.length);
    doc.selection = selected;
    const records = doc.export(folder + '/inline-vectors-probe-3.svg',
        FileExportOptions.createWithPresetName('SVG (for export)'),
        FileExportArea.createForSelection(selected));
    for (const record of records.all) console.log(JSON.stringify({ success: record.isSuccess,
        path: record.path, error: record.errorMessage }));
    const pageRecords = doc.export(folder + '/inline-vectors-page.svg',
        FileExportOptions.createWithPresetName('SVG (for export)'),
        FileExportArea.createForPages('1'));
    for (const record of pageRecords.all) console.log(JSON.stringify({ pageSuccess: record.isSuccess,
        path: record.path, error: record.errorMessage }));
} finally { doc.selection = before; }
