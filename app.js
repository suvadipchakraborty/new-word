const API='https://api.dictionaryapi.dev/api/v2/entries/en/';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let all=[],list=[],i=0,filter='all',shuffle=false,audio=null,cur=null,tok=0,done=false,hist=[],hp=-1;
const seen=new Set((()=>{try{return JSON.parse(sessionStorage.getItem('seen'))||[]}catch{return[]}})());
const saveSeen=()=>{try{sessionStorage.setItem('seen',JSON.stringify([...seen]))}catch{}};
const favs=new Set(LS('favs',[])),mast=new Set(LS('mast',[]));

function parseCSV(t){
  const [h,...rows]=t.trim().split(/\r?\n/),k=h.split(',').map(s=>s.trim());
  return rows.filter(Boolean).map(l=>{const c=l.split(',');return Object.fromEntries(k.map((x,j)=>[x,(c[j]||'').trim()]))});
}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2000)}

const WIKI='https://en.wiktionary.org/api/rest_v1/page/definition/';
const plain=h=>new DOMParser().parseFromString(h||'','text/html').body.textContent.trim();
async function jget(url){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);
  try{const r=await fetch(url,{signal:ac.signal});if(!r.ok)throw 0;return await r.json()}finally{clearTimeout(t)}
}
async function viaDict(w){
  const e=(await jget(API+encodeURIComponent(w)))[0],ph=e.phonetics||[];
  return{phonetic:e.phonetic||(ph.find(p=>p.text)||{}).text||'',
    audio:(ph.find(p=>p.audio)||{}).audio||'',
    meanings:e.meanings.map(m=>({pos:m.partOfSpeech,
      defs:m.definitions.slice(0,2).map(d=>d.definition),
      ex:m.definitions.map(d=>d.example).filter(Boolean).slice(0,2),
      syn:[...new Set([...(m.synonyms||[]),...m.definitions.flatMap(d=>d.synonyms||[])])].slice(0,5)}))};
}
async function viaWiki(w){
  const en=(await jget(WIKI+encodeURIComponent(w))).en||[];
  if(!en.length)throw 0;
  return{phonetic:'',audio:'',meanings:en.slice(0,3).map(m=>({pos:(m.partOfSpeech||'').toLowerCase(),
    defs:m.definitions.map(d=>plain(d.definition)).filter(Boolean).slice(0,2),
    ex:m.definitions.flatMap(d=>(d.examples||[]).map(plain)).filter(Boolean).slice(0,2),syn:[]}))};
}
async function getDef(w){
  const key='def:'+w,c=LS(key,null);if(c)return c;
  for(const src of [viaDict,viaWiki]){
    try{const out=await src(w);if(out.meanings.length){put(key,out);return out}}catch{}
  }
  return null;
}

function buildList(){
  list=all.filter(w=>filter==='all'||(filter==='fav'&&favs.has(w.word))||(filter==='mast'&&mast.has(w.word)));
}
function pickNext(){
  const un=list.filter(w=>!seen.has(w.word));if(!un.length)return null;
  if(shuffle)return un[Math.random()*un.length|0];
  return un.find(w=>list.indexOf(w)>i)||un[0];
}
function show(w){i=list.indexOf(w);done=false;render()}
function start(){
  buildList();hist=[];hp=-1;
  const w=pickNext();
  if(w){hist=[w.word];hp=0;show(w)}else{done=true;render()}
}
function stats(){
  $('#statText').textContent=`${mast.size} mastered · ${all.length-mast.size} to go`;
  $('#barFill').style.width=(all.length?mast.size/all.length*100:0)+'%';
}
async function render(keep){
  stats();
  const w=!done&&list[i];
  $('#card').hidden=!w;$('#empty').hidden=!!w;$('#restart').hidden=!!w||!list.length;
  $$('.actions button').forEach(b=>b.disabled=!w);
  if(!w){
    $('#counter').textContent='';
    $('#empty').textContent=!list.length?(filter==='fav'?'No saved words yet. Tap Save on a card to keep it here.':'No mastered words yet. Tap Mastered when you know a word.'):'You have seen every word in this set this session. Start a new session to go through them again.';
    return;
  }
  seen.add(w.word);saveSeen();
  cur=w;const my=++tok;
  if(!keep)$('#card').classList.remove('flip');
  $('#counter').textContent=`Word ${list.filter(x=>seen.has(x.word)).length} of ${list.length} · ${w.difficulty||''}`;
  $('#word').textContent=w.word;$('#phon').textContent='';$('#speak').hidden=false;audio=null;
  $('#meanings').innerHTML='<p class="load">Loading…</p>';
  $('#fav').setAttribute('aria-pressed',favs.has(w.word));$('#fav').textContent=favs.has(w.word)?'★ Saved':'☆ Save';
  $('#mast').setAttribute('aria-pressed',mast.has(w.word));
  const d=await getDef(w.word);if(my!==tok)return;
  w.def=d;
  if(!d){
    $('#meanings').innerHTML=`<h3>${esc(w.word)}</h3><p>We couldn't load this definition from either dictionary source. Check your connection, then try again.</p><button class="retry primary">Try again</button>`;return;
  }
  $('#phon').textContent=d.phonetic;
  if(d.audio)audio=new Audio(d.audio);
  $('#meanings').innerHTML=`<h3>${esc(w.word)}</h3>`+d.meanings.map(m=>`<span class="pos">${esc(m.pos)}</span><ol>${m.defs.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`
    +m.ex.map(x=>`<p class="ex">“${esc(x)}”</p>`).join('')+(m.syn.length?`<p class="syn">Synonyms: ${m.syn.map(esc).join(', ')}</p>`:'')).join('');
}
function go(d){
  if(!list.length)return;
  const byW=x=>list.find(w=>w.word===x);
  if(d<0){if(hp>0){hp--;show(byW(hist[hp]))}else toast('This is your first word');return}
  if(hp<hist.length-1){hp++;show(byW(hist[hp]));return}
  const w=pickNext();
  if(!w){done=true;render();return}
  hist.push(w.word);hp=hist.length-1;show(w);
}
const flip=()=>$('#card').classList.toggle('flip');

