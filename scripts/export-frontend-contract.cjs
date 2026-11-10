// Read-only source inventory. Does not load env, start Nest, or contact providers.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const walk = p => fs.readdirSync(p, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : [path.join(p,e.name)]);
const files = walk(path.join(root,'src')).filter(p => p.endsWith('.ts') && !p.includes(`${path.sep}generated${path.sep}`));
const decs = n => ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : [];
const call = d => ts.isCallExpression(d.expression) ? d.expression : null;
const named = (n,name) => decs(n).map(call).filter(Boolean).find(c => c.expression.getText() === name);
const literal = n => n && ts.isStringLiteralLike(n) ? n.text : '';
const rel = p => path.relative(root,p).replaceAll('\\','/');
const routes=[]; const dtos=[];
for(const file of files){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 for(const cls of source.statements.filter(ts.isClassDeclaration)){
  if(cls.name?.text.endsWith('Dto')) dtos.push({name:cls.name.text,file:rel(file),source:cls.getText(source)});
  const ctl=named(cls,'Controller'); if(!ctl)continue;
  for(const method of cls.members.filter(ts.isMethodDeclaration)){
   const route=decs(method).map(call).filter(Boolean).find(c=>['Get','Post','Put','Patch','Delete','Head','Options','All'].includes(c.expression.getText())); if(!route)continue;
   const tail=[literal(ctl.arguments[0]),literal(route.arguments[0])].filter(Boolean).join('/');
   const url=['','privacy-policy','terms','data-deletion'].includes(tail)?'/'+tail:'/api/v1/'+tail;
   const guards=[named(cls,'UseGuards'),named(method,'UseGuards')].filter(Boolean).map(c=>c.getText(source));
   const params=method.parameters.map(p=>p.getText(source));
   routes.push({method:route.expression.getText().toUpperCase(),path:url,controller:cls.name.text,handler:method.name.getText(source),file:rel(file),line:source.getLineAndCharacterOfPosition(method.getStart(source)).line+1,swaggerVisible: !named(cls,'ApiExcludeController') && !named(method,'ApiExcludeEndpoint'),guards,parameters:params,decorators:decs(method).map(d=>d.getText(source)),handlerSource:method.body?.getText(source)||''});
  }
 }
}
const target=path.join(root,'docs/frontend-handoff');fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(path.join(target,'api-contract.json'),JSON.stringify({generatedAt:new Date().toISOString(),note:'Source inventory, not OpenAPI. Controller guards are shown; service validation still applies.',routes,dtos},null,2));
let md='# Meet Elysia - Complete API and request-field reference\n\nGenerated directly from controller and DTO source; this is not a live API test. See the [integration guide](./frontend-integration-bn.md) and [lifestyle guide](../README-lifestyle-handoff-bn.md).\n\n';
md+=`**${routes.length} routes**, **${dtos.length} DTO classes**. No credentials or customer data are included.\n\n`;
md+='## Endpoint index\n\n| Method | Full path | Controller access | Handler |\n|---|---|---|---|\n';
const cell=s=>s.replaceAll('|','\\|').replace(/\s+/g,' ');
for(const r of routes)md+=`| ${r.method} | \`${r.path}\` | ${cell(r.guards.join('; ')||'Service, signature or webhook validation applies')} | ${r.handler} |\n`;
md+='\n## Exact endpoint inputs and response mapping\n\nAn absent JWT guard does not make a signed webhook or Mini App unrestricted. Services validate signatures and Telegram initData. Handler pick(...) calls define query allowlists. Nest defaults to POST=201 and other methods=200 unless overridden. Controller source shows response mapping, not a live response example.\n\n';
for(const r of routes){md+=`### ${r.method} ${r.path}\n\nSource: \`${r.file}:${r.line}\` - Handler: \`${r.controller}.${r.handler}\`\n\nAccess: \`${r.guards.join('; ')||'Service/provider validation applies'}\`\n\nRequest parameters, DTOs and pipes:\n\n\`\`\`typescript\n${r.parameters.join('\n')||'// No explicit parameters'}\n\`\`\`\n\nUpload/query/status metadata:\n\n\`\`\`typescript\n${r.decorators.join('\n')}\n\`\`\`\n\nController response mapping (normal JSON responses receive the global success envelope):\n\n\`\`\`typescript\n${r.handlerSource}\n\`\`\`\n\n`;}
md+='## Request DTO fields and validation\n\nIsOptional makes a field optional; PartialType makes inherited fields optional. Follow runtime decorators, nested Type/ValidateNested declarations and OmitType exclusions. ApiProperty examples are not production defaults.\n\n';
for(const d of dtos)md+=`### ${d.name}\n\nSource: \`${d.file}\`\n\n\`\`\`typescript\n${d.source}\n\`\`\`\n\n`;
fs.writeFileSync(path.join(target,'api-reference-bn.md'),md);
const visible=routes.filter(r=>r.swaggerVisible);
let frontend='# Website and Dashboard - Frontend API index\n\nThese routes are visible in Swagger. Internal webhooks, implementation pages and health routes remain in the full source inventory. Connect and signed-media endpoints are retained where frontend integration requires them.\n\n';
frontend+=`**${visible.length} frontend-visible routes**. See the [complete handbook](README-FRONTEND-FULL-BN.md) for request and response mapping.\n\n| Method | API | Access | Handler |\n|---|---|---|---|\n`;
for(const r of visible)frontend+='| '+r.method+' | '+r.path+' | '+cell(r.guards.join('; ')||'Public or service-level validation')+' | '+r.handler+' |\n';
fs.writeFileSync(path.join(target,'FRONTEND-API-ONLY-BN.md'),frontend);
console.log(JSON.stringify({routes:routes.length,dtos:dtos.length,swaggerVisible:visible.length,internalHidden:routes.length-visible.length}));
