// na-speaking.jsx — Luyện nói AI: chọn HR → phỏng vấn (live) → kết quả
// Exports: NASpeakSelect, NASpeakLive, NASpeakResults

const PERSONAS = [
  { id:'schmidt', name:'Frau Schmidt', role:'Pflegedienstleitung', tag:'Pflege · Điều dưỡng', accent:NA.teal,   mono:'S', featured:true,
    positions:['Pflegefachkraft','Pflegehelfer','Altenpfleger'], level:'B1' },
  { id:'bauer',   name:'Herr Bauer',   role:'Oberarzt · Klinik',  tag:'Krankenhaus · Y tế', accent:NA.blue,   mono:'B',
    positions:['Pflegefachkraft (Klinik)','MFA','OP-Assistenz'], level:'B2' },
  { id:'wagner',  name:'Herr Wagner',  role:'Team Lead · IT',     tag:'IT · Kỹ thuật',     accent:NA.violet, mono:'W',
    positions:['Fachinformatiker','Support'], level:'B2', pro:true },
  { id:'klein',   name:'Frau Klein',   role:'Gia sư tiếng Việt',  tag:'Hội thoại · Cơ bản', accent:NA.gold,  mono:'K',
    positions:['Giao tiếp hằng ngày'], level:'A2' },
];

function PersonaAvatar({ p, size=46, talking=false, ring=true }){
  return (
    <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,position:'relative',
      background:naSoft(p.accent,'bold'), display:'flex',alignItems:'center',justifyContent:'center',
      border:ring?`2px solid ${p.accent}`:'none'}}>
      <span style={{...NA.srf,fontSize:size*0.42,fontWeight:600,color:p.accent}}>{p.mono}</span>
      {talking && <span style={{position:'absolute',inset:-6,borderRadius:'50%',border:`2px solid ${p.accent}`,animation:'naPulse 1.1s ease-in-out infinite'}} />}
    </div>
  );
}

/* ════════ 1 · CHỌN HR ════════ */
const SPK_MODES = [ {k:'INTERVIEW',l:'Phỏng vấn',ic:'work'}, {k:'COMMUNICATION',l:'Hội thoại',ic:'chat'}, {k:'LESSON',l:'Luyện tập',ic:'school'} ];

