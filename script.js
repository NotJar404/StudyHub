const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== CALM SKY: SOFT STARS (NIGHT), FALLING LEAVES FROM THE TREE, LEAF TRAIL =====
// Safe for sensitive viewers: no flashing, slow fades only.
(()=>{
  const cv=$('#bg'),c=cv.getContext('2d'),tv=$('#tr'),t=tv.getContext('2d');
  let W,H,stars=[],parts=[];
  const night=()=>document.documentElement.dataset.theme==='night';
  const GL=['#d9a43a','#e8b84a','#c98a2c','#b8731f'],GN=['#a7823a','#8d6322','#b99448','#7a5420'];
  const leaf=(g,x,y,s,a)=>{g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.ellipse(0,0,s,s*.32,0,0,7);g.fill();g.restore()};
  const spawn=(l,first)=>{const k=$('#canopy'),r=k&&k.getBoundingClientRect();
    if(r&&r.width>0&&r.bottom>60&&r.top<innerHeight){l.x=r.left+r.width*(.08+Math.random()*.84);l.y=Math.max(r.bottom-r.height*(.08+Math.random()*.4),0)}
    else{l.x=Math.random()*W;l.y=first?Math.random()*H:-20}};
  const size=()=>{W=cv.width=tv.width=innerWidth;H=cv.height=tv.height=innerHeight;stars=Array.from({length:Math.min(150,W*H/10000|0)},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.3,p:Math.random()*6}))};
  addEventListener('resize',size);size();
  const leaves=Array.from({length:18},()=>{const l={s:Math.random()*4+6,v:Math.random()*.4+.25,a:Math.random()*6,w:Math.random()*.01+.003,i:Math.random()*4|0};spawn(l,true);return l});
  if(!still)addEventListener('mousemove',e=>{if(Math.random()<.6)parts.push({x:e.clientX,y:e.clientY,vx:(Math.random()-.5)*.8,vy:Math.random()*.7+.2,l:1,r:Math.random()*3+3,a:Math.random()*6,i:Math.random()*4|0})});
  const draw=n=>{
    const th=night(),P=th?GN:GL;c.clearRect(0,0,W,H);
    if(th)stars.forEach(s=>{c.globalAlpha=.45+.25*Math.sin(n/2500+s.p);c.fillStyle='#fff';c.beginPath();c.arc(s.x,s.y,s.r,0,7);c.fill()});
    c.globalAlpha=th?.7:.85;
    leaves.forEach(l=>{l.y+=l.v;l.x+=Math.sin(l.a)*.5;l.a+=l.w;if(l.y>H+20)spawn(l,false);c.fillStyle=P[l.i];leaf(c,l.x,l.y,l.s,l.a*3)});
    t.clearRect(0,0,W,H);parts=parts.filter(p=>p.l>0);
    parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a+=.05;p.l-=.025;t.globalAlpha=p.l*.9;t.fillStyle=P[p.i];leaf(t,p.x,p.y,p.r*1.6,p.a)});
    if(!still)requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  new MutationObserver(()=>{if(still)requestAnimationFrame(draw)}).observe(document.documentElement,{attributes:true});
})();

