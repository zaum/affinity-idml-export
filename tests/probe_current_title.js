const { Document } = require('/document');
const doc = Document.current;
console.log(JSON.stringify({ title: doc && doc.title, pageCount: doc && doc.pageCount }));