function NASpeakSelect({ onNav, state='default' }){
  const acc = useAcc();
  const [mode,setMode] = React.useState('INTERVIEW');
  const [sel,setSel] = React.useState('schmidt');
  const [pos,setPos] = React.useState(0);
  const [exp,setExp] = React.useState('1-2Y');
  const quota = state==='quota' && usePlan()!=='pro' && usePlan()!=='trial';
  const persona = PERSONAS.find(p=>p.id===sel);
  const EXP = [['0-6M','0–6 tháng'],['6-12M','6–12 tháng'],['1-2Y','1–2 năm'],['3Y','3+ năm']];

  return (
    <Page title="Luyện nói AI" dateCap="Phỏng vấn thử · Sprechen">
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
        {quota && (
          <Card accent={NA.gold} style={{display:'flex',alignItems:'center',gap:13}}>
            <NAIcon name="bolt" size={26} color={NA.gold}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>Đã hết 3 lượt miễn phí hôm nay</div>
              <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Nâng cấp Pro để luyện nói không giới hạn.</div>
            </div>
            <Btn variant="yellow" size="sm" onClick={()=>onNav('upgrade')}>Nâng cấp</Btn>
          </Card>
        )}

        {/* mode tabs */}
        <div style={{display:'flex',gap:8}}>
          {SPK_MODES.map(m=>{
            const on = mode===m.k;
            return (
              <button key={m.k} onClick={()=>setMode(m.k)} className="na-press" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'13px 6px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',
                background:on?NA.ink:NA.card, border:`1px solid ${on?NA.ink:NA.border}`, color:on?NA.bg:NA.muted}}>
                <NAIcon name={m.ic} size={21} fill={on} color={on?NA.yellow:NA.subtle}/>
                <span style={{font:`700 12px/1 'Instrument Sans'`}}>{m.l}</span>
              </button>
            );
          })}
        </div>

        <div>
          <Cap style={{padding:'0 2px 11px'}}>Chọn người phỏng vấn</Cap>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {PERSONAS.map(p=>{
              const on = sel===p.id, locked = p.pro;
              return (
                <button key={p.id} onClick={()=>!locked&&setSel(p.id)} className="na-press" style={{textAlign:'left',padding:'16px 14px',borderRadius:'var(--na-radius,4px)',cursor:locked?'not-allowed':'pointer',position:'relative',opacity:locked?0.55:1,
                  background:on?naSoft(p.accent,'subtle'):NA.card, border:`${on?2:1}px solid ${on?p.accent:NA.border}`}}>
                  {locked && <div style={{position:'absolute',top:11,right:11}}><NAIcon name="lock" size={15} color={NA.faint}/></div>}
                  {on && <div style={{position:'absolute',top:10,right:10,width:22,height:22,borderRadius:'50%',background:p.accent,display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="check" size={14} color="#fff"/></div>}
                  <PersonaAvatar p={p} size={44} ring/>
                  <div style={{...NA.srf,fontSize:16,fontWeight:500,marginTop:11,lineHeight:1.15}}>{p.name}</div>
                  <div style={{fontSize:12,color:p.accent,fontWeight:600,marginTop:3}}>{p.role}</div>
                  <div style={{font:`600 9px/1.3 'Instrument Sans'`,letterSpacing:'0.06em',textTransform:'uppercase',color:NA.subtle,marginTop:7}}>{p.tag} · {p.level}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* config */}
        <Card style={{borderColor:naSoft(persona.accent,'bold')}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:15}}>
            <PersonaAvatar p={persona} size={34} ring={false}/>
            <div style={{...NA.srf,fontSize:16,fontWeight:500}}>Thiết lập với {persona.name}</div>
          </div>
          <Cap style={{marginBottom:9}}>Vị trí ứng tuyển</Cap>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
            {persona.positions.map((ps,i)=>(
              <button key={ps} onClick={()=>setPos(i)} className="na-press" style={{padding:'9px 13px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`600 12.5px/1 'Instrument Sans'`,
                background:pos===i?naSoft(persona.accent,'balanced'):NA.bg, border:`1px solid ${pos===i?persona.accent:NA.border}`, color:pos===i?persona.accent:NA.muted}}>{ps}</button>
            ))}
          </div>
          <Cap style={{marginBottom:9}}>Kinh nghiệm</Cap>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {EXP.map(([id,l])=>(
              <button key={id} onClick={()=>setExp(id)} className="na-press" style={{padding:'9px 13px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`600 12.5px/1 'Instrument Sans'`,
                background:exp===id?naSoft(persona.accent,'balanced'):NA.bg, border:`1px solid ${exp===id?persona.accent:NA.border}`, color:exp===id?persona.accent:NA.muted}}>{l}</button>
            ))}
          </div>
        </Card>

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'2px 4px'}}>
          <NAIcon name="schedule" size={17} color={NA.muted}/>
          <span style={{fontSize:12.5,color:NA.muted}}>~15 phút · chấm điểm tự động · ghi âm riêng tư</span>
        </div>

        <Btn variant="primary" size="lg" full onClick={()=>quota?onNav('upgrade'):onNav('speaking-live')} style={{opacity:quota?0.5:1}}>
          <YSq size={7} color={NA.yellow}/>{quota?'Hết lượt — Nâng cấp Pro':`Bắt đầu phỏng vấn`}
        </Btn>
      </div>
    </Page>
  );
}

/* ════════ 2 · PHỎNG VẤN (LIVE) ════════ */
const CONVO = [
  { who:'ai', de:'Guten Tag! Schön, dass Sie da sind. Stellen Sie sich bitte kurz vor.', vi:'Xin chào! Rất vui được gặp bạn. Hãy giới thiệu ngắn gọn về bản thân.' },
  { who:'me', de:'Guten Tag, Frau Schmidt. Ich heiße Lan, ich komme aus Vietnam und bin examinierte Pflegekraft.', vi:'Chào bà Schmidt. Tôi tên Lan, đến từ Việt Nam và là điều dưỡng có bằng.' },
  { who:'ai', de:'Sehr gut. Warum möchten Sie in Deutschland als Pflegefachkraft arbeiten?', vi:'Rất tốt. Vì sao bạn muốn làm điều dưỡng tại Đức?' },
];

function Waveform({ color=NA.red, bars=28, active=true }){
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,height:40}}>
      {Array.from({length:bars}).map((_,i)=>(
        <span key={i} style={{width:3,height:'100%',borderRadius:2,background:color,transformOrigin:'center',
          animation:active?`naWave ${0.7+ (i%5)*0.12}s ease-in-out ${i*0.04}s infinite`:'none', opacity:active?1:0.3}} />
      ))}
    </div>
  );
}

