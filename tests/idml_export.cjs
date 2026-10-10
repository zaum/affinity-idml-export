'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'finished scripts', 'Export to IDML v1.30.0.js'), 'utf8');
let api;
vm.runInNewContext(source, {
    __IDML_TEST_HOOK__: exported => { api = exported; },
    console,
});
assert.ok(api, 'test hook did not expose the package builder');
assert.equal(api.inferVerticalJustification({ y: 0, height: 100 }, { y: 5, height: 25 }).value,
    'TopAlign');
assert.equal(api.inferVerticalJustification({ y: 0, height: 100 }, { y: 37.5, height: 25 }).value,
    'CenterAlign');
assert.equal(api.inferVerticalJustification({ y: 0, height: 100 }, { y: 70, height: 25 }).value,
    'BottomAlign');
assert.equal(api.inferVerticalJustification({ y: 0, height: 100 }, { y: 0, height: 110 }).ambiguous,
    true, 'overflowing text falls back to top alignment');
const inlineSvg = '<svg viewBox="0 0 100 100"><g><g><text x="5" y="20">Alpha</text></g>' +
    '<g><circle cx="10" cy="20" r="5" style="fill:rgb(180,26,26);"/></g>' +
    '<g transform="matrix(1,0,0,1,10,0)"><path d="M0,0L10,0L10,10Z" style="fill:white;"/></g>' +
    '</g></svg>';
const inlineVectors = api.editableInlineVectors(api.parseSvg(inlineSvg), 'Alpha', 2,
    { width: 200, height: 200 });
assert.equal(inlineVectors.length, 2);
assert.equal(inlineVectors[0].fill.values[0], 180);
assert.equal(inlineVectors[1].paths[0].points[0].anchor.x, 20);
assert.equal(inlineVectors[1].paths[0].closed, true);
assert.equal(api.inlineTextBaselines(api.parseSvg(inlineSvg), 'Alpha', 2,
    { width: 200, height: 200 }).length, 1);
const multiLineInlineSvg = '<svg viewBox="0 0 100 100"><g>' +
    '<g><rect x="1" y="2" width="3" height="4" style="fill:rgb(238,113,0);"/></g>' +
    '<g><rect x="10" y="12" width="3" height="4" style="fill:rgb(238,113,0);"/></g><g/>' +
    '<text x="20" y="20">Tervezés, műszaki tanácsadás</text>' +
    '<text x="20" y="40">Berendezésgyártás, előszerelés</text></g></svg>';
const multiLineVectors = api.editableInlineVectors(api.parseSvg(multiLineInlineSvg),
    'Tervezés, műszaki tanácsadás\nBerendezésgyártás, előszerelés', 2,
    { width: 100, height: 100 });
assert.equal(multiLineVectors.length, 2, 'all inline glyph vectors are recovered from a multi-line text frame');
assert.equal(multiLineVectors[0].paths[0].points[0].anchor.x, 1);
assert.equal(multiLineVectors[0].paths[0].points[0].anchor.y, 2);
assert.equal(multiLineVectors[0].paths[0].closed, true);
assert.equal(api.inlineTextBaselines(api.parseSvg(multiLineInlineSvg),
    'Tervezés, műszaki tanácsadás\nBerendezésgyártás, előszerelés', 2,
    { width: 100, height: 100 }).length, 2);
assert.equal(api.xmlContent('A\u0007B\u0008C\u0003D'),
    'A<?ACE 7?>B<?ACE 8?>C<?ACE 3?>D', 'IDML special character controls use ACE processing instructions');
assert.ok(Math.abs(api.minimumSingleLineFrameHeight({
    paragraphs: [{}], runs: [{ text: 'Location', style: { pointSize: 60, leading: 0 } }]
}) - 75.6) < 1e-9);
assert.equal(api.minimumSingleLineFrameHeight({
    paragraphs: [{}, {}], runs: [{ text: 'Two lines', style: { pointSize: 60 } }]
}), 0);
assert.equal(api.minimumSingleLineFrameWidth({ paragraphs: [{}],
    runs: [{ text: 'Location', style: { pointSize: 60 } }] },
    { x: 100, width: 500 }, { x: 100, width: 540 }), 567);
assert.equal(api.minimumSingleLineFrameWidth({ paragraphs: [{}, {}],
    runs: [{ text: 'Two lines', style: { pointSize: 60 } }] },
    { x: 100, width: 500 }, { x: 100, width: 540 }), 0);
assert.equal(api.textUiScale({ storyInterface: { textUiScale: {
    data: [2.17, 0, 0, 0, 2.17, 0]
} } }), 2.17);
const scaledStyle = { pointSize: 60, leading: 70, baselineShift: 2 };
api.scaleFrameText({ runs: [{ text: 'A', style: scaledStyle }],
    paragraphCharacterStyles: [scaledStyle],
    paragraphs: [{ leading: 70, spaceBefore: 4, spaceAfter: 0 }] }, 2);
assert.equal(scaledStyle.pointSize, 120);
assert.equal(scaledStyle.leading, 140);
assert.equal(api.strokeWeightInPoints({ lineWeight: 6, lineStyleDescriptor: { isScale: false } }, 0.24), 1.44);
assert.equal(api.strokeWeightInPoints({ lineWeight: 6,
    lineStyleDescriptor: { isScale: true, effectiveWeight: () => 9 } }, 0.24), 2.16);
const gradientPixels = new Uint8Array([100, 50, 20, 255, 100, 50, 20, 255,
    100, 50, 20, 255, 100, 50, 20, 255]);
api.applyLinearTransparency(gradientPixels, 4, 1, {
    matrix: [3, 0, 0, 0, 3, 0],
    stops: [{ position: 0, alpha: 255 }, { position: 1, alpha: 0 }],
});
assert.deepEqual([gradientPixels[3], gradientPixels[7], gradientPixels[11], gradientPixels[15]],
    [255, 170, 85, 0]);

