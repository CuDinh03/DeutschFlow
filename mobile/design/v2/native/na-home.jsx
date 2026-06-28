// na-home.jsx — Hôm nay (Home) · 3 layout variants · states: default/success/loading/empty/error
// Exports: NAHome

// nguồn: GET /api/today/me → TodayPlanDto  (+ /api/student/dashboard, /api/student/stats)
const HOME = {
  streak:12, minutesDone:18, minutesGoal:30, xp:'1.240', rank:'Bạc',
  pathPct:42, weeksLeft:9, currentLesson:'Krankenhaus & Pflege',
  plan:[
    { id:'p1', tag:'Từ vựng', title:'Ôn 24 thẻ tới hạn', meta:'Pflege · Krankenhaus', time:8,  screen:'srs',             icon:'translate' },
    { id:'p2', tag:'Luyện nói', title:'Phỏng vấn thử với Frau Schmidt', meta:'AI HR · Pflege B1', time:15, screen:'speaking-select', icon:'record_voice_over' },
    { id:'p3', tag:'Ngữ pháp', title:'Bài tập Dativ & Akkusativ', meta:'Lớp K30 · Thầy Trung', time:7,  screen:'class',          icon:'spellcheck' },
  ],
  skills:[ ['Nghe',88], ['Nói',78], ['Đọc',84], ['Viết',72] ],
  badges:['Chuỗi 12 ngày 🔥','100 thẻ từ','Phỏng vấn đầu tiên'],
  deadline:{ title:'Bài viết: Mein Arbeitstag', cls:'K30', dleft:'còn 1 ngày', urgent:true },
};

