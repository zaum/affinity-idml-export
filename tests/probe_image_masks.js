/*
Script Name: Probe Image Masks
Description: Reports image ancestry, native alpha, and transparency without changing the document.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.0.0
version: 1.0.0
Author: zaum
Contact: https://github.com/zaum
Code:
*/
const { Document } = require('/document');
const { PixelBuffer, RasterFormat } = require('/rasterobject');
for (const doc of Document.all) {
    console.log('DOC ' + doc.title);
    for (const node of doc.layers.all) {
        if (!node.isImageNode) continue;
        const chain = [];
        for (let p = node, depth = 0; p && depth < 10; p = p.parent, depth++) {
            const entry = { type: p[Symbol.toStringTag], image: !!p.isImageNode };
            try { entry.name = p.userDescription || p.defaultDescriptionForDisplay; } catch (_) {}
            try { entry.opacity = p.globalOpacity; } catch (_) {}
            try { entry.enclosures = Array.from(p.enclosures, child => child[Symbol.toStringTag]); } catch (_) {}
            chain.push(entry);
        }
        const width = Number(node.rasterWidth), height = Number(node.rasterHeight);
        const sample = PixelBuffer.create(width, height, RasterFormat.RGBA8);
        node.copyTo(sample, { x: 0, y: 0, width, height }, 0, 0);
        const data = new Uint8Array(sample.buffer);
        let translucent = 0, transparent = 0;
        for (let p = 3; p < data.length; p += 4) {
            if (data[p] < 255) translucent++;
            if (!data[p]) transparent++;
        }
        let transparency = '';
        try { transparency = node.transparencyFillDescriptor.fill[Symbol.toStringTag]; } catch (error) { transparency = 'error ' + error.message; }
        console.log('IMAGE ' + JSON.stringify({ chain, width, height,
            translucent, transparent, transparency,
            matrix: Array.from(node.baseToSpreadTransform.data) }));
    }
}
