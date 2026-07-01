// na-lessons.jsx — Thư viện video bài học (n12) + Trình phát (n13)
//   Exports: NALessons, NALessonPlayer, openLesson, LESSONS
// nguồn: GET /api/lessons?type&level ; GET /api/lessons/{id} ; PUT /api/lessons/{id}/progress

const LESSONS = {
  resume: { id:'l2', title:'Im Krankenhaus — Aufnahmegespräch', sub:'Hội thoại · B1', pct:46, left:'còn 7 phút', hue:'#2F6FC9', scene:'Tiếp nhận bệnh nhân' },
  items: [
    { id:'l1', title:'Sich vorstellen im Pflegeheim', type:'Hội thoại', level:'A2', min:9,  pct:100, hue:'#1E9E61', tag:'Đã xong' },
    { id:'l2', title:'Im Krankenhaus — Aufnahmegespräch', type:'Hội thoại', level:'B1', min:13, pct:46,  hue:'#2F6FC9' },
    { id:'l3', title:'Trennbare Verben in der Pflege', type:'Ngữ pháp', level:'B1', min:11, pct:0,   hue:'#7C56C8' },
    { id:'l4', title:'Der Körper — Phát âm & trọng âm', type:'Phát âm', level:'A2', min:8,  pct:20,  hue:'#E07B39' },
    { id:'l5', title:'Dativ: helfen, danken, gehören', type:'Ngữ pháp', level:'B1', min:12, pct:0,   hue:'#7C56C8' },
    { id:'l6', title:'Notfall! — Telefongespräch 112', type:'Hội thoại', level:'B2', min:10, pct:0,   hue:'#DA291C', locked:true },
  ],
};

const LESSON_FILTERS = [['all','Tất cả'],['Hội thoại','Hội thoại'],['Ngữ pháp','Ngữ pháp'],['Phát âm','Phát âm']];

let LESSON_SEL = 'l2';
function openLesson(onNav, id){ LESSON_SEL = id; onNav('lesson-player'); }
window.naGetLesson = ()=> LESSONS.items.find(l=>l.id===LESSON_SEL) || LESSONS.items[1];

/* striped thumbnail surface with play affordance */
function Thumb({ hue, min, pct, locked, big=false }){
  return (
    <div style={{position:'relative',width:big?'100%':96,height:big?180:64,flexShrink:0,borderRadius:'var(--na-radius,4px)',overflow:'hidden',
      background:`linear-gradient(135deg, ${naSoft(hue,'bold')}, ${naSoft(hue,'subtle')})`, border:`1px solid ${NA.border}`}}>
      <div style={{position:'absolute',inset:0,backgroundImage:`repeating-linear-gradient(135deg, ${naSoft(hue,'subtle')} 0 10px, transparent 10px 20px)`}}/>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:big?56:36,height:big?56:36,borderRadius:'50%',background:'rgba(255,255,255,0.92)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(22,21,19,0.18)'}}>
          <NAIcon name={locked?'lock':'play_arrow'} size={big?30:20} fill color={locked?NA.subtle:hue}/>
        </div>
      </div>
      <span style={{position:'absolute',bottom:6,right:6,background:'rgba(22,21,19,0.74)',color:'#fff',font:`600 10px/1 'Instrument Sans'`,padding:'4px 6px',borderRadius:3}}>{min}:00</span>
      {pct>0 && pct<100 && <div style={{position:'absolute',left:0,right:0,bottom:0,height:3,background:'rgba(255,255,255,0.4)'}}><div style={{width:`${pct}%`,height:'100%',background:NA.yellow}}/></div>}
    </div>
  );
}

function LessonRow({ l, onNav, last }){
  return (
    <button onClick={()=>!l.locked&&openLesson(onNav,l.id)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'13px 16px',background:'none',border:'none',borderBottom:last?'none':`1px solid ${NA.border}`,cursor:l.locked?'default':'pointer',textAlign:'left',opacity:l.locked?0.6:1}}>
      <Thumb hue={l.hue} min={l.min} pct={l.pct} locked={l.locked}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
          <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.muted}}>{l.type}</span>
          <Pill tone="ink">{l.level}</Pill>
        </div>
        <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.25}}>{l.title}</div>
        <div style={{fontSize:11.5,marginTop:5,color:l.pct===100?NA.green:NA.muted,fontWeight:l.pct===100?600:400}}>
          {l.locked?'Mở khoá ở B2':l.pct===100?'✓ Hoàn thành':l.pct>0?`Đang xem · ${l.pct}%`:`${l.min} phút`}
        </div>
      </div>
      <NAIcon name={l.locked?'lock':'chevron_right'} size={l.locked?17:20} color={NA.faint} style={{flexShrink:0}}/>
    </button>
  );
}

