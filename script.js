const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== HERO TREE: GOLDEN WEEPING WILLOW =====
(()=>{
  const el=$('#art');if(!el)return;
  const R=(a,b)=>a+Math.random()*(b-a);
  const C=[[30,110,60,330,1],[130,120,35,340,1],[250,120,35,340,1],[370,110,60,330,1],[60,90,120,290,2],[155,100,100,300,2],[265,100,100,300,2],[370,90,120,290,2]];
  const F=[[85,70,170,225,3],[330,75,165,225,3],[20,60,200,190,3],[430,60,200,190,3]];
  const cur=(c)=>{let o='<rect x="'+c[0]+'" y="'+c[2]+'" width="'+c[1]+'" height="'+c[3]+'" rx="'+c[1]/2.3+'" fill="var(--g'+c[4]+')"/>';
    for(let x=c[0]+6;x<c[0]+c[1]-4;x+=6)o+='<line x1="'+x+'" y1="'+(c[2]+14)+'" x2="'+(x+R(-3,3)).toFixed(1)+'" y2="'+(c[2]+c[3]-10)+'" stroke="var(--g4)" stroke-width="1.5" stroke-dasharray="3 5" opacity=".4"/>';return o};
  let h='<svg class="scene" viewBox="0 0 520 480" role="img" aria-label="A golden weeping willow tree in autumn"><rect width="520" height="480" fill="var(--sky)"/><g class="st"><circle cx="450" cy="62" r="28" fill="var(--orb)"/>';
  for(let i=0;i<16;i++)h+='<circle cx="'+R(10,500|0).toFixed(0)+'" cy="'+R(8,170).toFixed(0)+'" r="'+R(.6,1.7).toFixed(1)+'" fill="#fff"/>';
  h+='</g><rect y="415" width="520" height="65" fill="var(--ground)"/><rect id="canopy" x="25" y="35" width="470" height="355" fill="none"/>';
  h+='<g class="sway">'+C.filter(c=>c[4]==1).map(cur).join('')+'</g><g class="sway">'+C.filter(c=>c[4]==2).map(cur).join('')+'</g>';
  h+='<path d="M255 420C250 380 262 340 258 296M258 322L226 288M258 310L292 282" stroke="var(--trunk)" stroke-width="14" stroke-linecap="round" fill="none"/>';
  h+='<g class="sway">'+F.map(cur).join('')+'</g></svg>';
  el.innerHTML=h;
})();

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

// ===== DAY / NIGHT: FOLLOWS THE CLOCK UNLESS YOU PICK ONE =====
(()=>{
  const b=$('#theme'),r=document.documentElement;
  const auto=()=>{const h=new Date().getHours();return h>=18||h<6?'night':'day'};
  const saved=()=>{try{return localStorage.getItem('theme')}catch(e){return null}};
  const show=m=>{r.dataset.theme=m;b.textContent=m==='night'?'☀️':'🌙';b.setAttribute('aria-pressed',m==='night')};
  show(saved()||auto());
  b.onclick=()=>{const m=r.dataset.theme==='night'?'day':'night';try{localStorage.setItem('theme',m)}catch(e){}show(m)};
  setInterval(()=>{if(!saved())show(auto())},60000);
})();

// ===== SCHEDULE =====
if($('#sch-form')){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat'];
  let items=JSON.parse(localStorage.getItem('sch')||'[]');
  const draw=()=>{
    $('#sch-out').innerHTML=days.map(d=>'<div class="day"><b>'+d+'</b>'+items.map((x,i)=>({...x,i})).filter(x=>x.day===d).sort((a,b)=>a.start.localeCompare(b.start)).map(x=>'<div class="slot">'+esc(x.start)+' to '+esc(x.end)+'<br>'+esc(x.subj)+' <button class="x" onclick="delSch('+x.i+')" aria-label="Remove">✕</button></div>').join('')+'</div>').join('');
    localStorage.setItem('sch',JSON.stringify(items));
  };
  window.delSch=i=>{items.splice(i,1);draw()};
  $('#sch-form').onsubmit=e=>{e.preventDefault();const f=e.target;
    if(f.start.value>=f.end.value)return alert('End time must be after start time.');
    items.push({subj:f.subj.value.trim(),day:f.day.value,start:f.start.value,end:f.end.value});f.subj.value='';draw()};
  draw();
}