// ===== DAY / NIGHT (DAY BY DEFAULT) AND MOBILE MENU =====
(()=>{
  const b=$('#theme'),r=document.documentElement,nav=$('#nav'),bg=$('#burger');
  const svg=p=>'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  const MOON=svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>')+'<span>Night</span>';
  const SUN=svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-2.93 1.41-1.41m11.32-11.32 1.41-1.41M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41"/>')+'<span>Day</span>';
  // Day is the standard on every page. Night only turns on when you press the button, and it is remembered on every page.
  const saved=()=>{try{return localStorage.getItem('theme')==='night'?'night':'day'}catch(e){return'day'}};
  const show=m=>{r.dataset.theme=m;b.innerHTML=m==='night'?SUN:MOON;b.setAttribute('aria-pressed',m==='night');b.setAttribute('aria-label',m==='night'?'Switch to day mode':'Switch to night mode')};
  show(saved());
  b.onclick=()=>{
    const m=r.dataset.theme==='night'?'day':'night';
    try{localStorage.setItem('theme',m)}catch(e){}
    r.classList.add('theming');show(m);clearTimeout(b._t);b._t=setTimeout(()=>r.classList.remove('theming'),700);
  };
  addEventListener('storage',e=>{if(e.key==='theme')show(saved())});
  const close=()=>{nav.classList.remove('open');bg.setAttribute('aria-expanded','false')};
  bg.onclick=()=>bg.setAttribute('aria-expanded',nav.classList.toggle('open'));
  $$('#menu a').forEach(a=>a.addEventListener('click',close));
  addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();

// ===== GENTLE REVEAL ON SCROLL =====
(()=>{
  const els=$$('.rv');
  if(still||!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  els.forEach(e=>io.observe(e));
})();

// ===== SMALL HELPERS =====
const store={get:(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const copyText=async t=>{try{await navigator.clipboard.writeText(t);return true}catch(e){return false}};

// ===== GRADE CALCULATOR: ACTIVITIES + QUIZZES + ASSIGNMENTS (60%), EXAM (40%) =====
// Edit this table to match your teacher's Excel: [lowest percent, grade]. Below 64.5 is 5.0.
const SCALE=[[96.5,1],[92.5,1.25],[88.5,1.5],[84.5,1.75],[80.5,2],[76.5,2.25],[72.5,2.5],[68.5,2.75],[64.5,3]];
const toGrade=p=>(SCALE.find(s=>p>=s[0])||[0,5])[1];
if($('#g-cats')){
  const box=$('#g-cats'),fmt=g=>g%1?String(g):g.toFixed(1);
  const row=h=>{const d=document.createElement('div');d.className='r3';d.innerHTML='<input type="number" min="0" step="any" placeholder="Score" aria-label="Score"><input type="number" min="1" step="any" placeholder="Total items" aria-label="Total items"><button type="button" class="x" aria-label="Remove">×</button>';d.querySelector('.x').onclick=()=>{d.remove();calc()};h.appendChild(d)};
  [['Activities',20],['Quizzes',20],['Assignments',20]].forEach(([n,w])=>{
    const s=document.createElement('div');s.className='cat';s.dataset.k=n;
    s.innerHTML='<div class="cat-h"><h3>'+n+'</h3><label>Weight <input type="number" class="w" min="0" max="100" value="'+w+'" aria-label="'+n+' weight">%</label></div><div class="rows"></div><button type="button" class="ghost">+ Add item</button>';
    const h=s.querySelector('.rows');for(let i=0;i<3;i++)row(h);
    s.querySelector('.ghost').onclick=()=>row(h);box.appendChild(s);
  });
  $('#g-scale').innerHTML='<table><tr><th>Final percentage</th><th>Grade</th></tr>'+SCALE.map((s,i)=>'<tr><td>'+s[0]+' to '+(i?(SCALE[i-1][0]-.1).toFixed(1):'100')+'</td><td>'+s[1].toFixed(2)+'</td></tr>').join('')+'<tr><td>64.4 and below</td><td>5.00</td></tr></table>';
  const calc=()=>{
    const parts=[];
    $$('#g-cats .cat').forEach(c=>{let s=0,t=0;c.querySelectorAll('.r3').forEach(r=>{const i=r.querySelectorAll('input'),a=parseFloat(i[0].value),b=parseFloat(i[1].value);if(a>=0&&b>0){s+=a;t+=b}});parts.push({n:c.dataset.k,s,t,w:parseFloat(c.querySelector('.w').value)||0})});
    const es=parseFloat($('#ex-s').value),et=parseFloat($('#ex-t').value);
    parts.push({n:'Exam',s:es>=0?es:0,t:et>0?et:0,w:parseFloat($('#ex-w').value)||0});
    let fin=0,wt=0,csP=0,csW=0;const miss=[];
    const rows=parts.map((p,k)=>{const pct=p.t?p.s/p.t*100:0,pts=pct*p.w/100;if(!p.t)miss.push(p.n);fin+=pts;wt+=p.w;if(k<3){csP+=pts;csW+=p.w}return '<tr><td data-l="Category"><b>'+p.n+'</b></td><td data-l="Computation">'+(p.t?p.s+' ÷ '+p.t+' × 100':'no items')+'</td><td data-l="Percent">'+pct.toFixed(1)+'%</td><td data-l="Weight">'+p.w+'%</td><td data-l="Points">'+pts.toFixed(2)+'</td></tr>'}).join('');
    const exP=parts[3].t?parts[3].s/parts[3].t*parts[3].w:0,exW=parts[3].w;
    fin=Math.round(fin*10)/10;const g=toGrade(fin),none=miss.length===parts.length;
    $('#ring').style.setProperty('--p',none?0:Math.min(fin,100));
    $('#g-big').textContent=none?'—':fmt(g);
    $('#g-pct').textContent=none?'':fin.toFixed(1)+'%';
    $('#g-badge').textContent=none?'Waiting for scores':g>3?'Needs improvement':'Passing';
    $('#g-badge').className='badge '+(none?'':g>3?'bad':'ok');
    $('#g-msg').textContent=none?'Enter your scores to start.':g<=1.5?'Outstanding work.':g<=2?'You’re on the right track.':g<=3?'You’re passing. Keep going.':'Time to catch up. You can do this.';
    $('#t-cs').textContent=csP.toFixed(1)+' / '+csW;$('#b-cs').style.width=(csW?Math.min(csP/csW*100,100):0)+'%';
    $('#t-ex').textContent=exP.toFixed(1)+' / '+exW;$('#b-ex').style.width=(exW?Math.min(exP/exW*100,100):0)+'%';
    $('#g-note').textContent=(!none&&miss.length?'Missing: '+miss.join(', ')+'. ':'')+(wt!==100?'Weights add up to '+wt+'%, not 100%. ':'')+'This is an estimate for planning. Always confirm official grades with your instructor.';
    $('#g-steps').innerHTML=rows+'<tr class="sum"><td colspan="4"><b>Total points</b></td><td data-l="Total"><b>'+fin.toFixed(1)+'</b></td></tr>';
  };
  $('.tool-card-split').addEventListener('input',calc);
  $('#g-reset').onclick=()=>{$$('#g-cats .r3 input,#ex-s,#ex-t').forEach(i=>i.value='');calc()};
  calc();
}

// ===== REVIEWER DECK: .txt file -> flashcards and a quiz =====
// Each line is one item: Term - Definition  (also works with ":" or "=" or a Tab)
if($('#dk-file')){
  let cards=store.get('dk3',[]),name=store.get('dk3n','Your reviewer'),mode='flash',i=0,qz=null;
  const parse=t=>{const ok=[];let bad=0;t.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(l=>{const m=l.match(/^(.+?)(?:\t+|\s+[-–—]\s+|\s*[:=]\s*)(.+)$/);m?ok.push({t:m[1].trim(),d:m[2].trim()}):bad++});return{ok,bad}};
  const load=(t,nm)=>{const r=parse(t);if(!r.ok.length){$('#dk-msg').textContent='No items found. Write each line like: Term - Definition';return}
    cards=r.ok;name=nm;i=0;mode='flash';qz=null;store.set('dk3',cards);store.set('dk3n',name);
    $('#dk-msg').textContent=cards.length+' cards created'+(r.bad?' ('+r.bad+' lines skipped).':'.');draw()};
  const shuf=a=>{a=[...a];for(let k=a.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[a[k],a[j]]=[a[j],a[k]]}return a};
  const draw=()=>{
    const out=$('#dk-out');
    if(!cards.length){out.innerHTML='<p class="empty">Upload a .txt reviewer to create your flashcards.</p>';return}
    let h='<div class="dh2"><div><span class="eyebrow" style="margin:0">Your reviewer</span><h3>'+esc(name)+'</h3></div><span class="badge">'+cards.length+' cards</span></div><div class="dtabs"><button type="button" class="'+(mode==='flash'?'sel':'')+'" data-m="flash">Flashcards</button><button type="button" class="'+(mode==='quiz'?'sel':'')+'" data-m="quiz">Quiz</button></div>';
    if(mode==='flash'){
      const c=cards[i];
      h+='<div class="prog"><i style="width:'+((i+1)/cards.length*100)+'%"></i></div><div class="fc" id="fc" tabindex="0" role="button" aria-label="Flip the flashcard"><div class="fci"><div class="fcf"><div><span class="lbl">Term</span>'+esc(c.t)+'</div></div><div class="fcb"><div><span class="lbl">Definition</span>'+esc(c.d)+'</div></div></div></div><div class="nav2"><button type="button" data-a="prev">← Prev</button><span class="note">'+(i+1)+' / '+cards.length+'</span><button type="button" data-a="next">Next →</button></div><p style="text-align:center;margin:1rem 0 0"><button type="button" class="ghost" data-a="shuffle">Shuffle cards</button></p><p class="note" style="text-align:center">Tap the card to flip it.</p>';
    }else if(cards.length<4){h+='<p class="empty">A quiz needs at least 4 cards.</p>'}
    else if(!qz){h+='<p class="note">Each question shows a term and four definitions. Pick the right one. Set the quiz length on the left.</p><button type="button" class="btn-primary" data-a="start" style="width:100%">Start quiz</button>'}
    else if(qz.done){
      h+='<div class="result"><p class="step">Quiz complete</p><p class="big">'+qz.score+' / '+qz.q.length+'</p><h2>'+Math.round(qz.score/qz.q.length*100)+'% correct</h2></div>'+(qz.miss.length?'<details open><summary>Review what you missed</summary>'+qz.miss.map(m=>'<div class="kv"><small>'+esc(m.t)+'</small>'+esc(m.d)+'</div>').join('')+'</details>':'<p class="ok" style="text-align:center">Perfect score!</p>')+'<p style="margin-top:1rem;text-align:center"><button type="button" class="btn-primary" data-a="start">Try again</button></p>';
    }else{
      const q=qz.q[qz.k];if(!q.o)q.o=shuf([q.d,...shuf(cards.filter(c=>c.d!==q.d)).slice(0,3).map(c=>c.d)]);
      h+='<div class="prog"><i style="width:'+(qz.k/qz.q.length*100)+'%"></i></div><p class="note">Question '+(qz.k+1)+' of '+qz.q.length+'</p><p class="q">'+esc(q.t)+'</p>'+q.o.map((o,n)=>'<button type="button" class="opt2'+(qz.pick!==null?(o===q.d?' good':n===qz.pick?' wrong':''):'')+'" data-o="'+n+'"'+(qz.pick!==null?' disabled':'')+'><span class="ltr">'+'ABCD'[n]+'</span>'+esc(o)+'</button>').join('')+(qz.pick!==null?'<p style="text-align:right"><button type="button" class="btn-primary" data-a="nextq">'+(qz.k+1<qz.q.length?'Next question':'See results')+'</button></p>':'');
    }
    out.innerHTML=h;
  };
  $('#dk-out').addEventListener('click',e=>{
    const b=e.target.closest('button,#fc');if(!b)return;
    if(b.id==='fc'){b.classList.toggle('on');return}
    if(b.dataset.m){mode=b.dataset.m;draw();return}
    const a=b.dataset.a;
    if(a==='prev')i=(i-1+cards.length)%cards.length;
    if(a==='next')i=(i+1)%cards.length;
    if(a==='shuffle'){cards=shuf(cards);i=0}
    if(a==='start'){const n=Math.min(+$('#dk-len').value||10,cards.length);qz={q:shuf(cards).slice(0,n),k:0,score:0,miss:[],done:false,pick:null}}
    if(b.dataset.o!==undefined){const q=qz.q[qz.k];qz.pick=+b.dataset.o;if(q.o[qz.pick]===q.d)qz.score++;else qz.miss.push(q)}
    if(a==='nextq'){qz.pick=null;qz.k++;if(qz.k>=qz.q.length)qz.done=true}
    draw();
  });
  const readFile=f=>{if(!f)return;const r=new FileReader();r.onload=()=>load(r.result,f.name.replace(/\.txt$/i,''));r.readAsText(f)};
  $('#dk-file').onchange=e=>readFile(e.target.files[0]);
  const dz=$('#dk-dz');
  ['dragenter','dragover'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.add('over')}));
  ['dragleave','drop'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.remove('over')}));
  dz.addEventListener('drop',e=>readFile(e.dataTransfer.files[0]));
  $('#dk-make').onclick=()=>load($('#dk-text').value,'Pasted reviewer');
  $('#dk-sample').onclick=()=>{const t='CPU - The part of the computer that carries out instructions\nRAM - Temporary memory used by running programs\nROM - Permanent memory that keeps its data without power\nBit - The smallest unit of data, either 0 or 1\nByte - A group of 8 bits\nCompiler - Translates a whole program into machine code\nAlgorithm - A step-by-step procedure for solving a problem\nDatabase - An organized collection of stored data';$('#dk-text').value=t;load(t,'Sample reviewer')};
  draw();
}