const fixture = {
    name: 'Próba & layout',
    measurementUnits: 'Millimeters',
    profile: { space: 'CMYK', name: 'ISO Coated v2 300% (basICColor)' },
    spreads: [
        {
            id: 'spread1',
            page: { id: 'page1', number: 1, width: 595, height: 842, margin: 42,
                bleed: { top: 8.5, bottom: 8.5, left: 8.5, right: 8.5 } },
            frames: [
                { id: 'frame1', storyId: 'story1', x: 30, y: 40, width: 220, height: 95,
                    paragraphs: [
                        { hyphenation: 'false', spaceBefore: 0, spaceAfter: 10, autoLeading: 112.5 },
                        { hyphenation: 'true', spaceBefore: 3, spaceAfter: 0, autoLeading: 135 },
                    ], paragraphCharacterStyles: [null,
                        { family: 'Arial', face: 'Bold', postscript: 'Arial-BoldMT', pointSize: 17 }], runs: [
                    { text: 'Árvíztűrő & <tükör>', style: { family: 'Arial', face: 'Regular', postscript: 'ArialMT', pointSize: 12 } },
                    { text: '\nMásodik sor 😀', style: { family: 'Arial', face: 'Bold', postscript: 'Arial-BoldMT', pointSize: 14 } },
                ] },
            ], objects: [
                { kind: 'vector', id: 'vector1', visible: false, paths: [{ closed: true, points: [
                    { anchor: { x: 20, y: 20 }, left: { x: 20, y: 20 }, right: { x: 20, y: 20 } },
                    { anchor: { x: 20, y: 120 }, left: { x: 20, y: 120 }, right: { x: 20, y: 120 } },
                    { anchor: { x: 120, y: 120 }, left: { x: 120, y: 120 }, right: { x: 120, y: 120 } },
                    { anchor: { x: 120, y: 20 }, left: { x: 120, y: 20 }, right: { x: 120, y: 20 } },
                ] }], fill: { space: 'CMYK', values: [0, 100, 0, 0], alpha: 1 }, stroke: null },
                { kind: 'image', id: 'picture1', visible: false, x: 300, y: 300, width: 100, height: 100,
                    clipPaths: [{ closed: true, points: [
                        { anchor: { x: 50, y: 0 }, left: { x: 20, y: 0 }, right: { x: 80, y: 0 } },
                        { anchor: { x: 100, y: 50 }, left: { x: 100, y: 20 }, right: { x: 100, y: 80 } },
                        { anchor: { x: 50, y: 100 }, left: { x: 80, y: 100 }, right: { x: 20, y: 100 } },
                        { anchor: { x: 0, y: 50 }, left: { x: 0, y: 80 }, right: { x: 0, y: 20 } },
                    ] }],
                    pixelWidth: 2, pixelHeight: 2, matrix: [50, 0, 300, 0, 50, 300],
                    contents: api.base64(api.pngRgba(2, 2, new Uint8Array([
                        220, 30, 70, 255, 220, 30, 70, 255,
                        220, 30, 70, 255, 220, 30, 70, 255,
                    ]))) },
            ],
        },
        {
            id: 'spread2',
            page: { id: 'page2', number: 2, width: 595, height: 842 },
            frames: [], objects: [],
        },
    ],
};

const packageBytes = api.zipStore(api.makeParts(fixture));
const layerFixture = JSON.parse(JSON.stringify(fixture));
layerFixture.layers = [{ id: 'layerSource1', name: 'Print / Photos', visible: true, locked: false },
    { id: 'layerSource2', name: 'Hidden art', visible: false, locked: true }];
layerFixture.spreads[0].objects[0].layer = 'layerSource2';
layerFixture.spreads[0].objects[1].layer = 'layerSource1';
layerFixture.spreads[0].frames[0].layer = 'layerSource1';
layerFixture.spreads[0].frames[0].kind = 'frame';
const layerParts = api.makeParts(layerFixture);
const layerMap = layerParts.find(p => p.name === 'designmap.xml').content;
const layerSpread = layerParts.find(p => p.name === 'Spreads/Spread_spread1.xml').content;
assert.match(layerMap, /<Layer Self="layerSource1" Name="Print \/ Photos" Visible="true"/);
assert.match(layerMap, /<Layer Self="layerSource2" Name="Hidden art" Visible="false" Locked="true"/);
assert.match(layerSpread, /<Polygon Self="vector1" ItemLayer="layerSource2"/);
assert.match(layerSpread, /<Polygon Self="picture1" ItemLayer="layerSource1"/);
assert.match(layerSpread, /<TextFrame Self="frame1"[^>]*ItemLayer="layerSource1"/);
layerFixture.spreads[0].items = [layerFixture.spreads[0].frames[0],
    layerFixture.spreads[0].objects[1], layerFixture.spreads[0].objects[0]];
const orderedSpread = api.makeParts(layerFixture)
    .find(p => p.name === 'Spreads/Spread_spread1.xml').content;
assert.ok(orderedSpread.indexOf('<TextFrame Self="frame1"') <
    orderedSpread.indexOf('<Polygon Self="picture1"'));
assert.ok(orderedSpread.indexOf('<Polygon Self="picture1"') <
    orderedSpread.indexOf('<Polygon Self="vector1"'));
const pageNode = { isShapeNode: true, parent: { isSpreadNode: true },
    isPageNode: true, [Symbol.toStringTag]: 'ShapeNode' };
const outerLayer = { userDescription: 'Print', isVisibleInDomain: true,
    parent: pageNode, [Symbol.toStringTag]: 'ContainerNode' };
const innerLayer = { userDescription: 'Photos', isVisibleInDomain: false,
    parent: outerLayer, [Symbol.toStringTag]: 'ContainerNode' };
const groupNode = { isGroupNode: true, userDescription: 'Photo group',
    parent: innerLayer, [Symbol.toStringTag]: 'GroupNode' };
assert.deepEqual(Array.from(api.ancestry({ parent: groupNode }).layers, x => x.name),
    ['Print', 'Photos']);
