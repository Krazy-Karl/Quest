const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
const A=(id,nom,kind,stat,de,bonus,pm,jet,extra)=>({id,nom,kind,stat,de,bonus,pm,jet,...(extra||{})});
const seed={
 'pj/p1':{name:'Torvald',race:'Dwarf',classe:'Warrior',niveau:1,pv:12,pvMax:12,pm:0,pmMax:0,ca:14,or:5,xp:0,stats:{str:16,dex:12,con:14,int:10,wis:10,cha:10},inv:[{n:'Épée longue',q:1},{n:'Potion de soin',q:1}],equip:{},etats:[],atq:[A('a1','Épée longue','arme','str','1d8',0,0,'atk')]},
 'pj/p2':{name:'Aldric',race:'Elf',classe:'Mage',niveau:1,pv:7,pvMax:7,pm:3,pmMax:12,ca:12,or:5,xp:0,stats:{str:8,dex:14,con:12,int:16,wis:10,cha:10},inv:[],equip:{},etats:[],atq:[A('b1','Trait de feu','sort','int','1d10',0,0,'atk')]},
 'campagnes/c1':{nom:'Test gameplay',ton:'',monde:'Un monde.',mj:'ia',party:['p1','p2'],t:2},
 'bestiaire/b02':{nom:'Gobelin pilleur',type:'Humanoïde',dg:1,pv:8,ca:12,att:'Lame rouillée +3 (1d6)',desc:'Petit et vif.'},
 'bestiaire/b03':{nom:'Ogre des tourbières',type:'Géant',dg:4,pv:45,ca:11,att:'Gourdin +6 (2d8+3)',desc:'Massif.'},
 'bestiaire/b04':{nom:'Loup des brumes',type:'Bête',dg:2,pv:14,ca:12,att:'Morsure +4 (1d8+1)',desc:'Pelage pâle.'}};
