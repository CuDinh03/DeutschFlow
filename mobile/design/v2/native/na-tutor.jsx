// na-tutor.jsx — Gia sư 1:1 · Đặt lịch (n43). Exports: NABookSession
// nguồn: GET /api/tutors ; POST /api/tutoring/bookings

const TUTORS = [
  { id:'t1', name:'Thầy Nguyễn T. Trung', spec:'Pflege · Sprechen B1–B2', rating:4.9, reviews:128, price:'250.000đ', per:'45 phút', hue:'#7C56C8', online:true },
  { id:'t2', name:'Cô Trần Mai Anh', spec:'Ngữ pháp · Schreiben', rating:4.8, reviews:96, price:'220.000đ', per:'45 phút', hue:'#2F6FC9' },
  { id:'t3', name:'Frau Petra Klein', spec:'Bản ngữ · Phát âm', rating:5.0, reviews:64, price:'380.000đ', per:'45 phút', hue:'#1E9E61', native:true },
];
const DAYS = [
  { k:'mon', d:'T2', n:'16', slots:['08:00','19:00','20:00'] },
  { k:'tue', d:'T3', n:'17', slots:[] },
  { k:'wed', d:'T4', n:'18', slots:['09:00','14:00','19:00','20:00'] },
  { k:'thu', d:'T5', n:'19', slots:['19:00'] },
  { k:'fri', d:'T6', n:'20', slots:['08:00','09:00','20:00'] },
  { k:'sat', d:'T7', n:'21', slots:['10:00','14:00','15:00'] },
];

