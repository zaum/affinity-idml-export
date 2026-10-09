'use strict';
const {Document}=require('/document');
const source=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!source)throw new Error('Source document is not open');
const imported=Document.load('C:\\Users\\peter\\Desktop\\kisokos-toltheto-hallokeszulek 7.idml');
function scan(d){const out=[];for(const n of d.layers.all)if(n.isImageNode){
 const p=n.parent,box=n.getSpreadBaseBox(false);
 let parentBox=null,curve=null,cp=null;
 try{parentBox=p.getSpreadBaseBox(false)}catch(_){}
 try{cp=p.polyCurve;curve=cp.at(0);curve={closed:curve.isClosed,nodes:curve.nodeCount,
  first:curve.getCubicBezier(curve.firstOnCurvePointIndex)}}catch(_){}
 out.push({imageBox:box,parent:p&&p[Symbol.toStringTag],parentBox,curve});
}return out;}
try{console.log(JSON.stringify({source:scan(source),imported:scan(imported)}));}
finally{imported.close()}
