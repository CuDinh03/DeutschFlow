// na-class.jsx — Lớp học (student view): hub 3 tab (Bài tập · Bảng tin · Tiến độ)
//   + B2C empty/join. Exports: NAClass, NAClassEmpty, CLASS, ASGN_STATE, openAsgn, openAnn

// nguồn: B2B — GET /api/student/class → ClassDto (assignments/announcements). Chưa thuộc nhóm "ios" P1 → giữ mock.
//   ASGN_STATE keys là state UI bài tập: todo|overdue|submitted|graded|regrade (chờ DTO typed ở BE).
const CLASS = {
  name:'K30 · Pflege B1', teacher:'Thầy Nguyễn T. Trung', code:'K30-PFLEGE',
  schedule:'T2 · T4 · T6 — 19:00', members:18, progress:62, attendance:94,
  sessionNext:'Thứ Hai, 19:00 — Dativ in der Pflege',
  announcements:[
    { pin:true, author:'Thầy Trung', date:'Hôm nay · 08:30', read:false,
      title:'Buổi học T2 chuyển sang phòng Zoom mới',
      body:'Link Zoom đã cập nhật trong mục Buổi học. Các em nhớ ôn trước bài Dativ & Akkusativ để vào lớp luyện hội thoại Pflege nhé.\n\nMã phòng: 882 4471 0099 — mật khẩu sẽ gửi trước giờ học 15 phút. Nếu vào trễ, các em xem lại bản ghi trong mục tài liệu.',
      ack:true },
    { pin:false, author:'Thầy Trung', date:'Hôm qua · 21:10', read:false,
      title:'Đáp án bài Quiz tuần 5 đã có',
      body:'Lớp làm khá tốt phần từ vựng. Phần ngữ pháp Dativ còn nhiều lỗi, mình sẽ chữa kỹ buổi tới. Các em tự xem đáp án và đánh dấu câu sai để hỏi trên lớp.' },
    { pin:false, author:'Trung tâm', date:'02/06 · 10:00', read:true,
      title:'Lịch nghỉ lễ & học bù tháng 6',
      body:'Tuần tới nghỉ 1 buổi do lễ. Buổi học bù sẽ được thông báo và cập nhật vào lịch lớp.' },
  ],
  assignments:[
    { id:'a1', title:'Bài viết: Mein Arbeitstag', type:'Viết', mode:'write', due:'còn 1 ngày', state:'todo', urgent:true,
      brief:'Viết 120–150 từ mô tả một ngày làm việc của bạn ở viện dưỡng lão. Dùng thì hiện tại và ít nhất 5 động từ tách (trennbare Verben).',
      attach:[{name:'Goi_y_dan_bai.pdf', size:'180 KB'}], points:100 },
    { id:'a2', title:'Quiz: Dativ & Akkusativ', type:'Quiz', mode:'quiz', due:'còn 3 ngày', state:'todo',
      brief:'10 câu trắc nghiệm về giới từ đi với Dativ / Akkusativ. Thời gian 15 phút, chỉ làm 1 lần.',
      points:100, qcount:10 },
    { id:'a7', title:'Phỏng vấn thử: Pflege B1', type:'Luyện nói', mode:'speaking', due:'còn 5 ngày', state:'todo',
      brief:'Luyện phỏng vấn với AI (Frau Schmidt) tối thiểu 8 câu. Hệ thống tự chấm phát âm, ngữ pháp, từ vựng rồi gửi điểm cho giáo viên.',
      points:100 },
    { id:'a3', title:'Ghi âm: Sich vorstellen', type:'Luyện nói', mode:'record', due:'đã nộp 2 giờ trước', state:'submitted',
      brief:'Ghi âm 60–90 giây tự giới thiệu bản thân bằng tiếng Đức: tên, quê quán, kinh nghiệm điều dưỡng.',
      submittedAt:'Hôm nay · 16:20', points:100 },
    { id:'a4', title:'Bài tập từ vựng tuần 5', type:'Từ vựng', mode:'upload', due:'Quá hạn 1 ngày', state:'overdue',
      brief:'Hoàn thành phiếu bài tập từ vựng chủ đề Körperteile và nộp lại ảnh chụp hoặc PDF.',
      attach:[{name:'Phieu_tuan5.pdf', size:'240 KB'}], points:100 },
    { id:'a8', title:'Bài viết: Mein Lebenslauf', type:'Viết', mode:'write', due:'Chấm lỗi · nộp lại', state:'regrade',
      brief:'Viết CV dạng văn xuôi khoảng 150 từ: học vấn, kinh nghiệm, lý do sang Đức làm điều dưỡng.',
      submittedAt:'11/06 · 22:00',
      submitted:'Ich heiße Lan. Ich have worked drei Jahre als Krankenschwester in Vietnam...',
      feedback:'Bài còn lẫn tiếng Anh ("have worked") và thiếu phần lý do sang Đức. Em sửa lại cho thuần tiếng Đức và bổ sung đoạn động cơ rồi nộp lại nhé.', points:100 },
    { id:'a5', title:'Bài viết: Im Krankenhaus', type:'Viết', mode:'write', due:'Đã chấm · Thầy Trung', state:'graded', score:85,
      brief:'Mô tả một tình huống chăm sóc bệnh nhân ở bệnh viện, khoảng 150 từ.',
      submittedAt:'12/06 · 21:40', gradedAt:'13/06 · 09:15',
      submitted:'In meinem Praktikum im Krankenhaus arbeite ich auf der Station. Jeden Morgen helfe ich den Patienten beim Waschen und Anziehen. Ich messe den Blutdruck und dokumentiere alles genau...',
      feedback:'Bài viết tốt, ý mạch lạc và đúng thuật ngữ chuyên ngành. Chú ý chia động từ tách và dùng Dativ sau "mit". Tiếp tục phát huy nhé!',
      errors:[
        { wrong:'Ich helfe die Patienten.', right:'Ich helfe den Patienten.', note:'"helfen" đi với Dativ → den Patienten.' },
        { wrong:'Ich anziehe die Kleidung.', right:'Ich ziehe die Kleidung an.', note:'Động từ tách: tiền tố "an" chuyển xuống cuối câu.' },
      ], points:100 },
    { id:'a6', title:'Quiz: Körperteile', type:'Quiz', mode:'quiz', due:'Đã chấm', state:'graded', score:90,
      brief:'15 câu từ vựng các bộ phận cơ thể và giống của danh từ.',
      submittedAt:'10/06 · 20:10', gradedAt:'10/06 · 20:30',
      feedback:'Xuất sắc! Chỉ sai 1 câu về mạo từ der/das. Từ vựng cơ thể đã nắm rất chắc.', points:100 },
  ],
};

