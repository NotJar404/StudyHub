// ===== CLASS SCHEDULER =====
// 1) Scan a Certificate of Registration (photo or PDF) -> classes go straight into your list.
// 2) Your classes are drawn as a phone wallpaper you can download as a JPEG.
(()=>{
  if(!$('#sch-form'))return;

  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // [name, text colour, -, -, accent, text on accent, background top, background bottom, default panel fill]
  const COL=[
    ['Snow','#ffffff','','','#f0b562','#1a1208','#c9833a','#4d2a14','#12141f'],
    ['Ink','#2a2520','','','#a85c1c','#ffffff','#fbeed8','#efd3ab','#ffffff'],
    ['Willow','#f4fff6','','','#a8e0b5','#10281c','#3c8765','#10281c','#14342a'],
    ['Rose','#3a1f26','','','#b5475f','#ffffff','#f8cdd6','#e58aa0','#fff0f4'],
    ['Ocean','#eaf6ff','','','#7cc4f5','#0b2038','#2a77b5','#0b2038','#0e2644']
  ];
  const LAYOUTS=[['Stacked days','One day per row'],['Grouped list','All days in one shared panel'],['Day columns','Weekday circles and class stacks'],['Timeline','Connected days, clear rows']];
  const SIZES=[['Tall phone (most phones)',1080,2340],['Standard phone',1080,1920]];

  let items=store.get('sch5',null);
  if(!items)items=store.get('sch4',[]);
  let bgData=store.get('sbg',null),editIdx=null,bgImg=null;
  // the look of the wallpaper
  const S=Object.assign({lay:0,col:0,size:0,clock:true,fillOn:true,fill:'#12141f',fillOp:62,lineOn:false,line:'#f0b562',lineW:2,wf:100,px:50,py:18},store.get('sch6s',{}));
  S.lay=Math.min(Math.max(+S.lay||0,0),3);S.col=Math.min(Math.max(+S.col||0,0),COL.length-1);S.size=Math.min(Math.max(+S.size||0,0),SIZES.length-1);

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
  const DAB={Monday:'M',Tuesday:'T',Wednesday:'W',Thursday:'Th',Friday:'F',Saturday:'S'};
  // colour helpers
  const hx=h=>{h=h.replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
  const lum=c=>{const[r,g,b]=hx(c).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
  const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const mixHex=(a,b,t)=>'#'+hx(a).map((v,i)=>Math.round(v*(1-t)+hx(b)[i]*t).toString(16).padStart(2,'0')).join('');
  const rgba=(c,a)=>{const[r,g,b]=hx(c);return'rgba('+r+','+g+','+b+','+a+')'};
  const theme=()=>{
    const p=COL[S.col],panelOn=S.fillOn&&S.fillOp>=35;
    let tc=p[1],ac=p[4];
    if(panelOn){
      const light=lum(S.fill)>.4;
      tc=light?'#241d16':'#ffffff';
      if(contrast(ac,S.fill)<3.2)ac=light?mixHex(ac,'#000000',.55):mixHex(ac,'#ffffff',.5);
    }
    const hd=contrast(ac,'#ffffff')>contrast(ac,'#111111')?'#ffffff':'#111111';
    return{tc,ac,hd,panelOn};
  };
  const rr=(g,x,y,w,h,r)=>{r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
  const wrap=(g,text,maxW,maxLines)=>{
    const words=String(text).split(/\s+/),lines=[];let cur='';
    for(const w of words){const t=cur?cur+' '+w:w;if(g.measureText(t).width<=maxW||!cur)cur=t;else{lines.push(cur);cur=w}}
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
    }else{
      const gr=g.createLinearGradient(0,0,W*.4,H);gr.addColorStop(0,p[6]);gr.addColorStop(1,p[7]);g.fillStyle=gr;g.fillRect(0,0,W,H);
      const rg=g.createRadialGradient(W*.8,H*.12,10,W*.8,H*.12,W*.9);rg.addColorStop(0,'rgba(255,255,255,.22)');rg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=rg;g.fillRect(0,0,W,H);
    }
    return c;
  };

  // Lays out (and, when go is true, paints) the whole schedule at scale s. Returns the height used in "logical" pixels.
  const paint=(g,s,W,Lw,th,bgc,ox,oy,go)=>{
    const{tc,ac,hd,panelOn}=th,canBlur='filter' in g;
    const dim=a=>{g.globalAlpha=a},full=()=>{g.globalAlpha=1};
    const soft=on=>{g.shadowColor='rgba(0,0,0,.4)';g.shadowBlur=on&&!panelOn?9:0};
    const panel=(x,y,w,h,r)=>{
      if(!go)return;
      if(S.fillOn&&S.fillOp>0){
        if(S.fillOp<92&&canBlur){g.save();rr(g,x,y,w,h,r);g.clip();g.filter='blur(22px)';g.drawImage(bgc,-ox/s,-oy/s,W/s,bgc.height/s);g.filter='none';g.restore()}
        rr(g,x,y,w,h,r);g.fillStyle=rgba(S.fill,S.fillOp/100);g.fill();
      }
      if(S.lineOn){rr(g,x,y,w,h,r);g.strokeStyle=S.line;g.lineWidth=S.lineW;g.stroke()}
    };
    const byDay=d=>items.filter(x=>x.day===d).sort((a,b)=>a.start.localeCompare(b.start));
    const days=DAYS.filter(d=>byDay(d).length);
    g.textBaseline='alphabetic';g.textAlign='left';
    let y=0;
    // title
    if(go){g.fillStyle=tc;g.font='500 78px '+HEAD;soft(true);g.fillText('My Weekly Schedule',0,y+66);g.shadowBlur=0}
    y+=96;
    const u=items.reduce((a,x)=>a+(+x.units||0),0);
    if(go){g.font='500 30px '+FONT;g.fillStyle=tc;soft(true);dim(.8);g.fillText(items.length+' session'+(items.length===1?'':'s')+(u?'  ·  '+u+' units':''),0,y+20);full();g.shadowBlur=0}
    y+=70;

    // ----- one row of a class: time | code + type | subject | room -----
    const measure=(l,w,pad)=>l.map(x=>{
      g.font='700 29px '+FONT;const roomW=x.room?g.measureText(x.room).width+40:0;
      g.font='400 27px '+FONT;
      const lines=wrap(g,x.subj,w-pad*2-216-(roomW?roomW+24:0),2);
      return{x,lines,roomW,h:Math.max(122,30+42+lines.length*34+22)};
    });
    const drawRow=(r,x0,top,w,pad)=>{
      const mx=x0+pad+216;
      soft(true);
      g.fillStyle=tc;g.font='700 33px '+FONT;g.fillText(t12(r.x.start),x0+pad,top+54);
      g.font='500 26px '+FONT;dim(.78);g.fillText(t12(r.x.end),x0+pad,top+90);full();
      g.font='700 35px '+FONT;g.fillStyle=tc;g.fillText(r.x.code,mx,top+54);
      const cw=g.measureText(r.x.code).width;g.shadowBlur=0;
      const lab=r.x.type==='Lab';g.font='700 19px '+FONT;
      const tw=g.measureText(lab?'LAB':'LEC').width+30;
      rr(g,mx+cw+16,top+27,tw,34,17);
      if(lab){g.strokeStyle=ac;g.lineWidth=2;g.stroke();g.fillStyle=ac}else{g.fillStyle=ac;g.fill();g.fillStyle=hd}
      g.textAlign='center';g.fillText(lab?'LAB':'LEC',mx+cw+16+tw/2,top+51);g.textAlign='left';
      soft(true);g.font='400 27px '+FONT;g.fillStyle=tc;dim(.85);
      r.lines.forEach((t,j)=>g.fillText(t,mx,top+92+j*34));full();g.shadowBlur=0;
      if(r.roomW){
        const rx=x0+w-pad-r.roomW;
        rr(g,rx,top+r.h/2-28,r.roomW,56,28);g.strokeStyle=ac;g.lineWidth=2;g.globalAlpha=.95;g.stroke();full();
        g.font='700 29px '+FONT;g.fillStyle=tc;g.textAlign='center';g.fillText(r.x.room,rx+r.roomW/2,top+r.h/2+10);g.textAlign='left';
      }
    };
    const sep=(x1,x2,yy,a)=>{g.strokeStyle=panelOn?tc:'#ffffff';g.globalAlpha=a;g.lineWidth=1.5;g.beginPath();g.moveTo(x1,yy);g.lineTo(x2,yy);g.stroke();full()};
    const dayHead=(d,n,x,yy,w)=>{
      g.font='700 30px '+FONT;g.fillStyle=ac;soft(true);
      let xx=x;for(const ch of d.toUpperCase()){g.fillText(ch,xx,yy+30);xx+=g.measureText(ch).width+4}
      g.shadowBlur=0;g.font='500 24px '+FONT;g.fillStyle=tc;dim(.78);g.textAlign='right';g.fillText(n+(n===1?' class':' classes'),x+w,yy+29);g.textAlign='left';full();
    };

    // ===== layout 1: STACKED DAYS (each day in its own panel) =====
    if(S.lay===0){
      days.forEach(d=>{
        const l=byDay(d);y+=34;
        if(go)dayHead(d,l.length,4,y,Lw-8);
        y+=58;
        const rows=measure(l,Lw,34),total=rows.reduce((a,r)=>a+r.h,0)+28;
        panel(0,y,Lw,total,30);
        let yy=y+14;
        rows.forEach((r,i)=>{
          if(go){drawRow(r,0,yy,Lw,34);if(i<rows.length-1)sep(34,Lw-34,yy+r.h,panelOn?.16:.35)}
          yy+=r.h;
        });
        y+=total;
      });
    }
    // ===== layout 2: GROUPED LIST (everything in one shared panel) =====
    else if(S.lay===1){
      y+=10;
      const blocks=days.map(d=>({d,rows:measure(byDay(d),Lw,34)}));
      const total=blocks.reduce((a,b)=>a+78+b.rows.reduce((t,r)=>t+r.h,0),0)+30;
      panel(0,y,Lw,total,34);
      let yy=y+14;
      blocks.forEach((b,bi)=>{
        if(go){
          if(bi>0)sep(34,Lw-34,yy-4,panelOn?.35:.5);
          dayHead(b.d,b.rows.length,34,yy+14,Lw-68);
        }
        yy+=78;
        b.rows.forEach((r,i)=>{
          if(go){drawRow(r,0,yy,Lw,34);if(i<b.rows.length-1)sep(34,Lw-34,yy+r.h,panelOn?.12:.3)}
          yy+=r.h;
        });
      });
      y+=total;
    }
    // ===== layout 3: DAY COLUMNS (weekday circles with class stacks) =====
    else if(S.lay===2){
      y+=30;
      const n=Math.max(1,days.length),gap=14,colW=(Lw-gap*(n-1))/n,dia=Math.min(colW-10,108);
      let tall=0;
      days.forEach((d,ci)=>{
        const x=ci*(colW+gap),l=byDay(d);
        if(go){
          const cx=x+colW/2,cy=y+dia/2;
          g.beginPath();g.arc(cx,cy,dia/2,0,Math.PI*2);
          if(S.fillOn){g.fillStyle=rgba(S.fill,Math.max(.35,S.fillOp/100));g.fill()}else{g.fillStyle=rgba('#000000',.28);g.fill()}
          g.strokeStyle=S.lineOn?S.line:ac;g.lineWidth=S.lineOn?S.lineW:3;g.stroke();
          g.fillStyle=ac;g.font='700 '+(dia>90?40:32)+'px '+FONT;g.textAlign='center';g.fillText(DAB[d],cx,cy+14);g.textAlign='left';
        }
        let yy=y+dia+22;
        l.forEach(c=>{
          const h=190;
          panel(x,yy,colW,h,22);
          if(go){
            const cx=x+colW/2;g.textAlign='center';
            let fs=30;g.font='700 '+fs+'px '+FONT;while(g.measureText(c.code).width>colW-16&&fs>18){fs-=2;g.font='700 '+fs+'px '+FONT}
            soft(true);g.fillStyle=tc;g.fillText(c.code,cx,yy+44);
            g.shadowBlur=0;
            const lab=c.type==='Lab';g.font='700 15px '+FONT;
            const tw=g.measureText(lab?'LAB':'LEC').width+22;
            rr(g,cx-tw/2,yy+58,tw,26,13);
            if(lab){g.strokeStyle=ac;g.lineWidth=2;g.stroke();g.fillStyle=ac}else{g.fillStyle=ac;g.fill();g.fillStyle=hd}
            g.fillText(lab?'LAB':'LEC',cx,yy+77);
            soft(true);g.fillStyle=tc;g.font='600 21px '+FONT;g.fillText(t12(c.start),cx,yy+118);
            dim(.75);g.font='500 20px '+FONT;g.fillText(t12(c.end),cx,yy+144);full();
            if(c.room){g.fillStyle=ac;g.font='700 20px '+FONT;g.shadowBlur=0;g.fillText(c.room,cx,yy+175)}
            g.shadowBlur=0;g.textAlign='left';
          }
          yy+=h+14;
        });
        tall=Math.max(tall,yy-y);
      });
      y+=tall;
    }
    // ===== layout 4: TIMELINE (days joined by a line) =====
    else{
      y+=26;
      const LP=62,start=y,dots=[];
      days.forEach(d=>{
        const l=byDay(d);
        dots.push(y+22);
        if(go)dayHead(d,l.length,LP,y,Lw-LP);
        y+=62;
        measure(l,Lw-LP,30).forEach(r=>{
          panel(LP,y,Lw-LP,r.h,26);
          if(go)drawRow(r,LP,y,Lw-LP,30);
          y+=r.h+14;
        });
        y+=12;
      });
      if(go&&dots.length){
        g.strokeStyle=ac;g.globalAlpha=.8;g.lineWidth=4;g.beginPath();g.moveTo(20,dots[0]);g.lineTo(20,y-26);g.stroke();full();
        dots.forEach(dy=>{g.beginPath();g.arc(20,dy,15,0,Math.PI*2);g.fillStyle=ac;g.fill();g.beginPath();g.arc(20,dy,6,0,Math.PI*2);g.fillStyle=hd;g.fill()});
      }
      y-=12;
    }
    return y;
  };

  let drawQueued=false;
  const renderWall=()=>{
    const[,W,H]=SIZES[S.size],p=COL[S.col],th=theme();
    if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
    const g=cv.getContext('2d'),bgc=makeBg(W,H,p);
    g.clearRect(0,0,W,H);g.drawImage(bgc,0,0);
    if(bgImg){g.fillStyle=lum(p[6])<.4?'rgba(8,10,20,.22)':'rgba(255,255,255,.16)';g.fillRect(0,0,W,H)}
    const warn=$('#wall-warn');warn.textContent='';
    if(!items.length){
      g.fillStyle=th.tc;g.textAlign='center';g.font='500 64px '+HEAD;g.fillText('Your schedule',W/2,H*.42);
      g.font='400 32px '+FONT;g.globalAlpha=.8;g.fillText('Scan your certificate or add a class',W/2,H*.42+60);g.globalAlpha=1;g.textAlign='left';return;
    }
    // sample phone clock, preview only: it is NOT part of the saved wallpaper
    const M=64,top=S.clock?Math.round(H*(S.size===0?.255:.28)):Math.round(H*.07),bottom=Math.round(H*.06),avail=H-top-bottom;
    const BW=(W-2*M)*S.wf/100,left=M+(W-2*M-BW)*S.px/100;
    let s=1;
    const dummy=document.createElement('canvas').getContext('2d');
    for(;s>=.42;s-=.02){const Lw=BW/s;if(paint(dummy,s,W,Lw,th,bgc,0,0,false)*s<=avail)break}
    s=Math.max(.42,s);
    const Lw=BW/s,h=paint(dummy,s,W,Lw,th,bgc,0,0,false)*s;
    if(h>avail)warn.textContent='Too many classes to fit on one wallpaper. Turn off “Keep space for the clock” or remove a few.';
    const oy=top+Math.max(0,avail-h)*S.py/100;
    g.save();g.translate(left,oy);g.scale(s,s);
    paint(g,s,W,Lw,th,bgc,left,oy,true);
    g.restore();
  };

  // ----- the controls -----
  const FILLS=['#12141f','#ffffff','#fff3de','#fde7ec','#0e2644','#14342a'];
  const LINES=['#f0b562','#ffffff','#a85c1c','#b5475f','#7cc4f5','#2a2520'];
  const ICON=p=>'<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  const ICONS=[
    ICON('<rect x="8" y="9" width="32" height="7" rx="3.5"/><rect x="8" y="20.5" width="32" height="7" rx="3.5"/><rect x="8" y="32" width="32" height="7" rx="3.5"/>'),
    ICON('<rect x="7" y="7" width="34" height="34" rx="6"/><path d="M14 16h5M23 16h11M14 24h5M23 24h11M14 32h5M23 32h11"/>'),
    ICON('<circle cx="12" cy="11" r="3"/><circle cx="24" cy="11" r="3"/><circle cx="36" cy="11" r="3"/><rect x="9" y="19" width="6" height="21" rx="2"/><rect x="21" y="19" width="6" height="14" rx="2"/><rect x="33" y="19" width="6" height="18" rx="2"/>'),
    ICON('<path d="M12 8v32"/><circle cx="12" cy="11" r="2.6"/><circle cx="12" cy="25" r="2.6"/><circle cx="12" cy="39" r="2.6" /><path d="M21 11h19M21 25h19M21 39h12"/>')
  ];
  $('#layouts').innerHTML=LAYOUTS.map((l,i)=>'<button type="button" class="lay-opt" aria-pressed="false"><span class="lay-ic">'+ICONS[i]+'</span><b>'+l[0]+'</b><small>'+l[1]+'</small></button>').join('');
  $('#colors').innerHTML=COL.map(c=>'<button type="button" class="dotc" style="background:linear-gradient(135deg,'+c[6]+','+c[7]+')" aria-label="'+c[0]+'" title="'+c[0]+'" aria-pressed="false"></button>').join('');
  $('#sizes').innerHTML=SIZES.map(s=>'<button type="button" aria-pressed="false">'+s[0]+'</button>').join('');
  const swatches=(el,list,key)=>{
    el.innerHTML=list.map(c=>'<button type="button" class="swc" data-c="'+c+'" style="background:'+c+'" aria-label="Color '+c+'" aria-pressed="false"></button>').join('')+'<label class="swc custom" title="Pick any color"><input type="color" aria-label="Custom color"></label>';
    el.querySelectorAll('.swc[data-c]').forEach(b=>b.onclick=()=>{S[key]=b.dataset.c;draw()});
    el.querySelector('input').oninput=e=>{S[key]=e.target.value;draw()};
  };
  swatches($('#fill-sw'),FILLS,'fill');swatches($('#line-sw'),LINES,'line');
  $$('#layouts button').forEach((b,i)=>b.onclick=()=>{S.lay=i;draw()});
  $$('#colors button').forEach((b,i)=>b.onclick=()=>{S.col=i;S.fill=COL[i][8];S.fillOn=true;S.line=COL[i][4];draw()});
  $$('#sizes button').forEach((b,i)=>b.onclick=()=>{S.size=i;draw()});
  $('#clock').onchange=e=>{S.clock=e.target.checked;draw()};
  $('#fill-on').onchange=e=>{S.fillOn=e.target.checked;draw()};
  $('#line-on').onchange=e=>{S.lineOn=e.target.checked;draw()};
  [['fill-op','fillOp','%'],['line-w','lineW',' px'],['p-w','wf','%'],['p-x','px','%'],['p-y','py','%']].forEach(([id,k,u])=>{$('#'+id).oninput=e=>{S[k]=+e.target.value;draw()}});
  $('#p-reset').onclick=()=>{S.wf=100;S.px=50;S.py=18;draw()};

  const draw=()=>{
    $$('#layouts button').forEach((b,i)=>{b.classList.toggle('sel',i===S.lay);b.setAttribute('aria-pressed',i===S.lay)});
    $$('#colors button').forEach((b,i)=>{b.classList.toggle('sel',i===S.col);b.setAttribute('aria-pressed',i===S.col)});
    $$('#sizes button').forEach((b,i)=>{b.classList.toggle('sel',i===S.size);b.setAttribute('aria-pressed',i===S.size)});
    [['fill-sw','fill'],['line-sw','line']].forEach(([id,k])=>{
      $$('#'+id+' .swc[data-c]').forEach(b=>{const on=b.dataset.c.toLowerCase()===String(S[k]).toLowerCase();b.classList.toggle('sel',on);b.setAttribute('aria-pressed',on)});
      const ci=$('#'+id+' input');if(ci&&/^#[0-9a-f]{6}$/i.test(S[k]))ci.value=S[k];
    });
    $('#clock').checked=S.clock;$('#fill-on').checked=S.fillOn;$('#line-on').checked=S.lineOn;
    [['fill-op','fillOp','%'],['line-w','lineW',' px'],['p-w','wf','%'],['p-x','px','%'],['p-y','py','%']].forEach(([id,k,u])=>{$('#'+id).value=S[k];$('#'+id+'-o').textContent=S[k]+u});
    $('#fill-box').classList.toggle('off',!S.fillOn);$('#line-box').classList.toggle('off',!S.lineOn);
    drawList();
    $('#sch-sum').textContent=items.length?items.length+' sessions · '+items.reduce((a,x)=>a+(+x.units||0),0)+' units':'';
    store.set('sch5',items);store.set('sch6s',S);store.set('sbg',bgData);
    if(drawQueued)return;drawQueued=true;
    requestAnimationFrame(()=>{drawQueued=false;renderWall()});
  };

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
    $('#save-note').textContent='Saved as my-class-schedule.jpg. Open it in your photos and set it as your wallpaper.';
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
