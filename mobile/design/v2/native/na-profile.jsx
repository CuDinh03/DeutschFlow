// na-profile.jsx — Hồ sơ + Thông báo + Nâng cấp Pro. Exports: NAProfile, NANotifications, NAUpgrade

// nguồn: GET /api/profile/me → ProfileDto  (+ PATCH /api/profile/learning, /password, POST /push-token {platform:"ios"}, DELETE /api/profile/me)
//   plan ánh xạ subscription: free|trial|pro (AppleIap). aiQuota → /api/profile/me hoặc /api/ai/quota.
function NAProfile({ onNav, state='default' }){
  const plan = usePlan();
  const isActive = plan==='pro' || plan==='trial';
  const planLabel = plan==='pro'?'Pro':plan==='trial'?'Dùng thử':'Free';
  const rows = [
    { sect:'TÀI KHOẢN' },
    { ic:'workspace_premium', l:'Gói học', r:planLabel, sc:'subscription', tone:isActive?NA.green:NA.gold },
    { ic:'bolt', l:'Hạn mức AI', r:isActive?'Không giới hạn':'18/30 lượt', sc:'ai-quota' },
    { ic:'flag', l:'Mục tiêu học tập', r:'B2 · Pflege', sc:'goal-settings' },
    { ic:'receipt_long', l:'Học phí', r:'Còn 1.800.000đ', sc:'tuition', tone:NA.red },
    { sect:'HỌC TẬP' },
    { ic:'video_library', l:'Video bài học', sc:'lessons' },
    { ic:'co_present', l:'Gia sư 1:1', sc:'book-session' },
    { ic:'quiz', l:'Thi thử', sc:'exam' },
    { ic:'monitoring', l:'Tiến độ & thống kê', sc:'progress' },
    { ic:'military_tech', l:'Thành tích', sc:'achievements' },
    { sect:'TÙY CHỌN' },
    { ic:'notifications', l:'Thông báo', r:'Bật', sc:'notif-settings' },
    { ic:'translate', l:'Ngôn ngữ', r:'Tiếng Việt', sc:'language' },
    { ic:'volume_up', l:'Giọng đọc & tốc độ', r:'Nữ · 1.0×', sc:'voice-settings' },
    { sect:'KHÁC' },
    { ic:'help', l:'Trợ giúp & Hướng dẫn', sc:'help' },
    { ic:'manage_accounts', l:'Tài khoản & bảo mật', sc:'account-settings' },
    { ic:'logout', l:'Đăng xuất', danger:true, sc:'auth-login' },
  ];
  return (
    <Page title="Hồ sơ" dateCap="Tài khoản của bạn">
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* identity */}
        <Card onClick={()=>onNav('edit-profile')} style={{display:'flex',alignItems:'center',gap:15}}>
          <div style={{width:62,height:62,borderRadius:'50%',background:NA.yellow,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...NA.srf,fontSize:28,fontWeight:600,color:NA.ink}}>L</span></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{...NA.srf,fontSize:22,fontWeight:500,lineHeight:1.1}}>Lan Nguyễn</div>
            <div style={{display:'flex',alignItems:'center',gap:7,marginTop:7}}>
              <Pill tone="ink" solid>B1 · Pflege</Pill>
              <Pill tone={isActive?'green':'muted'} solid={isActive}>{isActive?(plan==='pro'?'Pro':'Dùng thử'):'Gói Free'}</Pill>
            </div>
          </div>
          <NAIcon name="chevron_right" size={20} color={NA.faint}/>
        </Card>

        {/* stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
          {[['12','ngày chuỗi'],['1.240','XP'],['42%','đến B2']].map(([v,l])=>(
            <div key={l} style={{background:NA.card,padding:'15px 10px',textAlign:'center'}}>
              <div style={{...NA.srf,fontSize:21,fontWeight:500}}>{v}</div><div style={{fontSize:11,color:NA.muted,marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>

        {/* upgrade banner */}
        {!isActive && <Card pad={0} onClick={()=>onNav('upgrade')} style={{background:NA.ink}}>
          <div style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:14}}>
            <NAIcon name="workspace_premium" size={30} fill color={NA.yellow}/>
            <div style={{flex:1}}>
              <div style={{...NA.srf,fontSize:17,fontWeight:500,color:NA.bg}}>Nâng cấp lên Pro</div>
              <div style={{fontSize:12.5,color:'#A39E94',marginTop:3}}>Luyện nói không giới hạn · chấm chi tiết</div>
            </div>
            <NAIcon name="chevron_right" size={22} color="#76716A"/>
          </div>
        </Card>}

        {/* settings */}
        <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
          {rows.map((row,i)=> row.sect ? (
            <div key={i} style={{background:NA.bg,padding:'13px 16px 7px'}}><Cap style={{fontSize:9}}>{row.sect}</Cap></div>
          ) : (
            <button key={i} onClick={()=>row.sc&&onNav(row.sc)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
              <NAIcon name={row.ic} size={21} color={row.danger?NA.red:row.tone||NA.ink}/>
              <span style={{flex:1,fontSize:14.5,fontWeight:500,color:row.danger?NA.red:NA.ink}}>{row.l}</span>
              {row.r && <span style={{fontSize:13,color:row.tone||NA.muted,fontWeight:row.tone?600:400}}>{row.r}</span>}
              {!row.danger && <NAIcon name="chevron_right" size={19} color={NA.faint}/>}
            </button>
          ))}
        </div>
        <div style={{textAlign:'center',padding:'4px 0 2px'}}><div style={{fontSize:11.5,color:NA.subtle}}>DeutschFlow · phiên bản 2.0</div></div>
      </div>
    </Page>
  );
}

