/*
Script Name: Probe Page Settings
Description: Reports read-only page, margin, and facing-page API capabilities.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document } = require('/document');
const dom = require('affinity:dom');
console.log('PAGE ENUMS ' + JSON.stringify(Object.keys(dom).filter(name =>
    /Page.*Box|Box.*Page|Page.*Type/i.test(name))));
function names(value) {
    const result = new Set();
    for (let item = value, depth = 0; item && depth < 4;
        item = Object.getPrototypeOf(item), depth++)
        for (const name of Object.getOwnPropertyNames(item))
            if (/margin|page|spread|facing|preset|guide/i.test(name)) result.add(name);
    return Array.from(result).sort();
}
for (const name of ['DocumentApi', 'SpreadNodeApi', 'PhysicalRootPropertiesInterfaceApi',
    'PageBoxInterfaceApi']) console.log(name + ' ' + JSON.stringify(names(dom[name])));
for (const doc of Document.all) {
    console.log('DOC ' + doc.title + ' ' + JSON.stringify(names(doc)));
    for (const spread of doc.spreads) {
        console.log('SPREAD ' + JSON.stringify({ pageCount: spread.pageCount,
            properties: names(spread.physicalRootPropertiesInterface),
            pageBox: names(spread.physicalRootPropertiesInterface.pageBoxInterface) }));
        try { console.log('PAGE BOX DEFAULT ' +
            JSON.stringify(spread.physicalRootPropertiesInterface.pageBoxInterface.getPageBoundingBox())); }
        catch (error) { console.log('PAGE BOX ERROR ' + error.message); }
    }
}
