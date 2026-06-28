// na-progress.jsx — Tiến độ / thống kê + Thành tích (huy hiệu · chứng chỉ · BXH).
// Exports: NAProgress, NAAchievements

/* ── tiny SVG radar (4 skills) ── */
function SkillRadar({ data, size=180 }){
  const cx=size/2, cy=size/2, R=size/2-26;
  const ang=[-90,0,90,180]; // top,right,bottom,left
  const pt=(v,i)=>{ const a=ang[i]*Math.PI/180; return [cx+Math.cos(a)*R*(v/100), cy+Math.sin(a)*R*(v/100)]; };
  const poly = data.map((d,i)=>pt(d.v,i).join(',')).join(' ');
  const axisEnd=i=>{ const a=ang[i]*Math.PI/180; return [cx+Math.cos(a)*R, cy+Math.sin(a)*R]; };
  return (
    <svg width={size} height={size} style={{display:'block',margin:'0 auto'}}>
      {[0.25,0.5,0.75,1].map((f,k)=>(
        <polygon key={k} points={ang.map(a=>{const r=a*Math.PI/180; return [cx+Math.cos(r)*R*f, cy+Math.sin(r)*R*f].join(',');}).join(' ')} fill="none" stroke={NA.border} strokeWidth="1"/>
      ))}
      {ang.map((a,i)=>{ const e=axisEnd(i); return <line key={i} x1={cx} y1={cy} x2={e[0]} y2={e[1]} stroke={NA.border} strokeWidth="1"/>; })}
      <polygon points={poly} fill={naSoft(NA.gold,'bold')} stroke={NA.gold} strokeWidth="2"/>
      {data.map((d,i)=>{ const p=pt(d.v,i); return <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={NA.gold}/>; })}
      {data.map((d,i)=>{ const e=axisEnd(i); const dx=e[0]-cx, dy=e[1]-cy; return (
        <text key={i} x={e[0]+dx*0.18} y={e[1]+dy*0.18+4} textAnchor="middle" style={{font:`600 10px 'Instrument Sans'`,fill:NA.muted}}>{d.l}</text>
      ); })}
    </svg>
  );
}

// nguồn: GET /api/student/stats → StatsDto  (streak, XP, năng lực 4 kỹ năng)
const PROG = {
  streakDays:12, weekXP:[120,90,150,80,200,60,180], days14:[1,1,1,0,1,1,1,1,0,1,1,1,1,1],
  totalHours:'48 giờ', lessons:86,
  skills:[ {l:'Nghe',v:78}, {l:'Đọc',v:84}, {l:'Nói',v:64}, {l:'Viết',v:62} ],
};