(async()=>{
const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(`(${mock})(${JSON.stringify(seed)})`);
await pg.goto('file://'+process.cwd()+'/../index.html');await pg.waitForTimeout(600);
const T=ms=>pg.waitForTimeout(ms);
const rq=(...pairs)=>pg.evaluate(a=>{window.__q.push(...a.map(([v,f])=>(v-.5)/f))},pairs);
const st=()=>pg.evaluate(()=>window.__store());
const pickHero=async id=>{await pg.selectOption('#pj-sel',id);await T(200)};
const lastMsg=async()=>{const l=await pg.locator('.msg').allInnerTexts();return l[l.length-1]||''};
await pg.click('[data-tab=jeu]');await pickHero('p1');
// ---- initiative
await pg.click('[data-act=foeopen]');
for(const n of [1,1]){await pg.click('[data-act=foeadd]');await pg.selectOption('#foe-b','b02');await pg.fill('#foe-q','1');await pg.click('[data-act=foesave]');await T(250)}
await rq([10,20],[15,20],[14,20],[5,20]);await pg.click('[data-act=rollini]');await T(500);
let ics=await pg.locator('.ic').allInnerTexts();
ok(ics.length===4&&/Aldric\s+17/.test(ics[0])&&/Gobelin pilleur 1\s+14/.test(ics[1])&&/Torvald\s+11/.test(ics[2])&&/Gobelin pilleur 2\s+5/.test(ics[3]),'Initiative : ordre Aldric 17 › Gobelin 1 (14) › Torvald 11 › Gobelin 2 (5) → '+JSON.stringify(ics.map(x=>String(x).replace(/\s+/g,' '))));
ok((await pg.locator('.ic.on').innerText()).includes('Aldric'),'Initiative : le tour actif est surligné (Aldric)');
ok((await pg.locator('.rnd').innerText()).toLowerCase().includes('round 1'),'Initiative : Round 1');
ok(await pg.locator('.myturn').count()===1&&/aldric/i.test(await pg.locator('.myturn').innerText()),'Initiative : bandeau "À Aldric de jouer" + fiche de l\'acteur affichée');
ok((await pg.locator('#pj-sel option:checked').innerText()).includes('Aldric'),'Initiative : la fiche bascule sur le héros dont c\'est le tour');
await pg.click('[data-act=nextturn]');await T(250);ok((await pg.locator('.ic.on').innerText()).includes('Gobelin pilleur 1')&&await pg.locator('.foe.act').count()===1,'Tour suivant → Gobelin 1 (carte ennemie surlignée)');
await pg.click('[data-act=nextturn]');await T(250);ok((await pg.locator('.ic.on').innerText()).includes('Torvald')&&(await pg.locator('#pj-sel option:checked').innerText()).includes('Torvald'),'Tour suivant → Torvald (fiche basculée)');
// tuer gobelin 2 -> doit être sauté
for(let i=0;i<8;i++)await pg.click('.foe >> nth=1 >> [data-act=foehp][data-d="-1"]');await T(300);
await pg.click('[data-act=nextturn]');await T(250);ok((await pg.locator('.ic.on').innerText()).includes('Aldric')&&(await pg.locator('.rnd').innerText()).toLowerCase().includes('round 2'),'Gobelin 2 vaincu : sauté, nouveau Round 2 sur Aldric');
// ---- distribuer XP
ok(await pg.locator('[data-act=givexp]').count()===1&&(await pg.locator('[data-act=givexp]').innerText()).includes('50'),'XP : bouton "Distribuer 50 XP" (gobelin DG1)');
await pg.click('[data-act=givexp]');await T(400);let S_=await st();
ok(S_['pj/p1'].xp===25&&S_['pj/p2'].xp===25,'XP : 50 partagés entre 2 héros (25 chacun)');
ok(await pg.locator('[data-act=givexp]').count()===0,'XP : pas de double distribution');
// ---- jets de mort
await pickHero('p1');await pg.fill('#dpv','-99');await pg.press('#dpv','Enter');await T(300);
console.log('DEATHS',await pg.locator('.deaths').count(),await pg.locator('#left .hp b').innerText(),await pg.locator('#pj-sel option:checked').innerText());ok(await pg.locator('.deaths [data-act=dsave]').count()===1,'Jets de mort : le panneau apparaît à 0 PV');
await rq([15,20]);await pg.click('[data-act=dsave]');await T(250);ok(await pg.locator('.pips.ok .pip.on').count()===1,'Jet de mort 15 : 1 réussite');
await rq([8,20]);await pg.click('[data-act=dsave]');await T(250);ok(await pg.locator('.pips.ko .pip.on').count()===1,'Jet de mort 8 : 1 échec');
await rq([12,20]);await pg.click('[data-act=dsave]');await T(250);await rq([10,20]);await pg.click('[data-act=dsave]');await T(350);S_=await st();
ok(S_['pj/p1'].etats.includes('Stabilisé')&&S_['pj/p1'].mort.s===0,'3 réussites : héros stabilisé, compteurs remis à zéro');
// dégâts sur héros à 0 PV : échec auto, annule la stabilisation (ennemi qui frappe)
await pg.click('[data-act=nextturn]');await T(200);
await rq([18,20],[3,6]);await pg.click('.foe:not(.ko) [data-act=foeatk] >> nth=0');await T(500);S_=await st();
ok(S_['pj/p1'].mort.f===1&&!S_['pj/p1'].etats.includes('Stabilisé'),'Dégâts à 0 PV : +1 échec, stabilisation annulée');
// mort : nat 1 (2 échecs) -> 3 échecs
await rq([1,20]);await pg.click('[data-act=dsave]');await T(350);S_=await st();
ok(S_['pj/p1'].etats.includes('Mort')&&await pg.locator('.deaths.dead').count()===1,'1 naturel = 2 échecs : 3 échecs au total → Mort');
// 20 naturel : se relève
await pickHero('p2');await pg.fill('#dpv','-99');await pg.press('#dpv','Enter');await T(300);await rq([20,20]);await pg.click('[data-act=dsave]');await T(350);S_=await st();
ok(S_['pj/p2'].pv===1&&!S_['pj/p2'].etats.includes('À terre'),'20 naturel au jet de mort : se relève avec 1 PV');
// ---- repos
await pg.fill('[data-f=pv]','1');await pg.press('[data-f=pv]','Tab');await T(200);
await pg.click('[data-act=srest]');await T(400);S_=await st();
ok(S_['pj/p2'].pv>1&&S_['pj/p2'].dv===0&&S_['pj/p2'].pm>3,'Repos court (Aldric) : soigne, dépense le dé de vie, rend du mana → PV '+S_['pj/p2'].pv+', PM '+S_['pj/p2'].pm);
await pg.click('[data-act=srest]');await T(300);ok(await pg.locator('.toast').isVisible(),'Repos court sans dé de vie : refusé avec un message');
await pg.click('[data-act=lrest]');await T(400);S_=await st();
ok(S_['pj/p2'].pv===7&&S_['pj/p2'].pm===12&&S_['pj/p2'].dv===1,'Repos long : PV et PM au max, dé de vie récupéré');
// ---- niveau et caractéristiques
await pickHero('p1');await pg.evaluate(()=>{});await pg.click('[data-act=lrest]').catch(()=>{});
// p1 est mort : repos refusé ; on teste le niveau sur p2
await pickHero('p2');await pg.fill('[data-f=xp]','300');await pg.press('[data-f=xp]','Tab');await T(300);
ok(await pg.locator('[data-act=levelup]').count()===1,'XP 300 : le bouton "Monter au niveau 2" apparaît');
await pg.click('[data-act=levelup]');await T(500);S_=await st();
ok(S_['pj/p2'].niveau===2&&S_['pj/p2'].pvMax>7&&S_['pj/p2'].pmMax>12,'Niveau 2 : PV max et PM max augmentent → PV '+S_['pj/p2'].pvMax+', PM '+S_['pj/p2'].pmMax);
await pg.fill('#f-niv','3');await pg.press('#f-niv','Tab');await pg.fill('[data-f=xp]','2700');await pg.press('[data-f=xp]','Tab');await T(300);await pg.click('[data-act=levelup]');await T(500);
ok(await pg.locator('.asi').count()===6,'Niveau 4 : 6 boutons "+" pour répartir 2 points');
await pg.click('.asi >> nth=3');await T(250);await pg.click('.asi >> nth=3');await T(300);S_=await st();
ok(S_['pj/p2'].stats.int===18&&await pg.locator('.asi').count()===0,'Niveau 4 : INT 16 → 18, les boutons disparaissent une fois les points dépensés');
// ---- compétences
await pickHero('p1').catch(()=>{});
await pickHero('p2');await pg.click('.skills summary');await T(150);
await pg.check('[data-comp="Arcanes"]');await T(250);
const arc=await pg.locator('.skb:has-text("Arcanes") b').innerText();ok(arc==='+6','Compétence : Arcanes = INT 18 (+4) + maîtrise niv. 4 (+2) = '+arc);
await pg.fill('#dd','15');await pg.press('#dd','Tab');await rq([10,20]);await pg.click('.skb:has-text("Arcanes")');await T(350);
const mk=await pg.locator('.msg.roll').last().innerText();ok(/Arcanes.*\[10\].*= 1[56] vs DD 15 → (Réussite|Échec)/s.test(mk),'Test de compétence avec DD → '+mk.replace(/\n/g,' ').slice(0,90));
ok(await pg.locator('.skills[open]').count()===1,'Le panneau des compétences reste ouvert après un jet');
// ---- armure : création d'un héros
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Brunhild');await pg.selectOption('#n-race-s','Dwarf');await pg.selectOption('#n-classe-s','Warrior');await pg.click('[data-act=createpj]');await T(500);
ok((await pg.inputValue('#eq-torse'))==='Cotte de mailles'&&(await pg.inputValue('#eq-main2'))==='Bouclier'&&(await pg.inputValue('#eq-main1'))==='Épée longue','Création Warrior : cotte de mailles, bouclier et épée déjà équipés');
ok((await pg.inputValue('[data-f=ca]'))==='18'&&await pg.locator('[data-act=caauto].on').count()===1,'CA automatique : 16 (cotte de mailles) + 2 (bouclier) = 18');
await pg.selectOption('#eq-main2','');await T(300);ok((await pg.inputValue('[data-f=ca]'))==='16','CA recalculée sans bouclier : 16');
await pg.selectOption('#eq-torse','');await T(300);const dexm=await pg.evaluate(()=>{const e=Object.values(window.__store()).find(v=>v&&v.name==='Brunhild');return Math.floor((e.stats.dex-10)/2)});
ok((await pg.inputValue('[data-f=ca]'))===String(10+dexm),'CA recalculée sans armure : 10 + DEX ('+(10+dexm)+')');
const kn=await pg.locator('.skb b').count();ok(kn===18,'Compétences : 18 compétences listées');
const profs=await pg.locator('.skc input:checked').count();ok(profs===3,'Création : 3 maîtrises de compétences tirées selon la classe ('+profs+')');
// ---- potion
await pg.fill('[data-f=pv]','2');await pg.press('[data-f=pv]','Tab');await T(200);
await pg.click('.bag .it[title="Potion de soin"]');await T(200);await rq([3,4],[2,4]);await pg.click('[data-act=useitem]');await T(450);S_=await st();
const brun=Object.values(S_).find(v=>v&&v.name==='Brunhild');ok(brun.pv===9&&!brun.inv.some(i=>i.n==='Potion de soin'),'Potion de soin : 2d4+2 [3,2] = +7 PV (2 → 9), potion consommée');
// ---- rencontre aléatoire
await pg.click('[data-act=foeclear]');await pg.click('[data-act=foeclear]');await T(300);await pg.click('[data-act=foeopen]');await pg.click('[data-act=foeadd]');
await pg.selectOption('#enc-d','difficile');await pg.click('[data-act=encgen]');await T(250);
const tx=await pg.locator('.combat .card p').innerText().catch(()=>'');ok(/×/.test(tx)&&/budget/.test(tx),'Rencontre aléatoire : composition + XP ajusté/budget → '+tx.replace(/\n/g,' ').slice(0,110));
await pg.click('[data-act=encgo]');await T(700);ok(await pg.locator('.foe').count()>=1&&await pg.locator('.ic').count()>=3,'Rencontre aléatoire : ennemis ajoutés et initiative lancée');
ok(await pg.locator('.foe .mart').count()===await pg.locator('.foe').count(),'Graphisme : chaque ennemi a son illustration');
// ---- MJ Claude : nouveaux outils
await pg.click('[data-act=foeclear]');await pg.click('[data-act=foeclear]');await T(300);
await pg.fill('#say','Je me faufile avec discrétion.');await pg.press('#say','Enter');await pg.waitForFunction(()=>window.__chk,null,{timeout:8000}).catch(()=>{});await T(300);
ok(await pg.evaluate(()=>/Discrétion \(DEX\)/.test(window.__chk||'')&&/vs DD 12/.test(window.__chk)),'MJ Claude : test_competence (Discrétion, DD 12) avec le bon bonus');
await pg.fill('#say','Une récompense du village !');await pg.press('#say','Enter');await pg.waitForFunction(()=>window.__xp,null,{timeout:8000}).catch(()=>{});await T(300);
ok(await pg.evaluate(()=>/\+100 XP/.test(window.__xp||'')),'MJ Claude : xp_donner');
await pg.click('[data-act=foeopen]').catch(()=>{});await pg.click('[data-act=foeadd]').catch(()=>{});await pg.selectOption('#foe-b','b02').catch(()=>{});await pg.click('[data-act=foesave]').catch(()=>{});await T(300);
await pg.fill('#say','Initiative !');await pg.press('#say','Enter');await pg.waitForFunction(()=>window.__ini,null,{timeout:8000}).catch(()=>{});await T(400);
ok(await pg.evaluate(()=>window.__ini&&/Initiative :/.test(window.__ini[0])&&/Round/.test(window.__ini[1])),'MJ Claude : initiative_lancer + tour_suivant');
await pg.fill('#say','Je regarde.');await pg.press('#say','Enter');await T(700);
const pr=await pg.evaluate(()=>window.__prompts[window.__prompts.length-1]);
ok(/INITIATIVE : round/.test(pr)&&/Maîtrises :/.test(pr)&&/XP \d+\//.test(pr),'Prompt : initiative, maîtrises et XP des héros');
// ---- UX
const before=(await pg.locator('.msg.roll').count());await pg.locator('body').click({position:{x:5,y:5}});await pg.keyboard.press('1');await T(500);
ok(await pg.locator('.msg.roll').count()>before,'Raccourci clavier : la touche 1 lance la première attaque');
const t0=await pg.locator('.ic.on').innerText();await pg.keyboard.press('n');await T(300);ok((await pg.locator('.ic.on').innerText())!==t0,'Raccourci clavier : N passe au tour suivant');
await pg.click('[data-snd]');ok((await pg.locator('[data-snd]').innerText()).includes('̸'),'Son : le bouton ♪ coupe les sons');await pg.click('[data-snd]');
await pg.click('[data-act=foehp][data-d="-1"] >> nth=0');await T(100);ok(true,'(clic dégâts)');
await pg.screenshot({path:'gameplay.png'});
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})().catch(async e=>{console.log(res.join('\n'));console.log('FAIL',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