const ASGN_STATE = {
  todo:      { label:'Chưa nộp',           tone:'orange', icon:'radio_button_unchecked', c:NA.orange },
  overdue:   { label:'Quá hạn',            tone:'red',    icon:'error',                  c:NA.red },
  submitted: { label:'Đã nộp · chờ chấm',  tone:'blue',   icon:'schedule',               c:NA.blue },
  graded:    { label:'Đã chấm',            tone:'green',  icon:'check_circle',           c:NA.green },
  regrade:   { label:'Chấm lỗi · nộp lại', tone:'red',    icon:'replay',                 c:NA.red },
};

// ── selection store (read by detail screens in na-class-detail.jsx) ──
let CLASS_SEL = 'a1', ANN_SEL = 0;
function openAsgn(onNav, id){ CLASS_SEL = id; onNav('class-assignment'); }
function openAnn(onNav, i){ ANN_SEL = i; onNav('class-announcement'); }
window.naGetAsgn = ()=> CLASS.assignments.find(a=>a.id===CLASS_SEL) || CLASS.assignments[0];
window.naGetAnn  = ()=> CLASS.announcements[ANN_SEL] || CLASS.announcements[0];

function AssignmentRow({ a, onNav, last }){
  const st = ASGN_STATE[a.state];
  return (
    <button onClick={()=>openAsgn(onNav, a.id)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'15px 16px',background:'none',border:'none',borderBottom:last?'none':`1px solid ${NA.border}`,cursor:'pointer',textAlign:'left'}}>
      <NAIcon name={st.icon} size={22} fill={a.state==='graded'} color={st.c} style={{flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
          <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.muted}}>{a.type}</span>
        </div>
        <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.25}}>{a.title}</div>
        <div style={{font:`${a.urgent?700:500} 11.5px/1 'Instrument Sans'`,color:a.urgent?NA.red:NA.muted,marginTop:5}}>{a.due}</div>
      </div>
      {a.state==='graded'
        ? <span style={{...NA.srf,fontSize:19,fontWeight:500,color:NA.green,flexShrink:0,fontVariantNumeric:'tabular-nums'}}>{a.score}<span style={{fontSize:12,color:NA.subtle}}>/100</span></span>
        : <Pill tone={st.tone}>{st.label}</Pill>}
      <NAIcon name="chevron_right" size={20} color={NA.faint} style={{flexShrink:0,marginLeft:-4}}/>
    </button>
  );
}

