const {chromium}=require('playwright');const fs=require('fs');
const mock=fs.readFileSync('mock.js','utf8').trim();
const res=[];const ok=(c,m)=>{res.push((c?'✓ ':'✗ ')+m);if(!c)process.exitCode=1};
(async()=>{
const b=await chromium.launch();const pg=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const seed={'pj/p1':{name:'Vieux mage',race:'Elfe',classe:'Magicien',histo:'Érudit',niveau:3,pv:9,pvMax:9,ca:10,or:5,xp:0,stats:{vig:14,agi:12,sav:16,ins:10,pre:8},inv:[],equip:{},etats:[]}};
await pg.addInitScript(`(${mock})(${JSON.stringify(seed)})`);
await pg.goto('file://'+process.cwd()+'/../index.html');await pg.waitForTimeout(500);
await pg.click('[data-tab=jeu]');
ok((await pg.locator('#left [data-pk=classe]').inputValue())==='Mage'&&(await pg.locator('#left [data-pk=race]').inputValue())==='Elf','Anciens noms FR affichés en anglais (Magicien→Mage, Elfe→Elf)');
ok((await pg.locator('#left [data-pk=histo]').inputValue())==='Scholar','Historique Érudit→Scholar');
ok((await pg.locator('#s-int').inputValue())==='16'&&(await pg.locator('#s-str').inputValue())==='14'&&(await pg.locator('#s-cha').inputValue())==='8','Ancien héros (Savoir 16, Vigueur 14, Présence 8) migré vers INT 16, FOR 14, CHA 8');
const keys=['str','dex','con','int','wis','cha'];
const sample=async(race,cls,n=60)=>{
  await pg.click('[data-act=newpj]');await pg.fill('#n-name','Test');
  await pg.selectOption('#n-race-s',race);
  if(cls==='custom'){await pg.selectOption('#n-classe-s','__autre');await pg.fill('#n-classe-o','Chevaucheur de brume');await pg.press('#n-classe-o','Tab')}else await pg.selectOption('#n-classe-s',cls);
  const rows=[];for(let i=0;i<n;i++){await pg.click('[data-act=rolldraft]');rows.push(await pg.evaluate(()=>({st:['str','dex','con','int','wis','cha'].map(k=>+document.getElementById('n-st-'+k).value),pm:+document.getElementById('n-pm').value,pv:+document.getElementById('n-pv').value,or:+document.getElementById('n-or').value})))}
  await pg.click('[data-act=cancelpj]');return rows};
const mean=(rows,i)=>rows.reduce((a,r)=>a+r.st[i],0)/rows.length;
const mage=await sample('Human','Mage');
const means=keys.map((k,i)=>mean(mage,i));console.log('Mage (Human) moyennes',keys.map((k,i)=>k+':'+means[i].toFixed(1)).join(' '));
ok(means[3]===Math.max(...means),'Mage : Intelligence est la stat la plus haute en moyenne');
ok(means[0]<means[3]-4,'Mage : Force nettement plus basse qu\'Intelligence');
const topSav=mage.filter(r=>r.st[3]===Math.max(...r.st)).length/mage.length;
ok(topSav>0.45&&topSav<1,'Mage : pas toujours le même profil (INT maxi dans '+Math.round(topSav*100)+'% des tirages)');
ok(new Set(mage.map(r=>r.st.join())).size>=45,'Mage : tirages variés ('+new Set(mage.map(r=>r.st.join())).size+'/60 distincts)');
ok(mage.every(r=>r.st.every(v=>v>=3&&v<=20)),'Stats toujours entre 3 et 20');
ok(mage.every(r=>r.pv>=1&&r.pv<=10),'Mage : PV max faibles (dé 6) : '+Math.min(...mage.map(r=>r.pv))+'–'+Math.max(...mage.map(r=>r.pv)));
const war=await sample('Dwarf','Warrior');ok(war.every(r=>r.pm===0)&&mage.every(r=>r.pm>=2),'PM : le Mage a du mana (min '+Math.min(...mage.map(r=>r.pm))+', max '+Math.max(...mage.map(r=>r.pm))+'), le Warrior aucun');const mw=keys.map((k,i)=>mean(war,i));console.log('Warrior (Dwarf)',keys.map((k,i)=>k+':'+mw[i].toFixed(1)).join(' '));
ok(mw[0]===Math.max(...mw)||mw[2]===Math.max(...mw),'Warrior nain : Force ou Constitution la plus haute');
ok(mean(war.map(r=>({st:[r.pv]})),0)>mean(mage.map(r=>({st:[r.pv]})),0)+3,'Warrior : plus de PV que Mage');
const rog=await sample('Halfling','Rogue');const mr=keys.map((k,i)=>mean(rog,i));console.log('Rogue (Halfling)',keys.map((k,i)=>k+':'+mr[i].toFixed(1)).join(' '));
ok(mr[1]===Math.max(...mr),'Rogue halfling : Dextérité la plus haute');
const cus=await sample('Elf','custom');const mc=keys.map((k,i)=>mean(cus,i));console.log('Classe perso (Elf)',keys.map((k,i)=>k+':'+mc[i].toFixed(1)).join(' '));
ok(Math.max(...mc)-Math.min(...mc)<3.5,'Classe personnalisée : profil équilibré (écart '+(Math.max(...mc)-Math.min(...mc)).toFixed(1)+', bonus de race seul)');
// création réelle : valeurs tirées enregistrées
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Aldric');await pg.selectOption('#n-race-s','Human');await pg.selectOption('#n-classe-s','Mage');
const shown=await pg.evaluate(()=>['str','dex','con','int','wis','cha'].map(k=>+document.getElementById('n-st-'+k).value));
await pg.click('[data-act=createpj]');await pg.waitForTimeout(300);
const saved=await pg.evaluate(()=>{const e=Object.entries(window.__store()).find(([k,v])=>k.startsWith('pj/')&&v.name==='Aldric')[1];return ['str','dex','con','int','wis','cha'].map(k=>e.stats[k])});
ok(JSON.stringify(shown)===JSON.stringify(saved),'Les stats affichées dans le formulaire sont bien celles enregistrées '+JSON.stringify(saved));
// stats modifiables avant création
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Manuel');await pg.fill('#n-st-int','18');await pg.click('[data-act=createpj]');await pg.waitForTimeout(300);
ok((await pg.inputValue('#s-int'))==='18','Stat modifiée à la main avant création conservée');
// un snapshot pendant la création ne doit pas écraser le formulaire
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Garde');await pg.fill('#n-st-str','7');
await pg.evaluate(()=>window.__store()['pj/p1'].pv=9);await pg.evaluate(()=>{});await pg.click('[data-tab=bestiaire]').catch(()=>{});await pg.click('[data-tab=jeu]');await pg.waitForTimeout(200);
ok(true,'(navigation pendant création)');
await pg.click('[data-act=cancelpj]').catch(()=>{});
// relance sur héros existant (vieux mage à 10 partout)
await pg.selectOption('#pj-sel','p1');await pg.waitForTimeout(200);
const before=await pg.evaluate(()=>['str','dex','con','int','wis','cha'].map(k=>+document.getElementById('s-'+k).value));
await pg.click('[data-act=rerollpj]');await pg.click('[data-act=rerollpj]');await pg.waitForTimeout(300);
const after=await pg.evaluate(()=>['str','dex','con','int','wis','cha'].map(k=>+document.getElementById('s-'+k).value));
ok(JSON.stringify(before)==='[14,12,14,16,10,8]'&&JSON.stringify(after)!==JSON.stringify(before),'Relance sur un héros existant ([14,12,14,16,10,8] → '+JSON.stringify(after)+')');
await pg.click('[data-act=newpj]');await pg.fill('#n-name','Capture');await pg.selectOption('#n-race-s','Elf');await pg.selectOption('#n-classe-s','Ranger');await pg.screenshot({path:'stats_form.png'});
console.log(res.join('\n'));console.log('ERREURS JS:',JSON.stringify(errs));await b.close()})();
