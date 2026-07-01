// na-onboarding.jsx — Onboarding nhiều bước (Mục tiêu → Trình độ → Cường độ → Nguồn → Hoàn tất)
//   + bài kiểm tra xếp trình độ. Không có bottom tab. Exports: NAOnboarding

const ONB_GOALS = [
  { k:'pflege', l:'B2 · Pflege', d:'Điều dưỡng tại Đức', ic:'health_and_safety', b2b:true },
  { k:'work',   l:'Công việc',   d:'Đi làm & định cư',   ic:'work', b2b:true },
  { k:'b1',     l:'Đạt B1',      d:'Giao tiếp tự tin',   ic:'forum' },
  { k:'a2',     l:'Đạt A2',      d:'Nền tảng vững',      ic:'school' },
  { k:'study',  l:'Du học',      d:'Vào đại học Đức',    ic:'menu_book' },
  { k:'free',   l:'Tự do',       d:'Sở thích cá nhân',   ic:'interests' },
];
const ONB_LEVELS = [
  { k:'none', l:'Chưa học bao giờ', d:'Bắt đầu từ con số 0' },
  { k:'a1',   l:'A1',  d:'Biết chào hỏi, từ cơ bản' },
  { k:'a2',   l:'A2',  d:'Giao tiếp tình huống quen thuộc' },
  { k:'b1',   l:'B1',  d:'Diễn đạt ý kiến, kể chuyện' },
];
const ONB_MINS = [['10','Nhẹ nhàng'],['20','Đều đặn'],['30','Nghiêm túc'],['45','Cường độ cao']];
const ONB_TIMES = [['m','Sáng · 7:00'],['n','Trưa · 12:00'],['e','Tối · 19:00'],['l','Tối muộn · 21:00'],['off','Không nhắc']];
const ONB_SOURCES = [['friend','Bạn bè giới thiệu'],['fb','Facebook'],['tiktok','TikTok'],['google','Google'],['center','Trung tâm tiếng Đức'],['other','Khác']];

const ONB_TEST = [
  { q:'"Guten Morgen" nghĩa là gì?', opts:['Chào buổi sáng','Tạm biệt','Cảm ơn'], a:0 },
  { q:'Chọn câu đúng ngữ pháp:', opts:['Ich bin Student.','Ich sein Student.','Ich Student bin.'], a:0 },
  { q:'"Ich hätte gern einen Termin" — câu này thuộc tình huống nào?', opts:['Đặt lịch hẹn','Gọi món ăn','Hỏi đường'], a:0 },
];

