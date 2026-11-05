const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:820}});const pg=await ctx.newPage();
const errs=global.__errs=[];pg.on('pageerror',e=>errs.push('PAGE '+e.message));pg.on('console',m=>m.type()==='error'&&errs.push('CONSOLE '+m.text()));
await pg.addInitScript(`(${mock})(null)`);
const url='file://'+process.cwd()+'/../index.html';
await pg.goto(url);await pg.waitForTimeout(400);
global.__pg=pg;const T=ms=>pg.waitForTimeout(ms);
const say=async t=>{const n=await pg.locator('.msg.mj').count();await pg.fill('#say',t);await pg.press('#say','Enter');
  await pg.waitForFunction(n=>document.querySelectorAll('.msg.mj').length>n&&!document.querySelector('#think'),n,{timeout:8000}).catch(()=>{});await T(150)};
const newHero=async(name,race,cls)=>{await pg.click('[data-act=newpjr]');await pg.fill('#n-name',name);
  if(race)await pg.selectOption('#n-race-s',race);
  if(cls==='custom'){await pg.selectOption('#n-classe-s','__autre');await pg.fill('#n-classe-o','Chevaucheur de brume')}else if(cls)await pg.selectOption('#n-classe-s',cls);
  await pg.click('[data-act=createpj]');await T(250)};
const setStat=async(k,v)=>{await pg.fill('#s-'+k,String(v));await pg.press('#s-'+k,'Tab');await T(100)};

// ===== SESSION A : premier lancement, 2 héros, campagne 1 =====
ok(await pg.locator('#p-camps').isVisible(),'A: sans campagne, on arrive sur l\'onglet Campagnes');
await pg.click('[data-tab=jeu]');ok(await pg.locator('#right .note').count()>0,'A: la table sans campagne affiche un message d\'aide');
await pg.click('[data-tab=camps]');
await newHero('Maëlys','Elf','Ranger');await setStat('dex',16);await pg.fill('[data-f=pvMax]','12');await pg.press('[data-f=pvMax]','Tab');await pg.click('[data-step=pv][data-d="1"]');
await pg.click('[data-tab=camps]');await newHero('Torvald','Dwarf','Warrior');
await pg.click('[data-tab=camps]');
ok(await pg.locator('#p-camps .card:has(.portrait)').count()===2,'A: le roster liste 2 personnages');
await pg.fill('#nc-nom','La Tour des Cendres');await pg.fill('#nc-ton','sombre');
await pg.check('.nc-p >> nth=0');await pg.check('.nc-p >> nth=1');await pg.click('[data-act=createcamp]');await T(300);
ok(await pg.locator('#p-monde').isVisible(),'A: après création on arrive sur le Monde');
ok((await pg.locator('.mp:checked').count())===2,'A: les 2 héros sont dans le groupe');
await pg.click('[data-act=genmonde]');await T(300);
ok((await pg.inputValue('#c-monde')).includes('cendres'),'A: Claude génère le monde');
await pg.click('[data-tab=jeu]');await T(200);
ok((await pg.locator('#camp-line').innerText()).includes('2 héros'),'A: en-tête = campagne + 2 héros');
await say('Je pousse la porte de la tour.');
ok(await pg.locator('.msg.roll').count()>=1,'A: jet de dés posté par le MJ');
ok(await pg.locator('.chip[data-sugg]').count()===3,'A: 3 suggestions d\'action');
await pg.click('.chip[data-sugg] >> nth=0');ok((await pg.inputValue('#say')).length>3,'A: clic suggestion remplit la saisie');
await say('J\'attaque la goule !');
ok(await pg.locator('#left .hp b').innerText().then(t=>t.includes('PV 4')),'A: PV mis à jour par le MJ (4)');
ok(await pg.locator('.chip.on:has-text("Empoisonné")').count()===1,'A: état Empoisonné actif');
await pg.click('[data-tab=bestiaire]');const nBest=await pg.locator('#p-bestiaire article').count();ok(nBest===1,'A: bestiaire local = 1 goule (pas de doublon) → '+nBest);
await pg.click('[data-tab=jeu]');
await say('Je fouille la pièce.');
ok(await pg.locator('.bag .it[title="Clé rouillée"]').count()===1,'A: objet "Clé rouillée" dans le sac');
await pg.click('[data-tab=journal]');ok(await pg.locator('#p-journal article').count()===1,'A: quête dans le journal');
await pg.click('[data-tab=jeu]');
await say('Je prends une épée.');
ok((await pg.inputValue('#eq-main1'))==='Épée courte','A: épée équipée (1 emplacement actif)');
// ooc exclu du prompt
await pg.selectOption('#who','ooc');await pg.fill('#say','SECRET-HRP-XYZ');await pg.press('#say','Enter');await T(200);
await pg.selectOption('#who','pj');
await say('Je regarde autour.');
const last=await pg.evaluate(()=>window.__prompts[window.__prompts.length-1]);
ok(!last.includes('SECRET-HRP-XYZ'),'A: message hors-jeu absent du prompt');
ok(last.includes('Maëlys')&&last.includes('Torvald'),'A: prompt contient les 2 héros du groupe');
ok(last.includes('La Tour des Cendres')||last.includes('cendres'),'A: prompt contient le monde');
// régénérer / annuler
const before=await pg.locator('.msg.mj').count();await pg.click('[data-act=regen]');await pg.waitForFunction(n=>document.querySelectorAll('.msg.mj').length>=n&&!document.querySelector('#think'),before,{timeout:8000});await T(200);
ok(await pg.locator('.msg.mj').count()===before,'A: régénérer remplace la réponse (même nombre de messages MJ)');
await pg.click('[data-act=undo]');await T(200);ok(await pg.locator('.msg.mj').count()===before-1,'A: annuler supprime le dernier message');
await pg.click('[data-act=condense]');await T(400);await pg.click('[data-tab=monde]');ok((await pg.inputValue('#c-resume')).includes('clé rouillée'),'A: mémoire condensée affichée');
await pg.click('[data-tab=jeu]');await pg.screenshot({path:'simA.png'});