assert.deepEqual(Array.from(api.ancestry({ parent: groupNode }).groups), ['Photo group']);
const clipShape = { isShapeNode: true, parent: outerLayer,
    getSpreadBaseBox: () => ({ x: 10, y: 20, width: 50, height: 40 }) };
const nestedGroup = { isGroupNode: true, parent: clipShape };
const clippedImage = { parent: nestedGroup };
const clip = api.imageClip(clippedImage, 1, node =>
    node === clipShape ? [{ closed: true, points: [] }] : []);
assert.equal(clip.frameBox.x, 10);
assert.equal(clip.clipPaths.length, 1);
const directClip = api.imageClip({ parent: clipShape }, 1, node =>
    node === clipShape ? [{ closed: true, points: [] }] : []);
assert.equal(directClip.clipKind, 'vector');
const pageImage = { parent: { isGroupNode: true, parent: pageNode } };
assert.equal(api.imageClip(pageImage, 1, () => [{ closed: true }]), null);
const imageParent = { isImageNode: true, parent: outerLayer,
    getSpreadBaseBox: () => ({ x: 5, y: 10, width: 80, height: 60 }) };
const imageInsideImage = api.imageClip({ parent: { isGroupNode: true,
    parent: imageParent } }, 0.5);
assert.equal(imageInsideImage.clipKind, 'imageBounds');
assert.equal(imageInsideImage.clipPaths[0].points[2].anchor.x, 40);
assert.equal(imageInsideImage.clipPaths[0].points[2].anchor.y, 30);
const maskPixels = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 0]);
const maskParent = { isImageNode: true, rasterWidth: 2, rasterHeight: 1,
    baseToSpreadTransform: { data: [2, 0, 10, 0, 2, 20] },
    transparencyFillDescriptor: { fill: { [Symbol.toStringTag]: 'NoFill' } },
    copyTo(buffer) { buffer.buffer.set(maskPixels); },
    parent: { isSpreadNode: true } };
const maskedChild = { baseToSpreadTransform: { data: [2, 0, 10, 0, 2, 20] },
    parent: maskParent };
const childPixels = new Uint8Array([20, 30, 40, 200, 20, 30, 40, 200]);
const pixelApi = { create: (width, height) => ({ buffer: new Uint8Array(width * height * 4) }) };
assert.equal(api.applyImageAncestorMasks(maskedChild, childPixels, 2, 1,
    pixelApi, { RGBA8: 0 }, null), 1);
assert.deepEqual([childPixels[3], childPixels[7]], [200, 0]);
const plainPixels = new Uint8Array([20, 30, 40, 200]);
assert.equal(api.applyImageAncestorMasks({ parent: { isSpreadNode: true } },
    plainPixels, 1, 1, pixelApi, { RGBA8: 0 }, null), 0);
assert.equal(plainPixels[3], 200);
const fixedLeadingFixture = JSON.parse(JSON.stringify(fixture));
const fixedFrame = fixedLeadingFixture.spreads[0].frames[0];
fixedFrame.runs = [{ text: 'First\n\nThird', style: {
    family: 'Arial', face: 'Regular', postscript: 'ArialMT', pointSize: 12,
} }];
fixedFrame.paragraphs = [{ leading: 18 }, { leading: 24 }, { leading: 30 }];
fixedFrame.paragraphCharacterStyles = [null, { family: 'Arial', face: 'Regular',
    postscript: 'ArialMT', pointSize: 12 }, null];
const fixedStory = api.makeParts(fixedLeadingFixture)
    .find(p => p.name === 'Stories/Story_story1.xml').content;
assert.match(fixedStory, /Leading="18"[^>]*>.*?<Content>First<\/Content>/);
assert.match(fixedStory, /Leading="24"[^>]*>.*?<Content><\/Content>/);
assert.match(fixedStory, /Leading="30"[^>]*>.*?<Content>Third<\/Content>/);
const glyphOverrideFixture = JSON.parse(JSON.stringify(fixedLeadingFixture));
glyphOverrideFixture.spreads[0].frames[0].runs[0].style.leading = 21;
const overrideStory = api.makeParts(glyphOverrideFixture)
    .find(p => p.name === 'Stories/Story_story1.xml').content;
assert.match(overrideStory, /Leading="21"[^>]*>.*?<Content>First<\/Content>/);
assert.doesNotMatch(overrideStory, /Leading="18"/);
const gradientFixture = JSON.parse(JSON.stringify(fixture));
gradientFixture.spreads[0].objects[0].fill = { type: 'gradient', kind: 'Linear', stops: [
    { position: 0, midpoint: 0.5, colour: { space: 'RGB', values: [255, 0, 0], alpha: 1 } },
    { position: 1, midpoint: 0.5, colour: { space: 'RGB', values: [0, 0, 255], alpha: 1 } },
] };
gradientFixture.spreads[0].objects[0].fillAngle = 45;
const gradientParts = api.makeParts(gradientFixture);
assert.equal(api.needsHybridArtwork({ spreads: gradientFixture.spreads }), true);
assert.equal(api.needsHybridArtwork({ spreads: fixture.spreads }), false);
assert.equal(api.needsHybridArtwork({ spreads: [{ frames: [], objects: [] }], diagnostics: {
    pages: [{ objects: [{ type: 'embeddedDocument', visible: true }] }],
} }), false);

const renderedPixels = new Uint8Array([240, 30, 60, 255, 0, 0, 0, 0]);
const renderedPixelApi = {
    PixelBuffer: { create: (width, height) => ({ buffer: new Uint8Array(width * height * 4) }) },
    RasterFormat: { RGBA8: 1 },
    NodeRenderingEngine: { createDefault: node => ({ width: 2, height: 1,
        copyTo: buffer => buffer.buffer.set(node.empty ? new Uint8Array(8) : renderedPixels) }) },
};
const renderParent = { isSpreadNode: true };
const embeddedNode = { isEmbeddedDocumentNode: true, isPhysicalNode: true,
    isVisibleInDomain: true, userDescription: 'Transparent artwork',
    parent: renderParent, globalOpacity: 1,
    getSpreadBaseBox: () => ({ x: 5, y: 10, width: 2, height: 1 }),
    getSpreadVisibleBox: () => ({ x: 5, y: 10, width: 2, height: 1 }) };