function PickCard({ on, ic, title, desc, onClick }){
  return (
    <button onClick={onClick} className="na-press" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'15px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',
      background:on?naSoft(NA.yellow,'subtle'):NA.card, border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
      {ic && <div style={{width:40,height:40,borderRadius:'var(--na-radius,4px)',background:on?NA.ink:NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name={ic} size={22} color={on?NA.yellow:NA.muted}/></div>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{...NA.srf,fontSize:16.5,fontWeight:500,lineHeight:1.15}}>{title}</div>
        {desc && <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>{desc}</div>}
      </div>
      <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<NAIcon name="check" size={14} color="#fff"/>}</div>
    </button>
  );
}
function Chip({ on, children, onClick }){
  return <button onClick={onClick} className="na-press" style={{padding:'11px 15px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`600 13.5px/1 'Instrument Sans'`,
    background:on?naSoft(NA.yellow,'balanced'):NA.card, border:`1px solid ${on?NA.gold:NA.border}`, color:on?NA.ink:NA.muted}}>{children}</button>;
}

/* ── placement test ── */
function PlacementTest({ onDone, onCancel }){
  const [qi,setQi] = React.useState(0);
  const [pick,setPick] = React.useState(null);
  const [score,setScore] = React.useState(0);
  const [finished,setFinished] = React.useState(false);
  const q = ONB_TEST[qi];

  if (finished){
    const lv = score<=1 ? {k:'a1',l:'A1'} : score===2 ? {k:'a2',l:'A2'} : {k:'b1',l:'B1'};
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center'}}>
          <ProgressRing pct={(score/ONB_TEST.length)*100} size={104} stroke={8} color={NA.green}>
            <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:30,fontWeight:500,lineHeight:1}}>{lv.l}</div></div>
          </ProgressRing>
          <h1 style={{margin:'22px 0 0',...NA.srf,fontSize:25,fontWeight:500,lineHeight:1.2}}>Trình độ gợi ý: {lv.l}</h1>
          <p style={{margin:'10px auto 0',fontSize:14,color:NA.muted,lineHeight:1.55,maxWidth:280}}>Bạn trả lời đúng {score}/{ONB_TEST.length} câu. Chúng tôi sẽ xây lộ trình bắt đầu từ {lv.l}.</p>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={()=>onDone(lv.k)}><YSq size={7} color={NA.yellow}/>Dùng kết quả này</Btn>
          <LinkBtn color={NA.muted} onClick={onCancel}>Tự chọn trình độ</LinkBtn>
        </div>
      </div>
    );
  }

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 20px 0`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,height:46}}>
          <button onClick={onCancel} aria-label="Đóng bài kiểm tra" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,margin:'0 -8px 0 -8px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1}}><ProgressBar pct={((qi)/ONB_TEST.length)*100} color={NA.yellow} h={6}/></div>
          <span style={{...NA.srf,fontSize:14,fontWeight:500,color:NA.muted,fontVariantNumeric:'tabular-nums'}}>{qi+1}/{ONB_TEST.length}</span>
        </div>
      </div>
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'24px 24px 16px'}}>
        <Cap style={{marginBottom:14}}>Bài kiểm tra xếp trình độ</Cap>
        <div style={{...NA.srf,fontSize:23,fontWeight:500,lineHeight:1.3,letterSpacing:'-0.01em',marginBottom:24}}>{q.q}</div>
        <div style={{display:'flex',flexDirection:'column',gap:11}}>
          {q.opts.map((o,i)=>{
            const on = pick===i;
            return (
              <button key={i} onClick={()=>setPick(i)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',
                background:on?naSoft(NA.yellow,'subtle'):NA.card, border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
                <div style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<NAIcon name="check" size={15} color="#fff"/>}</div>
                <span style={{fontSize:15,fontWeight:on?600:500,color:NA.ink}}>{o}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`}}>
        <Btn variant="primary" size="lg" full onClick={()=>{
          if(pick===null) return;
          const ns = score + (pick===q.a?1:0);
          if(qi+1<ONB_TEST.length){ setScore(ns); setQi(qi+1); setPick(null); }
          else { setScore(ns); setFinished(true); }
        }} style={{opacity:pick===null?0.5:1}}>{qi+1<ONB_TEST.length?'Câu tiếp theo':'Xem kết quả'}</Btn>
      </div>
    </div>
  );
}