function NALessons({ onNav, state='default' }){
  const [f,setF] = React.useState('all');
  const list = LESSONS.items.filter(l=> f==='all' || l.type===f);

  if (state==='loading'){
    return (
      <Page title="Video bài học" dateCap="Thư viện · Pflege" back="Hôm nay" onBack={()=>onNav('home')} hasTab={false}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:12}}>
          {[0,1,2,3].map(i=>(<div key={i} style={{display:'flex',gap:13,padding:'4px 0'}}><div style={{width:96,height:64,borderRadius:4,background:`linear-gradient(90deg,${NA.border} 25%,${NA.hair} 50%,${NA.border} 75%)`,backgroundSize:'200% 100%',animation:'naShimmer 1.4s linear infinite'}}/><div style={{flex:1}}><div style={{width:'40%',height:10,background:NA.border,borderRadius:4}}/><div style={{width:'80%',height:15,marginTop:9,background:NA.border,borderRadius:4}}/><div style={{width:'30%',height:10,marginTop:9,background:NA.border,borderRadius:4}}/></div></div>))}
        </div>
      </Page>
    );
  }

  return (
    <Page title="Video bài học" dateCap="Thư viện · Pflege" back="Hôm nay" onBack={()=>onNav('home')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* resume hero */}
        <button onClick={()=>openLesson(onNav,LESSONS.resume.id)} className="na-press" style={{background:'none',border:'none',padding:0,cursor:'pointer',textAlign:'left',width:'100%'}}>
          <Thumb hue={LESSONS.resume.hue} min={13} pct={LESSONS.resume.pct} big/>
          <div style={{marginTop:11}}>
            <Cap color={NA.gold} style={{marginBottom:6}}>Tiếp tục xem · {LESSONS.resume.left}</Cap>
            <div style={{...NA.srf,fontSize:19,fontWeight:500,lineHeight:1.25}}>{LESSONS.resume.title}</div>
            <div style={{fontSize:12.5,color:NA.muted,marginTop:5}}>{LESSONS.resume.sub} · cảnh „{LESSONS.resume.scene}"</div>
          </div>
        </button>

        {/* filters */}
        <div className="na-scroll" style={{display:'flex',gap:8,overflowX:'auto',margin:'0 -20px',padding:'0 20px'}}>
          {LESSON_FILTERS.map(([k,l])=>{
            const on = f===k;
            return <button key={k} onClick={()=>setF(k)} className="na-press" style={{flexShrink:0,padding:'9px 15px',borderRadius:'var(--na-radius,4px)',border:`1px solid ${on?NA.ink:NA.border}`,background:on?NA.ink:NA.card,color:on?NA.bg:NA.muted,font:`600 12.5px/1 'Instrument Sans'`,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>;
          })}
        </div>

        {/* list / empty */}
        {list.length===0 ? (
          <div style={{padding:'30px 20px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <NAIcon name="video_library" size={40} color={NA.subtle}/>
            <div style={{...NA.srf,fontSize:18,fontWeight:500}}>Chưa có bài học mục này</div>
            <Btn variant="ghost" size="sm" onClick={()=>setF('all')}>Xem tất cả</Btn>
          </div>
        ) : (
          <Card pad={0}>
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <Cap>{f==='all'?'Tất cả bài học':f}</Cap><Cap color={NA.gold}>{list.length} video</Cap>
            </div>
            {list.map((l,i)=>(<LessonRow key={l.id} l={l} onNav={onNav} last={i===list.length-1}/>))}
          </Card>
        )}
      </div>
    </Page>
  );
}

/* ════════ TRÌNH PHÁT VIDEO ════════ */
function NALessonPlayer({ onNav, state='default' }){
  const l = window.naGetLesson();
  const [playing,setPlaying] = React.useState(false);
  const [t,setT] = React.useState(Math.round((l.pct||0)/100 * l.min*60));
  const total = l.min*60;
  const subs = [
    { de:'Guten Tag, mein Name ist Lan Nguyễn.', vi:'Xin chào, tôi tên là Lan Nguyễn.' },
    { de:'Ich arbeite als Pflegekraft auf dieser Station.', vi:'Tôi làm điều dưỡng tại khoa này.' },
    { de:'Kann ich Ihnen bei der Aufnahme helfen?', vi:'Tôi có thể giúp anh/chị làm thủ tục nhập viện không?' },
  ];
  const subIdx = Math.min(subs.length-1, Math.floor(t/total * subs.length));
  React.useEffect(()=>{
    if(!playing) return;
    const id = setInterval(()=> setT(p=> p>=total ? (clearInterval(id), total) : p+1), 250);
    return ()=>clearInterval(id);
  },[playing,total]);
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const scenes = [
    { t:'Begrüßung', at:'0:00', done:t>0 },
    { t:'Aufnahmegespräch', at:'3:20', done:t>200 },
    { t:'Wortschatz-Übung', at:'7:45', done:t>465 },
    { t:'Zusammenfassung', at:'11:10', done:t>670 },
  ];

  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {/* video surface */}
      <div style={{position:'relative',width:'100%',aspectRatio:'16/9',background:'#161513',flexShrink:0,paddingTop:SAFE_TOP*0}}>
        <div style={{position:'absolute',inset:0,backgroundImage:`repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 14px, transparent 14px 28px)`}}/>
        <button onClick={()=>onNav('lessons')} className="na-press" aria-label="Đóng" style={{position:'absolute',top:SAFE_TOP-6,left:14,zIndex:5,width:38,height:38,borderRadius:'50%',background:'rgba(0,0,0,0.4)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><NAIcon name="close" size={22} color="#fff"/></button>
        {state==='error' ? (
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'#fff',padding:20,textAlign:'center'}}>
            <NAIcon name="error" size={38} color="#fff"/><div style={{fontSize:14}}>Không phát được video</div>
            <Btn variant="yellow" size="sm" onClick={()=>onNav('lesson-player')}>Thử lại</Btn>
          </div>
        ) : (
          <>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <button onClick={()=>setPlaying(p=>!p)} className="na-press" style={{width:64,height:64,borderRadius:'50%',background:'rgba(255,255,255,0.92)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 6px 20px rgba(0,0,0,0.3)'}}>
                <NAIcon name={state==='loading'?'progress_activity':playing?'pause':'play_arrow'} size={34} fill color={NA.ink} style={state==='loading'?{animation:'naSpin 1s linear infinite'}:{}}/>
              </button>
            </div>
            {/* subtitle overlay */}
            <div style={{position:'absolute',left:0,right:0,bottom:30,padding:'0 18px',textAlign:'center'}}>
              <div style={{...NA.srf,fontSize:16,fontWeight:500,color:'#fff',lineHeight:1.3,textShadow:'0 1px 6px rgba(0,0,0,0.6)'}}>{subs[subIdx].de}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.78)',marginTop:5}}>{subs[subIdx].vi}</div>
            </div>
            {/* scrubber */}
            <div style={{position:'absolute',left:0,right:0,bottom:0,padding:'0 14px 10px'}}>
              <input type="range" min={0} max={total} value={t} onChange={e=>setT(+e.target.value)} style={{width:'100%',accentColor:NA.yellow,height:4}}/>
              <div style={{display:'flex',justifyContent:'space-between',font:`600 10.5px/1 'Instrument Sans'`,color:'rgba(255,255,255,0.8)',marginTop:2}}><span>{fmt(t)}</span><span>{fmt(total)}</span></div>
            </div>
          </>
        )}
      </div>

      {/* meta + scenes */}
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'16px 20px',paddingBottom:HOME_IND+18}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
          <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.muted}}>{l.type}</span><Pill tone="ink">{l.level}</Pill>
        </div>
        <h1 style={{margin:0,...NA.srf,fontSize:23,fontWeight:500,lineHeight:1.18}}>{l.title}</h1>
        <p style={{margin:'8px 0 0',fontSize:13.5,color:NA.muted,lineHeight:1.5}}>Video có phụ đề tiếng Đức và bản dịch. Hoàn thành để mở bài tập đi kèm.</p>

        <div style={{display:'flex',gap:10,margin:'16px 0'}}>
          <Btn variant="primary" full onClick={()=>setPlaying(p=>!p)}><NAIcon name={playing?'pause':'play_arrow'} size={19} color={NA.yellow}/>{playing?'Tạm dừng':'Tiếp tục xem'}</Btn>
          <Btn variant="ghost" onClick={()=>window.gaToast&&window.gaToast('Đã lưu để xem offline')}><NAIcon name="download" size={18}/></Btn>
        </div>

        <Card pad={0} style={{marginBottom:14}}>
          <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>Các cảnh</Cap></div>
          {scenes.map((s,i)=>(
            <button key={i} onClick={()=>{ const sec=s.at.split(':'); setT(+sec[0]*60+ +sec[1]); }} className="na-tap" style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'13px 16px',background:'none',border:'none',borderBottom:i<scenes.length-1?`1px solid ${NA.border}`:'none',cursor:'pointer',textAlign:'left'}}>
              <NAIcon name={s.done?'check_circle':'play_circle'} size={20} fill={s.done} color={s.done?NA.green:NA.subtle}/>
              <span style={{flex:1,fontSize:14,fontWeight:500}}>{s.t}</span>
              <span style={{fontSize:12,color:NA.subtle,fontVariantNumeric:'tabular-nums'}}>{s.at}</span>
            </button>
          ))}
        </Card>

        {/* attached exercise */}
        <Card accent={NA.yellow} onClick={()=>onNav('grammar-practice')} style={{display:'flex',alignItems:'center',gap:13}}>
          <NAIcon name="quiz" size={24} color={NA.gold}/>
          <div style={{flex:1,minWidth:0}}><Cap color={NA.gold} style={{marginBottom:5}}>Bài tập kèm theo</Cap><div style={{fontWeight:600,fontSize:14}}>6 câu luyện Dativ trong hội thoại</div></div>
          <NAIcon name="chevron_right" size={20} color={NA.faint}/>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { NALessons, NALessonPlayer, openLesson, LESSONS });
