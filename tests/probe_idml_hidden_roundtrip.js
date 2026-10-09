'use strict';
const {Document}=require('/document');
const d=Document.load('C:/Users/peter/Desktop/idml-hidden-test.idml');
try {
 const result=[];
 for(const n of d.layers.all)if(n.isImageNode||n.isShapeNode||n.isPolyCurveNode)
  result.push({kind:n[Symbol.toStringTag],visible:n.isVisibleInExport,
    domain:n.isVisibleInDomain,parent:n.parent&&n.parent.name||''});
 console.log(JSON.stringify(result));
} finally {d.close();}
