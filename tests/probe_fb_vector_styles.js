'use strict';
const { Document } = require('/document');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const result = [];
for (const node of doc.layers.all) {
    if (!(node.isPolyCurveNode || node.isShapeNode) || node.parent.isSpreadNode) continue;
    const item = { name: String(node.defaultDescriptionForDisplay || ''),
        parent: String(node.parent[Symbol.toStringTag] || ''),
        visible: node.isVisibleInDomain, exportVisible: node.isVisibleInExport,
        opacity: node.globalOpacity, fillOpacity: node.fillOpacity };
    try {
        const descriptor = node.brushFillDescriptor;
        const fill = descriptor.fill;
        try { item.fillMatrix = Array.from(descriptor.transform.data); } catch (_) {}
        item.fillType = String(fill[Symbol.toStringTag] || '');
        if (fill.colour) {
            try { item.rgba8 = fill.colour.rgba8; } catch (_) {}
            try { item.cmyka8 = fill.colour.cmyka8; } catch (_) {}
        }
        if (fill.gradient) {
            const { Colour } = require('/colours');
            item.stops = Array.from(fill.gradient.stops).map(stop => {
                const colour = new Colour(stop.colour);
                return { position: Number(stop.position), rgba8: colour.rgba8 };
            });
        }
    } catch (e) { item.fillError = String(e); }
    try { item.transparency = String(node.transparencyFillDescriptor.fill[Symbol.toStringTag] || ''); }
    catch (_) {}
    try { item.blend = String(node.blendMode); } catch (_) {}
    result.push(item);
}
console.log(JSON.stringify(result));