/* ════════ ONBOARDING ════════ */
function NAOnboarding({ onNav, state='default' }){
  const TOTAL = 4;
  const [step,setStep] = React.useState(state==='complete'?TOTAL:0);
  const [view,setView] = React.useState(state==='test'?'test':'steps');
  const [busy,setBusy] = React.useState(false);
  const [sel,setSel] = React.useState({ goal:null, level:null, mins:'20', time:'e', source:null, code:'', codeOpen:false, fromTest:false });
  const set = (k,v)=>setSel(s=>({...s,[k]:v}));

  // respond to state-prop changes (Tweaks state selector) without a remount
  React.useEffect(()=>{
    if(state==='test'){ setView('test'); }
    else if(state==='complete'){ setView('steps'); setStep(TOTAL); }
    else { setView('steps'); setStep(0); }
  },[state]);

  if (view==='test'){
    return <PlacementTest onDone={(lv)=>{ setSel(s=>({...s,level:lv,fromTest:true})); setView('steps'); setStep(1); }} onCancel={()=>{ setView('steps'); setStep(1); }}/>;
  }

  const goal = ONB_GOALS.find(g=>g.k===sel.goal);
  const isB2B = goal?.b2b;

  // completion
  if (step>=TOTAL){
    const sum = [
      ['flag','Mục tiêu', goal?goal.l:'—'],
      ['school','Trình độ', sel.level?ONB_LEVELS.find(l=>l.k===sel.level).l + (sel.fromTest?' · từ bài test':''):'—'],
      ['schedule','Mỗi ngày', `${sel.mins} phút · ${ONB_TIMES.find(t=>t[0]===sel.time)[1]}`],
    ];
    if (sel.code) sum.push(['groups','Lớp học', sel.code]);
    function start(){ setBusy(true); setTimeout(()=>{ if(sel.code && window.__naCtx) window.__naCtx('b2b'); onNav('home'); }, 1000); }
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+18}px 24px 16px`,textAlign:'center'}}>
          <div style={{width:78,height:78,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:18,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="rocket_launch" size={38} color={NA.green}/></div>
          <h1 style={{margin:0,...NA.srf,fontSize:27,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.15}}>Lộ trình đã sẵn sàng!</h1>
          <p style={{margin:'10px auto 22px',fontSize:14,color:NA.muted,lineHeight:1.55,maxWidth:290}}>Chúng tôi đã cá nhân hoá kế hoạch học dựa trên lựa chọn của bạn.</p>
          <Card pad={0} style={{textAlign:'left'}}>
            {sum.map(([ic,l,v],i)=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:13,padding:'15px 16px',borderBottom:i<sum.length-1?`1px solid ${NA.border}`:'none'}}>
                <NAIcon name={ic} size={21} color={NA.gold}/>
                <span style={{fontSize:13,color:NA.muted,flex:1}}>{l}</span>
                <span style={{fontSize:13.5,fontWeight:600,color:NA.ink,textAlign:'right',maxWidth:'58%'}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={start} style={{opacity:busy?0.7:1}}>{busy?<><Spin/>Đang chuẩn bị lộ trình…</>:<><YSq size={7} color={NA.yellow}/>Bắt đầu học</>}</Btn>
          <LinkBtn color={NA.muted} onClick={()=>setStep(TOTAL-1)}>Quay lại chỉnh sửa</LinkBtn>
        </div>
      </div>
    );
  }

  // step content
  const STEPS = [
    { cap:'Bước 1 · Mục tiêu', title:'Bạn học tiếng Đức để làm gì?', req:!sel.goal },
    { cap:'Bước 2 · Trình độ', title:'Trình độ hiện tại của bạn?', req:!sel.level },
    { cap:'Bước 3 · Cường độ', title:'Bạn muốn học bao nhiêu mỗi ngày?', req:!sel.mins },
    { cap:'Bước 4 · Nguồn', title:'Bạn biết DeutschFlow từ đâu?', req:false, skippable:true },
  ];
  const cur = STEPS[step];

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {/* top: progress */}
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 20px 0`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,height:46}}>
          <button onClick={()=>step===0?onNav('auth-verify'):setStep(step-1)} aria-label="Quay lại" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,margin:'0 -8px 0 -8px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="chevron_left" size={26} color={NA.ink}/></button>
          <div style={{flex:1,display:'flex',gap:5}}>
            {Array.from({length:TOTAL}).map((_,i)=>(<div key={i} style={{flex:1,height:5,borderRadius:3,background:i<=step?NA.yellow:NA.border,transition:'background 0.3s'}}/>))}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'20px 24px 16px'}}>
        <Cap style={{marginBottom:9}}>{cur.cap}</Cap>
        <h1 style={{margin:'0 0 20px',...NA.srf,fontSize:27,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.18,textWrap:'balance'}}>{cur.title}</h1>

        {step===0 && (
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
              {ONB_GOALS.map(g=>(
                <button key={g.k} onClick={()=>set('goal',g.k)} className="na-press" style={{display:'flex',flexDirection:'column',gap:9,padding:'16px 14px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',position:'relative',
                  background:sel.goal===g.k?naSoft(NA.yellow,'subtle'):NA.card, border:`${sel.goal===g.k?2:1}px solid ${sel.goal===g.k?NA.gold:NA.border}`}}>
                  <div style={{width:40,height:40,borderRadius:'var(--na-radius,4px)',background:sel.goal===g.k?NA.ink:NA.paper,display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name={g.ic} size={22} color={sel.goal===g.k?NA.yellow:NA.muted}/></div>
                  <div><div style={{...NA.srf,fontSize:16,fontWeight:500,lineHeight:1.15}}>{g.l}</div><div style={{fontSize:12,color:NA.muted,marginTop:3}}>{g.d}</div></div>
                  {g.b2b && <span style={{position:'absolute',top:12,right:12,font:`700 8.5px/1 'Instrument Sans'`,letterSpacing:'0.06em',color:NA.violet,background:naSoft(NA.violet,'subtle'),padding:'4px 6px',borderRadius:3}}>CÓ LỚP</span>}
                </button>
              ))}
            </div>
            {/* B2B class code */}
            {isB2B && (
              <Card style={{marginTop:4}}>
                {!sel.codeOpen ? (
                  <button onClick={()=>set('codeOpen',true)} style={{display:'flex',alignItems:'center',gap:11,width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
                    <NAIcon name="groups" size={22} color={NA.violet}/>
                    <span style={{flex:1,fontSize:14,fontWeight:600}}>Bạn học theo lớp? Nhập mã lớp</span>
                    <NAIcon name="add" size={20} color={NA.muted}/>
                  </button>
                ) : (
                  <div>
                    <Cap style={{marginBottom:9}}>Mã lớp (không bắt buộc)</Cap>
                    <input value={sel.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="VD: K30-PFLEGE" maxLength={14}
                      style={{width:'100%',border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'13px 14px',font:`600 15px/1 'Instrument Sans'`,letterSpacing:'0.06em',color:NA.ink,background:NA.bg,outline:'none',textAlign:'center'}}/>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {step===1 && (
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {sel.fromTest && <Card accent={NA.green} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}><NAIcon name="check_circle" size={20} fill color={NA.green}/><span style={{fontSize:13,color:NA.ink,fontWeight:500}}>Đã xếp trình độ từ bài kiểm tra</span></Card>}
            {ONB_LEVELS.map(l=>(<PickCard key={l.k} on={sel.level===l.k} title={l.l} desc={l.d} onClick={()=>set('level',l.k)}/>))}
            <button onClick={()=>setView('test')} className="na-press" style={{display:'flex',alignItems:'center',gap:12,padding:'15px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',background:NA.ink,border:'none',marginTop:3}}>
              <NAIcon name="quiz" size={22} color={NA.yellow}/>
              <div style={{flex:1,textAlign:'left'}}><div style={{...NA.srf,fontSize:15.5,fontWeight:500,color:NA.bg}}>Làm bài kiểm tra 5 phút</div><div style={{fontSize:12,color:'#A39E94',marginTop:2}}>Để chúng tôi xếp trình độ chính xác hơn</div></div>
              <NAIcon name="chevron_right" size={20} color="#76716A"/>
            </button>
          </div>
        )}

        {step===2 && (
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div>
              <Cap style={{marginBottom:11}}>Số phút mỗi ngày</Cap>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {ONB_MINS.map(([m,d])=>(
                  <button key={m} onClick={()=>set('mins',m)} className="na-press" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:3,padding:'14px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',
                    background:sel.mins===m?naSoft(NA.yellow,'subtle'):NA.card, border:`${sel.mins===m?2:1}px solid ${sel.mins===m?NA.gold:NA.border}`}}>
                    <span style={{...NA.srf,fontSize:22,fontWeight:500}}>{m} <span style={{fontSize:13,color:NA.muted}}>phút</span></span>
                    <span style={{fontSize:12,color:NA.muted}}>{d}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Cap style={{marginBottom:11}}>Giờ nhắc học</Cap>
              <div style={{display:'flex',flexWrap:'wrap',gap:9}}>
                {ONB_TIMES.map(([k,l])=>(<Chip key={k} on={sel.time===k} onClick={()=>set('time',k)}>{l}</Chip>))}
              </div>
            </div>
          </div>
        )}

        {step===3 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
            {ONB_SOURCES.map(([k,l])=>(<Chip key={k} on={sel.source===k} onClick={()=>set('source',k)}>{l}</Chip>))}
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',alignItems:'center',gap:12}}>
        {cur.skippable && <Btn variant="ghost" onClick={()=>setStep(step+1)} style={{flexShrink:0}}>Bỏ qua</Btn>}
        <Btn variant="primary" size="lg" full onClick={()=>!cur.req&&setStep(step+1)} style={{opacity:cur.req?0.5:1}}>
          {step===TOTAL-1?'Hoàn tất':'Tiếp tục'}
        </Btn>
      </div>
    </div>
  );
}

Object.assign(window, { NAOnboarding, PlacementTest });
