const { Document } = require('/document');
console.log(JSON.stringify(Array.from(Document.all).map(d => ({title:String(d.title), path:String(d.path || '')}))));
