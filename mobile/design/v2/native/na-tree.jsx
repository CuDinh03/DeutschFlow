// na-tree.jsx — Lộ trình "Cây học tập" v2 (khớp web v2). SVG cây mọc dọc, portrait.
// Exports: NATree, RmTabs, TREE, SKILLS, GROUP_COLORS

const SKILLS = [
  { k:'hoeren',    label:'Nghe', color:'#4F86E0', ic:'hearing' },
  { k:'lesen',     label:'Đọc',  color:'#5E9150', ic:'menu_book' },
  { k:'sprechen',  label:'Nói',  color:'#E8853A', ic:'record_voice_over' },
  { k:'schreiben', label:'Viết', color:'#8257D8', ic:'edit' },
];
const SKILL_BY = Object.fromEntries(SKILLS.map(s=>[s.k,s]));
const GROUP_COLORS = {
  daily:  { name:'Đời sống',  leaf:'#6FA85B', dark:'#4E7E3C', soft:'#B2D6A1', ic:'cottage' },
  work:   { name:'Công việc', leaf:'#5B86C9', dark:'#39599C', soft:'#AEC6E8', ic:'work' },
  travel: { name:'Du lịch',   leaf:'#C9963E', dark:'#9C6F23', soft:'#E8C788', ic:'flight' },
  medical:{ name:'Y tế',      leaf:'#3FA59B', dark:'#287A71', soft:'#98CFC8', ic:'health_and_safety' },
  culture:{ name:'Văn hóa',   leaf:'#9B7BC4', dark:'#74559E', soft:'#CBB7E4', ic:'theater_comedy' },
  exam:   { name:'Luyện thi', leaf:'#D4A53A', dark:'#A77E1C', soft:'#EED391', ic:'quiz' },
};
const BARK = { dark:'#352B21', mid:'#564636', light:'#6E5A45' };
const TCHIP = { bg:'#EFEAE0', border:'#E0D8C8', text:'#6B6457', icon:'#8A8170' };
const MS_PAL = {
  passed:     { fill:'#FFCD00', stroke:'#B8911C', glow:'#FFCD00', dashed:false },
  ready:      { fill:'#FFE27A', stroke:'#C79A1E', glow:'#FFE27A', dashed:false },
  in_progress:{ fill:'#FBFAF7', stroke:'#161513', glow:null,      dashed:false },
  locked:     { fill:'#EFEAE0', stroke:'#C9C2B6', glow:null,      dashed:true },
};
function mix(a,b,t){ const pa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)), pb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
  return '#'+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,'0')).join(''); }

const NN = (id,title,state)=>({ id, title, state });
function branch(skill, status, topicId, topicLabel, group, nodes){
  return { skill, label:SKILL_BY[skill].label, status, nodeCap:10,
    shoots:[ { topicId, topicLabel, topicGroup:group, unlockOrder:1, chosenByUser:true, nodes } ] };
}
const AD = (g,t,tl,grp,a,b,c)=>branch(g,'matured',t,tl,grp,[NN(t+'1',a,'completed'),NN(t+'2',b,'completed'),NN(t+'3',c,'completed')]);

// nguồn: GET /api/skill-tree → tree  (handoff/learning-tree-data-contract.md)
// enums KHOÁ theo contract: levelStatus completed|current|locked · milestoneState passed|ready|in_progress|locked
//   · branchStatus matured|growing|locked · nodeState completed|in_progress|available|locked · skill/topicGroup literal
const TREE = {
  user:{ id:'u1', displayName:'Lan', track:'pflege', goal:'B2', currentLevel:'B1', startedAt:'2026-03' },
  path:[
    { level:'A1', status:'completed', milestone:{ id:'m-a1', title:'Khởi đầu', state:'passed', passedAt:'04/2026' },
      branches:[ AD('hoeren','t-greet','Chào hỏi','daily','Begrüßung','Vorstellen','Familie'),
        AD('lesen','t-num','Số & giờ','daily','Zahlen','Uhrzeit','Datum'),
        AD('sprechen','t-self','Giới thiệu','daily','Ich bin…','Wohnort','Beruf'),
        AD('schreiben','t-form','Điền mẫu','work','Formular','Adresse','E-Mail') ]},
    { level:'A2', status:'completed', milestone:{ id:'m-a2', title:'Nền tảng', state:'passed', passedAt:'05/2026' },
      branches:[ AD('hoeren','t-shop','Mua sắm','daily','Im Laden','Preise','Termin'),
        AD('lesen','t-health','Sức khoẻ','medical','Körper','Apotheke','Symptome'),
        AD('sprechen','t-day','Ngày thường','daily','Tagesablauf','Hobbys','Wetter'),
        AD('schreiben','t-note','Ghi chú','work','Notiz','Nachricht','Bericht') ]},
    { level:'B1', status:'current', milestone:{ id:'m-b1', title:'Pflege B1', state:'in_progress', unlocksWhen:'4 nhánh matured' },
      branches:[ branch('hoeren','matured','t-care','Chăm sóc','medical',[NN('b1h1','Pflegeheim','completed'),NN('b1h2','Schichtdienst','completed'),NN('b1h3','Übergabe','completed')]),
        branch('lesen','growing','t-doc','Hồ sơ bệnh','medical',[NN('b1l1','Patientenakte','completed'),NN('b1l2','Medikamentenplan','in_progress'),NN('b1l3','Diagnose','available')]),
        branch('sprechen','growing','t-talk','Hội thoại viện','medical',[NN('b1s1','Vorstellung','completed'),NN('b1s2','Beim Arzt','available'),NN('b1s3','Notfall','locked')]),
        branch('schreiben','locked','t-report','Báo cáo ca','work',[NN('b1w1','Pflegebericht','available'),NN('b1w2','Dokumentation','locked')]) ]},
    { level:'B2', status:'locked', milestone:{ id:'m-b2', title:'Goethe B2', state:'locked', unlocksWhen:'Hoàn thành B1' },
      branches:[ branch('hoeren','locked','t-pro','Chuyên môn','medical',[NN('b2h1','Fachgespräch','locked'),NN('b2h2','Visite','locked')]),
        branch('lesen','locked','t-admin','Hành chính','work',[NN('b2l1','Behörde','locked'),NN('b2l2','Vertrag','locked')]),
        branch('sprechen','locked','t-deb','Trình bày','culture',[NN('b2s1','Diskussion','locked'),NN('b2s2','Präsentation','locked')]),
        branch('schreiben','locked','t-essay','Văn bản dài','work',[NN('b2w1','Stellungnahme','locked'),NN('b2w2','Beschwerde','locked')]) ]},
  ],
};
const LEVEL_CHIPS = ['A0','A1','A2','B1','B2','C1','C2'];
function levelChipState(lv){
  const order=['A0','A1','A2','B1','B2','C1','C2'];
  const cur=TREE.user.currentLevel; const ci=order.indexOf(cur);
  const i=order.indexOf(lv);
  if(i<ci) return 'passed'; if(i===ci) return 'current'; return 'locked';
}
const COMPANIONS = [['owl','Cú','🦉'],['bird','Chim','🐦'],['butterfly','Bướm','🦋'],['squirrel','Sóc','🐿️'],['none','Không',null]];