const P=async l=>console.log('PARTIES',l,JSON.stringify(await pg.evaluate(()=>Object.entries(window.__store()).filter(([k])=>/^campagnes\/c\d+$/.test(k)).map(([k,v])=>[v.nom,v.party.map(i=>window.__store()['pj/'+i]?.name)]))));
await P('fin A');
// ===== SESSION B : 2e campagne, 3e héros, isolation =====
await pg.click('[data-tab=camps]');await newHero('Sylve','Sylvan','custom');
ok((await pg.locator('#left .picks input[data-f=classe]').inputValue())==='Chevaucheur de brume','B: classe personnalisée enregistrée');
await pg.click('[data-tab=camps]');
await pg.fill('#nc-nom','Marais de Brume');await pg.uncheck('.nc-p >> nth=0').catch(()=>{});
const cbs=await pg.locator('.nc-p').count();for(let i=0;i<cbs;i++)await pg.uncheck(`.nc-p >> nth=${i}`);
await pg.check('.nc-p >> nth=2');await pg.click('[data-act=createcamp]');await T(300);
await P('B créée');ok(JSON.stringify(await pg.evaluate(()=>Object.values(window.__store()).filter(v=>v.nom==='La Tour des Cendres').map(v=>v.party.length)))==='[2]','B: la campagne A garde exactement 2 héros');await pg.click('[data-tab=jeu]');await T(200);
ok(await pg.locator('.msg').count()===0||await pg.locator('#right .note').count()>0,'B: la nouvelle campagne démarre avec un chat vide');
ok((await pg.locator('#pj-sel option:checked').innerText()).includes('Sylve'),'B: le héros actif est Sylve');
await say('Je pousse la porte de la cabane.');
const pB=await pg.evaluate(()=>window.__prompts[window.__prompts.length-1]);
ok(pB.includes('Sylve')&&!pB.includes('Torvald')&&!pB.includes('Maëlys'),'B: le prompt ne contient que Sylve (pas les héros de la campagne A)');
ok(!pB.includes('Clé rouillée')&&!pB.includes('La clé rouillée'),'B: aucune fuite des événements de la campagne A');
await pg.selectOption('#camp-sel',{label:'La Tour des Cendres'});await T(300);
ok(await pg.locator('.msg.mj').count()>=before-1,'B→A: le chat de la campagne A est intact après changement');
await pg.click('[data-tab=journal]');ok(await pg.locator('#p-journal article').count()===1,'B→A: journal de A intact');
await pg.selectOption('#camp-sel',{label:'Marais de Brume'});await T(300);
await pg.click('[data-tab=journal]');ok(await pg.locator('#p-journal article').count()===0,'A→B: journal de B vide');
await pg.click('[data-tab=bestiaire]');ok(await pg.locator('#p-bestiaire article').count()===1,'B: le bestiaire reste global (goule visible)');

