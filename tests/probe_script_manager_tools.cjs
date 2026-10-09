'use strict';
const path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.join(__dirname,'..','..','..','Affinity Script manager','script_mgr.js'));
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {SSEClientTransport}=req('@modelcontextprotocol/sdk/client/sse.js');
(async()=>{const c=new Client({name:'idml-manager-probe',version:'1.0'});const t=new SSEClientTransport(new URL('http://localhost:6767/sse'));console.log('connecting');await c.connect(t);console.log('connected');const x=await c.listTools({},{timeout:10000});console.log(JSON.stringify(x.tools.filter(y=>/script|library/i.test(y.name)).map(y=>({name:y.name,inputSchema:y.inputSchema}))));await t.close()})().catch(e=>{console.error(String(e));process.exitCode=1});

