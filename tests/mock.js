// injecté avant la page : base de données simulée (persistée) + MJ scripté
(function(seed){
  window.__q=[];const _r=Math.random.bind(Math);Math.random=()=>window.__q.length?window.__q.shift():_r();
  let store={};try{store=JSON.parse(window.name&&window.name.startsWith('{')?window.name:'null')||{}}catch(e){}
  if(!Object.keys(store).length&&seed)store=JSON.parse(JSON.stringify(seed));
  const subs=[];const save=()=>{try{window.name=JSON.stringify(store)}catch(e){}};
  const fire=()=>{save();subs.forEach(f=>f())};
  const mk=p=>({id:p.split('/').pop(),path:p,get:async()=>({id:p.split('/').pop(),exists:p in store,data:()=>store[p]}),
    set:async d=>{store[p]=JSON.parse(JSON.stringify(d));fire()},
    update:async d=>{if(!(p in store))throw {code:'invalid_argument',message:'absent '+p};store[p]={...store[p],...JSON.parse(JSON.stringify(d))};fire()},
    delete:async()=>{delete store[p];fire()},
    onSnapshot:cb=>{let on=true;const run=()=>{if(on)cb({id:p.split('/').pop(),exists:p in store,data:()=>store[p]})};subs.push(run);setTimeout(run,0);return()=>{on=false}}});
  const docsOf=(col,ord,lim)=>{let ks=Object.keys(store).filter(k=>k.startsWith(col+'/')&&!k.slice(col.length+1).includes('/'));
    let docs=ks.map(k=>({id:k.split('/').pop(),exists:true,data:()=>store[k]}));
    if(ord)docs.sort((a,b)=>((a.data()[ord[0]]||0)-(b.data()[ord[0]]||0))*(ord[1]==='desc'?-1:1));if(lim)docs=docs.slice(0,lim);return docs};
  const query=(col,ord,lim)=>({orderBy:(f,d)=>query(col,[f,d||'asc'],lim),limit:n=>query(col,ord,n),
    get:async()=>{const docs=docsOf(col,ord,lim);return {docs,empty:!docs.length,size:docs.length}},
    onSnapshot:cb=>{let on=true;const run=()=>{if(on)cb({docs:docsOf(col,ord,lim)})};subs.push(run);setTimeout(run,0);return()=>{on=false}}});
  const db={doc:mk,collection:c=>({...query(c),doc:id=>mk(c+'/'+(id||Math.random().toString(36).slice(2,8)))})};
  window.__store=()=>store;window.__prompts=[];window.__sampleCalls=0;window.__failNext=null;
  const sample=async(input,o)=>{
    window.__sampleCalls++;window.__prompts.push(input);
    if(window.__failNext){const e=window.__failNext;window.__failNext=null;throw e}
    if(o&&o.signal&&o.signal.aborted)throw {code:'cancelled'};
    const tools=Object.fromEntries(((o&&o.tools)||[]).map(t=>[t.name,t]));
    const txt=String(input);
    if(txt.startsWith('Tu tiens la mémoire'))return {text:'Les héros ont franchi la porte de la tour. Une goule rôde. Quête : retrouver la clé rouillée.',truncated:false};
    const last=txt.split('NOUVEAU MESSAGE DU JOUEUR')[1]||'';
    const mm=last.match(/personnage (.+?), id (\w+)\)/);const first=mm?{id:mm[2],name:mm[1]}:null;let out='';
    const ctx={signal:new AbortController().signal};
    if(/porte/i.test(last)){await tools.lancer_des.execute({expression:'d20+2',raison:'Perception DD 12'},ctx);out="La porte cède dans un grincement. Une salle ronde, des torches éteintes et une odeur de cendre.\nACTIONS: J'allume une torche | J'examine le sol | Je referme la porte"}
    else if(/goule|attaque/i.test(last)){await tools.bestiaire_ajouter.execute({nom:'Goule de la tour',type:'Mort-vivant',dg:3,pv:22,ca:12,att:'Griffes +4 (1d6)',desc:'Une silhouette décharnée aux yeux laiteux.'},ctx);
      const dup=await tools.bestiaire_ajouter.execute({nom:'goule de la tour',desc:'dup'},ctx);
      await tools.lancer_des.execute({expression:'d20+3',raison:'Attaque de la goule'},ctx);
      await tools.modifier_pj.execute({pj:first.id,champ:'pv',valeur:4},ctx);
      await tools.etat_pj.execute({pj:first.id,etat:'Empoisonné',actif:true},ctx);
      out="La goule bondit et vous griffe l'épaule. Le poison brûle déjà.\nACTIONS: Je riposte | Je recule | Je cherche un antidote"}
    else if(/fouille/i.test(last)){await tools.inventaire.execute({pj:first.id,action:'ajouter',objet:'Clé rouillée'},ctx);
      await tools.journal_ajouter.execute({kind:'quete',titre:'La clé rouillée',texte:'Trouver la serrure qu\'ouvre la clé.'},ctx);
      out="Sous une dalle, une clé rouillée.\nACTIONS: Je monte l'escalier | Je range la clé"}
    else if(/initiative/i.test(last)){window.__ini=[await tools.initiative_lancer.execute({},ctx),await tools.tour_suivant.execute({},ctx)];out="Le combat commence !\nACTIONS: J'attaque | Je me protège"}
    else if(/discr/i.test(last)){window.__chk=await tools.test_competence.execute({pj:first.id,competence:'discretion',dd:12},ctx);out="Vous vous glissez dans l'ombre.\nACTIONS: J'avance"}
    else if(/récompense/i.test(last)){window.__xp=await tools.xp_donner.execute({montant:100},ctx);out="Le village vous remercie.\nACTIONS: Je fête ça"}
    else if(/embuscade/i.test(last)){const r=await tools.ennemi_ajouter.execute({nom:'Gobelin pilleur',bestiaire:'Gobelin pilleur',quantite:2},ctx);const ids=[...r.matchAll(/\[(e\w+)\]/g)].map(x=>x[1]);
      window.__lastAtk=[await tools.attaque_ennemi.execute({ennemi:ids[0],cible_pj:first.id},ctx),await tools.attaque_pj.execute({pj:first.id,attaque:'épée',cible:ids[1]},ctx)];
      out="Deux gobelins jaillissent des fourrés !\nACTIONS: Je riposte | Je recule"}
    else if(/épée/i.test(last)){await tools.inventaire.execute({pj:first.id,action:'ajouter',objet:'Épée courte'},ctx);await tools.equiper.execute({pj:first.id,emplacement:'main1',objet:'Épée courte'},ctx);
      out="Vous dégainez une épée courte, légère et bien équilibrée.\nACTIONS: J'attaque | J'attends"}
    else out="Le silence retombe sur la pièce.\nACTIONS: J'avance | Je m'arrête";
    o&&o.onText&&o.onText({text:out,delta:out});
    return {text:out,truncated:false};
  };
  sample.json=async()=>({nom:'La Tour des Cendres',ton:'sombre, mystérieux',monde:'Un royaume enseveli sous les cendres d\'un volcan éteint.'});
  window.claude={use:async n=>n==='db'?db:n==='sample'?sample:n==='downloads'?{save:async()=>{}}:null};
})