function NAProgress({ onNav, state='default' }){
  if (state==='empty'){
    return (
      <Page title="Tiến độ" dateCap="Thống kê học tập" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
        <div style={{padding:'48px 28px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <NAIcon name="monitoring" size={44} color={NA.subtle}/>
          <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Chưa đủ dữ liệu</div>
          <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Học vài ngày để xem chuỗi streak, XP và năng lực theo kỹ năng của bạn.</p>
          <Btn variant="ghost" onClick={()=>onNav('home')}>Bắt đầu học</Btn>
        </div>
      </Page>
    );
  }
  const maxXP = Math.max(...PROG.weekXP);
  const wd = ['T2','T3','T4','T5','T6','T7','CN'];
  return (
    <Page title="Tiến độ" dateCap="Thống kê học tập" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}
      right={<button onClick={()=>onNav('achievements')} className="na-press" aria-label="Thành tích" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:-6,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="military_tech" size={23} color={NA.ink}/></button>}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* streak + totals */}
        <Card pad={0} style={{background:NA.ink}}>
          <div style={{padding:'20px',display:'flex',alignItems:'center',gap:16}}>
            <div style={{textAlign:'center'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:4,justifyContent:'center'}}><span style={{...NA.srf,fontSize:38,fontWeight:500,color:NA.bg,lineHeight:1}}>{PROG.streakDays}</span><span style={{fontSize:18}}>🔥</span></div>
              <Cap color={NA.yellow} style={{marginTop:8}}>Ngày chuỗi</Cap>
            </div>
            <div style={{flex:1,display:'flex',flexWrap:'wrap',gap:5,maxWidth:160,marginLeft:'auto'}}>
              {PROG.days14.map((d,i)=>(<div key={i} style={{width:16,height:16,borderRadius:4,background:d?NA.yellow:'rgba(255,255,255,0.14)'}}/>))}
            </div>
          </div>
          <div style={{display:'flex',borderTop:'1px solid rgba(255,255,255,0.12)'}}>
            {[['Tổng giờ học',PROG.totalHours],['Bài đã học',PROG.lessons]].map(([l,v],i)=>(
              <div key={l} style={{flex:1,padding:'13px 18px',borderLeft:i?'1px solid rgba(255,255,255,0.12)':'none'}}>
                <div style={{...NA.srf,fontSize:18,fontWeight:500,color:NA.bg}}>{v}</div><div style={{fontSize:11,color:'#A39E94',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* weekly XP */}
        <Card>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:16}}><Cap>XP tuần này</Cap><span style={{...NA.srf,fontSize:16,fontWeight:500}}>{PROG.weekXP.reduce((a,b)=>a+b,0)} XP</span></div>
          <div style={{display:'flex',alignItems:'flex-end',gap:9,height:110}}>
            {PROG.weekXP.map((v,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:7,height:'100%',justifyContent:'flex-end'}}>
                <div style={{width:'100%',height:`${v/maxXP*100}%`,minHeight:5,background:i===4?NA.yellow:naSoft(NA.gold,'bold'),borderRadius:4,transition:'height 0.5s ease'}}/>
                <span style={{fontSize:10.5,color:i===4?NA.ink:NA.subtle,fontWeight:i===4?700:500}}>{wd[i]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* skills radar */}
        <Card>
          <Cap style={{marginBottom:6}}>Năng lực 4 kỹ năng</Cap>
          <SkillRadar data={PROG.skills}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:6}}>
            {PROG.skills.map(s=>(<div key={s.l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:NA.bg,borderRadius:'var(--na-radius,4px)'}}><span style={{fontSize:12.5,color:NA.muted}}>{s.l}</span><span style={{...NA.srf,fontSize:15,fontWeight:500,color:s.v>=80?NA.green:s.v>=70?NA.gold:NA.orange}}>{s.v}</span></div>))}
          </div>
        </Card>

        <Card onClick={()=>onNav('assessment')} style={{display:'flex',alignItems:'center',gap:13}}>
          <div style={{width:40,height:40,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.blue,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="straighten" size={22} color={NA.blue}/></div>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14.5}}>Kiểm tra lại trình độ</div><div style={{fontSize:12,color:NA.muted,marginTop:2}}>Cập nhật cấp độ & lộ trình</div></div>
          <NAIcon name="chevron_right" size={20} color={NA.faint}/>
        </Card>
      </div>
    </Page>
  );
}

