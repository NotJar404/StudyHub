// ===== CLASS SCHEDULER =====
// 1) Scan a Certificate of Registration (photo or PDF) -> classes go straight into your list.
// 2) Your classes are drawn as a phone wallpaper you can download as a JPEG.
(()=>{
  if(!$('#sch-form'))return;

  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // [name, text, glass panel, solid panel, accent, text on accent, background top, background bottom]
  const COL=[
    ['Snow','#ffffff','rgba(18,20,34,.52)','rgba(26,28,44,.94)','#f0b562','#1a1208','#c9833a','#4d2a14'],
    ['Ink','#2a2520','rgba(255,255,255,.66)','rgba(255,252,246,.97)','#a85c1c','#ffffff','#fbeed8','#efd3ab'],
    ['Willow','#f4fff6','rgba(20,52,40,.58)','rgba(26,62,46,.95)','#a8e0b5','#10281c','#3c8765','#10281c'],
    ['Rose','#3a1f26','rgba(255,240,244,.7)','rgba(255,244,247,.97)','#b5475f','#ffffff','#f8cdd6','#e58aa0'],
    ['Ocean','#eaf6ff','rgba(14,38,68,.6)','rgba(18,46,80,.95)','#7cc4f5','#0b2038','#2a77b5','#0b2038']
  ];
  const DES=['Glass','Solid','Cards','Lines'];
  const SIZES=[['Tall phone (most phones)',1080,2340],['Standard phone',1080,1920]];

  let items=store.get('sch5',null);
  if(!items)items=store.get('sch4',[]);
  let des=Math.min(store.get('sdes',0),DES.length-1),col=Math.min(store.get('scol',0),COL.length-1),bgData=store.get('sbg',null);
  let size=Math.min(store.get('ssize',0),SIZES.length-1),clock=store.get('sclock',true),editIdx=null,bgImg=null;

  const t12=t=>{const[h,m]=t.split(':').map(Number);return(h%12||12)+':'+String(m).padStart(2,'0')+' '+(h>=12?'PM':'AM')};
  const hrs=(a,b)=>{const[x,y]=a.split(':').map(Number),[u,v]=b.split(':').map(Number);return(u*60+v-x*60-y)/60};
  const keyOf=x=>[x.code,x.day,x.start,x.end].join('|');

  // =================================================================
  //  READING THE CERTIFICATE TEXT
  //  Works on whatever the reader returns: it finds every "time - time" and then
  //  looks around it for the days, room, units, course code and subject name.
  // =================================================================
  const TSEP='\\s*(?:[-–—−~_=]+|to)\\s*';
  const TIME=new RegExp('(\\d{1,2})\\s*[:.;,]\\s*(\\d{2})\\s*([AaPp]\\.?\\s?[MmNIl1]\\.?)?'+TSEP+'(\\d{1,2})\\s*[:.;,]\\s*(\\d{2})\\s*([AaPp]\\.?\\s?[MmNIl1]\\.?)?','g');
  const TIME_NOMIN=new RegExp('(\\d{1,2})\\s*()([AaPp]\\.?\\s?[Mm]\\.?)'+TSEP+'(\\d{1,2})\\s*()([AaPp]\\.?\\s?[Mm]\\.?)','g');
  const pad=n=>String(n).padStart(2,'0');
  const ampm=s=>s?(/p/i.test(s)?'P':'A'):'';
  const toMin=(h,m,p)=>{h=+h;m=+m||0;if(p==='P'&&h<12)h+=12;if(p==='A'&&h===12)h=0;return h*60+m};
  // Work out real start/end times even when AM/PM is missing or misread: pick the reading that gives the shortest sensible class.
  const fixTimes=(h1,m1,p1,h2,m2,p2)=>{
    const c1=[],c2=[];
    const cand=(h,m,p,out)=>{
      h=+h;m=+m||0;if(h>23||m>59)return;
      if(h>=13||h===0){out.push(h*60+m);return}
      if(p){out.push(toMin(h,m,p));return}
      out.push(toMin(h,m,'A'),toMin(h,m,'P'));
    };
    cand(h1,m1,p1||'',c1);cand(h2,m2,p2||'',c2);
    // a missing AM/PM on one side follows the other side first
    let best=null;
    c1.forEach(a=>c2.forEach(b=>{
      const d=b-a;if(d<=0||d>10*60)return;
      let pen=d+(a<6*60||a>21*60?1000:0);
      if(!p1&&!p2&&h1<=12&&h2<=12&&(a<12*60)!==(b<12*60)&&d>240)pen+=300;
      if(!best||pen<best.pen)best={pen,a,b};
    }));
    if(!best)return null;
    return[pad(best.a/60|0)+':'+pad(best.a%60),pad(best.b/60|0)+':'+pad(best.b%60)];
  };
  const dayWord=t=>{
    let s=t.toUpperCase().replace(/[^A-Z]/g,'');
    if(/^[OQ](?:TH|[MTWFS])+$/.test(s))s=s.slice(1);
    s=s.replace(/THURS(DAY)?|THUR|THU/g,'TH').replace(/TUES(DAY)?|TUE/g,'T').replace(/WED(NESDAY)?/g,'W').replace(/MON(DAY)?/g,'M').replace(/FRI(DAY)?/g,'F').replace(/SAT(URDAY)?/g,'S');
    return s;
  };
  const isDay=t=>{const s=dayWord(t);return s.length>0&&s.length<=8&&/^(TH|[MTWFS])+$/.test(s)};
  const DAYNAME={M:'Monday',T:'Tuesday',W:'Wednesday',TH:'Thursday',F:'Friday',S:'Saturday'};
  const roomLike=x=>/^(?:ONLINE|TBA|TBD|ASYNC|AVR|GYM|FIELD)$/i.test(x)||/^[A-Za-z1|]{1,5}-?\d{2,4}[A-Za-z]?\d?$/.test(x)||(/^[A-Za-z1]{1,3}[A-Z0-9]{2,4}[a-z]?$/.test(x)&&/\d/.test(x))||/^\d{3,4}[A-Za-z]?$/.test(x);
  const normRoom=x=>{
    x=x.replace(/^[1|](?=[A-Za-z])/,'I');
    const m=x.match(/^([A-Za-z]{1,4})([0-9SsOo]{2,4})([A-Za-z]?)$/);
    return m?m[1]+m[2].replace(/[Ss]/g,'5').replace(/[Oo]/g,'0')+m[3]:x;
  };
  const CODE=/^[A-Z]{2,7}-?\d{1,3}[A-Z]?$/;
  const NUM=/^\d(?:\.\d)?$/;
  const SEC=/^[A-Za-z]{2,6}-\d{1,2}[A-Za-z]?$/; // a class section such as SBIT-1F
  // letters that OCR often confuses inside numbers
  const fixDigits=s=>s.replace(/(?<=\d)[OoQ](?=\d|\s*[:.;]|\s*[AaPp]\.?\s?[Mm])/g,'0').replace(/(?<=\d)[lI|](?=\d)/g,'1').replace(/(?<=[:.;])[OoQ]/g,'0').replace(/\b[OoQ](?=\d\s*[:.;]\d)/g,'0');

  const findCode=tk=>{
    for(let i=0;i<Math.min(tk.length,3);i++){
      if(/^[1l|][A-Z]{1,6}\d{2,3}[A-Z]?$/.test(tk[i]))tk[i]='I'+tk[i].slice(1); // a capital I is often read as 1
      if(CODE.test(tk[i].toUpperCase()))return[i,1,tk[i].toUpperCase()];
      if(/^[A-Z]{2,7}$/.test(tk[i])&&tk[i+1]&&/^\d{2,3}[A-Z]?$/.test(tk[i+1]))return[i,2,tk[i]+tk[i+1]];
    }
    return null;
  };
  const timesIn=line=>{
    const out=[];
    for(const re of[TIME,TIME_NOMIN]){
      re.lastIndex=0;let m;
      while((m=re.exec(line))){
        const t=fixTimes(m[1],m[2],ampm(m[3]),m[4],m[5],ampm(m[6]));
        if(t&&!out.some(o=>m.index<o.end&&o.i<m.index+m[0].length))out.push({i:m.index,end:m.index+m[0].length,start:t[0],stop:t[1]});
      }
    }
    return out.sort((a,b)=>a.i-b.i);
  };

  const parseCOR=raw=>{
    const lines=raw.split(/\r?\n/).map(l=>fixDigits(l.replace(/[|\[\]{}]/g,' ').replace(/[\t]+/g,'  ').replace(/\s+/g,' ').trim())).filter(Boolean);
    const out=[],seen=new Set();let unsure=0,timeLines=0;
    const tok=s=>s.replace(/[\/,;]/g,' ').split(/\s+/).filter(Boolean);
    lines.forEach((line,k)=>{
      const ts=timesIn(line);
      if(!ts.length)return;
      timeLines+=ts.length;
      const first=ts[0];
      let left=tok(line.slice(0,first.i));
      // find the course code; if this line has none, borrow it from the line(s) just above
      let head=[],cd=findCode(left);
      if(!cd){
        for(let b=k-1;b>=Math.max(0,k-2);b--){
          if(timesIn(lines[b]).length)break;
          const tk=tok(lines[b]);if(findCode(tk)){head=tk;break}
        }
      }
      let all=head.length?head.concat(left):left;
      cd=findCode(all);
      let code=cd?cd[2]:'',rest=cd?all.slice(cd[0]+cd[1]):all,guess=false;
      if(!cd&&all.length>1&&/\d/.test(all[0])&&/[A-Za-z]/.test(all[0])){code=all[0].toUpperCase();rest=all.slice(1);guess=true}
      // each time range gets its own days (sorted by position)
      ts.forEach((t,ti)=>{
        const segLeft=ti?tok(line.slice(ts[ti-1].end,t.i)):rest.slice();
        let days=[],body=segLeft.slice();
        while(body.length&&isDay(body[body.length-1])&&days.length<4){days.unshift(body.pop())}
        if(!days.length){ // days written after the time
          const after=tok(line.slice(t.end,ti<ts.length-1?ts[ti+1].i:undefined));
          let n=0;while(n<after.length&&isDay(after[n])&&n<4){days.push(after[n]);n++}
        }
        while(body.length>1&&SEC.test(body[body.length-1]))body.pop();
        // room: the word right before the days (drop little OCR crumbs like "om" first)
        let room='';
        while(body.length>2&&/^(?:[^A-Za-z0-9]{1,2}|[a-z]{1,2})$/.test(body[body.length-1])&&NUM.test(body[body.length-2]))body.pop();
        if(body.length>1&&roomLike(body[body.length-1])&&!NUM.test(body[body.length-1])){room=normRoom(body.pop())}
        else{
          const rm=body.findIndex((x,i)=>/^(RM|ROOM)$/i.test(x)&&/^\d{2,4}[A-Za-z]?$/.test(body[i+1]||''));
          if(rm>=0){room=body[rm]+body[rm+1];body.splice(rm,2)}
          else{const after=tok(line.slice(t.end)),j=after.findIndex(x=>roomLike(x)&&!isDay(x)&&!NUM.test(x));if(j>=0)room=normRoom(after[j])}
        }
        // units: trailing run of single digits (units, hours...)
        let units=null,run=[];
        while(body.length&&NUM.test(body[body.length-1])){run.unshift(body.pop())}
        if(run.length&&+run[run.length-1]<=6){units=+run[run.length-1];body.push(...run.slice(0,-1))}else if(run.length)body.push(...run);
        let subj=body.join(' ').replace(/^[-–:.,\s]+|[-–:.,\s]+$/g,'');
        // subject that wraps onto the next line
        const nx=lines[k+1];
        if(ti===0&&nx&&!timesIn(nx).length&&!findCode(tok(nx))&&/^[A-Za-z(][A-Za-z ()&,'-]{1,40}$/.test(nx)&&!/total|units|tuition|fee|date|name|student/i.test(nx))subj+=' '+nx;
        if(!subj)subj=code||'Class';
        const dayStr=days.map(dayWord).join('');
        const dl=dayStr.match(/TH|[MTWFS]/g)||[];
        const type=/\b(lab|laboratory)\b/i.test(subj)?'Lab':/\b(lec|lecture)\b/i.test(subj)?'Lec':(units===0||(units>0&&hrs(t.start,t.stop)/units>=2.5))?'Lab':'Lec';
        const make=(d,chk)=>{
          const it={code:code||(subj.split(' ')[0]||'CLASS').toUpperCase(),subj,units:units==null?'':units,room,day:d,start:t.start,end:t.stop,type};
          if(chk||!code||guess)it.chk=true;
          const kk=keyOf(it);if(seen.has(kk))return;seen.add(kk);out.push(it);if(it.chk)unsure++;
        };
        if(dl.length)[...new Set(dl)].forEach(d=>make(DAYNAME[d],false));
        else make('Monday',true);
      });
    });
    return{items:out,unsure,timeLines};
  };

  // =================================================================
  //  SCANNING
  // =================================================================
  let cor=null,snapshot=null;
  const msg=(t,kind)=>{const m=$('#cor-msg');m.textContent=t;m.dataset.k=kind||''};
  const bar=p=>{$('#cor-bar').style.width=p+'%'};
  const hasKey=()=>!!store.get('ocrkey','');

  const compress=c=>{
    let w=Math.min(c.width,2000),q=.85,out;
    for(let i=0;i<8;i++){
      const t=document.createElement('canvas');t.width=w;t.height=Math.round(c.height*w/c.width);t.getContext('2d').drawImage(c,0,0,t.width,t.height);
      out=t.toDataURL('image/jpeg',q);if(out.length*.75<950000)return out;q-=.07;w=Math.round(w*.88);
    }
    return out;
  };
  const onlineRead=async(c,key)=>{
    const fd=new FormData();
    fd.append('apikey',key);fd.append('base64Image',compress(c));fd.append('language','eng');fd.append('isTable','true');fd.append('OCREngine','2');fd.append('scale','true');
    const r=await fetch('https://api.ocr.space/parse/image',{method:'POST',body:fd});
    const j=await r.json();
    if(j.IsErroredOnProcessing||!j.ParsedResults)throw new Error([].concat(j.ErrorMessage||'The online reader could not read this photo.').join(' '));
    return j.ParsedResults.map(p=>p.ParsedText).join('\n');
  };

  const addScanned=res=>{
    snapshot=items.map(x=>({...x}));
    const have=new Set(items.map(keyOf));let n=0;
    res.items.forEach(x=>{if(!have.has(keyOf(x))){items.push(x);have.add(keyOf(x));n++}});
    draw();
    return n;
  };

  const score=r=>r.items.length*10-r.unsure*4+Math.min(r.timeLines,r.items.length);
  let scanning=false;
  const scan=async()=>{
    if(!cor||scanning)return;
    scanning=true;$('#cor-scan').disabled=true;$('#cor-undo').hidden=true;$('#cor-raw').hidden=true;
    let best={items:[],unsure:0,timeLines:0},raw='';
    try{
      // A) optional online reader (more accurate on blurry photos)
      const key=store.get('ocrkey','');
      if(key){
        try{
          msg('Reading with the online reader…');bar(35);
          raw=await onlineRead(cor,key);best=parseCOR(raw);
        }catch(e){msg('Online reader unavailable ('+(e.message||'error')+'). Using the built-in reader instead…');}
      }
      // B) built-in reader, up to three tries with different photo clean-ups
      if(!best.items.length||best.items.length<best.timeLines){
        const tries=[['bw',6,'Cleaning up the photo…'],['gray',6,'Trying again with softer contrast…'],['gray',4,'One more try with a different layout…']];
        for(let i=0;i<tries.length;i++){
          const[mode,psm,label]=tries[i];
          msg(label);bar(5+i*30);await new Promise(r=>setTimeout(r,30));
          const img=Lib.prep(cor,mode);
          msg('Reading your certificate… (first time loads the reader, please wait)');
          const text=await Lib.ocr(img,{psm,onProgress:p=>{bar(Math.round(5+i*30+p*28));msg('Reading your certificate… '+Math.round(p*100)+'%')}});
          const r=parseCOR(text);
          if(!raw||score(r)>score(best)){best=r;raw=text}
          if(best.items.length&&best.items.length>=best.timeLines&&!best.unsure)break;
        }
      }
      bar(100);
      $('#cor-raw').hidden=!raw;$('#cor-raw pre').textContent=raw;
      if(best.items.length){
        const n=addScanned(best);
        msg(n?('Added '+n+' class'+(n===1?'':'es')+' to your schedule'+(best.unsure?'. '+best.unsure+' marked “check” need a quick look.':'. Everything looks readable. ')+' Tap ✎ on any class to fix it.'):'Those classes are already in your schedule.','ok');
        $('#cor-undo').hidden=!n;
        $('#classes').scrollIntoView({behavior:still?'auto':'smooth',block:'start'});
      }else{
        msg('I could not find any classes. Try rotating the photo so the text is upright, retake it flat and well lit, or add classes by hand below.','warn');
      }
    }catch(e){
      msg('The reader could not start. It needs an internet connection the first time. You can still add classes by hand below.','warn');bar(0);
    }
    scanning=false;$('#cor-scan').disabled=false;
  };

  const showCor=()=>{
    const t=document.createElement('canvas'),k=Math.min(1,900/Math.max(cor.width,cor.height));
    t.width=Math.round(cor.width*k);t.height=Math.round(cor.height*k);t.getContext('2d').drawImage(cor,0,0,t.width,t.height);
    $('#cor-img').src=t.toDataURL('image/jpeg',.7);$('#cor-box').hidden=false;
  };
  const loadCor=async f=>{
    if(!f)return;
    msg('Opening your file…');bar(0);$('#cor-box').hidden=false;
    try{cor=await Lib.fileToCanvas(f,3200);showCor();await scan()}
    catch(e){msg('I could not open that file. Please use a photo (JPG or PNG) or a PDF.','warn')}
  };
  $('#cor-file').onchange=e=>{loadCor(e.target.files[0]);e.target.value=''};
  const dz=$('#cor-dz');
  ['dragenter','dragover'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.add('over')}));
  ['dragleave','drop'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.remove('over')}));
  dz.addEventListener('drop',e=>loadCor(e.dataTransfer.files[0]));
  const rot=d=>{if(!cor)return;const c=document.createElement('canvas');c.width=cor.height;c.height=cor.width;const g=c.getContext('2d');g.translate(c.width/2,c.height/2);g.rotate(d*Math.PI/2);g.drawImage(cor,-cor.width/2,-cor.height/2);cor=c;showCor()};
  $('#rot-l').onclick=()=>rot(-1);$('#rot-r').onclick=()=>rot(1);
  $('#cor-scan').onclick=scan;
  $('#cor-undo').onclick=()=>{if(snapshot){items=snapshot;snapshot=null;draw();$('#cor-undo').hidden=true;msg('Scan removed.')}};
  // optional online reader key
  const keyBox=$('#ocr-key');keyBox.value=store.get('ocrkey','');
  $('#ocr-save').onclick=()=>{const v=keyBox.value.trim();store.set('ocrkey',v);$('#ocr-state').textContent=v?'Saved. Your next scan will use the online reader first.':'Removed. Scans use the built-in reader only.'};

  // =================================================================
  //  YOUR CLASSES (list + add by hand + edit)
  // =================================================================
  const form=$('#sch-form');
  const resetForm=()=>{editIdx=null;form.reset();$('#add-main').textContent='Add class';$('#add-keep').hidden=false;$('#add-cancel').hidden=true};
  const read=()=>({code:form.code.value.trim().toUpperCase(),subj:form.subj.value.trim(),day:form.day.value,type:form.type.value,units:form.units.value,start:form.start.value,end:form.end.value,room:form.room.value.trim()});
  const add=keep=>{
    if(!form.reportValidity())return;
    if(form.start.value>=form.end.value)return alert('End time must be after start time.');
    const it=read();
    if(editIdx!=null){items[editIdx]=it;resetForm()}
    else{
      items.push(it);
      form.start.value=form.end.value=form.room.value='';
      if(keep)form.type.value=form.type.value==='Lec'?'Lab':'Lec';else form.code.value=form.subj.value=form.units.value='';
    }
    draw();
  };
  form.onsubmit=e=>{e.preventDefault();add(false)};
  $('#add-keep').onclick=()=>add(true);
  $('#add-cancel').onclick=resetForm;
  $('#clear-all').onclick=()=>{if(items.length&&confirm('Remove all classes from your schedule?')){snapshot=items.map(x=>({...x}));items=[];resetForm();draw()}};
  $('#classes').addEventListener('click',e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;
    const i=+b.dataset.i;
    if(b.dataset.a==='del'){items.splice(i,1);if(editIdx===i)resetForm();draw()}
    if(b.dataset.a==='edit'){
      const x=items[i];editIdx=i;
      form.code.value=x.code;form.subj.value=x.subj;form.day.value=x.day;form.type.value=x.type;form.units.value=x.units||'';form.start.value=x.start;form.end.value=x.end;form.room.value=x.room||'';
      $('#add-main').textContent='Save changes';$('#add-keep').hidden=true;$('#add-cancel').hidden=false;
      $('#manual').open=true;form.scrollIntoView({behavior:still?'auto':'smooth',block:'center'});form.code.focus();
    }
  });
  const drawList=()=>{
    const el=$('#classes');
    if(!items.length){el.innerHTML='<p class="empty">No classes yet. Scan your certificate above, or add one by hand.</p>';return}
    el.innerHTML=DAYS.map(d=>{
      const l=items.map((x,i)=>({...x,i})).filter(x=>x.day===d).sort((a,b)=>a.start.localeCompare(b.start));
      if(!l.length)return'';
      return'<div class="dg"><div class="dgh"><b>'+d+'</b><small>'+l.length+' session'+(l.length===1?'':'s')+'</small></div>'+l.map(x=>
        '<div class="cl"><div class="ct"><b>'+t12(x.start)+'</b><span>'+t12(x.end)+'</span></div><div class="cm"><div class="cc"><b>'+esc(x.code)+'</b><span class="lt'+(x.type==='Lab'?' lab':'')+'">'+(x.type==='Lab'?'Lab':'Lec')+'</span>'+(x.chk?'<span class="chk">check</span>':'')+'</div><small>'+esc(x.subj)+'</small>'+(x.room?'<em>'+esc(x.room)+'</em>':'')+'</div><div class="ca"><button type="button" class="ib" data-a="edit" data-i="'+x.i+'" aria-label="Edit '+esc(x.code)+'">✎</button><button type="button" class="ib" data-a="del" data-i="'+x.i+'" aria-label="Remove '+esc(x.code)+'">×</button></div></div>').join('')+'</div>';
    }).join('');
  };

  // =================================================================
  //  WALLPAPER (drawn on a canvas, saved as a JPEG)
  // =================================================================
  const cv=$('#wall');
  const FONT='"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif',HEAD='"Fraunces",Georgia,serif';
  const rr=(g,x,y,w,h,r)=>{r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
  const wrap=(g,text,maxW,maxLines)=>{
    const words=String(text).split(/\s+/),lines=[];let cur='';
    for(const w of words){
      const t=cur?cur+' '+w:w;
      if(g.measureText(t).width<=maxW||!cur)cur=t;else{lines.push(cur);cur=w}
    }
    if(cur)lines.push(cur);
    if(lines.length>maxLines){
      let last=lines.slice(maxLines-1).join(' ');
      while(last.length>1&&g.measureText(last+'…').width>maxW)last=last.slice(0,-1);
      lines.length=maxLines-1;lines.push(last.trimEnd()+'…');
    }
    return lines;
  };
  const makeBg=(W,H,p)=>{
    const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    if(bgImg&&bgImg.complete&&bgImg.naturalWidth){
      const k=Math.max(W/bgImg.naturalWidth,H/bgImg.naturalHeight),w=bgImg.naturalWidth*k,h=bgImg.naturalHeight*k;
      g.drawImage(bgImg,(W-w)/2,(H-h)/2,w,h);
      const dark=['Snow','Willow','Ocean'].includes(p[0]);
      g.fillStyle=dark?'rgba(8,10,20,.30)':'rgba(255,255,255,.22)';g.fillRect(0,0,W,H);
    }else{
      const gr=g.createLinearGradient(0,0,W*.4,H);gr.addColorStop(0,p[6]);gr.addColorStop(1,p[7]);g.fillStyle=gr;g.fillRect(0,0,W,H);
      const rg=g.createRadialGradient(W*.8,H*.12,10,W*.8,H*.12,W*.9);rg.addColorStop(0,'rgba(255,255,255,.22)');rg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=rg;g.fillRect(0,0,W,H);
    }
    return c;
  };

  // lays out (and optionally paints) everything at scale s; returns the height used in "logical" pixels
  const paint=(g,s,W,Lw,p,bgc,ox,oy,go)=>{
    const dsg=des,tc=p[1],pn=p[2],pns=p[3],ac=p[4],hdc=p[5];
    const muted=()=>{g.globalAlpha=.78};const full=()=>{g.globalAlpha=1};
    const canBlur='filter' in g;
    let y=0;
    g.textBaseline='alphabetic';
    // title
    if(go){g.fillStyle=tc;g.font='500 78px '+HEAD;g.shadowColor='rgba(0,0,0,.25)';g.shadowBlur=dsg===3?10:0;g.fillText('My Weekly Schedule',0,y+66);g.shadowBlur=0}
    y+=96;
    const u=items.reduce((a,x)=>a+(+x.units||0),0);
    if(go){g.font='500 30px '+FONT;g.fillStyle=tc;muted();g.fillText(items.length+' session'+(items.length===1?'':'s')+(u?'  ·  '+u+' units':''),0,y+20);full()}
    y+=70;
    const glass=(x,yy,w,h,r)=>{
      rr(g,x,yy,w,h,r);
      if(dsg===0){
        g.save();g.clip();
        if(canBlur){g.filter='blur(22px)';g.drawImage(bgc,-ox/s,-oy/s,W/s,bgc.height/s);g.filter='none'}
        g.fillStyle=pn;g.fillRect(x,yy,w,h);g.restore();
        rr(g,x,yy,w,h,r);g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=1.5;g.stroke();
      }else if(dsg===1){g.fillStyle=pns;g.fill();g.strokeStyle='rgba(128,128,128,.25)';g.lineWidth=1.5;g.stroke()}
      else if(dsg===2){
        g.fillStyle=pns;g.save();g.shadowColor='rgba(0,0,0,.22)';g.shadowBlur=18;g.shadowOffsetY=6;g.fill();g.restore();
        g.save();rr(g,x,yy,w,h,r);g.clip();g.fillStyle=ac;g.fillRect(x,yy,9,h);g.restore();
      }
    };
    DAYS.forEach(d=>{
      const l=items.filter(x=>x.day===d).sort((a,b)=>a.start.localeCompare(b.start));
      if(!l.length)return;
      y+=34;
      // day header
      if(go){
        g.font='700 30px '+FONT;g.fillStyle=ac;g.shadowColor='rgba(0,0,0,.25)';g.shadowBlur=dsg===3?8:0;
        let x=0;for(const ch of d.toUpperCase()){g.fillText(ch,x,y+30);x+=g.measureText(ch).width+4}
        g.shadowBlur=0;
        g.font='500 24px '+FONT;g.fillStyle=tc;muted();g.textAlign='right';g.fillText(l.length+(l.length===1?' class':' classes'),Lw,y+29);g.textAlign='left';full();
      }
      y+=58;
      // rows
      const px=dsg===3?0:34,innerW=Lw-px*2;
      const rows=l.map(x=>{
        g.font='500 27px '+FONT;
        g.font='700 29px '+FONT;const roomW=x.room?g.measureText(x.room).width+40:0;
        g.font='400 27px '+FONT;
        const mainW=innerW-232-(roomW?roomW+24:0);
        const lines=wrap(g,x.subj,mainW,2);
        return{x,lines,roomW,mainW,h:Math.max(122,30+42+lines.length*34+22)};
      });
      const gap=dsg===2?16:0,padY=dsg===2||dsg===3?0:14;
      const total=rows.reduce((a,r)=>a+r.h,0)+(dsg===2?gap*(rows.length-1):0)+padY*2;
      if(go&&dsg<2)glass(0,y,Lw,total,30);
      let yy=y+padY;
      rows.forEach((r,i)=>{
        if(go&&dsg===2)glass(0,yy,Lw,r.h,26);
        if(go){
          const x0=px+(dsg===2?14:0)+(dsg===3?4:0),top=yy;
          g.shadowColor='rgba(0,0,0,.35)';g.shadowBlur=dsg===3?8:0;
          // time
          g.fillStyle=tc;g.font='700 33px '+FONT;g.fillText(t12(r.x.start),x0,top+54);
          g.font='500 26px '+FONT;muted();g.fillText(t12(r.x.end),x0,top+90);full();
          // code + type pill
          const mx=x0+216;
          g.font='700 35px '+FONT;g.fillStyle=tc;g.fillText(r.x.code,mx,top+54);
          const cw=g.measureText(r.x.code).width;
          g.shadowBlur=0;
          const lab=r.x.type==='Lab';g.font='700 19px '+FONT;
          const tw=g.measureText(lab?'LAB':'LEC').width+30;
          rr(g,mx+cw+16,top+27,tw,34,17);
          if(lab){g.strokeStyle=ac;g.lineWidth=2;g.stroke();g.fillStyle=ac}else{g.fillStyle=ac;g.fill();g.fillStyle=hdc}
          g.textAlign='center';g.fillText(lab?'LAB':'LEC',mx+cw+16+tw/2,top+51);g.textAlign='left';
          // subject
          g.shadowColor='rgba(0,0,0,.35)';g.shadowBlur=dsg===3?8:0;
          g.font='400 27px '+FONT;g.fillStyle=tc;muted();
          r.lines.forEach((t,j)=>g.fillText(t,mx,top+92+j*34));full();
          // room
          if(r.roomW){
            g.shadowBlur=0;
            const rx=Lw-px-(dsg===2?14:0)-(dsg===3?4:0)-r.roomW;
            rr(g,rx,top+r.h/2-28,r.roomW,56,28);g.strokeStyle=ac;g.lineWidth=2;g.globalAlpha=.9;g.stroke();full();
            g.font='700 29px '+FONT;g.fillStyle=tc;g.textAlign='center';g.fillText(r.x.room,rx+r.roomW/2,top+r.h/2+10);g.textAlign='left';
          }
          g.shadowBlur=0;
          // separators
          if((dsg===0||dsg===1||dsg===3)&&i<rows.length-1){
            g.strokeStyle=tc;g.globalAlpha=dsg===3?.4:.16;g.lineWidth=1.5;g.beginPath();g.moveTo(px+(dsg===3?0:30),top+r.h);g.lineTo(Lw-px-(dsg===3?0:30),top+r.h);g.stroke();full();
          }
        }
        yy+=r.h+(dsg===2?gap:0);
      });
      y+=total;
    });
    return y;
  };

  let drawQueued=false;
  const renderWall=()=>{
    const[,W,H]=SIZES[size],p=COL[col];
    if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
    const g=cv.getContext('2d'),bgc=makeBg(W,H,p);
    g.clearRect(0,0,W,H);g.drawImage(bgc,0,0);
    const warn=$('#wall-warn');warn.textContent='';
    if(!items.length){
      g.fillStyle=p[1];g.textAlign='center';g.font='500 64px '+HEAD;g.fillText('Your schedule',W/2,H*.42);
      g.font='400 32px '+FONT;g.globalAlpha=.8;g.fillText('Scan your certificate or add a class',W/2,H*.42+60);g.globalAlpha=1;g.textAlign='left';return;
    }
    const M=64,top=clock?Math.round(H*(size===0?.255:.28)):Math.round(H*.07),bottom=Math.round(H*.06),avail=H-top-bottom;
    let s=1;
    const dummy=document.createElement('canvas').getContext('2d');
    for(;s>=.42;s-=.02){const Lw=(W-2*M)/s;if(paint(dummy,s,W,Lw,p,bgc,0,0,false)*s<=avail)break}
    s=Math.max(.42,s);
    const Lw=(W-2*M)/s,h=paint(dummy,s,W,Lw,p,bgc,0,0,false)*s;
    if(h>avail)warn.textContent='Too many classes to fit on one wallpaper. Turn off “Keep space for the clock” or remove a few.';
    // centre vertically inside the available area when it is short
    const oy=top+(h<avail?Math.min((avail-h)/2,H*.04):0);
    g.save();g.translate(M,oy);g.scale(s,s);
    paint(g,s,W,Lw,p,bgc,M,oy,true);
    g.restore();
  };
  const draw=()=>{
    // keep the data in sync, then redraw
    $('#designs').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('sel',i===des);b.setAttribute('aria-pressed',i===des)});
    $('#colors').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('sel',i===col);b.setAttribute('aria-pressed',i===col)});
    $('#sizes').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('sel',i===size);b.setAttribute('aria-pressed',i===size)});
    $('#clock').checked=clock;
    drawList();
    $('#sch-sum').textContent=items.length?items.length+' sessions · '+items.reduce((a,x)=>a+(+x.units||0),0)+' units':'';
    store.set('sch5',items);store.set('sdes',des);store.set('scol',col);store.set('sbg',bgData);store.set('ssize',size);store.set('sclock',clock);
    if(drawQueued)return;drawQueued=true;
    requestAnimationFrame(()=>{drawQueued=false;renderWall()});
  };

  $('#designs').innerHTML=DES.map(n=>'<button type="button" aria-pressed="false">'+n+'</button>').join('');
  $('#colors').innerHTML=COL.map(c=>'<button type="button" class="dotc" style="background:'+c[4]+'" aria-label="'+c[0]+'" title="'+c[0]+'" aria-pressed="false"></button>').join('');
  $('#sizes').innerHTML=SIZES.map(s=>'<button type="button" aria-pressed="false">'+s[0]+'</button>').join('');
  $$('#designs button').forEach((b,i)=>b.onclick=()=>{des=i;draw()});
  $$('#colors button').forEach((b,i)=>b.onclick=()=>{col=i;draw()});
  $$('#sizes button').forEach((b,i)=>b.onclick=()=>{size=i;draw()});
  $('#clock').onchange=e=>{clock=e.target.checked;draw()};

  const setBg=data=>{
    bgData=data;
    if(!data){bgImg=null;draw();return}
    const im=new Image();im.onload=()=>{bgImg=im;draw()};im.onerror=()=>{bgImg=null;bgData=null;draw()};im.src=data;
  };
  $('#bg-file').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{const c=await Lib.fileToCanvas(f,1800);setBg(c.toDataURL('image/jpeg',.85))}catch(err){alert('I could not open that photo.')}
  };
  $('#bg-clear').onclick=()=>setBg(null);

  // ----- save as JPEG -----
  const toJpeg=()=>new Promise(ok=>cv.toBlob(ok,'image/jpeg',.93));
  $('#sch-jpg').onclick=async()=>{
    if(!items.length)return alert('Add at least one class first.');
    const b=await toJpeg();Lib.download(b,'my-class-schedule.jpg');
    $('#save-note').textContent='Saved as my-class-schedule.jpg. On iPhone, tap Share to save it to Photos.';
  };
  const share=$('#sch-share');
  if(navigator.canShare&&navigator.canShare({files:[new File([''],'a.jpg',{type:'image/jpeg'})]}))share.hidden=false;
  share.onclick=async()=>{
    if(!items.length)return alert('Add at least one class first.');
    const b=await toJpeg();
    try{await navigator.share({files:[new File([b],'my-class-schedule.jpg',{type:'image/jpeg'})],title:'My class schedule'})}catch(e){}
  };

  // test hook (used by the automatic tests, harmless otherwise)
  window.SCH={parseCOR};

  setBg(bgData);
  document.fonts&&document.fonts.ready.then(()=>{Promise.all(['500 40px Fraunces','400 20px "DM Sans"','500 20px "DM Sans"','700 20px "DM Sans"'].map(f=>document.fonts.load(f))).then(draw).catch(()=>{})});
  draw();
})();