/* ── layout ── */
const CV = { w:760, cx:380 };
function layout(path){
  const groundY=1600, tierGap=300;
  const tiers=path.map((lv,i)=>({ ...lv, y:groundY-130-i*tierGap }));
  const topY = tiers.length ? tiers[tiers.length-1].y-150 : 400;
  return { tiers, groundY, topY, h:groundY+90 };
}
function branchGeom(y, idx, jit){
  const conf=[{ex:CV.cx-205,ey:y+18,side:-1},{ex:CV.cx+205,ey:y+18,side:1},{ex:CV.cx-170,ey:y-78,side:-1},{ex:CV.cx+170,ey:y-78,side:1}][idx];
  return { ...conf, ex:conf.ex+conf.side*jit, ey:conf.ey+(idx%2?-jit:jit) };
}

function SIcon({ name, x, y, size=12, fill='#fff' }){
  return <text x={x} y={y} fontFamily="'Material Symbols Outlined'" fontSize={size} fill={fill} textAnchor="middle" dominantBaseline="central" style={{pointerEvents:'none'}}>{name}</text>;
}

/* ── node motif (ripeness; skill = badge) ── */
function NodeMotif({ n, x, y, skill, rec, comp, dim, onTap }){
  const st=n.state, locked=st==='locked', sc=SKILL_BY[skill];
  return (
    <g transform={`translate(${x},${y})`} style={{cursor:locked?'default':'pointer'}} onClick={()=>!locked&&onTap(n,skill)} opacity={dim?0.18:(locked?0.4:1)}>
      {rec && <circle r="26" fill="none" stroke="#FFCD00" strokeWidth="2.5" strokeDasharray="3 5" style={{animation:'naTreeSpin 16s linear infinite'}}/>}
      {st==='in_progress' && <circle r="24" fill="#FFCD00" opacity="0.18" style={{animation:'naBloom 1.8s ease-in-out infinite'}}/>}
      {st==='completed' ? (<>
        <ellipse cx="0" cy="-17" rx="5" ry="8" fill="#5E7C3F" transform="rotate(-18)"/>
        <circle r="15" fill="url(#naRipe)" stroke="#C2611A" strokeWidth="1"/>
        <ellipse cx="-5" cy="-5" rx="4" ry="6" fill="#fff" opacity="0.45"/>
        <circle cx="12" cy="12" r="8" fill="#1E9E61" stroke="#fff" strokeWidth="1.5"/><SIcon name="check" x={12} y={12} size={11}/>
      </>) : st==='in_progress' ? (<>
        {[0,72,144,216,288].map(a=>(<ellipse key={a} cx={Math.cos(a*Math.PI/180)*11} cy={Math.sin(a*Math.PI/180)*11} rx="6.5" ry="9" fill="#F7DCE6" stroke="#E8A9C0" strokeWidth="0.8" transform={`rotate(${a+90} ${Math.cos(a*Math.PI/180)*11} ${Math.sin(a*Math.PI/180)*11})`}/>))}
        <circle r="7" fill="#FFCD00" stroke="#E0A800" strokeWidth="1"/>
      </>) : st==='available' ? (<>
        <ellipse cx="0" cy="-15" rx="4.5" ry="7" fill="#5E7C3F" transform="rotate(-20)"/>
        <circle r="12.5" fill="url(#naBud)" stroke="#6F9460" strokeWidth="1.5"/>
        <path d="M 0 -7 Q 4 0 0 8 Q -4 0 0 -7 Z" fill="#7FA86A" opacity="0.55"/>
      </>) : (<circle r="11" fill="#AEBCA4" stroke="#94A589" strokeWidth="1.2"/>)}
      <g transform="translate(-12,13)"><circle r="8.5" fill={sc.color} stroke="#fff" strokeWidth="1.5"/><SIcon name={sc.ic} x={0} y={0.5} size={10}/></g>
      {comp && <text x="20" y="-20" fontSize="24" textAnchor="middle" style={{pointerEvents:'none'}}>{comp}</text>}
    </g>
  );
}