// ===== GRADE CALC: ACTIVITIES + QUIZZES + ASSIGNMENTS (60%), EXAM (40%) =====
// Edit this table to match your teacher's Excel: [lowest percent, grade]. Below 64.5 is 5.0.
const SCALE=[[96.5,1],[92.5,1.25],[88.5,1.5],[84.5,1.75],[80.5,2],[76.5,2.25],[72.5,2.5],[68.5,2.75],[64.5,3]];
const toGrade=p=>(SCALE.find(s=>p>=s[0])||[0,5])[1];
if($('#g-cats')){
  const box=$('#g-cats');
  const row=h=>{const d=document.createElement('div');d.className='r3';d.innerHTML='<input type="number" min="0" step="any" placeholder="Score" aria-label="Score"><input type="number" min="1" step="any" placeholder="Total items" aria-label="Total items"><button type="button" class="x" aria-label="Remove">✕</button>';d.querySelector('.x').onclick=()=>{d.remove();calc()};h.appendChild(d)};
  [['Activities',20],['Quizzes',20],['Assignments',20]].forEach(([n,w])=>{
    const s=document.createElement('div');s.className='cat';s.dataset.k=n;
    s.innerHTML='<div class="cat-h"><h3>'+n+'</h3><label>Weight <input type="number" class="w" min="0" max="100" value="'+w+'" aria-label="'+n+' weight">%</label></div><div class="rows"></div><button type="button" class="ghost">+ Add item</button>';
    const h=s.querySelector('.rows');for(let i=0;i<3;i++)row(h);
    s.querySelector('.ghost').onclick=()=>row(h);box.appendChild(s);
  });
  $('#g-scale').innerHTML='<div class="tw"><table><tr><th>Final percentage</th><th>Grade</th></tr>'+SCALE.map((s,i)=>'<tr><td>'+s[0]+' to '+(i?(SCALE[i-1][0]-.1).toFixed(1):'100')+'</td><td>'+s[1].toFixed(2)+'</td></tr>').join('')+'<tr><td>64.4 and below</td><td>5.00</td></tr></table></div>';
  const calc=()=>{
    const parts=[];
    $$('#g-cats .cat').forEach(c=>{let s=0,t=0;c.querySelectorAll('.r3').forEach(r=>{const i=r.querySelectorAll('input'),a=parseFloat(i[0].value),b=parseFloat(i[1].value);if(a>=0&&b>0){s+=a;t+=b}});parts.push({n:c.dataset.k,s,t,w:parseFloat(c.querySelector('.w').value)||0})});
    const es=parseFloat($('#ex-s').value),et=parseFloat($('#ex-t').value);
    parts.push({n:'Exam',s:es>=0?es:0,t:et>0?et:0,w:parseFloat($('#ex-w').value)||0});
    let fin=0,wt=0;const miss=[];
    const rows=parts.map(p=>{const pct=p.t?p.s/p.t*100:0,pts=pct*p.w/100;if(!p.t)miss.push(p.n);fin+=pts;wt+=p.w;return '<tr><td>'+p.n+'</td><td>'+(p.t?p.s+' ÷ '+p.t+' × 100':'no items')+'</td><td>'+pct.toFixed(2)+'%</td><td>'+p.w+'%</td><td>'+pts.toFixed(2)+'</td></tr>'}).join('');
    fin=Math.round(fin*10)/10;const g=toGrade(fin),none=miss.length===parts.length;
    $('#g-big').textContent=none?'—':g.toFixed(2);
    $('#g-st').textContent=none?'':(g>3?'Failed':'Passed');$('#g-st').className=g>3?'bad':'ok';
    $('#g-pct').textContent=none?'Enter your scores to start.':'Final percentage: '+fin.toFixed(1)+'%';
    $('#g-note').textContent=(!none&&miss.length?'Missing: '+miss.join(', ')+'. ':'')+(wt!==100?'Weights add up to '+wt+'%, not 100%.':'');
    $('#g-steps').innerHTML=rows+'<tr><td colspan="4"><b>Total points</b></td><td><b>'+fin.toFixed(1)+'</b></td></tr>';
  };
  $('.ctrl').addEventListener('input',calc);
  $('#g-reset').onclick=()=>{$$('#g-cats .r3 input,#ex-s,#ex-t').forEach(i=>i.value='');calc()};
  calc();
}

