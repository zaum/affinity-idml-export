/*
Script Name: Probe Imported Faces
Description: Reports fonts and frame bounds after reopening an exported IDML.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document } = require('/document');
const { StoryApi, GlyphAttsApi } = require('affinity:story');
const { FontApi } = require('affinity:fonts');
const imported = Document.load(globalThis.__PROBE_FILE_PATH__);
try {
    for (const node of imported.layers.all) {
        if (!(node.isFrameTextNode || node.isArtTextNode)) continue;
        const range = node.storyRange;
        const story = node.story;
        const faces = [];
        for (let p = range.begin; p < range.end; p++) {
            if (story.isParagraphBreak(p)) continue;
            const atts = StoryApi.getGlyphAtts(story.handle, p);
            const font = GlyphAttsApi.getFont(atts);
            const face = FontApi.getTraitsName(font) + ' | ' + FontApi.getPostscriptName(font);
            if (!faces.includes(face)) faces.push(face);
        }
        const b = node.getSpreadBaseBox(false);
        const v = node.getSpreadVisibleBox();
        const exact = node.getExactSpreadVisibleBox(true, false);
        console.log('IMPORTED ' + JSON.stringify({ text: String(node.text || '').slice(0, 70),
            faces, box: [b.x, b.y, b.width, b.height],
            visibleRight: v.x + v.width, exactTop: exact.y,
            exactRight: exact.x + exact.width,
            frameRight: b.x + b.width }));
    }
} finally { imported.close(); }
