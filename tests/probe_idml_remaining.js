'use strict';
const {Document}=require('/document');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
const out={unit:String(d.units),images:[],hidden:[],gradients:[]};
for(const n of d.layers.all){
 let visible=true;try{visible=n.isVisibleInExport}catch(_){}
 if(!visible)out.hidden.push({kind:n[Symbol.toStringTag],name:n.name||'',parent:n.parent&&n.parent.name||''});
 if(n.isImageNode){let p=null;try{p=n.imageResourceInterface.iccProfile}catch(e){p={error:e.message}}
 out.images.push({name:n.name||'',profile:p&&p.name||String(p),format:String(n.rasterFormat),visible});}
 if(n.isShapeNode||n.isPolyCurveNode){let f=null;try{f=n.brushFillDescriptor.fill}catch(_){}
 if(f&&f[Symbol.toStringTag]==='GradientFill')out.gradients.push({name:n.name||'',type:String(f.gradientFillType),transform:Array.from(n.brushFillDescriptor.transform.data)});}
}
console.log(JSON.stringify(out));
