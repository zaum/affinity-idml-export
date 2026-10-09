'use strict';
const { Document } = require('/document');
const { StoryApi, GlyphAttsApi, GlyphAttDoubleType } = require('affinity:story');
const out = [];
for (const doc of Document.all) {
  const frames = [];
  for (const node of doc.layers.all) {
    if (!node.isArtTextNode && !node.isFrameTextNode) continue;
    try {
      const a = StoryApi.getGlyphAtts(node.story.handle, node.storyRange.begin);
      frames.push({height: GlyphAttsApi.getDoubleValue(a,GlyphAttDoubleType.Height),
        text:String(node.text||'').slice(0,40),box:node.getSpreadBaseBox(false)});
    } catch (e) { frames.push({error:String(e)}); }
    if (frames.length >= 5) break;
  }
  out.push({title:String(doc.title),dpi:doc.dpi,frames});
}
console.log(JSON.stringify(out));
