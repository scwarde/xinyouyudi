(function (root) {
  'use strict';
  const KEY='xyyd.v3', BACKUP='xyyd.legacy-backup.v1';
  const legacyKeys=['ssScores','ssDaily','ssJournal','ssTrash','ssPracticeFeedback','ssPracticeLogs','ssDoodle','ssDoodleFeedback','ssEmotionLogs','ssSourceLogs','ssTheme','ssChatSession'];
  const listKeys=['moods','holes','trainings','assessments','artworks','favorites','goals','chat','sourceLogs'];
  function uid(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  function day(date){const d=date?new Date(date):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function empty(){return {version:3,moods:[],holes:[],trainings:[],assessments:[],artworks:[],favorites:[],goals:[],chat:[],sourceLogs:[],drafts:{},settings:{dark:false,reduced:false,voice:false},migration:{done:false}};}
  function parse(s,d){try{return JSON.parse(s);}catch(_){return d;}}
  function pssScore(a){if(!Array.isArray(a)||a.length!==10||a.some(v=>!Number.isInteger(v)||v<0||v>4))throw new Error('请完成全部 10 道题。');return a.reduce((sum,v,i)=>sum+([3,4,6,7].includes(i)?4-v:v),0);}
  function makeClock(seconds,now){return {total:seconds,remaining:seconds,running:false,startedAt:null,now:now||(()=>Date.now())};}
  function clockRead(c){return Math.max(0,c.remaining-(c.running?(c.now()-c.startedAt)/1000:0));}
  function clockStart(c){if(!c.running){c.startedAt=c.now();c.running=true;}}
  function clockPause(c){c.remaining=clockRead(c);c.running=false;c.startedAt=null;}
  function migrate(storage){
    const db=empty(),raw={};
    legacyKeys.forEach(k=>{const v=storage.getItem(k);if(v!==null)raw[k]=v;});
    if(Object.keys(raw).length&&!storage.getItem(BACKUP))storage.setItem(BACKUP,JSON.stringify(raw));
    const arr=k=>{const v=parse(raw[k],[]);return Array.isArray(v)?v:[];};
    arr('ssScores').forEach(x=>{if(Number.isFinite(x.score))db.assessments.push({id:uid(),date:x.date||day(),score:x.score,instrument:'legacy',note:'旧版记录，原量尺未标注，仅供回看。'});});
    const daily=parse(raw.ssDaily,{});
    if(daily&&daily.mood)db.moods.push({id:uid(),date:daily.date||day(),emotion:daily.mood,intensity:5,event:'旧版心情',need:'',action:''});
    if(daily&&daily.goal)db.goals.push({id:uid(),date:daily.date||day(),text:'旧版微目标',done:true});
    const journal=parse(raw.ssJournal,raw.ssJournal||'');
    if(typeof journal==='string'&&journal)db.holes.push({id:uid(),date:day(),text:journal,category:'生活',emotion:'说不清',capsule:'',released:false});
    arr('ssTrash').forEach(x=>{if(typeof x.text==='string')db.holes.push({id:uid(),date:x.date||day(),text:x.text,category:x.type||'其他',emotion:x.feel||'说不清',action:x.next||'',control:x.control??null,released:false,capsule:''});});
    arr('ssEmotionLogs').forEach(x=>{if(x.emotion)db.moods.push({id:uid(),date:x.date||day(),emotion:x.emotion,intensity:5,event:'旧版记录'});});
    arr('ssPracticeLogs').forEach(x=>db.trainings.push({id:uid(),date:x.date||day(),name:x.method||'旧版练习',pre:x.pre??null,post:x.post??null,completed:false,seconds:0,legacy:true,note:'旧版没有完成时长，保留记录，不计入完成统计。'}));
    arr('ssPracticeFeedback').forEach(x=>db.trainings.push({id:uid(),date:x.date||day(),name:x.method||'旧版反馈',feel:x.feel||'',completed:false,seconds:0,legacy:true}));
    arr('ssChatSession').forEach(x=>db.chat.push({id:uid(),date:x.date||day(),role:x.type==='user'?'user':'assistant',mode:x.type||'legacy',text:typeof x.text==='string'?x.text:'旧版反馈：'+String(x.feel||x.type||'未标记'),legacy:true}));
    arr('ssSourceLogs').forEach(x=>db.sourceLogs.push({id:uid(),date:x.date||day(),sources:Array.isArray(x.sources)?x.sources.filter(s=>typeof s==='string'):[],legacy:true}));
    const doodle=parse(raw.ssDoodle,raw.ssDoodle||'');
    if(typeof doodle==='string'&&/^data:image\/png;base64,/.test(doodle))db.artworks.push({id:uid(),date:day(),name:'旧版作品',image:doodle,feel:''});
    db.settings.dark=raw.ssTheme==='night'||parse(raw.ssTheme,'')==='night';
    db.migration={done:true,at:new Date().toISOString(),keys:Object.keys(raw)};
    return db;
  }
  function load(storage){const data=parse(storage.getItem(KEY),null);if(data&&data.version===3){const db=Object.assign(empty(),data);listKeys.forEach(k=>{if(!Array.isArray(db[k]))db[k]=[];});db.settings=Object.assign(empty().settings,data.settings);db.drafts=data.drafts||{};return db;}const db=migrate(storage);storage.setItem(KEY,JSON.stringify(db));return db;}
  // Imported files are restricted to this schema. Unknown keys never touch localStorage.
  function validateImport(value){
    if(!value||value.format!=='xyyd-backup'||value.version!==3||!value.data||typeof value.data!=='object')throw new Error('请选择“心有余地”导出的版本 3 JSON 文件。');
    const out=empty();
    listKeys.forEach(k=>{
      const rows=value.data[k]||(k==='sourceLogs'?[]:null);
      if(!Array.isArray(rows)||rows.length>10000)throw new Error('记录数量或结构不正确：'+k);
      out[k]=rows.map(x=>{
        if(k==='favorites'){if(typeof x!=='string'||x.length>100)throw new Error('收藏格式不正确');return x;}
        if(!x||typeof x!=='object'||Array.isArray(x)||typeof x.id!=='string'||x.id.length>100)throw new Error('记录缺少有效标识');
        const allowed=['id','date','emotion','intensity','event','need','action','text','category','capsule','released','control','image','audio','name','feel','training','pre','post','completed','seconds','legacy','note','score','instrument','answers','sources','role','mode','done','features','recipient','aux','session','feedback'];
        const row={};
        Object.entries(x).forEach(([key,v])=>{
          if(!allowed.includes(key)||['__proto__','constructor','prototype'].includes(key))return;
          if(typeof v==='string'){if(v.length>(['image','audio'].includes(key)?1800000:12000))throw new Error('内容过长');row[key]=v;}
          else if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('数字不正确');row[key]=v;}
          else if(typeof v==='boolean'||v===null)row[key]=v;
          else if(['answers','sources','aux'].includes(key)&&Array.isArray(v)&&v.length<=12&&v.every(t=>typeof t==='string'||typeof t==='number'||t===null))row[key]=v;
        });
        if(row.date&&!validDay(row.date))throw new Error('日期格式不正确');
        if(row.capsule&&!validDay(row.capsule))throw new Error('胶囊日期格式不正确');
        if(row.image&&!/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(row.image))throw new Error('图片格式不正确');
        if(row.audio&&!/^data:audio\/(?:webm|ogg|mp4)(?:;codecs=[a-zA-Z0-9.,-]+)?;base64,[a-zA-Z0-9+/=]+$/.test(row.audio))throw new Error('录音格式不正确');
        ['pre','post','intensity','control'].forEach(key=>{if(row[key]!=null&&(!Number.isFinite(row[key])||row[key]<0||row[key]>10))throw new Error('评分范围应为 0–10');});
        if(k==='assessments'&&row.instrument==='PSS-10'){if(pssScore(row.answers)!==row.score)throw new Error('PSS-10 分数与答案不一致');}
        if(k==='trainings'&&row.completed&&(!Number.isFinite(row.seconds)||row.seconds<=0))throw new Error('完成训练缺少有效时长');
        if(k==='moods'&&typeof row.emotion!=='string')throw new Error('心情缺少情绪文字');
        if(k==='holes'&&!row.text&&!row.image&&!row.audio)throw new Error('树洞内容为空');
        if(k==='artworks'&&!row.image)throw new Error('作品缺少图片');
        if(k==='chat'&&(typeof row.text!=='string'||!['user','assistant'].includes(row.role)))throw new Error('对话格式不正确');
        if(row.sources&&row.sources.some(v=>typeof v!=='string'||v.length>100))throw new Error('压力来源格式不正确');
        if(row.aux&&row.aux.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>10)))throw new Error('辅助评分应为 0–10');
        return row;
      });
    });
    const prefs=value.data.settings||{};
    ['dark','reduced','voice'].forEach(k=>out.settings[k]=prefs[k]===true);
    out.settings.welcomed=prefs.welcomed===true;
    out.drafts=validateDrafts(value.data.drafts||{});
    out.migration={done:true};
    return out;
  }
  function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00Z').getTime())&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
  function validateDrafts(d){const out={};['mood','hole','pss','doodle'].forEach(k=>{if(!d[k])return;if(typeof d[k]!=='object'||Array.isArray(d[k]))throw new Error('草稿结构不正确');out[k]={};Object.entries(d[k]).forEach(([name,v])=>{if(!['text','category','recipient','emotion','intensity','event','need','action','control','capsule','image','audio','answers','sources','name','feel','index'].includes(name))return;if(typeof v==='string'){if(v.length>(['image','audio'].includes(name)?1800000:12000))throw new Error('草稿过大');if(name==='image'&&v&&!/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v))throw new Error('草稿图片格式不正确');if(name==='audio'&&v&&!/^data:audio\/(?:webm|ogg|mp4)(?:;codecs=[a-zA-Z0-9.,-]+)?;base64,[a-zA-Z0-9+/=]+$/.test(v))throw new Error('草稿录音格式不正确');if(name==='capsule'&&v&&!validDay(v))throw new Error('草稿日期不正确');out[k][name]=v;}else if(typeof v==='number'&&Number.isFinite(v)){if(['intensity','control'].includes(name)&&(v<0||v>10))throw new Error('草稿评分越界');out[k][name]=v;}else if(name==='answers'&&Array.isArray(v)&&v.length===10&&v.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<=4))out[k][name]=v;else if(name==='sources'&&Array.isArray(v)&&v.every(s=>typeof s==='string'&&s.length<100))out[k][name]=v;});});return out;}
  function merge(db,incoming){const next=Object.assign(empty(),db);listKeys.forEach(k=>{const map=new Map();(db[k]||[]).concat(incoming[k]||[]).forEach(x=>map.set(k==='favorites'?x:x.id,x));next[k]=[...map.values()];});next.drafts=Object.assign({},incoming.drafts,db.drafts);return next;}
  function backup(db,storage){return {format:'xyyd-backup',version:3,exportedAt:new Date().toISOString(),data:db,legacyOriginal:parse(storage.getItem(BACKUP),{})};}
  function localDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')?new Date(s+'T00:00:00'):new Date(s);}
  function recent(rows,days=7,now=new Date()){const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);return rows.filter(x=>localDate(x.date)>=start&&localDate(x.date)<=now);}
  function formatTime(seconds){const s=Math.max(0,Math.ceil(seconds));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  function weekStart(now=new Date()){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
  function unlocked(x,now=day()){return !x.capsule||x.capsule<=now;}
  const api={KEY,BACKUP,legacyKeys,listKeys,uid,day,empty,parse,pssScore,makeClock,clockRead,clockStart,clockPause,migrate,load,validateImport,validateDrafts,validDay,merge,backup,recent,localDate,formatTime,weekStart,unlocked};
  root.XYCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
