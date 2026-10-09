'use strict';
const {Document}=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
function curves(n){
 const out=[];let poly=null;try{poly=n.polyCurve}catch(_){}
 if(!poly)return out;
 const m=n.baseToSpreadTransform.data;
 for(let i=0;i<poly.curveCount;i++){
  const c=poly.at(i),points=[];
  let p=c.firstOnCurvePointIndex;
  for(let k=0;k<30&&p<c.lastOnCurvePointIndex;k++){
   const s=c.getCubicBezier(p);
   for(const q of [s.start,s.c1,s.c2,s.end])points.push([m[0]*q.x+m[1]*q.y+m[2],m[3]*q.x+m[4]*q.y+m[5]]);
   const next=c.getNextOnCurvePointIndex(p,false);if(!(next>p))break;p=next;
  }
  const xs=points.map(x=>x[0]),ys=points.map(x=>x[1]);
  out.push({closed:c.isClosed,nodeCount:c.nodeCount,segments:points.length/4,
   extent:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],
   first:points.slice(0,8)});
 }
 return out;
}
const out=[];for(const n of d.layers.all)if(n.isImageNode){
 let p=n.parent;const parents=[];
 for(let j=0;p&&j<3;j++,p=p.parent)if(p.isShapeNode||p.isPolyCurveNode)parents.push({tag:p[Symbol.toStringTag],curves:curves(p)});
 out.push({image:curves(n),parents});
}
console.log(JSON.stringify(out));