const emptyRasterNode = { isRasterNode: true, isPhysicalNode: true,
    isVisibleInDomain: true, parent: renderParent, empty: true,
    getSpreadBaseBox: () => ({ x: 8, y: 10, width: 2, height: 1 }),
    getSpreadVisibleBox: () => ({ x: 8, y: 10, width: 2, height: 1 }) };
const renderedModel = api.readModel({ dpi: 72, title: 'Separate images', spreads: [{
    pageCount: 1,
    getSpreadExtents: () => ({ x: 1, y: 2, width: 100, height: 80 }),
    layers: { all: [embeddedNode, emptyRasterNode] },
}] }, {}, renderedPixelApi);
assert.equal(renderedModel.images, 1);
assert.equal(renderedModel.skipped, 1, 'fully transparent physical nodes are omitted');
assert.equal(renderedModel.spreads[0].items.length, 1);
assert.equal(renderedModel.spreads[0].items[0].id, 'picture1');
assert.deepEqual(Array.from(renderedModel.spreads[0].items[0].matrix), [1, 0, 4, 0, 1, 8]);
assert.equal(renderedModel.diagnostics.pages[0].objects[0].status, 'approximated');
assert.equal(renderedModel.diagnostics.pages[0].objects[1].status, 'omitted');
const renderedSpread = api.makeParts(renderedModel).find(p => p.name === 'Spreads/Spread_spread1.xml').content;
assert.equal((renderedSpread.match(/<Image Self=/g) || []).length, 1);
assert.match(renderedSpread, /<Image Self="imagepicture1"/);

const capturedRasterNode = { ...emptyRasterNode, globalOpacity: 1 };
const selectionCaptureCalls = [];
const selectionCaptureApi = { ...renderedPixelApi,
    captureRasterNode(node, index) {
        selectionCaptureCalls.push({ node, index });
        return { bytes: api.pngRgba(2, 1, renderedPixels), visiblePixels: 1, sourceAlphaPixels: 1 };
    } };
const selectionRenderedModel = api.readModel({ dpi: 72, title: 'Raster selection render', spreads: [{
    pageCount: 1,
    getSpreadExtents: () => ({ x: 1, y: 2, width: 100, height: 80 }),
    layers: { all: [capturedRasterNode, embeddedNode] },
}] }, {}, selectionCaptureApi);
assert.equal(selectionRenderedModel.images, 2);
assert.equal(selectionRenderedModel.skipped, 0);
assert.deepEqual(Array.from(selectionRenderedModel.spreads[0].items, item => item.id),
    ['picture1', 'picture2'], 'selection-rendered raster keeps its source Z-order');
assert.equal(selectionCaptureCalls[0].node, capturedRasterNode);
assert.equal(selectionRenderedModel.spreads[0].items[0].pixelWidth, 2);
assert.equal(selectionRenderedModel.spreads[0].items[0].sourceAlphaPixels, 1);
assert.equal(Buffer.from(selectionRenderedModel.spreads[0].items[0].contents, 'base64')[25], 6,
    'RasterNode selection PNG retains an RGBA alpha channel');
assert.equal(selectionRenderedModel.diagnostics.pages[0].objects[0].status, 'approximated');
const selectionRenderedSpread = api.makeParts(selectionRenderedModel)
    .find(p => p.name === 'Spreads/Spread_spread1.xml').content;
assert.ok(selectionRenderedSpread.indexOf('imagepicture1') < selectionRenderedSpread.indexOf('imagepicture2'));

const gradientNode = { parent: renderParent, globalOpacity: 1,
    getSpreadBaseBox: () => ({ x: 20, y: 20, width: 2, height: 1 }),
    getSpreadVisibleBox: () => ({ x: 20, y: 20, width: 2, height: 1 }) };
const gradientReport = { status: 'exported', idmlId: 'vector1', issues: [],
    properties: {}, propertyAudit: { paths: { state: 'exported' }, fill: { state: 'exported' },
        stroke: { state: 'unknown' } } };
const gradientVector = { kind: 'vector', id: 'vector1', sourceNode: gradientNode,
    sourceOrder: 2, layer: 'layer1', visible: true,
    paths: [], fill: { type: 'gradient', kind: 'Linear' }, stroke: null,
    diagnosticEntry: gradientReport };
const gradientImage = { kind: 'image', id: 'picture1', sourceOrder: 1 };
const hybridSpread = { objects: [gradientImage, gradientVector],
    items: [gradientImage, gradientVector], sourceOrigin: { x: 0, y: 0 }, pointScale: 1 };
const hybridModel = { spreads: [hybridSpread], diagnostics: { warnings: [] }, images: 1, vectors: 1 };
api.rasterizeHybridVectors(hybridModel, renderedPixelApi);
assert.equal(hybridModel.images, 2);
assert.equal(hybridModel.vectors, 0);
assert.equal(hybridModel.rasterizedArtworkObjects, 1);
assert.deepEqual(Array.from(hybridSpread.items, item => item.id), ['picture1', 'picture2']);
assert.equal(gradientReport.idmlId, 'picture2');
assert.equal(gradientReport.status, 'approximated');
assert.match(gradientParts.find(p => p.name === 'Resources/Graphic.xml').content,
    /<Gradient Self="Gradient\/idml1"/);
assert.match(gradientParts.find(p => p.name === 'Spreads/Spread_spread1.xml').content,
    /GradientFillAngle="45"/);
if (process.argv.includes('--write-gradient-sample'))
    fs.writeFileSync(path.join(__dirname, 'generated_gradient_probe.idml'),
        Buffer.from(api.zipStore(gradientParts)));