// ===== TRUTH TABLES: symbols ¬ ∧ ∨ → ↔ with up to 4 variables (p, q, r, s) =====
if($('#lg-in')){
  const inp=$('#lg-in');
  const norm=s=>s.replace(/<->|<=>/g,'↔').replace(/\biff\b/gi,'↔').replace(/->|=>/g,'→').replace(/\bimplies\b/gi,'→').replace(/\bnot\b|~|!/gi,'¬').replace(/\band\b|&&|&|\^/gi,'∧').replace(/\bor\b|\|\||\||\bv\b/gi,'∨');
  const parse=src=>{
    const t=[...norm(src).replace(/\s+/g,'')];let i=0;const err=m=>{throw new Error(m)};
    const iff=()=>{let a=imp();while(t[i]==='↔'){i++;a={o:'↔',a,b:imp()}}return a};
    const imp=()=>{const a=or();if(t[i]==='→'){i++;return{o:'→',a,b:imp()}}return a};
    const or=()=>{let a=and();while(t[i]==='∨'){i++;a={o:'∨',a,b:and()}}return a};
    const and=()=>{let a=not();while(t[i]==='∧'){i++;a={o:'∧',a,b:not()}}return a};
    const not=()=>t[i]==='¬'?(i++,{o:'¬',a:not()}):atom();
    const atom=()=>{const c=t[i];
      if(c==='('){i++;const e=iff();if(t[i]!==')')err('A closing bracket ")" is missing.');i++;return e}
      if(c&&/[pqrs]/i.test(c)){i++;return{v:c.toLowerCase()}}
      err(c?'Unexpected "'+c+'". Use only p, q, r, s and the symbols.':'The expression ended too early.')};
    const e=iff();if(i<t.length)err('Unexpected "'+t[i]+'".');return e;
  };
  const S=n=>n.v||(n.o==='¬'?'¬'+S(n.a):'('+S(n.a)+' '+n.o+' '+S(n.b)+')');
  const L=n=>n.b?S(n).slice(1,-1):S(n);
  const ev=(n,e)=>n.v?e[n.v]:n.o==='¬'?!ev(n.a,e):n.o==='∧'?ev(n.a,e)&&ev(n.b,e):n.o==='∨'?ev(n.a,e)||ev(n.b,e):n.o==='→'?!ev(n.a,e)||ev(n.b,e):ev(n.a,e)===ev(n.b,e);
  const run=()=>{
    const out=$('#lg-out'),src=inp.value.trim();
    if(!src){out.innerHTML='<p class="empty">Type an expression, for example ¬p → (q ∧ r).</p>';return}
    try{
      const ast=parse(src),vs=new Set(),cols=[],seen=new Set();
      const walk=n=>{if(n.v){vs.add(n.v);return}walk(n.a);if(n.b)walk(n.b);const k=S(n);if(!seen.has(k)){seen.add(k);cols.push(n)}};
      walk(ast);if(!cols.length)cols.push(ast);
      const V=[...'pqrs'].filter(x=>vs.has(x)),n=V.length;let T=0,html='';
      for(let r=0;r<2**n;r++){
        const e={};V.forEach((v,k)=>e[v]=!((r>>(n-1-k))&1));
        html+='<tr>'+V.map(v=>'<td class="'+(e[v]?'T':'F')+'">'+(e[v]?'T':'F')+'</td>').join('')+cols.map(c=>{const x=ev(c,e);return '<td class="'+(x?'T':'F')+'">'+(x?'T':'F')+'</td>'}).join('')+'</tr>';
        if(ev(ast,e))T++;
      }
      const kind=T===2**n?'Tautology (always true)':T===0?'Contradiction (always false)':'Contingency (sometimes true)';
      out.innerHTML='<p class="note" style="margin:0">Expression</p><p class="expr">'+esc(L(ast))+'</p><p><span class="badge">'+kind+'</span></p><div class="tw"><table class="tt"><thead><tr>'+V.map(v=>'<th>'+v+'</th>').join('')+cols.map(c=>'<th>'+esc(L(c))+'</th>').join('')+'</tr></thead><tbody>'+html+'</tbody></table></div><p class="note">'+2**n+' rows for '+n+' variable'+(n>1?'s':'')+'. The last column is the final answer.</p>';
    }catch(err){out.innerHTML='<p class="bad">'+esc(err.message)+'</p>'}
  };
  $('#lg-form').onsubmit=e=>{e.preventDefault();run()};
  $$('.symbtn button').forEach(b=>b.onclick=()=>{inp.setRangeText(b.dataset.s,inp.selectionStart,inp.selectionEnd,'end');inp.focus()});
  $$('.ex button').forEach(b=>b.onclick=()=>{inp.value=b.textContent;run()});
}

