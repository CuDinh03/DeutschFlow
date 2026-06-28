// na-node.jsx — Lesson/Node detail (mở từ Lộ trình) + hoàn thành node + locked.
// Exports: NANode, openNode. Reads window.__naNodeData.

let NODE_DATA = { t:'Krankenhaus & Pflege', kind:'Chuyên ngành', level:'B1', state:'current', pct:42, meta:'24 từ tới hạn · 14 cảnh còn lại' };
function openNode(onNav, node, level){ NODE_DATA = { ...node, level: level||node.level||'B1' }; window.__naNodeData = NODE_DATA; onNav('node'); }
window.__naNodeData = NODE_DATA;

// build activities from node kind
function nodeActivities(node){
  const K = node.kind;
  let acts;
  if (K==='Ngữ pháp') acts = [
    { t:'Bài học lý thuyết', d:'Quy tắc + bảng chia', ic:'menu_book', screen:'grammar-lesson' },
    { t:'Luyện tập', d:'5 câu vận dụng', ic:'edit_note', screen:'grammar-practice' },
    { t:'Kiểm tra nhanh', d:'Quiz cuối chặng', ic:'quiz', screen:'grammar-practice' },
  ];
  else if (K==='Luyện nói') acts = [
    { t:'Từ vựng tình huống', d:'Chuẩn bị mẫu câu', ic:'translate', screen:'vocab' },
    { t:'Phỏng vấn thử với AI', d:'~10 phút · tự chấm', ic:'record_voice_over', screen:'speaking-select' },
  ];
  else if (K==='Đánh giá') acts = [
    { t:'Ôn tập tổng hợp', d:'Điểm chính của cấp', ic:'history', screen:'grammar-review' },
    { t:'Bài thi thử', d:'Nghe · Đọc · Viết · Nói', ic:'assignment', screen:'exam' },
  ];
  else acts = [ // Từ vựng / Chuyên ngành / Hội thoại / Viết
    { t:'Học từ mới', d:'Thẻ song ngữ + ví dụ', ic:'style', screen:'vocab-cards' },
    { t:'Ôn thẻ (SRS)', d:'Spaced repetition', ic:'repeat', screen:'srs' },
    { t:'Kiểm tra nhanh', d:'Quiz từ vựng', ic:'quiz', screen:'vocab' },
  ];
  // assign states from node state
  return acts.map((a,i)=>{
    let s='locked';
    if (node.state==='done') s='done';
    else if (node.state==='current'){ s = i===0?'done' : i===1?'current' : 'locked'; }
    return {...a, s};
  });
}

const ACT_S = { done:{c:NA.green,ic:'check_circle'}, current:{c:NA.gold,ic:'play_circle'}, locked:{c:NA.faint,ic:'lock'} };

