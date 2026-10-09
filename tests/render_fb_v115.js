'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const base = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 4/FB-tavasz-820x360';
let doc = null;
try {
    doc = Document.load(base + '.idml');
    const options = FileExportOptions.createWithPresetName('PNG');
    const results = doc.export(base + ' imported v1.15.png', options, FileExportArea.createForPages('1'));
    const first = results && results.all && results.all[0];
    if (!first || !first.isSuccess) throw new Error(first ? first.errorMessage : 'No PNG export record');
    console.log(String(first.path));
} finally {
    if (doc) doc.close();
}
