const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
const seed={'pj/p1793705800633':{ca:10,classe:'Mage',equip:{},etats:[],histo:'Artisan',inv:[],name:'Krazy Karl',niveau:1,notes:'',or:0,pm:0,pmMax:0,pv:10,pvMax:10,race:'Human',stats:{cha:10,con:10,dex:10,int:10,str:10,wis:10},xp:0}};
(async()=>{const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.addInitScript(`(${mock})(${JSON.stringify(seed)})`);
await pg.goto('file://'+process.cwd()+'/../index.html');await pg.waitForTimeout(600);const T=ms=>pg.waitForTimeout(ms);
await pg.click('[data-tab=jeu]');await T(300);
ok(await pg.locator('[data-act=fullkit]').count()===1,'Ancien héros sans attaque : le bouton "Kit de départ complet" est proposé');
await pg.click('[data-act=fullkit]');await T(500);
const e=await pg.evaluate(()=>Object.values(window.__store())[0]);
ok(e.atq.length===3&&e.atq.some(a=>a.nom==='Trait de feu'),'Kit : 3 attaques de Mage');
ok(e.pmMax>0&&e.pm===e.pmMax,'Kit : PM de départ ('+e.pmMax+')');
ok(!Object.values(e.stats).every(v=>v===10)&&e.stats.int>=e.stats.str,'Kit : stats tirées (elles étaient toutes à 10), INT ≥ FOR : '+JSON.stringify(e.stats));
ok(e.equip.torse&&e.inv.length>=3&&e.comp.length===3&&e.caAuto===true,'Kit : équipement, sac, 3 compétences, CA automatique');
ok(await pg.locator('.atk').count()===3&&await pg.locator('[data-act=fullkit]').count()===0,'Interface : tuiles d\'attaque affichées, bouton disparu');
// un héros dont les stats ont été réglées à la main n'est pas écrasé
const stats0=JSON.stringify(e.stats);await pg.click('[data-act=kit]').catch(()=>{});
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})().catch(e=>{console.log(res.join('\n'));console.log('FAIL',e.message.split('\n')[0]);process.exit(1)});
