'use strict';

// Run a read-only Affinity probe from a local JavaScript file.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const managerRequire = createRequire(path.join(__dirname, '..', '..', '..', 'Affinity Script manager', 'script_mgr.js'));
const { Client } = managerRequire('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = managerRequire('@modelcontextprotocol/sdk/client/sse.js');
const { CallToolResultSchema } = managerRequire('@modelcontextprotocol/sdk/types.js');

async function main() {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: node tools/run_affinity_probe.cjs <probe.js>');
    const source = 'globalThis.__IDML_PROBE_ARGS__ = ' +
        JSON.stringify(process.argv.slice(3)) + ';\n' +
        fs.readFileSync(path.resolve(file), 'utf8');
    const client = new Client({ name: 'idml-probe', version: '1.0.0' });
    await client.connect(new SSEClientTransport(new URL('http://localhost:6767/sse')));
    try {
        await client.request({ method: 'tools/call',
            params: { name: 'read_sdk_documentation_topic', arguments: { filename: 'preamble' } } },
        CallToolResultSchema, { timeout: 60000 });
        const result = await client.request({ method: 'tools/call',
            params: { name: 'execute_script', arguments: { script: source } } },
        CallToolResultSchema, { timeout: 60000 });
        for (const part of result.content || []) if (part.type === 'text') console.log(part.text);
        if (result.isError) process.exitCode = 1;
    } finally { await client.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
