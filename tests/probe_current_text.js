/*
Script Name: Probe Current Text
Description: Reports open Affinity documents and text glyph properties for IDML export diagnosis.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document } = require('/document');
const { StoryApi, GlyphAttsApi, GlyphAttDoubleType } = require('affinity:story');
const { FontApi } = require('affinity:fonts');
for (const doc of Document.all) {
    console.log('DOC ' + doc.title + ' current=' + (doc === Document.current));
    let index = 0;
    for (const node of doc.layers.all) {
        if (!(node.isFrameTextNode || node.isArtTextNode)) continue;
        const box = node.getSpreadBaseBox(false);
        function readBox(method) {
            try { const b = node[method](); return b && [b.x, b.y, b.width, b.height]; }
            catch (e) { return 'ERROR ' + e.message; }
        }
        const range = node.storyRange;
        const story = node.story;
        const glyphs = [];
        for (let p = range.begin; p < Math.min(range.end, range.begin + 250); p++) {
            const glyph = story.getGlyph(p);
            if (!glyph || !glyph.isCharGlyph) glyphs.push({ position: p,
                type: glyph && glyph[Symbol.toStringTag], pin: glyph && glyph.isPinGlyph });
        }
        const faces = [];
        for (let p = range.begin; p < Math.min(range.end, range.begin + 250); p++) {
            if (story.isParagraphBreak(p)) continue;
            try {
                const atts = StoryApi.getGlyphAtts(story.handle, p);
                const font = GlyphAttsApi.getFont(atts);
                const name = FontApi.getFamilyName(font) + ' | ' + FontApi.getTraitsName(font) +
                    ' | ' + FontApi.getPostscriptName(font);
                if (!faces.includes(name)) faces.push(name);
            } catch (e) { faces.push('ERROR ' + e.message); break; }
        }
        console.log('TEXT ' + JSON.stringify({ index: ++index,
            name: node.userDescription || node.defaultDescriptionForDisplay,
            box: [box.x, box.y, box.width, box.height],
            visibleBox: readBox('getSpreadVisibleBox'),
            contentBox: readBox('getContentExtentsBox'),
            exactVisibleBox: readBox('getExactSpreadVisibleBox'),
            text: String(node.text || '').slice(0, 250),
            faces, glyphs }));
    }
}
