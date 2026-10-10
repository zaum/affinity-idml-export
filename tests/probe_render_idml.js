/*
Script Name: Render Imported IDML
Description: Renders an IDML page to PNG for a visual regression comparison.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document, FileExportOptions, FileExportArea } = require('/document');
const input = globalThis.__PROBE_FILE_PATH__;
const imported = Document.load(input);
try {
    const path = input.replace(/\.idml$/i, '.imported.png');
    const records = imported.export(path, FileExportOptions.createWithPresetName('PNG'),
        FileExportArea.createForPages('1'));
    for (const record of records.all) console.log(JSON.stringify({ success: record.isSuccess,
        path: record.path, error: record.errorMessage }));
} finally { imported.close(); }
