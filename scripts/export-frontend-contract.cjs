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
   routes.push({method:route.expression.getText().toUpperCase(),path:url,controller:cls.name.text,handler:method.name.getText(source),file:rel(file),line:source.getLineAndCharacterOfPosition(method.getStart(source)).line+1,guards,parameters:params,decorators:decs(method).map(d=>d.getText(source)),handlerSource:method.body?.getText(source)||''});
  }
 }
}
const target=path.join(root,'docs/frontend-handoff');fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(path.join(target,'api-contract.json'),JSON.stringify({generatedAt:new Date().toISOString(),note:'Source inventory, not OpenAPI. Controller guards are shown; service validation still applies.',routes,dtos},null,2));
let md='# Meet Elysia — সম্পূর্ণ API ও request field reference\n\nতারিখ: ১০ অক্টোবর ২০২৬। Controller ও DTO থেকে সরাসরি তৈরি; live API test নয়। মূল নির্দেশনা পড়ুন: [বাংলা integration guide](./frontend-integration-bn.md)।\n\n';
md+=`মোট **${routes.length}টি route**, **${dtos.length}টি DTO class**। কোনো real token/password/env value অন্তর্ভুক্ত নেই।\n\n`;
md+='## সব endpoint এক নজরে\n\n| Method | সম্পূর্ণ path | Controller-এ access | Handler |\n|---|---|---|---|\n';
const cell=s=>s.replaceAll('|','\\|').replace(/\s+/g,' ');
for(const r of routes)md+=`| ${r.method} | \`${r.path}\` | ${cell(r.guards.join('; ')||'JWT guard নেই; নিচের service/webhook নিয়ম দেখুন')} | ${r.handler} |\n`;
md+='\n## প্রতিটি endpoint-এর input ও response mapping\n\nJWT guard নেই মানেই external webhook বা Mini App unrestricted নয়। Signature/initData validation service-এ হয়। @Req() query-এর প্রকৃত allowlist handler-এর pick(...) এ দেওয়া আছে। Nest default status POST=201, অন্যগুলো=200, যদি @HttpCode বা raw response override না করে।\n\n';
for(const r of routes){md+=`### ${r.method} ${r.path}\n\nSource: \`${r.file}:${r.line}\` • Handler: \`${r.controller}.${r.handler}\`\n\nAccess: \`${r.guards.join('; ')||'Controller JWT guard নেই'}\`\n\nRequest parameters (নাম, DTO ও pipe অপরিবর্তিত):\n\n\`\`\`typescript\n${r.parameters.join('\n')||'// কোনো parameter নেই'}\n\`\`\`\n\nUpload/query/status metadata:\n\n\`\`\`typescript\n${r.decorators.join('\n')}\n\`\`\`\n\nController response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):\n\n\`\`\`typescript\n${r.handlerSource}\n\`\`\`\n\n`;}
md+='## Request DTO: সব field ও validation\n\nIsOptional থাকলে optional; PartialType(BaseDto) base-এর field optional করে; nested class-ও নিচে আছে। TypeScript ? একাই runtime validation নয়—decorator-ও অনুসরণ করুন। Update DTO-তে inheritance/OmitType থাকলে বাদ দেওয়া field পাঠাবেন না। ApiProperty example production default নয়।\n\n';
for(const d of dtos)md+=`### ${d.name}\n\nSource: \`${d.file}\`\n\n\`\`\`typescript\n${d.source}\n\`\`\`\n\n`;
fs.writeFileSync(path.join(target,'api-reference-bn.md'),md);
console.log(JSON.stringify({routes:routes.length,dtos:dtos.length,controllers:[...new Set(routes.map(r=>r.controller))]}));
