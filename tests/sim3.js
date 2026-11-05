const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
const A=(id,nom,kind,stat,de,bonus,pm,jet,extra)=>({id,nom,kind,stat,de,bonus,pm,jet,...(extra||{})});
const seed={
 'pj/p1':{name:'Torvald',race:'Dwarf',classe:'Warrior',niveau:1,pv:12,pvMax:12,pm:0,pmMax:0,ca:14,or:5,xp:0,stats:{str:16,dex:12,con:14,int:10,wis:10,cha:10},inv:[{n:'Épée longue',q:1}],equip:{},etats:[],
   atq:[A('a1','Épée longue','arme','str','1d8',0,0,'atk',{portee:'Mêlée'}),A('a2','Arbalète légère','arme','dex','1d8',0,0,'atk')]},
 'pj/p2':{name:'Aldric',race:'Elf',classe:'Mage',niveau:1,pv:7,pvMax:7,pm:12,pmMax:12,ca:12,or:5,xp:0,stats:{str:8,dex:14,con:12,int:16,wis:10,cha:10},inv:[],equip:{},etats:[],
   atq:[A('b1','Trait de feu','sort','int','1d10',0,0,'atk'),A('b2','Projectile magique','sort','int','3d4',3,2,'auto'),A('b3','Soins','sort','int','1d8',0,2,'soin'),A('b4','Boule de feu','sort','int','8d6',0,6,'jds',{jds:'dex'})]},
 'campagnes/c1':{nom:'Test combat',ton:'',monde:'Un monde.',mj:'ia',party:['p1','p2'],t:2},
 'campagnes/c2':{nom:'Autre campagne',ton:'',monde:'x',mj:'ia',party:['p2'],t:1},
 'bestiaire/b02':{nom:'Gobelin pilleur',type:'Humanoïde',dg:1,pv:8,ca:12,att:'Lame rouillée +3 (1d6)',desc:'Petit et vif.'}};
