'use strict';
const {Document}=require('/document');
const d=Document.load('C:/Users/peter/Desktop/idml-gradient-test.idml');
try {
 const result=[];
 for(const n of d.layers.all)if(n.isShapeNode||n.isPolyCurveNode){
  let fill='';try{fill=n.brushFillDescriptor.fill[Symbol.toStringTag]}catch(_){}
  result.push({kind:n[Symbol.toStringTag],fill,visible:n.isVisibleInDomain});
 }
 console.log(JSON.stringify(result));
}finally{d.close();}
