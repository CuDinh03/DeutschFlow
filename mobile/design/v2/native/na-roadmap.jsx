// na-roadmap.jsx — Lộ trình: vertical thumb-scrollable learning path (locked/current/done)
// Exports: NARoadmap

// nguồn: GET /api/roadmap/tree → TreeDto  (tab "Giai đoạn" dùng path/milestone; node-list legacy của RoadmapTreeController)
const ROAD = {
  pct:42, current:'B1', goal:'B2',
  levels:[
    { code:'A1', label:'Khởi đầu', state:'done', nodes:[
      { t:'Bảng chữ & phát âm', s:'done', score:'9.1', kind:'Cơ bản' },
      { t:'Chào hỏi & giới thiệu', s:'done', score:'8.8', kind:'Hội thoại' },
      { t:'Số đếm, giờ giấc', s:'done', score:'9.0', kind:'Từ vựng' },
    ]},
    { code:'A2', label:'Nền tảng', state:'done', nodes:[
      { t:'Gia đình & nghề nghiệp', s:'done', score:'8.5', kind:'Từ vựng' },
      { t:'Thì quá khứ (Perfekt)', s:'done', score:'8.2', kind:'Ngữ pháp' },
      { t:'Mua sắm & dịch vụ', s:'done', score:'8.9', kind:'Hội thoại' },
    ]},
    { code:'B1', label:'Đang học · Pflege', state:'current', nodes:[
      { t:'Cơ thể & sức khỏe', s:'done', score:'8.4', kind:'Từ vựng' },
      { t:'Krankenhaus & Pflege', s:'current', pct:42, kind:'Chuyên ngành', meta:'24 từ tới hạn · 14 cảnh còn lại' },
      { t:'Dativ & Akkusativ', s:'locked', kind:'Ngữ pháp' },
      { t:'Phỏng vấn xin việc', s:'locked', kind:'Luyện nói' },
    ]},
    { code:'B2', label:'Mục tiêu', state:'locked', nodes:[
      { t:'Giao tiếp chuyên môn', s:'locked', kind:'Hội thoại' },
      { t:'Văn bản hành chính', s:'locked', kind:'Viết' },
      { t:'Thi Goethe B2', s:'locked', kind:'Đánh giá' },
    ]},
  ],
};

const SPINE_X = 30;

