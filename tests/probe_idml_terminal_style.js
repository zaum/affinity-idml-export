'use strict';
const {Document}=require('/document');
const {StoryApi,GlyphAttsApi,GlyphAttDoubleType}=require('affinity:story');
const source=Document.all.find(d=>d.title==='kisokos-toltheto-hallokeszulek');
if(!source)throw new Error('Source document is not open');
function inspect(doc){
 const out=[];
 for(const n of doc.layers.all)if(n.isFrameTextNode||n.isArtTextNode){
  const r=n.storyRange,s=n.story,items=[];
  for(let p=Math.max(r.begin,r.end-3);p<r.end;p++){
   let size=null,leading=null,br=false;
   try{const a=StoryApi.getGlyphAtts(s.handle,p);
    size=GlyphAttsApi.getDoubleValue(a,GlyphAttDoubleType.Height)*72/doc.dpi;
    leading=GlyphAttsApi.getDoubleValue(a,GlyphAttDoubleType.AbsoluteLeading)*72/doc.dpi;
    br=s.isParagraphBreak(p);
   }catch(e){items.push({p,error:e.message});continue;}
   items.push({p,size,leading,br});
  }
  out.push({range:[r.begin,r.end],items});
 }
 return out;
}
const imported=Document.load('C:/Users/peter/Desktop/kisokos-toltheto-hallokeszulek.idml');
try{console.log(JSON.stringify({after:inspect(imported)}));}
finally{imported.close();}
