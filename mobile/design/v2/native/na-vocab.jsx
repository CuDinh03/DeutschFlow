// na-vocab.jsx — Từ vựng (list) + Ôn tập SRS (flashcard)
// Exports: NAVocab, NASRS

const ART = { der:NA.blue, die:NA.red, das:NA.green };
// nguồn: GET /api/vocabulary/words → List<WordDto>  (+ /api/words/coverage; learn: POST /api/vocabulary/words/{id}/learn)
//   words[].state ánh xạ SRS: due(bool) ~ tới hạn ôn; decks ~ coverage theo chủ đề
const VOCAB = {
  dueToday:12, learning:34, mastered:218,
  decks:[
    { name:'Krankenhaus & Pflege', sub:'Bệnh viện · Điều dưỡng', due:8, total:60, learned:42, color:NA.teal },
    { name:'Körper & Gesundheit', sub:'Cơ thể · Sức khỏe', due:4, total:48, learned:48, color:NA.green },
    { name:'Bewerbung & Beruf', sub:'Xin việc · Nghề nghiệp', due:0, total:40, learned:21, color:NA.violet },
    { name:'Alltag', sub:'Đời sống hằng ngày', due:0, total:80, learned:80, color:NA.gold },
  ],
  words:[
    { art:'die', de:'Pflegekraft', vi:'nhân viên điều dưỡng', pl:'die Pflegekräfte', ex:'Sie arbeitet als Pflegekraft im Altenheim.', exvi:'Cô ấy làm điều dưỡng trong viện dưỡng lão.', due:true },
    { art:'der', de:'Schichtdienst', vi:'làm việc theo ca', pl:'die Schichtdienste', ex:'Der Schichtdienst beginnt um sechs Uhr.', exvi:'Ca làm bắt đầu lúc 6 giờ.', due:true },
    { art:'das', de:'Krankenhaus', vi:'bệnh viện', pl:'die Krankenhäuser', ex:'Das Krankenhaus liegt im Zentrum.', exvi:'Bệnh viện nằm ở trung tâm.', due:true },
    { art:'die', de:'Spritze', vi:'mũi tiêm', pl:'die Spritzen', ex:'Die Krankenschwester gibt eine Spritze.', exvi:'Y tá tiêm một mũi.', due:false },
    { art:'der', de:'Patient', vi:'bệnh nhân', pl:'die Patienten', ex:'Der Patient braucht Ruhe.', exvi:'Bệnh nhân cần nghỉ ngơi.', due:false },
  ],
};

