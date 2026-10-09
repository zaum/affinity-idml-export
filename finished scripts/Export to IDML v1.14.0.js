/*
Script Name: Export to IDML
Description: Exports multi-page Affinity documents into a dedicated Desktop folder containing the IDML, diagnostics and page previews. In the Affinity Script Editor settings for this script, enable Access the file system and allow the Desktop folder under Edit > Settings > Scripting.
Preview image: Add a 16:9 preview image before publishing.
Version: 1.14.0
version: 1.14.0
Author: zaum
Contact: https://github.com/zaum
Sources:
- Adobe IDML File Format Specification (attribute names, units and package structure):
  https://community.adobe.com/havfw69955/attachments/havfw69955/indesign/632652/1/idml-specification.pdf
- Adobe InDesign UXP DOM, Character Style (kerning and text attributes):
  https://developer.adobe.com/indesign/uxp/dom/api/c/character-style/
- Affinity Character panel help (automatic and manual kerning):
  https://s3-eu-west-1.amazonaws.com/affinity-docs/help/designer/en-US.lproj/pages/Panels/characterPanel.html
- Affinity typography guide (metric Auto kerning and manual values):
  https://www.affinity.studio/blog/tracking-kerning-leading-typography-essentials
- Affinity Transform help (Scale with object and line weights):
  https://www.affinity.studio/help/object-control-transform/
- Adobe transparency effects and gradient feather:
  https://helpx.adobe.com/indesign/desktop/apply-color/advanced-color-techniques/transparency-effects-options-and-settings.html
- Adobe InDesign measurement units and view preferences:
  https://developer.adobe.com/indesign/uxp/dom/api/m/measurement-units/
  https://developer.adobe.com/indesign/uxp/omv/v/ViewPreference/
- Affinity per-script file system permission and allowed folders:
  https://www.affinity.studio/help/desktop-settings-scripting/
- Local Affinity scripting API wrappers used by this script:
  workspace/docs/glyphatts.js and workspace/docs/paragraphatts.js
  workspace/docs/document.js, workspace/docs/colours.js and workspace/docs/linestyle.js
  workspace/docs/fills.js and workspace/docs/transparencyinterface.js
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

    function pngRgba(width, height, rgba, profileName) {
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
        const tagSrgb = /^sRGB(?:\b|$)/i.test(String(profileName || ''));
        const png = new Uint8Array(8 + 25 + (tagSrgb ? 13 : 0) + 12 + z.length + 12);
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
        chunk('IHDR', ihdr);
        if (tagSrgb) chunk('sRGB', new Uint8Array([0]));
        chunk('IDAT', z); chunk('IEND', new Uint8Array(0));
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
                for (const style of frame.runs.map(run => run.style).concat(frame.paragraphCharacterStyles || []))
                    if (style) style.fillId = register(style.fill);
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
        return '<Polygon Self="' + obj.id + '" ItemLayer="' +
            (obj.layer || (obj.visible === false ? 'layerHidden' : 'layer1')) +
            '" ItemTransform="1 0 0 1 0 0"' +
            ' FillColor="' + (obj.fillId || 'Swatch/None') + '" StrokeColor="' +
            (obj.strokeId || 'Swatch/None') + '" StrokeWeight="' + number(obj.strokeWeight || 0) + '"' +
            (obj.visible === false ? ' Visible="false"' : '') +
            (obj.fill && obj.fill.type === 'gradient' ? ' GradientFillAngle="' +
                number(obj.fillAngle || 0) + '"' : '') +
            (obj.stroke && obj.stroke.type === 'gradient' ? ' GradientStrokeAngle="' +
                number(obj.strokeAngle || 0) + '"' : '') + '>' +
            pathXml(obj.paths) + '</Polygon>';
    }

    function imageXml(obj) {
        const x = number(obj.x), y = number(obj.y);
        const m = obj.matrix;
        const transform = [m[0], m[3], m[1], m[4], m[2] - obj.x, m[5] - obj.y]
            .map(number).join(' ');
        const shape = obj.clipPaths ? 'Polygon' : 'Rectangle';
        return '<' + shape + ' Self="' + obj.id + '" ItemLayer="' +
            (obj.layer || (obj.visible === false ? 'layerHidden' : 'layer1')) +
            '" ItemTransform="1 0 0 1 ' +
            x + ' ' + y + '" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0"' +
            (obj.visible === false ? ' Visible="false"' : '') + '>' +
            (obj.clipPaths ? pathXml(obj.clipPaths) : framePath({ x: 0, y: 0, width: obj.width, height: obj.height })) +
            '<Image Self="image' + obj.id + '" ItemTransform="' + transform + '"><Properties>' +
            '<GraphicBounds Left="0" Top="0" Right="' + obj.pixelWidth + '" Bottom="' +
            obj.pixelHeight + '"/><Contents>' + obj.contents + '</Contents></Properties></Image></' + shape + '>';
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
                const terminalStyle = frame.paragraphCharacterStyles &&
                    frame.paragraphCharacterStyles[paragraphIndex] || null;
                const pieces = p.length ? p.slice() : [{ text: '', style: terminalStyle }];
                // An empty final range styles InDesign's implicit end-of-story marker
                // without adding another paragraph or a visible character.
                if (p.length && paragraphIndex === paragraphs.length - 1 && terminalStyle)
                    pieces.push({ text: '', style: terminalStyle });
                return '<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"' +
                    paragraphAttrs + '>' + pieces.map((run, runIndex) => {
                    const s = run.style;
                    // IDML stores fixed leading on character ranges. Apply the
                    // paragraph value unless a glyph has an explicit override.
                    const leading = settings && settings.leading > 0 &&
                        !(s && s.leading > 0) ? settings.leading : null;
                    const attrs = s ? ' FontStyle="' + xml(s.face) + '"' +
                        (s.pointSize > 0 ? ' PointSize="' + number(s.pointSize) + '"' : '') +
                        (s.fillId ? ' FillColor="' + s.fillId + '"' : '') +
                        ['tracking','kerningMethod','kerningValue','horizontalScale','verticalScale','skew','baselineShift',
                            'noBreak','capitalization','position','underline','strikeThru','leading'].map(key => {
                            const name = key[0].toUpperCase() + key.slice(1);
                            return s[key] == null ? '' : ' ' + name + '="' + xml(s[key]) + '"';
                        }).join('') : '';
                    const leadingAttr = leading == null ? '' : ' Leading="' + number(leading) + '"';
                    const font = s ? '<Properties><AppliedFont type="string">' + xml(s.family) +
                        '</AppliedFont></Properties>' : '';
                    return '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"' +
                        attrs + leadingAttr + '>' + font + '<Content>' + xml(run.text) + '</Content>' +
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

    function textFrameXml(f) {
        return '<TextFrame Self="' + f.id + '" ParentStory="' + f.storyId +
            '" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType"' +
            ' AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"' +
            ' ItemTransform="1 0 0 1 0 0" ItemLayer="' +
            (f.layer || (f.visible === false ? 'layerHidden' : 'layer1')) + '"' +
            (f.visible === false ? ' Visible="false"' : '') + '>' +
            framePath(f) + '</TextFrame>';
    }

    function spreadXml(spread) {
        const p = spread.page;
        const page = '<Page Self="' + p.id + '" Name="' + p.number + '" GeometricBounds="0 0 ' +
            number(p.height) + ' ' + number(p.width) + '" ItemTransform="1 0 0 1 0 0">' +
            (p.margin == null ? '' : '<MarginPreference Top="' + number(p.margin) + '" Bottom="' +
                number(p.margin) + '" Left="' + number(p.margin) + '" Right="' +
                number(p.margin) + '" ColumnCount="1"/>') + '</Page>';
        const frames = spread.frames.map(textFrameXml).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Spread xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            '<Spread Self="' + spread.id + '" PageCount="1" BindingLocation="0" ItemTransform="1 0 0 1 0 0">' +
            page + (spread.items ? spread.items.map(item => item.kind === 'frame' ?
                textFrameXml(item) :
                item.kind === 'image' ? imageXml(item) : polygonXml(item)).join('') :
                spread.objects.map(obj => obj.kind === 'image' ? imageXml(obj) : polygonXml(obj)).join('') +
                frames) + (spread.preview ? imageXml(spread.preview) : '') + '</Spread></idPkg:Spread>';
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
        for (const spread of model.spreads) for (const frame of spread.frames)
            for (const style of frame.runs.map(run => run.style).concat(frame.paragraphCharacterStyles || [])) {
                if (!style) continue;
                const key = fontKey(style);
                if (seenFonts.has(key)) continue;
                seenFonts.add(key);
                fonts.push(style);
            }
        parts.push({ name: 'Resources/Fonts.xml', content: fontsXml(fonts) });
        parts.push({ name: 'Resources/Graphic.xml', content: graphicXml(palette) });
        const first = model.spreads[0].page;
        const bleed = first.bleed;
        const preferences = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<idPkg:Preferences xmlns:idPkg="' + NS + '" DOMVersion="' + DOM_VERSION + '">' +
            (model.measurementUnits ? '<ViewPreference HorizontalMeasurementUnits="' +
                model.measurementUnits + '" VerticalMeasurementUnits="' +
                model.measurementUnits + '"/>' : '') +
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
            '" Self="d" Name="' + xml(model.name) + '" StoryList="' + storyIds.join(' ') + '"' +
            (model.profile ? ' ' + model.profile.space + 'Profile="' + xml(model.profile.name) + '"' : '') +
            ' ActiveLayer="' + (model.layers && model.layers.length ? model.layers[0].id : 'layer1') +
            '" ZeroPoint="0 0">' +
            '<Layer Self="layer1" Name="Editable Affinity objects" Visible="true" Locked="false" Printable="true"/>' +
            (model.layers || []).map(layer => '<Layer Self="' + layer.id + '" Name="' +
                xml(layer.name) + '" Visible="' + (layer.visible !== false) +
                '" Locked="' + !!layer.locked + '" Printable="true"/>').join('') +
            (model.spreads.some(s => s.frames.some(f => f.visible === false && !f.layer) ||
                s.objects.some(o => o.visible === false && !o.layer)) ?
                '<Layer Self="layerHidden" Name="Hidden Affinity objects" Visible="false" Locked="false" Printable="true"/>' : '') +
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
        const paragraphSources = [];
        const paragraphCharacterStyles = [];
        let paragraphStart = range.begin;
        let finalParagraphStyle = null;
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
                const absolute = Number(api.getDoubleValue(handle, kind.AbsoluteLeading));
                const leadingType = enumName(scalar(api, 'getLeadingType', handle));
                const align = enumName(scalar(api, 'getAlignXType', handle));
                const justification = {left:'LeftAlign',centre:'CenterAlign',center:'CenterAlign',
                    right:'RightAlign',justifyall:'FullyJustified',justifyleft:'LeftJustified',
                    justifycentre:'CenterJustified',justifycenter:'CenterJustified',
                    justifyright:'RightJustified'}[align];
                const out = {
                    hyphenation: api.getIsAutoHyphenate(handle) ? 'true' : 'false',
                    spaceBefore: Number(api.getDoubleValue(handle, kind.SpaceBefore)) * pt,
                    spaceAfter: Number(api.getDoubleValue(handle, kind.SpaceAfter)) * pt,
                    autoLeading: leadingType.indexOf('absolute') < 0 && relative > 0 &&
                        Number.isFinite(relative) ? relative * 100 : null,
                    leading: leadingType.indexOf('absolute') >= 0 && absolute > 0 ? absolute * pt : null,
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
                    const override = enumName(scalar(ga, 'getLeadingOverrideType', atts));
                    const glyphLeading = doubleValue(ga,atts,kind,'AbsoluteLeading',pt);
                    if (override !== 'none' && glyphLeading > 0) style.leading = glyphLeading;
                    const spacing = doubleValue(ga,atts,kind,'CharacterSpacing',1);
                    if (spacing != null && pointSize > 0) style.tracking = spacing * pt * 1000 / pointSize;
                    // Affinity stores manual kerning as an em fraction; IDML uses 1/1000 em.
                    // Affinity uses -1 for disabled automatic kerning (the UI's 0‰ setting).
                    // Omitting KerningMethod in IDML would turn metric kerning back on.
                    const auto = doubleValue(ga,atts,kind,'AutoKernMinHeight',1);
                    if (auto != null && auto < 0) style.kerningMethod = '$ID/None';
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
                        const paragraph = paragraphAt(paragraphStart);
                        paragraphs.push(paragraph || {});
                        paragraphSources.push(paragraph ? 'read' : 'unavailable');
                        paragraphCharacterStyles.push(style);
                        paragraphStart = p + 1;
                    } else finalParagraphStyle = style;
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
        const finalParagraph = paragraphAt(paragraphStart);
        const priorParagraph = paragraphs[paragraphs.length - 1];
        paragraphs.push(finalParagraph || priorParagraph || {});
        paragraphSources.push(finalParagraph ? 'read' : priorParagraph ? 'copiedPrevious' : 'unavailable');
        paragraphCharacterStyles.push(finalParagraphStyle);
        return { runs, paragraphs, paragraphSources, paragraphCharacterStyles, unresolved };
    }

    function strokeWeightInPoints(node, pt) {
        const raw = Number(node.lineWeight);
        if (!(raw > 0)) return 0;
        try {
            const descriptor = node.lineStyleDescriptor;
            if (descriptor && descriptor.isScale) {
                const effective = Number(descriptor.effectiveWeight(node.baseToSpreadTransform));
                if (effective > 0 && Number.isFinite(effective)) return effective * pt;
            }
        } catch (_) { /* Preserve the unscaled width if the host lacks this API. */ }
        return raw * pt;
    }

    function readPaths(node, pt, origin) {
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
        return paths;
    }

    function readVector(node, pt, origin, index, Colour) {
        const paths = readPaths(node, pt, origin);
        if (!paths.length) return null;
        let fill = null, stroke = null, strokeWeight = 0, fillAngle = 0;
        try {
            const descriptor = node.brushFillDescriptor;
            fill = colourFromFill(descriptor.fill) || gradientFromFill(descriptor.fill, Colour);
            if (fill && fill.type === 'gradient') {
                const m = descriptor.transform.data;
                fillAngle = Math.atan2(m[3], m[0]) * 180 / Math.PI;
            }
        } catch (_) {}
        try {
            const weight = strokeWeightInPoints(node, pt);
            if (weight > 0) {
                const descriptor = node.penFillDescriptor;
                stroke = colourFromFill(descriptor.fill) || gradientFromFill(descriptor.fill, Colour);
                if (stroke) strokeWeight = weight;
            }
        } catch (_) {}
        if (!fill && !stroke) return null;
        return { kind: 'vector', id: 'vector' + index, paths, fill, fillAngle,
            stroke, strokeWeight };
    }

    function applyLinearTransparency(pixels, width, height, gradient) {
        const m = gradient.matrix, stops = gradient.stops;
        const det = m[0] * m[4] - m[1] * m[3];
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12 || stops.length < 2)
            throw new Error('Image transparency gradient has invalid geometry or stops.');
        const xStep = m[4] / det, yStep = -m[1] / det;
        const start = (-m[4] * m[2] + m[1] * m[5]) / det;
        for (let y = 0; y < height; y++) {
            let t = start + y * yStep;
            for (let x = 0; x < width; x++, t += xStep) {
                let alpha = stops[stops.length - 1].alpha;
                if (t <= stops[0].position) alpha = stops[0].alpha;
                else for (let i = 1; i < stops.length; i++) {
                    if (t <= stops[i].position) {
                        const before = stops[i - 1], after = stops[i];
                        const fraction = (t - before.position) / (after.position - before.position);
                        alpha = before.alpha + (after.alpha - before.alpha) * fraction;
                        break;
                    }
                }
                const offset = (y * width + x) * 4 + 3;
                pixels[offset] = Math.round(pixels[offset] * alpha / 255);
            }
        }
    }

    function readImageTransparency(node, Colour) {
        const descriptor = node.transparencyFillDescriptor;
        const fill = descriptor && descriptor.fill;
        if (!fill || fill[Symbol.toStringTag] === 'NoFill') return null;
        if (fill[Symbol.toStringTag] !== 'GradientFill')
            throw new Error('Unsupported image transparency fill: ' + fill[Symbol.toStringTag]);
        const type = fill.gradientFillType;
        const kind = type && typeof type === 'object' ? type.value : type;
        if (kind !== 0) throw new Error('Only linear image transparency gradients are supported.');
        if (descriptor.isAnchoredToSpread)
            throw new Error('Spread-anchored image transparency gradient needs coordinate mapping.');
        const matrix = Array.from(descriptor.transform.data);
        const stops = Array.from(fill.gradient.stops).map(stop => ({
            position: Number(stop.position),
            alpha: new Colour(stop.colour).getRGBA8(false).alpha
        })).sort((a, b) => a.position - b.position);
        if (stops.some(stop => !Number.isFinite(stop.position) || !Number.isFinite(stop.alpha)))
            throw new Error('Could not read image transparency gradient stops.');
        return { matrix, stops };
    }

    function imageClip(node, pt, pathReader) {
        const read = pathReader || readPaths;
        try {
            let parent = node.parent;
            for (let depth = 0; parent && depth < 16; depth++, parent = parent.parent) {
                if (parent.isSpreadNode) break;
                const grandparent = parent.parent;
                // A page node is a shape too, but it is not an image clip.
                if (grandparent && grandparent.isSpreadNode) break;
                if (parent.isImageNode) {
                    try {
                        const candidate = parent.getSpreadBaseBox(false);
                        if (candidate && candidate.width > 0 && candidate.height > 0) {
                            const w = candidate.width * pt, h = candidate.height * pt;
                            const corners = [[0, 0], [0, h], [w, h], [w, 0]];
                            return { frameBox: candidate, clipKind: 'imageBounds',
                                clipPaths: [{ closed: true, points: corners.map(([x, y]) => ({
                                    anchor: { x, y }, left: { x, y }, right: { x, y }
                                })) }] };
                        }
                    } catch (_) { /* Try an outer clipping ancestor. */ }
                }
                if (parent.isShapeNode || parent.isPolyCurveNode) {
                    try {
                        const candidate = parent.getSpreadBaseBox(false);
                        const paths = candidate && read(parent, pt, candidate);
                        if (paths && paths.length && paths.every(path => path.closed))
                            return { frameBox: candidate, clipPaths: paths, clipKind: 'vector' };
                    } catch (_) { /* Try an outer clipping ancestor. */ }
                }
            }
        } catch (_) { /* Fall back to the image's rectangular frame. */ }
        return null;
    }

    function readImage(node, pt, origin, index, PixelBuffer, RasterFormat, Colour) {
        const box = node.getSpreadBaseBox(false);
        const clip = imageClip(node, pt);
        const frameBox = clip ? clip.frameBox : box;
        const clipPaths = clip ? clip.clipPaths : null;
        const width = Number(node.rasterWidth), height = Number(node.rasterHeight);
        if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions.');
        const pixels = PixelBuffer.create(width, height, RasterFormat.RGBA8);
        node.copyTo(pixels, { x: 0, y: 0, width, height }, 0, 0);
        const rgba = new Uint8Array(pixels.buffer);
        const transparency = readImageTransparency(node, Colour);
        if (transparency) applyLinearTransparency(rgba, width, height, transparency);
        let imageProfile = '';
        let sourceFilePath = '', sourceFileType = '', sourceDpi = null;
        try {
            const resource = node.imageResourceInterface;
            imageProfile = String(safeNodeValue(resource, 'iccProfile') || '');
            sourceFilePath = String(safeNodeValue(resource, 'imageFilePath') || '');
            sourceFileType = String(safeNodeValue(resource, 'fileTypeName') || '');
            const dpi = Number(safeNodeValue(resource, 'originalDPI'));
            if (Number.isFinite(dpi) && dpi > 0) sourceDpi = dpi;
        } catch (_) { /* Keep the editable image if resource metadata is unavailable. */ }
        const png = pngRgba(width, height, rgba, imageProfile);
        const matrix = Array.from(node.baseToSpreadTransform.data);
        matrix[0] *= pt; matrix[1] *= pt; matrix[2] = (matrix[2] - origin.x) * pt;
        matrix[3] *= pt; matrix[4] *= pt; matrix[5] = (matrix[5] - origin.y) * pt;
        return { kind: 'image', id: 'picture' + index, x: (frameBox.x - origin.x) * pt,
            y: (frameBox.y - origin.y) * pt, width: frameBox.width * pt, height: frameBox.height * pt,
            clipPaths, clipKind: clip && clip.clipKind, pixelWidth: width, pixelHeight: height,
            matrix, contents: base64(png),
            sourceIccProfile: imageProfile, sourceFilePath, sourceFileType, sourceDpi,
            transparencyBaked: !!transparency };
    }

    function addPagePreviews(doc, model, folder, File, Buffer, FileSystemApi, exportApi, onPage) {
        const options = exportApi.FileExportOptions.createWithPresetName('PNG');
        const basename = safeOutputName(doc.title);
        for (let i = 0; i < model.spreads.length; i++) {
            const requested = String(folder).replace(/[\\/]+$/, '') + '/' + basename +
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
            model.spreads[i].previewPath = path;
            if (onPage) onPage(i + 1, model.spreads.length);
        }
    }

    function safeNodeValue(node, key) {
        try { const value = node[key]; return value == null ? null : value; }
        catch (_) { return null; }
    }

    function audit(state, source, idml, note) {
        return { state, source: source == null ? null : source, idml: idml || null, note: note || null };
    }

    function enumValue(value) {
        if (value == null) return null;
        if (Array.isArray(value) || ArrayBuffer.isView(value)) return JSON.stringify(Array.from(value));
        if (typeof value === 'object') value = value.name == null ? value.value : value.name;
        return value == null ? null : String(value);
    }

    function fieldAudit(records, key, idml, mapped, note) {
        const examples = [], keys = new Set();
        let present = 0;
        for (const record of records) {
            const value = record && record[key];
            if (value == null || (typeof value === 'number' && !Number.isFinite(value))) continue;
            present++;
            const signature = JSON.stringify(value);
            if (!keys.has(signature) && examples.length < 8) { keys.add(signature); examples.push(value); }
        }
        return audit(present ? (mapped ? 'exported' : 'notMapped') : 'unknown',
            { present, total: records.length, examples }, idml,
            present ? note : 'No value was captured; this may be a default or an unreadable property.');
    }

    function textPropertyAudit(content) {
        const result = {};
        const styles = content.runs.map(run => run.style).concat(content.paragraphCharacterStyles || []);
        const characterFields = {
            family:'AppliedFont', face:'FontStyle', postscript:'Resources/Fonts.xml/PostScriptName',
            pointSize:'PointSize', fill:'FillColor', tracking:'Tracking',
            kerningMethod:'KerningMethod', kerningValue:'KerningValue',
            horizontalScale:'HorizontalScale', verticalScale:'VerticalScale', skew:'Skew',
            baselineShift:'BaselineShift', noBreak:'NoBreak', capitalization:'Capitalization',
            position:'Position', underline:'Underline', strikeThru:'StrikeThru', leading:'Leading'
        };
        for (const [key, idml] of Object.entries(characterFields))
            result['character.' + key] = fieldAudit(styles, key, idml, true);
        const translucentText = styles.some(style => style && style.fill &&
            typeof style.fill.alpha === 'number' && style.fill.alpha < 0.999);
        result['character.fillOpacity'] = audit(translucentText ? 'notMapped' : 'unknown',
            translucentText, null, translucentText ?
                'Text fill alpha is read but not serialized.' : 'No translucent text fill was captured.');
        const paragraphFields = {
            hyphenation:'Hyphenation', spaceBefore:'SpaceBefore', spaceAfter:'SpaceAfter',
            autoLeading:'AutoLeading', leading:'CharacterStyleRange/Leading', justification:'Justification',
            leftIndent:'LeftIndent', rightIndent:'RightIndent', firstLineIndent:'FirstLineIndent',
            minimumWordSpacing:'MinimumWordSpacing', desiredWordSpacing:'DesiredWordSpacing',
            maximumWordSpacing:'MaximumWordSpacing', minimumLetterSpacing:'MinimumLetterSpacing',
            desiredLetterSpacing:'DesiredLetterSpacing', maximumLetterSpacing:'MaximumLetterSpacing',
            hyphenateWordsLongerThan:'HyphenateWordsLongerThan', hyphenateAfterFirst:'HyphenateAfterFirst',
            hyphenateBeforeLast:'HyphenateBeforeLast', hyphenateLadderLimit:'HyphenateLadderLimit',
            hyphenationZone:'HyphenationZone', keepWithNext:'KeepWithNext',
            keepAllLinesTogether:'KeepAllLinesTogether', keepWithPrevious:'KeepWithPrevious',
            alignToBaselineGrid:'AlignToBaselineGrid'
        };
        for (const [key, idml] of Object.entries(paragraphFields))
            result['paragraph.' + key] = fieldAudit(content.paragraphs, key, idml, !!idml,
                key === 'leading' ? 'Fixed paragraph leading is written on character ranges unless a glyph has an explicit leading override.' : null);
        result['paragraph.readback'] = audit(content.paragraphSources.every(v => v === 'read') ?
            'exported' : 'approximated', content.paragraphSources, null,
            'copiedPrevious means the current paragraph attributes could not be read and the previous values were reused.');
        result.namedParagraphStyle = audit('notProbed', null, 'AppliedParagraphStyle',
            'The exporter writes NormalParagraphStyle and local formatting.');
        result.namedCharacterStyle = audit('notProbed', null, 'AppliedCharacterStyle',
            'The exporter writes [No character style] and local formatting.');
        result.threading = audit('notProbed', null, 'PreviousTextFrame/NextTextFrame',
            'Each frame is exported as an independent story.');
        return result;
    }

    function commonPropertyAudit(node, item) {
        const result = {
            bounds: audit(item.boundsPt ? 'exported' : 'unavailable', item.boundsPt,
                'GeometricBounds/PathGeometry'),
            visibility: audit('exported', item.visible, 'Visible/ItemLayer'),
            opacity: audit(item.opacity == null ? 'unavailable' :
                Math.abs(item.opacity - 1) < 1e-6 ? 'exported' : 'notMapped', item.opacity,
                item.opacity === 1 ? 'IDML default' : null,
                item.opacity === 1 ? 'Default opaque state is retained.' : 'Object opacity is not serialized.')
        };
        const fillOpacity = safeNodeValue(node, 'fillOpacity');
        result.fillOpacity = audit(fillOpacity == null ? 'unavailable' :
            Number(fillOpacity) === 1 ? 'exported' : 'notMapped', fillOpacity,
            Number(fillOpacity) === 1 ? 'IDML default' : null);
        const blend = enumValue(safeNodeValue(node, 'blendMode'));
        result.blendMode = audit(blend == null ? 'unavailable' :
            /^(normal|passthrough|0)$/i.test(blend) ? 'exported' : 'notMapped', blend,
            /^(normal|passthrough|0)$/i.test(blend || '') ? 'IDML default' : null);
        const locked = safeNodeValue(node, 'isLocked');
        result.locked = audit(locked == null ? 'unavailable' : locked ? 'notMapped' : 'exported',
            locked, locked === false ? 'IDML default' : null);
        const printVisible = safeNodeValue(node, 'isVisibleInExport');
        result.exportVisibility = audit(printVisible == null ? 'unavailable' :
            printVisible ? 'exported' : 'notMapped', printVisible,
            printVisible === true ? 'IDML default' : null);
        result.layerHierarchy = audit('notMapped', item.parent, 'ItemLayer',
            'Original parent/layer path is not reconstructed.');
        return result;
    }

    function imagePropertyAudit(image) {
        return {
            pixels: audit('exported', [image.pixelWidth, image.pixelHeight], 'Image/Contents'),
            sourceFilePath: audit(image.sourceFilePath ? 'notMapped' : 'unavailable',
                image.sourceFilePath || null, 'LinkResourceURI',
                'Image pixels are embedded as PNG; the source link is not retained.'),
            sourceFileType: audit(image.sourceFileType ? 'notMapped' : 'unavailable',
                image.sourceFileType || null, null, 'The source image is re-encoded as PNG.'),
            sourceDpi: audit(image.sourceDpi ? 'notMapped' : 'unavailable',
                image.sourceDpi, null, 'Image placement is preserved by its transform, not source DPI metadata.'),
            iccProfile: audit(!image.sourceIccProfile ? 'unavailable' :
                /^sRGB(?:\b|$)/i.test(image.sourceIccProfile) ? 'approximated' : 'notMapped',
                image.sourceIccProfile || null, /^sRGB(?:\b|$)/i.test(image.sourceIccProfile) ?
                    'PNG sRGB chunk' : null, 'A non-sRGB source ICC profile is not embedded in the generated PNG.'),
            clippingPath: audit(image.clipPaths ?
                (image.clipKind === 'imageBounds' ? 'approximated' : 'exported') : 'unknown',
                image.clipPaths ? image.clipPaths.length : null, image.clipPaths ? 'PathGeometry' : null,
                image.clipKind === 'imageBounds' ?
                    'An image parent is approximated by its rectangular bounds; alpha masking is not preserved.' :
                    image.clipPaths ? null : 'No closed shape/polycurve clipping path was captured.'),
            transparencyGradient: audit(image.transparencyBaked ? 'approximated' : 'unknown',
                image.transparencyBaked, image.transparencyBaked ? 'PNG alpha' : null,
                image.transparencyBaked ? 'Linear transparency is baked into pixel alpha.' :
                    'No supported transparency gradient was captured.')
        };
    }

    function vectorPropertyAudit(node, vector) {
        const result = {
            paths: audit('exported', vector.paths.length, 'PathGeometry'),
            fill: audit(vector.fill ? 'exported' : 'unknown', vector.fill || null, 'FillColor'),
            stroke: audit(vector.stroke ? 'exported' : 'unknown', vector.stroke || null, 'StrokeColor'),
            strokeWeight: audit(vector.stroke ? 'exported' : 'unknown',
                vector.strokeWeight, 'StrokeWeight'),
            fillGradient: audit(vector.fill && vector.fill.type === 'gradient' ? 'exported' : 'unknown',
                vector.fill && vector.fill.type === 'gradient' ? vector.fill.kind : null, 'GradientFillAngle')
        };
        for (const channel of ['fill', 'stroke']) {
            const colour = vector[channel];
            const alpha = colour && typeof colour.alpha === 'number' ? colour.alpha : null;
            result[channel + 'Alpha'] = audit(alpha == null ? 'unknown' :
                alpha < 0.999 ? 'notMapped' : 'exported', alpha,
                alpha != null && alpha >= 0.999 ? 'IDML default' : null,
                alpha != null && alpha < 0.999 ? 'Colour alpha is not serialized.' : null);
        }
        const descriptor = safeNodeValue(node, 'lineStyleDescriptor');
        const line = descriptor && safeNodeValue(descriptor, 'lineStyle');
        for (const [key, source] of Object.entries({
            strokeAlignment: descriptor && safeNodeValue(descriptor, 'strokeAlignment'),
            frontArrowHead: descriptor && safeNodeValue(descriptor, 'frontArrowHead'),
            backArrowHead: descriptor && safeNodeValue(descriptor, 'backArrowHead'),
            cap: line && safeNodeValue(line, 'cap'),
            join: line && safeNodeValue(line, 'join'),
            dashPattern: line && safeNodeValue(line, 'dashPattern')
        })) {
            const value = enumValue(source);
            result[key] = audit(value == null ? 'unavailable' : 'notMapped', value, null,
                'This line-style property is not serialized by the current exporter.');
        }
        return result;
    }

    function nodeType(node) {
        if (node.isFrameTextNode) return 'frameText';
        if (node.isArtTextNode) return 'artText';
        if (node.isImageNode) return 'image';
        if (node.isShapeNode) return 'shape';
        if (node.isPolyCurveNode) return 'polyCurve';
        if (node.isGroupNode) return 'group';
        if (node.isVectorNode) return 'vector';
        return String(node[Symbol.toStringTag] || (node.constructor && node.constructor.name) || 'unknown');
    }

    function ancestry(node) {
        const layers = [], groups = [];
        let parent = node.parent;
        for (let depth = 0; parent && depth < 32; depth++, parent = parent.parent) {
            if (parent.isSpreadNode) break;
            const type = String(parent[Symbol.toStringTag] || '');
            const name = String(safeNodeValue(parent, 'userDescription') ||
                safeNodeValue(parent, 'defaultDescriptionForDisplay') || type || 'Untitled');
            if (type === 'ContainerNode') layers.unshift({ name,
                visible: parent.isVisibleInDomain !== false,
                locked: safeNodeValue(parent, 'isLocked') === true });
            if (parent.isGroupNode) groups.unshift(name);
        }
        return { layers, groups };
    }

    function diagnosticEntry(node, index, origin, pt) {
        const box = (() => { try { return node.getSpreadBaseBox(false); } catch (_) { return null; } })();
        let parent = null;
        try { parent = node.parent; } catch (_) {}
        const label = safeNodeValue(node, 'userDescription') || safeNodeValue(node, 'description') ||
            safeNodeValue(node, 'defaultDescriptionForDisplay');
        const parentLabel = parent && (safeNodeValue(parent, 'userDescription') ||
            safeNodeValue(parent, 'description') || safeNodeValue(parent, 'defaultDescriptionForDisplay'));
        const rawOpacity = safeNodeValue(node, 'globalOpacity');
        const opacity = rawOpacity == null ? NaN : Number(rawOpacity);
        return { sourceIndex: index, type: nodeType(node), label: label ? String(label) : null,
            parent: parentLabel ? String(parentLabel) : null,
            layerPath: ancestry(node).layers.map(layer => layer.name),
            groupPath: ancestry(node).groups,
            visible: safeNodeValue(node, 'isVisibleInDomain') !== false,
            opacity: Number.isFinite(opacity) && opacity >= 0 ? opacity : null,
            boundsPt: box ? { x: (box.x - origin.x) * pt, y: (box.y - origin.y) * pt,
                width: box.width * pt, height: box.height * pt } : null,
            status: 'omitted', idmlId: null, issues: [], properties: {}, propertyAudit: {} };
    }

    function finishDiagnostics(report) {
        const summary = { exported: 0, approximated: 0, omitted: 0, containers: 0,
            properties: { exported: 0, approximated: 0, notMapped: 0, unavailable: 0,
                unknown: 0, notProbed: 0 }, byProperty: {} };
        function countProperties(properties) {
            for (const [name, value] of Object.entries(properties || {})) {
                if (summary.properties[value.state] != null) summary.properties[value.state]++;
                if (!summary.byProperty[name]) summary.byProperty[name] = {};
                summary.byProperty[name][value.state] = (summary.byProperty[name][value.state] || 0) + 1;
            }
        }
        for (const page of report.pages) for (const item of page.objects) {
            if (item.status === 'container') summary.containers++;
            else if (summary[item.status] != null) summary[item.status]++;
            countProperties(item.propertyAudit);
        }
        countProperties(report.propertyAudit);
        for (const page of report.pages) countProperties(page.propertyAudit);
        report.summary = summary;
        return report;
    }

    function readModel(doc, fontApi, imageApi, onPage) {
        const dpi = Number(doc.dpi);
        if (!(dpi > 0)) throw new Error('Document DPI is not readable.');
        const pt = 72 / dpi;
        const model = { name: doc.title || 'Affinity document', spreads: [], layers: [], skipped: 0,
            frames: 0, unresolved: 0, vectors: 0, images: 0,
            diagnostics: { schemaVersion: 2, document: String(doc.title || 'Affinity document'),
                dpi, pages: [], warnings: [], propertyStates: {
                    exported: 'Source value is represented in IDML, possibly through a default value.',
                    approximated: 'Source value is represented with a documented conversion or flattening.',
                    notMapped: 'Source value is not serialized; the InDesign default may or may not match.',
                    unavailable: 'The current API read did not return a usable value.',
                    unknown: 'No value was captured; the source may use a default or the getter may be unavailable.',
                    notProbed: 'The exporter has not attempted to read this feature.'
                } } };
        const unitName = String(doc.units || '').toLowerCase();
        model.measurementUnits = {
            millimetre:'Millimeters', millimeter:'Millimeters', centimetre:'Centimeters',
            centimeter:'Centimeters', inch:'Inches', point:'Points', pica:'Picas',
            pixel:'Pixels'
        }[unitName] || null;
        try {
            const profile = doc.colourProfile;
            const profileName = String(profile && profile.name || '').trim();
            const format = String(doc.format || '').toUpperCase();
            const space = format.indexOf('CMYK') === 0 ? 'CMYK' :
                format.indexOf('RGB') === 0 ? 'RGB' : null;
            if (profileName && space) model.profile = { space, name: profileName };
        } catch (_) { /* Do not invent a colour profile if the host cannot expose it. */ }
        const layerIds = new Map();
        function layerFor(node) {
            const path = ancestry(node).layers;
            if (!path.length) return null;
            const key = path.map(layer => layer.name).join('\u0000');
            if (!layerIds.has(key)) {
                const id = 'layerSource' + (model.layers.length + 1);
                layerIds.set(key, id);
                model.layers.push({ id, name: path.map(layer => layer.name).join(' / '),
                    visible: path.every(layer => layer.visible),
                    locked: path.some(layer => layer.locked) });
            }
            return layerIds.get(key);
        }
        for (const spread of doc.spreads) {
            if (spread.pageCount !== 1)
                throw new Error('Version 1.12.0 needs one page per spread. A facing-page spread was found.');
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
                frames: [], objects: [], items: []
            };
            const pageReport = { page: pageNumber, widthPt: target.page.width,
                heightPt: target.page.height, bleedPt: target.page.bleed, objects: [] };
            model.diagnostics.pages.push(pageReport);
            let sourceIndex = 0;
            for (const node of spread.layers.all) {
                if (node.isSpreadNode) continue;
                const item = diagnosticEntry(node, ++sourceIndex, box, pt);
                item.propertyAudit = commonPropertyAudit(node, item);
                const layer = layerFor(node);
                if (layer) {
                    item.propertyAudit.layerHierarchy = audit('approximated', item.layerPath,
                        'ItemLayer', 'Source layer path is flattened to one named IDML layer.');
                }
                pageReport.objects.push(item);
                if (node.isGroupNode) {
                    item.status = 'container';
                    item.issues.push('Group hierarchy is flattened; children are exported separately.');
                    continue;
                }
                const visible = node.isVisibleInDomain !== false;
                if (node.isFrameTextNode || node.isArtTextNode) {
                    const b = node.getSpreadBaseBox(false);
                    if (!b || !(b.width > 0) || !(b.height > 0)) {
                        item.issues.push('Text frame bounds are missing or empty.');
                        model.skipped++; continue;
                    }
                    const index = ++model.frames;
                    const content = readFrameText(node, pt, fontApi);
                    model.unresolved += content.unresolved;
                    item.status = 'approximated'; item.idmlId = 'frame' + index;
                    item.properties = { characters: content.runs.reduce((n, run) => n + run.text.length, 0),
                        runs: content.runs.length, paragraphs: content.paragraphs.length,
                        unresolvedRuns: content.unresolved };
                    Object.assign(item.propertyAudit, textPropertyAudit(content));
                    item.issues.push('Named paragraph and character styles are exported as local formatting.');
                    item.issues.push('Text frame is exported as an independent story; frame threading is not preserved.');
                    if (content.unresolved) item.issues.push('Some text runs have unreadable formatting.');
                    const frame = {
                        id: 'frame' + index, storyId: 'story' + index,
                        x: (b.x - box.x) * pt, y: (b.y - box.y) * pt,
                        width: b.width * pt, height: b.height * pt,
                        runs: content.runs, paragraphs: content.paragraphs,
                        paragraphCharacterStyles: content.paragraphCharacterStyles, visible, layer,
                        kind: 'frame'
                    };
                    target.frames.push(frame); target.items.push(frame);
                } else if (node.isImageNode && imageApi) {
                    try {
                        const image = readImage(node, pt, box, model.images + 1,
                            imageApi.PixelBuffer, imageApi.RasterFormat, imageApi.Colour);
                        model.images++;
                        image.visible = visible;
                        image.layer = layer;
                        target.objects.push(image); target.items.push(image);
                        item.status = 'approximated'; item.idmlId = image.id;
                        item.properties = { pixelWidth: image.pixelWidth, pixelHeight: image.pixelHeight,
                            clippingPath: !!image.clipPaths, clipKind: image.clipKind || null,
                            sourceIccProfile: image.sourceIccProfile || null,
                            transparencyBaked: image.transparencyBaked };
                        Object.assign(item.propertyAudit, imagePropertyAudit(image));
                        item.issues.push('Source image is re-encoded as PNG; original file link and format are not preserved.');
                        if (image.sourceIccProfile && !/^sRGB(?:\b|$)/i.test(image.sourceIccProfile))
                            item.issues.push('Source ICC profile is not embedded in the generated PNG.');
                        if (image.transparencyBaked)
                            item.issues.push('Transparency gradient is baked into PNG alpha.');
                        if (image.clipKind === 'imageBounds')
                            item.issues.push('Nested image clipping uses the parent image bounds; parent pixel alpha is not used as a mask.');
                    } catch (error) {
                        item.issues.push('Image export failed: ' + String(error && error.message || error));
                        model.skipped++;
                    }
                } else if (node.isShapeNode || node.isPolyCurveNode ||
                    (node.isVectorNode && !node.isImageNode)) {
                    try {
                        const vector = readVector(node, pt, box, model.vectors + 1, imageApi && imageApi.Colour);
                        if (vector) {
                            vector.visible = visible; vector.layer = layer;
                            target.objects.push(vector); target.items.push(vector); model.vectors++;
                            item.status = 'exported'; item.idmlId = vector.id;
                            item.properties = { pathCount: vector.paths.length,
                                fill: vector.fill ? (vector.fill.type || vector.fill.space) : null,
                                stroke: vector.stroke ? (vector.stroke.type || vector.stroke.space) : null,
                                strokeWeightPt: vector.strokeWeight };
                            Object.assign(item.propertyAudit, vectorPropertyAudit(node, vector));
                            if (item.opacity != null && item.opacity < 0.999) {
                                item.status = 'approximated';
                                item.issues.push('Object opacity is not written to IDML.');
                            }
                        } else {
                            item.issues.push('No exportable path with supported fill or stroke.');
                            model.skipped++;
                        }
                    } catch (error) {
                        item.issues.push('Vector export failed: ' + String(error && error.message || error));
                        model.skipped++;
                    }
                } else if (node.isPhysicalNode && !node.isSpreadNode) {
                    item.issues.push('This physical node type has no IDML mapping.');
                    model.skipped++;
                } else {
                    item.status = 'container';
                    item.issues.push('Logical container is not reconstructed in IDML.');
                }
            }
            model.spreads.push(target);
            if (onPage) onPage(model.spreads.length, doc.spreads.length);
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
            model.diagnostics.warnings.push('Margins were inferred from text frame positions.');
        }
        if (!model.profile) model.diagnostics.warnings.push('Document colour profile was not readable.');
        model.diagnostics.measurementUnits = model.measurementUnits;
        model.diagnostics.colourProfile = model.profile || null;
        model.diagnostics.propertyAudit = {
            dpi: audit('exported', dpi, 'Geometry conversion to points'),
            measurementUnits: audit(model.measurementUnits ? 'exported' : 'unavailable',
                model.measurementUnits, 'ViewPreference'),
            colourProfile: audit(model.profile ? 'exported' : 'unavailable', model.profile,
                model.profile ? model.profile.space + 'Profile' : null,
                'The IDML records a profile name, not embedded ICC profile bytes.'),
            margins: audit(model.marginInferred ? 'approximated' : 'unavailable',
                model.marginInferred ? model.spreads[0].page.margin : null, 'MarginPreference',
                'Margins are inferred from text-frame positions when possible.'),
            facingPages: audit('exported', false, 'DocumentPreference/FacingPages',
                'Only one page per spread is supported; facing-page documents stop with an error.')
        };
        for (let i = 0; i < model.spreads.length; i++) {
            const page = model.spreads[i].page;
            model.diagnostics.pages[i].propertyAudit = {
                pageSize: audit('exported', [page.width, page.height], 'Page/GeometricBounds'),
                bleed: audit(page.bleed ? 'exported' : 'unavailable', page.bleed,
                    'DocumentPreference/DocumentBleed*'),
                margins: audit(page.margin != null ? 'approximated' : 'unavailable',
                    page.margin, 'Page/MarginPreference')
            };
        }
        finishDiagnostics(model.diagnostics);
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

    function safeOutputName(title) {
        return String(title || 'Affinity document').replace(/\.[^.]+$/, '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'Affinity document';
    }

    function chooseFolder(desktop, title, exists) {
        const base = safeOutputName(title);
        const parent = String(desktop).replace(/[\\/]+$/, '');
        for (let i = 0; i < 1000; i++) {
            const folder = parent + '/' + base + ' IDML export' + (i ? ' ' + (i + 1) : '');
            if (!exists(folder)) return folder;
        }
        throw new Error('Could not find a free output folder on the Desktop.');
    }

    // The VM harness calls this hook to verify the package without an Affinity host.
    if (typeof globalThis.__IDML_TEST_HOOK__ === 'function') {
        globalThis.__IDML_TEST_HOOK__({ xml, utf8, zipStore, pngRgba, base64,
            makeParts, readModel, readVector, ancestry, imageClip, strokeWeightInPoints, chooseFolder,
            applyLinearTransparency });
        return;
    }

    let app = null;
    try {
        app = require('/application').app;
        const { Document } = require('/document');
        const doc = globalThis.__IDML_DOCUMENT_TITLE__
            ? Document.all.find(d => d.title === globalThis.__IDML_DOCUMENT_TITLE__) : Document.current;
        if (!doc) throw new Error('Open an Affinity document first.');
        function errorMessage(error) {
            const detail = String(error && error.message || error);
            const hint = /PERMISSION_DENIED|ACCESS_DENIED|EACCES/i.test(detail)
                ? '\nIn this script’s Script Editor Settings, enable Access the file system. Also allow Desktop in Edit > Settings > Scripting > File System access.'
                : '';
            return 'IDML export failed: ' + detail + hint;
        }
        function exportDocument(progress) {
            const { FileExportOptions, FileExportArea } = require('/document');
            const { File, FileSystemApi } = require('/fs');
            const { Buffer } = require('/buffer');
            const { PixelBuffer, RasterFormat } = require('/rasterobject');
            const { FillDescriptor } = require('/fills');
            const { Colour } = require('/colours');
            const { StoryApi, GlyphAttsApi, GlyphAttDoubleType,
                ParagraphAttsApi, ParagraphAttDoubleType } = require('affinity:story');
            const { FontApi } = require('affinity:fonts');
            const desktop = app.userDesktopPath ||
                (typeof app.getUserDesktopPath === 'function' ? app.getUserDesktopPath() : app.getUserDesktopPath);
            if (!desktop) throw new Error('Could not locate the Desktop output folder.');
            progress(1, 'Reading document and text...');
            const model = readModel(doc, { StoryApi, GlyphAttsApi, GlyphAttDoubleType,
                ParagraphAttsApi, ParagraphAttDoubleType, FontApi, FillDescriptor },
                { PixelBuffer, RasterFormat, Colour },
                (page, total) => progress(1, 'Page read: ' + page + '/' + total));
            const folder = chooseFolder(desktop, doc.title, p => FileSystemApi.exists(p));
            if (typeof FileSystemApi.createDirectory !== 'function')
                throw new Error('This Affinity host cannot create an export folder.');
            FileSystemApi.createDirectory(folder);
            if (!FileSystemApi.exists(folder)) throw new Error('Export folder was not created: ' + folder);
            if (!globalThis.__IDML_SKIP_PREVIEWS__) {
                progress(2, 'Rendering page previews...');
                addPagePreviews(doc, model, folder, File, Buffer, FileSystemApi,
                    { FileExportOptions, FileExportArea },
                    (page, total) => progress(2, 'Preview rendered: ' + page + '/' + total));
            } else progress(2, 'Page previews skipped.');
            progress(3, 'Building IDML content...');
            const parts = makeParts(model);
            progress(4, 'Packaging IDML...');
            const bytes = zipStore(parts);
            progress(5, 'Saving files to export folder...');
            const path = folder + '/' + safeOutputName(doc.title) + '.idml';
            writeBytes(path, bytes, File, Buffer);
            const reportPath = path.replace(/\.idml$/i, '.diagnostics.json');
            model.diagnostics.outputIdml = path;
            model.diagnostics.outputReport = reportPath;
            model.diagnostics.outputPreviews = model.spreads.map(spread => spread.previewPath).filter(Boolean);
            writeBytes(reportPath, utf8(JSON.stringify(model.diagnostics, null, 2) + '\n'), File, Buffer);
            const faces = new Set();
            for (const spread of model.spreads) for (const frame of spread.frames)
                for (const run of frame.runs) if (run.style) faces.add(fontKey(run.style));
            return { path, reportPath, folder, message: 'IDML saved: ' + path +
                '\nDiagnostics saved: ' + reportPath + '\nPages: ' + model.spreads.length +
                ', page previews: ' + model.diagnostics.outputPreviews.length +
                ', editable text frames: ' + model.frames + ', vectors: ' + model.vectors +
                ', embedded images: ' + model.images + ', font faces: ' + faces.size +
                ', unresolved text runs: ' + model.unresolved + ', other objects omitted: ' + model.skipped +
                '\nObject inventory: ' + model.diagnostics.summary.exported + ' exported, ' +
                model.diagnostics.summary.approximated + ' approximated, ' +
                model.diagnostics.summary.omitted + ' omitted, ' +
                model.diagnostics.summary.containers + ' containers.' +
                '\nProperty audit: ' + model.diagnostics.summary.properties.notMapped +
                ' not mapped, ' + model.diagnostics.summary.properties.unavailable +
                ' unavailable, ' + model.diagnostics.summary.properties.unknown + ' unknown.' +
                (model.marginInferred ? '\nMargins were inferred from text-frame positions; verify them.' : '') +
                '\nOpen it in InDesign and check layout before using it.' };
        }
        if (globalThis.__IDML_SILENT__) {
            console.log(exportDocument(() => {}).message);
        } else {
            let outcome = null;
            let failure = null;
            try {
                outcome = exportDocument((step, message) => console.log('[' + step + '/5] ' + message));
                console.log(outcome.message);
            } catch (error) {
                failure = errorMessage(error);
                console.log(failure);
            }
            const { Dialog } = require('/dialog');
            const dlg = Dialog.create(outcome ? 'IDML Export Complete' : 'IDML Export Failed');
            dlg.initialWidth = 760;
            const group = dlg.addColumn().addGroup('Export result');
            group.addStaticText('Document', String(doc.title || 'Untitled document'));
            if (outcome) {
                group.addStaticText('Status', 'Export complete.');
                group.addTextBox('Full file path', String(outcome.path).replace(/\//g, '\\'));
                group.addTextBox('Diagnostics report', String(outcome.reportPath).replace(/\//g, '\\'));
                group.addTextBox('Export folder', String(outcome.folder).replace(/\//g, '\\'));
                group.addStaticText('Summary', outcome.message.split('\n').slice(1).join('\n'));
                const openFile = group.addButton('Open IDML in Affinity');
                openFile.onClickHandler = () => {
                    try { Document.load(outcome.path); }
                    catch (error) {
                        if (typeof app.alert === 'function')
                            app.alert('Could not open the exported IDML: ' + String(error && error.message || error));
                    }
                };
            } else {
                group.addStaticText('Status', failure);
            }
            dlg.runModal();
        }
    } catch (error) {
        const message = 'IDML export failed: ' + String(error && error.message || error);
        console.log(message);
        if (!globalThis.__IDML_SILENT__ && app && typeof app.alert === 'function') app.alert(message);
    }
})();
