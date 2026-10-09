'use strict';
const {Document}=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
const out=[];for(const n of d.layers.all)if(n.isImageNode){
 const p=n.parent;let childTags=[],fill='',pen='',weight=0,visible=null;
 if(p){try{for(const c of p.children)childTags.push(c[Symbol.toStringTag])}catch(_){}
  try{fill=p.brushFillDescriptor.fill[Symbol.toStringTag]}catch(_){}
  try{pen=p.penFillDescriptor.fill[Symbol.toStringTag]}catch(_){}
  try{weight=p.lineWeightPts}catch(_){}
  try{visible=p.isVisibleInExport}catch(_){}
 }
 out.push({parent:p&&p[Symbol.toStringTag],childTags,fill,pen,weight,visible});
}console.log(JSON.stringify(out));
