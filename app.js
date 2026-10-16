(function(){
  'use strict';
  const C=window.XYCore,D=window.XYData,$=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db,storageAvailable=true;
  try{db=C.load(localStorage);}catch(e){db=C.empty();storageAvailable=false;}
  const state={route:'home',param:'',train:null,trainTick:null,audio:null,game:null,gameTick:null,canvas:null,confirm:null,chatMode:'listen',chatAlternative:0,chatLastUser:'',toolSearch:'',toolTag:'all',holeSearch:'',holeCategory:'all',holeWeek:false,recordTab:'moods',importData:null,pssIndex:0,pssResult:null,installPrompt:null};
  const view=$('#view'),notice=$('#notice');
  function toast(text){notice.textContent=text;notice.classList.add('show');clearTimeout(state.noticeTimer);state.noticeTimer=setTimeout(()=>notice.classList.remove('show'),4500);}
  function persist(){try{localStorage.setItem(C.KEY,JSON.stringify(db));storageAvailable=true;return true;}catch(e){toast('这次记录暂未写入设备，可能是空间不足。请先导出备份。');return false;}}
  function applySettings(){document.body.classList.toggle('dark',db.settings.dark);document.body.classList.toggle('reduced',db.settings.reduced);$('.icon-button').setAttribute('aria-pressed',String(db.settings.dark));}
  function href(route,param){return '#'+route+(param?'/'+param:'');}
  function go(route,param){const h=href(route,param);if(location.hash===h)routeChange();else location.hash=h;}
  const head=(title,sub,back)=>'<div class="page-head">'+(back?'<a href="'+esc(back)+'">返回</a>':'')+'<h1>'+title+'</h1><p>'+sub+'</p></div>';
  const button=(text,action,value,cls)=>'<button type="button" data-action="'+action+'"'+(value?' data-value="'+esc(value)+'"':'')+' class="'+(cls||'')+'">'+text+'</button>';
  const empty=text=>'<p class="empty">'+text+'</p>';
  const dateLabel=s=>esc(s?.slice(0,10)||'未标日期');
  function addRow(list,row){const entry=Object.assign({id:C.uid(),date:C.day()},row);db[list].push(entry);if(persist())return true;db[list]=db[list].filter(x=>x!==entry);return false;}
  function favorite(id){return db.favorites.includes(id);}
  function favButton(id){return button(favorite(id)?'★ 已收藏':'☆ 收藏','favorite',id,'secondary');}
  const scoreInput=(name,label,optional)=>'<fieldset><legend>'+label+(optional?'（可跳过）':'')+'</legend><small>0 = 几乎没有压力，10 = 非常强烈</small><div class="score-choices">'+Array.from({length:11},(_,i)=>'<label><input type="radio" name="'+name+'" value="'+i+'"'+(optional?'':' required')+'><span>'+i+'</span></label>').join('')+'</div></fieldset>';
  function formValue(form,name){return new FormData(form).get(name);}
  const numOrNull=v=>v===null||v===''?null:Number(v);
  function checkComplete(form){if(!form.reportValidity())return false;return true;}
  function confirmAction(title,text,action){state.confirm=action;$('#confirmTitle').textContent=title;$('#confirmText').textContent=text;$('#confirmDialog').showModal();}
  function closeConfirm(){state.confirm=null;$('#confirmDialog').close();}
  function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
  function speak(text){if(!db.settings.voice)return;if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return;const voices=window.speechSynthesis.getVoices();if(!voices.some(v=>/^zh/i.test(v.lang)))return;stopSpeech();const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.8;u.voice=voices.find(v=>/^zh/i.test(v.lang));window.speechSynthesis.speak(u);}
  function voiceStatus(){if(!('speechSynthesis'in window))return '浏览器不支持语音，使用文字带练。';return window.speechSynthesis.getVoices().some(v=>/^zh/i.test(v.lang))?'可选浏览器中文语音朗读（合成语音）。':'未检测到中文声音，当前使用文字带练。';}
  function disposeRoute(){
    stopRecording();
    clearInterval(state.trainTick);state.trainTick=null;stopSpeech();stopSound();
    clearInterval(state.gameTick);state.gameTick=null;
    if(state.train&&state.train.clock.running)C.clockPause(state.train.clock);
    if(state.game&&state.game.running)state.game.running=false;
    state.canvas=null;
  }
  const mainRoute=r=>['home','calm','mood','tools','me'].includes(r)?r:(r==='scenario'?'calm':['chat','assessment','article'].includes(r)?'home':['hole'].includes(r)?'mood':['training','sounds','doodle','attention','bubbles'].includes(r)?'tools':'me');
  function routeChange(){
    disposeRoute();
    const parts=location.hash.slice(1).split('/');state.route=parts[0]||'home';state.param=parts[1]||'';
    if(!pages[state.route])state.route='home';
    render();
    document.querySelectorAll('#nav a').forEach(a=>{const active=a.hash==='#'+mainRoute(state.route);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    window.scrollTo(0,0);view.focus({preventScroll:true});
  }
  function render(){view.innerHTML=pages[state.route]();if(state.route==='training'&&state.train?.stage==='active')startTrainingTick();if(state.route==='doodle')setupCanvas();if(state.route==='chat'){renderChatAdjust();scrollChat();}applySettings();}
  const plant='<svg class="home-art" viewBox="0 0 300 160" aria-hidden="true"><path d="M35 144 Q140 130 265 144" fill="none" stroke="#becbbd" stroke-width="2"/><path d="M151 139 Q139 89 164 28 M149 104 Q113 85 101 56 M153 82 Q187 69 201 42" fill="none" stroke="#799c83" stroke-width="3"/><path d="M162 63 Q128 17 170 12 Q185 36 162 63 M141 106 Q95 108 89 72 Q123 61 141 106 M155 88 Q206 87 220 53 Q189 39 155 88" fill="#a9c5ac"/><circle cx="73" cy="37" r="12" fill="#eed8b8"/><path d="M125 136h51l-7 21h-37z" fill="#d4dfd0"/></svg>';
  const capy='<svg width="106" height="90" viewBox="0 0 140 110" role="img" aria-label="原创卡皮巴拉站长"><path d="M20 90V52Q20 22 57 20h28q38 0 38 38v32z" fill="#c2a887"/><circle cx="36" cy="26" r="12" fill="#c2a887"/><circle cx="100" cy="25" r="12" fill="#c2a887"/><path d="M61 56q16-12 37 0v23H61z" fill="#d9c4a6"/><path d="M43 48h4m42-1h4m-24 22h9" stroke="#4b473d" stroke-width="4" stroke-linecap="round"/><path d="M39 17q35-19 66 0" fill="#72947c"/><path d="M76 7v-6" stroke="#72947c" stroke-width="4"/></svg>';
  function homePage(){
    const hour=new Date().getHours(),greet=hour<11?'早上好':hour<17?'下午好':'晚上好';
    const today=db.moods.filter(x=>x.date===C.day()).at(-1);
    return head(greet+'，给自己留一点余地。','不用先想清楚。选一个此刻最需要的入口就好。')+
      (db.settings.welcomed?'':'<div class="welcome"><strong>第一次来？</strong><p>稳住当下选 3 分钟练习，了解近一月压力选自测。</p>'+button('知道了','welcome',null,'secondary')+'</div>')+
      '<section class="card"><div class="row between"><h2>此刻心情</h2><small>'+(today?'今天已记下：'+esc(today.emotion):'点一个接近的词')+'</small></div><div class="mood-strip">'+D.emotions.slice(0,8).map(x=>button(x[0]+' '+x[1],'quick-mood',x[1],'mood-chip')).join('')+'</div></section>'+
      '<div class="two-col"><div><div class="entry-grid"><a class="entry mint" href="#assessment"><span class="symbol">◎</span><strong>认识压力</strong><small>PSS-10 · 约 2–3 分钟</small></a><a class="entry peach" href="#hole"><span class="symbol">❧</span><strong>写进树洞</strong><small>只写一句，也可以 · 1 分钟</small></a><a class="entry blue" href="#calm"><span class="symbol">◌</span><strong>当下安定</strong><small>先稳住此刻 · 3 分钟</small></a><a class="entry lilac" href="#sounds"><span class="symbol">♫</span><strong>听一会儿自然</strong><small>合成声景 · 不需要思考</small></a></div><section class="card companion"><span class="emoji" aria-hidden="true">☁</span><div><h2>有些话，可以慢慢说。</h2><p class="muted">本地引导陪伴：倾听、理清，或一起找下一步。</p><a class="button secondary" href="#chat">开始说说</a></div></section></div>'+
      '<section class="card mint">'+plant+'<span class="eyebrow">给现在的自己</span><h2>3 分钟，回到身体</h2><p>先感受支撑，再做几次舒服的呼吸。无需准备，也不必做得完美。</p><a class="button" href="#training/breath">开始 3 分钟练习</a><p><small>可以随时暂停、结束或改用文字提示。</small></p></section></div>'+
      '<section><div class="row between"><h2>读一点，再试一点</h2><small>原创短文 · 每篇约 1 分钟</small></div><div class="article-list">'+D.articles.map(a=>'<a class="article-link '+a.color+'" href="#article/'+a.id+'"><small>余地小读</small><h3>'+a.title+'</h3><small>附一个可执行练习</small></a>').join('')+'</div></section>';
  }
  function calmPage(){
    return head('先稳住这一刻','不用现在解决全部问题。请选择一个入口，任何时候都可以停下来。')+
      '<div class="two-col"><section class="card peach"><h2>我现在很难受</h2><p>双脚接触地面，看看周围。你可以先做一个不要求屏息的安定练习。</p><a class="button" href="#training/ground">开始 3 分钟安定</a><p><a href="#evidence">如果需要现实支持，看看求助建议</a></p></section><section class="card mint"><h2>从一件现实小事开始</h2><p>坐到有支撑的地方、喝几口水，或找一个可信任的人陪一会儿。这里不判断你的处境是否安全。</p></section></div><h2>此刻，哪一种情境更接近你？</h2><div class="equal-col">'+D.scenarios.map(s=>'<article class="card"><h3>'+s.icon+' '+s.name+'</h3><p class="muted">三步锦囊 · 约 3 分钟带练</p><a class="button secondary" href="#scenario/'+s.id+'">打开锦囊</a></article>').join('')+'</div>';
  }
  function scenarioPage(){const s=D.scenarios.find(x=>x.id===state.param)||D.scenarios[0];return head(s.icon+' '+s.name,'不着急，从第一步开始。','#calm')+'<section class="card article-body"><ol>'+s.steps.map(x=>'<li><p>'+x+'</p></li>').join('')+'</ol><div class="feedback-box"><strong>练习后的小行动</strong><p>'+s.action+'</p></div><div class="row"><a class="button" href="#training/'+s.training+'">开始 3 分钟带练</a>'+favButton('scenario:'+s.id)+'</div></section>';}
  function moodPage(){
    const draft=db.drafts.mood||{},emo=draft.emotion||'';
    return head('给今天的感觉，一个位置','每一种感受都可以被记录。不确定时，“说不清”也很好。')+
      '<div class="two-col"><section class="card"><form id="moodForm"><fieldset><legend>现在更接近哪种感觉？</legend><div class="mood-strip">'+D.emotions.map(x=>'<label class="inline-label mood-chip"><input type="radio" name="emotion" value="'+x[1]+'" '+(emo===x[1]?'checked':'')+' required>'+x[0]+' '+x[1]+'</label>').join('')+'</div></fieldset><label for="moodIntensity">感觉强度：<output id="moodIntensityValue">'+(draft.intensity??5)+'</output>/10</label><input id="moodIntensity" name="intensity" type="range" min="0" max="10" value="'+(draft.intensity??5)+'"><p class="muted">0 = 很轻，10 = 很强</p><label for="moodEvent">发生了什么？（可选）</label><textarea id="moodEvent" name="event" maxlength="2000" placeholder="可以是一件很小的事。">'+esc(draft.event)+'</textarea><label for="moodNeed">此刻我需要什么？（可选）</label><input id="moodNeed" name="need" maxlength="300" value="'+esc(draft.need)+'" placeholder="安静、陪伴、休息，或暂时不知道"><label for="moodAction">下一步最小行动（可选）</label><input id="moodAction" name="action" maxlength="300" value="'+esc(draft.action)+'" placeholder="例如：喝水，离开屏幕两分钟"><div class="row"><button type="submit">保存这份心情</button><a href="#me">回看记录</a></div><small>输入会在这台设备上自动存为草稿。</small></form></section><aside><section class="card peach"><div class="companion">'+capy+'<div><h2>先交给站长</h2><p>事情不必马上解决，也可以先把它写出来。</p></div></div><a class="button secondary" href="#hole">进入情绪树洞</a></section><section class="card blue"><h2>留一点松动的空间</h2><p>你可以保留记录，也可以选择释放。释放只是一个仪式，不要求你忘掉发生过的事。</p><a href="#training/kindness">试试 3 分钟自我关怀</a></section></aside></div>';
  }
  function holeCard(x){
    const locked=!C.unlocked(x);
    return '<article class="record" data-record-id="'+esc(x.id)+'"><div class="row between"><span class="pill">'+esc(x.category||'生活')+' · '+esc(x.emotion||'说不清')+' · 写给'+esc(x.recipient||'此刻的我')+'</span><small>'+dateLabel(x.date)+'</small></div>'+(locked?'<p>🔒 时间胶囊 · '+esc(x.capsule)+' 后在此设备解锁</p>':'<p>'+esc(x.text)+'</p>'+(x.image?'<img class="record-img" src="'+esc(x.image)+'" alt="记录中附带的本地图片">':'')+(x.audio?'<audio controls src="'+esc(x.audio)+'" aria-label="本地树洞录音"></audio>':'')+(x.control!=null?'<small>可控程度 '+x.control+'/10</small>':'')+(x.action?'<p>下一小步：'+esc(x.action)+'</p>':''))+'<div class="row">'+(x.released?'<span class="pill">已释放 · 内容仍可回看</span>':button('轻轻释放','release',x.id,'secondary'))+button('删除','delete','holes:'+x.id,'ghost')+'</div></article>';
  }
  function holeList(){const rows=db.holes.filter(x=>(!state.holeSearch||[x.text,x.emotion,x.category].join(' ').includes(state.holeSearch))&&(state.holeCategory==='all'||x.category===state.holeCategory)&&(!state.holeWeek||new Date(x.date+'T00:00:00')>=C.weekStart())).slice().reverse();return rows.length?rows.map(holeCard).join(''):empty('这里还没有符合条件的记录。写下一句想交出来的话就好。');}
  function holePage(){const x=db.drafts.hole||{};return head('情绪树洞','由卡皮巴拉站长替你保管一会儿，文字和图片只留在本地。','#mood')+
    '<div class="two-col"><section class="card peach"><div class="companion">'+capy+'<div><h2>今天想交出什么？</h2><p class="muted">可以不完整，也可以说不清。</p></div></div><form id="holeForm"><label>写给谁（仅本地，不发送）<select name="recipient">'+['此刻的我','未来的我','想说话的人'].map(r=>'<option '+(x.recipient===r?'selected':'')+'>'+r+'</option>').join('')+'</select></label><label for="holeText">想写的话</label><textarea id="holeText" name="text" maxlength="4000" placeholder="把一件不想继续扛着的事写下来……">'+esc(x.text)+'</textarea><div class="form-grid"><label>分类<select name="category">'+D.categories.map(c=>'<option '+(x.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label><label>感觉<select name="emotion">'+D.emotions.map(e=>'<option value="'+e[1]+'" '+(x.emotion===e[1]?'selected':'')+'>'+e[0]+' '+e[1]+'</option>').join('')+'</select></label></div><label for="holeControl">这件事我能影响多少？<output id="holeControlValue">'+(x.control??5)+'</output>/10</label><input type="range" id="holeControl" name="control" min="0" max="10" value="'+(x.control??5)+'"><label>下一步最小行动（可选）<input name="action" maxlength="300" value="'+esc(x.action)+'" placeholder="先做一个 5 分钟以内的小动作"></label><label>时间胶囊（可选）<input name="capsule" type="date" min="'+C.day()+'" value="'+esc(x.capsule)+'"></label><small>指定日期后在本地“我的”解锁；没有服务器定时通知，也不是加密保险箱。</small><label>附一张图片（可选，最多 1 MB）<input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label><div id="holeImageState" class="muted">'+(x.image?'草稿中已有图片。':'')+'</div>'+recordingControls(x)+'<button type="submit">交给站长保管</button><p><small>草稿自动保存；不向其他人发送。</small></p></form></section><section class="card"><h2>我的树洞卡片</h2><div class="filter-row"><input id="holeSearch" type="search" aria-label="搜索树洞" placeholder="搜索关键词" value="'+esc(state.holeSearch)+'"><select id="holeCategory" aria-label="筛选树洞分类"><option value="all">全部分类</option>'+D.categories.map(c=>'<option '+(state.holeCategory===c?'selected':'')+'>'+c+'</option>').join('')+'</select><label class="inline-label"><input id="holeWeek" type="checkbox" '+(state.holeWeek?'checked':'')+'>只看本周</label></div><div id="holeList">'+holeList()+'</div></section></div>';}
  function toolsList(){const rows=D.trainings.filter(t=>(!state.toolSearch||[t.name,t.desc,t.tag].join('').includes(state.toolSearch))&&(state.toolTag==='all'||t.tag===state.toolTag));return rows.length?rows.map(t=>'<article class="card"><span class="tool-icon">'+t.icon+'</span><p class="pill">'+t.tag+'</p><h3>'+t.name+'</h3><p class="muted">'+t.desc+'</p><div class="row"><a class="button secondary" href="#training/'+t.id+'">开始练习</a>'+favButton('training:'+t.id)+'</div></article>').join(''):empty('没有找到。换一个词，或查看全部练习。');}
  function toolsPage(){return head('练习工具','每次 3、5 或 10 分钟。选择此刻愿意尝试的一种。')+'<div class="filter-row"><input id="toolSearch" type="search" aria-label="搜索训练库" placeholder="搜索呼吸、身体、正念……" value="'+esc(state.toolSearch)+'"><select id="toolTag" aria-label="练习类别"><option value="all">全部类型</option>'+[...new Set(D.trainings.map(t=>t.tag))].map(t=>'<option '+(t===state.toolTag?'selected':'')+'>'+t+'</option>').join('')+'</select></div><div id="toolsList" class="library-grid">'+toolsList()+'</div><h2>换一种轻一点的方式</h2><div class="entry-grid"><a class="entry blue" href="#sounds"><strong>♫ 合成自然声景</strong><small>雨、海浪、溪流、风、森林 · 定时与循环</small></a><a class="entry lilac" href="#doodle"><strong>✎ 自由涂鸦</strong><small>颜色、橡皮、撤销 · 作品留在本地</small></a><a class="entry peach" href="#attention"><strong>❧ 停一拍</strong><small>30 秒注意力小游戏 · 点叶子、遇云暂停</small></a><a class="entry mint" href="#bubbles"><strong>◉ 捏泡泡</strong><small>不计时、不排名 · 按自己的节奏</small></a></div>';}
  function currentTraining(){return D.trainings.find(t=>t.id===state.param)||D.trainings[0];}
  function ensureSession(){const t=currentTraining();if(!state.train||state.train.id!==t.id){state.train={id:t.id,stage:'setup',clock:C.makeClock(180),pre:null,post:null,breath:'natural',saved:false,action:'',spokenStep:-1};}return state.train;}
  function trainingPage(){const t=currentTraining(),s=ensureSession();
    let body='';
    if(s.stage==='setup')body='<form id="trainingSetup"><label>练习时长<select name="minutes"><option value="3">3 分钟</option><option value="5">5 分钟</option><option value="10">10 分钟</option></select></label>'+scoreInput('pre','此刻的压力大约几分？',true)+(t.id==='breath'?'<label>呼吸方式<select name="breath"><option value="natural">舒适节奏：吸气约 4 秒，呼气约 6 秒</option><option value="free">自然呼吸：不用追随秒数</option><option value="478">可选 4–7–8：含屏息，不舒服就换自然呼吸</option></select></label>':'')+'<label class="inline-label"><input type="checkbox" name="tone">阶段变化时播放轻柔节拍</label><p class="muted">'+voiceStatus()+'</p><label class="inline-label"><input id="trainingVoice" type="checkbox" '+(db.settings.voice?'checked':'')+'>使用可用的浏览器中文朗读</label><p><small>眼睛可睁开。不舒服时暂停或结束，不需要坚持。</small></p><button type="submit">准备好了，开始带练</button></form>';
    else if(s.stage==='active')body='<div class="trainer"><div class="timer" id="trainingTimer">03:00</div><p id="trainingPhase" aria-live="polite"></p>'+(t.id==='breath'?'<div class="orb" id="breathingOrb" aria-hidden="true">自然呼吸</div>':'<div class="tool-icon" aria-hidden="true">'+t.icon+'</div>')+'<p class="cue" id="trainingCue" role="status" aria-live="polite"></p><div class="step-list" id="trainingSteps"></div><progress id="trainingProgress" max="1" value="0" aria-label="练习进度"></progress><div class="row" style="justify-content:center">'+button(s.clock.running?'暂停':'继续','train-toggle',null,'secondary')+button('提前结束','train-end',null,'ghost')+'</div><label class="inline-label"><input id="trainingVoice" type="checkbox" '+(db.settings.voice?'checked':'')+'>中文语音提示</label><small>切换页面会暂停，返回后可继续。'+voiceStatus()+'</small></div>';
    else body='<form id="trainingPost"><p class="pill">'+(s.complete?'✓ 已走完练习':'已提前结束 · 不计为完成')+'</p><h2>现在感觉有变轻一点吗？</h2>'+scoreInput('post','再看看此刻的压力',true)+'<label>我的感觉<select name="feel"><option value="">请选择 / 暂不记录</option><option>有一点变轻</option><option>明显变轻</option><option>暂时没变化</option><option>更不舒服了，想休息或求助</option></select></label><label>接下来的一小步<input name="action" maxlength="300" placeholder="喝几口水、离开屏幕，或找人陪一会儿" value="'+esc(s.action)+'"></label><p class="muted">这次练习不需要达到某个分数。即时评分与 PSS-10 是不同记录。</p><button type="submit">记下这次练习</button></form>';
    return '<div class="training-layout">'+head(t.icon+' '+t.name,t.desc,'#tools')+'<section class="card">'+body+'</section>'+((s.stage==='active')?'<details class="card"><summary>查看全部步骤</summary><ol>'+t.steps.map(x=>'<li>'+x+'</li>').join('')+'</ol></details>':'')+'</div>';
  }
  function updateTraining(){
    const s=state.train;if(!s||s.stage!=='active')return;
    const t=D.trainings.find(t=>t.id===s.id),left=C.clockRead(s.clock),elapsed=s.clock.total-left,step=Math.min(t.steps.length-1,Math.floor(elapsed/(s.clock.total/t.steps.length)));
    if(!$('#trainingTimer'))return;
    $('#trainingTimer').textContent=C.formatTime(left);
    $('#trainingPhase').textContent='步骤 '+(step+1)+' / '+t.steps.length;
    $('#trainingCue').textContent=t.steps[step];$('#trainingProgress').value=elapsed/s.clock.total;
    $('#trainingSteps').innerHTML=t.steps.map((_,i)=>'<span class="'+(i===step?'active':'')+'"></span>').join('');
    if(s.clock.running&&s.spokenStep!==step){s.spokenStep=step;speak(t.steps[step]);if(s.tone&&t.id!=='breath')beep();}
    const orb=$('#breathingOrb');
    if(orb){const cycle=s.breath==='478'?19:10,p=elapsed%cycle;let cue='自然呼吸',cl='';if(s.breath!=='free'){cue=p<4?'轻轻吸气':(s.breath==='478'&&p<11?'舒适停留':'慢慢呼气');cl=p<4?'in':cue==='舒适停留'?'in':'out';}orb.style.transitionDuration=(cue==='轻轻吸气'?4:cue==='舒适停留'?7:s.breath==='478'?8:6)+'s';orb.className='orb '+cl;orb.textContent=cue;if(s.clock.running&&s.tone&&cue!==s.lastBreathCue){s.lastBreathCue=cue;beep();}}
    if(left<=0){finishTraining(true);}
  }
  function startTrainingTick(){clearInterval(state.trainTick);updateTraining();if(state.train?.stage==='active')state.trainTick=setInterval(updateTraining,200);}
  function finishTraining(complete){const s=state.train;C.clockPause(s.clock);s.complete=complete;s.stage='post';clearInterval(state.trainTick);stopSpeech();render();}
  function soundsPage(){return head('让自然，在这里停一会儿','以下为浏览器实时合成声景，并非真实环境录音。','#tools')+'<section class="card"><div class="mood-strip">'+[['rain','🌧 雨'],['ocean','🌊 海浪'],['stream','💧 溪流'],['wind','🍃 风'],['forest','🌲 森林']].map(x=>button(x[1],'sound-start',x[0],'mood-chip')).join('')+'</div><div class="feedback-box" style="margin-top:20px"><p id="soundStatus" role="status">请选择一种声景。首次播放需点击按钮。</p><label for="soundVolume">音量</label><input id="soundVolume" type="range" min="0" max=".4" step=".01" value=".12"><div class="row"><label>睡眠定时<select id="soundSleep"><option value="5">5 分钟</option><option value="10">10 分钟</option><option value="20">20 分钟</option><option value="30">30 分钟</option></select></label><label class="inline-label"><input id="soundLoop" type="checkbox" checked>循环声景</label>'+button('暂停 / 继续','sound-toggle',null,'secondary')+button('停止','sound-stop',null,'ghost')+'</div><small>切换页面后自动停止，避免叠加。关闭循环后本段约 1 分钟结束。</small></div></section>';}
  let soundRequest=0;
  function stopSound(){soundRequest++;const a=state.audio;if(!a)return;clearTimeout(a.timeout);clearTimeout(a.segment);a.nodes.forEach(n=>{try{n.stop?.();n.disconnect();}catch(_){}});a.ctx.close().catch(()=>{});state.audio=null;}
  async function startSound(kind){
    stopSound();
    const request=++soundRequest;let ctx=null;
    try{
      const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error('当前浏览器不支持合成声景。');
      ctx=new A();const a={ctx,nodes:[],kind,paused:false};state.audio=a;
      await ctx.resume();if(request!==soundRequest||state.route!=='sounds'){ctx.close().catch(()=>{});return;}
      const gain=ctx.createGain();gain.gain.value=Number($('#soundVolume').value);gain.connect(ctx.destination);a.gain=gain;a.nodes.push(gain);
      const buf=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=buf.getChannelData(0);let smooth=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;smooth=(smooth+white*.025)/1.025;data[i]=kind==='rain'?white*.45:smooth*4;}
      const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
      const filter=ctx.createBiquadFilter();filter.type=kind==='rain'?'highpass':kind==='stream'?'bandpass':'lowpass';filter.frequency.value={rain:850,ocean:380,stream:1100,wind:650,forest:450}[kind];filter.Q.value=.5;src.connect(filter);filter.connect(gain);src.start();a.nodes.push(src,filter);
      const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value={rain:.14,ocean:.12,stream:1.7,wind:.07,forest:.23}[kind];depth.gain.value=kind==='ocean'?.065:.025;lfo.connect(depth);depth.connect(gain.gain);lfo.start();a.nodes.push(lfo,depth);
      if(kind==='forest'||kind==='stream'){const bird=ctx.createOscillator(),birdGain=ctx.createGain(),warble=ctx.createOscillator(),mod=ctx.createGain();bird.type='sine';bird.frequency.value=kind==='forest'?2100:1250;birdGain.gain.value=.012;warble.frequency.value=kind==='forest'?3.2:5.5;mod.gain.value=300;warble.connect(mod);mod.connect(bird.frequency);bird.connect(birdGain);birdGain.connect(gain);bird.start();warble.start();a.nodes.push(bird,birdGain,warble,mod);}
      resetSoundTimeout();
      $('#soundStatus').textContent='♫ '+{rain:'雨',ocean:'海浪',stream:'溪流',wind:'风',forest:'森林'}[kind]+' · 合成声景播放中';
      document.querySelectorAll('[data-action="sound-start"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===kind)));
    }catch(e){if(request===soundRequest){stopSound();toast(e.message||'声音不可用，可以使用文字练习。');}else if(ctx)ctx.close().catch(()=>{});}
  }
  function resetSoundTimeout(){const a=state.audio;if(!a)return;clearTimeout(a.timeout);clearTimeout(a.segment);a.timeout=setTimeout(()=>{stopSound();if($('#soundStatus'))$('#soundStatus').textContent='睡眠定时已到，声音停止。';},Number($('#soundSleep')?.value||5)*60000);if(!$('#soundLoop')?.checked)a.segment=setTimeout(()=>{stopSound();if($('#soundStatus'))$('#soundStatus').textContent='这一段声景已结束。';},60000);}
  function assessmentPage(){
    if(state.pssResult){const r=state.pssResult;return head('把结果当作一个线索','认识过去一个月，再照顾此刻。','#home')+'<section class="card"><p>PSS-10 感知压力总分</p><p class="big-score">'+r.score+'<small> / 40</small></p><p>分数反映你对过去一个月压力的感受，不是诊断，也没有本产品设定的低、中、高诊断界限。</p><p>主要来源：'+(r.sources.length?r.sources.map(esc).join('、'):'未选择')+'</p>'+(r.aux?'<h3>此刻辅助觉察 · 非标准分量表</h3><div class="result-metrics">'+['身体紧张','担忧','自我要求','生活负荷'].map((n,i)=>'<div><strong>'+(r.aux[i]??'—')+'</strong><small>'+n+' / 10</small></div>').join('')+'</div>':'')+'<div class="feedback-box"><h2>现在推荐你做什么？</h2><p>先做 3 分钟轻柔呼吸，看看此刻的身体感受。无需追求分数马上下降。</p><a class="button" href="#training/breath">进入 3 分钟带练</a></div><p><a href="#me">结果已经保存在“我的”</a> · <a href="#evidence">计分与用途</a></p>'+button('重新填写','pss-restart',null,'ghost')+'</section>';}
    const draft=db.drafts.pss||{answers:Array(10).fill(null),sources:[]},i=state.pssIndex;
    if(i===10)return head('还有一点背景（可跳过）','这些信息只用于记录与推荐，不参与 PSS-10 计分。','#home')+'<section class="card"><form id="pssSources"><fieldset><legend>最近主要压力来自哪里？</legend><div class="mood-strip">'+D.sources.map(s=>'<label class="inline-label mood-chip"><input type="checkbox" name="sources" value="'+s+'" '+(draft.sources?.includes(s)?'checked':'')+'>'+s+'</label>').join('')+'</div></fieldset><h2>此刻辅助觉察（可选）</h2><p class="muted">以下为产品自定义的独立问题，不是 PSS-10 分量表，也不计算合成分数。</p>'+['身体紧张','担忧','自我要求','生活负荷'].map((s,i)=>'<label>'+s+'<select name="aux'+i+'"><option value="">暂不填写</option>'+Array.from({length:11},(_,n)=>'<option value="'+n+'">'+n+'/10</option>').join('')+'</select></label>').join('')+'<div class="row">'+button('上一步','pss-prev',null,'secondary')+'<button type="submit">查看结果</button></div></form></section>';
    return head('PSS-10 压力觉察','回想过去一个月。约 2–3 分钟，稍后也能继续。','#home')+'<section class="card article-body"><div class="row between"><span class="pill">第 '+(i+1)+' / 10 题</span><a href="#evidence">来源与用途</a></div><progress value="'+i+'" max="10" aria-label="问卷完成进度"></progress><form id="pssQuestion"><h2>在过去一个月里，你有多频繁'+D.pss[i]+'</h2><div class="option-stack">'+['从不','几乎从不','有时','相当经常','非常经常'].map((x,n)=>'<label><input required type="radio" name="answer" value="'+n+'" '+(draft.answers[i]===n?'checked':'')+'>'+n+' · '+x+'</label>').join('')+'</div><div class="row" style="margin-top:20px">'+(i?button('上一步','pss-prev',null,'secondary'):'')+'<button type="submit">下一题</button>'+button('稍后完成','pss-later',null,'ghost')+'</div></form><p class="muted">计分、译文与使用权限见“来源与用途”。</p></section>';
  }
  function articlePage(){const a=D.articles.find(x=>x.id===state.param)||D.articles[0];return '<div class="article-body">'+head(a.title,'余地小读 · 原创文字 · 约 1 分钟','#home')+'<article class="card">'+a.body.map(p=>'<p>'+p+'</p>').join('')+'<section class="feedback-box"><h2>读完，试一个小动作</h2><p>'+a.exercise+'</p><a class="button secondary" href="#mood">写下我的一句话</a></section><p><a href="'+a.source+'" target="_blank" rel="noopener">原理参考：WHO 压力管理指南</a></p><small>本文为原创科普，不是指南逐字翻译，也未对本产品效果作疗效承诺。</small><div class="row">'+favButton('article:'+a.id)+'</div></article></div>';}
  function evidencePage(){return head('证据与安全','用清楚的边界，给体验留一点信任。','#me')+'<section class="card article-body"><h2>PSS-10 是什么？</h2><p>感知压力量表用于了解过去一个月的主观压力。每题 0–4 分，第 4、5、7、8 题反向计分后求和，总分 0–40。它不是诊断工具，没有固定诊断切点。即时 0–10 分用于前后体验记录，不替代 PSS-10。</p><p>身体紧张、担忧、自我要求、生活负荷是单独的产品辅助觉察问题，不属于标准分量表。</p><p><a target="_blank" rel="noopener" href="https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html">Cohen 研究团队：量表、计分与使用权限</a></p><p>本地中文展示按原始题意编写，未声称具备标准化中文译本的信效度。正式参赛、研究或推广前，应确认量表与译文使用许可并请专业人员审阅。</p><p><a target="_blank" rel="noopener" href="https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/">NHS：舒适、自然、不强迫的呼吸练习</a></p><h2>练习训练什么？</h2><p>感官安定帮助注意当前环境；正念练习注意与返回；想法解离练习与想法留出距离；问题拆分帮助选择可执行的行动。效果因人而异。出现不适可以暂停，不强制闭眼、深呼吸或屏息。</p><p><a target="_blank" rel="noopener" href="https://www.who.int/publications/i/item/9789240003927">原理参考：WHO《Doing What Matters in Times of Stress》</a></p><h2>本地数据与局限</h2><p>无需注册，不向外部 API 发送记录。内容存在浏览器 localStorage；清浏览器数据、换设备或移动 file 路径可能使记录不可见。不是加密保管箱。导入前验证格式，默认合并；旧版原始记录保留备份。全部删除会清除此产品新旧记录，请先导出。</p><h2>需要现实支持时</h2><p>若困扰持续影响睡眠、学习或工作，可联系学校心理中心或专业人员。若你正处于直接危险、有伤害自己的打算，请立即联系身边可信任的人、当地急救或危机服务，并去有人陪伴的地方。本站不能提供紧急救援，也不判断你是否安全。</p><h2>陪伴、声音与作品</h2><p>陪伴是本地规则引导，不是真实大模型或心理治疗师。声景实时合成、朗读使用浏览器语音，不是录制音频。涂鸦仅描述颜色与线条，不能判断心理状态。这里的游戏只作休闲注意力练习。</p></section>';}
  function chatPage(){
    if(!db.chat.length)db.chat.push({id:C.uid(),date:C.day(),role:'assistant',mode:'listen',text:'这里是本地引导陪伴。你可以慢慢说，或者只写一句最想被听见的话。想先聊聊哪件事？'});
    return head('有些话，可以慢慢说','本地规则引导 · 不连接外部 AI · 默认只保存在此设备','#home')+
      '<section class="card article-body"><div class="chat-modes" aria-label="陪伴方式">'+[['listen','只倾听'],['sort','帮我理清'],['act','帮我行动']].map(m=>'<button data-action="chat-mode" data-value="'+m[0]+'" aria-pressed="'+(m[0]===state.chatMode)+'" class="'+(m[0]===state.chatMode?'':'secondary')+'">'+m[1]+'</button>').join('')+'</div><div class="chat-log" id="chatLog" role="log" aria-label="本地对话记录" aria-live="polite">'+db.chat.slice(-60).map(m=>'<div class="message '+(m.role==='user'?'user':'')+'"><small>'+(m.role==='user'?'你':'本地引导陪伴')+(m.legacy?' · 旧版':'')+'</small><div>'+esc(m.text)+'</div>'+(m.role==='assistant'&&!m.legacy?'<div class="row">'+button('有帮助','chat-help',m.id,'ghost')+button('不太像，调整一下','chat-rephrase',m.id,'ghost')+'</div>':'')+'</div>').join('')+'</div><div class="mood-strip">'+['最近一直担心学习','工作任务太多','关系里有点委屈','我只是想说说'].map(t=>button(t,'chat-quick',t,'mood-chip')).join('')+'</div><form id="chatForm"><label for="chatText">这一刻，想说的话</label><textarea id="chatText" name="text" required maxlength="2000" placeholder="不用从头说起，先从最困扰的那一小块开始。"></textarea><div class="row"><button type="submit">发送到本地对话</button><small>Ctrl + Enter 也可以发送</small>'+button('结束并清除对话','chat-clear',null,'ghost')+'</div></form><p class="muted">你可以不回答问题。文字陪伴不能替代现实中的支持或紧急帮助。</p></section>';
  }
  function scrollChat(){const log=$('#chatLog');if(log)log.scrollTop=log.scrollHeight;}
  function renderChatAdjust(){const m=db.chat.filter(x=>x.role==='assistant').at(-1);if(!m)return;let content='';if(m.feedback==='不太像')content='<p>你希望我怎么调整？</p>'+[['emotion','情绪没说对'],['listen','我只想被听见'],['act','我想要具体方法']].map(x=>button(x[1],'chat-adjust',x[0]+'|'+m.id,'secondary')).join('');if(m.feedback==='emotion-check')content='<p>以你的感受为准。哪个词更接近你？</p>'+D.emotions.map(x=>button(x[0]+' '+x[1],'chat-emotion',x[1]+'|'+m.id,'mood-chip')).join('');if(content)$('#chatLog').insertAdjacentHTML('beforeend','<div id="chatAdjustment" class="feedback-box">'+content+'</div>');}
  function chatRespond(text,alternative){
    if(/(自杀|自伤|伤害自己|不想活|活不下去|结束生命|想死|杀死自己)/.test(text))return '我注意到你说到可能伤害自己的念头。请先联系身边可信任的人，让对方陪在你身边；有直接危险时请联系当地急救或危机服务。这里无法提供紧急救援，也无法判断你现在是否安全。你可以先去有人陪伴的地方。';
    const topics=[
      {words:/课堂|汇报|演讲|当众|开场|讲不好|同学面前|上台|发言/,name:'课堂汇报和当众讲话',need:'一段可依靠的开场和卡住时的退路',action:'写下并练一段 20 秒开场：“我今天想讲……，先从……说起。”只练这一段；卡住时停一拍、呼气、看一眼提纲，再接下一句。',question:'你愿意先把开场的第一句话写出来吗？'},
      {words:/考试|学习|作业|成绩|论文|老师/,name:'学习和表现',need:'一点准备空间，或更清楚的要求',action:'把下一项学习任务缩小成一个标题，先写 5 分钟。',question:'眼下最卡住的是开始，还是担心结果？'},
      {words:/工作|加班|老板|任务|同事|项目/,name:'工作负荷',need:'更明确的优先级和休息',action:'把任务写成三行，只标出今天必须处理的一项。',question:'如果今天只处理一件必要的事，会是哪一件？'},
      {words:/朋友|父母|家人|关系|伴侣|分手|争吵|委屈/,name:'关系里的事',need:'被听见，或让边界更清楚',action:'写下一句“刚才发生……，我希望……”，先不发送。',question:'你现在更想被听见，还是先有一点距离？'},
      {words:/疲惫|睡|累|没力气/,name:'疲惫与休息',need:'身体得到一点照顾',action:'先喝几口水，放下屏幕两分钟。',question:'此刻身体更需要吃点东西、安静还是休息？'},
      {words:/不行|没用|失败|自我|怀疑|内耗/,name:'对自己的要求',need:'少一点定性，多一点具体事实',action:'写下一件今天实际做过的小事，不评价好坏。',question:'你愿意先把对自己的一个判断换成具体事实吗？'}
    ];
    const previous=db.chat.filter(x=>x.role==='user').slice(-3).map(x=>x.text).join(' ');
    const topic=topics.find(t=>t.words.test(text))||topics.find(t=>t.words.test(previous))||{name:'这段经历',need:'一点空间，或有人听你说',action:'站起来看看周围，写下一件眼下能做的小事。',question:'这件事里，你最想先放下哪一部分？'};
    const emotion=D.emotions.map(x=>x[1]).find(x=>text.includes(x));
    const event=text.split(/[。！？\n]/)[0].slice(0,45),intro='你提到“'+event+'”'+(emotion?'，里面有'+emotion+'。':'。');
    if(alternative)return intro+'也许我刚才选的角度没有贴近你。先不推测原因，也先不安排任务。你愿意用自己的词说说，最想被听见的是哪一部分吗？';
    const previousUsers=db.chat.filter(x=>x.role==='user').slice(0,-1).reverse();
    const context=previousUsers.find(x=>topic.words?.test(x.text))||previousUsers[0];
    const continuity=context?'你前面提到“'+context.text.split(/[。！？\n]/)[0].slice(0,45)+'”。现在我们仍围绕'+topic.name+'，把这一步缩小一点。\n':'';
    if(state.chatMode==='sort')return continuity+intro+'\n发生了什么：'+event+'\n我感到什么：'+(emotion||'还需要你来命名，我不替你下结论')+'\n我可能需要：'+topic.need+'（也可能不准确）。\n'+topic.question;
    if(state.chatMode==='act')return continuity+intro+'先不处理全部'+topic.name+'。一个 5 分钟内的小动作是：'+topic.action+'\n你愿意把哪一点改得更适合现在的自己？';
    return continuity+intro+'在'+topic.name+'上持续费力，确实可能让人不好受。这里可以先不寻找答案。\n'+topic.question;
  }
  function sendChat(text){text=text.trim();if(!text){toast('先写一句就好。');return;}state.chatLastUser=text;db.chat.push({id:C.uid(),date:C.day(),role:'user',text,mode:state.chatMode});const response=chatRespond(text,false);db.chat.push({id:C.uid(),date:C.day(),role:'assistant',text:response,mode:state.chatMode});persist();render();if(state.chatMode==='act'&&!/(自杀|自伤|伤害自己|不想活|活不下去|结束生命|想死|杀死自己)/.test(text))$('#chatLog').insertAdjacentHTML('beforeend','<div class="row">'+button('写下我的最小行动','chat-action',null,'secondary')+'<a class="button secondary" href="#training/ground">先做安定练习</a></div>');scrollChat();}
  function doodlePage(){return head('画一画，不急着解释','表达没有标准答案。系统只能描述画面，不能判断心理状态。','#tools')+'<section class="card"><div class="row"><label>颜色<input id="drawColor" type="color" value="#557b63"></label><label>笔宽<input id="drawWidth" type="range" min="2" max="30" value="6"></label><label class="inline-label"><input id="drawEraser" type="checkbox">橡皮</label>'+button('撤销','draw-undo',null,'secondary')+button('清空画布','draw-clear',null,'ghost')+'</div><canvas id="drawCanvas" width="960" height="560" tabindex="0" aria-label="自由涂鸦画布。触屏或鼠标拖动画画，键盘用方向键移动画笔、空格落笔。"></canvas><small>键盘：方向键移动笔尖，空格切换落笔 / 抬笔。下方文字也可以代替绘画表达。</small><div class="form-grid"><label>给画面命名<input id="drawName" maxlength="80" value="'+esc(db.drafts.doodle?.name)+'" placeholder="例如：今天的一团风"></label><label>配一句自己的感受<input id="drawFeel" maxlength="300" value="'+esc(db.drafts.doodle?.feel)+'" placeholder="只有你能决定它的意思"></label></div><div class="row">'+button('看看画面的特点','draw-analyze',null,'secondary')+button('保存本地作品','draw-save')+'</div><div id="drawFeedback" class="feedback-box" style="margin-top:15px"><p>可以先画一笔，或者留一片空白。保存后到“我的”查看。</p></div></section>';}
  function setupCanvas(){
    const canvas=$('#drawCanvas'),ctx=canvas.getContext('2d');
    const art={canvas,ctx,strokes:[],redo:[],drawing:false,current:null,keyboard:false,cursor:{x:480,y:280},base:null};
    state.canvas=art;ctx.lineCap='round';ctx.lineJoin='round';
    const draft=db.drafts.doodle;if(draft?.image){const img=new Image();img.onload=()=>{if(state.canvas===art){art.base=img;redrawCanvas();}};img.src=draft.image;}
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);beginStroke(canvasPoint(e));});
    canvas.addEventListener('pointermove',e=>{if(art.drawing){e.preventDefault();addPoint(canvasPoint(e));}});
    const end=e=>{if(art.drawing){endStroke();if(e?.pointerId!=null&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',()=>{if(art.drawing)endStroke();});
    canvas.addEventListener('keydown',e=>{
      if(e.code==='Space'){e.preventDefault();art.keyboard=!art.keyboard;if(art.keyboard)beginStroke(art.cursor);else endStroke();toast(art.keyboard?'画笔已落下，方向键移动。':'画笔已抬起。');}
      const dirs={ArrowUp:[0,-12],ArrowDown:[0,12],ArrowLeft:[-12,0],ArrowRight:[12,0]};if(dirs[e.key]){e.preventDefault();const d=dirs[e.key];art.cursor={x:Math.max(0,Math.min(canvas.width,art.cursor.x+d[0])),y:Math.max(0,Math.min(canvas.height,art.cursor.y+d[1]))};if(art.keyboard)addPoint(art.cursor);}
    });
  }
  function canvasPoint(e){const r=state.canvas.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*state.canvas.canvas.width/r.width,y:(e.clientY-r.top)*state.canvas.canvas.height/r.height};}
  function beginStroke(p){const a=state.canvas;a.drawing=true;a.current={color:$('#drawColor').value,width:Number($('#drawWidth').value),erase:$('#drawEraser').checked,points:[{...p}]};a.strokes.push(a.current);redrawCanvas();}
  function addPoint(p){const a=state.canvas;if(!a?.drawing)return;a.current.points.push({...p});redrawCanvas();}
  function endStroke(){const a=state.canvas;a.drawing=false;a.current=null;saveCanvasDraft();}
  function redrawCanvas(){const a=state.canvas;if(!a)return;const ctx=a.ctx;ctx.clearRect(0,0,a.canvas.width,a.canvas.height);if(a.base)ctx.drawImage(a.base,0,0,a.canvas.width,a.canvas.height);a.strokes.forEach(s=>{ctx.globalCompositeOperation=s.erase?'destination-out':'source-over';ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.width;ctx.beginPath();ctx.moveTo(s.points[0].x,s.points[0].y);s.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));if(s.points.length===1){ctx.arc(s.points[0].x,s.points[0].y,s.width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();});ctx.globalCompositeOperation='source-over';}
  function canvasImage(){return state.canvas.canvas.toDataURL('image/png');}
  function saveCanvasDraft(){if(!state.canvas)return;db.drafts.doodle={image:canvasImage(),name:$('#drawName').value,feel:$('#drawFeel').value};persist();}
  function drawFeatures(){const a=state.canvas,p=a.ctx.getImageData(0,0,a.canvas.width,a.canvas.height).data;let ink=0,minX=a.canvas.width,minY=a.canvas.height,maxX=0,maxY=0;const colors={};for(let i=0;i<p.length;i+=4){if(p[i+3]>20){ink++;const x=(i/4)%a.canvas.width,y=Math.floor(i/4/a.canvas.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const key='#'+[p[i],p[i+1],p[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');colors[key]=(colors[key]||0)+1;}}const density=ink/(a.canvas.width*a.canvas.height)*100,coverage=ink?(maxX-minX+1)*(maxY-minY+1)/(a.canvas.width*a.canvas.height)*100:0;return {ink,density,coverage,color:Object.entries(colors).sort((a,b)=>b[1]-a[1])[0]?.[0]||'无',strokes:a.strokes.filter(s=>!s.erase).length,erased:a.strokes.some(s=>s.erase)};}
  function analyzeDoodle(){const f=drawFeatures(),text=f.ink?'我注意到有颜色的像素约占画布 '+f.density.toFixed(1)+'%，落笔覆盖范围约 '+f.coverage.toFixed(1)+'%，主要颜色是 '+f.color+'。本次有 '+f.strokes+' 组线条'+(f.erased?'，也使用过橡皮':'')+'。':'我注意到画面目前是留白的。';$('#drawFeedback').innerHTML='<p>'+text+'这些只是画面特征，不代表情绪诊断。你觉得这描述像你的表达吗？</p><div class="row">'+button('像我','draw-response','像我','secondary')+button('不太像','draw-response','不太像','secondary')+'</div><p>下一步：给画面命名，或写一句想保留的话。'+(f.ink?'也可以圈出你最想保留的部分。':'你也可以先做一次自然呼吸。')+'</p><a href="#training/breath">做一次轻柔呼吸</a>';}
  function attentionPage(){return head('停一拍','点到叶子时回应，遇到云时停一拍。只作休闲注意力练习。','#tools')+'<section class="card trainer"><h2>一局 30 秒，不追求完美。</h2><p>看到 🍃 叶子，点一下大圆或按空格键；看到 ☁ 云，先不点。每轮 1.5 秒。</p><button class="leaf-target" id="attentionTarget" data-action="attention-tap" aria-label="回应当前图案" disabled>🍃</button><p id="attentionStatus" role="status">开始后，每次只作一个选择。</p>'+button('开始一局','attention-start',null,'secondary')+'</section>';}
  function startAttention(){clearInterval(state.gameTick);state.game={running:true,round:0,total:20,correct:0,taps:0,responded:false,target:'leaf'};nextAttention();state.gameTick=setInterval(()=>{resolveAttention();if(state.game.round>=20){clearInterval(state.gameTick);state.game.running=false;$('#attentionTarget').disabled=true;$('#attentionStatus').textContent='完成 '+state.game.total+' 轮，'+state.game.correct+' 次选择符合规则。留意刚才“想立刻点”的感觉，慢慢呼气一次。';return;}nextAttention();},1500);}
  function resolveAttention(){const g=state.game;if(!g)return;if((g.target==='leaf'&&g.responded)||(g.target==='cloud'&&!g.responded))g.correct++;}
  function nextAttention(){const g=state.game;g.round++;g.responded=false;g.target=Math.random()<.62?'leaf':'cloud';$('#attentionTarget').disabled=false;$('#attentionTarget').textContent=g.target==='leaf'?'🍃':'☁';$('#attentionTarget').setAttribute('aria-label',g.target==='leaf'?'叶子，可以回应':'云，暂停回应');$('#attentionStatus').textContent='第 '+g.round+'/20 轮 · 叶子回应，遇云暂停。';}
  function bubblesPage(){return head('捏泡泡','不计时，也不用全部完成。听一声轻响，再松松肩膀。','#tools')+'<section class="card"><div class="bubble-grid">'+Array.from({length:24},(_,i)=>'<button class="bubble" data-action="bubble" data-value="'+i+'" aria-label="捏第 '+(i+1)+' 颗泡泡" aria-pressed="false">◯</button>').join('')+'</div><p id="bubbleStatus" role="status">选择一颗泡泡就好。</p>'+button('换一张泡泡纸','bubble-reset',null,'secondary')+'</section>';}
  function beep(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=520;g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.1);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);o.onended=()=>c.close();}catch(_){}}
  function recordsList(){
    const k=state.recordTab;
    if(k==='favorites')return db.favorites.length?db.favorites.map(id=>{const [type,key]=id.split(':'),item=(type==='training'?D.trainings:type==='scenario'?D.scenarios:D.articles).find(x=>x.id===key);return item?'<div class="record row between"><a href="#'+(type==='training'?'training':type)+'/'+key+'">'+esc(item.name||item.title)+'</a>'+favButton(id)+'</div>':'';}).join(''):empty('还没有收藏。喜欢的练习、锦囊或短文可以点“收藏”。');
    const rows=(db[k]||[]).slice().reverse();
    if(!rows.length)return empty('这里还没有记录。等你愿意时，从一小步开始。');
    return rows.map(x=>{
      if(k==='holes')return holeCard(x);
      let body='';
      if(k==='moods')body='<h3>'+esc(x.emotion)+' <small>强度 '+(x.intensity??'—')+'/10</small></h3><p>'+esc(x.event)+'</p><p>'+esc(x.need?'我需要：'+x.need:'')+'</p><p>'+esc(x.action?'下一小步：'+x.action:'')+'</p>';
      if(k==='trainings')body='<h3>'+esc(x.name)+'</h3><p>'+(x.completed?'✓ 完成 '+Math.round(x.seconds/60)+' 分钟':'◦ '+(x.legacy?'旧版记录，不计完成':'提前结束'))+'</p><p>前 '+(x.pre??'未评分')+' → 后 '+(x.post??'未评分')+' '+(x.pre!=null&&x.post!=null?'（变化 '+(x.post-x.pre>0?'+':'')+(x.post-x.pre)+' 分）':'')+'</p><p>'+esc(x.feel)+' '+esc(x.action)+'</p>';
      if(k==='assessments')body='<h3>'+esc(x.instrument==='PSS-10'?'PSS-10 · '+x.score+'/40':'旧版分数 · '+x.score)+'</h3><p>'+esc(x.instrument==='PSS-10'?'过去一个月的感知压力。':'原始量尺不明确，保留回看，不纳入新图表。')+'</p><p>'+esc((x.sources||[]).join('、'))+'</p>'+(x.aux?'<small>独立辅助觉察：'+['身体紧张','担忧','自我要求','生活负荷'].map((n,i)=>n+' '+(x.aux[i]??'未填')).join(' · ')+'</small>':'');
      if(k==='artworks')body='<h3>'+esc(x.name||'未命名作品')+'</h3><img class="record-img" src="'+esc(x.image)+'" alt="'+esc(x.name||'我的涂鸦')+'"><p>'+esc(x.feel)+'</p>';
      if(k==='goals')body='<h3>'+esc(x.text)+'</h3><p>'+(x.done?'✓ 已完成':'◦ 还没完成，也可以晚一点')+'</p>'+(!x.done?button('标为完成','goal-done',x.id,'secondary'):'');
      if(k==='sourceLogs')body='<p>旧版压力来源：'+esc((x.sources||[]).join('、')||'未选择')+'</p>';
      if(k==='chat')body='<p>'+esc(x.role==='user'?'你':'本地引导')+'：'+esc(x.text)+'</p>';
      return '<article class="record"><small>'+dateLabel(x.date)+'</small>'+body+'<div class="row">'+button('删除这一条','delete',k+':'+x.id,'ghost')+'</div></article>';
    }).join('');
  }
  function trendChart(){
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const date=C.day(d),rows=db.moods.filter(x=>x.date===date),training=db.trainings.filter(x=>x.date===date&&x.completed);return {date,mood:rows.at(-1),training};});
    return '<h3>近 7 天心情与练习</h3><p class="muted">柱高代表当日最后一次心情强度，不是压力诊断；没有记录不补分。</p><div class="chart" role="img" aria-label="'+esc(days.map(x=>x.date+'：'+(x.mood?x.mood.emotion+'，强度'+x.mood.intensity:'无心情记录')+'，完成练习'+x.training.length+'次').join('；'))+'">'+days.map(x=>'<div class="bar-cell"><small>'+(x.mood?esc(x.mood.emotion):'—')+'</small><span class="bar" style="height:'+(x.mood?Math.max(4,x.mood.intensity*10):3)+'px"></span><span>'+x.date.slice(5)+'</span><small>练习 '+x.training.length+'</small></div>').join('')+'</div>';
  }
  function pressureTrend(){
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const date=C.day(d),x=db.trainings.filter(x=>x.date===date&&x.post!=null).at(-1);return {date,score:x?.post??null};});
    return '<section class="card"><h2>近 7 天即时压力</h2><p class="muted">当日最后一次练习后的 0–10 分记录。空白表示未评分，不是 0 分；与 PSS-10 分开看。</p><div class="chart" role="img" aria-label="'+esc(days.map(x=>x.date+'：'+(x.score==null?'未评分':x.score+'分')).join('；'))+'">'+days.map(x=>'<div class="bar-cell"><small>'+(x.score??'—')+'</small><div class="bar" style="height:'+(x.score==null?3:Math.max(4,x.score*10))+'px"></div><span>'+x.date.slice(5)+'</span></div>').join('')+'</div></section>';
  }
  function mePage(){
    const logs=C.recent(db.trainings).filter(x=>x.completed),rated=logs.filter(x=>x.pre!=null&&x.post!=null),avg=rated.length?rated.reduce((s,x)=>s+x.post-x.pre,0)/rated.length:null,by={};rated.forEach(x=>{by[x.name]??=[];by[x.name].push(x.post-x.pre);});const best=Object.entries(by).sort((a,b)=>a[1].reduce((s,x)=>s+x,0)/a[1].length-b[1].reduce((s,x)=>s+x,0)/b[1].length)[0];
    const source={};C.recent(db.assessments).concat(C.recent(db.sourceLogs||[])).forEach(x=>(x.sources||[]).forEach(s=>source[s]=(source[s]||0)+1));
    const pss=db.assessments.filter(x=>x.instrument==='PSS-10'),latest=pss.at(-1),previous=pss.at(-2);
    return head('我的余地','回看你照顾自己的方式。这里没有打卡惩罚，也不作疗效结论。')+
      '<div class="summary-grid"><section class="card metric"><small>近 7 天练习</small><strong>'+logs.length+' 次</strong><span>'+Math.round(logs.reduce((s,x)=>s+x.seconds,0)/60)+' 分钟</span></section><section class="card metric"><small>前后即时评分</small><strong>'+(avg===null?'暂无评分':avg<0?'平均下降 '+Math.abs(avg).toFixed(1)+' 分':avg>0?'平均上升 '+avg.toFixed(1)+' 分':'平均持平')+'</strong><span>'+rated.length+' 次前后均有评分 · 0–10 分</span></section><section class="card metric"><small>更适合我的练习</small><strong style="font-size:21px">'+(best&&best[1].reduce((s,x)=>s+x,0)/best[1].length<0?esc(best[0]):'还需要一些记录')+'</strong><span>只描述个人记录，不代表治疗效果</span></section></div>'+
      '<div class="equal-col"><section class="card">'+trendChart()+'</section><section class="card"><h3>压力回看</h3><p>'+(latest?'最近 PSS-10：'+latest.score+'/40 · '+latest.date:'还没有 PSS-10 记录。它用于过去一个月，不建议当作每日打卡。')+'</p>'+(latest&&previous?'<p>两次记录：'+previous.score+' → '+latest.score+'；观察变化，也考虑生活背景。</p>':'')+'<h3>近 7 天记录的压力来源</h3><div class="sources">'+(Object.keys(source).length?Object.entries(source).map(x=>'<span class="pill">'+esc(x[0])+' '+x[1]+' 次</span>').join(''):'<small>选择过压力来源后，这里才会显示。</small>')+'</div><p>近 7 天小目标完成：'+C.recent(db.goals).filter(x=>x.done).length+' / '+C.recent(db.goals).length+'</p><a href="#assessment">做一次过去一个月的压力觉察</a></section></div>'+
      pressureTrend()+'<section class="card"><h2>回看记录</h2><div class="mood-strip">'+[['moods','心情'],['holes','树洞 / 胶囊'],['trainings','练习'],['assessments','自测'],['artworks','作品'],['goals','小目标'],['favorites','收藏'],['chat','本地对话'],['sourceLogs','旧版来源']].map(t=>'<button class="mood-chip" data-action="record-tab" data-value="'+t[0]+'" aria-pressed="'+(t[0]===state.recordTab)+'">'+t[1]+'</button>').join('')+'</div><div id="recordsList">'+recordsList()+'</div></section>'+
      '<section class="card"><h2>给接下来的自己一个小目标</h2><form id="goalForm"><label>5 分钟内可开始的行动<input name="text" required maxlength="300" placeholder="例如：打开文档写一句话"></label><button type="submit">记下小目标</button></form></section>'+
      '<section class="card"><h2>设置与数据</h2>'+[['dark','深色模式'],['reduced','减少动效'],['voice','浏览器中文语音提示']].map(x=>'<label class="settings-row"><span>'+x[1]+'</span><input type="checkbox" data-setting="'+x[0]+'" '+(db.settings[x[0]]?'checked':'')+'></label>').join('')+'<p><small>'+voiceStatus()+'</small></p><div class="row">'+button('导出 JSON 备份','export',null,'secondary')+button('导出 CSV 概览','export-csv',null,'ghost')+'<label class="button secondary">导入 JSON<input id="importFile" type="file" accept=".json,application/json" style="width:180px" aria-label="导入心有余地 JSON 备份"></label>'+button('删除全部本地记录','delete-all',null,'ghost')+'</div><p><small>导入先校验，再合并相同 ID 的记录；不修改其他网站数据。旧版原始备份随导出保留。</small></p><div class="row"><a href="#evidence">关于、证据与安全</a>'+button('查看离线安装说明','install-info',null,'ghost')+(state.installPrompt?button('安装到设备','install',null,'secondary'):'')+'</div><div id="installInfo"></div></section>';
  }
  function saveMoodDraft(form){const f=new FormData(form);db.drafts.mood={emotion:f.get('emotion')||'',intensity:Number(f.get('intensity')),event:f.get('event')||'',need:f.get('need')||'',action:f.get('action')||''};persist();}
  function saveHoleDraft(form){const f=new FormData(form);db.drafts.hole=Object.assign({},db.drafts.hole,{text:f.get('text')||'',category:f.get('category')||'生活',emotion:f.get('emotion')||'说不清',control:Number(f.get('control')),action:f.get('action')||'',capsule:f.get('capsule')||'',recipient:f.get('recipient')||'此刻的我'});persist();}
  let recordRequest=0,recorder=null,recordStream=null,recordTimer=null,recordSaving=false;
  function recordingControls(draft){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return '';
    return '<div class="feedback-box"><h3>录一段给自己的话（可选）</h3><small>最多 30 秒，需要你允许麦克风；只存本地。</small><div class="row">'+button('开始录音','record-start',null,'secondary')+button('停止并保存到草稿','record-stop',null,'ghost')+'</div><p id="recordStatus" role="status">尚未开始录音。</p>'+(draft.audio?'<audio controls src="'+esc(draft.audio)+'" aria-label="草稿录音"></audio>':'')+'</div>';
  }
  function stopRecording(){recordRequest++;clearTimeout(recordTimer);if(recorder&&recorder.state!=='inactive'){recordSaving=true;recorder.stop();}if(recordStream)recordStream.getTracks().forEach(t=>t.stop());recordStream=null;}
  async function startRecording(){
    if(recorder&&recorder.state!=='inactive'){toast('录音已经开始，完成后点击停止。');return;}
    const request=++recordRequest;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(request!==recordRequest||state.route!=='hole'){stream.getTracks().forEach(t=>t.stop());return;}
      recordStream=stream;
      const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!mime){stream.getTracks().forEach(t=>t.stop());toast('浏览器没有可保存的录音格式，请使用文字。');return;}
      const current=new MediaRecorder(stream,{mimeType:mime}),chunks=[];recorder=current;
      current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      current.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mime});if(blob.size>1024*1024){recordSaving=false;toast('录音超过 1 MB，未保存。请使用更短的录音。');return;}const reader=new FileReader();reader.onload=()=>{recordSaving=false;db.drafts.hole??={};db.drafts.hole.audio=String(reader.result);if(persist()){if($('#recordStatus'))$('#recordStatus').textContent='录音已加入本地草稿，提交树洞时一起保存。';toast('录音已停下，保存在树洞草稿。');}};reader.onerror=()=>{recordSaving=false;toast('录音读取失败，请使用文字。');};reader.readAsDataURL(blob);};
      current.onerror=()=>{stopRecording();toast('录音未完成，请使用文字记录。');};
      current.start();recordTimer=setTimeout(stopRecording,30000);if($('#recordStatus'))$('#recordStatus').textContent='正在录音，最多 30 秒；切页会停止并存入草稿。';
    }catch(_){toast('未能使用麦克风。你可以改用文字或图片。');}
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  const handlers={
    'chat-adjust':value=>{const [mode,id]=value.split('|'),m=db.chat.find(x=>x.id===id);if(!m)return;const idx=db.chat.findIndex(x=>x.id===id),u=db.chat.slice(0,idx).reverse().find(x=>x.role==='user');if(!u)return;if(mode==='emotion'){m.feedback='emotion-check';m.text='我先不替你命名，按你选择的感受来。';}else{state.chatMode=mode;m.mode=mode;m.feedback='adjusted:'+mode;m.text=chatRespond(u.text,false);}persist();render();},
    'chat-emotion':value=>{const [emotion,id]=value.split('|'),m=db.chat.find(x=>x.id===id),idx=db.chat.findIndex(x=>x.id===id),u=db.chat.slice(0,idx).reverse().find(x=>x.role==='user');if(!m||!u)return;m.feedback='adjusted:emotion';m.mode='listen';state.chatMode='listen';m.text='这次以你选的“'+emotion+'”为准。你刚才提到“'+u.text.slice(0,60)+'”。不需要把它说成别的感受。你最希望这份'+emotion+'被怎样听见？';persist();render();},
    'record-start':startRecording,
    'record-stop':stopRecording,
    'theme':()=>{db.settings.dark=!db.settings.dark;persist();applySettings();},
    'welcome':()=>{db.settings.welcomed=true;persist();render();},
    'quick-mood':value=>{db.drafts.mood=Object.assign({},db.drafts.mood,{emotion:value});persist();go('mood');},
    'favorite':value=>{db.favorites=favorite(value)?db.favorites.filter(x=>x!==value):db.favorites.concat(value);persist();const scroll=window.scrollY;render();window.scrollTo(0,scroll);toast(favorite(value)?'已放入“我的收藏”。':'已取消收藏。');},
    'record-tab':value=>{state.recordTab=value;render();$('#recordsList').scrollIntoView({block:'nearest'});},
    'goal-done':value=>{const x=db.goals.find(x=>x.id===value);if(x)x.done=true;persist();render();toast('记下了，今天照顾自己的一小步。');},
    'delete':value=>{const [list,id]=value.split(':');if(!C.listKeys.includes(list)||list==='favorites')return;confirmAction('删除这一条记录？','删除后无法恢复。其他记录会保留。',()=>{db[list]=db[list].filter(x=>x.id!==id);persist();render();toast('这一条已删除。');});},
    'release':value=>{const x=db.holes.find(x=>x.id===value);if(!x)return;confirmAction('愿意先把它放在这里吗？','这是一个释放仪式，不会删除文字，也不要求你忘记它。之后仍可回看。',()=>{const card=document.querySelector('[data-record-id="'+value+'"]');if(card)card.classList.add('release');x.released=true;persist();setTimeout(()=>{if(['hole','me'].includes(state.route))render();toast('已经放在这里了。没解决的部分，可以慢慢来。');},db.settings.reduced?0:800);});},
    'cancel-confirm':closeConfirm,
    'accept-confirm':()=>{const fn=state.confirm;closeConfirm();if(fn)fn();},
    'delete-all':()=>confirmAction('删除全部本地记录？','将删除本产品的心情、树洞、聊天、作品、训练、自测、草稿和旧版原始记录。无法恢复，建议先导出。不会删除其他应用的数据。',()=>{try{[C.KEY,C.BACKUP,...C.legacyKeys,'ssPrefs','ssEmotion','ssPracticeCurrent','ssWelcomeSeen','ssPracticeFeedback','ssDoodleFeedback'].forEach(k=>localStorage.removeItem(k));}catch(_){}db=C.empty();db.migration.done=true;state.train=null;state.pssResult=null;state.pssIndex=0;persist();go('me');render();toast('本产品的新旧本地记录已清除。');}),
    'export':()=>{download('心有余地备份-'+C.day()+'.json',JSON.stringify(C.backup(db,localStorage),null,2),'application/json');toast('备份已交给浏览器下载，包含树洞与对话，请妥善保管。');},
    'export-csv':()=>{const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=[['日期','记录类型','名称或情绪','前评分','后评分','PSS10分数','完成秒数'],...db.moods.map(x=>[x.date,'心情',x.emotion,'','','','']),...db.trainings.map(x=>[x.date,'练习',x.name,x.pre,x.post,'',x.seconds]),...db.assessments.map(x=>[x.date,x.instrument,'压力自测','','',x.score,''])];download('心有余地概览-'+C.day()+'.csv','\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('已导出统计概览。完整内容请使用 JSON 备份。');},
    'train-toggle':()=>{const s=state.train;if(s.clock.running){C.clockPause(s.clock);stopSpeech();}else{C.clockStart(s.clock);s.spokenStep=-1;}render();},
    'train-end':()=>confirmAction('现在结束练习？','可以随时停下。提前结束的记录会单独标记，不计为完成。',()=>finishTraining(false)),
    'pss-prev':()=>{state.pssIndex=Math.max(0,state.pssIndex-1);if(db.drafts.pss)db.drafts.pss.index=state.pssIndex;persist();render();},
    'pss-later':()=>{if(db.drafts.pss)db.drafts.pss.index=state.pssIndex;persist();go('home');toast('进度已保存在此设备，稍后可以继续。');},
    'pss-restart':()=>{state.pssResult=null;state.pssIndex=0;db.drafts.pss={answers:Array(10).fill(null),sources:[],index:0};persist();render();},
    'sound-start':startSound,
    'sound-stop':()=>{stopSound();if($('#soundStatus'))$('#soundStatus').textContent='声音已停止。';},
    'sound-toggle':async()=>{const a=state.audio;if(!a){toast('先选择一种声景。');return;}try{if(a.ctx.state==='running'){await a.ctx.suspend();a.paused=true;if($('#soundStatus'))$('#soundStatus').textContent='已暂停，定时关闭仍会生效。';}else{await a.ctx.resume();a.paused=false;if($('#soundStatus'))$('#soundStatus').textContent='合成声景继续播放。';}}catch(_){toast('声音已停止，请重新选择声景。');}},
    'chat-mode':value=>{state.chatMode=value;render();toast({listen:'先倾听，不急着解决。',sort:'一起分清事情、感受和需要。',act:'只找一个能开始的小动作。'}[value]);},
    'chat-quick':sendChat,
    'chat-help':value=>{const m=db.chat.find(x=>x.id===value);if(m)m.feedback='有帮助';persist();toast('谢谢你告诉我，保留这个角度。');},
    'chat-rephrase':value=>{const m=db.chat.find(x=>x.id===value),idx=db.chat.findIndex(x=>x.id===value),u=db.chat.slice(0,idx).reverse().find(x=>x.role==='user');if(!m||!u){toast('你可以先写一句自己的话，再调整回应。');return;}m.text='刚才的角度可能没有贴近你。请选择要调整的地方，我会顺着你选的方向继续。';m.feedback='不太像';persist();render();},
    'chat-action':()=>{if($('#chatActionForm'))return;$('#chatForm').insertAdjacentHTML('afterend','<form id="chatActionForm" class="feedback-box"><label>我愿意尝试的最小行动<input name="text" required maxlength="300" placeholder="例如：把下一步写成一句话"></label><button type="submit">放进我的小目标</button></form>');$('#chatActionForm input').focus();},
    'chat-clear':()=>confirmAction('清除本地对话？','这段对话不会发送给别人。清除后不能从页面恢复。',()=>{db.chat=[];persist();render();toast('已结束并清除刚才的对话。');}),
    'draw-undo':()=>{const a=state.canvas;if(a.strokes.length)a.strokes.pop();else if(a.base){a.base=null;}redrawCanvas();saveCanvasDraft();},
    'draw-clear':()=>confirmAction('重新留一张空白画布？','还没保存的画面会清空。已经存入“我的”的作品不受影响。',()=>{state.canvas.strokes=[];state.canvas.base=null;redrawCanvas();saveCanvasDraft();$('#drawFeedback').textContent='画布空出来了。想画就画，也可以先停一会儿。';}),
    'draw-analyze':analyzeDoodle,
    'draw-response':value=>{db.drafts.doodle=Object.assign({},db.drafts.doodle,{feel:value});persist();toast(value==='像我'?'谢谢你校准。这幅画的意义由你来定。':'那就以你的感受为准。可以配一句自己的话。');},
    'draw-save':()=>{const f=drawFeatures();if(!f.ink){toast('画布还是空白。可以先画一笔，或把想说的话写在心情记录里。');return;}const image=canvasImage();if(image.length>1500000){toast('作品较大，暂时无法保存。请减少细节后重试。');return;}if(addRow('artworks',{image,name:$('#drawName').value.trim()||'未命名作品',feel:$('#drawFeel').value.trim(),note:'像素密度 '+f.density.toFixed(1)+'%，覆盖范围 '+f.coverage.toFixed(1)+'%'})){toast('作品已保存在“我的 → 作品”。');}},
    'attention-start':startAttention,
    'attention-tap':()=>{const g=state.game;if(!g?.running||g.responded)return;g.responded=true;g.taps++;$('#attentionTarget').disabled=true;},
    'bubble':(_,el)=>{if(el.classList.contains('popped'))return;el.classList.add('popped');el.setAttribute('aria-pressed','true');el.textContent='·';const n=document.querySelectorAll('.bubble.popped').length;$('#bubbleStatus').textContent=n===24?'泡泡纸捏完了。现在松开肩膀，休息一下。':'已经捏了 '+n+' 颗，按自己的节奏就好。';beep();},
    'bubble-reset':render,
    'install-info':()=>{$('#installInfo').innerHTML='<p>离线安装需要通过 HTTPS 或 localhost 打开，首次联网访问后缓存资源。手机浏览器菜单中选择“添加到主屏幕”或“安装应用”。双击本地 HTML 可直接使用，但不会注册 Service Worker。安装能力取决于浏览器。</p>';},
    'install':async()=>{if(state.installPrompt){await state.installPrompt.prompt();state.installPrompt=null;toast('请在浏览器提示中选择是否安装。');}}
  };
  const forms={
    moodForm:form=>{if(!checkComplete(form))return;saveMoodDraft(form);const x={...db.drafts.mood};if(addRow('moods',x)){delete db.drafts.mood;persist();toast('这份感觉已经有了一个位置。');go('me');state.recordTab='moods';render();}},
    holeForm:form=>{if(!checkComplete(form))return;saveHoleDraft(form);const x={...db.drafts.hole};if(recordSaving||(recorder&&recorder.state!=='inactive')){toast('先停止录音，等草稿保存后再提交。');return;}if(!x.text.trim()&&!x.image&&!x.audio){toast('写一句、选一张图片或录一段话都可以。');return;}if(x.capsule&&(!C.validDay(x.capsule)||x.capsule<C.day())){toast('时间胶囊请选择今天或之后的有效日期。');return;}if(addRow('holes',{...x,text:x.text.trim(),released:false})){delete db.drafts.hole;persist();render();toast('站长收到了。这件事能影响的部分，我们从一个小动作开始。');}},
    pssQuestion:form=>{if(!checkComplete(form))return;db.drafts.pss??={answers:Array(10).fill(null),sources:[]};db.drafts.pss.answers[state.pssIndex]=Number(formValue(form,'answer'));state.pssIndex++;db.drafts.pss.index=state.pssIndex;persist();render();},
    pssSources:form=>{const draft=db.drafts.pss;if(!draft)return;try{const score=C.pssScore(draft.answers),fd=new FormData(form),sources=fd.getAll('sources'),aux=[0,1,2,3].map(i=>numOrNull(fd.get('aux'+i))),row={score,answers:draft.answers.slice(),sources,aux,instrument:'PSS-10'};if(addRow('assessments',row)){state.pssResult=row;delete db.drafts.pss;state.pssIndex=0;persist();render();}}catch(e){toast(e.message);}},
    trainingSetup:form=>{if(!checkComplete(form))return;const fd=new FormData(form),s=state.train;s.pre=numOrNull(fd.get('pre'));s.breath=fd.get('breath')||'natural';s.clock=C.makeClock(Number(fd.get('minutes'))*60);s.stage='active';s.saved=false;s.spokenStep=-1;s.tone=fd.get('tone')==='on';s.lastBreathCue='';C.clockStart(s.clock);render();},
    trainingPost:form=>{const s=state.train;if(!s||s.saved)return;const fd=new FormData(form),post=numOrNull(fd.get('post')),feel=fd.get('feel')||'',action=String(fd.get('action')||'').trim(),seconds=Math.max(0,Math.round(s.clock.total-C.clockRead(s.clock)));const t=D.trainings.find(x=>x.id===s.id);const row={training:s.id,name:t.name,pre:s.pre,post,feel,action,seconds,completed:s.complete};if(addRow('trainings',row)){s.saved=true;if(action)addRow('goals',{text:action,done:false});state.recordTab='trainings';state.train=null;const diff=s.pre!=null&&post!=null?post-s.pre:null;go('me');toast(diff===null?'练习已经记下。下一步，按自己的需要来。':diff<0?'这次压力下降 '+Math.abs(diff)+' 分。把变化留作参考。':diff===0?'暂时没有变化也没关系，这次照顾已经记下。':'感受可能在变化。先停下，照顾身体或联系支持。');}},
    chatForm:form=>{if(checkComplete(form))sendChat(String(formValue(form,'text')));},
    goalForm:form=>{if(!checkComplete(form))return;const text=String(formValue(form,'text')).trim();if(!text)return;addRow('goals',{text,done:false});state.recordTab='goals';render();toast('先从这一小步开始。');},
    chatActionForm:form=>{if(!checkComplete(form))return;const text=String(formValue(form,'text')).trim();if(addRow('goals',{text,done:false})){form.innerHTML='<p>已加入“我的 → 小目标”。由你决定什么时候做。</p>';toast('行动已放进小目标。');}}
  };
  document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const action=handlers[el.dataset.action];if(action){e.preventDefault();try{const result=action(el.dataset.value,el);if(result?.catch)result.catch(()=>toast('这次操作没有完成，请再试一次。'));}catch(err){console.error(err);toast('这次操作没有完成。记录未被主动清除。');}}});
  document.addEventListener('submit',e=>{const fn=forms[e.target.id];if(fn){e.preventDefault();try{fn(e.target);}catch(err){console.error(err);toast('保存未完成，请先保留当前内容。');}}});
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t.closest('#moodForm')){if($('#moodIntensityValue'))$('#moodIntensityValue').textContent=$('#moodIntensity').value;saveMoodDraft(t.closest('form'));}
    if(t.closest('#holeForm')&&t.type!=='file'){if($('#holeControlValue'))$('#holeControlValue').textContent=$('#holeControl').value;saveHoleDraft(t.closest('form'));}
    if(t.id==='toolSearch'){state.toolSearch=t.value;$('#toolsList').innerHTML=toolsList();}
    if(t.id==='holeSearch'){state.holeSearch=t.value;$('#holeList').innerHTML=holeList();}
    if(t.id==='drawName'||t.id==='drawFeel')saveCanvasDraft();
    if(t.id==='soundVolume'&&state.audio)state.audio.gain.gain.setTargetAtTime(Number(t.value),state.audio.ctx.currentTime,.08);
  });
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.dataset.setting){db.settings[t.dataset.setting]=t.checked;persist();applySettings();if(!db.settings.voice)stopSpeech();}
    if(t.id==='trainingVoice'){db.settings.voice=t.checked;persist();if(!t.checked)stopSpeech();else if(state.train)state.train.spokenStep=-1;}
    if(t.closest('#pssQuestion')&&t.name==='answer'){db.drafts.pss??={answers:Array(10).fill(null),sources:[],index:state.pssIndex};db.drafts.pss.answers[state.pssIndex]=Number(t.value);persist();}
    if(t.id==='toolTag'){state.toolTag=t.value;$('#toolsList').innerHTML=toolsList();}
    if(t.id==='holeCategory'){state.holeCategory=t.value;$('#holeList').innerHTML=holeList();}
    if(t.id==='holeWeek'){state.holeWeek=t.checked;$('#holeList').innerHTML=holeList();}
    if(t.id==='soundLoop'||t.id==='soundSleep')resetSoundTimeout();
    if(t.name==='image'&&t.closest('#holeForm')){
      const f=t.files?.[0];if(!f)return;if(f.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type)){toast('请选择不超过 1 MB 的 PNG、JPG 或 WebP 图片。');t.value='';return;}
      const reader=new FileReader();reader.onload=()=>{db.drafts.hole??={};db.drafts.hole.image=String(reader.result);if(persist()&&$('#holeImageState'))$('#holeImageState').textContent='图片已加入本地草稿。';};reader.onerror=()=>toast('图片未能读取，请重新选择。');reader.readAsDataURL(f);
    }
    if(t.id==='importFile'){
      const f=t.files?.[0];if(!f)return;if(f.size>12*1024*1024){toast('备份超过 12 MB，请拆分或检查文件。');return;}
      try{const raw=JSON.parse(await f.text()),incoming=C.validateImport(raw);const count=C.listKeys.filter(k=>k!=='favorites').reduce((n,k)=>n+incoming[k].length,0);confirmAction('导入 '+count+' 条记录？','将与当前记录合并，相同 ID 使用导入版本。当前草稿优先保留，不覆盖其他 localStorage 项。',()=>{const merged=C.merge(db,incoming),old=db;db=merged;if(persist()){if(raw.legacyOriginal&&typeof raw.legacyOriginal==='object'){const valid={};C.legacyKeys.forEach(k=>{if(typeof raw.legacyOriginal[k]==='string'&&raw.legacyOriginal[k].length<2000000)valid[k]=raw.legacyOriginal[k];});try{const backup=C.parse(localStorage.getItem(C.BACKUP),{});localStorage.setItem(C.BACKUP,JSON.stringify(Object.assign(valid,backup)));}catch(_){toast('记录已导入，但旧版原始备份因容量不足未写入。');}}render();toast('记录已合并，可在“我的”回看。');}else db=old;});}catch(err){toast(err.message||'不是有效的心有余地备份。');}t.value='';
    }
  });
  document.addEventListener('keydown',e=>{if(state.route==='chat'&&e.target.id==='chatText'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('#chatForm').requestSubmit();}if(state.route==='attention'&&state.game?.running&&e.code==='Space'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();handlers['attention-tap']();}});
  $('#confirmDialog').addEventListener('cancel',()=>{state.confirm=null;});
  window.addEventListener('hashchange',routeChange);
  window.addEventListener('beforeunload',()=>{stopSound();stopSpeech();stopRecording();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.train?.clock.running){C.clockPause(state.train.clock);stopSpeech();if(state.route==='training')render();}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;if(state.route==='me')render();});
  const pages={home:homePage,calm:calmPage,scenario:scenarioPage,mood:moodPage,hole:holePage,tools:toolsPage,training:trainingPage,sounds:soundsPage,assessment:assessmentPage,article:articlePage,chat:chatPage,doodle:doodlePage,attention:attentionPage,bubbles:bubblesPage,me:mePage,evidence:evidencePage};
  state.pssIndex=Math.max(0,Math.min(10,db.drafts.pss?.index||0));
  applySettings();routeChange();
  if(!storageAvailable)toast('浏览器暂不能写入本地存储，记录仅在本次打开期间保留，请导出备份。');
  if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // The small public diagnostics object exposes no private content or external API.
  window.XYDiagnostics={version:3,pssScore:C.pssScore,route:()=>state.route,trainingStatus:()=>state.train?{stage:state.train.stage,remaining:C.clockRead(state.train.clock),running:state.train.clock.running}:null,audioActive:()=>!!state.audio};
})();