function HomeHero({ next, minutesDone, allDone, streak, onNav }){
  const acc = useAcc();
  if (allDone){
    return (
      <div style={{background:NA.ink,color:NA.bg,borderRadius:'var(--na-radius,4px)',padding:'22px 20px',position:'relative',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
          <div style={{width:42,height:42,borderRadius:'50%',background:NA.green,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,animation:'naPop 0.5s ease-out both'}}>✓</div>
          <Cap color={NA.yellow}>Hoàn thành hôm nay</Cap>
        </div>
        <div style={{...NA.srf,fontSize:24,fontWeight:500,lineHeight:1.2,letterSpacing:'-0.01em'}}>Tuyệt vời, Lan! Chuỗi học đã lên {streak+1} ngày 🔥</div>
        <p style={{margin:'8px 0 16px',fontSize:13.5,color:'#A39E94',lineHeight:1.5}}>Bạn đã học đủ {HOME.minutesGoal} phút mục tiêu. Nghỉ ngơi, hoặc luyện thêm để vượt kế hoạch.</p>
        <Btn variant="yellow" full onClick={()=>onNav('speaking-select')}><YSq size={7} color={NA.ink}/>Luyện thêm 1 buổi</Btn>
      </div>
    );
  }
  return (
    <div style={{background:NA.ink,color:NA.bg,borderRadius:'var(--na-radius,4px)',padding:'20px 20px 18px'}}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
        <Cap color={NA.yellow}>Tiếp tục học</Cap>
        <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.1em',textTransform:'uppercase',color:'#A39E94',border:'1px solid rgba(255,255,255,0.22)',padding:'4px 8px',borderRadius:'var(--na-radius,4px)'}}>{next.tag}</span>
      </div>
      <div style={{...NA.srf,fontSize:21,fontWeight:500,lineHeight:1.25,letterSpacing:'-0.01em'}}>{next.title}</div>
      <p style={{margin:'7px 0 0',fontSize:13,color:'#A39E94'}}>{next.meta} · {next.time} phút</p>
      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:7}}>
            <span style={{font:`500 11px/1 'Instrument Sans'`,color:'#A39E94'}}>Phút hôm nay</span>
            <span style={{...NA.srf,fontSize:16,fontWeight:500}}>{minutesDone}<span style={{color:'#76716A'}}>/{HOME.minutesGoal}</span></span>
          </div>
          <ProgressBar pct={minutesDone/HOME.minutesGoal*100} color={NA.yellow} track="rgba(255,255,255,0.16)" h={5} />
        </div>
        <button onClick={()=>onNav(next.screen)} className="na-press" style={{display:'inline-flex',alignItems:'center',gap:7,background:NA.yellow,color:NA.ink,border:'none',font:`700 14px/1 'Instrument Sans'`,padding:'13px 18px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
          <YSq size={6} color={NA.ink}/>Tiếp tục
        </button>
      </div>
    </div>
  );
}

function PlanList({ plan, done, onToggle, onNav, allDone }){
  return (
    <Card pad={0}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 12px',borderBottom:`1px solid ${NA.ink}`}}>
        <Cap>Kế hoạch hôm nay</Cap>
        <Cap color={allDone?NA.green:NA.gold}>{done.size}/{plan.length}{allDone?' ✓':''}</Cap>
      </div>
      {plan.map((p,i)=>{
        const isDone = done.has(p.id);
        return (
          <div key={p.id} style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',borderBottom:i<plan.length-1?`1px solid ${NA.border}`:'none',opacity:isDone?0.55:1,transition:'opacity 0.2s'}}>
            <button onClick={()=>onToggle(p)} className="na-press" aria-label="Hoàn thành" style={{width:26,height:26,borderRadius:'50%',flexShrink:0,border:`2px solid ${isDone?NA.green:NA.border}`,background:isDone?NA.green:'transparent',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,cursor:'pointer',animation:isDone?'naPop 0.35s ease-out':'none'}}>{isDone?'✓':''}</button>
            <button onClick={()=>onNav(p.screen)} style={{flex:1,minWidth:0,background:'none',border:'none',textAlign:'left',padding:0,cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.muted}}>{p.tag}</span>
                <span style={{font:`500 11px/1 'Instrument Sans'`,color:NA.subtle}}>· {p.time} phút</span>
              </div>
              <div style={{fontWeight:600,fontSize:15,color:NA.ink,textDecoration:isDone?'line-through':'none',lineHeight:1.25}}>{p.title}</div>
              <div style={{fontSize:12,color:NA.muted,marginTop:2}}>{p.meta}</div>
            </button>
            <NAIcon name="chevron_right" size={20} color={NA.faint} />
          </div>
        );
      })}
    </Card>
  );
}

function StatsRow(){
  const stats = [['12','ngày chuỗi 🔥'],['8.2','điểm nói TB'],['24','thẻ tới hạn'],['B1','trình độ']];
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
      {stats.map(([v,l],i)=>(
        <div key={i} style={{background:NA.card,padding:'15px 16px'}}>
          <div style={{...NA.srf,fontSize:23,fontWeight:500,lineHeight:1}}>{v}</div>
          <div style={{fontSize:11.5,color:NA.muted,marginTop:5}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function SkillsCard({ onNav }){
  return (
    <Card>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <Cap>Kỹ năng của bạn</Cap>
        <button onClick={()=>onNav('profile')} style={{font:`600 11px/1 'Instrument Sans'`,color:NA.muted,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Báo cáo →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px'}}>
        {HOME.skills.map(([l,v])=>(
          <div key={l}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
              <span style={{fontSize:12.5,fontWeight:600}}>{l}</span>
              <span style={{...NA.srf,fontSize:14,fontWeight:500}}>{v}</span>
            </div>
            <ProgressBar pct={v} color={v>=85?NA.green:v>=75?NA.yellow:NA.orange} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SpeakingPromo({ onNav }){
  return (
    <Card pad={0} style={{background:NA.ink}}>
      <div style={{padding:'20px'}}>
        <Cap color="#76716A" style={{marginBottom:10}}>Sẵn sàng kiểm tra?</Cap>
        <div style={{...NA.srf,fontSize:19,fontWeight:500,lineHeight:1.3,color:NA.bg}}>Phỏng vấn thử 15 phút với AI HR người Đức</div>
        <p style={{margin:'9px 0 16px',fontSize:13,color:'#A39E94',lineHeight:1.5}}>Frau Schmidt · Pflege · trình độ B1 đã sẵn sàng.</p>
        <Btn variant="yellow" full onClick={()=>onNav('speaking-select')}><YSq size={7} color={NA.ink}/>Bắt đầu phỏng vấn</Btn>
      </div>
    </Card>
  );
}

function ResumeLessonCard({ onNav }){
  return (
    <Card pad={0} onClick={()=>onNav('lessons')}>
      <div style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px'}}>
        <div style={{position:'relative',width:74,height:50,flexShrink:0,borderRadius:'var(--na-radius,4px)',overflow:'hidden',background:`linear-gradient(135deg, ${naSoft(NA.blue,'bold')}, ${naSoft(NA.blue,'subtle')})`,border:`1px solid ${NA.border}`}}>
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.92)',display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="play_arrow" size={17} fill color={NA.blue}/></div></div>
          <div style={{position:'absolute',left:0,right:0,bottom:0,height:3,background:'rgba(255,255,255,0.4)'}}><div style={{width:'46%',height:'100%',background:NA.yellow}}/></div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <Cap color={NA.gold} style={{marginBottom:5}}>Tiếp tục video · còn 7 phút</Cap>
          <div style={{fontWeight:600,fontSize:14,lineHeight:1.25}}>Im Krankenhaus — Aufnahmegespräch</div>
        </div>
        <NAIcon name="chevron_right" size={20} color={NA.faint}/>
      </div>
    </Card>
  );
}

function TutorEntry({ onNav }){
  return (
    <Card onClick={()=>onNav('book-session')} style={{display:'flex',alignItems:'center',gap:13}}>
      <div style={{width:42,height:42,borderRadius:'50%',background:naSoft(NA.teal,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="co_present" size={22} color={NA.teal}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14.5}}>Đặt buổi gia sư 1:1</div>
        <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Học riêng với giáo viên · từ 220.000đ</div>
      </div>
      <NAIcon name="chevron_right" size={20} color={NA.faint}/>
    </Card>
  );
}

function PathCard({ onNav }){
  return (
    <Card onClick={()=>onNav('roadmap')}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div><Cap style={{marginBottom:7}}>Lộ trình đến B2</Cap><div style={{...NA.srf,fontSize:28,fontWeight:500,lineHeight:1}}>{HOME.pathPct}%</div></div>
        <NAIcon name="chevron_right" size={22} color={NA.faint} />
      </div>
      <ProgressBar pct={HOME.pathPct} color={NA.yellow} />
      <div style={{fontSize:12.5,color:NA.muted,marginTop:11,lineHeight:1.45}}>Đang học <strong style={{color:NA.ink}}>{HOME.currentLesson}</strong> · còn {HOME.weeksLeft} tuần theo kế hoạch.</div>
    </Card>
  );
}

function DeadlineCard({ onNav }){
  const d = HOME.deadline;
  return (
    <Card onClick={()=>onNav('class')} accent={NA.red} pad={0}>
      <div style={{padding:'15px 16px',display:'flex',alignItems:'center',gap:12}}>
        <NAIcon name="assignment_late" size={24} color={NA.red} />
        <div style={{flex:1,minWidth:0}}>
          <Cap color={NA.red} style={{marginBottom:5}}>Sắp đến hạn · Lớp {d.cls}</Cap>
          <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.25}}>{d.title}</div>
        </div>
        <span style={{font:`700 11px/1 'Instrument Sans'`,color:NA.red,whiteSpace:'nowrap'}}>{d.dleft}</span>
      </div>
    </Card>
  );
}

function BadgesStrip(){
  return (
    <div>
      <Cap style={{padding:'0 4px 10px'}}>Huy hiệu gần đây</Cap>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {HOME.badges.map(b=>(<span key={b} style={{padding:'9px 13px',border:`1px solid ${NA.border}`,background:NA.card,borderRadius:'var(--na-radius,4px)',font:`600 12px/1 'Instrument Sans'`}}>{b}</span>))}
      </div>
    </div>
  );
}

/* ── States ── */
function Sk({ w='100%', h=14, r=4, mt=0 }){ return <div style={{width:w,height:h,borderRadius:r,marginTop:mt,background:`linear-gradient(90deg,${NA.border} 25%,${NA.hair} 50%,${NA.border} 75%)`,backgroundSize:'200% 100%',animation:'naShimmer 1.4s linear infinite'}} />; }
function HomeLoading(){
  return (
    <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}><Sk w="40%" h={11}/><Sk w="85%" h={20} mt={12}/><Sk w="55%" h={12} mt={10}/><Sk h={5} mt={18}/></div>
      <div style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}>{[0,1,2].map(i=>(<div key={i} style={{marginTop:i?16:0}}><Sk w="60%" h={14}/><Sk w="40%" h={11} mt={7}/></div>))}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{[0,1,2,3].map(i=>(<div key={i} style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:15}}><Sk w="50%" h={20}/><Sk w="70%" h={11} mt={8}/></div>))}</div>
    </div>
  );
}
function HomeError({ onRetry }){
  return (
    <div style={{padding:'40px 28px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <NAIcon name="cloud_off" size={44} color={NA.subtle} />
      <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Không tải được dữ liệu</div>
      <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Kết nối có vẻ chập chờn. Kiểm tra mạng và thử lại nhé.</p>
      <Btn variant="ghost" onClick={onRetry}><NAIcon name="refresh" size={18}/>Thử lại</Btn>
    </div>
  );
}
function HomeEmpty({ onNav }){
  return (
    <div style={{padding:'0 20px'}}>
      <div style={{background:NA.ink,color:NA.bg,borderRadius:'var(--na-radius,4px)',padding:'22px 20px'}}>
        <Cap color={NA.yellow} style={{marginBottom:10}}>Chào mừng đến DeutschFlow</Cap>
        <div style={{...NA.srf,fontSize:22,fontWeight:500,lineHeight:1.25}}>Bắt đầu bằng bài kiểm tra trình độ 5 phút</div>
        <p style={{margin:'9px 0 16px',fontSize:13,color:'#A39E94',lineHeight:1.5}}>Chúng tôi sẽ thiết kế lộ trình riêng cho mục tiêu của bạn.</p>
        <Btn variant="yellow" full onClick={()=>onNav('onboarding')}><YSq size={7} color={NA.ink}/>Làm bài kiểm tra</Btn>
      </div>
      <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
        {[['record_voice_over','Thử luyện nói với AI','speaking-select'],['translate','Học bộ từ vựng đầu tiên','vocab'],['groups','Tham gia lớp bằng mã','class']].map(([ic,tx,sc])=>(
          <button key={tx} onClick={()=>onNav(sc)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'15px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
            <NAIcon name={ic} size={22} color={NA.ink}/><span style={{flex:1,fontWeight:600,fontSize:14.5}}>{tx}</span><NAIcon name="chevron_right" size={20} color={NA.faint}/>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main ── */
function NAHome({ onNav, state='default', variant='editorial' }){
  const [done, setDone] = React.useState(()=>new Set());
  const allDone = state==='success' || (done.size===HOME.plan.length);
  const effDone = state==='success' ? new Set(HOME.plan.map(p=>p.id)) : done;
  const next = HOME.plan.find(p=>!effDone.has(p.id)) || HOME.plan[0];
  const minutesDone = state==='success' ? HOME.minutesGoal : Math.min(HOME.minutesGoal, HOME.minutesDone + HOME.plan.filter(p=>effDone.has(p.id)).reduce((a,p)=>a+p.time,0));
  function toggle(p){ setDone(prev=>{ const n=new Set(prev); n.has(p.id)?n.delete(p.id):n.add(p.id); return n; }); }

  const greeting = allDone ? 'Tuyệt vời, Lan!' : 'Chào buổi sáng, Lan.';

  const headerRight = (
    <button onClick={()=>onNav('notifications')} className="na-press" aria-label="Thông báo, 3 mục chưa đọc" style={{position:'relative',background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:-6,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{position:'relative',display:'inline-flex'}}>
        <NAIcon name="notifications" size={24} color={NA.ink} />
        <span style={{position:'absolute',top:-5,right:-6,minWidth:17,height:17,padding:'0 4px',borderRadius:9,background:NA.red,border:`2px solid ${NA.bg}`,display:'flex',alignItems:'center',justifyContent:'center',font:`700 10px/1 'Instrument Sans'`,color:'#fff'}}>3</span>
      </span>
    </button>
  );

  if (state==='loading') return <Page title={greeting} dateCap="Thứ Bảy · 13 tháng 6" right={headerRight}><HomeLoading/></Page>;
  if (state==='error')   return <Page title={greeting} dateCap="Thứ Bảy · 13 tháng 6" right={headerRight}><HomeError onRetry={()=>onNav('home')}/></Page>;
  if (state==='empty')   return <Page title="Chào, Lan 👋" dateCap="Bắt đầu hành trình" right={headerRight}><HomeEmpty onNav={onNav}/></Page>;

  // ── Variant layouts ──
  if (variant==='focus'){
    return (
      <Page title={greeting} dateCap="Thứ Bảy · 13 tháng 6" right={headerRight}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
          <p style={{margin:'0 0 2px',fontSize:14,color:NA.muted,lineHeight:1.5}}>{allDone?'Bạn đã hoàn thành kế hoạch hôm nay. Giữ phong độ nhé!':`Còn ${HOME.minutesGoal-minutesDone} phút nữa để giữ chuỗi ${HOME.streak} ngày.`}</p>
          {/* big focus ring */}
          <Card style={{display:'flex',alignItems:'center',gap:18}}>
            <ProgressRing pct={minutesDone/HOME.minutesGoal*100} size={92} stroke={7} color={allDone?NA.green:NA.yellow}>
              <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:24,fontWeight:500,lineHeight:1}}>{minutesDone}</div><div style={{fontSize:9.5,color:NA.muted,marginTop:2}}>/{HOME.minutesGoal} phút</div></div>
            </ProgressRing>
            <div style={{flex:1,minWidth:0}}>
              <Cap style={{marginBottom:6}}>Việc tiếp theo</Cap>
              <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.25}}>{next.title}</div>
              <div style={{fontSize:12.5,color:NA.muted,marginTop:5}}>{next.tag} · {next.time} phút</div>
            </div>
          </Card>
          <Btn variant="primary" size="lg" full onClick={()=>onNav(next.screen)}><YSq size={7} color={NA.yellow}/>Bắt đầu — {next.time} phút</Btn>
          <PlanList plan={HOME.plan} done={effDone} onToggle={toggle} onNav={onNav} allDone={allDone}/>
          <SpeakingPromo onNav={onNav}/>
        </div>
      </Page>
    );
  }

  if (variant==='compact'){
    return (
      <Page title={greeting} dateCap="Thứ Bảy · 13 tháng 6" right={headerRight}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:14}}>
          <StatsRow/>
          <PlanList plan={HOME.plan} done={effDone} onToggle={toggle} onNav={onNav} allDone={allDone}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Card onClick={()=>onNav('roadmap')} style={{textAlign:'left'}}><Cap style={{marginBottom:8}}>Lộ trình</Cap><div style={{...NA.srf,fontSize:24,fontWeight:500}}>{HOME.pathPct}%</div><div style={{fontSize:11.5,color:NA.muted,marginTop:4}}>đến B2</div></Card>
            <Card onClick={()=>onNav('vocab')} style={{textAlign:'left'}}><Cap style={{marginBottom:8}}>Từ vựng</Cap><div style={{...NA.srf,fontSize:24,fontWeight:500}}>24</div><div style={{fontSize:11.5,color:NA.muted,marginTop:4}}>thẻ tới hạn</div></Card>
          </div>
          <DeadlineCard onNav={onNav}/>
          <ResumeLessonCard onNav={onNav}/>
          <SpeakingPromo onNav={onNav}/>
          <TutorEntry onNav={onNav}/>
          <SkillsCard onNav={onNav}/>
        </div>
      </Page>
    );
  }

  // editorial (default)
  return (
    <Page title={greeting} dateCap="Thứ Bảy · 13 tháng 6" right={headerRight}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <p style={{margin:'-2px 0 0',fontSize:14,color:NA.muted,lineHeight:1.5}}>{allDone?'Bạn đã hoàn thành kế hoạch hôm nay. Giữ phong độ nhé!':`Hoàn thành ${HOME.minutesGoal} phút hôm nay để duy trì chuỗi ${HOME.streak} ngày.`}</p>
        <HomeHero next={next} minutesDone={minutesDone} allDone={allDone} streak={HOME.streak} onNav={onNav}/>
        <PlanList plan={HOME.plan} done={effDone} onToggle={toggle} onNav={onNav} allDone={allDone}/>
        <StatsRow/>
        <DeadlineCard onNav={onNav}/>
        <PathCard onNav={onNav}/>
        <ResumeLessonCard onNav={onNav}/>
        <SpeakingPromo onNav={onNav}/>
        <TutorEntry onNav={onNav}/>
        <SkillsCard onNav={onNav}/>
        <BadgesStrip/>
      </div>
    </Page>
  );
}

Object.assign(window, { NAHome, HOME });
