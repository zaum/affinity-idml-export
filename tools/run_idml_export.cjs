'use strict';

// Runs Export to IDML inside Affinity's MCP execution host, which can write files
// even when this machine's Scripts panel denies /fs access.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const managerRequire = createRequire(path.join(__dirname, '..', '..', '..', 'Affinity Script manager', 'script_mgr.js'));
const { Client } = managerRequire('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = managerRequire('@modelcontextprotocol/sdk/client/sse.js');
const { CallToolResultSchema } = managerRequire('@modelcontextprotocol/sdk/types.js');

const scriptPath = path.join(__dirname, '..', 'finished scripts', 'Export to IDML v1.16.0.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const transport = new SSEClientTransport(new URL('http://localhost:6767/sse'));
const client = new Client({ name: 'idml-export', version: '1.16.0' });

function content(result) {
    return (result.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
}

async function call(name, args) {
    return client.request({ method: 'tools/call', params: { name, arguments: args } },
        CallToolResultSchema, { timeout: name === 'execute_script' ? 300000 : 60000 });
}

async function main() {
    try {
        await client.connect(transport);
        await call('read_sdk_documentation_topic', { filename: 'preamble' });
        const existingIndex = process.argv.indexOf('--check-existing');
        const exportExistingIndex = process.argv.indexOf('--export-existing');
        const docTitleIndex = process.argv.indexOf('--doc-title');
        let importPath = existingIndex >= 0 ? process.argv[existingIndex + 1] : '';
        if (!importPath) {
            const openPath = exportExistingIndex >= 0 ? process.argv[exportExistingIndex + 1] : '';
            const script = openPath
                ? 'const { Document } = require("/document");' +
                    'const sourceDoc = Document.load(' + JSON.stringify(openPath) + ');' +
                    'try { globalThis.__IDML_SILENT__ = true;\n' + source + '\n}' +
                    ' finally { sourceDoc.close(); }'
                : 'globalThis.__IDML_SILENT__ = true;\n' +
                    (docTitleIndex >= 0 ? 'globalThis.__IDML_DOCUMENT_TITLE__ = ' +
                        JSON.stringify(process.argv[docTitleIndex + 1]) + ';\n' : '') + source;
            const result = await call('execute_script', { script });
            const output = content(result);
            console.log(output || JSON.stringify(result));
            if (result.isError || /IDML export failed:/i.test(output)) process.exitCode = 1;
            const match = output.match(/^IDML saved: ([^\r\n]+)/m);
            if (match) importPath = match[1];
        }
        if ((process.argv.includes('--check-import') || existingIndex >= 0) && !process.exitCode) {
            if (!importPath) throw new Error('The export did not report an IDML path.');
            const checkFonts = process.argv.includes('--check-fonts');
            const probe = 'const { Document } = require("/document");' +
                (checkFonts ? 'const { StoryApi, GlyphAttsApi } = require("affinity:story");' +
                    'const { FontApi } = require("affinity:fonts");' : '') +
                'let imported = null;' +
                'try { imported = Document.load(' + JSON.stringify(importPath) + ');' +
                'let frames = 0, chars = 0, firstBox = "", fontFaces = [], images = 0, vectors = 0;' +
                'for (const n of imported.layers.all) {' +
                'if (n.isImageNode) images++; if (n.isShapeNode || n.isPolyCurveNode) vectors++;' +
                'if (n.isFrameTextNode || n.isArtTextNode) {' +
                'frames++; chars += String(n.text || "").length;' +
                (checkFonts ? 'const r = n.storyRange, s = n.story;' +
                    'for (let p = r.begin; p < r.end; p++) {' +
                    'if (s.isParagraphBreak(p)) continue;' +
                    'const a = StoryApi.getGlyphAtts(s.handle,p), f = GlyphAttsApi.getFont(a);' +
                    'const face = FontApi.getFamilyName(f) + " / " + FontApi.getTraitsName(f);' +
                    'if (fontFaces.indexOf(face) < 0) fontFaces.push(face); }' : '') +
                'if (!firstBox) { const b = n.getSpreadBaseBox(false);' +
                'firstBox = [b.x,b.y,b.width,b.height].join(","); } } }' +
                'console.log("IDML import page count: " + imported.pageCount +' +
                '", text frames: " + frames + ", characters: " + chars + ", images: " + images +' +
                '", vectors: " + vectors + ", first box: " + firstBox +' +
                '", font faces: " + fontFaces.join("; ")); }' +
                'finally { if (imported) imported.close(); }';
            const check = await call('execute_script', { script: probe });
            const checkOutput = content(check);
            console.log(checkOutput || JSON.stringify(check));
            if (check.isError || !/IDML import page count:\s*\d+/.test(checkOutput)) process.exitCode = 1;
        }
    } finally {
        await transport.close();
    }
}

main().catch(error => { console.error(error && error.message || error); process.exitCode = 1; });