const rgbDesignmap = api.makeParts({ ...fixture,
    profile: { space: 'RGB', name: 'sRGB IEC61966-2.1' } })
    .find(p => p.name === 'designmap.xml').content;
assert.match(rgbDesignmap, /RGBProfile="sRGB IEC61966-2.1"/);
assert.doesNotMatch(rgbDesignmap, /CMYKProfile=/);
if (process.argv.includes('--write-sample'))
    fs.writeFileSync(path.join(__dirname, 'generated_probe.idml'), Buffer.from(packageBytes));
assert.equal(packageBytes[0], 0x50);
assert.equal(packageBytes[1], 0x4b);
assert.ok(packageBytes.length > 100);
assert.equal(api.chooseFolder('C:\\Desktop', 'test.af', p => p.endsWith('/test IDML export')),
    'C:\\Desktop/IDML Exports/test IDML export 2');

function unzipStored(buffer) {
    const files = new Map();
    const names = [];
    let offset = 0;
    while (offset + 30 < buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
        assert.equal(buffer.readUInt16LE(offset + 8), 0, 'ZIP entries use the store method');
        const size = buffer.readUInt32LE(offset + 18);
        const nameLength = buffer.readUInt16LE(offset + 26);
        const extraLength = buffer.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
        const dataStart = nameStart + nameLength + extraLength;
        files.set(name, buffer.subarray(dataStart, dataStart + size));
        names.push(name);
        offset = dataStart + size;
    }
    return { files, names };
}
const { files, names } = unzipStored(Buffer.from(packageBytes));
assert.equal(names[0], 'mimetype');
assert.equal(files.get('mimetype').toString(), 'application/vnd.adobe.indesign-idml-package');
assert.equal(names.filter(name => name.startsWith('Spreads/')).length, 2);
assert.equal(names.filter(name => name.startsWith('Stories/')).length, 1);
assert.ok(files.has('META-INF/container.xml'));
assert.ok(files.has('Resources/Fonts.xml'));
assert.ok(files.has('Resources/Graphic.xml'));
assert.ok(files.has('Resources/Preferences.xml'));
const designmap = files.get('designmap.xml').toString('utf8');
assert.match(designmap, /StoryList="story1"/);
assert.match(designmap, /CMYKProfile="ISO Coated v2 300% \(basICColor\)"/);
assert.match(designmap, /Resources\/Fonts.xml/);
assert.match(designmap, /Resources\/Preferences.xml/);
const story = files.get('Stories/Story_story1.xml').toString('utf8');
assert.match(story, /Árvíztűrő &amp; &lt;tükör&gt;/);
assert.match(story, /Második sor 😀/);
assert.match(story, /FontStyle="Bold"/);
assert.match(story, /PointSize="14"/);
assert.equal((story.match(/<Br\/>/g) || []).length, 1);
assert.match(story, /Hyphenation="false"/);
assert.match(story, /SpaceAfter="10"/);
assert.match(story, /SpaceBefore="3"/);
assert.match(story, /AutoLeading="135"/);
assert.equal((story.match(/<AppliedFont type="string">Arial<\/AppliedFont>/g) || []).length, 3);
assert.match(story, /PointSize="17"/);
assert.match(story, /<Content><\/Content><\/CharacterStyleRange><\/ParagraphStyleRange><\/Story><\/idPkg:Story>$/);
const fonts = files.get('Resources/Fonts.xml').toString('utf8');
assert.match(fonts, /FontStyleName="Regular"/);
assert.match(fonts, /FontStyleName="Bold"/);
const preferences = files.get('Resources/Preferences.xml').toString('utf8');
assert.match(preferences, /DocumentBleedTopOffset="8\.5"/);
assert.match(preferences, /HorizontalMeasurementUnits="Millimeters"/);
assert.match(preferences, /DocumentBleedUniformSize="true"/);
const spread = files.get('Spreads/Spread_spread1.xml').toString('utf8');
assert.match(spread, /<Page[^>]*><MarginPreference[^>]*Top="42"/);
assert.equal((spread.match(/<TextFrame\b/g) || []).length, 1);
assert.match(spread, /<Polygon Self=/);
assert.match(spread, /<Image Self=/);
assert.match(spread, /<Polygon Self="picture1"/);
assert.equal((spread.match(/Visible="false"/g) || []).length, 2);
assert.match(files.get('Resources/Graphic.xml').toString('utf8'), /Color\/idml1/);
const pngContents = spread.match(/<Contents>([^<]+)<\/Contents>/);
assert.ok(pngContents, 'image PNG data should be embedded');
assert.deepEqual(Array.from(Buffer.from(pngContents[1], 'base64').subarray(0, 8)),
    [137, 80, 78, 71, 13, 10, 26, 10]);
process.stdout.write('ZIP, UCF, XML and Unicode passed\n');