(async()=>{
const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(`(${mock})(${JSON.stringify(seed)})`);
await pg.goto('file://'+process.cwd()+'/../index.html');await pg.waitForTimeout(600);
const T=ms=>pg.waitForTimeout(ms);
const rq=(...pairs)=>pg.evaluate(a=>{window.__q.push(...a.map(([v,f])=>(v-.5)/f))},pairs);
const msgs=()=>pg.locator('.msg').allInnerTexts();
const lastRoll=async()=>{const l=await pg.locator('.msg.roll').allInnerTexts();return l[l.length-1]||''};
const foe=i=>pg.locator('.foe').nth(i);
const pickHero=async id=>{await pg.selectOption('#pj-sel',id);await T(200)};
const tgt=async i=>{const v=await pg.evaluate(i=>[...document.querySelectorAll('#tgt option')].filter(o=>o.value.startsWith('e:'))[i].value,i);await pg.selectOption('#tgt',v);await T(150)};
const pv=async()=>pg.evaluate(()=>window.__store());

await pg.click('[data-tab=jeu]');await pickHero('p1');
const t0=await pg.locator('.atk').allInnerTexts();
ok(t0.length===2&&t0[0].toUpperCase().includes('ÉPÉE LONGUE')&&t0[0].includes('+5 · 1d8+3'),'Fiche : Épée longue affichée "+5 · 1d8+3" (FOR+3, maîtrise+2) → '+JSON.stringify(t0[0]));
ok(t0[1].includes('+3 · 1d8+1'),'Fiche : Arbalète légère "+3 · 1d8+1" (DEX+1, maîtrise+2)');
// ennemis depuis le bestiaire
await pg.click('[data-act=foeopen]');await pg.click('[data-act=foeadd]');await pg.selectOption('#foe-b','b02');await pg.fill('#foe-q','2');await pg.click('[data-act=foesave]');await T(300);
ok(await pg.locator('.foe').count()===2,'Combat : 2 gobelins ajoutés depuis le bestiaire');
ok((await foe(0).innerText()).toLowerCase().includes('gobelin pilleur 1')&&(await foe(1).innerText()).toLowerCase().includes('gobelin pilleur 2'),'Combat : numérotation automatique 1 et 2');
ok((await foe(0).innerText()).includes('CA 12')&&(await foe(0).innerText()).includes('8/8'),'Combat : CA 12 et PV 8/8 repris du bestiaire');
// coup normal : nat 15 -> 20 vs CA 12 touche ; dégâts d8=6 -> 9 : gobelin 1 (8 PV) vaincu
await tgt(0);await rq([15,20],[6,8]);await pg.click('.atk >> nth=0');await T(400);
let r=await lastRoll();ok(/\[15\].*= 20 vs CA 12.*Touché.*= 9/s.test(r),'Attaque : 15+5=20 vs CA 12 → Touché, dégâts 6+3=9 → '+r.replace(/\n/g,' ').slice(0,140));
ok((await foe(0).getAttribute('class')).includes('ko'),'Attaque : gobelin 1 vaincu (9 ≥ 8 PV)');
ok((await msgs()).some(x=>x.includes('est vaincu')),'Attaque : message "est vaincu"');
// échec critique sur gobelin 2
await tgt(0).catch(()=>{});  // gobelin 1 est KO : la cible disparaît du menu
const opts=await pg.evaluate(()=>[...document.querySelectorAll('#tgt option')].filter(o=>o.value.startsWith('e:')).length);
ok(opts===1,'Cible : un ennemi vaincu n\'est plus ciblable (1 restant)');
await pg.selectOption('#tgt',await pg.evaluate(()=>[...document.querySelectorAll('#tgt option')].find(o=>o.value.startsWith('e:')).value));await T(150);
await rq([1,20]);await pg.click('.atk >> nth=0');await T(300);
r=await lastRoll();ok(/Échec critique/.test(r)&&!/dégâts/.test(r),'Attaque : 1 naturel = échec critique, aucun dégât → '+r.replace(/\n/g,' ').slice(0,90));
ok((await foe(1).innerText()).includes('8/8'),'Attaque : gobelin 2 intact (8/8)');
// raté simple : nat 8 +5 = 13 vs 12 touche ; nat 6+5 = 11 rate
await rq([6,20]);await pg.click('.atk >> nth=0');await T(300);r=await lastRoll();
ok(/= 11 vs CA 12 → Raté/.test(r),'Attaque : 6+5=11 vs CA 12 → Raté');
// avantage : [3,18] -> 18
await pg.click('[data-adv=a]');await rq([3,20],[18,20],[2,8]);await pg.click('.atk >> nth=0');await T(300);r=await lastRoll();
ok(/\[3, 18\]→18/.test(r),'Avantage : deux dés [3, 18] → garde 18');
ok(await pg.locator('[data-adv=n].on').count()===1,'Avantage : retour à "Normal" après l\'attaque');
// critique : nat 20, dégâts 2d8 doublés (4+4)+3 = 11 -> gobelin 2 (8-? ) 
await rq([20,20],[4,8],[4,8]);await pg.click('.atk >> nth=0');await T(400);r=await lastRoll();
ok(/COUP CRITIQUE/.test(r)&&/×2 dés/.test(r),'Critique : 20 naturel → dés doublés');
ok((await foe(1).getAttribute('class')).includes('ko'),'Critique : gobelin 2 vaincu');
// pas de cible
await pg.selectOption('#tgt','');await T(150);await rq([14,20],[5,8]);await pg.click('.atk >> nth=0');await T(300);r=await lastRoll();
ok(/dégâts si touché/.test(r)&&!/vs CA/.test(r),'Sans cible : jet + "dégâts si touché", rien n\'est appliqué');
// CA libre
await pg.selectOption('#tgt','ca');await pg.fill('#tgca','15');await pg.press('#tgca','Tab');await T(150);await rq([9,20],[4,8]);await pg.click('.atk >> nth=0');await T(300);r=await lastRoll();
ok(/= 14 vs CA 15 → Raté/.test(r),'CA libre : 9+5=14 vs CA 15 → Raté');

// ===== Mage : sorts et PM =====
await pickHero('p2');await pg.selectOption('#tgt','');
await pg.click('[data-act=foeadd]');await pg.selectOption('#foe-b','b02');await pg.fill('#foe-q','1');await pg.click('[data-act=foesave]');await T(300);
await tgt(0);
await rq([3,4],[2,4],[4,4]);await pg.click('.atk:has-text("Projectile") >> nth=0');await T(400);r=await lastRoll();
ok(/touche automatiquement.*= 12.*−2 PM/s.test(r),'Projectile magique : auto, 3d4 [3,2,4]=9 +3 = 12, −2 PM → '+r.replace(/\n/g,' ').slice(0,120));
let st=await pv();ok(st['pj/p2'].pm===10,'PM : 12 → 10 après un sort à 2 PM');
ok((await foe(2).getAttribute('class')).includes('ko'),'Projectile magique : gobelin (8 PV) tué par 12 dégâts');
// soin : mage à 3/7, soin 1d8=5 +3 = 8 -> plafonné à 7
await pg.evaluate(()=>{const s=window.__store();s['pj/p2'].pv=3;window.name=JSON.stringify(s)});await pg.reload();await T(500);await pg.click('[data-tab=jeu]');await pickHero('p2');
await pg.selectOption('#tgt','');await rq([5,8]);await pg.click('.atk:has-text("Soins")');await T(400);st=await pv();
ok(st['pj/p2'].pv===7&&st['pj/p2'].pm===8,'Soins : PV 3 → 7 (plafonné au max), PM 10 → 8');
// PM insuffisants
await pg.evaluate(()=>{const s=window.__store();s['pj/p2'].pm=1;window.name=JSON.stringify(s)});await pg.reload();await T(500);await pg.click('[data-tab=jeu]');await pickHero('p2');
const before=(await msgs()).length;await pg.click('.atk:has-text("Projectile")');await T(300);
ok((await msgs()).length===before&&(await pv())['pj/p2'].pm===1&&await pg.locator('.toast').isVisible(),'PM insuffisants : attaque refusée, PM inchangés, message affiché');
// jds : Boule de feu (PM 6 requis) -> on remet 12
await pg.evaluate(()=>{const s=window.__store();s['pj/p2'].pm=12;window.name=JSON.stringify(s)});await pg.reload();await T(500);await pg.click('[data-tab=jeu]');await pickHero('p2');
await pg.click('[data-act=foeadd]');await pg.selectOption('#foe-b','b02');await pg.fill('#foe-q','1');await pg.click('[data-act=foesave]');await T(300);
await tgt(0);await rq([1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[1,6],[2,6]);await pg.click('.atk:has-text("Boule")');await T(400);r=await lastRoll();
ok(/JdS DEX DD 13/.test(r)&&/= 24/.test(r),'Boule de feu : DD 8+2+3=13, dégâts 8d6 = 24 → '+r.replace(/\n/g,' ').slice(0,120));
const nm=await pg.locator('.tools button').allInnerTexts();ok(nm.some(x=>x.includes('Réussie : −12'))&&nm.some(x=>x.includes('Cible ratée : −24')),'Boule de feu : boutons "ratée −24" et "réussie −12" proposés');
const hpBefore=(await pv())['campagnes/c1/combat/etat'].liste.find(e=>!e.ko).pv;
await pg.click('[data-act=applyd][data-half="1"]');await T(300);
const foes=(await pv())['campagnes/c1/combat/etat'].liste;ok(foes.filter(e=>!e.ko).length===0||foes.find(e=>e.nom.includes('3'))?.ko===true,'Jet de sauvegarde réussi : moitié des dégâts appliquée (12 ≥ 8 PV → vaincu)');

// ===== ennemi qui attaque (bouton MJ humain) =====
await pickHero('p1');await pg.click('[data-act=foeadd]');await pg.selectOption('#foe-b','b02');await pg.fill('#foe-q','1');await pg.click('[data-act=foesave]');await T(300);
const ev=async()=>pg.evaluate(()=>[...document.querySelectorAll('.foe:not(.ko) [data-act=foeatk]')].length);
await rq([10,20]);await pg.click('.foe:not(.ko) [data-act=foeatk] >> nth=0');await T(300);r=await lastRoll();
ok(/attaque Torvald.*= 13 vs CA 14 → Raté/s.test(r),'Ennemi : d20 10+3=13 vs CA 14 → Raté → '+r.replace(/\n/g,' ').slice(0,110));
await rq([18,20],[4,6]);await pg.click('.foe:not(.ko) [data-act=foeatk] >> nth=0');await T(400);r=await lastRoll();st=await pv();
ok(/= 21 vs CA 14 → Touché.*= 4/s.test(r)&&st['pj/p1'].pv===8,'Ennemi : touche, 1d6=4 → Torvald 12 → 8 PV');
// ===== le MJ Claude utilise les outils de combat =====
await pg.selectOption('#mode','ia');await T(200);
await pg.click('[data-act=foeclear]');await pg.click('[data-act=foeclear]');await T(300);
ok(await pg.locator('.foe').count()===0,'Combat : "Terminer le combat" vide la liste (2 clics de confirmation)');
await pg.fill('#say','Une embuscade !');await rq([1,1]);  // un tirage neutre évite de consommer le hasard des dés
await pg.evaluate(()=>{window.__q.length=0});await pg.press('#say','Enter');await pg.waitForFunction(()=>document.querySelectorAll('.msg.mj').length>0&&!document.querySelector('#think'),null,{timeout:8000}).catch(()=>{});await T(500);
ok(await pg.locator('.foe').count()===2,'MJ Claude : ennemi_ajouter crée 2 gobelins');
const la=await pg.evaluate(()=>window.__lastAtk);ok(la&&/attaque Torvald/.test(la[0])&&/Épée longue/.test(la[1]),'MJ Claude : attaque_ennemi et attaque_pj résolues par le moteur');
await pg.fill('#say','Je regarde.');await pg.press('#say','Enter');await T(600);
const pr=await pg.evaluate(()=>window.__prompts[window.__prompts.length-1]);
ok(/COMBAT EN COURS[\s\S]*Gobelin pilleur 1/.test(pr)&&/Attaques : Épée longue \+5 \(1d8\+3\)/.test(pr),'Prompt : contient les ennemis (id, CA, PV) et les attaques des héros');
ok(/ne relance|appelle attaque_pj/.test(pr),'Prompt : consignes de combat présentes');
// persistance + isolation par campagne
await pg.reload();await T(600);await pg.click('[data-tab=jeu]');ok(await pg.locator('.foe').count()===2,'Persistance : le combat survit au rechargement');
await pg.selectOption('#camp-sel','c2');await T(400);ok(await pg.locator('.foe').count()===0,'Isolation : l\'autre campagne n\'a pas d\'ennemis');
await pg.selectOption('#camp-sel','c1');await T(400);ok(await pg.locator('.foe').count()===2,'Isolation : retour à la campagne 1, ennemis toujours là');

// ===== édition des attaques / création =====
await pickHero('p1');await pg.click('[data-act=atkedit]');
await pg.fill('.aer input[data-k=de] >> nth=0','1d10');await pg.press('.aer input[data-k=de] >> nth=0','Tab');await T(300);
ok((await pg.locator('.atk >> nth=0').innerText()).includes('1d10+3'),'Édition : dés changés en 1d10 → "1d10+3"');
await pg.selectOption('#add-w','Hache à deux mains');await T(300);ok(await pg.locator('.atk').count()===3,'Édition : ajout d\'une arme depuis la bibliothèque');
await pg.selectOption('#add-s','Mains brûlantes');await T(300);ok(await pg.locator('.atk').count()===4,'Édition : ajout d\'un sort depuis la bibliothèque');
await pg.click('[data-act=delatk] >> nth=2');await T(300);ok(await pg.locator('.atk').count()===3,'Édition : suppression d\'une attaque');
await pg.click('[data-act=atkedit]');
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Nouvelle');await pg.selectOption('#n-race-s','Human');await pg.selectOption('#n-classe-s','Mage');await pg.click('[data-act=createpj]');await T(400);
const k=await pg.locator('.atk').allInnerTexts();ok(k.length===3&&k.some(x=>/trait de feu/i.test(x))&&k.some(x=>/projectile/i.test(x))&&k.some(x=>/dague/i.test(x)),'Création : un Mage reçoit Dague, Trait de feu, Projectile magique');
await pg.screenshot({path:'combat.png'});
await pg.setViewportSize({width:390,height:900});await T(200);await pg.click('[data-pane=fiche]');await T(200);
ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile 390px : pas de débordement horizontal (fiche + attaques)');
await pg.click('[data-pane=chat]');await T(200);ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile 390px : pas de débordement (chat + combat)');
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})().catch(e=>{console.log(res.join('\n'));console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
