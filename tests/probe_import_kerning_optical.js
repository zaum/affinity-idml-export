'use strict';
const { Document } = require('/document');
const a = require('affinity:story');
const d = Document.load('C:\\Users\\peter\\Desktop\\kerning_optical.idml');
try {
  const n=Array.from(d.layers.all).find(x => (x.isFrameTextNode || x.isArtTextNode) && x.text);
  const s=n.story, p=n.storyRange.begin, h=a.StoryApi.getGlyphAtts(s.handle,p);
  const get=k=>a.GlyphAttsApi.getDoubleValue(h,a.GlyphAttDoubleType[k]);
  console.log(JSON.stringify({dpi:d.dpi,height:get('Height'),manual:get('ManualKerning'),auto:get('AutoKernMinHeight'),text:n.text.slice(0,20)}));
} finally { d.close(); }
