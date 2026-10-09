'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(path.join(__dirname, '..', 'finished scripts', 'Export to IDML v1.15.0.js'), 'utf8');
let api;
vm.runInNewContext(source, {
    __IDML_TEST_HOOK__: exported => { api = exported; },
    console,
});
assert.ok(api, 'test hook did not expose the package builder');
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
    [Symbol.toStringTag]: 'ShapeNode' };
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
const pageImage = { parent: { isGroupNode: true, parent: pageNode } };
assert.equal(api.imageClip(pageImage, 1, () => [{ closed: true }]), null);
const imageParent = { isImageNode: true, parent: outerLayer,
    getSpreadBaseBox: () => ({ x: 5, y: 10, width: 80, height: 60 }) };
const imageInsideImage = api.imageClip({ parent: { isGroupNode: true,
    parent: imageParent } }, 0.5);
assert.equal(imageInsideImage.clipKind, 'imageBounds');
assert.equal(imageInsideImage.clipPaths[0].points[2].anchor.x, 40);
assert.equal(imageInsideImage.clipPaths[0].points[2].anchor.y, 30);
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
const hybridText = { diagnostics: { dpi: 192 }, spreads: [{ frames: [{
    artText: true, width: 100, height: 20,
    runs: [{ style: { family: 'Gotham', pointSize: 14.25, leading: 15 } }],
    paragraphCharacterStyles: [], paragraphs: [{ leading: 12 }],
}] }] };
api.applyHybridTextMetrics(hybridText);
assert.equal(hybridText.spreads[0].frames[0].width, 200);
assert.equal(hybridText.spreads[0].frames[0].height, 40);
assert.equal(hybridText.spreads[0].frames[0].runs[0].style.pointSize, 38);
assert.equal(hybridText.spreads[0].frames[0].paragraphs[0].leading, 32);
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
    'C:\\Desktop/test IDML export 2');

