// na-auth.jsx — Cổng vào: Đăng nhập / Đăng ký / Quên mật khẩu / Đã gửi / Đặt lại / Xác minh email.
// Không có bottom tab. Exports: NALogin, NARegister, NAForgot, NAResetSent, NAReset, NAVerify

/* ── shared bits ── */
function Spin({ c=NA.bg, size=16 }){
  return <span style={{width:size,height:size,borderRadius:'50%',border:`2px solid ${c}40`,borderTopColor:c,display:'inline-block',animation:'naSpin 0.7s linear infinite',flexShrink:0}}/>;
}

function AuthShell({ back, onBack, children, footer }){
  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,height:SAFE_TOP+44,display:'flex',alignItems:'center',padding:`${SAFE_TOP}px 12px 0`}}>
        {back && (
          <button onClick={onBack} className="na-press" aria-label="Quay lại" style={{display:'inline-flex',alignItems:'center',gap:3,background:'none',border:'none',padding:'11px 10px',margin:'-11px 0',color:NA.ink,font:`600 15px/1 'Instrument Sans'`,cursor:'pointer'}}>
            <NAIcon name="chevron_left" size={26} weight={400}/><span style={{marginLeft:-3}}>{back===true?'':back}</span>
          </button>
        )}
      </div>
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'6px 24px 24px'}}>{children}</div>
      {footer && <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,textAlign:'center'}}>{footer}</div>}
    </div>
  );
}

function AuthBrand({ sub }){
  return (
    <div style={{textAlign:'center',marginBottom:26,marginTop:8}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:10}}>
        <NAMark size={32}/>
        <span style={{...NA.srf,fontSize:25,fontWeight:600,letterSpacing:'-0.01em'}}>DeutschFlow</span>
      </div>
      {sub && <div style={{fontSize:14,color:NA.muted,marginTop:11,lineHeight:1.4}}>{sub}</div>}
    </div>
  );
}

function ErrBanner({ msg, onRetry }){
  return (
    <Card accent={NA.red} style={{display:'flex',alignItems:'center',gap:11,marginBottom:16}}>
      <NAIcon name="wifi_off" size={22} color={NA.red}/>
      <div style={{flex:1,fontSize:13,color:NA.ink,lineHeight:1.4}}>{msg}</div>
      {onRetry && <button onClick={onRetry} style={{background:'none',border:'none',cursor:'pointer',font:`700 12.5px/1 'Instrument Sans'`,color:NA.red,padding:'8px',margin:-8}}>Thử lại</button>}
    </Card>
  );
}

function Field({ label, value, onChange, type='text', placeholder, error, right, autoComplete }){
  return (
    <div>
      <Cap style={{marginBottom:8}}>{label}</Cap>
      <div style={{position:'relative'}}>
        <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} autoComplete={autoComplete}
          style={{width:'100%',border:`1px solid ${error?NA.red:NA.border}`,borderRadius:'var(--na-radius,4px)',padding:`14px ${right?46:14}px 14px 14px`,font:`500 15px/1.2 'Instrument Sans'`,color:NA.ink,background:NA.bg,outline:'none'}}/>
        {right && <div style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}}>{right}</div>}
      </div>
      {error && <div style={{display:'flex',alignItems:'center',gap:5,marginTop:7,color:NA.red,fontSize:12.5,fontWeight:500}}><NAIcon name="error" size={14} color={NA.red}/>{error}</div>}
    </div>
  );
}

function PwToggle({ show, onToggle }){
  return <button onClick={onToggle} aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'} style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name={show?'visibility_off':'visibility'} size={21} color={NA.muted}/></button>;
}

