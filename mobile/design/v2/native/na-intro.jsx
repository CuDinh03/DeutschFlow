// na-intro.jsx — A0: Splash → Welcome (carousel) → Get Started → Chọn hướng (B2B/B2C).
// Đứng trước Auth. Không bottom tab. Exports: NASplash, NAWelcome, NAGetStarted, NAChooseDir

/* ════════ 1 · SPLASH ════════ */
function NASplash({ onNav, state='default' }){
  React.useEffect(()=>{
    if(state!=='default') return;
    const t=setTimeout(()=>onNav('welcome'), 2300);
    return ()=>clearTimeout(t);
  },[state]);

  if (state==='error'){
    return (
      <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:40,textAlign:'center'}}>
        <NAIcon name="wifi_off" size={44} color={NA.subtle}/>
        <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Không có kết nối</div>
        <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Cần mạng để khởi động. Kiểm tra kết nối và thử lại.</p>
        <Btn variant="primary" onClick={()=>onNav('welcome')}><NAIcon name="refresh" size={18} color={NA.yellow}/>Thử lại</Btn>
      </div>
    );
  }

  return (
    <div style={{position:'absolute',inset:0,background:NA.yellow,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
        <div className="na-logo-spin" style={{width:88,height:88,borderRadius:22,background:NA.ink,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 14px 36px rgba(22,21,19,0.25)'}}>
          <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
            <path className="na-logo-draw" d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z" stroke="#FFCD00" strokeWidth="6" strokeLinejoin="miter" fill="none" style={{animationDelay:'0.35s'}} />
            <polygon className="na-logo-pop" points="52,38 74,50 52,62" fill="#DA291C" style={{animationDelay:'1.15s'}} />
            <rect className="na-logo-pop" x="24" y="45" width="9" height="9" fill="#FFCD00" style={{animationDelay:'1.35s'}} />
          </svg>
        </div>
        <div style={{...NA.srf,fontSize:30,fontWeight:600,letterSpacing:'-0.02em',color:NA.ink,opacity:0,animation:'naFade 0.6s 1.5s ease both'}}>DeutschFlow</div>
      </div>
      <div style={{position:'absolute',bottom:HOME_IND+34,left:0,right:0,display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
        <span style={{width:22,height:22,borderRadius:'50%',border:`2.5px solid rgba(22,21,19,0.2)`,borderTopColor:NA.ink,animation:'naSpin 0.8s linear infinite'}}/>
        <span style={{font:`600 12px/1 'Instrument Sans'`,letterSpacing:'0.04em',color:'rgba(22,21,19,0.55)'}}>Đang khởi động…</span>
      </div>
    </div>
  );
}

/* ════════ 2 · WELCOME (carousel) ════════ */
const WELCOME = [
  { ic:'work', tint:NA.teal,  t:'Tiếng Đức cho công việc của bạn', d:'Lộ trình bám sát công việc thật ở Đức cho nhiều ngành nghề — chuẩn trình độ từ A1 đến B2.' },
  { ic:'record_voice_over',  tint:NA.violet,t:'Luyện nói với AI mọi lúc',  d:'Phỏng vấn thử, chấm phát âm và phản hồi chi tiết ngay lập tức.' },
  { ic:'route',              tint:NA.gold,  t:'Lộ trình cá nhân hoá',       d:'Kế hoạch riêng theo mục tiêu, kèm ôn tập thông minh (SRS) để nhớ lâu.' },
];
function WelcomeArt({ ic, tint }){
  return (
    <div style={{width:'100%',height:300,borderRadius:'calc(var(--na-radius,4px) + 10px)',background:naSoft(tint,'subtle'),border:`1px solid ${naSoft(tint,'bold')}`,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      {/* decorative dots */}
      <div style={{position:'absolute',top:24,left:26,width:10,height:10,borderRadius:'50%',background:naSoft(tint,'bold')}}/>
      <div style={{position:'absolute',bottom:34,right:30,width:16,height:16,borderRadius:'50%',background:naSoft(tint,'bold')}}/>
      <div style={{position:'absolute',top:40,right:44,width:7,height:7,borderRadius:'50%',background:naSoft(tint,'bold')}}/>
      <div style={{width:128,height:128,borderRadius:'50%',background:NA.card,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 14px 40px ${naSoft(tint,'bold')}`}}>
        <NAIcon name={ic} size={64} color={tint}/>
      </div>
    </div>
  );
}
function NAWelcome({ onNav, state='default' }){
  const [i,setI] = React.useState(0);
  const [dx,setDx] = React.useState(0);
  const [drag,setDrag] = React.useState(false);
  const g = React.useRef({down:false,x0:0}).current;
  const N = WELCOME.length;
  const trackRef = React.useRef(null);

  const onDown=e=>{ g.down=true; g.x0=e.clientX; setDrag(true); try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}};
  const onMove=e=>{ if(!g.down)return; let d=e.clientX-g.x0; if((i===0&&d>0)||(i===N-1&&d<0)) d*=0.3; setDx(d); };
  const onUp=e=>{ if(!g.down)return; g.down=false; setDrag(false); const d=e.clientX-g.x0;
    if(d<-60&&i<N-1) setI(i+1); else if(d>60&&i>0) setI(i-1); setDx(0); };

  const W = 354; // approx inner width (402 - 48 padding)
  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,display:'flex',justifyContent:'flex-end',padding:`${SAFE_TOP}px 18px 0`}}>
        <button onClick={()=>onNav('get-started')} className="na-press" style={{background:'none',border:'none',cursor:'pointer',font:`600 14px/1 'Instrument Sans'`,color:NA.muted,padding:'10px 8px',margin:'-4px -8px'}}>Bỏ qua</button>
      </div>

      <div ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{flex:1,overflow:'hidden',padding:'10px 0 0',touchAction:'pan-y',position:'relative'}}>
        <div style={{display:'flex',width:`${N*100}%`,transform:`translateX(calc(${-i*(100/N)}% + ${dx}px))`,transition:drag?'none':'transform 0.4s cubic-bezier(0.32,1.1,0.4,1)'}}>
          {WELCOME.map((s,k)=>(
            <div key={k} style={{width:`${100/N}%`,flexShrink:0,boxSizing:'border-box',padding:'0 24px'}}>
              <div>
                <WelcomeArt ic={s.ic} tint={s.tint}/>
                <div style={{...NA.srf,fontSize:27,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.18,marginTop:30,textWrap:'balance'}}>{s.t}</div>
                <p style={{margin:'12px 0 0',fontSize:15,color:NA.muted,lineHeight:1.6,maxWidth:300}}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* dots + cta */}
      <div style={{flexShrink:0,padding:`8px 24px ${HOME_IND+18}px`}}>
        <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:22}}>
          {WELCOME.map((_,k)=>(<button key={k} onClick={()=>setI(k)} aria-label={`Slide ${k+1}`} style={{width:k===i?22:8,height:8,borderRadius:8,border:'none',cursor:'pointer',background:k===i?NA.ink:NA.border,transition:'all 0.3s',padding:0}}/>))}
        </div>
        {i<N-1 ? (
          <Btn variant="primary" size="lg" full onClick={()=>setI(i+1)}>Tiếp</Btn>
        ) : (
          <Btn variant="primary" size="lg" full onClick={()=>onNav('get-started')}><YSq size={7} color={NA.yellow}/>Bắt đầu</Btn>
        )}
      </div>
    </div>
  );
}

/* ════════ 3 · GET STARTED ════════ */
function NAGetStarted({ onNav, state='default' }){
  const [lang,setLang] = React.useState('VI');
  function cycleLang(){ const o=['VI','EN','DE']; const n=o[(o.indexOf(lang)+1)%3]; setLang(n); window.gaToast&&window.gaToast('Ngôn ngữ: '+({VI:'Tiếng Việt',EN:'English',DE:'Deutsch'}[n])); }
  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {/* lang toggle */}
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,display:'flex',justifyContent:'flex-end',padding:`${SAFE_TOP}px 18px 0`}}>
        <button onClick={cycleLang} className="na-press" aria-label="Đổi ngôn ngữ" style={{display:'inline-flex',alignItems:'center',gap:5,background:NA.card,border:`1px solid ${NA.border}`,borderRadius:99,cursor:'pointer',font:`700 12px/1 'Instrument Sans'`,color:NA.ink,padding:'8px 12px'}}><NAIcon name="language" size={15} color={NA.muted}/>{lang}<NAIcon name="expand_more" size={15} color={NA.muted}/></button>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 28px',textAlign:'center'}}>
        <div style={{width:74,height:74,borderRadius:18,background:NA.ink,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}><NAMark size={44} color={NA.yellow}/></div>
        <div style={{...NA.srf,fontSize:30,fontWeight:600,letterSpacing:'-0.02em'}}>DeutschFlow</div>
        <p style={{margin:'12px 0 0',fontSize:15,color:NA.muted,lineHeight:1.55,maxWidth:280}}>Học tiếng Đức cho điều dưỡng — từ A1 đến B2·Pflege, ngay trên điện thoại.</p>
      </div>

      <div style={{flexShrink:0,padding:`0 24px ${HOME_IND+20}px`,display:'flex',flexDirection:'column',gap:11}}>
        <Btn variant="primary" size="lg" full onClick={()=>onNav('choose-direction')}><YSq size={7} color={NA.yellow}/>Tạo tài khoản</Btn>
        <Btn variant="ghost" size="lg" full onClick={()=>onNav('auth-login')}>Tôi đã có tài khoản → Đăng nhập</Btn>

        <div style={{display:'flex',alignItems:'center',gap:12,margin:'8px 0'}}>
          <div style={{flex:1,height:1,background:NA.border}}/><span style={{fontSize:12,color:NA.subtle}}>hoặc</span><div style={{flex:1,height:1,background:NA.border}}/>
        </div>

        <button onClick={()=>{window.gaToast&&window.gaToast('Đang xác thực với Apple…');onNav('choose-direction');}} className="na-press" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:9,padding:'15px',borderRadius:'var(--na-radius,4px)',background:NA.ink,border:'none',cursor:'pointer',font:`700 15px/1 'Instrument Sans'`,color:NA.bg}}><NAIcon name="apple" size={20} color={NA.bg}/>Tiếp tục với Apple</button>
        <button onClick={()=>{window.gaToast&&window.gaToast('Đang xác thực với Google…');onNav('choose-direction');}} className="na-press" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:9,padding:'15px',borderRadius:'var(--na-radius,4px)',background:NA.card,border:`1px solid ${NA.border}`,cursor:'pointer',font:`700 15px/1 'Instrument Sans'`,color:NA.ink}}><span style={{...NA.srf,fontSize:17,fontWeight:700,color:NA.blue}}>G</span>Tiếp tục với Google</button>

        <p style={{margin:'8px 0 0',textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5}}>Bằng việc tiếp tục, bạn đồng ý với <span style={{color:NA.muted,fontWeight:600}}>Điều khoản</span> & <span style={{color:NA.muted,fontWeight:600}}>Bảo mật</span>.</p>
      </div>
    </div>
  );
}

/* ════════ 4 · CHỌN HƯỚNG (B2B/B2C) ════════ */
function NAChooseDir({ onNav, state='default' }){
  const [pick,setPick] = React.useState(null); // 'b2c' | 'b2b'
  const [code,setCode] = React.useState('');
  const ready = pick==='b2c' || (pick==='b2b' && code.trim().length>=4);
  function go(){
    if(!ready) return;
    if(pick==='b2b'){ if(window.__naCtx) window.__naCtx('b2b'); }
    else if(window.__naCtx) window.__naCtx('b2c');
    onNav('auth-register');
  }
  return (
    <div style={{position:'absolute',inset:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 12px 0`}}>
        <button onClick={()=>onNav('get-started')} className="na-press" aria-label="Quay lại" style={{display:'inline-flex',alignItems:'center',gap:3,background:'none',border:'none',padding:'11px 10px',margin:'-11px 0',color:NA.ink,font:`600 15px/1 'Instrument Sans'`,cursor:'pointer'}}><NAIcon name="chevron_left" size={26} weight={400}/></button>
      </div>
      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'6px 24px 16px'}}>
        <h1 style={{margin:'4px 0 0',...NA.srf,fontSize:28,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.18}}>Bạn học theo cách nào?</h1>
        <p style={{margin:'10px 0 22px',fontSize:14.5,color:NA.muted,lineHeight:1.55}}>Chọn để chúng tôi thiết lập trải nghiệm phù hợp. Bạn có thể đổi sau trong Cài đặt.</p>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* B2C */}
          <button onClick={()=>setPick('b2c')} className="na-press" style={{display:'flex',alignItems:'flex-start',gap:13,padding:'18px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:pick==='b2c'?naSoft(NA.yellow,'subtle'):NA.card,border:`${pick==='b2c'?2:1}px solid ${pick==='b2c'?NA.gold:NA.border}`}}>
            <div style={{width:44,height:44,borderRadius:'var(--na-radius,4px)',background:pick==='b2c'?NA.ink:NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="self_improvement" size={24} color={pick==='b2c'?NA.yellow:NA.muted}/></div>
            <div style={{flex:1}}><div style={{...NA.srf,fontSize:17,fontWeight:500}}>Tôi học tự do</div><div style={{fontSize:13,color:NA.muted,marginTop:4,lineHeight:1.5}}>Tự học theo lộ trình cá nhân hoá, không cần lớp.</div></div>
            <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${pick==='b2c'?NA.gold:NA.border}`,background:pick==='b2c'?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{pick==='b2c'&&<NAIcon name="check" size={14} color="#fff"/>}</div>
          </button>
          {/* B2B */}
          <button onClick={()=>setPick('b2b')} className="na-press" style={{display:'flex',alignItems:'flex-start',gap:13,padding:'18px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:pick==='b2b'?naSoft(NA.violet,'subtle'):NA.card,border:`${pick==='b2b'?2:1}px solid ${pick==='b2b'?NA.violet:NA.border}`}}>
            <div style={{width:44,height:44,borderRadius:'var(--na-radius,4px)',background:pick==='b2b'?NA.violet:NA.paper,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="groups" size={24} color={pick==='b2b'?'#fff':NA.muted}/></div>
            <div style={{flex:1}}><div style={{...NA.srf,fontSize:17,fontWeight:500}}>Tôi có mã lớp</div><div style={{fontSize:13,color:NA.muted,marginTop:4,lineHeight:1.5}}>Học cùng giáo viên & trung tâm, nhận bài tập của lớp.</div></div>
            <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${pick==='b2b'?NA.violet:NA.border}`,background:pick==='b2b'?NA.violet:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{pick==='b2b'&&<NAIcon name="check" size={14} color="#fff"/>}</div>
          </button>

          {pick==='b2b' && (
            <Card style={{marginTop:2}}>
              <Cap style={{marginBottom:9}}>Mã lớp</Cap>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="VD: K30-PFLEGE" maxLength={14}
                style={{width:'100%',border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'14px',font:`600 16px/1 'Instrument Sans'`,letterSpacing:'0.06em',color:NA.ink,background:NA.bg,outline:'none',textAlign:'center'}}/>
            </Card>
          )}
        </div>
      </div>

      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`}}>
        <Btn variant="primary" size="lg" full onClick={go} style={{opacity:ready?1:0.5}}><YSq size={7} color={NA.yellow}/>Tiếp tục</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { NASplash, NAWelcome, NAGetStarted, NAChooseDir });
