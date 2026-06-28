// na-settings.jsx — Hồ sơ & Cài đặt: sửa hồ sơ, hạn mức AI, mục tiêu, thông báo,
//   ngôn ngữ, giọng đọc, trợ giúp, tài khoản. Exports: NAEditProfile, NAAiQuota,
//   NAGoalSettings, NANotifSettings, NALanguage, NAVoiceSettings, NAHelp, NAAccountSettings

/* ── iOS switch ── */
function Switch({ on, onChange, label }){
  return (
    <button onClick={()=>onChange(!on)} role="switch" aria-checked={on} aria-label={label} style={{width:50,height:30,borderRadius:30,border:'none',cursor:'pointer',padding:2,background:on?NA.green:NA.faint,transition:'background 0.2s',flexShrink:0,display:'inline-flex'}}>
      <span style={{display:'block',width:26,height:26,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.25)',transform:on?'translateX(20px)':'translateX(0)',transition:'transform 0.2s'}}/>
    </button>
  );
}
function SettingsGroup({ children }){
  return <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>{children}</div>;
}
function Row({ ic, label, sub, right, onClick, danger, last }){
  const Tag = onClick?'button':'div';
  return (
    <Tag onClick={onClick} className={onClick?'na-tap':''} style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',width:'100%',cursor:onClick?'pointer':'default',textAlign:'left'}}>
      {ic && <NAIcon name={ic} size={21} color={danger?NA.red:NA.ink} style={{flexShrink:0}}/>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:500,color:danger?NA.red:NA.ink}}>{label}</div>
        {sub && <div style={{fontSize:12,color:NA.muted,marginTop:2}}>{sub}</div>}
      </div>
      {right}
    </Tag>
  );
}

