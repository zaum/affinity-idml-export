'use strict';
const {Document}=require('/document');
const d=Document.load('C:/Users/peter/Desktop/kisokos-toltheto-hallokeszulek 10.idml');
try { console.log(JSON.stringify({units:String(d.units),widthPixels:d.widthPixels,
    heightPixels:d.heightPixels,dpi:d.dpi})); }
finally { d.close(); }
