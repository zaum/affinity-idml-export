'use strict';
const { Document } = require('/document');
const source=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if (!source) throw new Error('Source document is not open');
const imported=Document.load('C:\\Users\\peter\\Desktop\\kisokos-toltheto-hallokeszulek 3.idml');
function scan(doc) {
  const out=[];
  for(const n of Array.from(doc.layers.all)) {
    if (!(n.isShapeNode||n.isPolyCurveNode||n.isVectorNode) || n.isImageNode) continue;
    let weight=null,pts=null,visible=null,kind='';
    try{weight=Number(n.lineWeight)}catch(_){}
    try{pts=Number(n.lineWeightPts)}catch(_){}
    try{visible=n.isLineStyleVisible}catch(_){}
    try{kind=String(n.lineType && (n.lineType.name||n.lineType.value||n.lineType))}catch(_){}
    if (weight>0 || visible) out.push({name:String(n.name||''),kind,weight,pts,visible,
      converted:weight==null?null:weight*72/doc.dpi});
  }
  return out;
}
try { console.log(JSON.stringify({sourceDpi:source.dpi,importDpi:imported.dpi,
 source:scan(source),imported:scan(imported)})); }
finally { imported.close(); }
