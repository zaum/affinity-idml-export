'use strict';
const { Document } = require('/document');
const d = Document.all.find(x => x.title === 'kisokos-toltheto-hallokeszulek');
if (!d) throw new Error('Source document is not open');
const p = d.colourProfile;
console.log(JSON.stringify({title:d.title, format:String(d.format), profile:{name:p.name,
  colourSpace:p.colourSpace, colourSpaceStr:p.colourSpaceStr, version:p.versionStr,
  isStandard:p.isStandard, isLinear:p.isLinear}}));