function Bubble({ m }){
  const [show,setShow] = React.useState(false);
  const ai = m.who==='ai';
  return (
    <div style={{display:'flex',justifyContent:ai?'flex-start':'flex-end',marginBottom:14}}>
      <div style={{maxWidth:'82%'}}>
        <div style={{borderRadius:'var(--na-radius,4px)',padding:'12px 14px',
          background:ai?NA.card:NA.ink, color:ai?NA.ink:NA.bg, border:ai?`1px solid ${NA.border}`:'none'}}>
          <div style={{fontSize:14.5,lineHeight:1.5,fontWeight:ai?500:400}}>{m.de}</div>
          {show && <div style={{fontSize:12.5,lineHeight:1.45,color:ai?NA.muted:'#A39E94',marginTop:7,paddingTop:7,borderTop:`1px solid ${ai?NA.border:'rgba(255,255,255,0.15)'}`,fontStyle:'italic'}}>{m.vi}</div>}
        </div>
        <button onClick={()=>setShow(s=>!s)} style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,background:'none',border:'none',padding:0,cursor:'pointer',font:`600 11px/1 'Instrument Sans'`,color:NA.subtle}}>
          <NAIcon name="translate" size={13}/>{show?'Ẩn dịch':'Xem dịch'}
        </button>
      </div>
    </div>
  );
}