const py = [
    'import io, sys, zipfile, xml.etree.ElementTree as ET',
    'z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))',
    'names = z.namelist()',
    'assert names[0] == "mimetype"',
    'assert z.getinfo("mimetype").compress_type == zipfile.ZIP_STORED',
    'assert z.read("mimetype") == b"application/vnd.adobe.indesign-idml-package"',
    'assert len([n for n in names if n.startswith("Spreads/")]) == 2',
    'assert len([n for n in names if n.startswith("Stories/")]) == 1',
    'assert "Resources/Fonts.xml" in names',
    'assert "Resources/Graphic.xml" in names',
    'assert "Resources/Preferences.xml" in names',
    'for n in names:',
    '    if n.endswith(".xml"): ET.fromstring(z.read(n))',
    'manifest = ET.fromstring(z.read("designmap.xml"))',
    'assert manifest.attrib["StoryList"] == "story1"',
    'assert manifest.attrib["CMYKProfile"] == "ISO Coated v2 300% (basICColor)"',
    'story = z.read("Stories/Story_story1.xml").decode("utf-8")',
    'assert "Árvíztűrő &amp; &lt;tükör&gt;" in story',
    'assert "Második sor 😀" in story',
    'assert "FontStyle=" + chr(34) + "Bold" + chr(34) in story',
    'assert "PointSize=" + chr(34) + "14" + chr(34) in story',
    'assert story.count("<Br/>") == 1',
    'assert "Hyphenation=" + chr(34) + "false" + chr(34) in story',
    'assert "SpaceAfter=" + chr(34) + "10" + chr(34) in story',
    'assert "SpaceBefore=" + chr(34) + "3" + chr(34) in story',
    'assert "AutoLeading=" + chr(34) + "135" + chr(34) in story',
    'assert story.count("<AppliedFont type=" + chr(34) + "string" + chr(34) + ">Arial</AppliedFont>") == 3',
    'assert "PointSize=" + chr(34) + "17" + chr(34) in story',
    'assert story.endswith("<Content></Content></CharacterStyleRange></ParagraphStyleRange></Story></idPkg:Story>")',
    'fonts = ET.fromstring(z.read("Resources/Fonts.xml"))',
    'assert [f.attrib["FontStyleName"] for f in fonts.iter("Font")] == ["Regular", "Bold"]',
    'assert "Resources/Fonts.xml" in z.read("designmap.xml").decode("utf-8")',
    'assert "Resources/Preferences.xml" in z.read("designmap.xml").decode("utf-8")',
    'prefs = ET.fromstring(z.read("Resources/Preferences.xml"))',
    'assert prefs.find("DocumentPreference").attrib["DocumentBleedTopOffset"] == "8.5"',
    'assert prefs.find("ViewPreference").attrib["HorizontalMeasurementUnits"] == "Millimeters"',
    'assert prefs.find("DocumentPreference").attrib["DocumentBleedUniformSize"] == "true"',
    'assert ET.fromstring(z.read("Spreads/Spread_spread1.xml"))[0].find("Page/MarginPreference").attrib["Top"] == "42"',
    'assert len(ET.fromstring(z.read("Spreads/Spread_spread1.xml"))[0].findall("TextFrame")) == 1',
    'spread = z.read("Spreads/Spread_spread1.xml").decode("utf-8")',
    'assert "<Polygon Self=" in spread and "<Image Self=" in spread',
    'assert "<Polygon Self=\\"picture1\\"" in spread',
    'assert spread.count("Visible=\\"false\\"") == 2',
    'assert "Color/idml1" in z.read("Resources/Graphic.xml").decode("utf-8")',
    'import base64, re',
    'png = base64.b64decode(re.search(r"<Contents>([^<]+)</Contents>", spread).group(1))',
    'assert png[:8] == bytes([137,80,78,71,13,10,26,10])',
    'print("ZIP, UCF, XML and Unicode passed")',
].join('\n');
const result = spawnSync('python', ['-c', py], { input: Buffer.from(packageBytes), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
process.stdout.write(result.stdout);

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
        getDoubleValue: (a, kind) => kind === 3 ? -1 :
            kind === 2 ? (a.face === 'Bold' ? 0.1 : 0) :
            (a.face === 'Regular' ? 24 : 28),
    },
    GlyphAttDoubleType: { Height: 1, ManualKerning: 2, AutoKernMinHeight: 3 },
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
assert.match(api.makeParts(read).find(p => p.name.startsWith('Stories/')).content,
    /KerningMethod="\$ID\/None" KerningValue="100"/);
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
        if (id === '/document') return { Document: { current: doc } };
        if (id === '/fs') return fileModule;
        if (id === '/buffer') return { Buffer: hostBuffer };
        if (id === '/rasterobject') return { PixelBuffer: {}, RasterFormat: {} };
        if (id === '/fills') return { FillDescriptor: function () {} };
        if (id === '/colours') return { Colour: function () {} };
        if (id === 'affinity:story') return fontApi;
        if (id === 'affinity:fonts') return { FontApi: fontApi.FontApi };
        throw new Error('Unexpected module: ' + id);
    },
    console: { log(message) { output += message; } },
});
assert.ok(written && written.length > 100);
assert.ok(reportWritten && reportWritten.length > 100);
assert.deepEqual(Array.from(folders), ['C:\\Desktop/Sample IDML export']);
assert.ok(createdFiles.every(p => p.startsWith('C:\\Desktop/Sample IDML export/')));
const report = JSON.parse(Buffer.from(reportWritten).toString('utf8'));
assert.equal(report.summary.approximated, 1);
assert.equal(report.pages[0].objects[0].idmlId, 'frame1');
assert.equal(report.pages[0].objects[0].propertyAudit['paragraph.spaceAfter'].state, 'exported');
assert.match(output, /editable text frames: 1/);
assert.match(output, /font faces: 2, unresolved text runs: 0/);
written = null;
reportWritten = null;
const dialogControls = {};
let dialogShown = false;
let openedPath = null;
vm.runInNewContext(source, {
    __IDML_SKIP_PREVIEWS__: true,
    require(id) {
        if (id === '/dialog') return { Dialog: { create() { return {
            addColumn() { return { addGroup() { return {
                addStaticText(label, initial) {
                    const control = { text: initial };
                    dialogControls[label] = control;
                    return control;
                },
                addTextBox(label, initial) {
                    const control = { text: initial };
                    dialogControls[label] = control;
                    return control;
                },
                addButton(label) {
                    const button = { isEnabled: true, onClickHandler: null };
                    dialogControls[label] = button;
                    return button;
                },
            }; } }; },
            runModal() {
                dialogShown = true;
                assert.ok(written && reportWritten, 'export and report should finish before the result dialog');
                assert.match(dialogControls['Status'].text, /Export complete/);
                assert.equal(dialogControls['Full file path'].text,
                    'C:\\Desktop\\Sample IDML export 2\\Sample.idml');
                assert.equal(dialogControls['Diagnostics report'].text,
                    'C:\\Desktop\\Sample IDML export 2\\Sample.diagnostics.json');
                assert.equal(dialogControls['Export folder'].text, 'C:\\Desktop\\Sample IDML export 2');
                dialogControls['Open IDML in Affinity'].onClickHandler();
            },
        }; } } };
        if (id === '/application') return { app: { userDesktopPath: 'C:\\Desktop', alert: message => { alert = message; } } };
        if (id === '/document') return { Document: { current: doc, load(p) { openedPath = p; } } };
        if (id === '/fs') return fileModule;
        if (id === '/buffer') return { Buffer: hostBuffer };
        if (id === '/rasterobject') return { PixelBuffer: {}, RasterFormat: {} };
        if (id === '/fills') return { FillDescriptor: function () {} };
        if (id === '/colours') return { Colour: function () {} };
        if (id === 'affinity:story') return fontApi;
        if (id === 'affinity:fonts') return { FontApi: fontApi.FontApi };
        throw new Error('Unexpected module: ' + id);
    },
    console: { log() {} },
});
assert.ok(dialogShown && written && reportWritten && written.length > 100);
assert.equal(openedPath, 'C:\\Desktop/Sample IDML export 2/Sample.idml');
assert.equal(folders.size, 2);
process.stdout.write('Affinity VM export path passed\n');