function ClassTabs({ tab, onTab }){
  const tabs = [['asgn','Bài tập'],['feed','Bảng tin'],['prog','Tiến độ']];
  return (
    <div style={{display:'flex',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
      {tabs.map(([k,l])=>{
        const on = tab===k;
        return <button key={k} onClick={()=>onTab(k)} className="na-press" style={{flex:1,padding:'11px 4px',background:on?NA.ink:NA.card,color:on?NA.bg:NA.muted,border:'none',cursor:'pointer',font:`700 12.5px/1 'Instrument Sans'`}}>{l}</button>;
      })}
    </div>
  );
}

function NAClassEmpty({ onNav }){
  const [code,setCode] = React.useState('');
  return (
    <Page title="Lớp học" dateCap="Học cùng giáo viên">
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
        <div style={{textAlign:'center',padding:'18px 10px 4px'}}>
          <div style={{width:64,height:64,borderRadius:'var(--na-radius,4px)',background:NA.paper,border:`1px solid ${NA.border}`,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
            <NAIcon name="groups" size={32} color={NA.subtle}/>
          </div>
          <div style={{...NA.srf,fontSize:22,fontWeight:500,lineHeight:1.2}}>Bạn chưa tham gia lớp nào</div>
          <p style={{margin:'9px auto 0',fontSize:13.5,color:NA.muted,lineHeight:1.55,maxWidth:280}}>Nhập mã lớp do giáo viên hoặc trung tâm cung cấp để nhận bài tập, thông báo và theo dõi tiến độ cùng lớp.</p>
        </div>

        <Card>
          <Cap style={{marginBottom:10}}>Mã lớp</Cap>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="VD: K30-PFLEGE" maxLength={14}
            style={{width:'100%',border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'14px 14px',font:`600 17px/1 'Instrument Sans'`,letterSpacing:'0.08em',color:NA.ink,background:NA.bg,outline:'none',textAlign:'center'}}/>
          <Btn variant="primary" full size="lg" style={{marginTop:12,opacity:code.length>=4?1:0.5}} onClick={()=>code.length>=4&&onNav('class-join')}>
            <YSq size={7} color={NA.yellow}/>Tham gia lớp
          </Btn>
        </Card>

        <div>
          <Cap style={{padding:'0 2px 10px'}}>Khi tham gia lớp, bạn sẽ có</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
            {[['assignment','Bài tập & hạn nộp từ giáo viên'],['forum','Thông báo và chữa bài của lớp'],['insights','Theo dõi tiến độ so với lớp'],['co_present','Lịch học trực tuyến']].map(([ic,tx])=>(
              <div key={tx} style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card}}>
                <NAIcon name={ic} size={21} color={NA.ink}/><span style={{fontSize:14,fontWeight:500}}>{tx}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={()=>onNav('home')} style={{background:'none',border:'none',cursor:'pointer',font:`600 13px/1 'Instrument Sans'`,color:NA.muted,textDecoration:'underline',padding:'10px 0',alignSelf:'center'}}>Tôi tự học, bỏ qua →</button>
      </div>
    </Page>
  );
}

function NAClass({ onNav, state='default' }){
  const [tab,setTab] = React.useState('asgn');
  const [reminded,setReminded] = React.useState(false);
  const [reads,setReads] = React.useState(()=>CLASS.announcements.map(a=>a.read));
  if (state==='empty') return <NAClassEmpty onNav={onNav}/>;

  const unread = reads.filter(r=>!r).length;
  const headerRight = <button onClick={()=>onNav('class-message')} className="na-press" aria-label="Nhắn giáo viên" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:-6,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="forum" size={23} color={NA.ink}/></button>;

  const counts = CLASS.assignments.reduce((m,a)=>{ m[a.state]=(m[a.state]||0)+1; return m; },{});
  const asgnCap = `${counts.todo||0} chưa nộp · ${(counts.overdue||0)+(counts.regrade||0)} cần xử lý`;

  return (
    <Page title={CLASS.name} dateCap="Lớp học của tôi" right={headerRight}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* class meta */}
        <Card pad={0}>
          <div style={{padding:'15px 16px',display:'flex',alignItems:'center',gap:13,borderBottom:`1px solid ${NA.border}`}}>
            <div style={{width:42,height:42,borderRadius:'50%',background:naSoft(NA.violet,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...NA.srf,fontSize:18,fontWeight:600,color:NA.violet}}>T</span></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14.5}}>{CLASS.teacher}</div>
              <div style={{fontSize:12,color:NA.muted,marginTop:2}}>Giáo viên chủ nhiệm · {CLASS.members} học viên</div>
            </div>
            <span style={{font:`700 11px/1 'Instrument Sans'`,letterSpacing:'0.04em',color:NA.violet,background:naSoft(NA.violet,'subtle'),padding:'7px 9px',borderRadius:'var(--na-radius,4px)'}}>{CLASS.code}</span>
          </div>
          <div style={{display:'flex'}}>
            {[['Lịch học',CLASS.schedule],['Có mặt',CLASS.attendance+'%']].map(([l,v],i)=>(
              <div key={l} style={{flex:1,padding:'12px 16px',borderLeft:i?`1px solid ${NA.border}`:'none'}}>
                <Cap style={{marginBottom:6,fontSize:9}}>{l}</Cap>
                <div style={{fontSize:13,fontWeight:600,color:NA.ink}}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* next session */}
        <Card accent={NA.yellow} style={{display:'flex',alignItems:'center',gap:13}}>
          <NAIcon name="event_upcoming" size={24} color={NA.gold}/>
          <div style={{flex:1,minWidth:0}}>
            <Cap color={NA.gold} style={{marginBottom:5}}>Buổi học tiếp theo</Cap>
            <div style={{fontWeight:600,fontSize:13.5,lineHeight:1.3}}>{CLASS.sessionNext}</div>
          </div>
          <Btn variant={reminded?'soft':'ghost'} size="sm" onClick={()=>setReminded(r=>!r)}>
            {reminded ? <><NAIcon name="check" size={16} color={NA.green}/>Đã nhắc</> : 'Nhắc tôi'}
          </Btn>
        </Card>

        <ClassTabs tab={tab} onTab={setTab}/>

        {tab==='asgn' && (
          <Card pad={0}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}>
              <Cap>Bài tập</Cap><Cap color={NA.gold}>{asgnCap}</Cap>
            </div>
            {CLASS.assignments.map((a,i)=>(<AssignmentRow key={a.id} a={a} onNav={onNav} last={i===CLASS.assignments.length-1}/>))}
          </Card>
        )}

        {tab==='feed' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 2px'}}>
              <Cap>{unread>0?`${unread} thông báo chưa đọc`:'Tất cả đã đọc'}</Cap>
              <button onClick={()=>setReads(CLASS.announcements.map(()=>true))} disabled={!unread} style={{background:'none',border:'none',cursor:unread?'pointer':'default',font:`600 12px/1 'Instrument Sans'`,color:unread?NA.ink:NA.faint,padding:'8px 6px',margin:'-8px -6px'}}>Đọc hết</button>
            </div>
            {CLASS.announcements.map((an,i)=>(
              <Card key={i} accent={an.pin?NA.yellow:undefined} onClick={()=>{ setReads(p=>{const n=[...p];n[i]=true;return n;}); openAnn(onNav,i); }} style={{cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}>
                  {an.pin && <NAIcon name="push_pin" size={15} fill color={NA.gold}/>}
                  <span style={{fontWeight:700,fontSize:13}}>{an.author}</span>
                  <span style={{fontSize:11.5,color:NA.subtle}}>· {an.date}</span>
                  {!reads[i] && <span style={{width:8,height:8,borderRadius:'50%',background:NA.blue,marginLeft:'auto',flexShrink:0}}/>}
                </div>
                <div style={{...NA.srf,fontSize:16.5,fontWeight:500,lineHeight:1.3,marginBottom:7}}>{an.title}</div>
                <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.55,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{an.body}</p>
              </Card>
            ))}
          </div>
        )}

        {tab==='prog' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Card>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <Cap>Tiến độ khóa K30</Cap><span style={{...NA.srf,fontSize:20,fontWeight:500}}>{CLASS.progress}%</span>
              </div>
              <ProgressBar pct={CLASS.progress} color={NA.violet} h={6}/>
              <div style={{fontSize:12.5,color:NA.muted,marginTop:10,lineHeight:1.45}}>Hoàn thành 12/20 buổi · bạn đang đi đúng tiến độ lớp.</div>
            </Card>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Card><Cap style={{marginBottom:8}}>Điểm TB lớp</Cap><div style={{...NA.srf,fontSize:24,fontWeight:500}}>84<span style={{color:NA.subtle,fontSize:15}}>/100</span></div><div style={{fontSize:11.5,color:NA.green,marginTop:4}}>Bạn: 86 ▲</div></Card>
              <Card><Cap style={{marginBottom:8}}>Bài đã nộp</Cap><div style={{...NA.srf,fontSize:24,fontWeight:500}}>14<span style={{color:NA.subtle,fontSize:16}}>/17</span></div><div style={{fontSize:11.5,color:NA.muted,marginTop:4}}>3 bài còn lại</div></Card>
            </div>
            <Card style={{display:'flex',alignItems:'center',gap:13}}>
              <ProgressRing pct={CLASS.attendance} size={48} stroke={5} color={NA.green}><span style={{...NA.srf,fontSize:13,fontWeight:500}}>{CLASS.attendance}</span></ProgressRing>
              <div><div style={{fontWeight:600,fontSize:14}}>Chuyên cần tốt</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Vắng 1 buổi trong 17 buổi đã học.</div></div>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}

Object.assign(window, { NAClass, NAClassEmpty, CLASS, ASGN_STATE, openAsgn, openAnn });
