'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.join(__dirname, '..', '..', '..', 'Affinity Script manager', 'script_mgr.js'));
const { Client } = req('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = req('@modelcontextprotocol/sdk/client/sse.js');
const { CallToolResultSchema } = req('@modelcontextprotocol/sdk/types.js');
const file = process.argv[2];
if (!file) throw new Error('Pass a probe script path.');
const source = fs.readFileSync(path.resolve(file), 'utf8');
(async () => {
    const client = new Client({ name: 'idml-document-probe', version: '1.0.0' });
    const transport = new SSEClientTransport(new URL('http://localhost:6767/sse'));
    try {
        await client.connect(transport);
        await client.request({ method: 'tools/call', params: {
            name: 'read_sdk_documentation_topic', arguments: { filename: 'preamble' }
        } }, CallToolResultSchema, { timeout: 30000 });
        const result = await client.request({ method: 'tools/call', params: {
            name: 'execute_script', arguments: { script: source }
        } }, CallToolResultSchema, { timeout: 30000 });
        for (const item of result.content || []) if (item.type === 'text') console.log(item.text);
        if (result.isError) process.exitCode = 1;
    } finally { await transport.close(); }
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