$('#card').addEventListener('click',flip);
$('#card').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}});
document.addEventListener('keydown',e=>{if($('#home').classList.contains('active')){if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)}});
$('#speak').onclick=e=>{e.stopPropagation();
  const tts=()=>{if(!cur||!window.speechSynthesis)return toast('Audio unavailable');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(cur.word);u.lang='en-US';speechSynthesis.speak(u)};
  if(audio){audio.currentTime=0;audio.play().catch(tts)}else tts()};
$('#meanings').addEventListener('click',e=>{if(e.target.classList.contains('retry')){e.stopPropagation();render(true)}});
$('#next').onclick=()=>go(1);$('#prev').onclick=()=>go(-1);
let sx=0;const st=$('#stage');
st.addEventListener('touchstart',e=>sx=e.changedTouches[0].clientX,{passive:true});
st.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>60)go(dx<0?1:-1)});
function toggle(set,key,btnId,on,off){
  if(!cur)return;set.has(cur.word)?set.delete(cur.word):set.add(cur.word);put(key,[...set]);
  const a=set.has(cur.word);$(btnId).setAttribute('aria-pressed',a);if(on)$(btnId).textContent=a?on:off;stats();
  if(!a&&((key==='favs'&&filter==='fav')||(key==='mast'&&filter==='mast'))){toast('Removed from this list')}
}
$('#fav').onclick=()=>toggle(favs,'favs','#fav','★ Saved','☆ Save');
$('#mast').onclick=()=>{toggle(mast,'mast','#mast');toast(mast.has(cur.word)?'Marked as mastered':'Unmarked')};
$$('#filters [data-f]').forEach(b=>b.onclick=()=>{
  $$('#filters [data-f]').forEach(x=>x.classList.toggle('on',x===b));filter=b.dataset.f;start()});
$('#shuffle').onclick=e=>{shuffle=!shuffle;e.currentTarget.setAttribute('aria-pressed',shuffle);toast(shuffle?'Shuffle on: next words are random':'Shuffle off: next words in list order')};
$('#restart').onclick=()=>{seen.clear();saveSeen();start()};
$$('.tabs button').forEach(b=>b.onclick=()=>{
  $$('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.id===b.dataset.t));scrollTo(0,0)});
$('#share').onclick=async()=>{
  const d=cur&&cur.def,def=d&&d.meanings[0]?d.meanings[0].defs[0]:'';
  const text=cur?`${cur.word}${d&&d.phonetic?' '+d.phonetic:''}${def?' – '+def:''}`:'Lexicon vocabulary flashcards';
  const data={title:'Lexicon',text,url:location.href.split('#')[0]};
  try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${text}\n${data.url}`);toast('Copied to clipboard')}}
  catch(e){if(e.name!=='AbortError')toast('Could not share')}
};
let dip=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#install').hidden=false});
$('#install').onclick=async()=>{if(!dip)return;dip.prompt();await dip.userChoice;dip=null;$('#install').hidden=true};
addEventListener('appinstalled',()=>$('#install').hidden=true);

(async()=>{
  try{all=parseCSV(await (await fetch('words.csv')).text())}catch{$('#word').textContent='Could not load words.csv'}
  const u=new Set();all=all.filter(w=>w.word&&!u.has(w.word.toLowerCase())&&u.add(w.word.toLowerCase()));
  start();
})();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
