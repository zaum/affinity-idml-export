'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const source = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/FB-tavasz-820x360.idml';
const destination = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/FB-tavasz-820x360 imported.png';
let doc = null;
try {
    doc = Document.load(source);
    const options = FileExportOptions.createWithPresetName('PNG');
    const results = doc.export(destination, options, FileExportArea.createForPages('1'));
    const first = results && results.all && results.all[0];
    if (!first || !first.isSuccess) throw new Error(first ? first.errorMessage : 'No PNG export record');
    console.log(String(first.path));
} finally {
    if (doc) doc.close();
}
