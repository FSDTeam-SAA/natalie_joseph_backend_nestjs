const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../docs/frontend-handoff');
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline = s => esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
function render(md){
 const lines=md.split(/\r?\n/);let out='',fence=false,code='',list=false,table=false;
 const endList=()=>{if(list){out+='</ul>';list=false;}};
 const endTable=()=>{if(table){out+='</tbody></table></div>';table=false;}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith('```')){endList();endTable();if(fence){out+='<pre><code>'+esc(code)+'</code></pre>';code='';}fence=!fence;continue;}
  if(fence){code+=line+'\n';continue;}
  if(line.startsWith('|')){
   endList();const cells=line.slice(1,-1).split(/(?<!\\)\|/).map(s=>s.trim().replaceAll('\\|','|'));
   if(cells.every(s=>/^:?-+:?$/.test(s)))continue;
   if(!table){out+='<div class="table"><table><thead><tr>'+cells.map(s=>'<th>'+inline(s)+'</th>').join('')+'</tr></thead><tbody>';table=true;}
   else out+='<tr>'+cells.map(s=>'<td>'+inline(s)+'</td>').join('')+'</tr>';
   continue;
  }
  endTable();
  const h=line.match(/^(#{1,6})\s+(.*)/);
  if(h){endList();out+=`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;continue;}
  if(/^(- |\d+\. )/.test(line)){if(!list){out+='<ul>';list=true;}out+='<li>'+inline(line.replace(/^(- |\d+\. )/,''))+'</li>';continue;}
  endList();if(line.trim())out+='<p>'+inline(line)+'</p>';
 }
 endList();endTable();if(fence)throw new Error('Unclosed code fence');return out;
}
const guide=render(fs.readFileSync(path.join(dir,'frontend-integration-bn.md'),'utf8'));
const ref=render(fs.readFileSync(path.join(dir,'api-reference-bn.md'),'utf8'));
const html=`<!doctype html><html lang="bn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meet Elysia — বাংলা Frontend Handoff</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f5fa;color:#18263c;font:17px/1.8 'Nirmala UI','Vrinda',sans-serif}main{max-width:1150px;margin:30px auto;background:white;padding:40px;border-radius:16px}nav{padding:18px;background:#eef2ff;border-radius:8px}a{color:#3449a8}h1{font-size:30px;line-height:1.4}h2{margin-top:45px;border-bottom:2px solid #dce3f3;padding-bottom:9px}h3{margin-top:32px}code{font:14px/1.6 Consolas,monospace;background:#eef2f8;padding:2px 4px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#13233c;color:#f1f5ff;padding:18px;border-radius:8px}pre code{background:none;color:inherit;padding:0}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:15px;margin:16px 0}td,th{text-align:left;vertical-align:top;border:1px solid #d7dfec;padding:10px;overflow-wrap:anywhere}th{background:#eaf0fb}summary{cursor:pointer;font-size:23px;font-weight:700;padding:20px;background:#eaf0fb}li{margin:8px 0}@media(max-width:700px){main{margin:0;padding:18px}h1{font-size:25px}}@media print{body{background:white}main{padding:0;margin:0;max-width:none}pre,table{font-size:11px}nav{display:none}h2,h3{break-after:avoid}}
</style><main><nav><a href="#guide">Integration guide</a> · <a href="#reference">সব API ও field</a> · <a href="api-contract.json">JSON inventory</a></nav><section id="guide">${guide}</section><details id="reference"><summary>সম্পূর্ণ API reference — ১০৭টি endpoint ও ৫৫টি DTO (খুলুন)</summary>${ref}</details></main></html>`;
fs.writeFileSync(path.join(dir,'frontend-integration-bn.html'),html);
console.log(JSON.stringify({output:path.join(dir,'frontend-integration-bn.html'),bytes:Buffer.byteLength(html)}));
