// na-class-detail.jsx — Lớp học drill-ins:
//   NAAssignment (chi tiết + nộp bài + kết quả đã chấm), NAAnnouncement,
//   NAClassMessage (placeholder), NAClassJoin (xác nhận tham gia)
// Reads selection via window.naGetAsgn / window.naGetAnn. State map: window.ASGN_STATE.

/* ── shared bits ── */
function AsgnStatusChip({ st }){
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 11px',borderRadius:'var(--na-radius,4px)',background:naSoft(st.c,'subtle'),color:st.c,font:`700 11.5px/1 'Instrument Sans'`}}>
      <NAIcon name={st.icon} size={15} fill color={st.c}/>{st.label}
    </span>
  );
}

function AttachRow({ f, onNav }){
  return (
    <button onClick={()=>window.gaToast&&window.gaToast('Đang mở '+f.name)} className="na-tap" aria-label={'Mở tệp '+f.name} style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'13px 14px',background:NA.bg,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left'}}>
      <div style={{width:34,height:34,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.red,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="description" size={19} color={NA.red}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.name}</div>
        <div style={{fontSize:11.5,color:NA.muted,marginTop:2}}>{f.size}</div>
      </div>
      <NAIcon name="download" size={20} color={NA.muted} style={{flexShrink:0}}/>
    </button>
  );
}

function DetailLoading(){
  return (
    <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
      <div style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}><Sk w="35%" h={11}/><Sk w="80%" h={22} mt={12}/><Sk w="55%" h={12} mt={10}/></div>
      <div style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}><Sk w="90%" h={13}/><Sk w="96%" h={13} mt={9}/><Sk w="60%" h={13} mt={9}/></div>
      <div style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:18}}><Sk h={120} r={6}/></div>
    </div>
  );
}
function DetailError({ onRetry }){
  return (
    <div style={{padding:'48px 28px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <NAIcon name="cloud_off" size={44} color={NA.subtle}/>
      <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Không tải được bài tập</div>
      <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Kết nối chập chờn. Kiểm tra mạng và thử lại nhé.</p>
      <Btn variant="ghost" onClick={onRetry}><NAIcon name="refresh" size={18}/>Thử lại</Btn>
    </div>
  );
}

/* ── submission controls by mode ── */
function SubmitWrite({ value, onChange }){
  return (
    <div>
      <Cap style={{marginBottom:9}}>Bài làm của bạn</Cap>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder="Viết bài của bạn ở đây bằng tiếng Đức…" rows={7}
        style={{width:'100%',border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'13px 14px',font:`400 14.5px/1.55 'Instrument Sans'`,color:NA.ink,background:NA.bg,outline:'none',resize:'vertical'}}/>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:7,fontSize:11.5,color:NA.subtle}}>
        <span>{value.trim()? value.trim().split(/\s+/).length : 0} từ</span><span>Tự lưu nháp</span>
      </div>
    </div>
  );
}
function SubmitUpload({ file, onPick }){
  return (
    <div>
      <Cap style={{marginBottom:9}}>Tệp nộp</Cap>
      {file ? (
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',background:NA.bg,border:`1px solid ${NA.green}`,borderRadius:'var(--na-radius,4px)'}}>
          <NAIcon name="task" size={22} color={NA.green}/>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{file}</div><div style={{fontSize:11.5,color:NA.muted,marginTop:2}}>Sẵn sàng để nộp</div></div>
          <button onClick={()=>onPick(null)} aria-label="Bỏ tệp" style={{background:'none',border:'none',cursor:'pointer',padding:8,margin:-8}}><NAIcon name="close" size={18} color={NA.muted}/></button>
        </div>
      ) : (
        <button onClick={()=>onPick('Bai_lam_tuan5.pdf')} aria-label="Chọn tệp để đính kèm" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,width:'100%',padding:'24px 16px',background:NA.bg,border:`1.5px dashed ${NA.border}`,borderRadius:'var(--na-radius,4px)',cursor:'pointer'}}>
          <NAIcon name="upload_file" size={28} color={NA.muted}/>
          <span style={{fontSize:13.5,fontWeight:600,color:NA.ink}}>Chọn ảnh hoặc PDF</span>
          <span style={{fontSize:11.5,color:NA.subtle}}>Tối đa 10 MB</span>
        </button>
      )}
    </div>
  );
}
function SubmitRecord({ recorded, onToggle }){
  return (
    <div style={{textAlign:'center',padding:'4px 0'}}>
      <Cap style={{marginBottom:14,textAlign:'left'}}>Ghi âm bài nói</Cap>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,height:38,marginBottom:14}}>
        {Array.from({length:30}).map((_,i)=>(
          <span key={i} style={{width:3,borderRadius:2,background:recorded?NA.green:NA.border,height:`${recorded?30+Math.abs(Math.sin(i))*60:24}%`,transition:'all 0.3s'}}/>
        ))}
      </div>
      <button onClick={onToggle} aria-label={recorded?'Ghi lại':'Bắt đầu ghi âm'} className="na-press" style={{width:64,height:64,borderRadius:'50%',background:recorded?NA.card:NA.red,border:`4px solid ${recorded?NA.green:naSoft(NA.red,'bold')}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
        <NAIcon name={recorded?'replay':'mic'} size={26} fill color={recorded?NA.green:'#fff'}/>
      </button>
      <div style={{fontSize:12.5,color:NA.muted,marginTop:11}}>{recorded?'Đã ghi 0:48 · nhấn để ghi lại':'Nhấn để ghi âm (60–90 giây)'}</div>
    </div>
  );
}
function SubmitQuiz({ qcount, onNav }){
  return (
    <div style={{textAlign:'center',padding:'8px 0'}}>
      <div style={{width:52,height:52,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.blue,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}><NAIcon name="quiz" size={26} color={NA.blue}/></div>
      <div style={{...NA.srf,fontSize:18,fontWeight:500}}>{qcount||10} câu trắc nghiệm</div>
      <p style={{margin:'7px auto 0',fontSize:13,color:NA.muted,lineHeight:1.5,maxWidth:250}}>Làm trong 15 phút, chỉ nộp được 1 lần. Hệ thống chấm tự động.</p>
    </div>
  );
}
function SubmitSpeaking({ onNav }){
  return (
    <div style={{textAlign:'center',padding:'8px 0'}}>
      <PersonaAvatar p={PERSONAS[0]} size={56} talking/>
      <div style={{...NA.srf,fontSize:18,fontWeight:500,marginTop:12}}>Phỏng vấn với {PERSONAS[0].name}</div>
      <p style={{margin:'7px auto 14px',fontSize:13,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Vào phòng luyện nói AI. Khi kết thúc, điểm và nhận xét sẽ tự gửi cho giáo viên.</p>
    </div>
  );
}

/* ════════ CHI TIẾT BÀI TẬP + NỘP BÀI + KẾT QUẢ ════════ */
function NAAssignment({ onNav, state='default' }){
  const a = window.naGetAsgn();
  const st = (window.ASGN_STATE||{})[a.state] || {label:'',c:NA.muted,icon:'help'};
  const [text,setText] = React.useState(a.submitted||'');
  const [file,setFile] = React.useState(null);
  const [rec,setRec] = React.useState(false);
  const [done,setDone] = React.useState(false);   // just-submitted this session

  if (state==='loading') return <Page title="Bài tập" back="Lớp học" onBack={()=>onNav('class')} hasTab={false}><DetailLoading/></Page>;
  if (state==='error')   return <Page title="Bài tập" back="Lớp học" onBack={()=>onNav('class')} hasTab={false}><DetailError onRetry={()=>onNav('class-assignment')}/></Page>;

  const isGraded = a.state==='graded';
  const isPending = a.state==='submitted' || done;
  const isRegrade = a.state==='regrade';
  const canSubmit = (a.state==='todo' || a.state==='overdue' || isRegrade) && !done;

  // submit enable check by mode
  const ready = a.mode==='write' ? text.trim().length>10
    : a.mode==='upload' ? !!file
    : a.mode==='record' ? rec
    : true; // quiz / speaking start immediately

  function doSubmit(){
    if (a.mode==='quiz') { onNav('class'); window.gaToast&&window.gaToast('Mở bài quiz — tính năng đang phát triển'); return; }
    if (a.mode==='speaking') { onNav('speaking-live'); return; }
    setDone(true);
  }

  return (
    <Page title={a.title} dateCap={`${a.type} · ${a.points} điểm`} back="Lớp học" onBack={()=>onNav('class')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* status + due */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <AsgnStatusChip st={done?(window.ASGN_STATE.submitted):st}/>
          <span style={{font:`${a.urgent?700:500} 12.5px/1 'Instrument Sans'`,color:a.urgent?NA.red:NA.muted}}>{done?'Vừa nộp':a.due}</span>
        </div>

        {/* graded result banner */}
        {isGraded && (
          <Card pad={0} style={{background:NA.ink}}>
            <div style={{padding:'20px 20px',display:'flex',alignItems:'center',gap:18}}>
              <ProgressRing pct={a.score} size={86} stroke={7} color={NA.yellow} track="rgba(255,255,255,0.16)">
                <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:26,fontWeight:500,color:NA.bg,lineHeight:1}}>{a.score}</div><div style={{fontSize:9,color:'#A39E94',marginTop:2}}>/100</div></div>
              </ProgressRing>
              <div style={{flex:1}}>
                <Cap color={NA.yellow} style={{marginBottom:8}}>Đã chấm</Cap>
                <div style={{...NA.srf,fontSize:20,fontWeight:500,color:NA.bg,lineHeight:1.15}}>{a.score>=85?'Rất tốt':a.score>=70?'Đạt yêu cầu':'Cần cố gắng'}</div>
                <div style={{fontSize:12,color:'#A39E94',marginTop:7,lineHeight:1.5}}>Nộp {a.submittedAt} · chấm {a.gradedAt}</div>
              </div>
            </div>
          </Card>
        )}

        {/* regrade banner */}
        {isRegrade && (
          <Card accent={NA.red} style={{display:'flex',gap:12}}>
            <NAIcon name="replay" size={22} color={NA.red} style={{marginTop:1}}/>
            <div><div style={{fontWeight:700,fontSize:14,color:NA.red}}>Bài cần nộp lại</div><div style={{fontSize:13,color:NA.muted,marginTop:4,lineHeight:1.5}}>Giáo viên đã xem và yêu cầu chỉnh sửa. Sửa theo nhận xét bên dưới rồi nộp lại.</div></div>
          </Card>
        )}

        {/* brief */}
        <Card>
          <Cap style={{marginBottom:10}}>Đề bài</Cap>
          <p style={{margin:0,fontSize:14,color:NA.ink,lineHeight:1.6}}>{a.brief}</p>
          {a.attach && a.attach.length>0 && (
            <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:9}}>
              <Cap>Tài liệu đính kèm</Cap>
              {a.attach.map((f,i)=>(<AttachRow key={i} f={f} onNav={onNav}/>))}
            </div>
          )}
        </Card>

        {/* teacher feedback (graded / regrade) */}
        {(isGraded||isRegrade) && a.feedback && (
          <Card accent={isGraded?NA.green:NA.gold}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:11}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:naSoft(NA.violet,'bold'),display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{...NA.srf,fontSize:13,fontWeight:600,color:NA.violet}}>T</span></div>
              <Cap color={NA.ink}>Nhận xét của {CLASS.teacher.replace('Thầy ','thầy ')}</Cap>
            </div>
            <p style={{margin:0,fontSize:13.5,color:NA.ink,lineHeight:1.6}}>{a.feedback}</p>
          </Card>
        )}

        {/* error corrections (graded with errors) */}
        {isGraded && a.errors && a.errors.length>0 && (
          <Card>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}><NAIcon name="edit" size={18} color={NA.orange}/><Cap color={NA.orange}>Chữa lỗi</Cap></div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {a.errors.map((e,i)=>(
                <div key={i} style={{paddingBottom:i<a.errors.length-1?16:0,borderBottom:i<a.errors.length-1?`1px solid ${NA.border}`:'none'}}>
                  <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}><NAIcon name="close" size={16} color={NA.red} style={{marginTop:2}}/><span style={{fontSize:13.5,lineHeight:1.45,color:NA.muted,textDecoration:'line-through',textDecorationColor:naSoft(NA.red,'bold')}}>{e.wrong}</span></div>
                  <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}><NAIcon name="check" size={16} color={NA.green} style={{marginTop:2}}/><span style={{fontSize:13.5,lineHeight:1.45,color:NA.ink,fontWeight:600}}>{e.right}</span></div>
                  <div style={{fontSize:12.5,color:NA.muted,lineHeight:1.5,paddingLeft:24,fontStyle:'italic'}}>{e.note}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* submitted work (graded / pending read-only) */}
        {(isGraded||isPending) && a.submitted && (
          <Card>
            <Cap style={{marginBottom:10}}>Bài đã nộp</Cap>
            <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.6,fontStyle:'italic'}}>{a.submitted}</p>
          </Card>
        )}

        {/* pending state */}
        {isPending && !isGraded && (
          <Card style={{display:'flex',alignItems:'center',gap:13}}>
            <NAIcon name="schedule" size={24} color={NA.blue}/>
            <div><div style={{fontWeight:700,fontSize:14,color:NA.blue}}>Đã nộp · chờ giáo viên chấm</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Nộp lúc {done?'vừa xong':a.submittedAt}. Bạn sẽ được báo khi có điểm.</div></div>
          </Card>
        )}

        {/* submission UI */}
        {canSubmit && (
          <Card>
            {a.mode==='write'   && <SubmitWrite value={text} onChange={setText}/>}
            {a.mode==='upload'  && <SubmitUpload file={file} onPick={setFile}/>}
            {a.mode==='record'  && <SubmitRecord recorded={rec} onToggle={()=>setRec(r=>!r)}/>}
            {a.mode==='quiz'    && <SubmitQuiz qcount={a.qcount} onNav={onNav}/>}
            {a.mode==='speaking'&& <SubmitSpeaking onNav={onNav}/>}
          </Card>
        )}

        {/* primary action */}
        {canSubmit && (
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:2}}>
            <Btn variant="primary" size="lg" full onClick={doSubmit} style={{opacity:ready?1:0.5}}>
              <YSq size={7} color={NA.yellow}/>
              {a.mode==='quiz'?'Bắt đầu làm bài':a.mode==='speaking'?'Luyện nói với AI':isRegrade?'Nộp lại bài':'Nộp bài'}
            </Btn>
            {a.mode!=='quiz' && a.mode!=='speaking' && <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle}}>Sau khi nộp sẽ không sửa lại được</div>}
          </div>
        )}

        {/* graded footer actions */}
        {isGraded && (
          <Btn variant="ghost" full onClick={()=>onNav('class')}>Về lớp học</Btn>
        )}
      </div>
    </Page>
  );
}

/* ════════ CHI TIẾT THÔNG BÁO ════════ */
function NAAnnouncement({ onNav }){
  const an = window.naGetAnn();
  const [ack,setAck] = React.useState(false);
  return (
    <Page title="Thông báo" dateCap={`Lớp ${CLASS.name}`} back="Lớp học" onBack={()=>onNav('class')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card accent={an.pin?NA.yellow:undefined}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:13}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:naSoft(NA.violet,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...NA.srf,fontSize:15,fontWeight:600,color:NA.violet}}>{an.author[0]}</span></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13.5}}>{an.author}</div>
              <div style={{fontSize:11.5,color:NA.subtle,marginTop:2}}>{an.date}</div>
            </div>
            {an.pin && <Pill tone="yellow"><NAIcon name="push_pin" size={12} fill color={NA.gold}/>Ghim</Pill>}
          </div>
          <div style={{...NA.srf,fontSize:22,fontWeight:500,lineHeight:1.25,letterSpacing:'-0.01em',marginBottom:12}}>{an.title}</div>
          <p style={{margin:0,fontSize:14.5,color:NA.ink,lineHeight:1.65,whiteSpace:'pre-line'}}>{an.body}</p>
        </Card>

        {an.ack && (
          <Btn variant={ack?'soft':'primary'} size="lg" full onClick={()=>setAck(true)}>
            {ack ? <><NAIcon name="check" size={18} color={NA.green}/>Đã xác nhận đọc</> : 'Tôi đã đọc thông báo'}
          </Btn>
        )}
        <Btn variant="ghost" full onClick={()=>onNav('class-message')}><NAIcon name="reply" size={18}/>Hỏi giáo viên</Btn>
      </div>
    </Page>
  );
}

/* ════════ NHẮN GIÁO VIÊN — chat thread ════════ */
const MSG_SEED = [
  { from:'them', t:'Chào Lan, bài viết "Im Krankenhaus" của em rất tốt. Thầy đã chấm 8.5 nhé.', at:'Hôm qua · 09:15' },
  { from:'me',   t:'Em cảm ơn thầy ạ. Phần Dativ em vẫn hay nhầm, thầy có thể gợi ý cách nhớ không ạ?', at:'Hôm qua · 09:40' },
  { from:'them', t:'Em nhớ mẹo: "helfen, danken, gehören" luôn đi với Dativ. Thầy gửi em phiếu bài tập trong mục Tài liệu nhé.', at:'Hôm qua · 10:02' },
  { from:'me',   t:'Vâng ạ, em sẽ làm tối nay.', at:'Hôm qua · 10:05' },
];
function NAClassMessage({ onNav }){
  const [msgs,setMsgs] = React.useState(MSG_SEED);
  const [text,setText] = React.useState('');
  const [typing,setTyping] = React.useState(false);
  const endRef = React.useRef(null);
  React.useEffect(()=>{ if(endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight; },[msgs,typing]);

  function send(){
    const v = text.trim(); if(!v) return;
    setMsgs(m=>[...m,{from:'me',t:v,at:'Bây giờ'}]); setText(''); setTyping(true);
    setTimeout(()=>{ setTyping(false); setMsgs(m=>[...m,{from:'them',t:'Thầy đã nhận được tin nhắn của em. Thầy sẽ phản hồi chi tiết trong giờ hành chính nhé.',at:'Bây giờ'}]); }, 1800);
  }

  const header = (
    <div className="na-headerglass" style={{position:'absolute',top:0,left:0,right:0,zIndex:8,paddingTop:SAFE_TOP-6,paddingBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:11,padding:'0 14px'}}>
        <button onClick={()=>onNav('class')} className="na-press" style={{background:'none',border:'none',padding:'8px 6px 8px 0',margin:'-8px 0',cursor:'pointer',display:'flex'}}><NAIcon name="chevron_left" size={26} weight={400} color={NA.ink}/></button>
        <div style={{position:'relative',flexShrink:0}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:naSoft(NA.violet,'bold'),display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{...NA.srf,fontSize:16,fontWeight:600,color:NA.violet}}>T</span></div>
          <span style={{position:'absolute',right:0,bottom:0,width:11,height:11,borderRadius:'50%',background:NA.green,border:`2px solid ${NA.bg}`}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.1}}>{CLASS.teacher}</div>
          <div style={{fontSize:11.5,color:NA.green,marginTop:2}}>Đang hoạt động</div>
        </div>
      </div>
    </div>
  );

  function Bubble({ m }){
    const me = m.from==='me';
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:me?'flex-end':'flex-start',gap:3}}>
        <div style={{maxWidth:'78%',padding:'11px 14px',borderRadius:16,fontSize:14,lineHeight:1.45,
          background:me?NA.ink:NA.card, color:me?NA.bg:NA.ink, border:me?'none':`1px solid ${NA.border}`,
          borderBottomRightRadius:me?4:16, borderBottomLeftRadius:me?16:4}}>{m.t}</div>
        <span style={{fontSize:10.5,color:NA.subtle,padding:'0 4px'}}>{m.at}</span>
      </div>
    );
  }

  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {header}
      <div ref={endRef} className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+52}px 16px 14px`,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{textAlign:'center',padding:'4px 0 8px'}}><span style={{fontSize:11,color:NA.subtle,background:NA.paper,padding:'5px 12px',borderRadius:100}}>Lớp {CLASS.name}</span></div>
        {msgs.map((m,i)=>(<Bubble key={i} m={m}/>))}
        {typing && <div style={{display:'flex',gap:4,padding:'12px 14px',background:NA.card,border:`1px solid ${NA.border}`,borderRadius:16,borderBottomLeftRadius:4,alignSelf:'flex-start'}}>{[0,1,2].map(i=>(<span key={i} style={{width:6,height:6,borderRadius:'50%',background:NA.subtle,animation:`naDot 1.2s ${i*0.16}s infinite`}}/>))}</div>}
      </div>
      {/* composer */}
      <div style={{padding:'10px 14px',paddingBottom:HOME_IND+10,borderTop:`1px solid ${NA.border}`,background:NA.bg,display:'flex',alignItems:'flex-end',gap:9}}>
        <button onClick={()=>window.gaToast&&window.gaToast('Đính kèm tệp')} className="na-press" style={{width:40,height:40,borderRadius:'50%',background:NA.paper,border:`1px solid ${NA.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><NAIcon name="add" size={22} color={NA.muted}/></button>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }} placeholder="Nhắn cho giáo viên…" rows={1}
          style={{flex:1,resize:'none',border:`1px solid ${NA.border}`,borderRadius:20,padding:'10px 14px',font:`400 14px/1.4 'Instrument Sans'`,color:NA.ink,background:NA.card,outline:'none',maxHeight:90}}/>
        <button onClick={send} className="na-press" aria-label="Gửi" style={{width:40,height:40,borderRadius:'50%',background:text.trim()?NA.ink:NA.border,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'background 0.2s'}}><NAIcon name="arrow_upward" size={22} color={text.trim()?NA.yellow:NA.subtle}/></button>
      </div>
    </div>
  );
}

/* ════════ THAM GIA LỚP — xác nhận ════════ */
function NAClassJoin({ onNav }){
  return (
    <Page title="Tham gia lớp" dateCap="Mã: K30-PFLEGE" back="Quay lại" onBack={()=>onNav('class')} hasTab={false}>
      <div style={{padding:'8px 20px 0',display:'flex',flexDirection:'column',gap:18}}>
        <div style={{textAlign:'center',padding:'12px 0 2px'}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="check" size={38} color={NA.green}/></div>
          <div style={{...NA.srf,fontSize:24,fontWeight:500,lineHeight:1.2}}>Tìm thấy lớp học</div>
          <p style={{margin:'9px auto 0',fontSize:13.5,color:NA.muted,lineHeight:1.55,maxWidth:280}}>Xác nhận thông tin bên dưới để tham gia. Giáo viên sẽ thấy bạn trong danh sách lớp.</p>
        </div>

        <Card pad={0}>
          <div style={{padding:'16px',display:'flex',alignItems:'center',gap:13,borderBottom:`1px solid ${NA.border}`}}>
            <div style={{width:46,height:46,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.violet,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="groups" size={24} color={NA.violet}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{...NA.srf,fontSize:18,fontWeight:500}}>{CLASS.name}</div>
              <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>{CLASS.teacher} · {CLASS.members} học viên</div>
            </div>
          </div>
          {[['schedule','Lịch học',CLASS.schedule],['flag','Mục tiêu','Pflege B1 → B2']].map(([ic,l,v])=>(
            <div key={l} style={{padding:'13px 16px',display:'flex',alignItems:'center',gap:12,borderBottom:l==='Lịch học'?`1px solid ${NA.border}`:'none'}}>
              <NAIcon name={ic} size={20} color={NA.muted}/>
              <span style={{fontSize:13,color:NA.muted,flex:1}}>{l}</span>
              <span style={{fontSize:13,fontWeight:600,color:NA.ink}}>{v}</span>
            </div>
          ))}
        </Card>

        <div style={{display:'flex',flexDirection:'column',gap:9}}>
          <Btn variant="primary" size="lg" full onClick={()=>window.__naJoin&&window.__naJoin()}>
            <YSq size={7} color={NA.yellow}/>Vào lớp học
          </Btn>
          <Btn variant="ghost" full onClick={()=>onNav('class')}>Nhập mã khác</Btn>
        </div>
      </div>
    </Page>
  );
}

Object.assign(window, { NAAssignment, NAAnnouncement, NAClassMessage, NAClassJoin });