// ===== LOGIC GATES (2 to 4 inputs) AND THE TWO TRUTH TABLE TABS =====
if($('#lg-tabs')){
  const DESC={AND:'Output is 1 only when all inputs are 1.',OR:'Output is 1 when at least one input is 1.',NOT:'Output is the opposite of the input.',NAND:'The opposite of AND: output is 0 only when all inputs are 1.',NOR:'The opposite of OR: output is 1 only when all inputs are 0.',XOR:'Output is 1 when an odd number of inputs are 1.',XNOR:'Output is 1 when an even number of inputs are 1.'};
  const gate=(g,b)=>{const s=b.reduce((a,x)=>a+x,0),n=b.length;return{AND:+(s===n),OR:+(s>0),NAND:+(s!==n),NOR:+(s===0),XOR:s%2,XNOR:+(s%2===0),NOT:1-b[0]}[g]};
  const run=()=>{
    const g=$('#gt-g').value,n=g==='NOT'?1:+$('#gt-n').value,L='ABCD'.slice(0,n);let h='';
    $('#gt-n').disabled=g==='NOT';$('#gt-desc').textContent=DESC[g];
    for(let r=0;r<2**n;r++){const b=[...L].map((_,k)=>(r>>(n-1-k))&1),o=gate(g,b);h+='<tr>'+b.map(x=>'<td class="'+(x?'T':'F')+'">'+x+'</td>').join('')+'<td class="'+(o?'T':'F')+'">'+o+'</td></tr>'}
    $('#lg-out').innerHTML='<p class="expr">'+g+' gate'+(n>1?' with '+n+' inputs':'')+'</p><p class="note">'+DESC[g]+'</p><div class="tw"><table class="tt"><thead><tr>'+[...L].map(c=>'<th>'+c+'</th>').join('')+'<th>Output</th></tr></thead><tbody>'+h+'</tbody></table></div><p class="note">'+2**n+' rows for '+n+' input'+(n>1?'s':'')+'.</p>';
  };
  $('#gt-form').onsubmit=e=>{e.preventDefault();run()};
  $('#gt-g').onchange=run;$('#gt-n').onchange=run;
  $$('#lg-tabs button').forEach(b=>b.onclick=()=>{
    $$('#lg-tabs button').forEach(x=>x.classList.toggle('sel',x===b));
    const gt=b.dataset.t==='gate';$('#pane-conn').hidden=gt;$('#pane-gate').hidden=!gt;
    if(gt)run();else $('#lg-out').innerHTML='<p class="empty">Type an expression, for example ¬p → (q ∧ r).</p>';
  });
}