function LinkBtn({ children, onClick, color=NA.ink }){
  return <button onClick={onClick} style={{background:'none',border:'none',cursor:'pointer',font:`600 13.5px/1.3 'Instrument Sans'`,color,padding:'6px 4px',margin:'-6px -4px'}}>{children}</button>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function pwStrength(pw){
  let s=0; if(pw.length>=8)s++; if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  if(pw.length<6) return {lv:0,l:'Quá ngắn',c:NA.red};
  if(s<=1) return {lv:1,l:'Yếu',c:NA.red};
  if(s===2) return {lv:2,l:'Trung bình',c:NA.orange};
  if(s===3) return {lv:3,l:'Khá',c:NA.gold};
  return {lv:4,l:'Mạnh',c:NA.green};
}

/* ════════ 1 · ĐĂNG NHẬP ════════ */
function NALogin({ onNav, state='default' }){
  const [email,setEmail] = React.useState('');
  const [pw,setPw] = React.useState('');
  const [show,setShow] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const err401 = state==='error', errNet = state==='network';
  const loading = busy || state==='loading';
  const valid = EMAIL_RE.test(email) && pw.length>=1;
  function submit(){ if(!valid||loading) return; setBusy(true); setTimeout(()=>{ setBusy(false); onNav('home'); }, 900); }
  return (
    <AuthShell footer={<span style={{fontSize:13.5,color:NA.muted}}>Chưa có tài khoản? <LinkBtn onClick={()=>onNav('auth-register')}>Đăng ký</LinkBtn></span>}>
      <AuthBrand sub="Đăng nhập để tiếp tục học tiếng Đức"/>
      {errNet && <ErrBanner msg="Không có kết nối mạng. Kiểm tra đường truyền và thử lại." onRetry={submit}/>}
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="ban@email.com" autoComplete="email" error={err401?' ':undefined}/>
        <Field label="Mật khẩu" value={pw} onChange={setPw} type={show?'text':'password'} placeholder="••••••••" autoComplete="current-password"
          error={err401?'Email hoặc mật khẩu không đúng':undefined} right={<PwToggle show={show} onToggle={()=>setShow(s=>!s)}/>}/>
        <div style={{textAlign:'right',marginTop:-4}}><LinkBtn color={NA.muted} onClick={()=>onNav('auth-forgot')}>Quên mật khẩu?</LinkBtn></div>
        <Btn variant="primary" size="lg" full onClick={submit} style={{opacity:valid&&!loading?1:0.5,marginTop:2}}>
          {loading ? <><Spin/>Đang đăng nhập…</> : <><YSq size={7} color={NA.yellow}/>Đăng nhập</>}
        </Btn>
      </div>
    </AuthShell>
  );
}

/* ════════ 2 · ĐĂNG KÝ ════════ */
function NARegister({ onNav, state='default' }){
  const [name,setName] = React.useState('');
  const [email,setEmail] = React.useState('');
  const [pw,setPw] = React.useState('');
  const [show,setShow] = React.useState(false);
  const [agree,setAgree] = React.useState(false);
  const [touched,setTouched] = React.useState({});
  const [busy,setBusy] = React.useState(false);
  const exists = state==='exists';
  const loading = busy || state==='loading';
  const emailErr = exists ? 'Email này đã được đăng ký' : (touched.email && email && !EMAIL_RE.test(email) ? 'Email chưa đúng định dạng' : undefined);
  const str = pwStrength(pw);
  const valid = name.trim().length>=2 && EMAIL_RE.test(email) && str.lv>=2 && agree;
  function submit(){ if(!valid||loading) return; setBusy(true); setTimeout(()=>{ setBusy(false); onNav('auth-verify'); }, 900); }
  return (
    <AuthShell back="Đăng nhập" onBack={()=>onNav('auth-login')}
      footer={<span style={{fontSize:13.5,color:NA.muted}}>Đã có tài khoản? <LinkBtn onClick={()=>onNav('auth-login')}>Đăng nhập</LinkBtn></span>}>
      <AuthBrand sub="Tạo tài khoản để bắt đầu lộ trình của bạn"/>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <Field label="Họ và tên" value={name} onChange={setName} placeholder="Nguyễn Văn A" autoComplete="name"/>
        <Field label="Email" value={email} onChange={v=>{setEmail(v);}} type="email" placeholder="ban@email.com" autoComplete="email"
          error={emailErr} right={emailErr?undefined:(EMAIL_RE.test(email)?<div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="check_circle" size={19} fill color={NA.green}/></div>:undefined)}/>
        <div onBlur={()=>setTouched(t=>({...t,email:true}))} style={{display:'none'}}/>
        <div>
          <Field label="Mật khẩu" value={pw} onChange={setPw} type={show?'text':'password'} placeholder="Tối thiểu 6 ký tự" autoComplete="new-password"
            right={<PwToggle show={show} onToggle={()=>setShow(s=>!s)}/>}/>
          {pw && (
            <div style={{marginTop:9}}>
              <div style={{display:'flex',gap:4}}>
                {[0,1,2,3].map(i=>(<div key={i} style={{flex:1,height:4,borderRadius:2,background:i<str.lv?str.c:NA.border,transition:'background 0.2s'}}/>))}
              </div>
              <div style={{fontSize:11.5,color:str.c,fontWeight:600,marginTop:6}}>Độ mạnh: {str.l}</div>
            </div>
          )}
        </div>
        {/* terms */}
        <button onClick={()=>setAgree(a=>!a)} style={{display:'flex',alignItems:'flex-start',gap:11,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:'2px 0'}}>
          <div style={{width:22,height:22,borderRadius:'var(--na-radius,4px)',border:`1.5px solid ${agree?NA.ink:NA.border}`,background:agree?NA.ink:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{agree&&<NAIcon name="check" size={15} color={NA.yellow}/>}</div>
          <span style={{fontSize:12.5,color:NA.muted,lineHeight:1.5}}>Tôi đồng ý với <span style={{color:NA.ink,fontWeight:600}}>Điều khoản sử dụng</span> và <span style={{color:NA.ink,fontWeight:600}}>Chính sách bảo mật</span> của DeutschFlow.</span>
        </button>
        <Btn variant="primary" size="lg" full onClick={submit} style={{opacity:valid&&!loading?1:0.5}}>
          {loading ? <><Spin/>Đang tạo tài khoản…</> : <><YSq size={7} color={NA.yellow}/>Tạo tài khoản</>}
        </Btn>
      </div>
    </AuthShell>
  );
}

/* ════════ 3a · QUÊN MẬT KHẨU ════════ */
function NAForgot({ onNav, state='default' }){
  const [email,setEmail] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const notFound = state==='notfound';
  const loading = busy || state==='loading';
  const valid = EMAIL_RE.test(email);
  function submit(){ if(!valid||loading) return; setBusy(true); setTimeout(()=>{ setBusy(false); onNav('auth-sent'); }, 900); }
  return (
    <AuthShell back="Đăng nhập" onBack={()=>onNav('auth-login')}>
      <div style={{marginTop:6,marginBottom:24}}>
        <div style={{width:54,height:54,borderRadius:'var(--na-radius,4px)',background:NA.paper,border:`1px solid ${NA.border}`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}><NAIcon name="lock_reset" size={28} color={NA.ink}/></div>
        <h1 style={{margin:0,...NA.srf,fontSize:28,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.15}}>Quên mật khẩu?</h1>
        <p style={{margin:'10px 0 0',fontSize:14,color:NA.muted,lineHeight:1.55}}>Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="ban@email.com" autoComplete="email"
          error={notFound?'Không tìm thấy tài khoản với email này':undefined}/>
        <Btn variant="primary" size="lg" full onClick={submit} style={{opacity:valid&&!loading?1:0.5}}>
          {loading ? <><Spin/>Đang gửi…</> : 'Gửi liên kết đặt lại'}
        </Btn>
      </div>
    </AuthShell>
  );
}

/* ════════ 3b · ĐÃ GỬI EMAIL ════════ */
function NAResetSent({ onNav }){
  return (
    <AuthShell back="Đăng nhập" onBack={()=>onNav('auth-login')}>
      <div style={{textAlign:'center',padding:'18px 4px 0',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:78,height:78,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="mark_email_read" size={40} color={NA.green}/></div>
        <h1 style={{margin:0,...NA.srf,fontSize:26,fontWeight:500,letterSpacing:'-0.01em',lineHeight:1.2}}>Đã gửi email</h1>
        <p style={{margin:'11px auto 0',fontSize:14,color:NA.muted,lineHeight:1.6,maxWidth:300}}>Chúng tôi đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư (và mục spam) rồi làm theo hướng dẫn.</p>
        <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',marginTop:28}}>
          <Btn variant="primary" size="lg" full onClick={()=>window.gaToast&&window.gaToast('Đang mở ứng dụng email…')}><NAIcon name="mail" size={19} color={NA.yellow}/>Mở app email</Btn>
          <Btn variant="ghost" full onClick={()=>onNav('auth-reset')}>Tôi đã có mã → Đặt mật khẩu</Btn>
          <LinkBtn color={NA.muted} onClick={()=>onNav('auth-login')}>Quay lại đăng nhập</LinkBtn>
        </div>
      </div>
    </AuthShell>
  );
}

/* ════════ 3c · ĐẶT MẬT KHẨU MỚI ════════ */
function NAReset({ onNav, state='default' }){
  const [pw,setPw] = React.useState('');
  const [pw2,setPw2] = React.useState('');
  const [show,setShow] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const str = pwStrength(pw);
  const mismatch = pw2.length>0 && pw!==pw2;
  const loading = busy || state==='loading';
  const valid = str.lv>=2 && pw===pw2;
  function submit(){ if(!valid||loading) return; setBusy(true); setTimeout(()=>{ setBusy(false); window.gaToast&&window.gaToast('Đã đặt lại mật khẩu — mời đăng nhập'); onNav('auth-login'); }, 900); }
  return (
    <AuthShell back="Quay lại" onBack={()=>onNav('auth-sent')}>
      <div style={{marginTop:6,marginBottom:24}}>
        <div style={{width:54,height:54,borderRadius:'var(--na-radius,4px)',background:NA.paper,border:`1px solid ${NA.border}`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}><NAIcon name="password" size={26} color={NA.ink}/></div>
        <h1 style={{margin:0,...NA.srf,fontSize:28,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.15}}>Đặt mật khẩu mới</h1>
        <p style={{margin:'10px 0 0',fontSize:14,color:NA.muted,lineHeight:1.55}}>Chọn mật khẩu mới cho tài khoản của bạn.</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <Field label="Mật khẩu mới" value={pw} onChange={setPw} type={show?'text':'password'} placeholder="Tối thiểu 6 ký tự"
            right={<PwToggle show={show} onToggle={()=>setShow(s=>!s)}/>}/>
          {pw && (
            <div style={{marginTop:9}}>
              <div style={{display:'flex',gap:4}}>{[0,1,2,3].map(i=>(<div key={i} style={{flex:1,height:4,borderRadius:2,background:i<str.lv?str.c:NA.border}}/>))}</div>
              <div style={{fontSize:11.5,color:str.c,fontWeight:600,marginTop:6}}>Độ mạnh: {str.l}</div>
            </div>
          )}
        </div>
        <Field label="Nhập lại mật khẩu" value={pw2} onChange={setPw2} type={show?'text':'password'} placeholder="Nhập lại mật khẩu mới"
          error={mismatch?'Mật khẩu nhập lại không khớp':undefined}/>
        <Btn variant="primary" size="lg" full onClick={submit} style={{opacity:valid&&!loading?1:0.5}}>
          {loading ? <><Spin/>Đang lưu…</> : 'Đặt lại mật khẩu'}
        </Btn>
      </div>
    </AuthShell>
  );
}

/* ════════ 4 · XÁC MINH EMAIL ════════ */
function NAVerify({ onNav, state='default' }){
  const [left,setLeft] = React.useState(60);
  const [resendErr,setResendErr] = React.useState(state==='error');
  React.useEffect(()=>{
    if(left<=0) return;
    const t = setTimeout(()=>setLeft(l=>l-1), 1000);
    return ()=>clearTimeout(t);
  },[left]);
  function resend(){ if(left>0) return; setResendErr(state==='error'); if(state!=='error'){ window.gaToast&&window.gaToast('Đã gửi lại liên kết xác minh'); } setLeft(60); }
  return (
    <AuthShell back="Đăng ký" onBack={()=>onNav('auth-register')}>
      <div style={{textAlign:'center',padding:'18px 4px 0',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:78,height:78,borderRadius:'50%',background:naSoft(NA.blue,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}><NAIcon name="mail" size={38} color={NA.blue}/></div>
        <h1 style={{margin:0,...NA.srf,fontSize:26,fontWeight:500,letterSpacing:'-0.01em',lineHeight:1.2}}>Xác minh email của bạn</h1>
        <p style={{margin:'11px auto 0',fontSize:14,color:NA.muted,lineHeight:1.6,maxWidth:300}}>Chúng tôi đã gửi liên kết xác minh tới <strong style={{color:NA.ink}}>ban@email.com</strong>. Mở email và bấm liên kết để kích hoạt tài khoản.</p>

        {resendErr && <div style={{marginTop:18,width:'100%'}}><ErrBanner msg="Gửi lại không thành công. Vui lòng thử lại sau."/></div>}

        <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',marginTop:26}}>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('onboarding')}><YSq size={7} color={NA.yellow}/>Tôi đã xác minh → Tiếp tục</Btn>
          <button onClick={resend} disabled={left>0} style={{background:'none',border:'none',cursor:left>0?'default':'pointer',font:`600 13.5px/1 'Instrument Sans'`,color:left>0?NA.subtle:NA.ink,padding:'10px'}}>
            {left>0 ? `Gửi lại liên kết sau ${left}s` : 'Gửi lại liên kết'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

Object.assign(window, { NALogin, NARegister, NAForgot, NAResetSent, NAReset, NAVerify, AuthShell, AuthBrand, Spin, EMAIL_RE });
