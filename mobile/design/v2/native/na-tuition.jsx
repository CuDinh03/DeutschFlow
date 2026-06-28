// na-tuition.jsx — Học phí (n61). Exports: NATuition
// nguồn: GET /api/me/tuition ; POST /api/payments/tuition (MoMo/VNPay/Stripe)

const TUITION = {
  outstanding: 1800000,
  course: 'K30 · Pflege B1 → B2',
  dueDate: '30/06/2026',
  total: 7200000, paid: 5400000,
  history: [
    { id:'p1', label:'Học phí đợt 3/4', amount:1800000, date:'02/06/2026', method:'MoMo', status:'paid' },
    { id:'p2', label:'Học phí đợt 2/4', amount:1800000, date:'02/04/2026', method:'VNPay', status:'paid' },
    { id:'p3', label:'Học phí đợt 1/4', amount:1800000, date:'05/02/2026', method:'Chuyển khoản', status:'paid' },
  ],
};
const PAY_METHODS = [
  { k:'momo', l:'Ví MoMo', ic:'account_balance_wallet', hue:'#7C56C8' },
  { k:'vnpay', l:'VNPay QR', ic:'qr_code_2', hue:'#2F6FC9' },
  { k:'card', l:'Thẻ quốc tế', ic:'credit_card', hue:'#161513' },
];
const vnd = n => n.toLocaleString('vi-VN')+'đ';

function NATuition({ onNav, state='default' }){
  const [sheet,setSheet] = React.useState(false);
  const [method,setMethod] = React.useState('momo');
  const [busy,setBusy] = React.useState(false);
  const empty = state==='empty';

  function pay(){
    if(busy) return; setBusy(true);
    setTimeout(()=>{ setBusy(false); setSheet(false); window.gaToast&&window.gaToast('Đang mở cổng thanh toán…'); }, 900);
  }

  return (
    <Page title="Học phí" dateCap={TUITION.course} back="Hồ sơ" onBack={()=>onNav('profile')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {empty ? (
          <Card pad={0} style={{background:NA.ink}}>
            <div style={{padding:'26px 20px',textAlign:'center'}}>
              <NAIcon name="task_alt" size={40} fill color={NA.green}/>
              <div style={{...NA.srf,fontSize:22,fontWeight:500,color:NA.bg,marginTop:10}}>Đã đóng đủ học phí</div>
              <div style={{fontSize:13,color:'#A39E94',marginTop:7,lineHeight:1.5}}>Bạn không có khoản nào cần thanh toán. Cảm ơn bạn!</div>
            </div>
          </Card>
        ) : (
          <Card pad={0} style={{background:NA.ink,overflow:'hidden'}}>
            <div style={{padding:'20px'}}>
              <Cap color={NA.yellow} style={{marginBottom:9}}>Cần thanh toán</Cap>
              <div style={{...NA.srf,fontSize:34,fontWeight:500,color:NA.bg,lineHeight:1}}>{vnd(TUITION.outstanding)}</div>
              <div style={{display:'flex',alignItems:'center',gap:7,marginTop:11}}>
                <NAIcon name="event" size={16} color="#A39E94"/><span style={{fontSize:12.5,color:'#A39E94'}}>Hạn đóng: <strong style={{color:NA.bg}}>{TUITION.dueDate}</strong></span>
              </div>
            </div>
            <div style={{padding:'14px 20px',background:'rgba(255,255,255,0.05)',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:11.5,color:'#A39E94'}}>Đã đóng {vnd(TUITION.paid)} / {vnd(TUITION.total)}</span>
                <span style={{fontSize:11.5,color:NA.yellow,fontWeight:600}}>{Math.round(TUITION.paid/TUITION.total*100)}%</span>
              </div>
              <ProgressBar pct={TUITION.paid/TUITION.total*100} color={NA.yellow} track="rgba(255,255,255,0.16)" h={5}/>
            </div>
          </Card>
        )}

        {!empty && <Btn variant="yellow" size="lg" full onClick={()=>setSheet(true)}><YSq size={7} color={NA.ink}/>Đóng học phí ngay</Btn>}

        {/* history */}
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Lịch sử thanh toán</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
            {TUITION.history.map(h=>(
              <button key={h.id} onClick={()=>window.gaToast&&window.gaToast('Mở hoá đơn '+h.label)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="check" size={18} color={NA.green}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{h.label}</div>
                  <div style={{fontSize:12,color:NA.muted,marginTop:2}}>{h.date} · {h.method}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}><div style={{...NA.srf,fontSize:15,fontWeight:500}}>{vnd(h.amount)}</div><div style={{fontSize:10.5,color:NA.green,fontWeight:600,marginTop:2}}>Đã thanh toán</div></div>
              </button>
            ))}
          </div>
        </div>

        <div style={{display:'flex',gap:9,alignItems:'flex-start',padding:'0 2px'}}>
          <NAIcon name="info" size={16} color={NA.subtle} style={{marginTop:1}}/>
          <p style={{margin:0,fontSize:12,color:NA.muted,lineHeight:1.55}}>Học phí được thu theo đợt của trung tâm. Mọi thắc mắc vui lòng liên hệ giáo viên chủ nhiệm.</p>
        </div>
      </div>

      {/* pay sheet */}
      {sheet && (
        <div onClick={()=>!busy&&setSheet(false)} style={{position:'absolute',inset:0,zIndex:40,background:'rgba(22,21,19,0.4)',display:'flex',alignItems:'flex-end'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:NA.bg,borderRadius:'18px 18px 0 0',padding:'10px 20px 30px',animation:'naSheetUp 0.32s cubic-bezier(0.32,0.72,0,1) both'}}>
            <div style={{width:38,height:5,borderRadius:3,background:NA.border,margin:'0 auto 16px'}}/>
            <div style={{...NA.srf,fontSize:21,fontWeight:500,marginBottom:3}}>Đóng học phí</div>
            <div style={{fontSize:13,color:NA.muted,marginBottom:18}}>Số tiền <strong style={{color:NA.ink}}>{vnd(TUITION.outstanding)}</strong> · chọn phương thức</div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:18}}>
              {PAY_METHODS.map(m=>{
                const on=method===m.k;
                return (
                  <button key={m.k} onClick={()=>setMethod(m.k)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,padding:'14px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:on?naSoft(NA.yellow,'subtle'):NA.card,border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
                    <div style={{width:38,height:38,borderRadius:'var(--na-radius,4px)',background:naSoft(m.hue,'balanced'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name={m.ic} size={20} color={m.hue}/></div>
                    <span style={{flex:1,fontSize:14.5,fontWeight:600}}>{m.l}</span>
                    <div style={{width:21,height:21,borderRadius:'50%',border:`2px solid ${on?NA.gold:NA.border}`,background:on?NA.gold:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{on&&<NAIcon name="check" size={13} color="#fff"/>}</div>
                  </button>
                );
              })}
            </div>
            <Btn variant="primary" size="lg" full onClick={pay} style={{opacity:busy?0.6:1}}>
              {busy ? <><NAIcon name="progress_activity" size={18} color={NA.yellow} style={{animation:'naSpin 1s linear infinite'}}/>Đang xử lý…</> : <>Thanh toán {vnd(TUITION.outstanding)}</>}
            </Btn>
          </div>
        </div>
      )}
    </Page>
  );
}

Object.assign(window, { NATuition, TUITION });
