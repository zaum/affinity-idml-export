/*
Script Name: Probe Named Text Styles
Description: Reports read-only Affinity style API capabilities for IDML mapping.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document } = require('/document');
function matchingNames(value) {
    const found = new Set();
    for (let object = value, depth = 0; object && depth < 4;
        object = Object.getPrototypeOf(object), depth++) {
        for (const name of Object.getOwnPropertyNames(object))
            if (/style|paragraph|character|textformat/i.test(name)) found.add(name);
    }
    return Array.from(found).sort();
}
for (const moduleName of ['affinity:story', 'affinity:dom', 'affinity:fonts']) {
    const api = require(moduleName);
    console.log(moduleName + ' exports ' + JSON.stringify(matchingNames(api)));
}
for (const doc of Document.all) {
    console.log('DOC ' + doc.title + ' ' + JSON.stringify(matchingNames(doc)));
    const node = Array.from(doc.layers.all).find(item => item.isFrameTextNode || item.isArtTextNode);
    if (!node) continue;
    console.log('NODE ' + JSON.stringify(matchingNames(node)));
    try { console.log('STORY ' + JSON.stringify(matchingNames(node.story))); } catch (_) {}
    try { console.log('STORY INTERFACE ' + JSON.stringify(matchingNames(node.storyInterface))); } catch (_) {}
}