// ===== SESSION C : robustesse =====
await pg.click('[data-tab=jeu]');
await pg.evaluate(()=>{window.__failNext={code:'rate_limited',message:'x'}});
await pg.fill('#say','Je fouille encore.');await pg.press('#say','Enter');await T(400);
ok(await pg.locator('.toast').isVisible(),'C: erreur rate_limited → message affiché, pas de plantage');
ok(await pg.locator('[data-act=send]').isEnabled(),'C: le bouton Envoyer redevient actif après erreur');
await pg.selectOption('#mode','humain');await T(200);const calls=await pg.evaluate(()=>window.__sampleCalls);
await pg.fill('#say','Message en mode MJ humain');await pg.press('#say','Enter');await T(300);
ok((await pg.evaluate(()=>window.__sampleCalls))===calls,'C: mode MJ humain → aucun appel à Claude');
await pg.selectOption('#who','mj');await pg.fill('#say','Le MJ humain narre une scène.');await pg.press('#say','Enter');await T(300);
ok(await pg.locator('.msg.mj:has-text("MJ humain narre")').count()===1,'C: le MJ humain peut narrer');
// persistance
await pg.reload();await T(500);
ok((await pg.locator('#camp-line').innerText()).includes('Marais de Brume'),'C: après rechargement, la dernière campagne est restaurée');
ok(await pg.locator('.msg').count()>=2,'C: les messages persistent après rechargement');
// retirer du groupe / suppression héros
await pg.click('[data-tab=camps]');
await pg.click('[data-act=delpjr] >> nth=0');await pg.click('[data-act=delpjr] >> nth=0');await T(400);
ok(await pg.locator('#p-camps .card:has(.portrait)').count()===2,'C: suppression d\'un héros (2 restants)');
const ghost=await pg.evaluate(()=>{const st=window.__store();return Object.entries(st).filter(([k])=>/^campagnes\/c\d+$/.test(k)).flatMap(([k,v])=>(v.party||[]).filter(id=>!('pj/'+id in st)))});
ok(ghost.length===0,'C: aucun id fantôme dans les groupes après suppression'+(ghost.length?' → '+ghost:''));
// suppression campagne
await pg.click('[data-act=delcamp] >> nth=0');await pg.click('[data-act=delcamp] >> nth=0');await T(600);
const left=Object.keys(await pg.evaluate(()=>window.__store())).filter(k=>/^campagnes\//.test(k));
ok(await pg.locator('#p-camps article.camp').count()===1,'C: suppression d\'une campagne (1 restante)');
// mobile
await pg.setViewportSize({width:390,height:800});await pg.click('[data-tab=jeu]');await T(300);
const ow=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);ok(ow,'C: pas de scroll horizontal sur mobile (390px)');
await pg.screenshot({path:'simC_mobile.png'});
await pg.setViewportSize({width:1280,height:820});await pg.click('[data-tab=camps]');await T(200);await pg.screenshot({path:'simCamps.png'});

// ===== SESSION D : migration d'une ancienne partie =====
const ctx2=await b.newContext({viewport:{width:1280,height:820}});const pg2=await ctx2.newPage();
const seed={'pj/p1':{name:'Ancien',race:'Elfe',classe:'Mage',niveau:2,pv:8,pvMax:8,ca:10,or:5,xp:0,stats:{vig:10,agi:10,sav:14,ins:10,pre:10},inv:[],equip:{},etats:[]},
 'meta/campagne':{nom:'Vieille aventure',monde:'Un vieux monde',mj:'ia',resume:'Résumé ancien'},'table/m1':{t:1,type:'joueur',who:'Ancien',text:'Bonjour'},'table/m2':{t:2,type:'mj',mode:'ia',text:'Salut voyageur'},'journal/j1':{t:1,kind:'note',titre:'Vieille note',texte:'x'}};
await pg2.addInitScript(`(${mock})(${JSON.stringify(seed)})`);const e2=[];pg2.on('pageerror',e=>e2.push(e.message));
await pg2.goto(url);await pg2.waitForTimeout(1200);
ok((await pg2.locator('#camp-line').innerText()).includes('Vieille aventure'),'D: ancienne partie migrée vers une campagne');
await pg2.click('[data-tab=jeu]');await pg2.waitForTimeout(300);ok(await pg2.locator('.msg').count()>=2,'D: anciens messages repris');
ok((await pg2.evaluate(()=>window.__store()['campagnes/'+Object.keys(window.__store()).find(k=>/^campagnes\/c\d+$/.test(k)).split('/')[1]].party)).includes('p1'),'D: l\'ancien héros est dans le groupe');
errs.push(...e2.map(x=>'PAGE2 '+x));
console.log(res.join('\n'));console.log('\nERREURS JS:',JSON.stringify(errs));
await b.close()})().catch(async e=>{try{console.log('DUMP',JSON.stringify(await global.__pg.evaluate(()=>({keys:Object.keys(window.__store()),ls:(localStorage.getItem('mockdb')||'').length,txt:document.body.innerText.slice(0,400)}))))}catch(x){console.log('dumpfail',x.message)};console.log(res.join('\n'));console.log('ERRS',JSON.stringify(global.__errs));console.log('FAIL',e.message.split('\n')[0]);process.exit(1)});
