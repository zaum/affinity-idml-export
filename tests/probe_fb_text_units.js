'use strict';
const { Document } = require('/document');
const { StoryApi, GlyphAttsApi, GlyphAttDoubleType } = require('affinity:story');
const { FontApi } = require('affinity:fonts');
const docs = Document.all.filter(doc => String(doc.title || '').indexOf('FB-tavasz-820x360') >= 0);
const result = [];
for (const doc of docs) {
    const frames = [];
    for (const node of doc.layers.all) {
        if (!node.isArtTextNode && !node.isFrameTextNode) continue;
        const atts = StoryApi.getGlyphAtts(node.story.handle, node.storyRange.begin);
        const font = GlyphAttsApi.getFont(atts);
        frames.push({ name: String(node.defaultDescriptionForDisplay || ''),
            height: GlyphAttsApi.getDoubleValue(atts, GlyphAttDoubleType.Height),
            family: String(FontApi.getFamilyName(font)), face: String(FontApi.getTraitsName(font)),
            postscript: String(FontApi.getPostscriptName(font)),
            box: node.getSpreadBaseBox(false),
            matrix: Array.from(node.baseToSpreadTransform.data) });
    }
    result.push({ title: String(doc.title || ''), dpi: doc.dpi, frames });
}
console.log(JSON.stringify(result));