/* ════════ THÀNH TÍCH ════════ */
const BADGES = [
  { ic:'local_fire_department', l:'Chuỗi 7 ngày', on:true },
  { ic:'local_fire_department', l:'Chuỗi 30 ngày', on:false, cond:'Học liên tục 30 ngày' },
  { ic:'translate', l:'100 từ vựng', on:true },
  { ic:'record_voice_over', l:'Phỏng vấn đầu tiên', on:true },
  { ic:'workspace_premium', l:'Đạt A2', on:true },
  { ic:'military_tech', l:'Đạt B1', on:false, cond:'Hoàn thành cấp B1' },
  { ic:'bolt', l:'1.000 XP', on:true },
  { ic:'star', l:'Điểm thi 90+', on:false, cond:'Đạt 90 điểm thi thử' },
];
const LEADER = {
  'class':[ ['Minh A.',2840],['Lan Nguyễn',2610,true],['Hùng T.',2480],['Mai P.',2210],['Dũng V.',1980] ],
  'global':[ ['user_8821',9120],['polyglot_de',8740],['Lan Nguyễn',2610,true,42] ],
};
function NAAchievements({ onNav, state='default' }){
  const [board,setBoard] = React.useState('class');
  const unlocked = BADGES.filter(b=>b.on).length;
  const list = LEADER[board];
  return (
    <Page title="Thành tích" dateCap={`${unlocked}/${BADGES.length} huy hiệu`} back="Tiến độ" onBack={()=>onNav('progress')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
        {/* badges */}
        <div>
          <Cap style={{padding:'0 2px 12px'}}>Huy hiệu</Cap>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {BADGES.map((b,i)=>(
              <div key={i} style={{padding:'16px 14px',borderRadius:'var(--na-radius,4px)',background:b.on?NA.card:NA.bg,border:`1px solid ${NA.border}`,textAlign:'center',opacity:b.on?1:0.7}}>
                <div style={{width:48,height:48,borderRadius:'50%',margin:'0 auto 10px',background:b.on?naSoft(NA.gold,'bold'):NA.paper,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  <NAIcon name={b.on?b.ic:'lock'} size={24} fill={b.on} color={b.on?NA.gold:NA.faint}/>
                </div>
                <div style={{fontWeight:600,fontSize:13,lineHeight:1.25,color:b.on?NA.ink:NA.muted}}>{b.l}</div>
                {!b.on && b.cond && <div style={{fontSize:11,color:NA.subtle,marginTop:5,lineHeight:1.35}}>{b.cond}</div>}
                {b.on && <div style={{fontSize:10.5,color:NA.green,fontWeight:600,marginTop:5}}>Đã mở khoá</div>}
              </div>
            ))}
          </div>
        </div>

        {/* certificate */}
        <div>
          <Cap style={{padding:'0 2px 12px'}}>Chứng chỉ</Cap>
          <Card style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:46,height:46,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.green,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="verified" size={24} fill color={NA.green}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{...NA.srf,fontSize:16,fontWeight:500}}>Hoàn thành cấp A2</div>
              <div style={{fontSize:12,color:NA.muted,marginTop:3}}>Cấp 14/05/2026</div>
            </div>
          </Card>
          <div style={{display:'flex',gap:9,marginTop:10}}>
            <Btn variant="ghost" full onClick={()=>window.gaToast&&window.gaToast('Mở xem chứng chỉ')}><NAIcon name="visibility" size={17}/>Xem</Btn>
            <Btn variant="ghost" full onClick={()=>window.gaToast&&window.gaToast('Đang tải PDF…')}><NAIcon name="download" size={17}/>Tải</Btn>
            <Btn variant="ghost" full onClick={()=>window.gaToast&&window.gaToast('Mở chia sẻ')}><NAIcon name="share" size={17}/>Chia sẻ</Btn>
          </div>
        </div>

        {/* leaderboard */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 2px 12px'}}>
            <Cap>Bảng xếp hạng</Cap>
            <div style={{display:'flex',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
              {[['class','Lớp'],['global','Hệ thống']].map(([k,l])=>(
                <button key={k} onClick={()=>setBoard(k)} className="na-press" style={{padding:'7px 14px',background:board===k?NA.ink:NA.card,color:board===k?NA.bg:NA.muted,border:'none',cursor:'pointer',font:`700 11.5px/1 'Instrument Sans'`}}>{l}</button>
              ))}
            </div>
          </div>
          <Card pad={0}>
            {list.map((row,i)=>{
              const me=row[2]===true; const rank=row[3]||i+1;
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:13,padding:'13px 16px',background:me?naSoft(NA.yellow,'subtle'):NA.card,borderBottom:i<list.length-1?`1px solid ${NA.border}`:'none'}}>
                  <span style={{...NA.srf,fontSize:16,fontWeight:500,width:26,color:rank<=3?NA.gold:NA.muted,flexShrink:0}}>{rank}</span>
                  <div style={{width:32,height:32,borderRadius:'50%',background:me?NA.yellow:NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...NA.srf,fontSize:14,fontWeight:600,color:NA.ink}}>{row[0][0]}</span></div>
                  <span style={{flex:1,fontSize:14,fontWeight:me?700:500}}>{row[0]}{me&&<span style={{fontSize:11,color:NA.gold,fontWeight:600,marginLeft:7}}>Bạn</span>}</span>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4,font:`700 13px/1 'Instrument Sans'`,color:NA.gold}}><NAIcon name="bolt" size={14} fill color={NA.gold}/>{row[1].toLocaleString('vi')}</span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </Page>
  );
}

Object.assign(window, { NAProgress, NAAchievements, SkillRadar });
