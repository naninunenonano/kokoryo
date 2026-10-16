// Conservative static inventory. Dynamic eval keys / runtime pack hooks are
// explicitly not claimed to be a complete statically resolved call graph.
const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),manifest=require('../src/order.json');
const ownership={},functions=[];
for(const file of new Set(manifest.sections.map(s=>s.file))){
 const code=fs.readFileSync(path.join(root,'src',file),'utf8');
 const p=acorn.parse(code,{ecmaVersion:'latest',locations:true});
 for(const n of p.body){
  if(n.type==='FunctionDeclaration'){ownership[n.id.name]=file;functions.push({name:n.id.name,file,line:n.loc.start.line,node:n})}
  if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.type==='Identifier'&&!Object.hasOwn(ownership,d.id.name))ownership[d.id.name]=file;
 }
}
function identifiers(node,out=new Set(),parent=null,key=''){
 if(!node||typeof node!=='object')return out;
 if(node.type==='Identifier'){
  if(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)return out;
  if(parent?.type==='Property'&&key==='key'&&!parent.computed&&!parent.shorthand)return out;
  if((parent?.type==='FunctionDeclaration'&&key==='id')||(parent?.type==='VariableDeclarator'&&key==='id'))return out;
  out.add(node.name);
 }
 for(const [k,v] of Object.entries(node)){
  if(k==='loc'||k==='start'||k==='end')continue;
  if(Array.isArray(v))v.forEach(x=>identifiers(x,out,node,k));else if(v&&typeof v==='object')identifiers(v,out,node,k);
 }
 return out;
}
const inventory=functions.map(({node,...f})=>({...f,references:[...identifiers(node)].filter(n=>ownership[n]&&ownership[n]!==f.file).sort().map(name=>({name,file:ownership[name]}))}));
const report={baseline:manifest.upstream.commit,method:'Conservative identifier references; possible local-name overlap. Dynamic eval, window registries and pack hooks need runtime tests.',initializationOrder:'src/order.json; one unchanged shared IIFE; epilogue remains outside',functions:inventory,bindings:ownership};
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/dependencies.json'),JSON.stringify(report,null,2)+'\n');
const files=[...new Set(manifest.sections.map(s=>s.file))];
let md='# 依存関係・移動台帳\n\n基準: `'+manifest.upstream.commit+'` / Ver.0.3.220。\n\n';
md+='全関数・変数は元の共有クロージャに残る。ファイルの記載順ではなく `src/order.json` が初期化・イベント登録・タイマー登録順を決める。\n\n';
md+='| 編集用ファイル | 関数宣言数 | 他ファイルへの参照候補 |\n| --- | ---: | --- |\n';
for(const file of files){const rows=inventory.filter(x=>x.file===file),deps=[...new Set(rows.flatMap(x=>x.references.map(r=>r.file)))].sort();md+='| '+file+' | '+rows.length+' | '+deps.join(', ')+' |\n'}
md+='\n参照一覧は `dependencies.json`。保守的な識別子抽出であり、ローカル変数の同名を含む可能性がある。動的 `eval`（オンライン状態適用）・追加パックのフック・`window` 登録は静的解析だけでは完全に解決できない。\n\n';
md+='## 保持する境界\n\n- 既存の関数名・変数名・宣言の種類・関数本体は変更しない。\n- SDK → pack1 → pack2 → rules_pack1 → app の読み込み順を維持。\n- `window.KOKORYO_PACKS` / `KOKORYO_RULE_PACKS` と Pack API を維持。\n- 本体は既存のIIFE内、末尾の画面ハンドラは従来どおりIIFE外。新たな公開グローバルは作らない。\n- 非同期コールバック、Bot待機、時計のリース、オンラインの動的変数参照も同じスコープを参照する。\n- 保存キー・保存形式・画像パス・カードIDは変更しない。\n- pack3.js は基準リポジトリに存在しないため、空のパックや新しい登録処理を追加しない。\n';
fs.writeFileSync(path.join(root,'docs/DEPENDENCIES.md'),md);
console.log('Inventoried',inventory.length,'functions and',Object.keys(ownership).length,'bindings.');