// ===== COLOR PICKER: color wheel with HEX, RGB, HSL =====
if($('#wheel')){
  const cv=$('#wheel'),g=cv.getContext('2d'),N=cv.width=cv.height=300,R0=N/2;
  let H=28,Sx=.85,V=.66,pal=store.get('pal3',[]);
  const hsv=(h,s,v)=>{const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return[f(5),f(3),f(1)].map(x=>Math.round(x*255))};
  const hex=c=>'#'+c.map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
  const hue=([r,g,b])=>{r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;let h=0;if(d){h=M===r?((g-b)/d)%6:M===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return{h,M,m,d}};
  const toHsv=c=>{const{h,M,d}=hue(c);return[h,M?d/M:0,M]};
  const toHsl=c=>{const{h,M,m,d}=hue(c),l=(M+m)/2;return[Math.round(h),Math.round((d?d/(1-Math.abs(2*l-1)):0)*100),Math.round(l*100)]};
  const paint=()=>{const im=g.createImageData(N,N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=x-R0+.5,dy=y-R0+.5,d=Math.hypot(dx,dy),k=(y*N+x)*4;if(d>R0)continue;const c=hsv((Math.atan2(dy,dx)*180/Math.PI+360)%360,d/R0,V);im.data[k]=c[0];im.data[k+1]=c[1];im.data[k+2]=c[2];im.data[k+3]=255}g.putImageData(im,0,0)};
  const ui=()=>{
    const c=hsv(H,Sx,V),hx=hex(c),a=H*Math.PI/180;
    $('#mk').style.left=(50+Math.cos(a)*Sx*50)+'%';$('#mk').style.top=(50+Math.sin(a)*Sx*50)+'%';
    $('#prev').style.background=hx;$('#hex-in').value=hx;$('#val').value=Math.round(V*100);
    $('#c-hex').textContent=hx;$('#c-rgb').textContent='rgb('+c.join(', ')+')';const l=toHsl(c);$('#c-hsl').textContent='hsl('+l[0]+', '+l[1]+'%, '+l[2]+'%)';
  };
  const setHex=h=>{if(!/^#?[0-9a-f]{6}$/i.test(h))return;h=h.replace('#','');const c=[0,2,4].map(k=>parseInt(h.substr(k,2),16));[H,Sx,V]=toHsv(c);paint();ui()};
  const pick=e=>{const r=cv.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;H=(Math.atan2(y,x)*180/Math.PI+360)%360;Sx=Math.min(Math.hypot(x,y)/(r.width/2),1);ui()};
  let drag=false;
  cv.onpointerdown=e=>{drag=true;cv.setPointerCapture(e.pointerId);pick(e)};cv.onpointermove=e=>{if(drag)pick(e)};cv.onpointerup=()=>drag=false;
  $('#val').oninput=e=>{V=e.target.value/100;paint();ui()};
  $('#hex-in').onchange=e=>setHex(e.target.value);
  $$('.cv button[data-c]').forEach(b=>b.onclick=async()=>{const ok=await copyText($('#'+b.dataset.c).textContent);$('#cp-msg').textContent=ok?'Copied '+$('#'+b.dataset.c).textContent:'Could not copy automatically. Select the code and copy it.'});
  const drawPal=()=>{$('#pal').innerHTML=pal.map((h,k)=>'<button type="button" style="background:'+h+'" aria-label="Use '+h+'" title="'+h+'"></button>').join('');$$('#pal button').forEach((b,k)=>b.onclick=()=>setHex(pal[k]));store.set('pal3',pal)};
  $('#save-col').onclick=()=>{const h=$('#c-hex').textContent;pal=[h,...pal.filter(x=>x!==h)].slice(0,12);drawPal()};
  paint();ui();drawPal();
}

// ===== NUMBER CONVERTER AND CALCULATOR: binary, octal, decimal, hexadecimal =====
if($('#cv-in')){
  const B={2:'Binary',8:'Octal',10:'Decimal',16:'Hexadecimal'},DIG='0123456789ABCDEF';
  const parse=(s,b)=>{s=s.trim().toUpperCase().replace(/^(-?)0[XBO]/,'$1');let neg=false;if(s[0]==='-'){neg=true;s=s.slice(1)}if(!s)return null;let n=0n;for(const c of s){const d=DIG.indexOf(c);if(d<0||d>=b)return null;n=n*BigInt(b)+BigInt(d)}return neg?-n:n};
  const str=(n,b)=>n.toString(b).toUpperCase();
  const rows=n=>Object.keys(B).map(b=>'<div class="cv"><div><small>'+B[b]+' (base '+b+')</small><code>'+str(n,+b)+'</code></div><button type="button" data-v="'+str(n,+b)+'">Copy</button></div>').join('');
  const steps=(n,b)=>{let q=n,r=[];if(q===0n)return'<p>0</p>';while(q>0n){const d=Number(q%BigInt(b));r.push('<tr><td>'+q+' ÷ '+b+'</td><td>'+(q/BigInt(b))+'</td><td>'+DIG[d]+'</td></tr>');q/=BigInt(b)}return'<div class="tw"><table><tr><th>Division</th><th>Quotient</th><th>Remainder</th></tr>'+r.join('')+'</table></div><p class="note">Read the remainders from bottom to top.</p>'};
  const conv=()=>{
    const b=+$('#cv-base').value,n=parse($('#cv-in').value,b),o=$('#cv-out');
    if($('#cv-in').value.trim()==='')return o.innerHTML='<p class="empty">Type a number to convert it.</p>';
    if(n===null)return o.innerHTML='<p class="bad">That is not a valid '+B[b].toLowerCase()+' number.</p>';
    const dec=n<0n?-n:n;
    o.innerHTML=rows(n)+(dec<(10n**15n)?'<details><summary>Show the steps (decimal '+dec+' to other bases)</summary>'+[2,8,16].map(x=>'<h3 style="margin-top:1rem">To '+B[x].toLowerCase()+'</h3>'+steps(dec,x)).join('')+'</details>':'');
  };
  $('#cv-in').oninput=conv;$('#cv-base').onchange=conv;
  $('#ca-form').onsubmit=e=>{
    e.preventDefault();
    const b=+$('#ca-base').value,x=parse($('#ca-a').value,b),y=parse($('#ca-b').value,b),op=$('#ca-op').value,o=$('#ca-out');
    if(x===null||y===null)return o.innerHTML='<p class="bad">Check your numbers. Use only digits that exist in '+B[b].toLowerCase()+'.</p>';
    if(op==='÷'&&y===0n)return o.innerHTML='<p class="bad">You cannot divide by zero.</p>';
    const r=op==='+'?x+y:op==='−'?x-y:op==='×'?x*y:x/y;
    o.innerHTML='<p class="expr">'+str(x,b)+' '+op+' '+str(y,b)+' = '+str(r,b)+' <small>(base '+b+')</small></p>'+(op==='÷'?'<p class="note">Whole-number division. Remainder: '+str(x%y,b)+'</p>':'')+rows(r);
  };
  document.addEventListener('click',async e=>{const b=e.target.closest('button[data-v]');if(!b)return;const ok=await copyText(b.dataset.v);b.textContent=ok?'Copied':'Select it';setTimeout(()=>b.textContent='Copy',1200)});
  conv();
}

// ===== TEAM: FILTER, FLIP ON HOVER (TAP ON TOUCH), GLOW IN FAVORITE COLOR =====
const aura=$('#aura');
const glow=c=>{if(!aura)return;if(c){aura.style.setProperty('--aura',c.dataset.color||'#ff2d2d');aura.classList.add('show')}else aura.classList.remove('show')};
const canHover=matchMedia('(hover:hover)').matches;
$$('.flip').forEach(f=>{
  const set=on=>{$$('.flip').forEach(x=>x!==f&&x.classList.remove('on'));f.classList.toggle('on',on);glow(on?f:null)};
  if(canHover){f.onmouseenter=()=>set(true);f.onmouseleave=()=>set(false)}else f.onclick=()=>set(!f.classList.contains('on'));
  f.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();set(!f.classList.contains('on'))}};
  f.querySelectorAll('a').forEach(a=>a.onclick=e=>{e.stopPropagation();if(a.getAttribute('href')==='#')e.preventDefault()});
});
$$('#filters .chip').forEach(b=>b.onclick=()=>{
  const k=b.dataset.cat;
  $$('#filters .chip').forEach(x=>{x.classList.toggle('sel',x===b);x.setAttribute('aria-pressed',x===b)});
  $$('.flip').forEach(f=>{f.classList.remove('on');f.style.display=k==='All'||f.dataset.cat.split(',').includes(k)?'':'none'});
  glow(null);
});
