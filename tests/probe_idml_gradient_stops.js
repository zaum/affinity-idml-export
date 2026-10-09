'use strict';
const {Document}=require('/document');
const {Colour}=require('/colours');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
const out=[];for(const n of d.layers.all)if(n.isImageNode){
 const desc=n.transparencyFillDescriptor,fill=desc.fill;
 if(fill[Symbol.toStringTag]!=='GradientFill')continue;
 const stops=[];for(const s of fill.gradient.stops){
  const c=new Colour(s.colour);
  let rgba=null,raw=null;
  try{rgba=c.getRGBA8(false)}catch(e){rgba={error:e.message}}
  try{raw=c.getRGBAuf(false)}catch(e){raw={error:e.message}}
  stops.push({position:s.position,midpoint:s.midpoint,rgba,raw});
 }
 out.push({transform:Array.from(desc.transform.data),domain:Array.from(n.transparencyInterface.domainTransform.data),stops});
}console.log(JSON.stringify(out));
