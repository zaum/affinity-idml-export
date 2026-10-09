'use strict';
const {Document}=require('/document');
const {PixelBuffer,RasterFormat}=require('/rasterobject');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
function transparency(n){
 try{
  const iface=n.transparencyInterface,desc=iface.fillDescriptor,fill=desc.fill;
  const r={kind:fill[Symbol.toStringTag],none:iface.isTransparencyNone,
    transform:Array.from(desc.transform.data),domain:Array.from(iface.domainTransform.data),
    anchored:desc.isAnchoredToSpread,scale:desc.isScaleWithObject};
  if(r.kind==='GradientFill'){
   r.type=fill.gradientFillType && (fill.gradientFillType.value||String(fill.gradientFillType));
   r.stops=fill.gradient.stops.map(s=>({position:s.position,midpoint:s.midpoint,colour:s.colour}));
  }
  return r;
 }catch(e){return {error:e.message}}
}
const result=[];for(const n of d.layers.all)if(n.isImageNode){
 const p=n.parent,w=n.rasterWidth,h=n.rasterHeight,b=PixelBuffer.create(w,h,RasterFormat.RGBA8);
 n.copyTo(b,{x:0,y:0,width:w,height:h},0,0);
 const a=new Uint8Array(b.buffer),counts={zero:0,partial:0,full:0},samples=[];
 for(let i=3;i<a.length;i+=4){const v=a[i];if(v===0)counts.zero++;else if(v===255)counts.full++;else counts.partial++;}
 for(const [x,y] of [[0,0],[Math.floor(w/2),Math.floor(h/2)],[w-1,h-1]])samples.push(a[(y*w+x)*4+3]);
 result.push({size:[w,h],pixels:counts,alphaSamples:samples,image:transparency(n),
  parent:p&&p[Symbol.toStringTag],parentTransparency:p&&transparency(p)});
}console.log(JSON.stringify(result));
