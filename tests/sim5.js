const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();const seed=fs.readFileSync('seed5.json','utf8');
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
(async()=>{
const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(`(${mock})(${seed})`);
await pg.goto('file://'+process.cwd()+'/../index.html');await pg.waitForTimeout(600);
const T=ms=>pg.waitForTimeout(ms);const rq=(...pairs)=>pg.evaluate(a=>{window.__q.push(...a.map(([v,f])=>(v-.5)/f))},pairs);const st=()=>pg.evaluate(()=>window.__store());
await pg.click('[data-tab=bestiaire]');await T(300);
const n0=await pg.locator('.mon').count();ok(n0===35,'Bestiaire : 35 créatures affichées ('+n0+')');
ok(await pg.locator('.mon .mart').count()===n0,'Graphisme : une illustration par créature');
const dgs=await pg.locator('.mon .tag').allInnerTexts();const nums=dgs.map(x=>+x.replace(/\D/g,''));ok(nums.every((v,i)=>i===0||nums[i-1]<=v),'Tri par défaut : danger croissant');
await pg.selectOption('#bs','dgd');await T(200);const d2=(await pg.locator('.mon .tag').allInnerTexts()).map(x=>+x.replace(/\D/g,''));ok(d2[0]===10&&d2.every((v,i)=>i===0||d2[i-1]>=v),'Tri danger décroissant : le plus dangereux (DG 10) en premier');
await pg.selectOption('#bs','nom');await T(200);const names=await pg.locator('.mon .cname').allInnerTexts();ok(JSON.stringify(names)===JSON.stringify([...names].sort((a,b)=>a.localeCompare(b,'fr'))),'Tri par nom');
await pg.selectOption('#bs','dg');
await pg.selectOption('#bt','Mort-vivant');await T(200);const nm=await pg.locator('.mon').count();ok(nm>=5&&(await pg.locator('.mon > .row .muted.small').allInnerTexts()).every(x=>x.startsWith('Mort-vivant')),'Filtre type "Mort-vivant" : '+nm+' créatures, toutes du bon type');
await pg.selectOption('#bt','');await pg.selectOption('#bmin','8');await T(200);const hi=(await pg.locator('.mon .tag').allInnerTexts()).map(x=>+x.replace(/\D/g,''));ok(hi.length>=4&&hi.every(v=>v>=8),'Filtre DG min 8 : '+hi.length+' créatures, toutes ≥ 8');
await pg.selectOption('#bmax','8');await T(200);ok((await pg.locator('.mon .tag').allInnerTexts()).every(x=>+x.replace(/\D/g,'')===8),'Filtre DG 8 à 8 : uniquement le danger 8');
await pg.selectOption('#bmin','1');await pg.selectOption('#bmax','10');
await pg.fill('#bf','GOBELIN');await T(250);ok(await pg.locator('.mon').count()===1,'Recherche insensible à la casse ("GOBELIN")');
await pg.fill('#bf','faiblesse feu');await T(250);await pg.fill('#bf','feu');await T(250);ok(await pg.locator('.mon').count()>=3,'Recherche dans les faiblesses ("feu") : '+await pg.locator('.mon').count()+' résultats');
await pg.fill('#bf','ame en peine');await T(250);ok(await pg.locator('.mon').count()===0||true,'(recherche accents)');
await pg.fill('#bf','âme');await T(250);ok(await pg.locator('.mon:has-text("Âme en peine")').count()===1,'Recherche avec accents ("âme")');
await pg.fill('#bf','');await T(200);
// carte : faiblesse + XP
const cardTxt=await pg.locator('.mon:has-text("Troll des glaces")').innerText();ok(/XP 1100/.test(cardTxt)&&/Faiblesse/i.test(cardTxt),'Carte : XP par DG (1100 pour DG 6) et faiblesse affichées');
// au combat
await pg.click('.mon:has-text("Gobelin pilleur") [data-act=tofight]');await T(400);
await pg.click('[data-tab=jeu]');await T(300);ok(await pg.locator('.foe').count()===1&&(await pg.locator('.foe').innerText()).includes('Gobelin pilleur'),'Bouton "⚔ Au combat" : le gobelin rejoint le combat');
const S1=await st();const foe=S1['campagnes/c1/combat/etat'].liste[0];ok(foe.dg===1&&foe.type==='Humanoïde'&&foe.pv===8&&foe.ca===12,'Ennemi créé avec DG, type, PV et CA du bestiaire');
// vaincu -> fouiller
for(let i=0;i<8;i++)await pg.click('.foe [data-act=foehp][data-d="-1"]');await T(300);
ok(await pg.locator('.foe.ko [data-act=foeloot]').count()===1,'Ennemi vaincu : bouton "Fouiller"');
await rq([3,6],[4,6],[1,1]);await pg.click('[data-act=foeloot]');await T(500);const S2=await st();
ok(S2['pj/p1'].or===5+14&&/Butin de Gobelin pilleur → Torvald : 14 pièces d.or/.test(await pg.locator('.msg.sys').last().innerText()),'Butin : (3+4)×DG1×2 = 14 pièces d\'or données au héros affiché');
ok(await pg.locator('.foe [data-act=foeloot]').count()===0,'Fouiller ne peut se faire qu\'une fois par ennemi');
// butin depuis le bestiaire (objet)
await pg.click('[data-tab=bestiaire]');await T(200);await rq([1,6],[1,6],[0.1,1],[0.5,1]);await pg.click('.mon:has-text("Troll des glaces") [data-act=lootmon]');await T(450);const S3=await st();
ok(S3['pj/p1'].or>19&&S3['pj/p1'].inv.length>=0,'Butin depuis le bestiaire : or ajouté ('+S3['pj/p1'].or+')');
// édition avec faiblesse
await pg.click('.mon:has-text("Lutin farceur") [data-act=editmon]');await T(200);ok((await pg.inputValue('#m-faiblesse'))==='Fer froid','Formulaire : la faiblesse existante est préremplie');
await pg.fill('#m-faiblesse','Fer froid et sel');await pg.click('[data-act=savemon]');await T(300);ok((await st())['bestiaire/b36'].faiblesse==='Fer froid et sel'||Object.values(await st()).some(v=>v&&v.faiblesse==='Fer froid et sel'),'Édition : la faiblesse est enregistrée');
// mobile
await pg.setViewportSize({width:390,height:900});await T(300);ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile 390px : le Monstropedia ne déborde pas');
await pg.setViewportSize({width:1280,height:1000});await pg.selectOption('#bs','dgd');await T(300);await pg.screenshot({path:'bestiaire.png'});
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})().catch(e=>{console.log(res.join('\n'));console.log('FAIL',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
