'use strict';
const {Document}=require('/document');
const {StoryApi,GlyphAttsApi,GlyphAttDoubleType}=require('affinity:story');
const out=[];
for(const variant of ['empty-run']){
 const d=Document.load('C:/Users/peter/Desktop/idml-terminal-'+variant+'.idml');
 try{
  for(const n of d.layers.all)if(n.isFrameTextNode||n.isArtTextNode){
   const r=n.storyRange,s=n.story,items=[];
   for(let p=Math.max(r.begin,r.end-3);p<r.end;p++){
    const a=StoryApi.getGlyphAtts(s.handle,p);
    items.push({p,size:GlyphAttsApi.getDoubleValue(a,GlyphAttDoubleType.Height)*72/d.dpi,
      br:s.isParagraphBreak(p)});
   }
   out.push({variant,range:[r.begin,r.end],items});
  }
 }finally{d.close();}
}
console.log(JSON.stringify(out));
