// One-time, lossless migration from the verified upstream index.html.
// No game expressions, declarations, function bodies or whitespace are rewritten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const acorn=require('acorn');
const root=path.resolve(__dirname,'..');
const input=process.argv[2];
if(!input)throw Error('Usage: node tools/split_once.cjs BASELINE_INDEX');
const original=fs.readFileSync(input,'utf8');
const bytes=Buffer.from(original),blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
if(blob!=='038de1a2aa8c5ebcda89f7391673446644daf270')throw Error('Migration only supports the pinned Ver.0.3.220 baseline');
if(fs.readdirSync(path.join(root,'src')).some(f=>f.endsWith('.js'))&&!process.argv.includes('--overwrite-reviewed-migration'))
 throw Error('Source files already exist; do not rerun the one-time migration over edits');
const matches=[...original.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m=>m[1].trim());
if(matches.length!==1)throw Error('Expected one original inline script');
const match=matches[0],source=match[1];
const program=acorn.parse(source,{ecmaVersion:'latest',locations:true});
const outer=program.body[0];
if(outer.type!=='ExpressionStatement'||outer.expression.type!=='CallExpression'||outer.expression.callee.type!=='ArrowFunctionExpression')throw Error('Unknown closure');
const body=outer.expression.callee.body;
const roles=['game','card_effects','characters','decks','ui','bot','online','debug','bootstrap'];
function role(n){
 const name=n.id?.name||n.declarations?.[0]?.id?.name||'',line=n.loc.start.line;
 if(line>=3591)return 'online';
 if(line>=3390){
  if(name==='turnClockRender')return 'ui';
  if(name==='turnClockBotValid')return 'bot';
  return n.type==='FunctionDeclaration'||n.type==='VariableDeclaration'?'game':'bootstrap';
 }
 if(line>=3351)return 'bootstrap';
 if(line===3341)return 'bootstrap';
 if(line>=2941)return 'bot';
 if(line>=2404)return 'online';
 if(line>=2386)return name==='enterLocalDebugMode'?'debug':(n.type==='ExpressionStatement'?'bootstrap':'game');
 if(line>=2379)return 'bootstrap';
 if(line>=2353)return 'ui';
 if(line>=2344)return 'bootstrap';
 if(line>=2301)return 'online';
 if(line>=2298)return 'bootstrap';
 if(line>=2279)return 'ui';
 if(line>=2201)return 'debug';
 if(/^debug|Debug|^logNormalCardAudit|^resetNormalCardAudit/.test(name))return 'debug';
 if(line>=1265&&line<=1511)return 'debug';
 if(/^render|^show|^open|^append|^addHandPreview|^addFieldCardPreview|^card$|^contentImage|^resolvedContentImage|^effectText$|^castEffectText$|^characterAbilityText$|^costTextForCard|^cleanCardEffect|^iconizeEffectText|^cardInfoSections|^makeSetupChoiceButton|^updateCharacterSelectAvailability|^turnStartResourceButtons|^optionSelect|^costSelect|^makeChoicePicker|^fillRCSelect|^refreshActiveRulesButton|^syncMarketTargetUI|^vpLabel$|^cname$/.test(name))return 'ui';
 if(n.type!=='FunctionDeclaration'&&n.type!=='VariableDeclaration'){
  if(line<=150)return 'characters';
  if(line<=498)return 'decks';
  if(line===1081)return 'characters';
  return 'bootstrap';
 }
 if(line<=175){
  if(['q'].includes(name))return 'game';
  if(['CONTENT_ID_LIMITS','isReservedContentId','KOKORYO_PACKS','CONTENT_IMAGE_DIRS','contentBaseId'].includes(name))return 'decks';
  return 'characters';
 }
 if(line<216)return 'characters';
 if(line<=283)return 'decks';
 if(line===284)return 'characters';
 if(line<=315)return 'game';
 if(line<=334)return ['handLimitNeedsDiscard','totalHandCount'].includes(name)?'game':'card_effects';
 if(line<=402)return name==='lordInstallDiceDiscount'?'characters':'game';
 if(line<=435)return 'decks';
 if(line<=451)return ['effectiveHireLimit','isHireFree'].includes(name)?'characters':(name==='runRuleHook'?'card_effects':'decks');
 if(line<=469)return 'game';
 if(line<=508)return 'decks';
 if(line<=620)return 'card_effects';
 if(line<=655)return 'game';
 if(line===656)return 'characters';
 if(line===674)return 'card_effects';
 if(line===683)return 'game';
 if(line<=686)return 'characters';
 if(line<=738)return 'game';
 if(line<=941)return /^(hasGodBlessingForTurn|fieldUniqueAbilities|abilityProfile|recreationRangeForTurn|resolveAbilityCopyLegend)$/.test(name)?'characters':'card_effects';
 if(line<=988)return ['dynamicSpecialVP','cardVP'].includes(name)?'card_effects':'game';
 if(line<=1255)return 'characters';
 if(line<=1576)return ['addDialog','dialogLog'].includes(name)?'debug':'characters';
 if(line<=1940){
  if(name==='isViewingOwnTurn')return 'game';
  if(name==='groups')return 'decks';
  if(/^(organizationUpgradeRarity|organizationPool|upgradeRarity|packCastPool|oneStepUpgradeCast|organizationMaterialGroups|usePromoteCastPair|useDoubleHire|useFran|useSora)$/.test(name))return 'characters';
  return 'card_effects';
 }
 if(line<=2157)return 'ui';
 if(line<=2161)return 'characters';
 if(line===2162)return 'decks';
 if(line<=2166)return 'bootstrap';
 if(line<=2182)return 'game';
 if(line<=2184)return 'card_effects';
 return 'game';
}
const chunks=[];let position=body.start+1;
for(const node of body.body){
 const file=role(node),text=source.slice(position,node.end);
 const symbols=node.id?[node.id.name]:(node.declarations||[]).flatMap(d=>d.id.type==='Identifier'?[d.id.name]:[]);
 const last=chunks.at(-1);
 if(last?.file===file){last.code+=text;last.symbols.push(...symbols)}
 else chunks.push({file,code:text,symbols});
 position=node.end;
}
const prefix=source.slice(0,body.start+1),close=source.slice(position,outer.end);
const epilogue=source.slice(outer.end);
chunks.push({file:'bootstrap',code:epilogue,symbols:['global q / existing outer event handlers'],epilogue:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const normalize=s=>s.replaceAll('0.3.220','VERSION').replaceAll('0.3.221','VERSION');
const manifest={schema:1,upstream:{repository:'naninunenonano/kokoryo',commit:'2dc96523a6c447babee2e54245955e2c9935d77c',version:'0.3.220',indexBlob:'038de1a2aa8c5ebcda89f7391673446644daf270',normalizedScriptSha256:sha(normalize(source)),normalizedHtmlSha256:sha(normalize(original))},prefix,close,sections:[]};
const files=Object.fromEntries(roles.map(r=>[r,'// Editing source only. Build with npm run build; do not load this file directly.\n// Section order and the shared private scope are preserved by src/order.json.\n']));
for(const [i,c] of chunks.entries()){
 const id='S'+String(i+1).padStart(4,'0');
 files[c.file]+='\n// @kokoryo-section '+id+'\n'+c.code+'\n// @kokoryo-end-section '+id+'\n';
 manifest.sections.push({id,file:c.file+'.js',symbols:c.symbols,...(c.epilogue?{epilogue:true}:{})});
}
for(const [name,text] of Object.entries(files))fs.writeFileSync(path.join(root,'src',name+'.js'),text.replaceAll('0.3.220','0.3.221'));
fs.writeFileSync(path.join(root,'src/order.json'),JSON.stringify(manifest,null,2)+'\n');
const html=original.slice(0,match.index)+'<script src="js/app.js?v=0.3.221"></script>'+original.slice(match.index+match[0].length);
fs.writeFileSync(path.join(root,'index.html'),html.replaceAll('0.3.220','0.3.221'));
console.log('Lossless sections:',chunks.length,Object.fromEntries(roles.map(r=>[r,manifest.sections.filter(s=>s.file===r+'.js').length])));