function NAVocab({ onNav, state='default' }){
  return (
    <Page title="Từ vựng" dateCap="Wortschatz · Spaced repetition">
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* due hero */}
        <Card pad={0} style={{background:NA.ink}}>
          <div style={{padding:'20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <Cap color={NA.yellow} style={{marginBottom:8}}>Đến hạn ôn hôm nay</Cap>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <span style={{...NA.srf,fontSize:40,fontWeight:500,color:NA.bg,lineHeight:1}}>{VOCAB.dueToday}</span>
                  <span style={{fontSize:14,color:'#A39E94'}}>thẻ</span>
                </div>
              </div>
              <NAIcon name="repeat" size={30} color="#76716A"/>
            </div>
            <Btn variant="yellow" full onClick={()=>onNav('srs')}><YSq size={7} color={NA.ink}/>Ôn {VOCAB.dueToday} từ hôm nay</Btn>
          </div>
          <div style={{display:'flex',borderTop:'1px solid rgba(255,255,255,0.12)'}}>
            {[['learning','Đang học',VOCAB.learning],['mastered','Đã thuộc',VOCAB.mastered]].map(([k,l,v],i)=>(
              <div key={k} style={{flex:1,padding:'13px 18px',borderLeft:i?'1px solid rgba(255,255,255,0.12)':'none'}}>
                <div style={{...NA.srf,fontSize:19,fontWeight:500,color:NA.bg}}>{v}</div>
                <div style={{fontSize:11,color:'#A39E94',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* quick actions */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <button onClick={()=>onNav('vocab-cards')} className="na-press" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:'15px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',background:NA.card,border:`1px solid ${NA.border}`,textAlign:'left'}}>
            <div style={{width:36,height:36,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.teal,'subtle'),display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="style" size={20} color={NA.teal}/></div>
            <div><div style={{fontWeight:700,fontSize:13.5}}>Học thẻ (vuốt)</div><div style={{fontSize:11.5,color:NA.muted,marginTop:2}}>Vuốt biết / chưa biết</div></div>
          </button>
          <button onClick={()=>onNav('vocab-stats')} className="na-press" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:'15px 16px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',background:NA.card,border:`1px solid ${NA.border}`,textAlign:'left'}}>
            <div style={{width:36,height:36,borderRadius:'var(--na-radius,4px)',background:naSoft(NA.violet,'subtle'),display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="insights" size={20} color={NA.violet}/></div>
            <div><div style={{fontWeight:700,fontSize:13.5}}>Thống kê SRS</div><div style={{fontSize:11.5,color:NA.muted,marginTop:2}}>Mức thuộc & lịch ôn</div></div>
          </button>
        </div>

        {/* decks */}
        <div>
          <Cap style={{padding:'0 2px 11px'}}>Bộ từ của bạn</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {VOCAB.decks.map(d=>{
              const pct = Math.round(d.learned/d.total*100), full = d.learned===d.total;
              return (
                <Card key={d.name} accent={d.color} pad={0} onClick={()=>onNav('srs')}>
                  <div style={{padding:'15px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:15,lineHeight:1.2}}>{d.name}</div>
                        <div style={{fontSize:12,color:NA.muted,marginTop:3}}>{d.sub} · {d.learned}/{d.total} từ</div>
                      </div>
                      {d.due>0 ? <Pill tone="yellow" solid>{d.due} đến hạn</Pill> : full ? <NAIcon name="verified" size={22} fill color={d.color}/> : <NAIcon name="chevron_right" size={20} color={NA.faint}/>}
                    </div>
                    <div style={{marginTop:12}}><ProgressBar pct={pct} color={d.color}/></div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* word preview */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 2px 11px'}}>
            <Cap>Krankenhaus & Pflege</Cap>
            <span style={{font:`600 11px/1 'Instrument Sans'`,color:NA.subtle}}>5 / 60</span>
          </div>
          <Card pad={0}>
            {VOCAB.words.map((w,i)=>(
              <div key={w.de} style={{display:'flex',alignItems:'center',gap:13,padding:'13px 16px',borderBottom:i<VOCAB.words.length-1?`1px solid ${NA.border}`:'none'}}>
                <span style={{...NA.srf,fontSize:13,fontWeight:600,color:ART[w.art],width:30,flexShrink:0}}>{w.art}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:15}}>{w.de}</div>
                  <div style={{fontSize:12.5,color:NA.muted,marginTop:2}}>{w.vi}</div>
                </div>
                {w.due && <span style={{width:7,height:7,borderRadius:'50%',background:NA.yellow,flexShrink:0}} title="Đến hạn"/>}
                <button className="na-press" aria-label="Nghe phát âm" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:'-12px -12px -12px 0',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="volume_up" size={20} color={NA.subtle}/></button>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}

/* ── SRS flashcard review ── */
function NASRS({ onNav, state='default' }){
  const deck = VOCAB.words;
  const [idx,setIdx] = React.useState(0);
  const [flipped,setFlipped] = React.useState(false);
  const [doneCount,setDoneCount] = React.useState(0);
  const total = VOCAB.dueToday;
  const w = deck[idx % deck.length];
  const finished = doneCount>=total;

  function rate(){
    setFlipped(false);
    setDoneCount(c=>c+1);
    setIdx(i=>i+1);
  }

  if (finished){
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,zIndex:5,paddingTop:SAFE_TOP}}>
          <div style={{display:'flex',justifyContent:'flex-end',padding:'6px 16px 10px'}}>
            <button onClick={()=>onNav('vocab')} className="na-press" aria-label="Đóng" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:'-9px -10px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={26} color={NA.ink}/></button>
          </div>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:40,textAlign:'center'}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:NA.green,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,fontWeight:700,animation:'naPop 0.5s ease-out both'}}>✓</div>
          <div style={{...NA.srf,fontSize:26,fontWeight:500}}>Xong rồi, Lan!</div>
          <p style={{margin:0,fontSize:14,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Bạn đã ôn {total} thẻ hôm nay. Quay lại ngày mai để giữ trí nhớ dài hạn nhé.</p>
          <div style={{display:'flex',gap:10,width:'100%',maxWidth:300,marginTop:8}}>
            <Btn variant="ghost" full onClick={()=>onNav('vocab')}>Xong</Btn>
            <Btn variant="primary" full onClick={()=>{setDoneCount(0);setIdx(0);}}>Ôn thêm</Btn>
          </div>
        </div>
      </div>
    );
  }

  const ratings = [ ['Lại',NA.red,'< 1 phút'], ['Khó',NA.orange,'6 phút'], ['Tốt',NA.green,'1 ngày'], ['Dễ',NA.blue,'4 ngày'] ];

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      {/* top */}
      <div style={{paddingTop:SAFE_TOP}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 16px 12px'}}>
          <button onClick={()=>onNav('vocab')} className="na-press" aria-label="Đóng" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:'-10px 0 -10px -10px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1}}><ProgressBar pct={doneCount/total*100} color={NA.yellow} h={6}/></div>
          <span style={{...NA.srf,fontSize:14,fontWeight:500,fontVariantNumeric:'tabular-nums',color:NA.muted}}>{doneCount+1}/{total}</span>
        </div>
      </div>

      {/* card */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'8px 20px'}}>
        <button onClick={()=>setFlipped(f=>!f)} style={{width:'100%',maxWidth:340,minHeight:380,background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'calc(var(--na-radius,4px) + 6px)',cursor:'pointer',padding:'32px 26px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',boxShadow:'0 10px 40px rgba(22,21,19,0.07)',position:'relative'}}>
          <div style={{position:'absolute',top:16,left:0,right:0,textAlign:'center'}}><Cap color={NA.subtle}>{flipped?'Nghĩa tiếng Việt':'Tiếng Đức'}</Cap></div>
          {!flipped ? (
            <>
              <div style={{display:'flex',alignItems:'baseline',gap:9,justifyContent:'center'}}>
                <span style={{...NA.srf,fontSize:20,fontWeight:500,color:ART[w.art]}}>{w.art}</span>
                <span style={{...NA.srf,fontSize:34,fontWeight:500,lineHeight:1.1}}>{w.de}</span>
              </div>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:20,padding:'9px 15px',border:`1px solid ${NA.border}`,borderRadius:99,color:NA.muted,font:`600 12.5px/1 'Instrument Sans'`}}><NAIcon name="volume_up" size={17}/>Nghe phát âm</span>
              <div style={{position:'absolute',bottom:18,left:0,right:0,fontSize:12,color:NA.subtle}}>Chạm để xem nghĩa</div>
            </>
          ) : (
            <>
              <div style={{...NA.srf,fontSize:28,fontWeight:500,lineHeight:1.2}}>{w.vi}</div>
              <div style={{fontSize:13,color:NA.subtle,marginTop:8}}>số nhiều · {w.pl}</div>
              <div style={{marginTop:22,paddingTop:18,borderTop:`1px solid ${NA.border}`,width:'100%'}}>
                <div style={{fontSize:15,lineHeight:1.5,color:NA.ink,fontWeight:500}}>{w.ex}</div>
                <div style={{fontSize:13,color:NA.muted,marginTop:7,fontStyle:'italic',lineHeight:1.45}}>{w.exvi}</div>
              </div>
            </>
          )}
        </button>
      </div>

      {/* ratings */}
      <div style={{padding:`14px 16px ${HOME_IND+12}px`,borderTop:`1px solid ${NA.border}`,background:NA.card}}>
        {flipped ? (
          <div style={{display:'flex',gap:8}}>
            {ratings.map(([l,c,t])=>(
              <button key={l} onClick={rate} className="na-press" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'12px 4px',borderRadius:'var(--na-radius,4px)',cursor:'pointer',background:naSoft(c,'subtle'),border:`1px solid ${naSoft(c,'bold')}`,color:c}}>
                <span style={{font:`700 13.5px/1 'Instrument Sans'`}}>{l}</span>
                <span style={{font:`500 10px/1 'Instrument Sans'`,opacity:0.8}}>{t}</span>
              </button>
            ))}
          </div>
        ) : (
          <Btn variant="primary" size="lg" full onClick={()=>setFlipped(true)}>Xem nghĩa</Btn>
        )}
      </div>
    </div>
  );
}

/* ── Swipe-card practice ── */
function NAVocabCards({ onNav, state='default' }){
  const deck = VOCAB.words;
  const [idx,setIdx] = React.useState(0);
  const [flip,setFlip] = React.useState(false);
  const [know,setKnow] = React.useState(0);
  const [unknow,setUnknow] = React.useState(0);
  const [dx,setDx] = React.useState(0);
  const [dragging,setDragging] = React.useState(false);
  const g = React.useRef({down:false,x0:0}).current;
  const total = deck.length;
  const w = deck[idx];
  const finished = idx>=total;

  function commit(dir){ // dir +1 = biết, -1 = chưa biết
    if(dir>0) setKnow(k=>k+1); else setUnknow(u=>u+1);
    setFlip(false); setDx(0); setIdx(i=>i+1);
  }
  const onDown=e=>{ g.down=true; g.x0=e.clientX; setDragging(true); try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){} };
  const onMove=e=>{ if(!g.down)return; setDx(e.clientX-g.x0); };
  const onUp=e=>{ if(!g.down)return; g.down=false; setDragging(false); const d=e.clientX-g.x0;
    if(Math.abs(d)>110) commit(d>0?1:-1); else setDx(0); };

  if (finished){
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:'40px 28px',textAlign:'center'}}>
          <div style={{width:76,height:76,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,animation:'naPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'}}><NAIcon name="style" size={38} color={NA.green}/></div>
          <h1 style={{margin:0,...NA.srf,fontSize:25,fontWeight:500}}>Xong bộ thẻ!</h1>
          <div style={{display:'flex',gap:12,marginTop:14}}>
            <div style={{padding:'14px 22px',borderRadius:'var(--na-radius,4px)',background:naSoft(NA.green,'subtle'),textAlign:'center'}}><div style={{...NA.srf,fontSize:26,fontWeight:500,color:NA.green}}>{know}</div><div style={{fontSize:11.5,color:NA.muted,marginTop:3}}>Đã biết</div></div>
            <div style={{padding:'14px 22px',borderRadius:'var(--na-radius,4px)',background:naSoft(NA.orange,'subtle'),textAlign:'center'}}><div style={{...NA.srf,fontSize:26,fontWeight:500,color:NA.orange}}>{unknow}</div><div style={{fontSize:11.5,color:NA.muted,marginTop:3}}>Cần ôn</div></div>
          </div>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          <Btn variant="primary" size="lg" full onClick={()=>{setIdx(0);setKnow(0);setUnknow(0);setFlip(false);}}><NAIcon name="refresh" size={18} color={NA.yellow}/>Học lại bộ này</Btn>
          <Btn variant="ghost" full onClick={()=>onNav('vocab')}>Về Từ vựng</Btn>
        </div>
      </div>
    );
  }

  const rot = dx/18, likeOp = Math.max(0,Math.min(1,dx/90)), nopeOp = Math.max(0,Math.min(1,-dx/90));
  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 16px 0`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,height:46}}>
          <button onClick={()=>onNav('vocab')} aria-label="Đóng" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:'-10px 0 -10px -10px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1}}><ProgressBar pct={idx/total*100} color={NA.yellow} h={6}/></div>
          <span style={{...NA.srf,fontSize:14,fontWeight:500,color:NA.muted,fontVariantNumeric:'tabular-nums'}}>{idx+1}/{total}</span>
        </div>
      </div>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'8px 20px',position:'relative'}}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onClick={()=>{ if(Math.abs(dx)<6) setFlip(f=>!f); }}
          style={{width:'100%',maxWidth:340,minHeight:380,background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'calc(var(--na-radius,4px) + 6px)',cursor:'grab',padding:'32px 26px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',boxShadow:'0 10px 40px rgba(22,21,19,0.08)',position:'relative',touchAction:'none',userSelect:'none',
            transform:`translateX(${dx}px) rotate(${rot}deg)`, transition:dragging?'none':'transform 0.3s cubic-bezier(0.32,1.28,0.42,1)'}}>
          {/* badges */}
          <div style={{position:'absolute',top:18,left:18,padding:'5px 11px',border:`2px solid ${NA.green}`,borderRadius:6,color:NA.green,font:`800 13px/1 'Instrument Sans'`,letterSpacing:'0.06em',transform:'rotate(-12deg)',opacity:likeOp}}>BIẾT</div>
          <div style={{position:'absolute',top:18,right:18,padding:'5px 11px',border:`2px solid ${NA.orange}`,borderRadius:6,color:NA.orange,font:`800 13px/1 'Instrument Sans'`,letterSpacing:'0.06em',transform:'rotate(12deg)',opacity:nopeOp}}>CẦN ÔN</div>
          <div style={{position:'absolute',top:16,left:0,right:0,textAlign:'center'}}><Cap color={NA.subtle}>{flip?'Nghĩa tiếng Việt':'Tiếng Đức'}</Cap></div>
          {!flip ? (
            <>
              <div style={{display:'flex',alignItems:'baseline',gap:9,justifyContent:'center'}}>
                <span style={{...NA.srf,fontSize:20,fontWeight:500,color:ART[w.art]}}>{w.art}</span>
                <span style={{...NA.srf,fontSize:34,fontWeight:500,lineHeight:1.1}}>{w.de}</span>
              </div>
              <div style={{position:'absolute',bottom:18,left:0,right:0,fontSize:12,color:NA.subtle}}>Chạm để xem nghĩa · vuốt để đánh giá</div>
            </>
          ) : (
            <>
              <div style={{...NA.srf,fontSize:28,fontWeight:500,lineHeight:1.2}}>{w.vi}</div>
              <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${NA.border}`,width:'100%'}}>
                <div style={{fontSize:15,lineHeight:1.5,color:NA.ink,fontWeight:500}}>{w.ex}</div>
                <div style={{fontSize:13,color:NA.muted,marginTop:6,fontStyle:'italic'}}>{w.exvi}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{flexShrink:0,padding:`14px 28px ${HOME_IND+12}px`,display:'flex',gap:16,justifyContent:'center'}}>
        <button onClick={()=>commit(-1)} aria-label="Chưa biết" className="na-press" style={{width:62,height:62,borderRadius:'50%',background:NA.card,border:`2px solid ${naSoft(NA.orange,'bold')}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="replay" size={26} color={NA.orange}/></button>
        <button onClick={()=>setFlip(f=>!f)} aria-label="Lật thẻ" className="na-press" style={{width:62,height:62,borderRadius:'50%',background:NA.card,border:`2px solid ${NA.border}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="autorenew" size={24} color={NA.muted}/></button>
        <button onClick={()=>commit(1)} aria-label="Đã biết" className="na-press" style={{width:62,height:62,borderRadius:'50%',background:NA.green,border:`2px solid ${NA.green}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="check" size={28} color="#fff"/></button>
      </div>
    </div>
  );
}

/* ── SRS stats ── */
function NAVocabStats({ onNav, state='default' }){
  if (state==='empty'){
    return (
      <Page title="Thống kê SRS" dateCap="Spaced repetition" back="Từ vựng" onBack={()=>onNav('vocab')} hasTab={false}>
        <div style={{padding:'48px 28px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <NAIcon name="bar_chart" size={44} color={NA.subtle}/>
          <div style={{...NA.srf,fontSize:21,fontWeight:500}}>Chưa đủ dữ liệu</div>
          <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.5,maxWidth:260}}>Học vài bộ thẻ để xem thống kê mức độ thuộc và lịch ôn nhé.</p>
          <Btn variant="ghost" onClick={()=>onNav('vocab-cards')}>Học thẻ ngay</Btn>
        </div>
      </Page>
    );
  }
  const levels = [
    { l:'Mới', n:18, c:NA.subtle },
    { l:'Đang học', n:34, c:NA.orange },
    { l:'Gần thuộc', n:46, c:NA.gold },
    { l:'Thành thạo', n:218, c:NA.green },
  ];
  const max = Math.max(...levels.map(x=>x.n));
  const totalW = levels.reduce((s,x)=>s+x.n,0);
  const sched = [ ['Hôm nay',12],['Ngày mai',9],['Th 4',7],['Th 5',15],['Th 6',4],['Th 7',0],['CN',6] ];
  const maxS = Math.max(...sched.map(s=>s[1]),1);
  return (
    <Page title="Thống kê SRS" dateCap={`${totalW} thẻ · spaced repetition`} back="Từ vựng" onBack={()=>onNav('vocab')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card>
          <Cap style={{marginBottom:15}}>Phân bố theo mức độ thuộc</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {levels.map(lv=>(
              <div key={lv.l}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13.5,fontWeight:600}}>{lv.l}</span>
                  <span style={{...NA.srf,fontSize:15,fontWeight:500,color:lv.c}}>{lv.n}</span>
                </div>
                <div style={{height:8,background:NA.border,borderRadius:8,overflow:'hidden'}}><div style={{width:`${lv.n/max*100}%`,height:'100%',background:lv.c,transition:'width 0.5s ease'}}/></div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Cap style={{marginBottom:16}}>Lịch ôn 7 ngày tới</Cap>
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:120}}>
            {sched.map(([d,n],i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:7,height:'100%',justifyContent:'flex-end'}}>
                <span style={{fontSize:11,fontWeight:700,color:n>0?NA.ink:NA.faint}}>{n||''}</span>
                <div style={{width:'100%',height:`${n/maxS*100}%`,minHeight:n>0?6:2,background:i===0?NA.yellow:n>0?naSoft(NA.gold,'bold'):NA.border,borderRadius:4,transition:'height 0.5s ease'}}/>
                <span style={{fontSize:10,color:i===0?NA.ink:NA.subtle,fontWeight:i===0?700:500}}>{d}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{display:'flex',alignItems:'center',gap:13}}>
          <div style={{width:42,height:42,borderRadius:'50%',background:naSoft(NA.green,'bold'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><NAIcon name="trending_up" size={22} color={NA.green}/></div>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>Tỷ lệ nhớ 92%</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Trong 7 ngày qua · trên mức trung bình.</div></div>
        </Card>

        <Btn variant="primary" size="lg" full onClick={()=>onNav('srs')}><YSq size={7} color={NA.yellow}/>Ôn {VOCAB.dueToday} thẻ đến hạn</Btn>
      </div>
    </Page>
  );
}

Object.assign(window, { NAVocab, NASRS, NAVocabCards, NAVocabStats, VOCAB });
