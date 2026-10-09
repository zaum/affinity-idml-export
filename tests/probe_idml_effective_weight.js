'use strict';
const { Document }=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
let i=0;const out=[];
for(const spread of d.spreads) for(const n of spread.layers.all){
 if(n.isVisibleInExport===false||n.isGroupNode)continue;
 if(!(n.isShapeNode||n.isPolyCurveNode||(n.isVectorNode&&!n.isImageNode)))continue;
 i++;
 let fill='';try{fill=n.penFillDescriptor.fill[Symbol.toStringTag]}catch(_){}
 if(fill==='NoFill')continue;
 const ld=n.lineStyleDescriptor;
 let effective=null,withTransform=null,error='';try{effective=ld.effectiveWeight()}catch(e){error=e.message}
 try{withTransform=ld.effectiveWeight(n.baseToSpreadTransform)}catch(e){error+=' | '+e.message}
 out.push({i,fill,weight:n.lineWeightPts,isScale:ld.isScale,effective,withTransform,error});
}
console.log(JSON.stringify(out));
