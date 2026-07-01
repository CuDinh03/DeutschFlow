// na-paywall.jsx — StoreKit IAP: sheet mua hàng, quản lý gói, nhắc dùng thử.
// Exports: NAIapSheet, NASubscription, NATrialReminder. Plan state qua tweak 'plan' (free|trial|pro).

const IAP_PLANS = {
  year:  { k:'year',  l:'DeutschFlow Pro · Năm',  price:'990.000đ',  per:'năm',  sub:'82.500đ/tháng · tiết kiệm 40%' },
  month: { k:'month', l:'DeutschFlow Pro · Tháng', price:'129.000đ',  per:'tháng', sub:'Linh hoạt, huỷ bất cứ lúc nào' },
};
window.__naIapPlan = IAP_PLANS.year;
function openIap(onNav, planKey){ window.__naIapPlan = IAP_PLANS[planKey]||IAP_PLANS.year; onNav('iap'); }

function ProBadge({ size=46 }){
  return <div style={{width:size,height:size,borderRadius:size*0.22,background:NA.ink,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="workspace_premium" size={size*0.56} fill color={NA.yellow}/></div>;
}

/* ════════ SHEET MUA HÀNG (StoreKit) ════════ */
function NAIapSheet({ onNav, state='default' }){
  const plan = window.__naIapPlan || IAP_PLANS.year;
  const [phase,setPhase] = React.useState(state==='default'?'confirm':state); // confirm|processing|success|fail
  React.useEffect(()=>{ setPhase(state==='default'?'confirm':state); },[state]);

  function pay(){
    setPhase('processing');
    setTimeout(()=>setPhase('success'), 1600);
  }
  function finishPro(){ if(window.__naSetPlan) window.__naSetPlan('trial'); onNav('home'); }

  const close = ()=>onNav('upgrade');

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(20,19,17,0.5)',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      {/* tap backdrop to close (only on confirm) */}
      {phase==='confirm' && <div onClick={close} style={{position:'absolute',inset:0}}/>}
      <div style={{position:'relative',background:NA.card,borderTopLeftRadius:18,borderTopRightRadius:18,padding:`10px 22px ${HOME_IND+18}px`,boxShadow:'0 -10px 40px rgba(0,0,0,0.2)',animation:'naSheetUp 0.34s cubic-bezier(0.32,1.1,0.4,1) both'}}>
        <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 18px'}}/>

        {phase==='confirm' && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:18}}>
              <ProBadge size={52}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{...NA.srf,fontSize:18,fontWeight:500,lineHeight:1.15}}>{plan.l}</div>
                <div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Tài khoản: lan.nguyen@email.com</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'13px 15px',background:NA.bg}}><span style={{fontSize:13.5,color:NA.muted}}>Dùng thử miễn phí</span><span style={{fontSize:13.5,fontWeight:600,color:NA.green}}>7 ngày</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'13px 15px',background:NA.bg}}><span style={{fontSize:13.5,color:NA.muted}}>Sau đó</span><span style={{...NA.srf,fontSize:16,fontWeight:500}}>{plan.price}<span style={{fontSize:12,color:NA.muted}}>/{plan.per}</span></span></div>
            </div>
            <div style={{fontSize:11.5,color:NA.subtle,lineHeight:1.5,marginBottom:18}}>Gói tự gia hạn cho đến khi huỷ. Bạn có thể huỷ trong Cài đặt ít nhất 24 giờ trước khi hết kỳ.</div>
            <Btn variant="primary" size="lg" full onClick={pay}><NAIcon name="lock" size={17} color={NA.yellow}/>Xác nhận · Face ID</Btn>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,marginTop:13}}>
              <NAIcon name="face" size={16} color={NA.subtle}/><span style={{fontSize:11.5,color:NA.subtle}}>Nhấn đúp nút sườn để thanh toán</span>
            </div>
          </>
        )}

        {phase==='processing' && (
          <div style={{textAlign:'center',padding:'18px 0 8px'}}>
            <div style={{display:'inline-flex',marginBottom:16}}><Spin c={NA.ink} size={34}/></div>
            <div style={{...NA.srf,fontSize:19,fontWeight:500}}>Đang xử lý…</div>
            <p style={{margin:'8px auto 0',fontSize:13,color:NA.muted,maxWidth:240,lineHeight:1.5}}>Đang xác nhận giao dịch với App Store.</p>
          </div>
        )}

        {phase==='success' && (
          <div style={{textAlign:'center',padding:'10px 0 4px'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="check" size={38} color={NA.green}/></div>
            <div style={{...NA.srf,fontSize:23,fontWeight:500}}>Chào mừng đến Pro!</div>
            <p style={{margin:'9px auto 20px',fontSize:13.5,color:NA.muted,maxWidth:260,lineHeight:1.55}}>Bạn đang dùng thử 7 ngày miễn phí. Mọi tính năng Pro đã được mở khoá.</p>
            <Btn variant="primary" size="lg" full onClick={finishPro}><YSq size={7} color={NA.yellow}/>Bắt đầu dùng Pro</Btn>
          </div>
        )}

        {phase==='fail' && (
          <div style={{textAlign:'center',padding:'10px 0 4px'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:naSoft(NA.red,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16}}><NAIcon name="error" size={38} color={NA.red}/></div>
            <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Giao dịch không thành công</div>
            <p style={{margin:'9px auto 20px',fontSize:13.5,color:NA.muted,maxWidth:260,lineHeight:1.55}}>Không có khoản phí nào được tính. Vui lòng thử lại hoặc kiểm tra phương thức thanh toán.</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Btn variant="primary" size="lg" full onClick={()=>setPhase('confirm')}><NAIcon name="refresh" size={18} color={NA.yellow}/>Thử lại</Btn>
              <Btn variant="ghost" full onClick={close}>Đóng</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════ QUẢN LÝ GÓI ════════ */
function NASubscription({ onNav, state='default' }){
  const plan = usePlan();
  const isPro = plan==='pro', isTrial = plan==='trial';
  const active = isPro || isTrial;

  return (
    <Page title="Gói đăng ký" dateCap="Quản lý đăng ký" back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* current status */}
        <Card pad={0} style={{background:active?NA.ink:NA.card}}>
          <div style={{padding:'20px',display:'flex',alignItems:'center',gap:14}}>
            <ProBadge size={48}/>
            <div style={{flex:1,minWidth:0}}>
              <Cap color={NA.yellow} style={{marginBottom:6}}>{isPro?'Đang dùng Pro':isTrial?'Đang dùng thử':'Gói hiện tại'}</Cap>
              <div style={{...NA.srf,fontSize:20,fontWeight:500,color:active?NA.bg:NA.ink,lineHeight:1.1}}>{isPro?'DeutschFlow Pro':isTrial?'Pro · Dùng thử':'Miễn phí'}</div>
              <div style={{fontSize:12.5,color:active?'#A39E94':NA.muted,marginTop:6}}>{isPro?'Gia hạn 20/07/2026 · 990.000đ/năm':isTrial?'Dùng thử hết hạn 27/06/2026':'Nâng cấp để mở khoá Pro'}</div>
            </div>
          </div>
          {isTrial && <div style={{padding:'12px 20px',borderTop:'1px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',gap:9}}><NAIcon name="schedule" size={18} color={NA.yellow}/><span style={{fontSize:12.5,color:'#D8D3C9'}}>Còn <strong style={{color:NA.bg}}>5 ngày</strong> dùng thử — sau đó tự chuyển sang gói năm.</span></div>}
        </Card>

        {!active && <Btn variant="primary" size="lg" full onClick={()=>onNav('upgrade')}><YSq size={7} color={NA.yellow}/>Nâng cấp lên Pro</Btn>}

        {active && (
          <>
            {/* benefits included */}
            <Card>
              <Cap style={{marginBottom:13}}>Đang bao gồm</Cap>
              <div style={{display:'flex',flexDirection:'column',gap:11}}>
                {['Luyện nói AI không giới hạn','Chấm điểm chi tiết + sửa lỗi','Mọi ngành phỏng vấn','Tải bài học offline'].map(f=>(
                  <div key={f} style={{display:'flex',gap:10,alignItems:'center'}}><NAIcon name="check_circle" size={18} fill color={NA.green}/><span style={{fontSize:13.5}}>{f}</span></div>
                ))}
              </div>
            </Card>

            {/* payment history (pro only) */}
            {isPro && (
              <Card pad={0}>
                <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>Lịch sử thanh toán</Cap></div>
                {[['20/06/2026','Pro · Năm','990.000đ'],['20/06/2025','Pro · Năm','890.000đ']].map(([d,l,p],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:i===0?`1px solid ${NA.border}`:'none'}}>
                    <NAIcon name="receipt_long" size={20} color={NA.muted}/>
                    <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:600}}>{l}</div><div style={{fontSize:11.5,color:NA.muted,marginTop:2}}>{d}</div></div>
                    <span style={{...NA.srf,fontSize:14,fontWeight:500}}>{p}</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {/* actions */}
        <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
          <button onClick={()=>window.gaToast&&window.gaToast('Đang khôi phục giao dịch…')} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
            <NAIcon name="restore" size={21} color={NA.ink}/><span style={{flex:1,fontSize:14.5,fontWeight:500}}>Khôi phục mua hàng</span><NAIcon name="chevron_right" size={19} color={NA.faint}/>
          </button>
          <button onClick={()=>window.gaToast&&window.gaToast('Mở Cài đặt hệ thống · Đăng ký')} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
            <NAIcon name="settings" size={21} color={NA.ink}/><span style={{flex:1,fontSize:14.5,fontWeight:500}}>Quản lý đăng ký</span><NAIcon name="open_in_new" size={18} color={NA.faint}/>
          </button>
          {active && (
            <button onClick={()=>{ if(window.__naSetPlan) window.__naSetPlan('free'); window.gaToast&&window.gaToast('Đã huỷ gia hạn · Pro vẫn dùng tới hết kỳ'); }} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
              <NAIcon name="cancel" size={21} color={NA.red}/><span style={{flex:1,fontSize:14.5,fontWeight:500,color:NA.red}}>Huỷ gia hạn</span>
            </button>
          )}
        </div>
        <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5,padding:'2px 8px'}}>Mọi giao dịch được xử lý an toàn qua App Store. DeutschFlow không lưu thông tin thẻ của bạn.</div>
      </div>
    </Page>
  );
}

/* ════════ NHẮC DÙNG THỬ SẮP HẾT ════════ */
function NATrialReminder({ onNav }){
  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(20,19,17,0.5)',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={()=>onNav('home')} style={{position:'absolute',inset:0}}/>
      <div style={{position:'relative',background:NA.card,borderTopLeftRadius:18,borderTopRightRadius:18,padding:`10px 24px ${HOME_IND+18}px`,boxShadow:'0 -10px 40px rgba(0,0,0,0.2)',animation:'naSheetUp 0.34s cubic-bezier(0.32,1.1,0.4,1) both'}}>
        <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 20px'}}/>
        <div style={{textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:naSoft(NA.gold,'subtle'),display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16}}><NAIcon name="hourglass_bottom" size={32} color={NA.gold}/></div>
          <div style={{...NA.srf,fontSize:22,fontWeight:500,lineHeight:1.2}}>Còn 2 ngày dùng thử</div>
          <p style={{margin:'10px auto 20px',fontSize:13.5,color:NA.muted,maxWidth:280,lineHeight:1.55}}>Sau ngày 27/06, gói sẽ tự chuyển sang Pro năm (990.000đ). Tiếp tục để không gián đoạn việc học.</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={()=>onNav('subscription')}><YSq size={7} color={NA.yellow}/>Tiếp tục với Pro</Btn>
          <Btn variant="ghost" full onClick={()=>onNav('home')}>Để sau</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NAIapSheet, NASubscription, NATrialReminder, openIap, IAP_PLANS, ProBadge });
