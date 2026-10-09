'use strict';
const {Document}=require('/document');
const {StoryApi,GlyphAttsApi,GlyphAttDoubleType,ParagraphAttsApi,ParagraphAttDoubleType}=require('affinity:story');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
const result={glyphKinds:Object.keys(GlyphAttDoubleType),paragraphKinds:Object.keys(ParagraphAttDoubleType),empty:[]};
for(const n of d.layers.all)if(n.isFrameTextNode||n.isArtTextNode){
 const s=n.story,r=n.storyRange;let previousBreak=false;
 for(let p=r.begin;p<r.end;p++){
  if(!s.isParagraphBreak(p))continue;
  const a=StoryApi.getGlyphAtts(s.handle,p),pa=StoryApi.getParagraphAtts(s.handle,p);
  const g={},q={};
  for(const [k,v] of Object.entries(GlyphAttDoubleType))if(/lead|height/i.test(k))try{g[k]=GlyphAttsApi.getDoubleValue(a,v)}catch(_){}
  for(const [k,v] of Object.entries(ParagraphAttDoubleType))if(/lead|height|space/i.test(k))try{q[k]=ParagraphAttsApi.getDoubleValue(pa,v)}catch(_){}
  result.empty.push({frame:n.name||'',position:p,previousBreak,leadingOverride:String(GlyphAttsApi.getLeadingOverrideType(a)),leadingType:String(ParagraphAttsApi.getLeadingType(pa)),g,q});
  previousBreak=true;
 }
}
console.log(JSON.stringify(result));
