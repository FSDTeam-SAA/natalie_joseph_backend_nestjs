const fs = require('node:fs');
const path = require('node:path');
// Documentation only. Never load credentials, start the app or contact services.
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const contract = JSON.parse(read('docs/frontend-handoff/api-contract.json'));
const purpose = {
 'ChatController.sendMessage':'Send a text or voice-mode request; preserve requestId on retry. Approved library matches bypass generation.',
 'LifestyleController.photo':'Request an approved unseen library photo; paid users fall back to generation when no match exists.',
 'LifestyleAdminController.importGallery':'Import missing companion gallery URLs as pending library entries.',
 'LifestyleAdminController.upload':'Upload an image to the companion photo library for review.',
 'LifestyleAdminController.approve':'Approve a library photo or return it to pending.',
 'LifestyleAdminController.editPhoto':'Edit a library photo caption and normalized tags.',
 'LifestyleAdminController.removePhoto':'Remove a library entry while retaining assets used by delivered chat history.',
 'CompanionsController.addGalleryImages':'Append gallery uploads and create pending photo-library entries.',
 'CompanionsController.updateGalleryImages':'Replace the gallery, revoke removed library approvals and import new uploads as pending.',
 'CompanionsController.removedOneGallaryImage':'Remove a gallery URL and revoke matching library approval.',
 'EngagementAdminController.reply':'Save an admin human-mode reply; do not assume an outbound Telegram push.',
 'PaymentController.paySubscriber':'Start local-plan activation or recurring subscription checkout.',
 'PaymentController.buyCredits':'Start credit-package checkout using packageId; never trust a client-supplied price.',
 'TelegramConnectController.connect':'Create a short-lived, single-use link for the selected companion.',
 'TelegramMiniAppController.login':'Verify signed Telegram initData and website credentials before linking accounts.',
 'WebhookController.handleWebhook':'Process the signed payment-provider webhook; this is not a frontend endpoint.',
};
const humanize = text => text.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase());
const describe = route => purpose[`${route.controller}.${route.handler}`] || `${humanize(route.handler)} (${route.controller.replace(/Controller$/,'')}). Follow the exact handler and DTO below.`;
const cell = value => String(value).replaceAll('|','\\|').replace(/\s+/g,' ');
let md=`# Meet Elysia - Complete frontend and admin API handbook\n\nEnglish handoff generated from local source: **${contract.routes.length} routes**, **${contract.dtos.length} DTO classes**. Legacy filenames containing BN are retained for link compatibility; all document text is English. This is not a live deployment certificate.\n\nLocal base: \`http://localhost:8080/api/v1\`. Swagger: \`/api/docs\` when enabled. Browser environment variables may contain public API origins and publishable payment keys, never server secrets.\n\n## Reading order\n\n1. Integration flow guide\n2. Profile publishing and 24-hour media stories\n3. Lifestyle, library, billing and allowances\n4. Endpoint index and exact source mapping\n5. DTO validation and enum appendix\n\n`;
for(const [title,file] of [
 ['Integration flow guide','docs/frontend-handoff/frontend-integration-bn.md'],
 ['Profile publishing and media stories','docs/frontend-handoff/companion-publishing-bn.md'],
 ['Lifestyle and photo-library integration','docs/README-lifestyle-handoff-bn.md'],
 ['External AI contract','docs/ai-lifestyle-contract.md'],
]) md+=`\n# ${title}\n\n${read(file)}\n`;
md+='\n# Endpoint index\n\n| Method | Full path | Purpose | Access |\n|---|---|---|---|\n';
for(const route of contract.routes) md+=`| ${route.method} | \`${route.path}\` | ${cell(describe(route))} | ${cell(route.guards.join('; ')||'Service, signature or provider validation applies')} |\n`;
md+='\n# Exact API request and response mapping\n\nController source is response mapping, not a live response example. Normal JSON responses receive the global success envelope. Raw HTML/media and provider webhook responses may differ. An absent JWT guard does not bypass service-level signatures, initData validation or resource ownership checks.\n';
for(const route of contract.routes) md+=`\n## ${route.method} ${route.path}\n\n${describe(route)}\n\nSource: \`${route.file}:${route.line}\`\n\nAccess: \`${route.guards.join('; ')||'Service/provider validation applies'}\`\n\nRequest parameters and DTOs:\n\n\`\`\`typescript\n${route.parameters.join('\n')||'// No explicit parameters'}\n\`\`\`\n\nUpload/status/validation metadata:\n\n\`\`\`typescript\n${route.decorators.join('\n')}\n\`\`\`\n\nController response mapping:\n\n\`\`\`typescript\n${route.handlerSource}\n\`\`\`\n`;
md+='\n# DTO fields, nested objects and runtime validation\n\nIsOptional marks optional fields; PartialType makes inherited fields optional. Follow Type/ValidateNested and OmitType declarations. ApiProperty examples are not production defaults. TypeScript optional syntax alone does not establish runtime validation. Do not send unsupported permission fields.\n';
for(const dto of contract.dtos) md+=`\n## ${dto.name}\n\nSource: \`${dto.file}\`\n\n\`\`\`typescript\n${dto.source}\n\`\`\`\n`;
md+='\n# Response enums\n\nDatabase/response enum values are not automatically valid in every request DTO. For example, SendMessageDto accepts text/voice input while responses can contain images.\n\n```prisma\n'+read('prisma/schema/enum.prisma')+'\n```\n';
md+='\n# Refreshing this handbook\n\nRun these commands from the backend repository after changing routes or DTOs:\n\n```powershell\nnode scripts/export-frontend-contract.cjs\nnode scripts/build-full-frontend-readme.cjs\nnode scripts/render-frontend-handoff.cjs\n```\n\nReview business-flow prose when services change; route extraction cannot verify billing, provider quality or live delivery.\n';
const fences=md.split('\n').filter(line=>line.startsWith('```')).length;
if(fences%2) throw new Error('Unbalanced Markdown code fences');
for(const route of contract.routes) if(!md.includes(`## ${route.method} ${route.path}\n`)) throw new Error(`Missing route ${route.path}`);
if(/[\u0980-\u09ff]/u.test(md)) throw new Error('Non-English Bengali text remains in handbook inputs');
const output='docs/frontend-handoff/README-FRONTEND-FULL-BN.md';
fs.writeFileSync(path.join(root,output),md.trim()+'\n');
console.log(JSON.stringify({file:output,routes:contract.routes.length,dtos:contract.dtos.length,bytes:Buffer.byteLength(md)}));
