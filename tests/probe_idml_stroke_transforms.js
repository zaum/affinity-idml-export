'use strict';
const { Document }=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
let i=0;const out=[];
for(const spread of d.spreads) for(const n of spread.layers.all){
 if(n.isVisibleInExport===false||n.isGroupNode)continue;
 if(!(n.isShapeNode||n.isPolyCurveNode||(n.isVectorNode&&!n.isImageNode)))continue;
 i++;
 let visible=false;try{visible=n.penFillDescriptor.fill[Symbol.toStringTag]!=='NoFill'}catch(_){}
 if(!visible)continue;
 const m=Array.from(n.baseToSpreadTransform.data), sx=Math.hypot(m[0],m[3]),sy=Math.hypot(m[1],m[4]);
 out.push({i,weight:n.lineWeightPts,sx,sy,m});
}
console.log(JSON.stringify(out));
