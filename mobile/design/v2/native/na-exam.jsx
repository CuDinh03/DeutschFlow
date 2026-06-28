// na-exam.jsx — Thi thử: danh sách gói → tổng quan + làm bài → kết quả; Xếp trình độ.
// Exports: NAExam, NAExamRun, NAExamResult, NAAssessment, EXAM_PACKS, openExam

const EXAM_PARTS_ICON = { Nghe:'hearing', 'Đọc':'menu_book', 'Viết':'edit_note', 'Nói':'mic' };
const EXAM_PACKS = [
  { id:'b1', level:'B1', t:'Goethe-Zertifikat B1', sub:'Đề thi thử chuẩn Goethe', dur:'~165 phút',
    parts:[['Nghe','25′'],['Đọc','65′'],['Viết','60′'],['Nói','15′']], free:true, attempts:'2 lần đã làm' },
  { id:'pflege', level:'B1–B2', t:'Pflege · Fachsprachprüfung', sub:'Chuyên ngành điều dưỡng', dur:'~60 phút',
    parts:[['Đọc','20′'],['Viết','20′'],['Nói','20′']], pro:true, attempts:'Chưa làm' },
  { id:'b2', level:'B2', t:'Goethe-Zertifikat B2', sub:'Trình độ nâng cao', dur:'~190 phút',
    parts:[['Nghe','35′'],['Đọc','65′'],['Viết','75′'],['Nói','15′']], pro:true, attempts:'Chưa làm' },
  { id:'a2', level:'A2', t:'Start Deutsch A2', sub:'Nền tảng cơ bản', dur:'~90 phút',
    parts:[['Nghe','30′'],['Đọc','30′'],['Viết','30′']], free:true, attempts:'1 lần đã làm' },
];

let EXAM_SEL='b1';
function openExam(onNav,id){ EXAM_SEL=id; onNav('exam-run'); }
window.naGetExam = ()=> EXAM_PACKS.find(p=>p.id===EXAM_SEL) || EXAM_PACKS[0];