/* ── Notifications ── */
const NOTIFS = {
  'HÔM NAY':[
    { ic:'assignment_late', tone:NA.red, t:'Bài "Mein Arbeitstag" sắp đến hạn', s:'Lớp K30 · còn 1 ngày', time:'2 giờ', unread:true, to:['asgn','a1'] },
    { ic:'grading', tone:NA.green, t:'Thầy Trung đã chấm bài "Im Krankenhaus"', s:'Bạn được 8.5 — xem nhận xét', time:'5 giờ', unread:true, to:['asgn','a5'] },
    { ic:'local_fire_department', tone:NA.orange, t:'Chuỗi học 12 ngày! 🔥', s:'Học hôm nay để giữ chuỗi', time:'8 giờ', to:'home' },
  ],
  'TRƯỚC ĐÓ':[
    { ic:'campaign', tone:NA.violet, t:'Thông báo lớp: đổi phòng Zoom', s:'Lớp K30 · Thầy Trung', time:'Hôm qua', to:['ann',0] },
    { ic:'translate', tone:NA.teal, t:'24 thẻ từ vựng đến hạn ôn', s:'Krankenhaus & Pflege', time:'Hôm qua', to:'srs' },
    { ic:'workspace_premium', tone:NA.gold, t:'Ưu đãi Pro: giảm 30% tháng này', s:'Mở khóa luyện nói không giới hạn', time:'2 ngày', to:'upgrade' },
  ],
};
// route a notification to the exact screen it refers to
function notifGo(onNav, to){
  if(!to){ onNav('home'); return; }
  if(Array.isArray(to)){
    if(to[0]==='asgn' && window.openAsgn){ window.openAsgn(onNav, to[1]); return; }
    if(to[0]==='ann' && window.openAnn){ window.openAnn(onNav, to[1]); return; }
  }
  onNav(to);
}
function NANotifications({ onNav }){
  return (
    <Page title="Thông báo" dateCap="3 mục chưa đọc" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}
      right={<button onClick={()=>window.gaToast&&window.gaToast('Đã đánh dấu tất cả là đã đọc')} style={{background:'none',border:'none',cursor:'pointer',font:`600 13px/1 'Instrument Sans'`,color:NA.muted,padding:'10px 8px',margin:'-10px -8px'}}>Đọc hết</button>}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>
        {Object.entries(NOTIFS).map(([grp,items])=>(
          <div key={grp}>
            <Cap style={{padding:'0 2px 10px'}}>{grp}</Cap>
            <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
              {items.map((n,i)=>(
                <button key={i} onClick={()=>notifGo(onNav, n.to)} className="na-tap" style={{display:'flex',gap:13,padding:'14px 16px',background:n.unread?naSoft(NA.yellow,'subtle'):NA.card,border:'none',cursor:'pointer',textAlign:'left',alignItems:'flex-start'}}>
                  <div style={{width:34,height:34,borderRadius:'50%',background:naSoft(n.tone,'balanced'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name={n.ic} size={18} color={n.tone}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,lineHeight:1.3}}>{n.t}</div>
                    <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>{n.s}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                    <span style={{fontSize:11,color:NA.subtle}}>{n.time}</span>
                    {n.unread && <span style={{width:8,height:8,borderRadius:'50%',background:NA.red}}/>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ── Upgrade / Pro (paywall) ── */
function NAUpgrade({ onNav }){
  const plan = usePlan();
  const [sel,setPlan] = React.useState('year');
  const feats = [
    ['Luyện nói AI', '3 lượt / ngày', 'Không giới hạn'],
    ['Chấm điểm chi tiết', 'Cơ bản', 'Đầy đủ + sửa lỗi'],
    ['Phỏng vấn chuyên ngành', '1 ngành', 'Mọi ngành'],
    ['Lộ trình cá nhân hóa', '—', 'Có'],
    ['Tải bài học offline', '—', 'Có'],
  ];
  // already Pro / trial → show managed state instead of buy
  if (plan==='pro' || plan==='trial'){
    return (
      <Page title="DeutschFlow Pro" dateCap={plan==='pro'?'Đang dùng Pro':'Đang dùng thử'} back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
        <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
          <Card pad={0} style={{background:NA.ink}}>
            <div style={{padding:'24px 20px',textAlign:'center'}}>
              <NAIcon name="workspace_premium" size={42} fill color={NA.yellow}/>
              <div style={{...NA.srf,fontSize:24,fontWeight:500,color:NA.bg,marginTop:10}}>Bạn đang dùng Pro</div>
              <div style={{fontSize:13,color:'#A39E94',marginTop:8,lineHeight:1.5}}>{plan==='trial'?'Đang trong 7 ngày dùng thử miễn phí.':'Cảm ơn bạn đã ủng hộ DeutschFlow.'} Mọi tính năng đã mở khoá.</div>
            </div>
          </Card>
          <Card>
            <Cap style={{marginBottom:13}}>Đang bao gồm</Cap>
            <div style={{display:'flex',flexDirection:'column',gap:11}}>
              {feats.map(([f])=>(<div key={f} style={{display:'flex',gap:10,alignItems:'center'}}><NAIcon name="check_circle" size={18} fill color={NA.green}/><span style={{fontSize:13.5}}>{f}</span></div>))}
            </div>
          </Card>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('subscription')}>Quản lý gói đăng ký</Btn>
        </div>
      </Page>
    );
  }
  return (
    <Page title="Nâng cấp Pro" dateCap="DeutschFlow Pro" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}
      right={<button onClick={()=>window.gaToast&&window.gaToast('Đang khôi phục giao dịch…')} style={{background:'none',border:'none',cursor:'pointer',font:`600 12.5px/1 'Instrument Sans'`,color:NA.muted,padding:'10px 8px',margin:'-10px -8px'}}>Khôi phục</button>}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <div style={{textAlign:'center',padding:'6px 8px 2px'}}>
          <NAIcon name="workspace_premium" size={40} fill color={NA.yellow}/>
          <div style={{...NA.srf,fontSize:25,fontWeight:500,marginTop:10,lineHeight:1.2}}>Học nhanh hơn với Pro</div>
          <p style={{margin:'8px auto 0',fontSize:13.5,color:NA.muted,lineHeight:1.55,maxWidth:280}}>Luyện nói không giới hạn và nhận phản hồi chi tiết cho từng câu trả lời.</p>
        </div>

        {/* plan toggle */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[['year','Theo năm','990.000đ','/năm','Tiết kiệm 40% · 82.500đ/tháng'],['month','Theo tháng','129.000đ','/tháng',null]].map(([k,l,p,per,note])=>{
            const on = sel===k;
            return (
              <button key={k} onClick={()=>setPlan(k)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,padding:'16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',
                background:on?naSoft(NA.yellow,'subtle'):NA.card, border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
                <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<NAIcon name="check" size={14} color="#fff"/>}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontWeight:700,fontSize:15}}>{l}</span>{k==='year'&&<Pill tone="yellow" solid>Tiết kiệm 40%</Pill>}</div>
                  {note && <div style={{fontSize:12,color:NA.gold,fontWeight:600,marginTop:4}}>{note}</div>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}><div style={{...NA.srf,fontSize:18,fontWeight:500}}>{p}</div><div style={{fontSize:11,color:NA.muted}}>{per}</div></div>
              </button>
            );
          })}
        </div>

        {/* compare */}
        <Card pad={0}>
          <div style={{display:'grid',gridTemplateColumns:'1.4fr 0.9fr 1fr',padding:'12px 14px',borderBottom:`1px solid ${NA.ink}`,gap:8}}>
            <Cap>Tính năng</Cap><Cap style={{textAlign:'center'}}>Free</Cap><Cap color={NA.gold} style={{textAlign:'center'}}>Pro</Cap>
          </div>
          {feats.map(([f,free,pro],i)=>(
            <div key={f} style={{display:'grid',gridTemplateColumns:'1.4fr 0.9fr 1fr',padding:'13px 14px',gap:8,alignItems:'center',borderBottom:i<feats.length-1?`1px solid ${NA.border}`:'none'}}>
              <span style={{fontSize:13,fontWeight:600}}>{f}</span>
              <span style={{fontSize:12,color:NA.subtle,textAlign:'center'}}>{free}</span>
              <span style={{fontSize:12,color:NA.green,fontWeight:600,textAlign:'center'}}>{pro}</span>
            </div>
          ))}
        </Card>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="yellow" size="lg" full onClick={()=>openIap(onNav, sel)}><YSq size={7} color={NA.ink}/>Dùng thử Pro 7 ngày miễn phí</Btn>
          <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5}}>Sau đó {sel==='year'?'990.000đ/năm':'129.000đ/tháng'} · huỷ bất kỳ lúc nào</div>
        </div>
      </div>
    </Page>
  );
}

Object.assign(window, { NAProfile, NANotifications, NAUpgrade });
