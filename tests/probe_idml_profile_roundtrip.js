'use strict';
const { Document } = require('/document');
const source=Document.all.find(x=>x.title==='kisokos-toltheto-hallokeszulek');
if (!source) throw new Error('Source document is not open');
const imported=Document.load('C:\\Users\\peter\\Desktop\\kisokos-toltheto-hallokeszulek 3.idml');
try {
  console.log(JSON.stringify({source:{format:String(source.format),profile:source.colourProfile.name},
    imported:{format:String(imported.format),profile:imported.colourProfile.name}}));
} finally { imported.close(); }
