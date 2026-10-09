'use strict';
const { Document } = require('/document');
const { UnitType, UserUnitType } = require('/units');
const doc = Document.all.find(d => d.title === 'kisokos-toltheto-hallokeszulek');
if (!doc) throw new Error('Source document is not open.');
function describe(value) {
    return { type: typeof value, name: value && value.name, value: value && value.value,
        text: String(value), keys: value && typeof value === 'object' ? Object.keys(value) : [] };
}
console.log(JSON.stringify({ units: describe(doc.units), widthPixels: doc.widthPixels,
    heightPixels: doc.heightPixels, dpi: doc.dpi, UnitType, UserUnitType }));