let written = null;
let reportWritten = null;
let alert = '';
let output = '';
const textNode = {
    isFrameTextNode: true,
    isPhysicalNode: true,
    getSpreadBaseBox: () => ({ x: 60, y: 80, width: 440, height: 190 }),
    storyRange: { begin: 0, end: 5 },
    story: {
        handle: 'story-handle',
        length: 5,
        isParagraphBreak: p => p === 2,
        getGlyph: p => ({ isCharGlyph: true, string: ['A', '&', '', 'B', 'C'][p] }),
    },
};
const fontApi = {
    StoryApi: {
        getGlyphAtts: (_, p) => ({ face: p < 3 ? 'Regular' : 'Bold' }),
        getGlyphAttsRunEnd: (_, p) => p < 3 ? 3 : 5,
        getParagraphAtts: (_, p) => ({ paragraph: p < 3 ? 0 : 1 }),
    },
    ParagraphAttDoubleType: { SpaceBefore: 1, SpaceAfter: 2, RelativeLeading: 3 },
    ParagraphAttsApi: {
        getIsAutoHyphenate: h => h.paragraph === 1,
        getDoubleValue: (h, kind) => kind === 1 ? h.paragraph * 6 :
            kind === 2 ? (h.paragraph ? 0 : 20) : h.paragraph ? 1.35 : 1.125,
    },
    GlyphAttsApi: {
        getFont: a => a.face,
        getDoubleValue: (a, kind) => kind === 4 ? (a.face === 'Bold' ? 0.05 : 0) :
            kind === 3 ? -1 :
            kind === 2 ? (a.face === 'Bold' ? 0.1 : 0) :
            (a.face === 'Regular' ? 24 : 28),
    },
    GlyphAttDoubleType: { Height: 1, ManualKerning: 2, AutoKernMinHeight: 3,
        CharacterSpacing: 4 },
    FontApi: {
        getFamilyName: () => 'Arial',
        getTraitsName: face => face,
        getPostscriptName: face => face === 'Bold' ? 'Arial-BoldMT' : 'ArialMT',
    },
};
const read = api.readModel({
    dpi: 144, title: 'Sample.af', spreads: [{ pageCount: 1,
        getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
        layers: { all: [textNode] } }],
}, fontApi);
assert.equal(read.spreads[0].frames[0].runs.length, 2);
assert.equal(read.spreads[0].frames[0].runs[0].text, 'A&\n');
assert.equal(read.spreads[0].frames[0].runs[1].text, 'BC');
assert.equal(read.spreads[0].frames[0].runs[1].style.pointSize, 14);
assert.equal(read.spreads[0].frames[0].runs[0].style.kerningValue, undefined);
assert.equal(read.spreads[0].frames[0].runs[0].style.kerningMethod, '$ID/None');
assert.equal(read.spreads[0].frames[0].runs[1].style.kerningValue, 100);
assert.equal(read.spreads[0].frames[0].runs[1].style.tracking, 50);
assert.match(api.makeParts(read).find(p => p.name.startsWith('Stories/')).content,
    /KerningMethod="\$ID\/None" KerningValue="100"/);
assert.match(api.makeParts(read).find(p => p.name.startsWith('Stories/')).content,
    /Tracking="50"/);
assert.match(api.makeParts(read).find(p => p.name.startsWith('Spreads/')).content,
    /TextFramePreference AutoSizingType="Off" VerticalJustification="TopAlign"/);
const centerAlignedNode = { ...textNode,
    getSpreadBaseBox: () => ({ x: 60, y: 80, width: 440, height: 100 }),
    getExactSpreadVisibleBox: () => ({ x: 90, y: 110, width: 380, height: 40 }) };
const centerAlignedRead = api.readModel({ dpi: 144, title: 'Centered text', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [centerAlignedNode] } }] }, fontApi);
assert.equal(centerAlignedRead.spreads[0].frames[0].verticalJustification, 'CenterAlign');
assert.equal(centerAlignedRead.diagnostics.pages[0].objects[0].propertyAudit.verticalJustification.state,
    'approximated');
assert.match(api.makeParts(centerAlignedRead).find(p => p.name.startsWith('Spreads/')).content,
    /TextFramePreference AutoSizingType="Off" VerticalJustification="CenterAlign"/);
const bottomAlignedNode = { ...textNode,
    getSpreadBaseBox: () => ({ x: 60, y: 80, width: 440, height: 100 }),
    getExactSpreadVisibleBox: () => ({ x: 90, y: 150, width: 380, height: 25 }) };
const bottomAlignedRead = api.readModel({ dpi: 144, title: 'Bottom aligned text', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [bottomAlignedNode] } }] }, fontApi);
assert.equal(bottomAlignedRead.spreads[0].frames[0].verticalJustification, 'BottomAlign');
assert.match(api.makeParts(bottomAlignedRead).find(p => p.name.startsWith('Spreads/')).content,
    /TextFramePreference AutoSizingType="Off" VerticalJustification="BottomAlign"/);
const exactVisibleTextNode = { ...textNode,
    getSpreadBaseBox: () => ({ x: 60, y: 80, width: 440, height: 80 }),
    getExactSpreadVisibleBox: () => ({ x: 62, y: 80, width: 380, height: 130 }) };
const exactVisibleTextRead = api.readModel({ dpi: 144, title: 'Wrapped text bounds', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [exactVisibleTextNode] } }] }, fontApi);
assert.equal(exactVisibleTextRead.spreads[0].frames[0].height, 65,
    'text frame expands to contain the source glyph lines');
assert.equal(exactVisibleTextRead.spreads[0].frames[0].sourceTextTopOffset, 0);
const relativeHeightFontApi = { ...fontApi,
    ParagraphLeadingType: { RelativeToIdeal: { value: 0 }, RelativeToHeight: { value: 1 },
        ExactlyAbsolute: { value: 2 }, AtLeastAbsolute: { value: 3 }, RelativeToIdealAbsolute: { value: 4 } },
    ParagraphAttsApi: { ...fontApi.ParagraphAttsApi,
        getLeadingType: () => ({ value: 1 }),
        getDoubleValue: (h, kind) => kind === 3 ? 0.1137969958284683 :
            fontApi.ParagraphAttsApi.getDoubleValue(h, kind) } };
const relativeHeightRead = api.readModel({ dpi: 144, title: 'Relative leading', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [textNode] } }] }, relativeHeightFontApi);
const relativeHeightStory = api.makeParts(relativeHeightRead)
    .find(p => p.name.startsWith('Stories/')).content;
assert.match(relativeHeightStory, /AutoLeading="111\.3796995828468/,
    'RelativeToHeight stores leading above the ideal font height, not total AutoLeading percent');