function RoadNode({ n, last, onNav, lv }){
  const acc = useAcc();
  const done = n.s==='done', cur = n.s==='current';
  const dotBg = done ? NA.ink : cur ? NA.card : NA.bg;
  const dotBorder = done ? NA.ink : cur ? NA.yellow : NA.border;
  return (
    <div style={{position:'relative',paddingLeft:SPINE_X+24,paddingBottom:last?2:18}}>
      {/* connector */}
      {!last && <div style={{position:'absolute',left:SPINE_X-1,top:24,bottom:0,width:2,background:done?NA.ink:NA.border}} />}
      {/* dot */}
      <div style={{position:'absolute',left:SPINE_X-13,top:0,width:26,height:26,borderRadius:'50%',background:dotBg,border:`2.5px solid ${dotBorder}`,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2,boxShadow:cur?`0 0 0 5px ${naSoft(NA.yellow,'bold')}`:'none'}}>
        {done && <NAIcon name="check" size={15} weight={500} color="#fff" />}
        {cur && <YSq size={8} />}
        {n.s==='locked' && <NAIcon name="lock" size={13} color={NA.faint} />}
      </div>
      {/* body */}
      {cur ? (
        <Card accent={NA.yellow} style={{marginTop:-4}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
            <Pill tone="yellow" solid>Đang học</Pill>
            <span style={{font:`600 9px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.muted}}>{n.kind}</span>
          </div>
          <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.25}}>{n.t}</div>
          {n.meta && <div style={{fontSize:12.5,color:NA.muted,margin:'6px 0 12px'}}>{n.meta}</div>}
          <ProgressBar pct={n.pct} color={NA.yellow}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:13}}>
            <span style={{font:`500 12px/1 'Instrument Sans'`,color:NA.muted}}>{n.pct}% hoàn thành</span>
            <Btn variant="primary" size="sm" onClick={()=>openNode(onNav,n,lv)}><YSq size={6} color={NA.yellow}/>Tiếp tục</Btn>
          </div>
        </Card>
      ) : (
        <button onClick={()=>openNode(onNav,n,lv)} className="na-tap" style={{display:'block',width:'100%',textAlign:'left',background:'none',border:'none',cursor:'pointer',paddingTop:1,opacity:n.s==='locked'?0.6:1}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
            <div style={{fontWeight:600,fontSize:15,color:done?NA.muted:NA.subtle,lineHeight:1.3}}>{n.t}</div>
            {done && <span style={{...NA.srf,fontSize:14,fontWeight:500,color:NA.green,flexShrink:0}}>{n.score}</span>}
          </div>
          <div style={{font:`600 9.5px/1 'Instrument Sans'`,letterSpacing:'0.08em',textTransform:'uppercase',color:NA.faint,marginTop:5}}>
            {done ? `Hoàn thành · ${n.kind}` : `Mở khóa sau · ${n.kind}`}
          </div>
        </button>
      )}
    </div>
  );
}

function LevelHeader({ lv, first }){
  const cur = lv.state==='current', done = lv.state==='done';
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:first?'2px 0 16px':'26px 0 16px'}}>
      <div style={{width:54,height:54,borderRadius:'var(--na-radius,4px)',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        background: cur?NA.ink : done?NA.card : NA.bg, border:`1px solid ${cur?NA.ink:NA.border}`, color:cur?NA.bg:NA.ink}}>
        <span style={{...NA.srf,fontSize:20,fontWeight:500,lineHeight:1}}>{lv.code}</span>
        {done && <NAIcon name="check" size={13} color={NA.green} style={{marginTop:2}}/>}
      </div>
      <div>
        <Cap color={cur?NA.gold:NA.muted}>{cur?'Cấp độ hiện tại':done?'Đã hoàn thành':'Khóa'}</Cap>
        <div style={{...NA.srf,fontSize:19,fontWeight:500,marginTop:4,lineHeight:1.1}}>{lv.label}</div>
      </div>
    </div>
  );
}

function RoadmapList({ onNav, state='default', tab, onTab }){
  const rmTabs = <RmTabs tab={tab} onTab={onTab}/>;
  if (state==='loading'){
    return (
      <Page title="Lộ trình" dateCap="B1 · Pflege → B2" right={rmTabs}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
          {[0,1,2].map(i=>(<div key={i} style={{display:'flex',gap:14,alignItems:'center'}}><div style={{width:26,height:26,borderRadius:'50%',background:NA.border,animation:'naPulse 1.3s infinite'}}/><div style={{flex:1}}><Sk w="70%" h={14}/><Sk w="40%" h={10} mt={7}/></div></div>))}
        </div>
      </Page>
    );
  }
  const STAGES = [
    { t:'Nền tảng', sub:'A1 · từ vựng & câu cơ bản', s:'done' },
    { t:'Sản sinh', sub:'A2–B1 · diễn đạt chủ động', s:'active' },
    { t:'Lưu loát', sub:'B1–B2 · giao tiếp chuyên môn', s:'upcoming' },
    { t:'Tốt nghiệp', sub:'Đạt chứng chỉ Goethe B2', s:'upcoming' },
  ];
  const NEXT = [
    ['record_voice_over','Luyện nói: Beim Arzt','speaking-select'],
    ['menu_book','Học lá mới: Diagnose','node'],
    ['repeat','Ôn 24 thẻ tới hạn','srs'],
  ];
  return (
    <Page title="Lộ trình" dateCap="Giai đoạn học tập" right={rmTabs}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
        {/* stage stepper */}
        <div style={{paddingLeft:4}}>
          {STAGES.map((st,i)=>{
            const done=st.s==='done', active=st.s==='active';
            const dot = done?NA.green : active?NA.ink : NA.border;
            return (
              <div key={i} style={{position:'relative',paddingLeft:34,paddingBottom:i<STAGES.length-1?22:0}}>
                {i<STAGES.length-1 && <div style={{position:'absolute',left:12,top:26,bottom:0,width:2,background:done?NA.green:NA.border}}/>}
                <div style={{position:'absolute',left:0,top:0,width:26,height:26,borderRadius:'50%',background:active?NA.ink:done?NA.green:NA.card,border:`2px solid ${dot}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {done?<NAIcon name="check" size={15} color="#fff"/>:active?<YSq size={8}/>:<span style={{width:7,height:7,borderRadius:'50%',background:NA.faint}}/>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{...NA.srf,fontSize:18,fontWeight:500,color:st.s==='upcoming'?NA.subtle:NA.ink}}>{st.t}</span>
                  {active && <Pill tone="yellow" solid>Hiện tại</Pill>}
                </div>
                <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>{st.sub}</div>
              </div>
            );
          })}
        </div>

        {/* current progress */}
        <Card>
          <Cap style={{marginBottom:14}}>Tiến độ hiện tại</Cap>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[['Từ vựng đã thuộc','218'],['Phút luyện nói','146'],['Độ chính xác ngữ pháp','84%'],['Phiên hoàn thành','62']].map(([l,v])=>(
              <div key={l}><div style={{...NA.srf,fontSize:23,fontWeight:500,lineHeight:1}}>{v}</div><div style={{fontSize:11.5,color:NA.muted,marginTop:5,lineHeight:1.3}}>{l}</div></div>
            ))}
          </div>
        </Card>

        {/* next actions */}
        <Card pad={0}>
          <div style={{padding:'14px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>Việc nên làm tiếp theo</Cap></div>
          {NEXT.map(([ic,l,sc],i)=>(
            <button key={i} onClick={()=>onNav(sc)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'14px 16px',background:NA.card,border:'none',borderBottom:i<NEXT.length-1?`1px solid ${NA.border}`:'none',cursor:'pointer',textAlign:'left'}}>
              <div style={{width:34,height:34,borderRadius:'var(--na-radius,4px)',background:NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name={ic} size={19} color={NA.ink}/></div>
              <span style={{flex:1,fontSize:14,fontWeight:600}}>{l}</span>
              <NAIcon name="chevron_right" size={19} color={NA.faint}/>
            </button>
          ))}
        </Card>
        <button onClick={()=>onNav('home')} style={{background:'none',border:'none',cursor:'pointer',font:`600 13px/1 'Instrument Sans'`,color:NA.muted,padding:'4px 0 2px',alignSelf:'center',display:'inline-flex',alignItems:'center',gap:5}}>Tới bảng điều khiển<NAIcon name="arrow_forward" size={16}/></button>
      </div>
    </Page>
  );
}

function NARoadmap({ onNav, state='default' }){
  const [tab,setTab] = React.useState('tree');
  if (tab==='tree') return <NATree onNav={onNav} state={state} tab={tab} onTab={setTab}/>;
  return <RoadmapList onNav={onNav} state={state} tab={tab} onTab={setTab}/>;
}

Object.assign(window, { NARoadmap, RoadmapList, ROAD });