/* ════════ 1 · DANH SÁCH GÓI ════════ */
function NAExam({ onNav, state='default' }){
  const plan = usePlan();
  const pro = plan==='pro'||plan==='trial';
  if (state==='loading'){
    return <Page title="Thi thử" dateCap="Prüfung" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:14}}>{[0,1,2].map(i=>(<div key={i} style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}><Sk w="30%" h={11}/><Sk w="70%" h={18} mt={10}/><Sk h={5} mt={16}/></div>))}</div>
    </Page>;
  }
  return (
    <Page title="Thi thử" dateCap="Prüfung · luyện đề chuẩn" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:14}}>
        <Card accent={NA.blue} style={{display:'flex',alignItems:'center',gap:13}}>
          <NAIcon name="quiz" size={24} color={NA.blue}/>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>Luyện đề như thi thật</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Đầy đủ 4 kỹ năng, bấm giờ và chấm tự động.</div></div>
        </Card>

        {EXAM_PACKS.map(p=>{
          const locked = p.pro && !pro;
          return (
            <Card key={p.id} pad={0} onClick={()=>locked?onNav('upgrade'):openExam(onNav,p.id)} style={{opacity:locked?0.92:1}}>
              <div style={{padding:'16px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:46,height:46,borderRadius:'var(--na-radius,4px)',background:NA.paper,border:`1px solid ${NA.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...NA.srf,fontSize:16,fontWeight:600,lineHeight:1}}>{p.level}</span></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                      <span style={{fontWeight:700,fontSize:15,lineHeight:1.2}}>{p.t}</span>
                      {p.pro ? <Pill tone="yellow" solid>Pro</Pill> : <Pill tone="green">Free</Pill>}
                    </div>
                    <div style={{fontSize:12.5,color:NA.muted}}>{p.sub}</div>
                  </div>
                  {locked ? <NAIcon name="lock" size={20} color={NA.faint}/> : <NAIcon name="chevron_right" size={20} color={NA.faint}/>}
                </div>
                <div style={{display:'flex',gap:7,marginTop:14,flexWrap:'wrap'}}>
                  {p.parts.map(([nm,dr])=>(
                    <span key={nm} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 9px',borderRadius:'var(--na-radius,4px)',background:NA.bg,border:`1px solid ${NA.border}`,font:`600 11px/1 'Instrument Sans'`,color:NA.muted}}><NAIcon name={EXAM_PARTS_ICON[nm]} size={14} color={NA.subtle}/>{nm} · {dr}</span>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:13,paddingTop:12,borderTop:`1px solid ${NA.border}`}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:NA.muted}}><NAIcon name="schedule" size={15} color={NA.subtle}/>{p.dur}</span>
                  <span style={{fontSize:11.5,color:NA.subtle}}>{p.attempts}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

/* ════════ 2 · TỔNG QUAN + LÀM BÀI ════════ */
const EXAM_QS = [
  { skill:'Nghe', type:'listen', q:'Nghe đoạn hội thoại. Người phụ nữ muốn đặt gì?', audio:'0:42', opts:['Một cuộc hẹn khám bệnh','Một bàn ăn tối','Một vé tàu'], a:0 },
  { skill:'Đọc', type:'read', passage:'Die Apotheke ist von Montag bis Freitag von 8 bis 18 Uhr geöffnet. Am Samstag schließt sie schon um 13 Uhr. Sonntags ist geschlossen.', q:'Thứ Bảy hiệu thuốc đóng cửa lúc mấy giờ?', opts:['13 giờ','18 giờ','Cả ngày'], a:0 },
  { skill:'Viết', type:'write', q:'Viết 2–3 câu mô tả công việc hằng ngày của bạn ở viện dưỡng lão (tối thiểu 30 từ).' },
  { skill:'Nói', type:'speak', q:'Hãy tự giới thiệu và nói về kinh nghiệm điều dưỡng của bạn (khoảng 60 giây).' },
];
function fmt(s){ const m=Math.floor(s/60), ss=s%60; return `${m}:${ss<10?'0':''}${ss}`; }

function NAExamRun({ onNav, state='default' }){
  const pack = window.naGetExam();
  const [view,setView] = React.useState('intro'); // intro | run
  const [qi,setQi] = React.useState(0);
  const [ans,setAns] = React.useState({});
  const [left,setLeft] = React.useState(180); // demo 3:00
  const [confirm,setConfirm] = React.useState(false);
  const warn = state==='warn' || left<=120;
  const q = EXAM_QS[qi];

  React.useEffect(()=>{ if(view!=='run'||left<=0) return; const t=setTimeout(()=>setLeft(l=>l-1),1000); return ()=>clearTimeout(t); },[view,left]);

  if (view==='intro'){
    return (
      <Page title={pack.t} dateCap={`${pack.level} · ${pack.dur}`} back="Thi thử" onBack={()=>onNav('exam')} hasTab={false}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
          <Card>
            <Cap style={{marginBottom:11}}>Hướng dẫn</Cap>
            <div style={{display:'flex',flexDirection:'column',gap:11}}>
              {[['timer','Bài thi có bấm giờ — hãy chuẩn bị không gian yên tĩnh.'],['headphones','Phần Nghe cần tai nghe; phần Nói cần micro.'],['edit_note','Trả lời lần lượt, có thể quay lại câu trước.'],['fact_check','Nộp xong sẽ được chấm tự động theo 4 kỹ năng.']].map(([ic,tx])=>(
                <div key={tx} style={{display:'flex',gap:11,alignItems:'flex-start'}}><NAIcon name={ic} size={20} color={NA.blue} style={{marginTop:1}}/><span style={{fontSize:13.5,color:NA.ink,lineHeight:1.5}}>{tx}</span></div>
              ))}
            </div>
          </Card>
          <Card pad={0}>
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>Cấu trúc đề</Cap></div>
            {pack.parts.map(([nm,dr],i)=>(
              <div key={nm} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:i<pack.parts.length-1?`1px solid ${NA.border}`:'none'}}>
                <NAIcon name={EXAM_PARTS_ICON[nm]} size={20} color={NA.muted}/>
                <span style={{flex:1,fontSize:14,fontWeight:600}}>{nm}</span>
                <span style={{fontSize:12.5,color:NA.muted}}>{dr}</span>
              </div>
            ))}
          </Card>
          <Btn variant="primary" size="lg" full onClick={()=>{setView('run');setLeft(180);}}><YSq size={7} color={NA.yellow}/>Bắt đầu làm bài</Btn>
        </div>
      </Page>
    );
  }

  const answered = Object.keys(ans).length;
  function setA(v){ setAns(a=>({...a,[qi]:v})); }
  function submit(){ if(answered<EXAM_QS.length){ setConfirm(true); return; } onNav('exam-result'); }

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {/* header */}
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,background:warn?naSoft(NA.red,'subtle'):NA.card,borderBottom:`1px solid ${NA.border}`,transition:'background 0.3s'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px 11px'}}>
          <button onClick={()=>setView('intro')} aria-label="Thoát" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,margin:'0 -8px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:`700 11px/1 'Instrument Sans'`,letterSpacing:'0.06em',textTransform:'uppercase',color:NA.muted}}>{q.skill} · Câu {qi+1}/{EXAM_QS.length}</div>
          </div>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 11px',borderRadius:99,background:warn?NA.red:NA.ink,color:'#fff'}}>
            <NAIcon name="timer" size={15} color={warn?'#fff':NA.yellow}/><span style={{...NA.srf,fontSize:15,fontWeight:500,fontVariantNumeric:'tabular-nums'}}>{fmt(left)}</span>
          </div>
        </div>
        {warn && <div style={{padding:'7px 16px',display:'flex',alignItems:'center',gap:7,background:NA.red}}><NAIcon name="warning" size={15} color="#fff"/><span style={{font:`600 12px/1 'Instrument Sans'`,color:'#fff'}}>Sắp hết giờ — hãy hoàn tất và nộp bài.</span></div>}
        <div style={{height:3,background:NA.border}}><div style={{width:`${(qi+1)/EXAM_QS.length*100}%`,height:'100%',background:NA.yellow,transition:'width 0.3s'}}/></div>
      </div>

      {/* body */}
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'20px 20px 16px'}}>
        {q.type==='listen' && (
          <div style={{marginBottom:18}}>
            <div style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.ink,borderRadius:'var(--na-radius,4px)'}}>
              <button aria-label="Phát audio" className="na-press" style={{width:44,height:44,borderRadius:'50%',background:NA.yellow,border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="play_arrow" size={26} fill color={NA.ink}/></button>
              <div style={{flex:1,display:'flex',gap:2,alignItems:'center',height:26}}>{[10,16,22,14,24,12,18,20,9,15,11,19,13,21,8,17].map((h,i)=>(<div key={i} style={{flex:1,background:i<5?NA.yellow:'#5b574f',height:`${h*3}%`,borderRadius:1}}/>))}</div>
              <span style={{font:`600 12px/1 'Instrument Sans'`,color:'#A39E94'}}>{q.audio}</span>
            </div>
          </div>
        )}
        {q.type==='read' && (
          <Card style={{marginBottom:18,background:NA.paper}}>
            <Cap style={{marginBottom:9}}>Đoạn văn</Cap>
            <p style={{margin:0,...NA.srf,fontSize:15.5,lineHeight:1.6,color:NA.ink}}>{q.passage}</p>
          </Card>
        )}

        <div style={{...NA.srf,fontSize:21,fontWeight:500,lineHeight:1.35,marginBottom:20}}>{q.q}</div>

        {(q.type==='listen'||q.type==='read') && (
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {q.opts.map((o,i)=>{
              const on = ans[qi]===i;
              return (
                <button key={i} onClick={()=>setA(i)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:on?naSoft(NA.yellow,'subtle'):NA.card,border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
                  <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<NAIcon name="check" size={14} color="#fff"/>}</div>
                  <span style={{fontSize:15,fontWeight:on?600:500}}>{o}</span>
                </button>
              );
            })}
          </div>
        )}
        {q.type==='write' && (
          <textarea value={ans[qi]||''} onChange={e=>setA(e.target.value)} placeholder="Viết câu trả lời bằng tiếng Đức…" rows={6}
            style={{width:'100%',border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'14px',font:`400 15px/1.6 'Instrument Sans'`,color:NA.ink,background:NA.bg,outline:'none',resize:'vertical'}}/>
        )}
        {q.type==='speak' && (
          <div style={{textAlign:'center',padding:'10px 0'}}>
            <button onClick={()=>setA('recorded')} aria-label="Ghi âm" className="na-press" style={{width:72,height:72,borderRadius:'50%',background:ans[qi]?NA.green:NA.red,border:`4px solid ${ans[qi]?naSoft(NA.green,'bold'):naSoft(NA.red,'bold')}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name={ans[qi]?'check':'mic'} size={30} fill color="#fff"/></button>
            <div style={{fontSize:13,color:NA.muted,marginTop:12}}>{ans[qi]?'Đã ghi 0:58 · nhấn để ghi lại':'Nhấn để ghi âm câu trả lời'}</div>
          </div>
        )}
      </div>

      {/* footer nav */}
      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`14px 20px ${HOME_IND+12}px`,display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>setQi(Math.max(0,qi-1))} disabled={qi===0} aria-label="Câu trước" className="na-press" style={{width:48,height:48,borderRadius:'var(--na-radius,4px)',border:`1px solid ${NA.border}`,background:NA.card,cursor:qi===0?'default':'pointer',opacity:qi===0?0.4:1,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="chevron_left" size={24} color={NA.ink}/></button>
        {qi<EXAM_QS.length-1 ? (
          <Btn variant="primary" size="lg" full onClick={()=>setQi(qi+1)}>Câu tiếp theo</Btn>
        ) : (
          <Btn variant="primary" size="lg" full onClick={submit}><YSq size={7} color={NA.yellow}/>Nộp bài</Btn>
        )}
      </div>

      {/* submit confirm sheet */}
      {confirm && (
        <div style={{position:'absolute',inset:0,background:'rgba(20,19,17,0.5)',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
          <div onClick={()=>setConfirm(false)} style={{position:'absolute',inset:0}}/>
          <div style={{position:'relative',background:NA.card,borderTopLeftRadius:18,borderTopRightRadius:18,padding:`10px 24px ${HOME_IND+18}px`,animation:'naSheetUp 0.3s ease both'}}>
            <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 18px'}}/>
            <div style={{textAlign:'center',marginBottom:18}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:naSoft(NA.orange,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}><NAIcon name="warning" size={28} color={NA.orange}/></div>
              <div style={{...NA.srf,fontSize:20,fontWeight:500}}>Bạn chưa làm hết bài</div>
              <p style={{margin:'8px auto 0',fontSize:13.5,color:NA.muted,maxWidth:280,lineHeight:1.5}}>Còn {EXAM_QS.length-answered} câu chưa trả lời. Nộp bây giờ sẽ tính các câu đó là bỏ trống.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Btn variant="primary" size="lg" full onClick={()=>onNav('exam-result')}>Vẫn nộp bài</Btn>
              <Btn variant="ghost" full onClick={()=>setConfirm(false)}>Quay lại làm tiếp</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════ 3 · KẾT QUẢ + PHÂN TÍCH ════════ */
const EXAM_RESULT = {
  score:72, band:'B1', target:'B2', duration:'2:41',
  skills:[ ['Nghe',78,'hearing'], ['Đọc',84,'menu_book'], ['Viết',62,'edit_note'], ['Nói',64,'mic'] ],
  tips:[ 'Phần Viết: chú ý cấu trúc câu phụ và động từ ở cuối.', 'Phần Nói: mở rộng câu trả lời, dùng từ nối (deshalb, trotzdem).' ],
};
function NAExamResult({ onNav, state='default' }){
  if (state==='loading'){
    return <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:40,textAlign:'center'}}>
      <ProgressRing pct={70} size={92} stroke={7} color={NA.yellow}><NAIcon name="fact_check" size={30} color={NA.yellow} style={{animation:'naPulse 1.2s infinite'}}/></ProgressRing>
      <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Đang chấm bài thi…</div>
    </div>;
  }
  const r = EXAM_RESULT;
  return (
    <Page title="Kết quả thi thử" dateCap="Goethe B1 · phân tích" back="Xong" onBack={()=>onNav('exam')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card pad={0} style={{background:NA.ink}}>
          <div style={{padding:'22px 20px',display:'flex',alignItems:'center',gap:18}}>
            <ProgressRing pct={r.score} size={92} stroke={7} color={NA.yellow} track="rgba(255,255,255,0.16)">
              <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:28,fontWeight:500,color:NA.bg,lineHeight:1}}>{r.score}</div><div style={{fontSize:9,color:'#A39E94',marginTop:2}}>/100</div></div>
            </ProgressRing>
            <div style={{flex:1}}>
              <Cap color={NA.yellow} style={{marginBottom:8}}>Mức đạt được</Cap>
              <div style={{...NA.srf,fontSize:23,fontWeight:500,color:NA.bg,lineHeight:1.1}}>Trình độ {r.band}</div>
              <div style={{fontSize:12.5,color:'#A39E94',marginTop:8,lineHeight:1.5}}>Mục tiêu <strong style={{color:NA.bg}}>{r.target}</strong> · còn 1 bậc · {r.duration}</div>
            </div>
          </div>
        </Card>

        <Card>
          <Cap style={{marginBottom:15}}>Theo kỹ năng</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:13}}>
            {r.skills.map(([l,v,ic])=>(
              <div key={l}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <NAIcon name={ic} size={17} color={NA.muted}/>
                  <span style={{fontSize:13.5,fontWeight:600,flex:1}}>{l}</span>
                  <span style={{...NA.srf,fontSize:15,fontWeight:500}}>{v}</span>
                </div>
                <ProgressBar pct={v} color={v>=80?NA.green:v>=70?NA.yellow:NA.orange}/>
              </div>
            ))}
          </div>
        </Card>

        <Card accent={NA.blue}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><NAIcon name="twb_incandescent" size={19} color={NA.blue}/><Cap color={NA.blue}>Gợi ý cải thiện</Cap></div>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {r.tips.map((t,i)=>(<div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}><NAIcon name="arrow_forward" size={16} color={NA.blue} style={{marginTop:2}}/><span style={{fontSize:13.5,lineHeight:1.5}}>{t}</span></div>))}
          </div>
        </Card>

        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" full onClick={()=>window.gaToast&&window.gaToast('Mở chế độ xem lại bài')}>Xem lại bài</Btn>
          <Btn variant="primary" full onClick={()=>onNav('exam-run')}><YSq size={6} color={NA.yellow}/>Làm lại</Btn>
        </div>
      </div>
    </Page>
  );
}

/* ════════ 4 · XẾP TRÌNH ĐỘ (ASSESSMENT) ════════ */
const ASSESS_QS = [
  { q:'"Ich ___ aus Vietnam."', opts:['komme','kommt','kommen'], a:0 },
  { q:'Chọn mạo từ đúng: "___ Frau ist Ärztin."', opts:['Der','Die','Das'], a:1 },
  { q:'"Gestern ___ ich ins Krankenhaus gegangen."', opts:['habe','bin','war'], a:1 },
  { q:'"Wenn ich Zeit hätte, ___ ich mehr lernen."', opts:['werde','würde','wurde'], a:1 },
  { q:'"Der Patient, ___ ich gestern half, ist heute besser."', opts:['dem','den','der'], a:0 },
];
function NAAssessment({ onNav, state='default' }){
  const [view,setView] = React.useState(state==='result'?'result':'intro'); // intro|test|result
  const [qi,setQi] = React.useState(0);
  const [pick,setPick] = React.useState(null);
  const [score,setScore] = React.useState(state==='result'?3:0);
  React.useEffect(()=>{ if(state==='result'){setView('result');setScore(3);} },[state]);

  if (view==='intro'){
    return (
      <Page title="Xếp trình độ" dateCap="Einstufungstest" back="Quay lại" onBack={()=>onNav('progress')} hasTab={false}>
        <div style={{padding:'8px 20px 0',display:'flex',flexDirection:'column',gap:16}}>
          <div style={{textAlign:'center',padding:'14px 0 2px'}}>
            <div style={{width:68,height:68,borderRadius:'var(--na-radius,4px)',background:NA.paper,border:`1px solid ${NA.border}`,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14}}><NAIcon name="straighten" size={32} color={NA.ink}/></div>
            <h1 style={{margin:0,...NA.srf,fontSize:25,fontWeight:500,lineHeight:1.2}}>Xác định trình độ của bạn</h1>
            <p style={{margin:'10px auto 0',fontSize:14,color:NA.muted,lineHeight:1.55,maxWidth:290}}>{ASSESS_QS.length} câu hỏi nhanh (~5 phút) để chúng tôi gợi ý cấp độ và điều chỉnh lộ trình phù hợp.</p>
          </div>
          <Btn variant="primary" size="lg" full onClick={()=>setView('test')}><YSq size={7} color={NA.yellow}/>Bắt đầu</Btn>
        </div>
      </Page>
    );
  }

  if (view==='result'){
    const lv = score<=1?{k:'A1',l:'A1'}:score===2?{k:'A2',l:'A2'}:score<=3?{k:'B1',l:'B1'}:{k:'B2',l:'B2'};
    return (
      <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+20}px 24px 16px`,textAlign:'center'}}>
          <ProgressRing pct={(score/ASSESS_QS.length)*100} size={108} stroke={8} color={NA.green}><div style={{...NA.srf,fontSize:32,fontWeight:500}}>{lv.l}</div></ProgressRing>
          <h1 style={{margin:'22px 0 0',...NA.srf,fontSize:25,fontWeight:500,lineHeight:1.2}}>Trình độ ước tính: {lv.l}</h1>
          <p style={{margin:'10px auto 0',fontSize:14,color:NA.muted,lineHeight:1.55,maxWidth:290}}>Bạn trả lời đúng {score}/{ASSESS_QS.length} câu. Chúng tôi sẽ thiết kế lộ trình từ {lv.l} hướng tới mục tiêu của bạn.</p>
          <Card style={{marginTop:22,textAlign:'left',display:'flex',alignItems:'center',gap:13}}>
            <NAIcon name="route" size={24} color={NA.gold}/>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>Lộ trình đề xuất</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>{lv.l} → B2 · Pflege · ~9 tuần</div></div>
          </Card>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('roadmap')}><YSq size={7} color={NA.yellow}/>Áp dụng vào lộ trình</Btn>
          <LinkBtn color={NA.muted} onClick={()=>onNav('progress')}>Để sau</LinkBtn>
        </div>
      </div>
    );
  }

  const q = ASSESS_QS[qi];
  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 20px 0`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,height:46}}>
          <button onClick={()=>setView('intro')} aria-label="Đóng" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,margin:'0 -8px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1}}><ProgressBar pct={qi/ASSESS_QS.length*100} color={NA.yellow} h={6}/></div>
          <span style={{...NA.srf,fontSize:14,fontWeight:500,color:NA.muted}}>{qi+1}/{ASSESS_QS.length}</span>
        </div>
      </div>
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'24px 24px 16px'}}>
        <Cap style={{marginBottom:14}}>Chọn đáp án đúng</Cap>
        <div style={{...NA.srf,fontSize:24,fontWeight:500,lineHeight:1.35,marginBottom:24}}>{q.q}</div>
        <div style={{display:'flex',flexDirection:'column',gap:11}}>
          {q.opts.map((o,i)=>{
            const on=pick===i;
            return <button key={i} onClick={()=>setPick(i)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:on?naSoft(NA.yellow,'subtle'):NA.card,border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}><div style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<NAIcon name="check" size={15} color="#fff"/>}</div><span style={{...NA.srf,fontSize:18,fontWeight:500}}>{o}</span></button>;
          })}
        </div>
      </div>
      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`}}>
        <Btn variant="primary" size="lg" full onClick={()=>{ if(pick===null) return; const ns=score+(pick===q.a?1:0); if(qi+1<ASSESS_QS.length){setScore(ns);setQi(qi+1);setPick(null);} else {setScore(ns);setView('result');} }} style={{opacity:pick===null?0.5:1}}>{qi+1<ASSESS_QS.length?'Câu tiếp theo':'Xem kết quả'}</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { NAExam, NAExamRun, NAExamResult, NAAssessment, EXAM_PACKS, openExam });