assert.equal(read.spreads[0].frames[0].paragraphs[0].hyphenation, 'false');
assert.equal(read.spreads[0].frames[0].paragraphs[0].spaceAfter, 10);
assert.equal(read.spreads[0].frames[0].paragraphs[1].hyphenation, 'true');
assert.equal(read.diagnostics.summary.approximated, 1);
assert.equal(read.diagnostics.pages[0].objects[0].type, 'frameText');
assert.match(read.diagnostics.pages[0].objects[0].issues.join(' '), /Named paragraph/);
assert.equal(read.diagnostics.schemaVersion, 2);
assert.equal(read.diagnostics.pages[0].objects[0].propertyAudit['character.pointSize'].state, 'exported');
assert.equal(read.diagnostics.pages[0].objects[0].propertyAudit.namedParagraphStyle.state, 'notProbed');
assert.ok(read.diagnostics.summary.properties.exported > 0);
assert.equal(read.diagnostics.summary.byProperty['character.pointSize'].exported, 1);
assert.match(read.diagnostics.propertyStates.notMapped, /not serialized/);
const inventory = api.readModel({ dpi: 144, title: 'Inventory', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [textNode, { isGroupNode: true }, { isPhysicalNode: true,
        getSpreadBaseBox: () => ({ x: 10, y: 20, width: 30, height: 40 }) }] } }] }, fontApi);
assert.equal(inventory.diagnostics.summary.containers, 1);
assert.equal(inventory.diagnostics.summary.omitted, 1);
assert.match(inventory.diagnostics.pages[0].objects[2].issues[0], /no IDML mapping/);
const absoluteFontApi = { ...fontApi,
    ParagraphAttDoubleType: { ...fontApi.ParagraphAttDoubleType, AbsoluteLeading: 4 },
    ParagraphAttsApi: { ...fontApi.ParagraphAttsApi,
        getLeadingType: () => 'absolute',
        getDoubleValue: (h, kind) => kind === 4 ? 30 :
            fontApi.ParagraphAttsApi.getDoubleValue(h, kind) } };
const absoluteRead = api.readModel({ dpi: 144, title: 'Absolute leading', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [textNode] } }] }, absoluteFontApi);
assert.equal(absoluteRead.diagnostics.pages[0].objects[0].propertyAudit['paragraph.leading'].state,
    'exported');
assert.equal(absoluteRead.diagnostics.pages[0].objects[0].propertyAudit['paragraph.leading'].source.examples[0], 15);
const absoluteStory = api.makeParts(absoluteRead)
    .find(p => p.name.startsWith('Stories/')).content;
assert.match(absoluteStory, /Leading="15"/);
const terminalNode = {
    ...textNode,
    storyRange: { begin: 0, end: 4 },
    story: { ...textNode.story, length: 4,
        isParagraphBreak: p => p === 3,
        getGlyph: p => ({ isCharGlyph: true, string: 'ABC'[p] || '' }),
    },
};
const terminalRead = api.readModel({ dpi: 144, title: 'Terminator', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [terminalNode] } }] }, fontApi);
assert.equal(terminalRead.spreads[0].frames[0].runs[0].text, 'ABC');
assert.equal(terminalRead.spreads[0].frames[0].paragraphs.length, 1);
const pinNode = { ...textNode, storyRange: { begin: 0, end: 3 },
    story: { ...textNode.story, length: 3, isParagraphBreak: () => false,
        getGlyph: p => p === 1 ? { isPinGlyph: true } :
            { isCharGlyph: true, string: p === 0 ? 'A' : 'B' } } };
const pinRead = api.readModel({ dpi: 144, title: 'Pin', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [pinNode] } }] }, fontApi);
assert.equal(pinRead.spreads[0].frames[0].runs[0].text, 'AB');
assert.equal(pinRead.diagnostics.pages[0].objects[0].properties.inlineObjects, 1);
assert.equal(pinRead.diagnostics.pages[0].objects[0].propertyAudit.inlineObjects.state, 'notMapped');
const specialGlyphNode = { ...textNode, storyRange: { begin: 0, end: 5 },
    story: { ...textNode.story, length: 5, isParagraphBreak: p => p === 4,
        getGlyph: p => [
            { isGlyphIndexGlyph: true, index: 762 },
            { isCharGlyph: true, string: ' ' },
            { isIndentToHereGlyph: true },
            { isCharGlyph: true, string: 'A' },
            { isCharGlyph: true, string: '' },
        ][p] } };
const specialGlyphRead = api.readModel({ dpi: 144, title: 'Special glyphs', spreads: [{ pageCount: 1,
    getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
    layers: { all: [specialGlyphNode] } }] }, fontApi);
