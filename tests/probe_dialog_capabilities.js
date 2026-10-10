/*
Script Name: Probe Dialog Capabilities
Description: Reports Affinity dialog methods without showing or changing a document.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Dialog, DialogResult } = require('/dialog');
const { DialogApi, DialogGroupApi } = require('affinity:ui');
function names(value) {
    const result = new Set();
    for (let item = value, depth = 0; item && depth < 4;
        item = Object.getPrototypeOf(item), depth++) {
        for (const name of Object.getOwnPropertyNames(item)) result.add(name);
    }
    return Array.from(result).sort();
}
console.log('DialogApi ' + JSON.stringify(names(DialogApi)));
console.log('DialogGroupApi ' + JSON.stringify(names(DialogGroupApi)));
console.log('DialogResult ' + JSON.stringify(names(DialogResult)));
const dialog = Dialog.create('Capability probe');
console.log('Dialog instance ' + JSON.stringify(names(dialog)));
console.log('Dialog raw handle ' + JSON.stringify(names(dialog.handle)));
const group = dialog.addColumn().addGroup('Actions');
console.log('DialogGroup instance ' + JSON.stringify(names(group)));