// ===== GROUPS =====
if($('#grp-go')){
  $('#grp-go').onclick=()=>{
    const names=$('#grp-names').value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!names.length)return $('#grp-out').textContent='Type at least one name, one per line.';
    const n=Math.max(1,parseInt($('#grp-n').value)||2);
    for(let i=names.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[names[i],names[j]]=[names[j],names[i]]}
    const g=Array.from({length:n},()=>[]);names.forEach((x,i)=>g[i%n].push(x));
    $('#grp-out').innerHTML='<div class="grid">'+g.map((m,i)=>'<div class="slot"><b>Group '+(i+1)+'</b><br>'+(m.map(esc).join('<br>')||'No members')+'</div>').join('')+'</div>';
  };
}

// ===== DEADLINES =====
if($('#dl-form')){
  let t=JSON.parse(localStorage.getItem('dl')||'[]');
  const draw=()=>{const now=new Date();now.setHours(0,0,0,0);
    $('#dl-list').innerHTML=t.map((x,i)=>({...x,i,d:Math.round((new Date(x.date+'T00:00')-now)/864e5)})).sort((a,b)=>a.d-b.d).map(x=>'<li class="'+(x.d<0?'late':x.d<=2?'soon':'')+'"><span>'+esc(x.task)+'</span><em>'+(x.d<0?'Overdue':x.d===0?'Due today':x.d+' day(s) left')+'</em><button class="x" onclick="delDl('+x.i+')" aria-label="Remove">✕</button></li>').join('')||'<li>No deadlines yet. Add your first one above.</li>';
    localStorage.setItem('dl',JSON.stringify(t))};
  window.delDl=i=>{t.splice(i,1);draw()};
  $('#dl-form').onsubmit=e=>{e.preventDefault();const f=e.target;t.push({task:f.task.value.trim(),date:f.date.value});f.task.value='';draw()};
  draw();
}

// ===== MEMORY =====
if($('#mem')){
  const icons=['🍁','🌲','🌙','⭐','📚','💻','🍄','🦉'];
  let first=null,lock=false,moves=0,found=0;
  const start=()=>{
    const deck=[...icons,...icons].sort(()=>Math.random()-.5);
    moves=0;found=0;first=null;lock=false;$('#mem-info').textContent='Moves: 0';$('#mem').innerHTML='';
    deck.forEach(v=>{const b=document.createElement('button');b.className='mc';b.textContent='?';b.setAttribute('aria-label','Hidden card');
      b.onclick=()=>{
        if(lock||b.classList.contains('open'))return;
        b.classList.add('open');b.textContent=v;
        if(!first){first=b;return}
        moves++;$('#mem-info').textContent='Moves: '+moves;
        if(first.textContent===v){found++;first=null;if(found===8)$('#mem-info').textContent='All pairs matched in '+moves+' moves!'}
        else{lock=true;const a=first;first=null;setTimeout(()=>{a.classList.remove('open');a.textContent='?';b.classList.remove('open');b.textContent='?';lock=false},700)}};
      $('#mem').appendChild(b)});
  };
  $('#mem-new').onclick=start;start();
}

// ===== TEAM FLIP CARDS AND MOOD PICKER =====
$$('.flip').forEach(f=>{f.onclick=()=>f.classList.toggle('on');f.onkeydown=e=>{if(e.key==='Enter')f.classList.toggle('on')}});
if($('#moods')){
  $$('#moods button').forEach(b=>b.onclick=()=>{
    const card=$('.flip[data-mood="'+b.dataset.mood+'"]');
    $$('.flip').forEach(f=>f.classList.remove('hit'));$$('#moods button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');card.classList.add('hit');
    $('#mood-out').innerHTML='<b>'+card.dataset.name+'</b> is your '+b.dataset.label+' match. '+card.dataset.trait;
    card.scrollIntoView({behavior:still?'auto':'smooth',block:'center'});
  });
}
