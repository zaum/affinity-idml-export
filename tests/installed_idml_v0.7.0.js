/*
Script Name: Export to IDML
Description: Exports multi-page Affinity documents to IDML, including editable text with font sizes, paragraph breaks, hyphenation and spacing, embedded images, vectors, page size and bleed.
Preview image: Add a 16:9 preview image before publishing.
Version: 0.7.0
version: 0.7.0
Author: zaum
Contact: https://github.com/zaum
Sources:
- Adobe IDML File Format Specification (attribute names, units and package structure):
  https://community.adobe.com/havfw69955/attachments/havfw69955/indesign/632652/1/idml-specification.pdf
- Adobe InDesign UXP DOM, Character Style (kerning and text attributes):
  https://developer.adobe.com/indesign/uxp/dom/api/c/character-style/
- Affinity Character panel help (automatic and manual kerning):
  https://s3-eu-west-1.amazonaws.com/affinity-docs/help/designer/en-US.lproj/pages/Panels/characterPanel.html
- Local Affinity scripting API wrappers used by this script:
  workspace/docs/glyphatts.js and workspace/docs/paragraphatts.js
Code:
*/

'use strict';

(function () {
    const MIME = 'application/vnd.adobe.indesign-idml-package';
    const NS = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
    const DOM_VERSION = '8.0';

    function xml(value) {
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function number(value) {
        if (!Number.isFinite(value)) throw new Error('Invalid page or text-frame coordinate.');
        return String(Math.round(value * 1000) / 1000);
    }

    function utf8(input) {
        const str = String(input);
        let size = 0;
        for (let i = 0; i < str.length; i++) {
            const cp = str.codePointAt(i);
            size += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
            if (cp > 0xffff) i++;
        }
        const out = new Uint8Array(size);
        let at = 0;
        for (let i = 0; i < str.length; i++) {
            let cp = str.charCodeAt(i);
            if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
                const low = str.charCodeAt(i + 1);
                if (low >= 0xdc00 && low <= 0xdfff) {
                    cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
                    i++;
                }
            }
            if (cp < 0x80) out[at++] = cp;
            else if (cp < 0x800) { out[at++] = 0xc0 | (cp >> 6); out[at++] = 0x80 | (cp & 63); }
            else if (cp < 0x10000) { out[at++] = 0xe0 | (cp >> 12); out[at++] = 0x80 | ((cp >> 6) & 63); out[at++] = 0x80 | (cp & 63); }
            else { out[at++] = 0xf0 | (cp >> 18); out[at++] = 0x80 | ((cp >> 12) & 63);
                out[at++] = 0x80 | ((cp >> 6) & 63); out[at++] = 0x80 | (cp & 63); }
        }
        return out;
    }

    const crcTable = (function () {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let c = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function zipStore(parts) {
        // UCF requires the first entry, mimetype, to be stored uncompressed.
        const entries = parts.map(part => ({ name: utf8(part.name), body:
            part.content instanceof Uint8Array ? part.content : utf8(part.content) }));
        if (entries.length > 65535) throw new Error('Too many IDML parts.');
        let localSize = 0, centralSize = 0;
        for (const e of entries) {
            if (e.name.length > 65535) throw new Error('IDML part name is too long.');
            localSize += 30 + e.name.length + e.body.length;
            centralSize += 46 + e.name.length;
        }
        if (localSize + centralSize + 22 > 0xffffffff) throw new Error('IDML exceeds the ZIP32 size limit.');
        const out = new Uint8Array(localSize + centralSize + 22);
        const view = new DataView(out.buffer);
        const u16 = (p, v) => view.setUint16(p, v, true);
        const u32 = (p, v) => view.setUint32(p, v >>> 0, true);
        let localAt = 0, centralAt = localSize;
        for (const e of entries) {
            const crc = crc32(e.body), start = localAt;
            u32(localAt, 0x04034b50); u16(localAt + 4, 20); u16(localAt + 6, 0x0800);
            u32(localAt + 14, crc); u32(localAt + 18, e.body.length); u32(localAt + 22, e.body.length);
            u16(localAt + 26, e.name.length);
            out.set(e.name, localAt + 30); out.set(e.body, localAt + 30 + e.name.length);
            localAt += 30 + e.name.length + e.body.length;
            u32(centralAt, 0x02014b50); u16(centralAt + 4, 20); u16(centralAt + 6, 20);
            u16(centralAt + 8, 0x0800); u32(centralAt + 16, crc);
            u32(centralAt + 20, e.body.length); u32(centralAt + 24, e.body.length);
            u16(centralAt + 28, e.name.length); u32(centralAt + 42, start);
            out.set(e.name, centralAt + 46); centralAt += 46 + e.name.length;
        }
        u32(centralAt, 0x06054b50); u16(centralAt + 8, entries.length);
        u16(centralAt + 10, entries.length); u32(centralAt + 12, centralSize);
        u32(centralAt + 16, localSize);
        return out;
    }

    function crc32Pieces(pieces) {
        let c = 0xffffffff;
        for (const bytes of pieces)
            for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function pngRgba(width, height, rgba) {
        if (rgba.length !== width * height * 4) throw new Error('Invalid RGBA image buffer.');
        const stride = width * 4, raw = new Uint8Array((stride + 1) * height);
        for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
        const blocks = Math.ceil(raw.length / 65535);
        const z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
        z[0] = 0x78; z[1] = 0x01;
        let at = 2, source = 0, a = 1, b = 0;
        while (source < raw.length) {
            const length = Math.min(65535, raw.length - source);
            z[at++] = source + length === raw.length ? 1 : 0;
            z[at++] = length & 255; z[at++] = length >>> 8;
            z[at++] = (~length) & 255; z[at++] = ((~length) >>> 8) & 255;
            z.set(raw.subarray(source, source + length), at);
            for (let i = source; i < source + length; i++) { a += raw[i]; b += a; }
            a %= 65521; b %= 65521;
            at += length; source += length;
        }
        z[at++] = b >>> 8; z[at++] = b & 255; z[at++] = a >>> 8; z[at++] = a & 255;
        const png = new Uint8Array(8 + 25 + 12 + z.length + 12);
        png.set([137,80,78,71,13,10,26,10], 0);
        const view = new DataView(png.buffer);
        let p = 8;
        function chunk(name, data) {
            view.setUint32(p, data.length, false); p += 4;
            const type = utf8(name); png.set(type, p); p += 4;
            png.set(data, p); p += data.length;
            view.setUint32(p, crc32Pieces([type, data]), false); p += 4;
        }
        const ihdr = new Uint8Array(13), h = new DataView(ihdr.buffer);
        h.setUint32(0, width, false); h.setUint32(4, height, false);
        ihdr[8] = 8; ihdr[9] = 6;
        chunk('IHDR', ihdr); chunk('IDAT', z); chunk('IEND', new Uint8Array(0));
        return png;
    }

    function base64(bytes) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const chunks = [];
        for (let start = 0; start < bytes.length; start += 24576) {
            const end = Math.min(bytes.length, start + 24576), chars = [];
            for (let i = start; i < end; i += 3) {
                const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0;
                const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
                chars.push(alphabet[a >>> 2], alphabet[((a & 3) << 4) | (b >>> 4)],
                    i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >>> 6)] : '=',
                    i + 2 < bytes.length ? alphabet[c & 63] : '=');
            }
            chunks.push(chars.join(''));
        }
        return chunks.join('');
    }

    function framePath(frame) {
        const left = number(frame.x), top = number(frame.y);
        const right = number(frame.x + frame.width);
        const bottom = number(frame.y + frame.height);
        const points = [[left, top], [left, bottom], [right, bottom], [right, top]];
        return '<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>' +
            points.map(p => {
                const xy = p[0] + ' ' + p[1];
                return '<PathPointType Anchor="' + xy + '" LeftDirection="' + xy +
                    '" RightDirection="' + xy + '"/>';
            }).join('') +
            '</PathPointArray></GeometryPathType></PathGeometry></Properties>';
    }

    function pathXml(paths) {
        return '<Properties><PathGeometry>' + paths.map(path =>
            '<GeometryPathType PathOpen="' + (!path.closed) + '"><PathPointArray>' +
            path.points.map(p => '<PathPointType Anchor="' + number(p.anchor.x) + ' ' + number(p.anchor.y) +
                '" LeftDirection="' + number(p.left.x) + ' ' + number(p.left.y) +
                '" RightDirection="' + number(p.right.x) + ' ' + number(p.right.y) + '"/>').join('') +
            '</PathPointArray></GeometryPathType>').join('') + '</PathGeometry></Properties>';
    }

    function colourKey(c) {
        return [c.space].concat(c.values).join('|');
    }

    function colourFromColour(colour) {
        try {
            const v = colour.cmyka8;
            if (v) return { space: 'CMYK', values: [v.c, v.m, v.y, v.k].map(n =>
                Math.round(n * 1000 / 255) / 10), alpha: v.alpha / 255 };
        } catch (_) {}
        try {
            const v = colour.rgba8;
            if (v) return { space: 'RGB', values: [v.r, v.g, v.b], alpha: v.alpha / 255 };
        } catch (_) {}
        return null;
    }

    function colourFromFill(fill) {
        return fill && fill[Symbol.toStringTag] === 'SolidFill' ? colourFromColour(fill.colour) : null;
    }

    function gradientFromFill(fill, Colour) {
        if (!fill || fill[Symbol.toStringTag] !== 'GradientFill' || !Colour) return null;
        try {
            const stops = fill.gradient.stops.map(stop => ({
                position: Number(stop.position), midpoint: Number(stop.midpoint),
                colour: colourFromColour(new Colour(stop.colour))
            }));
            if (stops.length < 2 || stops.some(stop => !stop.colour)) return null;
            const t = fill.gradientFillType;
            return { type: 'gradient', kind: (t && (t.value === 1 || t === 1)) ? 'Radial' : 'Linear', stops };
        } catch (_) { return null; }
    }

    function makePalette(model) {
        const colours = [], gradients = [], ids = new Map();
        function register(c) {
            if (!c) return null;
            if (c.type === 'gradient') {
                const key = JSON.stringify(c);
                if (!ids.has(key)) {
                    const id = 'Gradient/idml' + (gradients.length + 1);
                    ids.set(key, id);
                    gradients.push({ id, kind: c.kind, stops: c.stops.map(stop => ({
                        position: stop.position, midpoint: stop.midpoint,
                        colourId: register(stop.colour)
                    })) });
                }
                return ids.get(key);
            }
            const key = colourKey(c);
            if (!ids.has(key)) { const id = 'Color/idml' + (colours.length + 1);
                ids.set(key, id); colours.push({ id, colour: c }); }
            return ids.get(key);
        }
        for (const spread of model.spreads) {
            for (const obj of spread.objects) {
                obj.fillId = register(obj.fill);
                obj.strokeId = register(obj.stroke);
            }
            for (const frame of spread.frames)
                for (const run of frame.runs) if (run.style) run.style.fillId = register(run.style.fill);
        }
        return { colours, gradients };
    }

    function graphicXml(palette) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Graphic xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            palette.colours.map(({ id, colour }) => '<Color Self="' + id + '" Name="' + id.slice(6) +
                '" Model="Process" Space="' + colour.space + '" ColorValue="' +
                colour.values.map(number).join(' ') + '" ColorEditable="true" ColorRemovable="true"/>').join('') +
            palette.gradients.map(g => '<Gradient Self="' + g.id + '" Name="' + g.id.slice(9) +
                '" Type="' + g.kind + '">' + g.stops.map((stop, i) =>
                '<GradientStop Self="' + g.id + '/stop' + i + '" StopColor="' + stop.colourId +
                '" Location="' + number(stop.position * 100) + '" Midpoint="' +
                number(stop.midpoint * 100) + '"/>').join('') + '</Gradient>').join('') +
            '</idPkg:Graphic>';
    }

    function polygonXml(obj) {
        return '<Polygon Self="' + obj.id + '" ItemLayer="layer1" ItemTransform="1 0 0 1 0 0"' +
            ' FillColor="' + (obj.fillId || 'Swatch/None') + '" StrokeColor="' +
            (obj.strokeId || 'Swatch/None') + '" StrokeWeight="' + number(obj.strokeWeight || 0) + '"' +
            (obj.stroke && obj.stroke.type === 'gradient' ? ' GradientStrokeAngle="' +
                number(obj.strokeAngle || 0) + '"' : '') + '>' +
            pathXml(obj.paths) + '</Polygon>';
    }

    function imageXml(obj) {
        const x = number(obj.x), y = number(obj.y);
        const m = obj.matrix;
        const transform = [m[0], m[3], m[1], m[4], m[2] - obj.x, m[5] - obj.y]
            .map(number).join(' ');
        return '<Rectangle Self="' + obj.id + '" ItemLayer="' + (obj.layer || 'layer1') +
            '" ItemTransform="1 0 0 1 ' +
            x + ' ' + y + '" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
            framePath({ x: 0, y: 0, width: obj.width, height: obj.height }) +
            '<Image Self="image' + obj.id + '" ItemTransform="' + transform + '"><Properties>' +
            '<GraphicBounds Left="0" Top="0" Right="' + obj.pixelWidth + '" Bottom="' +
            obj.pixelHeight + '"/><Contents>' + obj.contents + '</Contents></Properties></Image></Rectangle>';
    }

    function fontKey(style) {
        return [style.family, style.face, style.postscript].join('\u0000');
    }

    function textParagraphs(runs) {
        const paragraphs = [[]];
        for (const run of runs) {
            const pieces = run.text.replace(/\r\n?/g, '\n').split('\n');
            for (let i = 0; i < pieces.length; i++) {
                if (i) paragraphs.push([]);
                if (pieces[i]) paragraphs[paragraphs.length - 1].push({ text: pieces[i], style: run.style });
            }
        }
        return paragraphs;
    }

    function storyXml(frame) {
        const paragraphs = textParagraphs(frame.runs);
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Story xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            '<Story Self="' + frame.storyId + '" UserText="true" StoryTitle="$ID/">' +
            '<StoryPreference FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>' +
            paragraphs.map((p, paragraphIndex) => {
                const settings = frame.paragraphs && frame.paragraphs[paragraphIndex];
                const paragraphAttrs = settings ? Object.keys(settings).map(key => {
                    const name = { hyphenation:'Hyphenation',spaceBefore:'SpaceBefore',spaceAfter:'SpaceAfter',
                        autoLeading:'AutoLeading',justification:'Justification',leftIndent:'LeftIndent',
                        rightIndent:'RightIndent',firstLineIndent:'FirstLineIndent',minimumWordSpacing:'MinimumWordSpacing',
                        desiredWordSpacing:'DesiredWordSpacing',maximumWordSpacing:'MaximumWordSpacing',
                        minimumLetterSpacing:'MinimumLetterSpacing',desiredLetterSpacing:'DesiredLetterSpacing',
                        maximumLetterSpacing:'MaximumLetterSpacing',hyphenateWordsLongerThan:'HyphenateWordsLongerThan',
                        hyphenateAfterFirst:'HyphenateAfterFirst',hyphenateBeforeLast:'HyphenateBeforeLast',
                        hyphenateLadderLimit:'HyphenateLadderLimit',hyphenationZone:'HyphenationZone',
                        keepWithNext:'KeepWithNext',keepAllLinesTogether:'KeepAllLinesTogether',
                        keepWithPrevious:'KeepWithPrevious',alignToBaselineGrid:'AlignToBaselineGrid' }[key];
                    return name && settings[key] != null ? ' ' + name + '="' + xml(settings[key]) + '"' : '';
                }).join('') : '';
                const pieces = p.length ? p : [{ text: '', style: null }];
                return '<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"' +
                    paragraphAttrs + '>' + pieces.map((run, runIndex) => {
                    const s = run.style;
                    const attrs = s ? ' FontStyle="' + xml(s.face) + '"' +
                        (s.pointSize > 0 ? ' PointSize="' + number(s.pointSize) + '"' : '') +
                        (s.fillId ? ' FillColor="' + s.fillId + '"' : '') +
                        ['tracking','kerningValue','horizontalScale','verticalScale','skew','baselineShift',
                            'noBreak','capitalization','position','underline','strikeThru','leading'].map(key => {
                            const name = key[0].toUpperCase() + key.slice(1);
                            return s[key] == null ? '' : ' ' + name + '="' + xml(s[key]) + '"';
                        }).join('') : '';
                    const font = s ? '<Properties><AppliedFont type="string">' + xml(s.family) +
                        '</AppliedFont></Properties>' : '';
                    return '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"' +
                        attrs + '>' + font + '<Content>' + xml(run.text) + '</Content>' +
                        (paragraphIndex < paragraphs.length - 1 && runIndex === pieces.length - 1 ? '<Br/>' : '') +
                        '</CharacterStyleRange>';
                }).join('') + '</ParagraphStyleRange>';
            }).join('') +
            '</Story></idPkg:Story>';
    }

    function fontsXml(fonts) {
        const families = [];
        for (const font of fonts) {
            let family = families.find(f => f.name === font.family);
            if (!family) { family = { name: font.family, fonts: [] }; families.push(family); }
            family.fonts.push(font);
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Fonts xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            families.map((family, i) => '<FontFamily Self="fontFamily' + (i + 1) + '" Name="' +
                xml(family.name) + '">' + family.fonts.map((font, j) => {
                    const full = font.family + (font.face === 'Regular' ? '' : ' ' + font.face);
                    return '<Font Self="font' + (i + 1) + '_' + (j + 1) + '" FontFamily="' +
                        xml(font.family) + '" Name="' + xml(full) + '" PostScriptName="' +
                        xml(font.postscript || full.replace(/\s+/g, '-')) + '" Status="Installed"' +
                        ' FontStyleName="' + xml(font.face) + '"' +
                        ' WritingScript="0" FullName="' + xml(full) + '"/>';
                }).join('') + '</FontFamily>').join('') + '</idPkg:Fonts>';
    }

    function spreadXml(spread) {
        const p = spread.page;
        const page = '<Page Self="' + p.id + '" Name="' + p.number + '" GeometricBounds="0 0 ' +
            number(p.height) + ' ' + number(p.width) + '" ItemTransform="1 0 0 1 0 0">' +
            (p.margin == null ? '' : '<MarginPreference Top="' + number(p.margin) + '" Bottom="' +
                number(p.margin) + '" Left="' + number(p.margin) + '" Right="' +
                number(p.margin) + '" ColumnCount="1"/>') + '</Page>';
        const frames = spread.frames.map(f => '<TextFrame Self="' + f.id + '" ParentStory="' +
            f.storyId + '" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType"' +
            ' AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"' +
            ' ItemTransform="1 0 0 1 0 0" ItemLayer="layer1">' +
            framePath(f) + '</TextFrame>').join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Spread xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            '<Spread Self="' + spread.id + '" PageCount="1" BindingLocation="0" ItemTransform="1 0 0 1 0 0">' +
            page + spread.objects.map(obj => obj.kind === 'image' ? imageXml(obj) : polygonXml(obj)).join('') +
            frames + (spread.preview ? imageXml(spread.preview) : '') + '</Spread></idPkg:Spread>';
    }

    function makeParts(model) {
        const palette = makePalette(model);
        const storyIds = [];
        const parts = [{ name: 'mimetype', content: MIME }, {
            name: 'META-INF/container.xml',
            content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
                '<rootfiles><rootfile full-path="designmap.xml" media-type="' + MIME +
                '"/></rootfiles></container>'
        }];
        let refs = '';
        for (const spread of model.spreads) {
            refs += '<idPkg:Spread src="Spreads/Spread_' + spread.id + '.xml"/>';
            parts.push({ name: 'Spreads/Spread_' + spread.id + '.xml', content: spreadXml(spread) });
            for (const frame of spread.frames) {
                storyIds.push(frame.storyId);
                parts.push({ name: 'Stories/Story_' + frame.storyId + '.xml', content: storyXml(frame) });
            }
        }
        const stories = storyIds.map(id => '<idPkg:Story src="Stories/Story_' + id + '.xml"/>').join('');
        const fonts = [];
        const seenFonts = new Set();
        for (const spread of model.spreads) for (const frame of spread.frames) for (const run of frame.runs) {
            if (!run.style) continue;
            const key = fontKey(run.style);
            if (seenFonts.has(key)) continue;
            seenFonts.add(key);
            fonts.push(run.style);
        }
        parts.push({ name: 'Resources/Fonts.xml', content: fontsXml(fonts) });
        parts.push({ name: 'Resources/Graphic.xml', content: graphicXml(palette) });
        const first = model.spreads[0].page;
        const bleed = first.bleed;
        const preferences = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Preferences xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            '<DocumentPreference PageWidth="' + number(first.width) + '" PageHeight="' +
            number(first.height) + '" PagesPerDocument="' + model.spreads.length +
            '" FacingPages="false" PageOrientation="' +
            (first.width > first.height ? 'Landscape' : 'Portrait') + '"' +
            (bleed ? ' DocumentBleedTopOffset="' + number(bleed.top) +
                '" DocumentBleedBottomOffset="' + number(bleed.bottom) +
                '" DocumentBleedInsideOrLeftOffset="' + number(bleed.left) +
                '" DocumentBleedOutsideOrRightOffset="' + number(bleed.right) +
                '" DocumentBleedUniformSize="' +
                (Math.abs(bleed.top - bleed.bottom) < 1e-6 &&
                 Math.abs(bleed.top - bleed.left) < 1e-6 &&
                 Math.abs(bleed.top - bleed.right) < 1e-6 ? 'true' : 'false') + '"' : '') +
            '/></idPkg:Preferences>';
        parts.push({ name: 'Resources/Preferences.xml', content: preferences });
        const designmap = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<?aid style="50" type="document" readerVersion="6.0" featureSet="257"?>' +
            '<Document xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION +
            '" Self="d" Name="' + xml(model.name) + '" StoryList="' + storyIds.join(' ') +
            '" ActiveLayer="layer1" ZeroPoint="0 0">' +
            '<Layer Self="layer1" Name="Editable Affinity objects" Visible="true" Locked="false" Printable="true"/>' +
            (model.spreads.some(s => s.preview) ?
                '<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="true" Locked="false" Printable="true"/>' : '') +
            '<idPkg:Fonts src="Resources/Fonts.xml"/><idPkg:Graphic src="Resources/Graphic.xml"/>' +
            '<idPkg:Preferences src="Resources/Preferences.xml"/>' +
            refs + stories + '</Document>';
        parts.push({ name: 'designmap.xml', content: designmap });
        return parts;
    }

    function readFrameText(node, pt, fontApi) {
        const story = node.story;
        let range = node.storyRange;
        if (!range || !Number.isFinite(range.begin) || !Number.isFinite(range.end))
            range = { begin: 0, end: story.length };
        const runs = [];
        const paragraphs = [];
        let paragraphStart = range.begin;
        function doubleValue(api, handle, kind, key, factor) {
            try {
                if (!kind || kind[key] == null) return null;
                const value = Number(api.getDoubleValue(handle, kind[key]));
                return Number.isFinite(value) ? value * factor : null;
            } catch (_) { return null; }
        }
        function scalar(api, method, handle) {
            try { return typeof api[method] === 'function' ? api[method](handle) : null; }
            catch (_) { return null; }
        }
        function enumName(value) {
            if (value && typeof value === 'object') value = value.name == null ? value.value : value.name;
            return String(value == null ? '' : value).replace(/[^a-z]/gi, '').toLowerCase();
        }
        function paragraphAt(position) {
            if (typeof fontApi.StoryApi.getParagraphAtts !== 'function' ||
                !fontApi.ParagraphAttsApi || !fontApi.ParagraphAttDoubleType) return null;
            try {
                const handle = fontApi.StoryApi.getParagraphAtts(story.handle, position);
                const api = fontApi.ParagraphAttsApi, kind = fontApi.ParagraphAttDoubleType;
                const relative = Number(api.getDoubleValue(handle, kind.RelativeLeading));
                const align = enumName(scalar(api, 'getAlignXType', handle));
                const justification = {left:'LeftAlign',centre:'CenterAlign',center:'CenterAlign',
                    right:'RightAlign',justifyall:'FullyJustified',justifyleft:'LeftJustified',
                    justifycentre:'CenterJustified',justifycenter:'CenterJustified',
                    justifyright:'RightJustified'}[align];
                const out = {
                    hyphenation: api.getIsAutoHyphenate(handle) ? 'true' : 'false',
                    spaceBefore: Number(api.getDoubleValue(handle, kind.SpaceBefore)) * pt,
                    spaceAfter: Number(api.getDoubleValue(handle, kind.SpaceAfter)) * pt,
                    autoLeading: relative > 0 && Number.isFinite(relative) ? relative * 100 : null,
                    justification,
                    leftIndent:doubleValue(api,handle,kind,'LeftIndent',pt),
                    rightIndent:doubleValue(api,handle,kind,'RightIndent',pt),
                    firstLineIndent:doubleValue(api,handle,kind,'FirstLineIndent',pt),
                    minimumWordSpacing:doubleValue(api,handle,kind,'MinWordSpacing',100),
                    desiredWordSpacing:doubleValue(api,handle,kind,'DesiredWordSpacing',100),
                    maximumWordSpacing:doubleValue(api,handle,kind,'MaxWordSpacing',100),
                    minimumLetterSpacing:doubleValue(api,handle,kind,'MinLetterSpacing',100),
                    desiredLetterSpacing:doubleValue(api,handle,kind,'DesiredLetterSpacing',100),
                    maximumLetterSpacing:doubleValue(api,handle,kind,'MaxLetterSpacing',100),
                    hyphenateWordsLongerThan:scalar(api,'getHyphenateMinLength',handle),
                    hyphenateAfterFirst:scalar(api,'getHyphenateMinPrefix',handle),
                    hyphenateBeforeLast:scalar(api,'getHyphenateMinSuffix',handle),
                    hyphenateLadderLimit:scalar(api,'getMaxConsecutiveHyphens',handle),
                    hyphenationZone:doubleValue(api,handle,kind,'HyphenationZone',pt),
                    keepWithNext:scalar(api,'getKeepWithNext',handle),
                    keepAllLinesTogether:scalar(api,'getIsKeepTogether',handle),
                    keepWithPrevious:scalar(api,'getIsKeepWithPrevious',handle),
                    alignToBaselineGrid:scalar(api,'getAlignToBaselineGrid',handle)
                };
                return out;
            } catch (_) { return null; }
        }
        let unresolved = 0;
        for (let pos = range.begin; pos < range.end;) {
            let end = pos + 1;
            let style = null;
            try {
                const atts = fontApi.StoryApi.getGlyphAtts(story.handle, pos);
                const font = fontApi.GlyphAttsApi.getFont(atts);
                const family = String(fontApi.FontApi.getFamilyName(font) || '').trim();
                const face = String(fontApi.FontApi.getTraitsName(font) || 'Regular').trim() || 'Regular';
                if (family) {
                    let postscript = '';
                    try { postscript = String(fontApi.FontApi.getPostscriptName(font) || ''); } catch (_) {}
                    let pointSize = 0;
                    try {
                        const height = Number(fontApi.GlyphAttsApi.getDoubleValue(atts, fontApi.GlyphAttDoubleType.Height));
                        if (height > 0 && Number.isFinite(height)) pointSize = height * pt;
                    } catch (_) {}
                    style = { family, face, postscript, pointSize };
                    const ga = fontApi.GlyphAttsApi, kind = fontApi.GlyphAttDoubleType;
                    const spacing = doubleValue(ga,atts,kind,'CharacterSpacing',1);
                    if (spacing != null && pointSize > 0) style.tracking = spacing * pt * 1000 / pointSize;
                    // Affinity stores manual kerning as an em fraction; IDML uses 1/1000 em.
                    // A zero manual value leaves the native automatic kerning setting intact.
                    const manual = doubleValue(ga,atts,kind,'ManualKerning',1000);
                    if (manual) style.kerningValue = manual;
                    const sx = doubleValue(ga,atts,kind,'ScaleX',100);
                    const sy = doubleValue(ga,atts,kind,'ScaleY',100);
                    if (sx > 0) style.horizontalScale = sx;
                    if (sy > 0) style.verticalScale = sy;
                    const skew = doubleValue(ga,atts,kind,'ShearX',1);
                    if (skew) style.skew = skew;
                    const shift = doubleValue(ga,atts,kind,'OffsetY',pt);
                    if (shift) style.baselineShift = shift;
                    const noBreak = scalar(ga,'getIsNoBreak',atts);
                    if (noBreak != null) style.noBreak = !!noBreak;
                    const caps = enumName(scalar(ga,'getCapsType',atts));
                    style.capitalization = {normal:'Normal',allcaps:'AllCaps',smallcaps:'SmallCaps'}[caps];
                    const underline = enumName(scalar(ga,'getUnderlineType',atts));
                    if (underline) style.underline = underline !== 'none';
                    const strike = enumName(scalar(ga,'getStrikeoutType',atts));
                    if (strike) style.strikeThru = strike !== 'none';
                    if (fontApi.FillDescriptor && typeof fontApi.GlyphAttsApi.getBrushFill === 'function') {
                        try { style.fill = colourFromFill(new fontApi.FillDescriptor(
                            fontApi.GlyphAttsApi.getBrushFill(atts)).fill); } catch (_) {}
                    }
                }
                if (typeof fontApi.StoryApi.getGlyphAttsRunEnd === 'function') {
                    const runEnd = Number(fontApi.StoryApi.getGlyphAttsRunEnd(story.handle, pos, range.end));
                    if (runEnd > pos && runEnd <= range.end) end = runEnd;
                }
            } catch (_) { /* Keep text editable if a font cannot be read. */ }
            let text = '';
            for (let p = pos; p < end; p++) {
                if (story.isParagraphBreak(p)) {
                    // Affinity includes a final story terminator in storyRange.
                    // IDML supplies its own terminator, so only interior breaks are written.
                    if (p < range.end - 1) {
                        text += '\n';
                        paragraphs.push(paragraphAt(paragraphStart) || {});
                        paragraphStart = p + 1;
                    }
                    continue;
                }
                const glyph = story.getGlyph(p);
                if (glyph && glyph.isCharGlyph) text += glyph.string;
            }
            if (text) {
                if (!style) unresolved++;
                const prior = runs[runs.length - 1];
                if (prior && ((!style && !prior.style) ||
                    (style && prior.style && JSON.stringify(style) === JSON.stringify(prior.style)))) prior.text += text;
                else runs.push({ text, style });
            }
            pos = end;
        }
        paragraphs.push(paragraphAt(paragraphStart) || paragraphs[paragraphs.length - 1] || {});
        return { runs, paragraphs, unresolved };
    }

    function readVector(node, pt, origin, index, Colour) {
        const matrix = node.baseToSpreadTransform.data;
        function point(p) {
            return { x: ((matrix[0] * p.x + matrix[1] * p.y + matrix[2]) - origin.x) * pt,
                y: ((matrix[3] * p.x + matrix[4] * p.y + matrix[5]) - origin.y) * pt };
        }
        const paths = [];
        const poly = node.polyCurve;
        for (let ci = 0; ci < poly.curveCount; ci++) {
            const curve = poly.at(ci);
            if (curve.nodeCount < 4) continue;
            const points = [];
            let at = curve.firstOnCurvePointIndex;
            const last = curve.lastOnCurvePointIndex;
            for (let guard = 0; at < last && guard < 10000; guard++) {
                const segment = curve.getCubicBezier(at);
                const start = point(segment.start), c1 = point(segment.c1);
                const c2 = point(segment.c2), end = point(segment.end);
                if (!points.length) points.push({ anchor: start, left: start, right: c1 });
                else points[points.length - 1].right = c1;
                points.push({ anchor: end, left: c2, right: end });
                const next = curve.getNextOnCurvePointIndex(at, false);
                if (!(next > at)) break;
                at = next;
            }
            if (curve.isClosed && points.length > 1) {
                points[0].left = points[points.length - 1].left;
                points.pop();
            }
            if (points.length > 1) paths.push({ closed: curve.isClosed, points });
        }
        if (!paths.length) return null;
        let fill = null, stroke = null, strokeWeight = 0;
        try { fill = colourFromFill(node.brushFillDescriptor.fill); } catch (_) {}
        try {
            const weight = Number(node.lineWeight);
            if (weight > 0) {
                const descriptor = node.penFillDescriptor;
                stroke = colourFromFill(descriptor.fill) || gradientFromFill(descriptor.fill, Colour);
                if (stroke) strokeWeight = weight * pt;
            }
        } catch (_) {}
        if (!fill && !stroke) return null;
        return { kind: 'vector', id: 'vector' + index, paths, fill, stroke, strokeWeight };
    }

    function readImage(node, pt, origin, index, PixelBuffer, RasterFormat) {
        const box = node.getSpreadBaseBox(false);
        const width = Number(node.rasterWidth), height = Number(node.rasterHeight);
        if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions.');
        const pixels = PixelBuffer.create(width, height, RasterFormat.RGBA8);
        node.copyTo(pixels, { x: 0, y: 0, width, height }, 0, 0);
        const png = pngRgba(width, height, new Uint8Array(pixels.buffer));
        const matrix = Array.from(node.baseToSpreadTransform.data);
        matrix[0] *= pt; matrix[1] *= pt; matrix[2] = (matrix[2] - origin.x) * pt;
        matrix[3] *= pt; matrix[4] *= pt; matrix[5] = (matrix[5] - origin.y) * pt;
        return { kind: 'image', id: 'picture' + index, x: (box.x - origin.x) * pt,
            y: (box.y - origin.y) * pt, width: box.width * pt, height: box.height * pt,
            pixelWidth: width, pixelHeight: height, matrix, contents: base64(png) };
    }

    function addPagePreviews(doc, model, desktop, File, Buffer, FileSystemApi, exportApi) {
        const options = exportApi.FileExportOptions.createWithPresetName('PNG');
        const basename = String(doc.title || 'Affinity').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
        for (let i = 0; i < model.spreads.length; i++) {
            const requested = String(desktop).replace(/[\\/]+$/, '') + '/' + basename +
                ' IDML preview ' + (i + 1) + '.png';
            const records = doc.export(requested, options,
                exportApi.FileExportArea.createForPages(String(i + 1)));
            const record = records && records.all && records.all[0];
            if (!record || !record.isSuccess) throw new Error('Could not render page ' + (i + 1) + ' preview: ' +
                (record ? record.errorMessage : 'no export record'));
            const path = record.path;
            if (!path || !FileSystemApi.exists(path)) throw new Error('Preview image is missing: ' + path);
            const bytes = File.readAll(path).array;
            const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
            const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
            if (!(width > 0 && height > 0)) throw new Error('Could not read preview PNG dimensions.');
            const page = model.spreads[i].page;
            model.spreads[i].preview = { kind: 'image', layer: 'layerPreview',
                id: 'pagePreview' + (i + 1), x: 0, y: 0, width: page.width, height: page.height,
                pixelWidth: width, pixelHeight: height,
                matrix: [page.width / width, 0, 0, 0, page.height / height, 0],
                contents: base64(bytes) };
            try { require('affinity:fs').FileSystemApi.remove(path); } catch (_) {}
        }
    }

    function readModel(doc, fontApi, imageApi) {
        const dpi = Number(doc.dpi);
        if (!(dpi > 0)) throw new Error('Document DPI is not readable.');
        const pt = 72 / dpi;
        const model = { name: doc.title || 'Affinity document', spreads: [], skipped: 0,
            frames: 0, unresolved: 0, vectors: 0, images: 0 };
        for (const spread of doc.spreads) {
            if (spread.pageCount !== 1)
                throw new Error('Version 0.7.0 needs one page per spread. A facing-page spread was found.');
            const box = spread.getSpreadExtents({ includeSpread: true, includeBleed: false, includeChildren: false });
            const bleedBox = spread.getSpreadExtents({ includeSpread: true, includeBleed: true, includeChildren: false });
            if (!box || !(box.width > 0) || !(box.height > 0))
                throw new Error('Could not read the page dimensions.');
            const pageNumber = model.spreads.length + 1;
            const target = {
                id: 'spread' + pageNumber,
                page: { id: 'page' + pageNumber, number: pageNumber, width: box.width * pt, height: box.height * pt,
                    bleed: bleedBox ? {
                        left: (box.x - bleedBox.x) * pt, top: (box.y - bleedBox.y) * pt,
                        right: (bleedBox.x + bleedBox.width - box.x - box.width) * pt,
                        bottom: (bleedBox.y + bleedBox.height - box.y - box.height) * pt
                    } : null },
                frames: [], objects: []
            };
            for (const node of spread.layers.all) {
                if (node.isVisibleInExport === false || node.isGroupNode) continue;
                if (node.isFrameTextNode || node.isArtTextNode) {
                    const b = node.getSpreadBaseBox(false);
                    if (!b || !(b.width > 0) || !(b.height > 0)) { model.skipped++; continue; }
                    const index = ++model.frames;
                    const content = readFrameText(node, pt, fontApi);
                    model.unresolved += content.unresolved;
                    target.frames.push({
                        id: 'frame' + index, storyId: 'story' + index,
                        x: (b.x - box.x) * pt, y: (b.y - box.y) * pt,
                        width: b.width * pt, height: b.height * pt,
                        runs: content.runs, paragraphs: content.paragraphs
                    });
                } else if (node.isImageNode && imageApi) {
                    target.objects.push(readImage(node, pt, box, ++model.images,
                        imageApi.PixelBuffer, imageApi.RasterFormat));
                } else if (node.isShapeNode || node.isPolyCurveNode ||
                    (node.isVectorNode && !node.isImageNode)) {
                    try {
                        const vector = readVector(node, pt, box, model.vectors + 1, imageApi && imageApi.Colour);
                        if (vector) { target.objects.push(vector); model.vectors++; }
                        else model.skipped++;
                    } catch (_) { model.skipped++; }
                } else if (node.isPhysicalNode && !node.isSpreadNode) {
                    model.skipped++;
                }
            }
            model.spreads.push(target);
        }
        if (!model.spreads.length) throw new Error('The document has no exportable spreads.');
        const candidates = [];
        for (const spread of model.spreads) for (const frame of spread.frames)
            if (frame.x > 0 && frame.y > 0 && Math.abs(frame.x - frame.y) < 0.1)
                candidates.push(frame.x);
        if (candidates.length) {
            const margin = Math.min.apply(null, candidates);
            for (const spread of model.spreads) spread.page.margin = margin;
            model.marginInferred = true;
        }
        return model;
    }

    function writeBytes(path, bytes, File, Buffer) {
        const file = typeof File.create === 'function' ? File.create(path, 'wb') : new File(path, 'wb');
        try {
            const nativeBuffer = Buffer.create(bytes.length);
            nativeBuffer.array.set(bytes);
            const written = file.write(nativeBuffer, bytes.length);
            if (written !== bytes.length) throw new Error('Only ' + written + ' of ' + bytes.length + ' bytes were written.');
            file.flush();
        } finally {
            file.close();
        }
    }

    function choosePath(desktop, title, exists) {
        const base = String(title || 'Affinity document').replace(/\.[^.]+$/, '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'Affinity document';
        const folder = String(desktop).replace(/[\\/]+$/, '');
        for (let i = 0; i < 1000; i++) {
            const path = folder + '/' + base + (i ? ' ' + (i + 1) : '') + '.idml';
            if (!exists(path)) return path;
        }
        throw new Error('Could not find a free output filename on the Desktop.');
    }

    // The VM harness calls this hook to verify the package without an Affinity host.
    if (typeof globalThis.__IDML_TEST_HOOK__ === 'function') {
        globalThis.__IDML_TEST_HOOK__({ xml, utf8, zipStore, pngRgba, base64,
            makeParts, readModel, readVector, choosePath });
        return;
    }

    let app = null;
    try {
        app = require('/application').app;
        const { Document } = require('/document');
        const { FileExportOptions, FileExportArea } = require('/document');
        const { File, FileSystemApi } = require('/fs');
        const { Buffer } = require('/buffer');
        const { PixelBuffer, RasterFormat } = require('/rasterobject');
        const { FillDescriptor } = require('/fills');
        const { Colour } = require('/colours');
        const { StoryApi, GlyphAttsApi, GlyphAttDoubleType,
            ParagraphAttsApi, ParagraphAttDoubleType } = require('affinity:story');
        const { FontApi } = require('affinity:fonts');
        const doc = globalThis.__IDML_DOCUMENT_TITLE__
            ? Document.all.find(d => d.title === globalThis.__IDML_DOCUMENT_TITLE__) : Document.current;
        if (!doc) throw new Error('Open an Affinity document first.');
        const model = readModel(doc, { StoryApi, GlyphAttsApi, GlyphAttDoubleType,
            ParagraphAttsApi, ParagraphAttDoubleType, FontApi, FillDescriptor },
            { PixelBuffer, RasterFormat, Colour });
        const desktop = app.userDesktopPath ||
            (typeof app.getUserDesktopPath === 'function' ? app.getUserDesktopPath() : app.getUserDesktopPath);
        if (!desktop) throw new Error('Could not locate the Desktop output folder.');
        if (!globalThis.__IDML_SKIP_PREVIEWS__)
            addPagePreviews(doc, model, desktop, File, Buffer, FileSystemApi,
                { FileExportOptions, FileExportArea });
        const path = choosePath(desktop, doc.title,
            p => FileSystemApi.exists(p));
        writeBytes(path, zipStore(makeParts(model)), File, Buffer);
        const faces = new Set();
        for (const spread of model.spreads) for (const frame of spread.frames)
            for (const run of frame.runs) if (run.style) faces.add(fontKey(run.style));
        const message = 'IDML saved: ' + path + '\nPages: ' + model.spreads.length +
            ', editable text frames: ' + model.frames + ', vectors: ' + model.vectors +
            ', embedded images: ' + model.images + ', font faces: ' + faces.size +
            ', unresolved text runs: ' + model.unresolved + ', other objects omitted: ' + model.skipped +
            (model.marginInferred ? '\nMargins were inferred from text-frame positions; verify them.' : '') +
            '\nOpen it in InDesign and check layout before using it.';
        console.log(message);
        if (!globalThis.__IDML_SILENT__) app.alert(message);
    } catch (error) {
        const detail = String(error && error.message || error);
        const hint = /PERMISSION_DENIED/i.test(detail)
            ? '\nThis Affinity Scripts panel blocks file writes on this machine. Run the script through the MCP execute_script bridge.'
            : '';
        const message = 'IDML export failed: ' + detail + hint;
        console.log(message);
        if (!globalThis.__IDML_SILENT__ && app && typeof app.alert === 'function') app.alert(message);
    }
})();
