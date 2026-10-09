'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const args = globalThis.__IDML_PROBE_ARGS__ || [];
const source = args[0] || 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/FB-tavasz-820x360 editable-only.idml';
const destination = args[1] || 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/FB-tavasz-820x360 editable-only.png';
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