function Milestone({ lv, x, y }){
  const s=lv.milestone.state, p=MS_PAL[s];
  return (
    <g transform={`translate(${x},${y})`}>
      {p.glow && <circle r="40" fill={p.glow} opacity="0.18" style={{animation:'naBloom 2.4s ease-in-out infinite'}}/>}
      <circle r="26" fill={p.fill} stroke={p.stroke} strokeWidth={s==='in_progress'?3.5:3} strokeDasharray={p.dashed?'5 5':'none'}/>
      {s==='passed' ? <SIcon name="workspace_premium" x={0} y={0} size={24} fill="#161513"/>
        : s==='locked' ? <SIcon name="lock" x={0} y={0} size={17} fill="#9aa593"/>
        : <text x={0} y={1} fontFamily="var(--na-display,'Newsreader',serif)" fontSize="16" fontWeight="600" fill="#161513" textAnchor="middle" dominantBaseline="central">{lv.level}</text>}
    </g>
  );
}

/* ════════ TREE ════════ */
function NATree({ onNav, state='default', tab='tree', onTab }){
  const path=TREE.path;
  const ready=state==='ready';
  const L=React.useMemo(()=>layout(path),[]);
  const [view,setView]=React.useState({s:0.46,tx:0,ty:0});
  const [fTopic,setFTopic]=React.useState(null);
  const [fSkill,setFSkill]=React.useState(null);
  const [comp,setComp]=React.useState(()=>{ try{return localStorage.getItem('lt_companion')||'owl';}catch(e){return 'owl';} });
  const [sel,setSel]=React.useState(null);
  const [lesson,setLesson]=React.useState(null);
  const [flash,setFlash]=React.useState(false);
  const g=React.useRef({down:false,x0:0,y0:0,tx:0,ty:0,moved:false,lastTap:0}).current;
  const wrapRef=React.useRef(null);

  const fitView=React.useCallback(()=>{ const el=wrapRef.current; if(!el)return; const W=el.clientWidth,H=el.clientHeight; const s=Math.min(W/CV.w,H/L.h)*1.02; setView({s,tx:(W-CV.w*s)/2,ty:H-L.h*s-4}); },[L]);
  React.useEffect(()=>{ fitView(); },[fitView]);
  React.useEffect(()=>{ try{localStorage.setItem('lt_companion',comp);}catch(e){} },[comp]);

  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const onDown=e=>{ g.down=true;g.moved=false;g.captured=false;g.pid=e.pointerId;g.el=e.currentTarget;g.x0=e.clientX;g.y0=e.clientY;g.tx=view.tx;g.ty=view.ty; };
  const onMove=e=>{ if(!g.down)return; const dx=e.clientX-g.x0,dy=e.clientY-g.y0; if(Math.abs(dx)+Math.abs(dy)>5){ if(!g.captured){ try{g.el.setPointerCapture(g.pid);g.captured=true;}catch(_){} } g.moved=true; } if(g.moved) setView(v=>({...v,tx:g.tx+dx,ty:g.ty+dy})); };
  const onUp=e=>{ if(!g.down)return; g.down=false; if(g.captured){ try{g.el.releasePointerCapture(g.pid);}catch(_){} g.captured=false; } const now=Date.now(); if(!g.moved&&now-g.lastTap<300)zoomAt(e); g.lastTap=now; };
  function zoomBy(f){ setView(v=>{ const el=wrapRef.current,W=el.clientWidth,H=el.clientHeight,ns=clamp(v.s*f,0.32,1.5),cx=W/2,cy=H/2; return {s:ns,tx:cx-(cx-v.tx)*(ns/v.s),ty:cy-(cy-v.ty)*(ns/v.s)}; }); }
  function zoomAt(e){ const el=wrapRef.current,r=el.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top; setView(v=>{ const ns=v.s<0.8?1.1:0.46; return {s:ns,tx:px-(px-v.tx)*(ns/v.s),ty:py-(py-v.ty)*(ns/v.s)}; }); }
  function doRitual(){ setFlash(true); window.gaToast&&window.gaToast('Chúc mừng! Cây của bạn đã vươn lên cấp B2 🎉'); setTimeout(()=>setFlash(false),1500); }

  const recId=React.useMemo(()=>{ const cur=path.find(l=>l.status==='current'); if(!cur)return null;
    for(const b of cur.branches){ if(b.shoots[0].chosenByUser){ const a=b.shoots[0].nodes.find(n=>n.state==='available'); if(a)return a.id; } }
    for(const b of cur.branches){ const a=b.shoots[0].nodes.find(n=>n.state==='available'); if(a)return a.id; } return null; },[]);
  const compEmoji = (COMPANIONS.find(c=>c[0]===comp)||[])[2];
  function branchDim(b){ if(fTopic&&b.shoots[0].topicGroup!==fTopic)return true; if(fSkill&&b.skill!==fSkill)return true; return false; }
  function clearF(){ setFTopic(null); setFSkill(null); }

  if(state==='empty'||state==='seed'){
    return (
      <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,#FBFAF7 0%,#F1F4EC 100%)',display:'flex',flexDirection:'column'}}>
        <TreeHeader onNav={onNav} tab={tab} onTab={onTab}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 32px',textAlign:'center'}}>
          <svg width="150" height="170" viewBox="0 0 150 170">
            <ellipse cx="75" cy="150" rx="52" ry="13" fill="#D8C8A8" opacity="0.6"/>
            <path d="M75 150 Q73 120 75 96" stroke="#6F9460" strokeWidth="6" fill="none" strokeLinecap="round" style={{animation:'naGrow 1.2s ease both'}}/>
            <path d="M75 112 Q48 104 36 84 Q60 84 75 104 Z" fill="#7FA86A" style={{animation:'naLeafIn 0.8s 0.5s ease both'}}/>
            <path d="M75 104 Q102 96 114 76 Q90 76 75 96 Z" fill="#6E9B5C" style={{animation:'naLeafIn 0.8s 0.7s ease both'}}/>
            <circle cx="75" cy="92" r="6" fill="#FFCD00"/>
          </svg>
          <h1 style={{margin:'18px 0 0',...NA.srf,fontSize:25,fontWeight:500}}>Gieo mầm hành trình, {TREE.user.displayName}</h1>
          <p style={{margin:'10px auto 0',fontSize:14,color:NA.muted,lineHeight:1.6,maxWidth:280}}>Mỗi bài học là một chiếc lá. Học đều mỗi ngày để cây tiếng Đức của bạn lớn lên và đơm quả.</p>
          <Btn variant="primary" size="lg" onClick={()=>onNav('node')} style={{marginTop:24}}><YSq size={7} color={NA.yellow}/>Bắt đầu học</Btn>
        </div>
      </div>
    );
  }
  if(state==='loading'){ return <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}><TreeHeader onNav={onNav} tab={tab} onTab={onTab}/><div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:12,color:NA.muted}}><span style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${NA.border}`,borderTopColor:NA.ink,animation:'naSpin 0.8s linear infinite'}}/><span style={{fontSize:13.5,fontWeight:600}}>Đang tải cây học tập…</span></div></div>; }
  if(state==='error'){ return <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}><TreeHeader onNav={onNav} tab={tab} onTab={onTab}/><div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:40,textAlign:'center'}}><NAIcon name="cloud_off" size={42} color={NA.subtle}/><div style={{...NA.srf,fontSize:20,fontWeight:500}}>Không thể tải cây học tập.</div><Btn variant="ghost" onClick={()=>onTab&&onTab('tree')}><NAIcon name="refresh" size={18}/>Thử lại</Btn></div></div>; }

  return (
    <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,#FBFAF7 0%,#EEF3E6 62%,#E4EDD7 100%)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <TreeHeader onNav={onNav} tab={tab} onTab={onTab}/>

      {/* filter + companion bar */}
      <div style={{position:'absolute',top:SAFE_TOP+86,left:0,right:0,zIndex:7,padding:'0 0 6px'}}>
        <div className="na-scroll" style={{display:'flex',alignItems:'center',gap:7,overflowX:'auto',padding:'2px 14px 8px',whiteSpace:'nowrap'}}>
          <span style={{font:`700 11px/1 'Instrument Sans'`,color:NA.muted,flexShrink:0}}>Lọc:</span>
          {Object.entries(GROUP_COLORS).map(([k,g])=>{ const on=fTopic===k; return (
            <button key={k} onClick={()=>setFTopic(on?null:k)} className="na-press" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:5,padding:'7px 10px',borderRadius:99,cursor:'pointer',background:on?NA.ink:TCHIP.bg,border:`1px solid ${on?NA.ink:TCHIP.border}`,color:on?'#fff':TCHIP.text,font:`600 11.5px/1 'Instrument Sans'`}}><span className="material-symbols-outlined" style={{fontSize:14,color:on?'#fff':TCHIP.icon}}>{g.ic}</span>{g.name}</button>
          ); })}
          <span style={{color:NA.faint,flexShrink:0}}>·</span>
          {SKILLS.map(s=>{ const on=fSkill===s.k; return (
            <button key={s.k} onClick={()=>setFSkill(on?null:s.k)} className="na-press" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:5,padding:'7px 10px',borderRadius:99,cursor:'pointer',background:on?s.color:NA.card,border:`1px solid ${on?s.color:NA.border}`,color:on?'#fff':s.color,font:`700 11.5px/1 'Instrument Sans'`}}><span className="material-symbols-outlined" style={{fontSize:14,color:on?'#fff':s.color}}>{s.ic}</span>{s.label}</button>
          ); })}
          {(fTopic||fSkill) && <button onClick={clearF} className="na-press" style={{flexShrink:0,padding:'7px 11px',borderRadius:99,background:NA.card,border:`1px solid ${NA.border}`,cursor:'pointer',font:`700 11.5px/1 'Instrument Sans'`,color:NA.ink}}>Tất cả</button>}
          <span style={{width:6,flexShrink:0}}/>
          <span style={{font:`700 11px/1 'Instrument Sans'`,color:NA.muted,flexShrink:0}}>Bạn đồng hành:</span>
          {COMPANIONS.map(([k,l,e])=>{ const on=comp===k; return (
            <button key={k} onClick={()=>setComp(k)} className="na-press" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:99,cursor:'pointer',background:on?naSoft(NA.gold,'subtle'):NA.card,border:`1px solid ${on?NA.gold:NA.border}`,color:on?NA.ink:NA.muted,font:`600 11.5px/1 'Instrument Sans'`}}>{e&&<span style={{fontSize:14}}>{e}</span>}{l}</button>
          ); })}
        </div>
      </div>

      {/* canvas hint + toàn cảnh */}
      <div style={{position:'absolute',top:SAFE_TOP+128,left:14,zIndex:7,display:'inline-flex',alignItems:'center',gap:6,padding:'7px 11px',borderRadius:99,background:'rgba(251,250,247,0.9)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:`1px solid ${NA.border}`,pointerEvents:'none'}}><NAIcon name="touch_app" size={14} color={NA.gold}/><span style={{font:`600 11.5px/1 'Instrument Sans'`,color:NA.ink}}>Chạm vào lá đang sáng để học</span></div>
      <button onClick={fitView} className="na-press" style={{position:'absolute',top:SAFE_TOP+124,right:14,zIndex:7,display:'inline-flex',alignItems:'center',gap:6,padding:'9px 13px',borderRadius:99,background:NA.card,border:`1px solid ${NA.border}`,cursor:'pointer',font:`700 11.5px/1 'Instrument Sans'`,color:NA.ink,boxShadow:'0 4px 12px rgba(22,21,19,0.08)'}}><NAIcon name="fit_screen" size={15} color={NA.muted}/>Toàn cảnh</button>

      {/* canvas */}
      <div ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{position:'absolute',inset:0,touchAction:'none',cursor:g.down?'grabbing':'grab'}}>
        <svg width="100%" height="100%" style={{display:'block'}}>
          <defs>
            <radialGradient id="naRipe" cx="38%" cy="34%" r="68%"><stop offset="0%" stopColor="#F6B85A"/><stop offset="55%" stopColor="#EE8C2E"/><stop offset="100%" stopColor="#D86E1C"/></radialGradient>
            <radialGradient id="naBud" cx="40%" cy="36%" r="70%"><stop offset="0%" stopColor="#B6D49E"/><stop offset="100%" stopColor="#7FA86A"/></radialGradient>
            <linearGradient id="naTrunk" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={BARK.dark}/><stop offset="100%" stopColor={BARK.light}/></linearGradient>
          </defs>
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
            <TreeBody L={L} recId={recId} compEmoji={compEmoji} dimFn={branchDim} onTap={(n,skill,sh)=>setSel({n,skill,sh})}/>
          </g>
        </svg>
      </div>

      {/* legend */}
      <Legend/>

      {/* zoom */}
      <div style={{position:'absolute',right:14,bottom:HOME_IND+TAB_H+92,display:'flex',flexDirection:'column',gap:8}}>
        {[['add',()=>zoomBy(1.3)],['remove',()=>zoomBy(1/1.3)]].map(([ic,fn])=>(<button key={ic} onClick={fn} aria-label={ic==='add'?'Phóng to':'Thu nhỏ'} className="na-press" style={{width:42,height:42,borderRadius:'50%',background:NA.card,border:`1px solid ${NA.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(22,21,19,0.1)'}}><NAIcon name={ic} size={22} color={NA.ink}/></button>))}
      </div>

      {ready && (
        <div style={{position:'absolute',left:16,right:16,bottom:HOME_IND+TAB_H+150,background:NA.ink,borderRadius:'var(--na-radius,4px)',padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 12px 30px rgba(22,21,19,0.25)',zIndex:9}}>
          <NAIcon name="auto_awesome" size={24} fill color={NA.yellow}/>
          <div style={{flex:1}}><div style={{font:`700 13px/1.2 'Instrument Sans'`,color:NA.bg}}>Đủ 4 nhánh · sẵn sàng lên cấp!</div><div style={{fontSize:11.5,color:'#A39E94',marginTop:3}}>Cây của bạn đã trưởng thành ở B1.</div></div>
          <Btn variant="yellow" size="sm" onClick={doRitual}>Lên cấp B2</Btn>
        </div>
      )}
      {flash && <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 55%, rgba(255,205,0,0.6), rgba(255,205,0,0) 70%)',animation:'naFlash 1.5s ease both',pointerEvents:'none',zIndex:15}}/>}

      {sel && !lesson && <NodeSheet sel={sel} onClose={()=>setSel(null)} onStart={()=>setLesson(sel)}/>}
      {lesson && <NodeLessonPanel sel={lesson} onBack={()=>{setLesson(null);setSel(null);}} onComplete={()=>{ window.gaToast&&window.gaToast('Đã hoàn thành — cây lớn thêm một chút 🌱'); setLesson(null); setSel(null); }}/>}
    </div>
  );
}

function RmTabs({ tab, onTab }){
  if(!onTab) return null;
  return (
    <div style={{display:'flex',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden',flexShrink:0}}>
      {[['tree','Cây học tập'],['phase','Giai đoạn']].map(([k,l])=>(<button key={k} onClick={()=>onTab(k)} className="na-press" style={{padding:'7px 11px',background:tab===k?NA.ink:NA.card,color:tab===k?NA.bg:NA.muted,border:'none',cursor:'pointer',font:`700 11px/1 'Instrument Sans'`}}>{l}</button>))}
    </div>
  );
}

function TreeHeader({ onNav, tab, onTab }){
  return (
    <div className="na-headerglass" style={{position:'absolute',top:0,left:0,right:0,zIndex:8,paddingTop:SAFE_TOP}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px 8px'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.05,letterSpacing:'-0.01em'}}>Lộ trình học</div>
          <div style={{fontSize:11,color:NA.muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Cây học tập của bạn · mỗi nhánh là một kỹ năng, mỗi lá là một bài học — chạm để học</div>
        </div>
        <RmTabs tab={tab} onTab={onTab}/>
      </div>
      {/* level chip row */}
      <div className="na-scroll" style={{display:'flex',alignItems:'center',gap:6,overflowX:'auto',padding:'0 14px 10px',whiteSpace:'nowrap'}}>
        <span style={{font:`600 12px/1 'Instrument Sans'`,color:NA.ink,flexShrink:0,marginRight:2}}>{TREE.user.displayName}<span style={{color:NA.muted,fontWeight:400}}> · {TREE.user.goal}</span></span>
        {LEVEL_CHIPS.map(lv=>{ const s=levelChipState(lv); const passed=s==='passed',cur=s==='current';
          return (<span key={lv} style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:4,padding:'5px 9px',borderRadius:99,
            background:cur?NA.ink:passed?naSoft(NA.yellow,'subtle'):'transparent',
            border:`1px solid ${cur?NA.ink:passed?NA.gold:NA.border}`,
            color:cur?NA.bg:passed?NA.ink:NA.faint,font:`700 11px/1 'Instrument Sans'`}}>
            {passed&&<span className="material-symbols-outlined" style={{fontSize:12,color:NA.gold}}>check</span>}{lv}
            {cur&&<span style={{color:NA.yellow,fontSize:9,fontWeight:700}}>đang</span>}</span>);
        })}
      </div>
    </div>
  );
}

function Legend(){
  return (
    <div className="na-scroll" style={{position:'absolute',left:0,right:0,bottom:HOME_IND+TAB_H+8,zIndex:7,display:'flex',alignItems:'center',gap:13,overflowX:'auto',padding:'8px 14px',whiteSpace:'nowrap',background:'linear-gradient(180deg,rgba(228,237,215,0) 0%,rgba(228,237,215,0.85) 60%)'}}>
      {Object.values(GROUP_COLORS).map(g=>(<span key={g.name} style={{display:'inline-flex',alignItems:'center',gap:5,flexShrink:0}}><span style={{width:11,height:11,borderRadius:3,background:g.leaf}}/><span style={{font:`600 11px/1 'Instrument Sans'`,color:NA.muted}}>{g.name}</span></span>))}
      <span style={{width:1,height:14,background:NA.border,flexShrink:0}}/>
      {SKILLS.map(s=>(<span key={s.k} style={{display:'inline-flex',alignItems:'center',gap:5,flexShrink:0}}><span style={{width:11,height:11,borderRadius:'50%',background:s.color}}/><span style={{font:`700 11px/1 'Instrument Sans'`,color:NA.ink}}>{s.label}</span></span>))}
    </div>
  );
}

/* ── tree body ── */
function TreeBody({ L, recId, compEmoji, dimFn, onTap }){
  const { tiers, groundY, topY }=L;
  const baseW=46, topW=11, yb=groundY+30, yt=topY, Nn=10, pts=[];
  for(let i=0;i<=Nn;i++){ const t=i/Nn,y=yb+(yt-yb)*t,w=baseW+(topW-baseW)*t,sw=Math.sin(t*2.4)*10*(1-t); pts.push([CV.cx-w/2+sw,y]); }
  for(let i=Nn;i>=0;i--){ const t=i/Nn,y=yb+(yt-yb)*t,w=baseW+(topW-baseW)*t,sw=Math.sin(t*2.4)*10*(1-t); pts.push([CV.cx+w/2+sw,y]); }
  const trunkD='M '+pts.map(p=>p.join(' ')).join(' L ')+' Z';
  return (
    <g>
      <ellipse cx={CV.cx} cy={groundY+34} rx="220" ry="34" fill="#D8C8A8" opacity="0.55"/>
      <ellipse cx={CV.cx} cy={groundY+30} rx="150" ry="22" fill="#C9B68F" opacity="0.5"/>
      <path d={trunkD} fill="url(#naTrunk)" stroke={BARK.dark} strokeWidth="1.5"/>
      {/* crown */}
      <g opacity="0.92">
        {[[CV.cx-40,topY-6,46],[CV.cx+38,topY-2,52],[CV.cx,topY-46,58],[CV.cx-70,topY+30,40],[CV.cx+74,topY+26,44]].map((c,i)=>(<ellipse key={i} cx={c[0]} cy={c[1]} rx={c[2]} ry={c[2]*0.82} fill={i%2?'#4E7E3C':'#6FA85B'} opacity={0.55+0.1*(i%3)}/>))}
        <text x={CV.cx} y={topY-44} fontFamily="var(--na-display,'Newsreader',serif)" fontSize="15" fontWeight="600" fill="#fff" textAnchor="middle" dominantBaseline="central">{TREE.user.goal}</text>
      </g>
      {tiers.map((lv,ti)=>(
        <g key={lv.level}>
          {lv.branches.map((b,bi)=>{
            const gm=branchGeom(lv.y,bi,6+ti*2), ax=CV.cx+gm.side*14, ay=lv.y-(bi>=2?40:0);
            const cxp=(ax+gm.ex)/2+gm.side*30, cyp=(ay+gm.ey)/2-36, limbD=`M ${ax} ${ay} Q ${cxp} ${cyp} ${gm.ex} ${gm.ey}`;
            const sh=b.shoots[0], grp=GROUP_COLORS[sh.topicGroup], sk=SKILL_BY[b.skill];
            const matured=b.status==='matured', locked=b.status==='locked', dim=dimFn(b);
            const limbCol=mix(BARK.mid, sk.color, 0.22);
            const nodes=sh.nodes;
            return (
              <g key={bi} opacity={dim?0.16:1}>
                <path d={limbD} fill="none" stroke={limbCol} strokeWidth={locked?5:9} strokeLinecap="round" opacity={locked?0.6:1}/>
                <g opacity={locked?0.45:1}>
                  {[[0,0,46],[-30,-10,34],[28,-14,32],[-14,24,30],[24,22,30]].map((c,i)=>(<ellipse key={i} cx={gm.ex+c[0]} cy={gm.ey+c[1]} rx={c[2]*(matured?1.12:1)} ry={c[2]*0.84} fill={i%2?grp.dark:grp.leaf} opacity={0.5+0.08*(i%3)}/>))}
                </g>
                {nodes.map((n,ni)=>{ const off=[[0,-6],[-30,18],[30,16],[0,40]][ni]||[0,0];
                  return <NodeMotif key={n.id} n={n} x={gm.ex+off[0]} y={gm.ey+off[1]} skill={b.skill} rec={n.id===recId} comp={n.id===recId?compEmoji:null} onTap={(nn,s)=>onTap(nn,s,sh)}/>; })}
                {!locked && (<g transform={`translate(${ax+gm.side*46},${ay-6})`}>
                  <rect x={gm.side>0?-4:-110} y="-13" width="114" height="26" rx="13" fill={TCHIP.bg} stroke={TCHIP.border} strokeWidth="1"/>
                  <g transform={`translate(${gm.side>0?12:-96},0)`}><SIcon name={grp.ic} x={0} y={0} size={13} fill={TCHIP.icon}/></g>
                  <text x={gm.side>0?28:-80} y="1" fontFamily="'Instrument Sans',sans-serif" fontSize="11" fontWeight="600" fill={TCHIP.text} dominantBaseline="central">{sh.topicLabel}</text>
                </g>)}
              </g>
            );
          })}
          <Milestone lv={lv} x={CV.cx} y={lv.y}/>
        </g>
      ))}
      <g transform={`translate(${CV.cx},${groundY+8})`}><circle r="16" fill="#fff" stroke="#6F9460" strokeWidth="2.5"/><SIcon name="eco" x={0} y={0} size={18} fill="#5E9150"/></g>
    </g>
  );
}

/* ── quick sheet ── */
function NodeSheet({ sel, onClose, onStart }){
  const sk=SKILL_BY[sel.skill], st=sel.n.state, grp=GROUP_COLORS[sel.sh.topicGroup];
  const stMap={ completed:['Quả chín · hoàn thành',NA.green,'check_circle'], in_progress:['Hoa nở · học dở',NA.gold,'local_florist'], available:['Nụ · sẵn sàng',NA.teal,'spa'], locked:['Khoá',NA.subtle,'lock'] };
  const [lbl,col,ic]=stMap[st];
  return (
    <div style={{position:'absolute',inset:0,background:'rgba(20,19,17,0.4)',display:'flex',flexDirection:'column',justifyContent:'flex-end',zIndex:40}}>
      <div onClick={onClose} style={{position:'absolute',inset:0}}/>
      <div style={{position:'relative',background:NA.card,borderTopLeftRadius:18,borderTopRightRadius:18,padding:`10px 22px ${HOME_IND+18}px`,animation:'naSheetUp 0.3s ease both'}}>
        <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 16px'}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:11,flexWrap:'wrap'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:99,background:naSoft(sk.color,'subtle'),color:sk.color,font:`700 11px/1 'Instrument Sans'`}}><NAIcon name={sk.ic} size={14} color={sk.color}/>{sk.label}</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:99,background:naSoft(col,'subtle'),color:col,font:`700 11px/1 'Instrument Sans'`}}><NAIcon name={ic} size={13} color={col}/>{lbl}</span>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:5,font:`700 10.5px/1 'Instrument Sans'`,letterSpacing:'0.04em',color:grp.dark,marginBottom:7}}><span style={{width:9,height:9,borderRadius:2,background:grp.leaf}}/>{grp.name.toUpperCase()} · {sel.sh.topicLabel}</div>
        <div style={{...NA.srf,fontSize:25,fontWeight:500,letterSpacing:'-0.01em',lineHeight:1.2,marginBottom:18}}>{sel.n.title}</div>
        {st==='locked' ? <Btn variant="ghost" size="lg" full onClick={onClose}><NAIcon name="lock" size={18}/>Hoàn thành lá trước để mở</Btn>
          : <Btn variant="primary" size="lg" full onClick={onStart}><NAIcon name={st==='completed'?'replay':'play_arrow'} size={20} fill weight={500} color={NA.yellow}/>{st==='in_progress'?'Tiếp tục học':st==='completed'?'Xem lại bài':'Bắt đầu học'}</Btn>}
      </div>
    </div>
  );
}

/* ── lesson panel (full overlay) ── */
function lessonFor(n, sk, grp){
  return { de:`„${n.title}" — ein wichtiges Wort im Bereich ${GROUP_COLORS[grp].name}.`,
    vi:`"${n.title}" là một từ/chủ điểm quan trọng trong nhóm ${GROUP_COLORS[grp].name}.`,
    tip:'Mẹo: chú ý mạo từ (der/die/das) và vị trí động từ trong câu.',
    q:{ prompt:`"${n.title}" thuộc nhóm chủ đề nào?`, opts:[GROUP_COLORS[grp].name,'Du lịch','Văn hóa'], a:0 } };
}
function NodeLessonPanel({ sel, onBack, onComplete }){
  const sk=SKILL_BY[sel.skill], grp=sel.sh.topicGroup, G=GROUP_COLORS[grp];
  const ct=React.useMemo(()=>lessonFor(sel.n,sk,grp),[]);
  const [pick,setPick]=React.useState(null);
  const [checked,setChecked]=React.useState(false);
  const ok=pick===ct.q.a;
  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,zIndex:41,display:'flex',flexDirection:'column',animation:'naScrPush 0.32s cubic-bezier(0.32,0.72,0,1) both'}}>
      {/* header */}
      <div style={{flexShrink:0,paddingTop:SAFE_TOP,background:G.soft,borderBottom:`3px solid ${G.leaf}`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px 12px'}}>
          <button onClick={onBack} aria-label="Quay lại cây" className="na-press" style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.7)',border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="arrow_back" size={22} color={G.dark}/></button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:`700 10px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:G.dark}}>{sk.label} · {sel.sh.topicLabel}</div>
            <div style={{...NA.srf,fontSize:21,fontWeight:500,lineHeight:1.15,marginTop:3}}>{sel.n.title}</div>
          </div>
        </div>
      </div>
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'18px 20px 16px'}}>
        <Card style={{marginBottom:14}}>
          <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.4}}>{ct.de}</div>
          <div style={{fontSize:13.5,color:NA.muted,marginTop:8,fontStyle:'italic',lineHeight:1.5}}>{ct.vi}</div>
          <div style={{display:'flex',gap:9,marginTop:14,padding:'11px 13px',background:naSoft(NA.gold,'subtle'),borderRadius:'var(--na-radius,4px)'}}><NAIcon name="lightbulb" size={18} color={NA.gold}/><span style={{fontSize:13,color:NA.ink,lineHeight:1.5}}>{ct.tip}</span></div>
        </Card>
        <Cap style={{padding:'4px 2px 10px'}}>Kiểm tra nhanh</Cap>
        <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.3,marginBottom:14}}>{ct.q.prompt}</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {ct.q.opts.map((o,i)=>{ const on=pick===i; let bg=NA.card,bd=NA.border,cc=NA.ink;
            if(checked){ if(i===ct.q.a){bg=naSoft(NA.green,'subtle');bd=NA.green;cc=NA.green;} else if(on){bg=naSoft(NA.red,'subtle');bd=NA.red;cc=NA.red;} } else if(on){bg=naSoft(NA.yellow,'subtle');bd=NA.gold;}
            return <button key={i} onClick={()=>!checked&&setPick(i)} className="na-press" style={{display:'flex',alignItems:'center',gap:12,padding:'15px',borderRadius:'var(--na-radius,4px)',cursor:checked?'default':'pointer',textAlign:'left',background:bg,border:`${(on||(checked&&i===ct.q.a))?2:1}px solid ${bd}`}}><span style={{flex:1,fontSize:15,fontWeight:on?600:500,color:cc}}>{o}</span>{checked&&i===ct.q.a&&<NAIcon name="check_circle" size={20} fill color={NA.green}/>}</button>;
          })}
        </div>
        {checked && <div style={{marginTop:14,padding:'12px 14px',borderRadius:'var(--na-radius,4px)',background:ok?naSoft(NA.green,'subtle'):naSoft(NA.orange,'subtle'),color:ok?NA.green:NA.orange,font:`600 13.5px/1.5 'Instrument Sans'`}}>{ok?'Chính xác! 🌱':'Chưa đúng — xem lại đáp án đúng phía trên.'}</div>}
      </div>
      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`14px 20px ${HOME_IND+12}px`}}>
        {!checked ? <Btn variant="primary" size="lg" full onClick={()=>pick!==null&&setChecked(true)} style={{opacity:pick===null?0.5:1}}>Kiểm tra</Btn>
          : <Btn variant="primary" size="lg" full onClick={onComplete}><YSq size={7} color={NA.yellow}/>Hoàn thành lá này</Btn>}
      </div>
    </div>
  );
}

Object.assign(window, { NATree, RmTabs, TREE, SKILLS, GROUP_COLORS });