function NABookSession({ onNav, state='default' }){
  const [tutor,setTutor] = React.useState('t1');
  const [day,setDay] = React.useState('mon');
  const [slot,setSlot] = React.useState(null);
  const [busy,setBusy] = React.useState(false);
  const t = TUTORS.find(x=>x.id===tutor);
  const dObj = DAYS.find(d=>d.k===day);
  const empty = state==='empty';
  const slots = empty ? [] : dObj.slots;
  React.useEffect(()=>{ setSlot(null); },[tutor,day]);

  function confirm(){
    if(!slot||busy) return; setBusy(true);
    setTimeout(()=>{ setBusy(false); window.gaToast&&window.gaToast(`Đã gửi yêu cầu · ${t.name.split(' ').slice(-1)} sẽ xác nhận`); onNav('home'); }, 900);
  }

  return (
    <Page title="Gia sư 1:1" dateCap="Đặt buổi học riêng" back="Hôm nay" onBack={()=>onNav('home')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:18}}>

        {/* tutors */}
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Chọn gia sư</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {TUTORS.map(x=>{
              const on = tutor===x.id;
              return (
                <button key={x.id} onClick={()=>setTutor(x.id)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,padding:'14px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',textAlign:'left',background:on?naSoft(NA.yellow,'subtle'):NA.card,border:`${on?2:1}px solid ${on?NA.gold:NA.border}`}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <div style={{width:48,height:48,borderRadius:'50%',background:naSoft(x.hue,'bold'),display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{...NA.srf,fontSize:20,fontWeight:600,color:x.hue}}>{x.name.split(' ').slice(-1)[0][0]}</span></div>
                    {x.online && <span style={{position:'absolute',right:0,bottom:0,width:13,height:13,borderRadius:'50%',background:NA.green,border:`2px solid ${on?'#FBF7EC':NA.card}`}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}><span style={{fontWeight:600,fontSize:14.5}}>{x.name}</span>{x.native&&<Pill tone="green">Bản ngữ</Pill>}</div>
                    <div style={{fontSize:12,color:NA.muted,marginTop:3}}>{x.spec}</div>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginTop:6}}><NAIcon name="star" size={14} fill color={NA.gold}/><span style={{fontSize:12,fontWeight:600}}>{x.rating}</span><span style={{fontSize:11.5,color:NA.subtle}}>· {x.reviews} đánh giá</span></div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}><div style={{...NA.srf,fontSize:16,fontWeight:500}}>{x.price}</div><div style={{fontSize:10.5,color:NA.muted}}>/{x.per}</div></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* day picker */}
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Chọn ngày · tháng 6</Cap>
          <div className="na-scroll" style={{display:'flex',gap:9,overflowX:'auto',margin:'0 -20px',padding:'0 20px'}}>
            {DAYS.map(d=>{
              const on = day===d.k; const none = d.slots.length===0;
              return (
                <button key={d.k} onClick={()=>!none&&setDay(d.k)} className="na-press" style={{flexShrink:0,width:54,padding:'10px 0',borderRadius:'var(--na-radius,4px)',border:`1px solid ${on?NA.ink:NA.border}`,background:on?NA.ink:NA.card,cursor:none?'default':'pointer',opacity:none?0.4:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <span style={{font:`600 10px/1 'Instrument Sans'`,color:on?'#A39E94':NA.muted}}>{d.d}</span>
                  <span style={{...NA.srf,fontSize:19,fontWeight:500,color:on?NA.bg:NA.ink}}>{d.n}</span>
                  <span style={{width:5,height:5,borderRadius:'50%',background:none?'transparent':on?NA.yellow:NA.green}}/>
                </button>
              );
            })}
          </div>
        </div>

        {/* slots */}
        <div>
          <Cap style={{padding:'0 2px 10px'}}>Khung giờ trống</Cap>
          {slots.length===0 ? (
            <Card style={{textAlign:'center',padding:'24px 16px'}}>
              <NAIcon name="event_busy" size={32} color={NA.subtle}/>
              <div style={{...NA.srf,fontSize:16,fontWeight:500,marginTop:10}}>Hết lịch trống ngày này</div>
              <div style={{fontSize:12.5,color:NA.muted,marginTop:5}}>Hãy chọn ngày khác trong tuần.</div>
            </Card>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:9}}>
              {slots.map(s=>{
                const on = slot===s;
                return <button key={s} onClick={()=>setSlot(s)} className="na-press" style={{padding:'13px 0',borderRadius:'var(--na-radius,4px)',border:`${on?2:1}px solid ${on?NA.gold:NA.border}`,background:on?naSoft(NA.yellow,'subtle'):NA.card,color:NA.ink,font:`600 14px/1 'Instrument Sans'`,cursor:'pointer'}}>{s}</button>;
              })}
            </div>
          )}
        </div>

        {/* summary */}
        {slot && (
          <Card pad={0} style={{animation:'naRise 0.3s ease-out both'}}>
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>Tóm tắt đặt lịch</Cap></div>
            {[['Gia sư',t.name],['Thời gian',`${dObj.d} ${dObj.n}/6 · ${slot}`],['Thời lượng',t.per],['Học phí',t.price]].map(([l,v],i)=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',borderBottom:i<3?`1px solid ${NA.border}`:'none'}}>
                <span style={{fontSize:13,color:NA.muted}}>{l}</span><span style={{fontSize:13.5,fontWeight:600,color:l==='Học phí'?NA.gold:NA.ink}}>{v}</span>
              </div>
            ))}
          </Card>
        )}

        <Btn variant="primary" size="lg" full style={{opacity:slot&&!busy?1:0.5}} onClick={confirm}>
          {busy ? <><NAIcon name="progress_activity" size={18} color={NA.yellow} style={{animation:'naSpin 1s linear infinite'}}/>Đang đặt…</> : <><YSq size={7} color={NA.yellow}/>{slot?`Xác nhận · ${t.price}`:'Chọn khung giờ'}</>}
        </Btn>
        <div style={{textAlign:'center',fontSize:11.5,color:NA.subtle,lineHeight:1.5,marginTop:-6}}>Gia sư xác nhận trong 12 giờ · huỷ miễn phí trước 24 giờ</div>
      </div>
    </Page>
  );
}

Object.assign(window, { NABookSession, TUTORS });
