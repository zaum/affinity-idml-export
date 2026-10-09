'use strict';
const { Document }=require('/document');
const d=Document.load('C:\\Users\\peter\\Desktop\\kisokos-toltheto-hallokeszulek 5.idml');
try{
 const counts={};
 for(const n of Array.from(d.layers.all)){
  if(!(n.isShapeNode||n.isPolyCurveNode||n.isVectorNode)||n.isImageNode)continue;
  let fill='';try{fill=n.penFillDescriptor.fill[Symbol.toStringTag]}catch(_){}
  if(fill==='NoFill')continue;
  const key=String(Math.round(Number(n.lineWeightPts)*1000)/1000);
  counts[key]=(counts[key]||0)+1;
 }
 console.log(JSON.stringify(counts));
}finally{d.close()}
