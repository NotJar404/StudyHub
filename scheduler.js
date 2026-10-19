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
    for(let k=1;k<=4;k++){
      const h=x.slice(0,k),m=x.slice(k).match(/^([0-9SsOoIl]{3})([A-Za-z]?)$/);
      if(/^[A-Za-z]+$/.test(h)&&m)return h.toUpperCase()+m[1].replace(/[Ss]/g,'5').replace(/[Oo]/g,'0').replace(/[Il]/g,'1')+m[2].toLowerCase();
    }
    return x;
  };
  const CODE=/^[A-Z]{2,7}-?\d{1,3}[A-Z]?$/;
  const NUM=/^\d(?:\.\d)?$/;
  const SEC=/^[A-Za-z]{2,6}-\d{1,2}[A-Za-z]?$/; // a class section such as SBIT-1F
  // letters that OCR often confuses inside numbers
  const fixDigits=s=>s.replace(/(?<=\d)[OoQ](?=\d|\s*[:.;]|\s*[AaPp]\.?\s?[Mm])/g,'0').replace(/(?<=\d)[lI|](?=\d)/g,'1').replace(/(?<=[:.;])[OoQ]/g,'0').replace(/\b[OoQ](?=\d\s*[:.;]\d)/g,'0');
  const fixDigits2=s=>fixDigits(s.replace(/(?<=[:.;])[GgDd](?=\d|[OoQ0])/g,'0').replace(/(^|[^A-Za-z0-9])&(?=\s*[:.;]\s*\d{2})/g,(m,p)=>p+'6'));

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

  // ----- cleaning one line of reader output -----
  const cleanLine=l=>{
    let s=fixDigits2(l.replace(/[|\[\]{}_]/g,' ').replace(/\t+/g,'  ').replace(/[—–=]{2,}/g,' ').replace(/\s+/g,' ').trim());
    // "6-00PM" -> "6:00PM",   "2:30PM5:30PM" and "7:00PMa9:00PM" -> "2:30PM-5:30PM"
    s=s.replace(/(^|[^\d:.])(\d{1,2})\s*-\s*(\d{2})\s*([AaPp][MmNn])/g,'$1$2:$3$4')
       .replace(/([AaPp][MmNn])(?:[^\d\sA-Za-z]{1,3}|[a-z]|)(?=\d{1,2}\s*[:.;]\s*\d{2})/g,'$1-');
    return s;
  };
  // the section label that starts every subject on the certificate, e.g. "SBCS-3A-"
  const MARK=/^[^A-Za-z0-9]*[A-Za-z0-9€$@]{2,6}-[^\sA-Za-z0-9]?[0-9A-Za-z]{1,3}-/;
  const dayTok=x=>{
    const s=x.replace(/[^A-Za-z]/g,'').toUpperCase();
    if(!s)return'';
    if(isDay(s))return dayWord(s);
    if(/^[LIO1Q]/.test(s)&&isDay(s.slice(1)))return dayWord(s.slice(1)); // a stray bar read as I, l or O
    return'';
  };
  const SMALL=new Set(['and','of','the','in','for','to','a','an','on','with','at','by']);
  const tidySubject=s=>s.replace(/([a-z])(\d)$/,'$1 $2').replace(/\s+/g,' ').trim().split(' ').map((w,i)=>/^[a-z]/.test(w)&&(i===0||!SMALL.has(w))?w[0].toUpperCase()+w.slice(1):w).join(' ');
  const fixRoom=x=>{
    x=x.replace(/¢/g,'c').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'');
    let suf='';const m=x.match(/^(.*\d)(F[1Il])$/);if(m){x=m[1];suf=' F1'}
    return normRoom(x)+suf;
  };
  const roomTok=x=>/^(?:[A-Za-z1|]{1,4}[0-9SsOo]{3}[A-Za-z]?(?:F[1Il])?|(?:ONLINE|TBA|TBD|ASYNC|AVR|GYM|FIELD))$/i.test(x.replace(/¢/g,'c').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,''));

  // A row of the certificate table: [code] [SECTION-Subject] [units] [room] [days] [time]
  const rowFromLine=(line,li)=>{
    const ts=timesIn(line);
    if(ts.length!==1)return null;
    const t=ts[0];
    const tokens=line.slice(0,t.i).replace(/[\/,;]/g,' ').split(/\s+/).filter(x=>/[A-Za-z0-9]/.test(x));
    const mi=tokens.findIndex(x=>MARK.test(x));
    if(mi<0)return null;
    const codeText=tokens.slice(0,mi).join(' ');
    const T=tokens.slice(mi);
    T[0]=T[0].replace(MARK,'');if(!T[0])T.shift();
    const last=()=>T[T.length-1]||'';
    let days='',noDay=false,room='',units=null;
    // days (the word just before the time)
    const d=dayTok(last());
    if(d&&T.length>2){days=d;T.pop()}
    else if(/^F[1Iil|]\w?$/.test(last())&&T.length>3&&roomTok(T[T.length-2])){noDay=true}
    // room, which may end in "F1"
    if(noDay){const r=T[T.length-2];T.length-=2;room=fixRoom(r+'F1')}
    else if(T.length>2&&/^F[1Iil|]$/.test(last())){T.pop();room=fixRoom(T.pop()+'F1')}
    else if(T.length>2&&/^(\d)[1Il|]{1,2}(\d{3}[A-Za-z])$/.test(last())){ // "211603a" = unit 2 + room IL603a
      const g=T.pop().match(/^(\d)[1Il|]{1,2}(\d{3}[A-Za-z])$/);units=+g[1];room='IL'+g[2];
    }
    else if(T.length>2&&roomTok(last())&&!NUM.test(last()))room=fixRoom(T.pop());
    // units
    if(units==null&&T.length>1&&/^[0-9][^A-Za-z0-9]?$/.test(last())){units=+last()[0];T.pop()}
    let subj=T.join(' ');
    return{li,codeText,subj,units,room,days,noDay,start:t.start,end:t.stop};
  };

  // ----- course code clean-up: letters then 1-3 digits, fixing letters that look like digits -----
  const DFIX={O:'0',Q:'0',D:'0',I:'1',L:'1',S:'5',B:'8',Z:'2',G:'6'};
  const normCode=s=>{
    s=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(s.length<3||s.length>10)return null;
    let best=null;
    for(let k=2;k<s.length;k++){
      const head=s.slice(0,k),tail=s.slice(k);
      if(!/^[A-Z]+$/.test(head)||tail.length>3)continue;
      const dg=tail.replace(/[A-Z]/g,c=>DFIX[c]||'?');
      if(!/^\d+$/.test(dg))continue;
      const sc=(tail.length===3?3:tail.length===1?1.5:1)+(head.length<=6?.5:0)-(/[0-9]/.test(tail)?0:.2);
      if(!best||sc>best.sc||(sc===best.sc&&head.length>best.h.length))best={sc,h:head,code:head+dg};
    }
    return best?best.code:null;
  };

  const keyOfSubj=s=>String(s).toLowerCase().replace(/[^a-z]/g,'').slice(0,18);
  const tot=lines=>{for(const l of lines){const m=l.match(/total\s*units?\D{0,6}(\d{1,3})/i);if(m)return+m[1]}return null};

  // ----- fix what can be worked out from the other rows -----
  const reconcile=(items,total)=>{
    // rooms: a missing first letter (L504a) follows the other rooms (IL504a)
    const f={};items.forEach(i=>{const m=(i.room||'').match(/^([A-Z]+)\d/);if(m&&m[1].length>=2)f[m[1]]=(f[m[1]]||0)+1});
    const top=Object.keys(f).sort((a,b)=>f[b]-f[a]);
    items.forEach(i=>{const m=(i.room||'').match(/^([A-Z])(\d.*)$/);if(m){const q=top.find(p=>p.endsWith(m[1]));if(q)i.room=q+m[2]}});
    // days missing: a lab usually meets the same day as its lecture
    items.forEach(i=>{if(i._noDay){const s=items.find(o=>o!==i&&!o._noDay&&(o.code===i.code||keyOfSubj(o.subj)===keyOfSubj(i.subj)));if(s)i.day=s.day;i.chk=true}});
    // lecture or lab: of two rows with the same code, the longer one is the lab
    const g={};items.forEach(i=>{(g[i.code]=g[i.code]||{})[i._li]=i});
    Object.values(g).forEach(m=>{
      const rows=Object.values(m);
      const all=c=>items.filter(i=>i.code===rows[0].code&&i._li===c._li);
      if(rows.length===2){
        let [a,b]=rows;const ha=hrs(a.start,a.end),hb=hrs(b.start,b.end);
        const aLab=ha>hb?true:hb>ha?false:(+a.units||9)<(+b.units||9);
        all(a).forEach(i=>i.type=aLab?'Lab':'Lec');all(b).forEach(i=>i.type=aLab?'Lec':'Lab');
      }else rows.forEach(r=>{all(r).forEach(i=>{i.type=/\blab(oratory)?\b/i.test(i.subj)?'Lab':(i.units>0&&hrs(i.start,i.end)/i.units>=2.5)||i.units===0?'Lab':'Lec'})});
    });
    // units can never be more than the hours; otherwise work them out (lecture: 1 unit an hour, lab: 3 hours a unit)
    items.forEach(i=>{
      const h=hrs(i.start,i.end),n=items.filter(o=>o._li===i._li).length,want=i.type==='Lab'?Math.max(1,Math.round(h/3)):Math.max(1,Math.round(h*n));
      if(i.units===''||i.units==null||+i.units>h*n+.01||+i.units===0&&i.type!=='Lab'){i.units=want;i.chk=true}
    });
    const lines=new Map();items.forEach(i=>lines.set(i._li,i));
    const sum=[...lines.values()].reduce((a,i)=>a+(+i.units||0),0);
    return{sum,mismatch:total!=null&&total!==sum,total};
  };

  const buildItems=rows=>{
    const items=[];
    rows.forEach(r=>{
      const dl=r.days?(r.days.match(/TH|[MTWFS]/g)||[]):[];
      const code=r.code||'';
      const mk=d=>{
        const it={code:code||'CLASS',subj:r.subj,units:r.units==null?'':r.units,room:r.room,day:d,start:r.start,end:r.end,type:'Lec',_li:r.li};
        if(r.chk||!code||(!dl.length&&d))it.chk=true;
        if(!dl.length)it._noDay=true;
        items.push(it);
      };
      if(dl.length)[...new Set(dl)].forEach(d=>mk(DAYNAME[d]));else mk('Monday');
    });
    return items;
  };

  // A looser reader for tables that do not look like the usual certificate
  const genericRows=(lines,k)=>{
    const line=lines[k],ts=timesIn(line);
    if(!ts.length)return[];
    const tok=s=>s.replace(/[\/,;]/g,' ').split(/\s+/).filter(Boolean);
    const out=[];let left=tok(line.slice(0,ts[0].i));
    let head=[],cd=findCode(left);
    if(!cd){for(let b=k-1;b>=Math.max(0,k-2);b--){if(timesIn(lines[b]).length)break;const tk=tok(lines[b]);if(findCode(tk)){head=tk;break}}}
    const all=head.length?head.concat(left):left;
    cd=findCode(all);
    let code=cd?cd[2]:'',rest=cd?all.slice(cd[0]+cd[1]):all,guess=false;
    if(!cd&&all.length>1&&/\d/.test(all[0])&&/[A-Za-z]/.test(all[0])){code=all[0].toUpperCase();rest=all.slice(1);guess=true}
    ts.forEach((t,ti)=>{
      const segLeft=ti?tok(line.slice(ts[ti-1].end,t.i)):rest.slice();
      let days=[],body=segLeft.slice();
      while(body.length&&isDay(body[body.length-1])&&days.length<4)days.unshift(body.pop());
      if(!days.length){const after=tok(line.slice(t.end,ti<ts.length-1?ts[ti+1].i:undefined));let n=0;while(n<after.length&&isDay(after[n])&&n<4){days.push(after[n]);n++}}
      while(body.length>1&&SEC.test(body[body.length-1]))body.pop();
      let room='';
      while(body.length>2&&/^(?:[^A-Za-z0-9]{1,2}|[a-z]{1,2})$/.test(body[body.length-1])&&NUM.test(body[body.length-2]))body.pop();
      if(body.length>1&&roomLike(body[body.length-1])&&!NUM.test(body[body.length-1]))room=normRoom(body.pop());
      else{const after=tok(line.slice(t.end)),j=after.findIndex(x=>roomLike(x)&&!isDay(x)&&!NUM.test(x));if(j>=0)room=normRoom(after[j])}
      let units=null,run=[];
      while(body.length&&NUM.test(body[body.length-1]))run.unshift(body.pop());
      if(run.length&&+run[run.length-1]<=6){units=+run[run.length-1];body.push(...run.slice(0,-1))}else if(run.length)body.push(...run);
      let subj=body.join(' ').replace(/^[-–:.,\s]+|[-–:.,\s]+$/g,'');
      if(!subj)subj=code||'Class';
      out.push({li:k,code,codeText:'',subj,units,room,days:days.map(dayWord).join(''),noDay:!days.length,start:t.start,end:t.stop,chk:guess,generic:true});
    });
    return out;
  };

  // Turns the reader's lines into rows. (Course codes are fixed afterwards by a second look at the code column.)
  const parseRows=raw=>{
    const lines=(Array.isArray(raw)?raw:String(raw).split(/\r?\n/)).map(cleanLine);
    const rows=[];
    lines.forEach((l,k)=>{
      if(!l)return;
      const r=rowFromLine(l,k);
      if(r){
        // a subject that carries on to the next line
        const nx=lines[k+1];
        if(nx&&!timesIn(nx).length&&!MARK.test(nx.split(' ')[0]||'')&&/^[A-Za-z(][A-Za-z ()&,'-]{2,40}$/.test(nx)&&!/total|units|tuition|fee|date|name|student/i.test(nx))r.subj+=' '+nx;
        rows.push(r);
      }else rows.push(...genericRows(lines,k));
    });
    return{rows,lines,total:tot(lines),timeLines:lines.reduce((a,l)=>a+timesIn(l).length,0)};
  };

  const finish=(parsed,codes)=>{
    const rows=parsed.rows.map(r=>{
      const c=codes&&codes[r.li];
      const code=c?c.code:(normCode(r.codeText)||(r.generic?r.code:'')||'');
      return{...r,subj:tidySubject(String(r.subj).replace(/^[-–:.,\s]+|[-–:.,\s]+$/g,'')),code:code||(r.code||''),chk:r.chk||(c?c.unsure:!code)};
    });
    const items=buildItems(rows);
    const info=reconcile(items,parsed.total);
    return{items,unsure:items.filter(i=>i.chk).length,timeLines:parsed.timeLines,sum:info.sum,total:info.total,mismatch:info.mismatch};
  };
  const parseCOR=raw=>finish(parseRows(raw),null);

  // =================================================================
  //  SCANNING
  //  1) clean the photo up  2) read it  3) read the sparse text for anything the first pass missed
  //  4) look at the course-code column again, one row at a time, and vote on each code
  // =================================================================
  let cor=null,snapshot=null;
  const msg=(t,kind)=>{const m=$('#cor-msg');m.textContent=t;m.dataset.k=kind||''};
  const bar=p=>{$('#cor-bar').style.width=p+'%'};
  const wait=()=>new Promise(r=>setTimeout(r,30));
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};

  const addScanned=res=>{
    snapshot=items.map(x=>({...x}));
    const have=new Set(items.map(keyOf));let n=0;
    res.items.forEach(x=>{const y={...x};delete y._li;delete y._noDay;if(!have.has(keyOf(y))){items.push(y);have.add(keyOf(y));n++}});
    draw();
    return n;
  };

  const sectionWord=w=>MARK.test(w.t.replace(/^[^A-Za-z0-9]+/,'').replace(/^/,''))||MARK.test(w.t);
  const cropOf=(canvas,x0,x1,yc,hh)=>{
    const W=Math.round(x1-x0),H=Math.round(hh*2),k=1.3,c=document.createElement('canvas');
    c.width=Math.round((W+48)*k);c.height=Math.round((H+48)*k);
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.imageSmoothingQuality='high';
    g.drawImage(canvas,Math.max(0,x0),Math.max(0,yc-hh),W,H,24*k,24*k,W*k,H*k);
    return c;
  };
  // Looks at the code column of each row on its own, with a few different photo clean-ups, and lets the readings vote.
  const readCodes=async(A,parsed,canvases,progress)=>{
    const lines=A.lines;if(!lines||!lines.length)return null;
    // where is the code of each row? (the words that come before the "SBCS-3A-" label)
    const rowsAt={};
    parsed.rows.forEach(r=>{
      const L=lines[r.li];if(!L||!L.words)return;
      const ws=[...L.words].sort((a,b)=>a.x0-b.x0),mi=ws.findIndex(sectionWord);
      if(mi<0)return;
      const cw=ws.slice(0,mi).filter(w=>/[A-Za-z0-9]/.test(w.t)&&(w.x1-w.x0)>8);
      if(cw.length)rowsAt[r.li]={x0:Math.min(...cw.map(w=>w.x0)),x1:Math.max(...cw.map(w=>w.x1)),yc:med(cw.map(w=>(w.y0+w.y1)/2))};
    });
    const ids=Object.keys(rowsAt);if(!ids.length)return null;
    const mx0=med(ids.map(i=>rowsAt[i].x0)),mx1=med(ids.map(i=>rowsAt[i].x1));
    const votes={};let done=0;
    const total=ids.length*canvases.length*2;
    for(const id of ids){
      const b=rowsAt[id],v=votes[id]={};
      const x0=Math.min(b.x0,mx0+(b.x0-mx0)*.2)-12,x1=Math.max(b.x1,b.x0+60)+12;
      for(const cv of canvases)for(const hh of[40,52]){
        try{
          const t=await Lib.ocr(cropOf(cv,x0,x1,b.yc,hh),{psm:7,whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'});
          const c=normCode(t);if(c)v[c]=(v[c]||0)+1;
        }catch(e){}
        progress(++done/total);
      }
    }
    // rows with the same subject are the same course, so they share their votes
    const subj={};parsed.rows.forEach(r=>{(subj[keyOfSubj(r.subj)]=subj[keyOfSubj(r.subj)]||[]).push(r.li)});
    const out={};
    parsed.rows.forEach(r=>{
      const pool={};
      (subj[keyOfSubj(r.subj)]||[r.li]).forEach(li=>{
        const v=votes[li]||{};Object.keys(v).forEach(c=>pool[c]=(pool[c]||0)+v[c]);
        const p=parsed.rows.find(x=>x.li===li);const pc=p&&normCode(p.codeText);if(pc)pool[pc]=(pool[pc]||0)+1;
      });
      const ks=Object.keys(pool);if(!ks.length)return;
      const score=c=>pool[c]*10+(/^[A-Z]{2,6}\d{3}$/.test(c)?4:/^[A-Z]{2,7}\d{1,3}$/.test(c)?2:0)+c.length*.1;
      ks.sort((a,b)=>score(b)-score(a));
      const top=ks[0],all=ks.reduce((a,c)=>a+pool[c],0);
      out[r.li]={code:top,unsure:pool[top]<2||pool[top]/all<.4};
      if(window.SCH)SCH.dbg[r.li]=pool;
    });
    return out;
  };

  const lev=(a,b)=>{const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]};
  // The first word of each subject is glued to the "SBCS-3A-" label and is often misread. Compare both readings of
  // every row of the same course and keep the one that agrees most with the others.
  const fixFirstWords=(parsed,A,B)=>{
    if(!A.lines)return;
    const bm=B&&B.words?B.words.filter(w=>MARK.test(w.t)):[];
    const per=parsed.rows.map(r=>{
      const L=A.lines[r.li],cands=[];
      const first=(r.subj.match(/^\S+/)||[''])[0];
      if(first)cands.push({w:first,c:0});
      const aw=L&&L.words?L.words.find(sectionWord):null;
      if(aw){
        cands[0]&&(cands[0].c=aw.c==null?50:aw.c);
        const b=bm.find(w=>Math.abs(w.x0-aw.x0)<70&&Math.abs((w.y0+w.y1)/2-(aw.y0+aw.y1)/2)<60);
        if(b){const t=b.t.replace(MARK,'');if(/^[A-Za-z]{3,}$/.test(t))cands.push({w:t,c:b.c==null?50:b.c})}
      }
      return{r,cands};
    });
    const groups={};per.forEach(p=>{(groups[keyOfSubj(p.r.subj.replace(/^\S+/,''))]=groups[keyOfSubj(p.r.subj.replace(/^\S+/,''))]||[]).push(p)});
    Object.values(groups).forEach(g=>{
      const all=g.flatMap(p=>p.cands);if(all.length<2)return;
      const score=c=>all.reduce((a,o)=>a+lev(c.w.toLowerCase(),o.w.toLowerCase()),0)-c.c/100;
      const best=all.slice().sort((a,b)=>score(a)-score(b))[0];
      g.forEach(p=>{if(p.cands.length)p.r.subj=p.r.subj.replace(/^\S+/,best.w)});
    });
  };

  // The first read can drop the second line of a long subject ("...Emerging / Technologies"). The sparse read finds it.
  const addMissingWords=(parsed,A,B)=>{
    if(!A.lines||!B||!B.words)return;
    const inA=w=>A.words&&A.words.some(a=>{
      const ox=Math.min(a.x1,w.x1)-Math.max(a.x0,w.x0),oy=Math.min(a.y1,w.y1)-Math.max(a.y0,w.y0);
      return ox>0&&oy>0&&ox*oy>.4*(w.x1-w.x0)*(w.y1-w.y0)&&lev(a.t.toLowerCase(),w.t.toLowerCase())<=2;
    });
    const orphans=B.words.filter(w=>/^[A-Za-z][A-Za-z'&()-]{2,}$/.test(w.t)&&(w.c==null||w.c>=60)&&!inA(w));
    if(!orphans.length)return;
    const marks=[];
    parsed.rows.forEach(r=>{
      const L=A.lines[r.li];if(!L||!L.words)return;
      const ws=[...L.words].sort((a,b)=>a.x0-b.x0),mi=ws.findIndex(sectionWord);if(mi<0)return;
      const nums=ws.slice(mi).filter(w=>/^\d/.test(w.t)&&w.x0>ws[mi].x0+300);
      marks.push({r,x0:ws[mi].x0-70,x1:nums.length?nums[0].x0-6:ws[mi].x0+1500,y:med(ws.slice(mi).map(w=>w.y0)),h:med(ws.slice(mi).map(w=>w.y1-w.y0))||50});
    });
    orphans.sort((a,b)=>a.x0-b.x0).forEach(w=>{
      const cands=marks.filter(m=>w.x0>=m.x0&&w.x1<=m.x1&&w.y0>m.y+m.h*.3&&w.y0-m.y<m.h*2.6);
      if(!cands.length)return;
      const m=cands.sort((a,b)=>b.y-a.y)[0];
      if(!m.r._added)m.r._added=[];
      m.r._added.push(w.t);m.r.subj+=' '+w.t;
    });
  };

  let scanning=false;
  const scan=async()=>{
    if(!cor||scanning)return;
    scanning=true;$('#cor-scan').disabled=true;$('#cor-undo').hidden=true;$('#cor-raw').hidden=true;
    let raw='',res={items:[],unsure:0,timeLines:0};
    try{
      msg('Straightening and cleaning up your photo…');bar(4);await wait();
      const bw=Lib.prep(cor,'bw');
      msg('Reading your certificate… (the first time this loads the reader, please wait)');
      const A=await Lib.ocr(bw,{psm:6,full:true,onProgress:p=>{bar(Math.round(8+p*40));msg('Reading your certificate… '+Math.round(p*100)+'%')}});
      raw=A.text;
      const lineTexts=A.lines&&A.lines.length?A.lines.map(l=>l.t):null;
      let parsed=parseRows(lineTexts||A.text);
      let codes=null;
      const rows=parsed.rows.filter(r=>!r.generic);
      if(rows.length){
        try{
          msg('Looking for anything the first read missed…');bar(52);await wait();
          let B=null;
          try{B=await Lib.ocr(bw,{psm:11,full:true})}catch(e){}
          if(lineTexts&&B)addMissingWords(parsed,A,B);
          if(lineTexts)fixFirstWords(parsed,A,B);
          msg('Double-checking each course code…');bar(58);await wait();
          const cans=[bw,Lib.prep(cor,'bws'),Lib.prep(cor,'bwl')];
          codes=await readCodes(A,parsed,cans,p=>{bar(Math.round(60+p*38))});
        }catch(e){codes=null}
      }
      res=finish(parsed,codes);
      // nothing found: try the other photo clean-ups and layouts
      if(!res.items.length){
        const tries=[['gray',6,'Trying again with softer contrast…'],['bws',4,'One more try with a different layout…']];
        for(let i=0;i<tries.length&&!res.items.length;i++){
          const[mode,psm,label]=tries[i];msg(label);bar(60+i*15);await wait();
          const text=await Lib.ocr(Lib.prep(cor,mode),{psm});
          const r=parseCOR(text);if(r.items.length){res=r;raw=text}
        }
      }
      bar(100);
      $('#cor-raw').hidden=!raw;$('#cor-raw pre').textContent=raw;
      if(res.items.length){
        const n=addScanned(res);
        let m=n?('Added '+n+' class'+(n===1?'':'es')+' to your schedule.'):'Those classes are already in your schedule.';
        if(res.unsure)m+=' '+res.unsure+' marked “check” may need a quick fix. Tap ✎ to edit.';
        if(res.mismatch)m+=' Your certificate says '+res.total+' total units but the scan adds up to '+res.sum+', so double-check the units.';
        msg(m,res.unsure||res.mismatch?'':'ok');
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
  window.SCH={parseCOR,parseRows,finish,normCode,dbg:{}};

  setBg(bgData);
  document.fonts&&document.fonts.ready.then(()=>{Promise.all(['500 40px Fraunces','400 20px "DM Sans"','500 20px "DM Sans"','700 20px "DM Sans"'].map(f=>document.fonts.load(f))).then(draw).catch(()=>{})});
  draw();
})();