function NANode({ onNav, state='default' }){
  const node = window.__naNodeData || NODE_DATA;
  const locked = node.state==='locked';
  const acts = nodeActivities(node);

  // completion screen (Tweaks state)
  if (state==='complete'){
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+30}px 24px 16px`,textAlign:'center'}}>
          <div style={{width:84,height:84,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="check" size={44} color={NA.green}/></div>
          <Cap color={NA.gold} style={{marginBottom:8}}>Hoàn thành chặng</Cap>
          <h1 style={{margin:0,...NA.srf,fontSize:26,fontWeight:500,lineHeight:1.2}}>{node.t}</h1>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:16,padding:'11px 18px',borderRadius:99,background:NA.ink,color:NA.bg,font:`700 15px/1 'Instrument Sans'`}}><NAIcon name="bolt" size={19} fill color={NA.yellow}/>+120 XP</div>
          {/* unlock next */}
          <Card style={{marginTop:24,display:'flex',alignItems:'center',gap:13,textAlign:'left'}}>
            <div style={{width:42,height:42,borderRadius:'50%',background:naSoft(NA.yellow,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,animation:'naPop 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="lock_open" size={21} color={NA.gold}/></div>
            <div style={{flex:1}}><Cap color={NA.gold} style={{marginBottom:4}}>Đã mở khoá chặng tiếp theo</Cap><div style={{...NA.srf,fontSize:16,fontWeight:500}}>Dativ & Akkusativ</div></div>
          </Card>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('roadmap')}><YSq size={7} color={NA.yellow}/>Tiếp tục lộ trình</Btn>
        </div>
      </div>
    );
  }

  const firstActive = acts.find(a=>a.s==='current') || acts.find(a=>a.s!=='done' && a.s!=='locked');
  const allDone = acts.every(a=>a.s==='done');

  return (
    <Page title={node.t} dateCap={`${node.level} · ${node.kind}`} back="Lộ trình" onBack={()=>onNav('roadmap')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* hero */}
        <Card pad={0} style={{background:locked?NA.paper:NA.ink}}>
          <div style={{padding:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:11}}>
              {locked ? <Pill tone="muted"><NAIcon name="lock" size={12} color={NA.muted}/>Đang khoá</Pill> : <Pill tone="yellow" solid>{node.state==='done'?'Đã hoàn thành':'Đang học'}</Pill>}
              <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:locked?NA.muted:'#A39E94'}}>{node.kind}</span>
            </div>
            <div style={{...NA.srf,fontSize:21,fontWeight:500,lineHeight:1.2,color:locked?NA.ink:NA.bg}}>{node.t}</div>
            <p style={{margin:'9px 0 0',fontSize:13.5,color:locked?NA.muted:'#A39E94',lineHeight:1.55}}>{node.meta || `Hoàn thành các hoạt động bên dưới để chinh phục chặng "${node.t}".`}</p>
            {!locked && node.state==='current' && <div style={{marginTop:16}}><ProgressBar pct={node.pct||33} color={NA.yellow}/><div style={{fontSize:11.5,color:'#A39E94',marginTop:8}}>{node.pct||33}% hoàn thành</div></div>}
          </div>
        </Card>

        {locked ? (
          <Card accent={NA.gold} style={{display:'flex',gap:12}}>
            <NAIcon name="lock" size={22} color={NA.gold} style={{marginTop:1}}/>
            <div><div style={{fontWeight:700,fontSize:14}}>Điều kiện mở khoá</div><div style={{fontSize:13,color:NA.muted,marginTop:4,lineHeight:1.55}}>Hoàn thành chặng <strong style={{color:NA.ink}}>Krankenhaus & Pflege</strong> để mở khoá chặng này.</div></div>
          </Card>
        ) : (
          <div>
            <Cap style={{padding:'0 2px 11px'}}>Hoạt động trong chặng</Cap>
            <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
              {acts.map((a,i)=>{
                const st = ACT_S[a.s], dis = a.s==='locked';
                return (
                  <button key={i} onClick={()=>!dis&&onNav(a.screen)} className={dis?'':'na-tap'} disabled={dis} aria-label={a.t} style={{display:'flex',alignItems:'center',gap:13,padding:'15px 16px',background:NA.card,border:'none',cursor:dis?'default':'pointer',textAlign:'left',opacity:dis?0.55:1}}>
                    <div style={{width:36,height:36,borderRadius:'var(--na-radius,4px)',background:a.s==='current'?naSoft(NA.gold,'subtle'):NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name={a.ic} size={20} color={a.s==='current'?NA.gold:NA.muted}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.2}}>{a.t}</div>
                      <div style={{fontSize:12,color:NA.muted,marginTop:2}}>{a.d}</div>
                    </div>
                    <NAIcon name={st.ic} size={a.s==='locked'?17:21} fill={a.s==='done'} color={st.c}/>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* footer CTA */}
      {!locked && (
        <div style={{position:'absolute',left:0,right:0,bottom:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`14px 20px ${HOME_IND+12}px`}}>
          <Btn variant="primary" size="lg" full onClick={()=>firstActive?onNav(firstActive.screen):onNav('roadmap')}>
            <YSq size={7} color={NA.yellow}/>{allDone?'Ôn lại chặng':node.state==='done'?'Xem lại':firstActive&&node.state==='current'?'Tiếp tục':'Bắt đầu'}
          </Btn>
        </div>
      )}
    </Page>
  );
}

Object.assign(window, { NANode, openNode, nodeActivities });
