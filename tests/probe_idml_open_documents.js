'use strict';
const { Document } = require('/document');
console.log(JSON.stringify(Document.all.map(doc => String(doc.title || ''))));
