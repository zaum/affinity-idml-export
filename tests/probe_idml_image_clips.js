'use strict';
const {Document}=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
function desc(n){
  if(!n)return null;
  let name='',box=null,clipped=null,count=null;
  try{name=String(n.name||'')}catch(_){}
  try{box=n.getSpreadBaseBox(false)}catch(_){}
  try{clipped=n.getSpreadBaseBox(true)}catch(_){}
  try{count=n.polyCurve.curveCount}catch(_){}
  return {tag:n[Symbol.toStringTag],name,isImage:!!n.isImageNode,isShape:!!n.isShapeNode,
    isPoly:!!n.isPolyCurveNode,isGroup:!!n.isGroupNode,box,clipped,curves:count};
}
const result=[];
for(const n of d.layers.all)if(n.isImageNode){
 const parents=[];let p=n.parent;
 for(let i=0;p&&i<7;i++,p=p.parent)parents.push(desc(p));
 const children=[];try{for(const c of n.children)children.push(desc(c))}catch(_){}
 const enclosures=[];try{for(const c of n.enclosures)enclosures.push(desc(c))}catch(_){}
 result.push({image:desc(n),parents,children,enclosures,prev:desc(n.previousSibling),next:desc(n.nextSibling)});
}
console.log(JSON.stringify(result));
