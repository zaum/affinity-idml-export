'use strict';
const {Document,FileExportOptions,FileExportArea}=require('/document');
const {Selection}=require('/selections');
const {app}=require('/application');
const d=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if(!d)throw new Error('Source document is not open');
const imgs=Array.from(d.layers.all).filter(n=>n.isImageNode);
for(let i=0;i<2;i++){
 const area=FileExportArea.createForSelection(Selection.create(d,imgs[i]));
 const path=app.userDesktopPath+'/idml-gradient-image-'+(i+1)+'.png';
 const rec=d.export(path,FileExportOptions.createWithPresetName('PNG'),area).all[0];
 console.log(JSON.stringify({i,path:rec.path,success:rec.isSuccess,error:rec.errorMessage}));
}
