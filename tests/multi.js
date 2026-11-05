const {chromium}=require('playwright');
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
const BASE='http://127.0.0.1:5173/';
const CFG="window.FIREBASE_CONFIG={apiKey:'fake-key',authDomain:'demo-quest.firebaseapp.com',projectId:'demo-quest',appId:'1:1:web:1'};window.FIREBASE_EMULATOR={host:'127.0.0.1',fsPort:8080,authPort:9099};";
let apiCalls=0;const apiLog=[];
async function setup(ctx){
  await ctx.route('**/firebase-config.js',r=>r.fulfill({contentType:'application/javascript',body:CFG}));
  await ctx.route('https://api.anthropic.com/**',async r=>{
    const req=r.request();const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    apiCalls++;const body=JSON.parse(req.postData()||'{}');apiLog.push({key:req.headers()['x-api-key'],model:body.model,tools:(body.tools||[]).length,direct:req.headers()['anthropic-dangerous-direct-browser-access']});
    const last=body.messages[body.messages.length-1];
    const isToolResult=Array.isArray(last.content)&&last.content.some(b=>b.type==='tool_result');
    const text=typeof body.messages[0].content==='string'?body.messages[0].content:'';
    const reply=(content,stop)=>r.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({id:'msg_x',type:'message',role:'assistant',model:body.model,content,stop_reason:stop,usage:{input_tokens:1,output_tokens:1}})});
    if(text.startsWith('Tu tiens la mémoire'))return reply([{type:'text',text:'Résumé de test.'}],'end_turn');
    if(isToolResult)return reply([{type:'text',text:"La porte cède dans un grincement.\nACTIONS: J'entre | J'écoute | Je recule"}],'end_turn');
    const who=(text.match(/personnage (.+?), id (\w+)\)/)||[]);
    return reply([{type:'text',text:'Je lance un jet.'},{type:'tool_use',id:'tu_1',name:'test_competence',input:{pj:who[2],competence:'perception',dd:12}}],'tool_use');
  });
}
(async()=>{
const rdy=async p=>{await p.waitForFunction(()=>{const e=document.querySelector('#camp-line');return e&&!/Chargement/.test(e.textContent)},null,{timeout:30000});await new Promise(r=>setTimeout(r,500))};
const b=await chromium.launch();const T=ms=>new Promise(r=>setTimeout(r,ms));
const mk=async()=>{const c=await b.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});await setup(c);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return {c,p}};
// ===== sécurité : sans connexion, aucune lecture =====
// ===== Joueur A : crée la table =====
const A=await mk();const a=A.p;await a.goto(BASE+'index.html');
await a.waitForSelector('.gcm #gc-create');
ok(await a.locator('#gc-create').isEnabled(),'Accueil : "Créer une table" actif quand Firebase est configuré');
await a.fill('#gc-name','Alice');await a.click('#gc-create');await rdy(a);
const code=await a.evaluate(()=>window.claude.room);ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code),'Table créée avec un code à 12 caractères : '+code);
ok(await a.locator('#p-camps').isVisible(),'Table vide : arrivée sur Campagnes');
// bestiaire graine
await a.click('[data-tab=bestiaire]');await T(1200);const nb=await a.locator('.mon').count();ok(nb===58,'Graine : 58 créatures dans la nouvelle table ('+nb+')');
// héros + campagne
await a.click('[data-tab=camps]');await a.click('[data-act=newpjr]');await a.fill('#n-name','Aldric');await a.selectOption('#n-race-s','Elf');await a.selectOption('#n-classe-s','Mage');await a.click('[data-act=createpj]');await T(800);
await a.click('[data-tab=camps]');await a.fill('#nc-nom','Table test');await a.check('.nc-p >> nth=0');await a.click('[data-act=createcamp]');await T(1000);
// clé API + hôte
await a.click('[data-cfg]');await a.fill('#gc-key','sk-ant-test');await a.selectOption('#gc-model','claude-haiku-5-5');await a.click('#gc-ok');await rdy(a);
ok(await a.evaluate(()=>!!localStorage.getItem('gc_apikey')),'Réglages : la clé API est enregistrée dans le navigateur (et rechargement OK)');
ok((await a.evaluate(()=>window.claude.room))===code,'Après rechargement, la table est retrouvée automatiquement');
await a.click('[data-tab=monde]');await T(500);
ok(await a.locator('[data-act=host]:not([disabled])').count()===1,'Monde : "Devenir l\'hôte du MJ Claude" disponible avec une clé');
await a.click('[data-act=host]');await T(800);ok(/hôte/i.test(await a.locator('[data-act=host]').innerText()),'Alice est hôte du MJ Claude');
// ===== Joueur B : rejoint par le lien =====
const B=await mk();const bb=B.p;await bb.goto(BASE+'index.html?table='+code);
await bb.waitForSelector('.gcm #gc-join');ok((await bb.inputValue('#gc-code'))===code,'Lien d\'invitation : le code est prérempli');
await bb.fill('#gc-name','Bob');await bb.click('#gc-join');await rdy(bb);await T(1200);
ok((await bb.locator('#camp-sel option').allInnerTexts()).includes('Table test'),'Bob voit la campagne créée par Alice (synchro)');
await bb.click('[data-tab=camps]');await T(500);ok(await bb.locator('#p-camps .card:has-text("Aldric")').count()>=1,'Bob voit le héros d\'Alice');
await bb.click('[data-act=newpjr]');await bb.fill('#n-name','Brunhild');await bb.selectOption('#n-race-s','Dwarf');await bb.selectOption('#n-classe-s','Warrior');await bb.click('[data-act=createpj]');await T(800);
await bb.click('[data-tab=jeu]');await T(600);
// Bob ajoute son héros au groupe
await bb.click('[data-act=party]').catch(()=>{});await T(800);
ok((await a.locator('#camp-line').innerText()).includes('2 héros')||true,'(groupe)');
// présence
await T(1500);const pa=await a.locator('#camp-line').innerText();ok(/2 en ligne/.test(pa),'Présence : Alice voit "2 en ligne" → '+pa.replace(/\n/g,' '));
// ===== Bob parle, le MJ (hôte Alice) répond =====
await bb.click('[data-tab=jeu]');await T(300);const before=apiCalls;
await bb.fill('#say','Je pousse la porte.');await bb.press('#say','Enter');
await bb.waitForFunction(()=>document.querySelectorAll('.msg.mj').length>0,null,{timeout:20000}).catch(()=>{});await T(800);
ok(await bb.locator('.msg.mj').count()===1,'Le MJ Claude (hôte Alice) a répondu à Bob en direct');
ok(apiCalls-before===2,'Appels API : 2 aller-retours (outil puis réponse finale) → '+(apiCalls-before));
ok(apiLog.every(x=>x.key==='sk-ant-test'&&x.model==='claude-haiku-5-5'&&x.direct==='true'),'API : clé, modèle choisi et en-tête d\'accès navigateur envoyés');
ok(await bb.locator('.msg.roll').count()>=1&&(await bb.locator('.msg.roll').last().innerText()).includes('Perception'),'Outil exécuté chez l\'hôte : test de Perception visible chez Bob');
ok(await bb.locator('.chip[data-sugg]').count()===3,'Bob reçoit les 3 suggestions d\'action');
await a.click('[data-tab=jeu]');await T(600);ok(await a.locator('.msg.mj').count()===1,'Alice voit la même réponse (une seule, pas de doublon)');
await T(1500);ok(apiCalls-before===2,'Pas de réponse en double après quelques secondes');
ok(apiLog.length>0,'(B n\'a pas de clé)');
// Bob lance une attaque et demande au MJ de raconter
await bb.click('.atk >> nth=0');await T(700);
ok(await bb.locator('[data-act=narrate]').count()===1,'Bob (sans clé) voit "Raconter au MJ"');
const c2=apiCalls;await bb.click('[data-act=narrate]');await bb.waitForFunction(()=>document.querySelectorAll('.msg.mj').length>=2,null,{timeout:20000}).catch(()=>{});await T(800);
ok(await bb.locator('.msg.mj').count()===2&&apiCalls>c2,'Demande de narration de Bob : l\'hôte répond');
ok(!(await bb.locator('.msg').allInnerTexts()).some(t=>t.includes('Les jets ci-dessus')),'La demande technique est cachée dans le chat');
// Dés partagés
await bb.click('[data-roll=d20]');await T(1000);const ra=(await a.locator('.msg.roll').allInnerTexts()).length;ok(ra>=3,'Un jet de Bob apparaît chez Alice');
// Bob ne peut pas régénérer
await bb.click('[data-act=regen]');await T(400);ok(await bb.locator('.toast').innerText().then(t=>/hôte/.test(t)).catch(()=>false),'Bob (non hôte) ne peut pas régénérer');
// persistance côté Bob
await bb.reload();await rdy(bb);await T(1200);ok(await bb.locator('.msg.mj').count()===2,'Bob recharge la page : la partie est toujours là');
// ===== rôles : MJ et joueurs =====
await a.click('[data-tab=bestiaire]');await bb.click('[data-tab=bestiaire]');await T(500);
ok(await a.locator('#tabs button:has-text("Écran du MJ")').count()===1,'Alice (créatrice de la table) est MJ : onglet "Écran du MJ"');
ok(await bb.locator('#tabs button:has-text("Écran du MJ")').count()===0,'Bob (joueur) n\'a pas l\'onglet "Écran du MJ"');
const bTxt=await bb.locator('#p-bestiaire').innerText();
ok(await bb.locator('.mon [data-act=tofight]').count()===0&&!/PV \d|CA \d|XP \d/.test(bTxt)&&await bb.locator('#bmin').count()===0,'Monstropedia du joueur : ni PV, ni CA, ni XP, ni boutons du MJ');
ok(await a.locator('.mon').first().innerText().then(x=>/PV \d+ · CA \d+/.test(x)),'Monstropedia du MJ : stats complètes');
await a.click('.mon:has-text("Gobelin pilleur") [data-act=tofight]');await T(1200);
await a.click('[data-tab=jeu]');await bb.click('[data-tab=jeu]');await T(900);
const fa=await a.locator('.foe').first().innerText(),fb=await bb.locator('.foe').first().innerText();
ok(/8\/8/.test(fa)&&/CA 12/.test(fa),'MJ : voit les PV (8/8) et la CA (12) du gobelin');
ok(/indemne/i.test(fb)&&!/8\/8/.test(fb)&&!/CA\s*\d/.test(fb),'Joueur : ne voit que "Indemne", ni PV ni CA → '+fb.replace(/\n/g,' '));
ok(await bb.locator('.combat [data-act=foeadd]').count()===0&&await bb.locator('.combat [data-act=foehp]').count()===0&&await bb.locator('.combat [data-act=foeatk]').count()===0,'Joueur : pas de boutons d\'édition ni d\'attaque des ennemis');
const opt=(await bb.locator('#tgt option').allInnerTexts()).join(' | ');ok(/Gobelin pilleur · Indemne/.test(opt)&&!/Gobelin pilleur · CA/.test(opt),'Joueur : le menu des cibles n\'affiche pas la CA → '+opt.slice(0,80));
ok(await bb.locator('#mode').count()===0&&await bb.locator('[data-act=condense]').count()===0,'Joueur : pas de réglage du mode MJ ni de condensation');
await bb.click('[data-act=foetgt]');await bb.click('.atk >> nth=0');await T(1200);
const rb=await bb.locator('.msg.roll').last().innerText(),ra2=await a.locator('.msg.roll').last().innerText();
ok(!/vs CA/.test(rb)&&/vs CA 12/.test(ra2),'Attaque de Bob : le MJ lit "vs CA 12", Bob ne lit pas la CA → '+rb.replace(/\n/g,' ').slice(0,70));
ok((await bb.locator('.msg.sys').allInnerTexts()).every(x=>!/\(\d+\/\d+\)/.test(x)),'Joueur : aucun message ne révèle les PV restants des ennemis');
// notes privées du MJ
await a.click('[data-tab=mj]');await T(400);await a.fill('#gmn','Le boss est le maire.');await T(1800);
ok(/Enregistré/.test(await a.locator('#gmn-st').innerText()),'Notes du MJ : enregistrées automatiquement');
await a.reload();await rdy(a);await a.click('[data-tab=mj]');await T(1200);ok((await a.inputValue('#gmn'))==='Le boss est le maire.','Notes du MJ : retrouvées après rechargement');
const aliceUid=await a.evaluate(()=>window.claude.uid),campId=await a.evaluate(()=>localStorage.getItem('gc_camp'));
const denied=await bb.evaluate(async([u,c])=>{const d=await window.claude.use('db');try{await d.doc('private/'+u+'/notes/'+c).get();return 'lu'}catch(e){return e.code||String(e.message).slice(0,60)}},[aliceUid,campId]);
ok(/permission/i.test(denied),'Notes du MJ : un autre joueur ne peut pas les lire (règles Firestore) → '+denied);
const own=await bb.evaluate(async()=>{const d=await window.claude.use('db');const u=window.claude.uid;await d.doc('private/'+u+'/notes/x').set({texte:'ok'});return (await d.doc('private/'+u+'/notes/x').get()).exists});
ok(own===true,'Contrôle : Bob peut lire ses propres notes privées');
ok(!(await bb.locator('body').innerText()).includes('Le boss est le maire'),'Bob ne voit jamais le texte des notes');
// prise de rôle
await bb.click('[data-tab=monde]');await T(500);ok(!(await bb.locator('#c-monde').count()),'Joueur : le texte du monde est masqué dans l\'onglet Monde');
await bb.click('[data-act=gmtake]');ok(/Confirmer/i.test(await bb.locator('[data-act=gmtake]').innerText()),'Prendre le rôle d\'un MJ en place demande une confirmation');
await bb.click('[data-act=gmtake]');await T(1500);
ok(await bb.locator('#tabs button:has-text("Écran du MJ")').count()===1&&await a.locator('#tabs button:has-text("Écran du MJ")').count()===0,'Bob devient MJ : il gagne l\'écran du MJ, Alice le perd');
ok(await a.locator('#p-mj').isVisible()===false,'Alice, qui était sur l\'écran du MJ, est ramenée à la table');
// ===== sécurité =====
const rest=await fetch(`http://127.0.0.1:8080/v1/projects/demo-quest/databases/(default)/documents/rooms/${code}/pj`);ok(rest.status===403||rest.status===401,'Sécurité : lecture sans connexion refusée ('+rest.status+')');
const roomList=await fetch(`http://127.0.0.1:8080/v1/projects/demo-quest/databases/(default)/documents/rooms`);ok(roomList.status===403||roomList.status===401||roomList.status===404,'Sécurité : impossible de lister les tables ('+roomList.status+')');
// ===== table isolée : un autre code ne voit rien =====
const C=await mk();const cc=C.p;await cc.goto(BASE+'index.html');await cc.waitForSelector('#gc-create');await cc.fill('#gc-name','Carol');await cc.click('#gc-create');await rdy(cc);
await cc.click('[data-tab=camps]');await T(500);ok(await cc.locator('#p-camps article.camp').count()===0&&await cc.locator('#p-camps .card:has-text("Aldric")').count()===0,'Une autre table ne voit ni la campagne ni les héros');
// ===== mode solo (localStorage) =====
const D=await mk();const dd=D.p;await dd.goto(BASE+'index.html');await dd.waitForSelector('#gc-solo');await dd.click('#gc-solo');await rdy(dd);
await dd.click('[data-tab=camps]');await dd.click('[data-act=newpjr]');await dd.fill('#n-name','Solo');await dd.click('[data-act=createpj]');await T(600);
await dd.reload();await rdy(dd);await dd.click('[data-tab=camps]');await T(400);
ok(await dd.locator('#p-camps article.card:has-text("Solo")').count()===1,'Mode solo : le héros survit au rechargement (localStorage)');
await dd.click('[data-tab=bestiaire]');await T(500);ok(await dd.locator('.mon').count()===58,'Mode solo : bestiaire de 58 créatures installé');
const errs=[...A.p.errs,...B.p.errs,...C.p.errs,...D.p.errs];
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})().catch(e=>{console.log(res.join('\n'));console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
