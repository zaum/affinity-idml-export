'use strict';
const { Document }=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
let i=0;const out=[];
for(const spread of d.spreads) for(const n of spread.layers.all){
  if(n.isVisibleInExport===false||n.isGroupNode)continue;
  if(!(n.isShapeNode||n.isPolyCurveNode||(n.isVectorNode&&!n.isImageNode)))continue;
  i++;
  let p='?',f='?',line=null,vis=null,weight=null;
  try{p=n.penFillDescriptor.fill[Symbol.toStringTag]}catch(e){p='ERR:'+e.message}
  try{f=n.brushFillDescriptor.fill[Symbol.toStringTag]}catch(e){f='ERR:'+e.message}
  try{line=n.lineType.value}catch(_){}
  try{vis=n.isLineStyleVisible}catch(_){}
  try{weight=n.lineWeightPts}catch(_){}
  out.push({i,p,f,line,vis,weight});
}
console.log(JSON.stringify(out));