const specialFrame = specialGlyphRead.spreads[0].frames[0];
assert.equal(specialFrame.runs.map(run => run.text).join(''), ' \u0007A');
assert.equal(specialGlyphRead.diagnostics.pages[0].objects[0].properties.inlineObjects, 1);
assert.equal(specialGlyphRead.diagnostics.pages[0].objects[0].properties.glyphIndexObjects, 1);
assert.equal(specialGlyphRead.diagnostics.pages[0].objects[0].properties.controlGlyphs, 1);
const specialStory = api.makeParts(specialGlyphRead).find(p => p.name.startsWith('Stories/')).content;
assert.match(specialStory, /<Content> <\?ACE 7\?><\/Content>/);
const doc = {
    dpi: 144,
    title: 'Sample.af',
    spreads: [{
        pageCount: 1,
        getSpreadExtents: () => ({ x: 0, y: 0, width: 1190, height: 1684 }),
        layers: { all: [textNode] },
    }],
};
const hostBuffer = {
    create(length) { return { array: new Uint8Array(length) }; },
};
const folders = new Set();
const createdFiles = [];
const fileModule = {
    File: {
        create(filename) {
            assert.match(filename, /Sample IDML export(?: 2)?\/Sample\.(?:idml|diagnostics\.json)$/);
            createdFiles.push(filename);
            return {
                write(buf, length) {
                    if (filename.endsWith('.json')) reportWritten = buf.array.slice();
                    else written = buf.array.slice();
                    return length;
                },
                flush() {}, close() {},
            };
        },
    },
    FileSystemApi: {
        exists: filename => folders.has(filename),
        createDirectory(folder) { assert.ok(!folders.has(folder)); folders.add(folder); },
    },
};
vm.runInNewContext(source, {
    __IDML_SKIP_PREVIEWS__: true,
    __IDML_SILENT__: true,
    require(id) {
        if (id === '/application') return { app: { userDesktopPath: 'C:\\Desktop', alert: message => { alert = message; } } };
        if (id === '/document') return { Document: { current: doc },
            FileExportOptions: { createWithPresetName: () => ({}) },
            FileExportArea: { createForSelection: () => ({}) } };
        if (id === '/fs') return fileModule;
        if (id === '/buffer') return { Buffer: hostBuffer };
        if (id === '/rasterobject') return { PixelBuffer: {}, RasterFormat: {} };
        if (id === '/selections') return { Selection: { create: () => ({}) } };
        if (id === '/fills') return { FillDescriptor: function () {} };
        if (id === '/colours') return { Colour: function () {} };
        if (id === 'affinity:story') return fontApi;
        if (id === 'affinity:fonts') return { FontApi: fontApi.FontApi };
        throw new Error('Unexpected module: ' + id);
    },
    console: { log(message) { output += message; } },
});
assert.ok(written && written.length > 100, output || alert || 'silent export did not write an IDML file');
assert.ok(reportWritten && reportWritten.length > 100);
assert.deepEqual(Array.from(folders), ['C:\\Desktop/IDML Exports', 'C:\\Desktop/IDML Exports/Sample IDML export']);
assert.ok(createdFiles.every(p => p.startsWith('C:\\Desktop/IDML Exports/Sample IDML export/')));
const report = JSON.parse(Buffer.from(reportWritten).toString('utf8'));
assert.equal(report.summary.approximated, 1);
assert.equal(report.pages[0].objects[0].idmlId, 'frame1');
assert.equal(report.pages[0].objects[0].propertyAudit['paragraph.spaceAfter'].state, 'exported');
assert.match(output, /editable text frames: 1/);
assert.match(output, /font faces: 2, unresolved text runs: 0/);
written = null;
reportWritten = null;
const dialogControls = {};
const dialogGroups = {};
let dialogShown = false;
let openedPath = null;
let dialogConfig = null;
vm.runInNewContext(source, {
    __IDML_SKIP_PREVIEWS__: true,
    require(id) {
        if (id === '/dialog') return { Dialog: { create() { dialogConfig = { initialWidth: 0 }; return Object.assign(dialogConfig, {
            addColumn() { return { addGroup(label) {
                const group = { isVisible: true };
                dialogGroups[label] = group;
                return Object.assign(group, {
                addStaticText(label, initial) {
                    const control = { text: initial, isVisible: true };
                    dialogControls[label] = control;
                    return control;
                },
                addTextBox(label, initial) {
                    const control = { text: initial, isVisible: true };
                    dialogControls[label] = control;
                    return control;
                },
                addButton(label) {
                    const button = { isEnabled: true, isVisible: true, isFullWidth: false, onClickHandler: null };
                    dialogControls[label] = button;
                    return button;
                },
                });
            } }; },
            runModal() {
                dialogShown = true;
                assert.equal(written, null, 'export must wait until Start is clicked');
                assert.equal(reportWritten, null, 'report must wait until Start is clicked');
                assert.equal(dialogGroups['Export result'].isVisible, false);
                assert.equal(dialogControls.Start.isEnabled, true);
                assert.equal(dialogControls.Start.isFullWidth, true,
                    'Start should span the dialog content width');
                dialogControls.Start.onClickHandler();
                assert.ok(written && reportWritten, 'Start should run the export and save its report');
                assert.match(dialogControls['Status'].text, /Export complete/);
                assert.equal(dialogControls['IDML file'].text,
                    'C:\\Desktop\\IDML Exports\\Sample IDML export 2\\Sample.idml');
                assert.equal(dialogControls['Export folder'].text, 'C:\\Desktop\\IDML Exports\\Sample IDML export 2');
                assert.match(dialogControls['Summary'].text, /1 pages.*0 separate images.*0 rasterized artwork objects/);
                assert.equal(dialogControls['Diagnostics report'], undefined);
                assert.equal(dialogControls['Report contents'], undefined);
                assert.equal(dialogControls['Object inventory'], undefined);
                assert.equal(dialogGroups['Ready to export'].isVisible, false);
                assert.equal(dialogGroups['Export result'].isVisible, true);
                assert.equal(dialogControls['Open IDML in Affinity'].isVisible, true);
                assert.equal(dialogControls['Open IDML in Affinity'].isFullWidth, true,
                    'Open IDML should span the dialog content width');
                dialogControls['Open IDML in Affinity'].onClickHandler();
            },
        }); } } };
        if (id === '/application') return { app: { userDesktopPath: 'C:\\Desktop', alert: message => { alert = message; } } };
        if (id === '/document') return { Document: { current: doc, load(p) { openedPath = p; } },
            FileExportOptions: { createWithPresetName: () => ({}) },
            FileExportArea: { createForSelection: () => ({}) } };
        if (id === '/fs') return fileModule;
        if (id === '/buffer') return { Buffer: hostBuffer };
        if (id === '/rasterobject') return { PixelBuffer: {}, RasterFormat: {}, Bitmap: {} };
        if (id === '/selections') return { Selection: { create: () => ({}) } };
        if (id === '/fills') return { FillDescriptor: function () {} };
        if (id === '/colours') return { Colour: function () {} };
        if (id === 'affinity:story') return fontApi;
        if (id === 'affinity:fonts') return { FontApi: fontApi.FontApi };
        throw new Error('Unexpected module: ' + id);
    },
    console: { log() {} },
});
assert.ok(dialogShown && written && reportWritten && written.length > 100);
assert.equal(dialogConfig.initialWidth, 320, 'the dialog should use half its previous width');
assert.equal(openedPath, 'C:\\Desktop/IDML Exports/Sample IDML export 2/Sample.idml');
assert.equal(folders.size, 3);
process.stdout.write('Affinity VM export path passed\n');
