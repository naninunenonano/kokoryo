// Deterministic concatenation. No transpilation, minification, eval or runtime
// loader. Preserve the original closure and statement/initialization order.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),acorn=require('acorn');
const root=path.resolve(__dirname,'..');
function assemble(directory=root){
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'src/order.json'),'utf8'));
 if(manifest.schema!==1)throw Error('Unknown source manifest schema');
 const sections=new Map(),files=new Set(manifest.sections.map(s=>s.file));
 for(const file of fs.readdirSync(path.join(directory,'src')).filter(f=>f.endsWith('.js')))
  if(!files.has(file))throw Error('Source file is not listed in order.json: '+file);
 for(const file of files){
  if(!/^[a-z_]+\.js$/.test(file))throw Error('Unsafe source path');
  const text=fs.readFileSync(path.join(directory,'src',file),'utf8');
  new vm.Script(text,{filename:'src/'+file});
  const pattern=/^\/\/ @kokoryo-section (S\d+)\n([\s\S]*?)\n\/\/ @kokoryo-end-section \1(?:\n|$)/gm;
  for(const m of text.matchAll(pattern)){
   if(sections.has(m[1]))throw Error('Duplicate source section '+m[1]);
   sections.set(m[1],{code:m[2],file});
  }
  const outside=text.replace(pattern,'');
  if(acorn.parse(outside,{ecmaVersion:'latest'}).body.length)throw Error('Code outside ordered sections in '+file);
 }
 let code=manifest.prefix,closed=false;const used=new Set();
 for(const entry of manifest.sections){
  const section=sections.get(entry.id);
  if(!section||section.file!==entry.file||used.has(entry.id))throw Error('Missing, moved or duplicate section '+entry.id);
  if(entry.epilogue){if(closed)throw Error('Duplicate epilogue');code+=manifest.close;closed=true}
  code+=section.code;used.add(entry.id);
 }
 if(!closed||used.size!==sections.size)throw Error('Unordered source section');
 new vm.Script(code,{filename:'js/app.js'});
 return {code,manifest};
}
function inlineHtml(directory=root){
 const html=fs.readFileSync(path.join(directory,'index.html'),'utf8'),code=fs.readFileSync(path.join(directory,'js/app.js'),'utf8');
 const tags=[...html.matchAll(/<script src="js\/app\.js(?:\?v=[0-9.]+)?"><\/script>/g)];
 if(tags.length!==1)throw Error('Expected one app script tag');
 return html.replace(tags[0][0],'<script>'+code+'</script>');
}
if(require.main===module){
 const {code}=assemble(),target=path.join(root,'js/app.js');
 if(process.argv.includes('--check')){
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==code)throw Error('Stale js/app.js: run npm run build');
  console.log('Bundle is current; private scope and original section order preserved.');
 }else{
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,code);
  console.log('Built js/app.js',Buffer.byteLength(code),'bytes; SHA256',crypto.createHash('sha256').update(code).digest('hex'));
 }
}
module.exports={assemble,inlineHtml};
