'use strict';
const { Document } = require('/document');
const a = require('affinity:story');
const d = Document.all.find(x => x.title === 'kisokos-toltheto-hallokeszulek');
if (!d) throw new Error('Source document is not open');
const result = {};
for (const n of Array.from(d.layers.all).filter(x => x.isFrameTextNode || x.isArtTextNode)) {
  const s=n.story, r=n.storyRange;
  if (!s || !r) continue;
  for (let p=r.begin;p<r.end;p++) {
    if (s.isParagraphBreak(p)) continue;
    const h=a.StoryApi.getGlyphAtts(s.handle,p);
    const manual=a.GlyphAttsApi.getDoubleValue(h,a.GlyphAttDoubleType.ManualKerning);
    const auto=a.GlyphAttsApi.getDoubleValue(h,a.GlyphAttDoubleType.AutoKernMinHeight);
    const key=String(manual)+'/'+String(auto);
    result[key]=(result[key]||0)+1;
  }
}
console.log(JSON.stringify({dpi:d.dpi,kerningPairs:result}));
