'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const managerRequire = createRequire('I:/Affinity/Affinity Script manager/script_mgr.js');
const { Client } = managerRequire('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = managerRequire('@modelcontextprotocol/sdk/client/sse.js');
const { CallToolResultSchema } = managerRequire('@modelcontextprotocol/sdk/types.js');

(async () => {
    const source = (process.argv[3] ? 'globalThis.__PROBE_FILE_PATH__ = ' +
        JSON.stringify(process.argv[3]) + ';\n' : '') +
        fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
    const client = new Client({ name: 'idml-host-probe', version: '1.0.0' });
    const transport = new SSEClientTransport(new URL('http://localhost:6767/sse'));
    try {
        await client.connect(transport);
        await client.request({ method: 'tools/call', params: {
            name: 'read_sdk_documentation_topic', arguments: { filename: 'preamble' }
        } }, CallToolResultSchema, { timeout: 60000 });
        const result = await client.request({ method: 'tools/call', params: {
            name: 'execute_script', arguments: { script: source }
        } }, CallToolResultSchema, { timeout: 120000 });
        const output = (result.content || []).filter(item => item.type === 'text')
            .map(item => item.text).join('\n');
        process.stdout.write(output + '\n');
        if (result.isError) process.exitCode = 1;
    } finally { await transport.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