/* ════════ 1 · CHỈNH SỬA HỒ SƠ ════════ */
function NAEditProfile({ onNav, state='default' }){
  const [name,setName] = React.useState('Lan Nguyễn');
  const [lvl,setLvl] = React.useState('B1');
  const [hasPhoto,setHasPhoto] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const err = !name.trim();
  function save(){ if(err||busy) return; setBusy(true); setTimeout(()=>{ setBusy(false); window.gaToast&&window.gaToast('Đã lưu hồ sơ'); onNav('profile'); }, 800); }
  return (
    <Page title="Chỉnh sửa hồ sơ" dateCap="Thông tin cá nhân" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
        {/* avatar */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,paddingTop:6}}>
          <div style={{width:96,height:96,borderRadius:'50%',background:hasPhoto?NA.teal:NA.yellow,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
            {hasPhoto ? <NAIcon name="person" size={48} color="#fff"/> : <span style={{...NA.srf,fontSize:42,fontWeight:600,color:NA.ink}}>{name.trim()[0]||'?'}</span>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <Btn variant="ghost" size="sm" onClick={()=>{setHasPhoto(true);window.gaToast&&window.gaToast('Mở thư viện ảnh');}}><NAIcon name="photo_camera" size={16}/>Đổi ảnh</Btn>
            {hasPhoto && <Btn variant="ghost" size="sm" onClick={()=>setHasPhoto(false)}>Xoá ảnh</Btn>}
          </div>
        </div>
        {/* name */}
        <div>
          <Cap style={{marginBottom:8}}>Tên hiển thị</Cap>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nhập tên của bạn"
            style={{width:'100%',border:`1px solid ${err?NA.red:NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'14px',font:`500 15px/1.2 'Instrument Sans'`,color:NA.ink,background:NA.bg,outline:'none'}}/>
          {err && <div style={{display:'flex',alignItems:'center',gap:5,marginTop:7,color:NA.red,fontSize:12.5}}><NAIcon name="error" size={14} color={NA.red}/>Tên không được để trống</div>}
        </div>
        {/* level */}
        <div>
          <Cap style={{marginBottom:10}}>Trình độ hiện tại</Cap>
          <div style={{display:'flex',gap:9}}>
            {['A1','A2','B1','B2'].map(l=>(
              <button key={l} onClick={()=>setLvl(l)} className="na-press" style={{flex:1,padding:'13px 0',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`700 14px/1 'Instrument Sans'`,
                background:lvl===l?NA.ink:NA.card,color:lvl===l?NA.bg:NA.muted,border:`1px solid ${lvl===l?NA.ink:NA.border}`}}>{l}</button>
            ))}
          </div>
        </div>
        <Btn variant="primary" size="lg" full onClick={save} style={{opacity:err||busy?0.5:1}}>{busy?<><Spin/>Đang lưu…</>:<><YSq size={7} color={NA.yellow}/>Lưu thay đổi</>}</Btn>
      </div>
    </Page>
  );
}

/* ════════ 2 · HẠN MỨC AI ════════ */
function NAAiQuota({ onNav, state='default' }){
  const plan = usePlan();
  const pro = plan==='pro'||plan==='trial';
  return (
    <Page title="Hạn mức AI" dateCap="Luyện nói & chấm bài" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'26px 18px'}}>
          {pro ? (
            <>
              <div style={{width:84,height:84,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="all_inclusive" size={42} color={NA.green}/></div>
              <div style={{...NA.srf,fontSize:22,fontWeight:500}}>Không giới hạn</div>
              <p style={{margin:0,fontSize:13.5,color:NA.muted,textAlign:'center',lineHeight:1.55,maxWidth:260}}>Gói Pro cho phép luyện nói AI và chấm bài không giới hạn.</p>
            </>
          ) : (
            <>
              <ProgressRing pct={18/30*100} size={120} stroke={9} color={NA.yellow}>
                <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:30,fontWeight:500,lineHeight:1}}>18<span style={{fontSize:18,color:NA.subtle}}>/30</span></div><div style={{fontSize:10,color:NA.muted,marginTop:3}}>còn lại</div></div>
              </ProgressRing>
              <div style={{textAlign:'center'}}><div style={{fontWeight:700,fontSize:15}}>Còn 18 lượt hôm nay</div><div style={{fontSize:12.5,color:NA.muted,marginTop:4}}>Đặt lại sau 06:24:11 · mỗi ngày 30 lượt</div></div>
            </>
          )}
        </Card>

        <SettingsGroup>
          <Row ic="record_voice_over" label="Luyện nói AI" sub="1 lượt / buổi phỏng vấn" right={<span style={{fontSize:13,color:NA.muted}}>{pro?'∞':'12 đã dùng'}</span>}/>
          <Row ic="grading" label="Chấm bài chi tiết" sub="1 lượt / lần chấm" right={<span style={{fontSize:13,color:NA.muted}}>{pro?'∞':'0 đã dùng'}</span>}/>
        </SettingsGroup>

        {!pro && <Btn variant="yellow" size="lg" full onClick={()=>onNav('upgrade')}><YSq size={7} color={NA.ink}/>Gỡ giới hạn với Pro</Btn>}
      </div>
    </Page>
  );
}

/* ════════ 3 · MỤC TIÊU HỌC TẬP ════════ */
function NAGoalSettings({ onNav, state='default' }){
  const [goal,setGoal] = React.useState('pflege');
  const [mins,setMins] = React.useState('30');
  const [time,setTime] = React.useState('e');
  return (
    <Page title="Mục tiêu học tập" dateCap="Điều chỉnh kế hoạch" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
        <div>
          <Cap style={{marginBottom:11}}>Mục tiêu</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {ONB_GOALS.map(g=>(
              <button key={g.k} onClick={()=>setGoal(g.k)} className="na-press" style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:goal===g.k?naSoft(NA.yellow,'subtle'):NA.card,border:`${goal===g.k?2:1}px solid ${goal===g.k?NA.gold:NA.border}`}}>
                <NAIcon name={g.ic} size={22} color={goal===g.k?NA.gold:NA.muted}/>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14.5}}>{g.l}</div><div style={{fontSize:12,color:NA.muted,marginTop:1}}>{g.d}</div></div>
                {goal===g.k&&<NAIcon name="check_circle" size={20} fill color={NA.gold}/>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Cap style={{marginBottom:11}}>Cường độ mỗi ngày</Cap>
          <div style={{display:'flex',gap:9}}>
            {ONB_MINS.map(([m])=>(<button key={m} onClick={()=>setMins(m)} className="na-press" style={{flex:1,padding:'13px 0',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`700 14px/1 'Instrument Sans'`,background:mins===m?NA.ink:NA.card,color:mins===m?NA.bg:NA.muted,border:`1px solid ${mins===m?NA.ink:NA.border}`}}>{m}′</button>))}
          </div>
        </div>
        <div>
          <Cap style={{marginBottom:11}}>Giờ nhắc học</Cap>
          <div style={{display:'flex',flexWrap:'wrap',gap:9}}>
            {ONB_TIMES.map(([k,l])=>(<button key={k} onClick={()=>setTime(k)} className="na-press" style={{padding:'11px 15px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',font:`600 13px/1 'Instrument Sans'`,background:time===k?naSoft(NA.yellow,'balanced'):NA.card,border:`1px solid ${time===k?NA.gold:NA.border}`,color:time===k?NA.ink:NA.muted}}>{l}</button>))}
          </div>
        </div>
        <Btn variant="primary" size="lg" full onClick={()=>{window.gaToast&&window.gaToast('Đã cập nhật mục tiêu học tập');onNav('profile');}}><YSq size={7} color={NA.yellow}/>Lưu mục tiêu</Btn>
      </div>
    </Page>
  );
}

/* ════════ 4 · CÀI ĐẶT THÔNG BÁO ════════ */
function NANotifSettings({ onNav, state='default' }){
  const [s,setS] = React.useState({ learn:true, grade:true, klass:true, promo:false, quiet:true });
  const set=(k,v)=>setS(p=>({...p,[k]:v}));
  const items = [['learn','Nhắc học hằng ngày','Theo giờ bạn đã chọn'],['grade','Kết quả chấm bài','Khi giáo viên / AI chấm xong'],['klass','Thông báo lớp','Bài tập & thông báo từ lớp'],['promo','Khuyến mãi & mẹo học','Ưu đãi Pro, mẹo học tiếng Đức']];
  return (
    <Page title="Thông báo" dateCap="Cài đặt thông báo" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <SettingsGroup>
          {items.map(([k,l,sub],i)=>(<Row key={k} label={l} sub={sub} right={<Switch on={s[k]} onChange={v=>set(k,v)} label={l}/>} last={i===items.length-1}/>))}
        </SettingsGroup>
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Giờ im lặng</Cap>
          <SettingsGroup>
            <Row ic="bedtime" label="Bật giờ im lặng" right={<Switch on={s.quiet} onChange={v=>set('quiet',v)} label="Giờ im lặng"/>}/>
            {s.quiet && <Row label="Khung giờ" sub="Không gửi thông báo trong khoảng này" right={<span style={{fontSize:13.5,fontWeight:600,color:NA.ink}}>22:00 – 07:00</span>} onClick={()=>window.gaToast&&window.gaToast('Mở chọn khung giờ')}/>}
          </SettingsGroup>
        </div>
      </div>
    </Page>
  );
}

/* ════════ 5 · NGÔN NGỮ ════════ */
function NALanguage({ onNav, state='default' }){
  const [lang,setLang] = React.useState('vi');
  const langs = [['vi','Tiếng Việt','Vietnamese'],['en','English','Tiếng Anh'],['de','Deutsch','Tiếng Đức']];
  return (
    <Page title="Ngôn ngữ" dateCap="Ngôn ngữ giao diện" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <SettingsGroup>
          {langs.map(([k,l,sub])=>(
            <button key={k} onClick={()=>{setLang(k);window.gaToast&&window.gaToast('Đã đổi ngôn ngữ: '+l);}} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'15px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600}}>{l}</div><div style={{fontSize:12,color:NA.muted,marginTop:2}}>{sub}</div></div>
              {lang===k && <NAIcon name="check" size={22} color={NA.gold}/>}
            </button>
          ))}
        </SettingsGroup>
        <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5,padding:'2px 12px'}}>Ngôn ngữ học (tiếng Đức) không thay đổi — đây chỉ là ngôn ngữ hiển thị của ứng dụng.</div>
      </div>
    </Page>
  );
}

/* ════════ 6 · GIỌNG ĐỌC & TỐC ĐỘ ════════ */
function NAVoiceSettings({ onNav, state='default' }){
  const [voice,setVoice] = React.useState('f');
  const [rate,setRate] = React.useState(1.0);
  return (
    <Page title="Giọng đọc & tốc độ" dateCap="Phát âm tiếng Đức" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
        <div>
          <Cap style={{marginBottom:11}}>Giọng đọc</Cap>
          <div style={{display:'flex',gap:10}}>
            {[['f','Nữ','female'],['m','Nam','male']].map(([k,l])=>(
              <button key={k} onClick={()=>setVoice(k)} className="na-press" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'18px 0',borderRadius:'var(--na-radius,4px)',cursor:'pointer',background:voice===k?naSoft(NA.yellow,'subtle'):NA.card,border:`${voice===k?2:1}px solid ${voice===k?NA.gold:NA.border}`}}>
                <NAIcon name={k==='f'?'face_3':'face_6'} size={30} color={voice===k?NA.gold:NA.muted}/>
                <span style={{font:`700 14px/1 'Instrument Sans'`,color:voice===k?NA.ink:NA.muted}}>{l}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:12}}><Cap>Tốc độ đọc</Cap><span style={{...NA.srf,fontSize:18,fontWeight:500}}>{rate.toFixed(2)}×</span></div>
          <input type="range" min="0.75" max="1.5" step="0.05" value={rate} onChange={e=>setRate(parseFloat(e.target.value))}
            style={{width:'100%',accentColor:NA.ink,height:6}}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:NA.subtle}}><span>0.75× chậm</span><span>1.5× nhanh</span></div>
        </div>
        <Card style={{display:'flex',alignItems:'center',gap:14}}>
          <button onClick={()=>window.gaToast&&window.gaToast(`Phát thử · giọng ${voice==='f'?'nữ':'nam'} · ${rate.toFixed(2)}×`)} aria-label="Nghe thử" className="na-press" style={{width:48,height:48,borderRadius:'50%',background:NA.ink,border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="play_arrow" size={26} fill color={NA.yellow}/></button>
          <div style={{flex:1}}><div style={{...NA.srf,fontSize:16,fontWeight:500}}>„Guten Morgen!"</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Nghe thử câu mẫu</div></div>
        </Card>
      </div>
    </Page>
  );
}

/* ════════ 7 · TRỢ GIÚP & HƯỚNG DẪN ════════ */
const FAQS = [
  ['Làm sao để giữ chuỗi streak?','Học ít nhất 1 hoạt động mỗi ngày. Chuỗi sẽ reset nếu bạn bỏ lỡ một ngày — có thể bật nhắc học trong Cài đặt thông báo.'],
  ['Hạn mức AI hoạt động thế nào?','Gói Free có 30 lượt AI mỗi ngày (luyện nói + chấm bài). Hạn mức đặt lại lúc nửa đêm. Nâng cấp Pro để không giới hạn.'],
  ['Tôi tham gia lớp bằng cách nào?','Vào tab Lớp học → nhập mã lớp do giáo viên/trung tâm cung cấp. Sau khi giáo viên duyệt, bạn sẽ thấy bài tập và thông báo của lớp.'],
  ['Chứng chỉ có giá trị không?','Chứng chỉ hoàn thành cấp độ trong app dùng để theo dõi tiến bộ, không thay thế chứng chỉ Goethe chính thức.'],
];
function NAHelp({ onNav, state='default' }){
  const [open,setOpen] = React.useState(0);
  return (
    <Page title="Trợ giúp" dateCap="Hướng dẫn & hỗ trợ" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Câu hỏi thường gặp</Cap>
          <SettingsGroup>
            {FAQS.map(([q,a],i)=>(
              <div key={i} style={{background:NA.card}}>
                <button onClick={()=>setOpen(open===i?-1:i)} className="na-tap" style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'15px 16px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                  <span style={{flex:1,fontSize:14,fontWeight:600,lineHeight:1.3}}>{q}</span>
                  <NAIcon name={open===i?'expand_less':'expand_more'} size={22} color={NA.muted}/>
                </button>
                {open===i && <div style={{padding:'0 16px 15px'}}><p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.6}}>{a}</p></div>}
              </div>
            ))}
          </SettingsGroup>
        </div>
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Liên hệ</Cap>
          <SettingsGroup>
            <Row ic="mail" label="Email hỗ trợ" sub="support@deutschflow.vn" right={<NAIcon name="chevron_right" size={19} color={NA.faint}/>} onClick={()=>window.gaToast&&window.gaToast('Mở ứng dụng email')}/>
            <Row ic="chat" label="Chat với hỗ trợ" sub="Phản hồi trong giờ hành chính" right={<NAIcon name="chevron_right" size={19} color={NA.faint}/>} onClick={()=>window.gaToast&&window.gaToast('Mở khung chat hỗ trợ')}/>
          </SettingsGroup>
        </div>
        <SettingsGroup>
          <Row ic="description" label="Điều khoản sử dụng" right={<NAIcon name="open_in_new" size={18} color={NA.faint}/>} onClick={()=>window.gaToast&&window.gaToast('Mở Điều khoản sử dụng')}/>
          <Row ic="shield" label="Chính sách bảo mật" right={<NAIcon name="open_in_new" size={18} color={NA.faint}/>} onClick={()=>window.gaToast&&window.gaToast('Mở Chính sách bảo mật')}/>
        </SettingsGroup>
      </div>
    </Page>
  );
}

/* ════════ 8 · TÀI KHOẢN ════════ */
function NAAccountSettings({ onNav, state='default' }){
  const [sheet,setSheet] = React.useState(null); // 'logout' | 'delete1' | 'delete2'
  return (
    <Page title="Tài khoản" dateCap="Bảo mật & tài khoản" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <SettingsGroup>
          <Row ic="mail" label="Email" sub="lan.nguyen@email.com" right={<Pill tone="green">Đã xác minh</Pill>}/>
          <Row ic="password" label="Đổi mật khẩu" right={<NAIcon name="chevron_right" size={19} color={NA.faint}/>} onClick={()=>onNav('auth-reset')}/>
        </SettingsGroup>

        <SettingsGroup>
          <Row ic="logout" label="Đăng xuất" onClick={()=>setSheet('logout')}/>
        </SettingsGroup>

        <SettingsGroup>
          <Row ic="delete_forever" label="Xoá tài khoản" sub="Xoá vĩnh viễn dữ liệu học tập" danger onClick={()=>setSheet('delete1')}/>
        </SettingsGroup>
        <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5,padding:'2px 12px'}}>Xoá tài khoản là vĩnh viễn và không thể hoàn tác.</div>
      </div>

      {/* sheets */}
      {sheet && (
        <div style={{position:'absolute',inset:0,background:'rgba(20,19,17,0.5)',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
          <div onClick={()=>setSheet(null)} style={{position:'absolute',inset:0}}/>
          <div style={{position:'relative',background:NA.card,borderTopLeftRadius:18,borderTopRightRadius:18,padding:`10px 24px ${HOME_IND+18}px`,animation:'naSheetUp 0.3s ease both'}}>
            <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 18px'}}/>
            {sheet==='logout' && (<>
              <div style={{textAlign:'center',marginBottom:18}}><div style={{...NA.srf,fontSize:20,fontWeight:500}}>Đăng xuất?</div><p style={{margin:'8px auto 0',fontSize:13.5,color:NA.muted,maxWidth:280,lineHeight:1.5}}>Bạn sẽ cần đăng nhập lại để tiếp tục học.</p></div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}><Btn variant="primary" size="lg" full onClick={()=>onNav('auth-login')}>Đăng xuất</Btn><Btn variant="ghost" full onClick={()=>setSheet(null)}>Huỷ</Btn></div>
            </>)}
            {sheet==='delete1' && (<>
              <div style={{textAlign:'center',marginBottom:18}}><div style={{width:56,height:56,borderRadius:'50%',background:naSoft(NA.red,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}><NAIcon name="warning" size={28} color={NA.red}/></div><div style={{...NA.srf,fontSize:20,fontWeight:500}}>Xoá tài khoản?</div><p style={{margin:'8px auto 0',fontSize:13.5,color:NA.muted,maxWidth:290,lineHeight:1.5}}>Toàn bộ tiến độ, chuỗi streak, chứng chỉ và dữ liệu lớp học sẽ bị xoá vĩnh viễn.</p></div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}><Btn variant="danger" size="lg" full onClick={()=>setSheet('delete2')}>Tôi hiểu, tiếp tục</Btn><Btn variant="ghost" full onClick={()=>setSheet(null)}>Giữ tài khoản</Btn></div>
            </>)}
            {sheet==='delete2' && (<>
              <div style={{textAlign:'center',marginBottom:18}}><div style={{...NA.srf,fontSize:20,fontWeight:500,color:NA.red}}>Xác nhận lần cuối</div><p style={{margin:'8px auto 0',fontSize:13.5,color:NA.muted,maxWidth:290,lineHeight:1.5}}>Hành động này không thể hoàn tác. Nhấn nút bên dưới để xoá vĩnh viễn tài khoản của bạn.</p></div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}><Btn variant="danger" size="lg" full onClick={()=>{setSheet(null);window.gaToast&&window.gaToast('Đã gửi yêu cầu xoá tài khoản');onNav('auth-login');}}>Xoá vĩnh viễn tài khoản</Btn><Btn variant="ghost" full onClick={()=>setSheet(null)}>Huỷ</Btn></div>
            </>)}
          </div>
        </div>
      )}
    </Page>
  );
}

Object.assign(window, { NAEditProfile, NAAiQuota, NAGoalSettings, NANotifSettings, NALanguage, NAVoiceSettings, NAHelp, NAAccountSettings, Switch });