function NASpeakLive({ onNav, state='default' }){
  const persona = PERSONAS[0];
  const scrollRef = React.useRef(null);
  React.useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });

  // connecting overlay
  if (state==='connecting'){
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,padding:40,textAlign:'center'}}>
        <PersonaAvatar p={persona} size={96} talking/>
        <div><div style={{...NA.srf,fontSize:22,fontWeight:500}}>{persona.name}</div><div style={{fontSize:13,color:NA.muted,marginTop:4}}>{persona.role}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:7,color:NA.muted}}>
          <span style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${NA.border}`,borderTopColor:NA.ink,animation:'naSpin 0.8s linear infinite'}}/>
          <span style={{fontSize:13.5,fontWeight:600}}>Đang kết nối phòng phỏng vấn…</span>
        </div>
      </div>
    );
  }

  const topBar = (
    <div style={{position:'absolute',top:0,left:0,right:0,zIndex:10,paddingTop:SAFE_TOP,background:'rgba(251,250,247,0.9)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',borderBottom:`1px solid ${NA.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:11,padding:'8px 16px 11px'}}>
        <PersonaAvatar p={persona} size={38} talking={state==='thinking'}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{...NA.srf,fontSize:16,fontWeight:500,lineHeight:1.1}}>{persona.name}</div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:NA.green}}/>
            <span style={{font:`600 11px/1 'Instrument Sans'`,color:NA.muted}}>Pflegefachkraft · B1</span>
          </div>
        </div>
        <div style={{...NA.srf,fontSize:17,fontWeight:500,color:NA.ink,fontVariantNumeric:'tabular-nums'}}>04:12</div>
        <button onClick={()=>onNav('speaking-results')} className="na-press" style={{display:'inline-flex',alignItems:'center',gap:5,background:naSoft(NA.red,'balanced'),color:NA.red,border:'none',borderRadius:'var(--na-radius,4px)',padding:'8px 12px',cursor:'pointer',font:`700 12px/1 'Instrument Sans'`}}>Kết thúc</button>
      </div>
      <div style={{height:3,background:NA.border}}><div style={{width:'38%',height:'100%',background:NA.yellow}}/></div>
    </div>
  );

  // bottom control by state
  const recording = state==='recording';
  const thinking = state==='thinking';
  const micError = state==='mic-error';

  let control;
  if (micError){
    control = (
      <div style={{textAlign:'center'}}>
        <Card accent={NA.red} style={{display:'flex',alignItems:'center',gap:11,textAlign:'left',marginBottom:13}}>
          <NAIcon name="mic_off" size={24} color={NA.red}/>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13.5}}>Không truy cập được micro</div><div style={{fontSize:12,color:NA.muted,marginTop:3}}>Cấp quyền micro trong Cài đặt để tiếp tục.</div></div>
        </Card>
        <Btn variant="primary" full onClick={()=>onNav('speaking-live')}><NAIcon name="refresh" size={18}/>Thử lại</Btn>
      </div>
    );
  } else if (thinking){
    control = (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'18px 0'}}>
        <span style={{font:`600 13.5px/1 'Instrument Sans'`,color:NA.muted}}>{persona.name} đang soạn câu hỏi</span>
        <span style={{display:'inline-flex',gap:4}}>{[0,1,2].map(i=>(<span key={i} style={{width:6,height:6,borderRadius:'50%',background:NA.muted,animation:`naDot 1.2s ${i*0.18}s infinite`}}/>))}</span>
      </div>
    );
  } else if (recording){
    control = (
      <div style={{textAlign:'center'}}>
        <Waveform color={NA.red} active/>
        <div style={{font:`600 12px/1 'Instrument Sans'`,color:NA.red,letterSpacing:'0.06em',textTransform:'uppercase',margin:'10px 0 14px'}}>● Đang ghi âm · 0:08</div>
        <button onClick={()=>onNav('speaking-results')} className="na-press" style={{width:72,height:72,borderRadius:'50%',background:NA.red,border:`4px solid ${naSoft(NA.red,'bold')}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 0 6px ${naSoft(NA.red,'subtle')}`}}>
          <span style={{width:22,height:22,borderRadius:5,background:'#fff'}}/>
        </button>
        <div style={{fontSize:12,color:NA.muted,marginTop:11}}>Nhấn để dừng và gửi câu trả lời</div>
      </div>
    );
  } else {
    control = (
      <div style={{textAlign:'center'}}>
        <button onClick={()=>onNav('speaking-live')} className="na-press" style={{width:72,height:72,borderRadius:'50%',background:NA.ink,border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
          <NAIcon name="mic" size={30} fill color={NA.yellow}/>
        </button>
        <div style={{fontSize:13,color:NA.muted,marginTop:11,fontWeight:600}}>Nhấn để trả lời bằng tiếng Đức</div>
        <div style={{fontSize:11.5,color:NA.subtle,marginTop:4}}>hoặc gõ câu trả lời ↓</div>
      </div>
    );
  }

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {topBar}
      <div ref={scrollRef} className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+78}px 16px 14px`}}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <span style={{font:`600 10px/1 'Instrument Sans'`,letterSpacing:'0.12em',textTransform:'uppercase',color:NA.subtle,background:NA.paper,padding:'6px 12px',borderRadius:'var(--na-radius,4px)'}}>Vorstellungsgespräch · Pflege</span>
        </div>
        {CONVO.map((m,i)=><Bubble key={i} m={m}/>)}
        {!thinking && !recording && !micError && (
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
            <div style={{maxWidth:'82%',borderRadius:'var(--na-radius,4px)',padding:'12px 14px',border:`1.5px dashed ${NA.border}`,color:NA.subtle,fontSize:13.5,fontStyle:'italic'}}>Đến lượt bạn trả lời…</div>
          </div>
        )}
      </div>
      <div style={{borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`18px 20px ${HOME_IND+10}px`}}>{control}</div>
    </div>
  );
}

/* ════════ 3 · KẾT QUẢ ════════ */
// nguồn: GET /api/speaking/result/{id} → SpeakingResultDto. (AISpeaking chưa typed ở BE → giữ mock)
const RESULT = {
  score:8.2, band:'Sehr gut', level:'B1+', duration:'14:32', questions:9,
  skills:[ ['Phát âm',7.8,'Aussprache'], ['Ngữ pháp',8.0,'Grammatik'], ['Từ vựng',8.6,'Wortschatz'], ['Độ trôi chảy',8.4,'Flüssigkeit'] ],
  strengths:[ 'Dùng đúng thuật ngữ chuyên ngành Pflege (examinierte Pflegekraft, Schichtdienst).', 'Trả lời mạch lạc, có mở–thân–kết rõ ràng.', 'Tự tin, tốc độ nói tự nhiên.' ],
  errors:[
    { wrong:'Ich habe drei Jahre Erfahrung in der Pflege gearbeitet.', right:'Ich habe drei Jahre in der Pflege gearbeitet.', note:'Bỏ "Erfahrung" — thừa khi đã có "drei Jahre … gearbeitet".' },
    { wrong:'Ich möchte helfen die Patienten.', right:'Ich möchte den Patienten helfen.', note:'"helfen" đi với Dativ: den Patienten, và động từ ở cuối.' },
  ],
};

function NASpeakResults({ onNav, state='default' }){
  if (state==='loading'){
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:40,textAlign:'center'}}>
        <ProgressRing pct={66} size={92} stroke={7} color={NA.yellow}><NAIcon name="auto_awesome" size={30} fill color={NA.yellow} style={{animation:'naPulse 1.2s infinite'}}/></ProgressRing>
        <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Đang chấm điểm bài nói…</div>
        <p style={{margin:0,fontSize:13,color:NA.muted,maxWidth:240,lineHeight:1.5}}>AI đang phân tích phát âm, ngữ pháp và từ vựng của bạn.</p>
      </div>
    );
  }
  const r = RESULT;
  return (
    <Page title="Kết quả phỏng vấn" dateCap="Frau Schmidt · Pflege B1" back="Xong" onBack={()=>onNav('speaking-select')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* overall */}
        <Card pad={0} style={{background:NA.ink}}>
          <div style={{padding:'22px 20px',display:'flex',alignItems:'center',gap:18}}>
            <ProgressRing pct={r.score*10} size={92} stroke={7} color={NA.yellow} track="rgba(255,255,255,0.16)">
              <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:28,fontWeight:500,color:NA.bg,lineHeight:1}}>{r.score}</div><div style={{fontSize:9,color:'#A39E94',marginTop:2}}>/10</div></div>
            </ProgressRing>
            <div style={{flex:1}}>
              <Cap color={NA.yellow} style={{marginBottom:8}}>Đánh giá tổng</Cap>
              <div style={{...NA.srf,fontSize:23,fontWeight:500,color:NA.bg,lineHeight:1.1}}>{r.band}</div>
              <div style={{fontSize:12.5,color:'#A39E94',marginTop:8,lineHeight:1.5}}>Trình độ ước tính <strong style={{color:NA.bg}}>{r.level}</strong> · {r.questions} câu · {r.duration}</div>
            </div>
          </div>
        </Card>

        {/* skills */}
        <Card>
          <Cap style={{marginBottom:15}}>Chi tiết kỹ năng</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:13}}>
            {r.skills.map(([l,v,de])=>(
              <div key={l}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13.5,fontWeight:600}}>{l} <span style={{color:NA.subtle,fontWeight:400,fontSize:11.5,fontStyle:'italic'}}>{de}</span></span>
                  <span style={{...NA.srf,fontSize:15,fontWeight:500}}>{v}</span>
                </div>
                <ProgressBar pct={v*10} color={v>=8.3?NA.green:v>=7.5?NA.yellow:NA.orange}/>
              </div>
            ))}
          </div>
        </Card>

        {/* strengths */}
        <Card>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:13}}><NAIcon name="thumb_up" size={19} color={NA.green}/><Cap color={NA.green}>Điểm mạnh</Cap></div>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {r.strengths.map((s,i)=>(
              <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}><NAIcon name="check_circle" size={18} fill color={NA.green} style={{marginTop:1}}/><span style={{fontSize:13.5,lineHeight:1.5,color:NA.ink}}>{s}</span></div>
            ))}
          </div>
        </Card>

        {/* errors */}
        <Card>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}><NAIcon name="edit" size={18} color={NA.orange}/><Cap color={NA.orange}>Cần cải thiện</Cap></div>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {r.errors.map((e,i)=>(
              <div key={i} style={{paddingBottom:i<r.errors.length-1?16:0,borderBottom:i<r.errors.length-1?`1px solid ${NA.border}`:'none'}}>
                <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}>
                  <NAIcon name="close" size={16} color={NA.red} style={{marginTop:2}}/>
                  <span style={{fontSize:13.5,lineHeight:1.45,color:NA.muted,textDecoration:'line-through',textDecorationColor:naSoft(NA.red,'bold')}}>{e.wrong}</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                  <NAIcon name="check" size={16} color={NA.green} style={{marginTop:2}}/>
                  <span style={{fontSize:13.5,lineHeight:1.45,color:NA.ink,fontWeight:600}}>{e.right}</span>
                </div>
                <div style={{fontSize:12.5,color:NA.muted,lineHeight:1.5,paddingLeft:24,fontStyle:'italic'}}>{e.note}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:2}}>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('speaking-select')}><YSq size={7} color={NA.yellow}/>Luyện lại buổi mới</Btn>
          <div style={{display:'flex',gap:10}}>
            <Btn variant="ghost" full onClick={()=>onNav('home')}>Về trang chủ</Btn>
            <Btn variant="ghost" full onClick={()=>onNav('roadmap')}>Lưu vào lộ trình</Btn>
          </div>
        </div>
      </div>
    </Page>
  );
}

Object.assign(window, { NASpeakSelect, NASpeakLive, NASpeakResults, PERSONAS, PersonaAvatar });
