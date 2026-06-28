// na-grammar.jsx — Ngữ pháp: Hub → Bài học → Luyện tập → Kết quả; Ôn tập (review queue)
// Exports: NAGrammar, NAGrammarLesson, NAGrammarPractice, NAGrammarReview, GRAMMAR, openGrammar

const GRAMMAR = {
  levels:[
    { code:'A1', label:'Khởi đầu', topics:[
      { id:'g1', t:'Mạo từ der/die/das', sub:'Bestimmte Artikel', state:'done', pct:100 },
      { id:'g2', t:'Chia động từ hiện tại', sub:'Konjugation Präsens', state:'done', pct:100 },
    ]},
    { code:'A2', label:'Nền tảng', topics:[
      { id:'g3', t:'Thì quá khứ Perfekt', sub:'Perfekt mit haben/sein', state:'done', pct:100 },
      { id:'g4', t:'Động từ tách', sub:'Trennbare Verben', state:'learning', pct:55 },
    ]},
    { code:'B1', label:'Đang học', topics:[
      { id:'g5', t:'Dativ & Akkusativ', sub:'Giới từ và cách', state:'learning', pct:40 },
      { id:'g6', t:'Câu phụ weil / dass', sub:'Nebensätze', state:'new', pct:0 },
      { id:'g7', t:'Konjunktiv II', sub:'Lịch sự & giả định', state:'new', pct:0 },
    ]},
    { code:'B2', label:'Mục tiêu', topics:[
      { id:'g8', t:'Câu bị động Passiv', sub:'Werden + Partizip II', state:'new', pct:0 },
      { id:'g9', t:'Sở hữu cách Genitiv', sub:'Genitiv', state:'new', pct:0 },
    ]},
  ],
};

// lesson + quiz content (focal topic fully built; others share fallback)
const GR_CONTENT = {
  g5:{
    theory:[
      'Trong tiếng Đức, danh từ đổi mạo từ theo "cách" (Kasus). Hai cách quan trọng ở B1 là Akkusativ (tân ngữ trực tiếp) và Dativ (tân ngữ gián tiếp — người nhận).',
      'Nhiều động từ và giới từ "đòi" một cách cố định. Ví dụ: helfen, danken, gehören luôn đi với Dativ; còn sehen, haben, brauchen đi với Akkusativ.',
    ],
    table:{ title:'Mạo từ xác định theo cách', head:['', 'der (m)','die (f)','das (n)','die (pl)'],
      rows:[ ['Nominativ','der','die','das','die'], ['Akkusativ','den','die','das','die'], ['Dativ','dem','der','dem','den'] ] },
    examples:[
      { de:'Ich sehe den Arzt.', vi:'Tôi nhìn thấy bác sĩ. (Akkusativ)' },
      { de:'Ich helfe dem Patienten.', vi:'Tôi giúp bệnh nhân. (Dativ)' },
      { de:'Sie fährt mit der Bahn.', vi:'Cô ấy đi bằng tàu. (mit + Dativ)' },
    ],
    qs:[
      { type:'choice', q:'Ich gebe ___ Mann das Buch.', opts:['der','den','dem'], a:2, ex:'"geben" — người nhận ở Dativ → dem Mann.' },
      { type:'fill', q:'Wir warten auf ___ Bus.', a:'den', ex:'"warten auf" + Akkusativ → den Bus (số ít giống đực).' },
      { type:'choice', q:'Sie fährt mit ___ Auto.', opts:['dem','das','der'], a:0, ex:'"mit" luôn + Dativ → dem Auto (giống trung).' },
      { type:'choice', q:'Ich sehe ___ Hund.', opts:['der','den','dem'], a:1, ex:'"sehen" + Akkusativ → den Hund.' },
      { type:'fill', q:'Das gehört ___ Frau.', a:'der', ex:'"gehören" + Dativ → der Frau (giống cái Dativ = der).' },
    ],
  },
  g4:{
    theory:[
      'Động từ tách (trennbare Verben) gồm một tiền tố tách rời như an-, auf-, ein-, mit-, zu-. Khi chia ở câu chính, tiền tố nhảy xuống cuối câu.',
      'Ví dụ: "anrufen" → Ich rufe dich an. Tiền tố "an" đứng cuối.',
    ],
    table:{ title:'Một số động từ tách thường gặp', head:['Động từ','Nghĩa','Ví dụ'],
      rows:[ ['aufstehen','thức dậy','Ich stehe um 6 auf.'], ['einkaufen','đi mua sắm','Sie kauft am Samstag ein.'], ['mitkommen','đi cùng','Kommst du mit?'] ] },
    examples:[
      { de:'Ich stehe um sechs Uhr auf.', vi:'Tôi thức dậy lúc 6 giờ.' },
      { de:'Er ruft seine Mutter an.', vi:'Anh ấy gọi cho mẹ.' },
    ],
    qs:[
      { type:'fill', q:'Ich ___ um 7 Uhr ___ . (aufstehen)', a:'stehe auf', ex:'aufstehen tách: "stehe ... auf". (Chấp nhận "stehe auf")', hint:'stehe … auf' },
      { type:'choice', q:'Chọn câu đúng:', opts:['Ich anrufe dich.','Ich rufe dich an.','Ich rufe an dich.'], a:1, ex:'Tiền tố "an" xuống cuối → Ich rufe dich an.' },
    ],
  },
};
function grContent(id){
  return GR_CONTENT[id] || {
    theory:['Nội dung lý thuyết cho chủ đề này đang được biên soạn. Bạn vẫn có thể luyện tập với các câu mẫu.'],
    table:null, examples:[{de:'Beispielsatz.',vi:'Câu ví dụ.'}],
    qs:[ {type:'choice',q:'Câu nào đúng ngữ pháp?',opts:['Ich bin Student.','Ich sein Student.'],a:0,ex:'Động từ "sein" chia ngôi ich → bin.'} ],
  };
}

let GR_SEL='g5', GR_MODE='practice';
function openGrammar(onNav,id){ GR_SEL=id; onNav('grammar-lesson'); }
window.naGetGrammar = ()=>{ for(const lv of GRAMMAR.levels){ const t=lv.topics.find(x=>x.id===GR_SEL); if(t) return {...t,lv:lv.code}; } return GRAMMAR.levels[2].topics[0]; };

const GR_STATE = { done:{l:'Hoàn thành',c:NA.green,ic:'check_circle'}, learning:{l:'Đang học',c:NA.gold,ic:'pending'}, new:{l:'Chưa học',c:NA.subtle,ic:'radio_button_unchecked'} };

/* ════════ HUB ════════ */
function NAGrammar({ onNav, state='default' }){
  if (state==='loading'){
    return <Page title="Ngữ pháp" dateCap="Grammatik" back="Lộ trình" onBack={()=>onNav('roadmap')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:14}}>{[0,1,2,3].map(i=>(<div key={i} style={{background:NA.card,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',padding:16}}><Sk w="55%" h={15}/><Sk w="35%" h={11} mt={8}/><Sk h={5} mt={14}/></div>))}</div>
    </Page>;
  }
  const total = GRAMMAR.levels.reduce((n,l)=>n+l.topics.length,0);
  const done = GRAMMAR.levels.reduce((n,l)=>n+l.topics.filter(t=>t.state==='done').length,0);
  return (
    <Page title="Ngữ pháp" dateCap="Grammatik · theo trình độ" back="Lộ trình" onBack={()=>onNav('roadmap')} hasTab={false}
      right={<button onClick={()=>onNav('grammar-review')} className="na-press" aria-label="Ôn tập câu sai" style={{background:'none',border:'none',cursor:'pointer',width:44,height:44,margin:-6,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="history" size={23} color={NA.ink}/></button>}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card style={{display:'flex',alignItems:'center',gap:14}}>
          <ProgressRing pct={done/total*100} size={56} stroke={6} color={NA.gold}><span style={{...NA.srf,fontSize:15,fontWeight:500}}>{done}/{total}</span></ProgressRing>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14.5}}>{done} chủ đề đã xong</div><div style={{fontSize:12.5,color:NA.muted,marginTop:3}}>Ôn lại các điểm ngữ pháp từng sai để nhớ lâu.</div></div>
          <Btn variant="ghost" size="sm" onClick={()=>onNav('grammar-review')}>Ôn tập</Btn>
        </Card>

        {GRAMMAR.levels.map(lv=>(
          <div key={lv.code}>
            <div style={{display:'flex',alignItems:'center',gap:9,padding:'0 2px 10px'}}>
              <span style={{...NA.srf,fontSize:15,fontWeight:600}}>{lv.code}</span>
              <span style={{fontSize:11.5,color:NA.subtle}}>· {lv.label}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:1,background:NA.border,border:`1px solid ${NA.border}`,borderRadius:'var(--na-radius,4px)',overflow:'hidden'}}>
              {lv.topics.map(tp=>{
                const st = GR_STATE[tp.state];
                return (
                  <button key={tp.id} onClick={()=>openGrammar(onNav,tp.id)} className="na-tap" style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',background:NA.card,border:'none',cursor:'pointer',textAlign:'left'}}>
                    <NAIcon name={st.ic} size={21} fill={tp.state==='done'} color={st.c} style={{flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14.5,lineHeight:1.2}}>{tp.t}</div>
                      <div style={{fontSize:12,color:NA.muted,marginTop:2}}>{tp.sub}</div>
                      {tp.state==='learning' && <div style={{marginTop:8}}><ProgressBar pct={tp.pct} color={NA.gold} h={4}/></div>}
                    </div>
                    {tp.state==='done' ? <NAIcon name="chevron_right" size={19} color={NA.faint}/> : <Pill tone={tp.state==='learning'?'yellow':'muted'}>{st.l}</Pill>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ════════ BÀI HỌC ════════ */
function NAGrammarLesson({ onNav, state='default' }){
  const tp = window.naGetGrammar();
  const c = grContent(tp.id);
  return (
    <Page title={tp.t} dateCap={`${tp.lv} · ${tp.sub}`} back="Ngữ pháp" onBack={()=>onNav('grammar')} hasTab={false}>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:16}}>
        <Card>
          <Cap style={{marginBottom:11}}>Lý thuyết</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {c.theory.map((p,i)=>(<p key={i} style={{margin:0,fontSize:14.5,color:NA.ink,lineHeight:1.65}}>{p}</p>))}
          </div>
        </Card>

        {c.table && (
          <Card pad={0}>
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${NA.ink}`}}><Cap>{c.table.title}</Cap></div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr>{c.table.head.map((h,i)=>(<th key={i} style={{textAlign:'left',padding:'10px 12px',background:NA.paper,font:`700 11px/1 'Instrument Sans'`,color:NA.muted,letterSpacing:'0.04em',borderBottom:`1px solid ${NA.border}`,whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
                <tbody>{c.table.rows.map((r,ri)=>(<tr key={ri}>{r.map((cell,ci)=>(<td key={ci} style={{padding:'11px 12px',borderBottom:ri<c.table.rows.length-1?`1px solid ${NA.border}`:'none',fontWeight:ci===0?700:500,color:ci===0?NA.muted:NA.ink,fontFamily:ci===0?undefined:"var(--na-display,'Newsreader',serif)",whiteSpace:'nowrap'}}>{cell}</td>))}</tr>))}</tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          <Cap style={{marginBottom:13}}>Ví dụ song ngữ</Cap>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {c.examples.map((e,i)=>(
              <div key={i} style={{paddingBottom:i<c.examples.length-1?14:0,borderBottom:i<c.examples.length-1?`1px solid ${NA.border}`:'none'}}>
                <div style={{...NA.srf,fontSize:16,fontWeight:500,lineHeight:1.35}}>{e.de}</div>
                <div style={{fontSize:13,color:NA.muted,marginTop:5,fontStyle:'italic'}}>{e.vi}</div>
              </div>
            ))}
          </div>
        </Card>

        <Btn variant="primary" size="lg" full onClick={()=>onNav('grammar-practice')}><YSq size={7} color={NA.yellow}/>Luyện tập {c.qs.length} câu</Btn>
      </div>
    </Page>
  );
}

/* ════════ QUIZ ENGINE (dùng cho luyện tập + ôn tập) ════════ */
function GrammarQuiz({ title, sub, qs, back, onBack, onExitTo, onNav }){
  const [qi,setQi] = React.useState(0);
  const [val,setVal] = React.useState('');
  const [picked,setPicked] = React.useState(null);
  const [checked,setChecked] = React.useState(false);
  const [correct,setCorrect] = React.useState(0);
  const [wrong,setWrong] = React.useState([]);
  const [done,setDone] = React.useState(false);
  const q = qs[qi];
  const isFill = q.type==='fill';
  const ok = isFill ? val.trim().toLowerCase()===q.a.toLowerCase() : picked===q.a;

  function check(){ if(checked) return; if(isFill&&!val.trim()) return; if(!isFill&&picked===null) return;
    setChecked(true); if(ok) setCorrect(c=>c+1); else setWrong(w=>[...w,qi]); }
  function next(){
    if(qi+1<qs.length){ setQi(qi+1); setVal(''); setPicked(null); setChecked(false); }
    else setDone(true);
  }

  if (done){
    const xp = correct*10;
    return (
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
        <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:`${SAFE_TOP+24}px 24px 16px`,textAlign:'center'}}>
          <ProgressRing pct={correct/qs.length*100} size={108} stroke={8} color={correct===qs.length?NA.green:NA.gold}>
            <div style={{textAlign:'center'}}><div style={{...NA.srf,fontSize:30,fontWeight:500,lineHeight:1}}>{correct}<span style={{fontSize:18,color:NA.subtle}}>/{qs.length}</span></div></div>
          </ProgressRing>
          <h1 style={{margin:'22px 0 0',...NA.srf,fontSize:25,fontWeight:500,lineHeight:1.2}}>{correct===qs.length?'Hoàn hảo!':correct>=qs.length*0.6?'Làm tốt lắm!':'Cần luyện thêm'}</h1>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:14,padding:'9px 15px',borderRadius:99,background:naSoft(NA.gold,'subtle'),color:NA.gold,font:`700 13px/1 'Instrument Sans'`}}><NAIcon name="bolt" size={16} fill color={NA.gold}/>+{xp} XP</div>
          {wrong.length>0 && <p style={{margin:'16px auto 0',fontSize:13,color:NA.muted,maxWidth:260,lineHeight:1.5}}>Bạn sai {wrong.length} câu. Ôn lại để nắm chắc hơn nhé.</p>}
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`,display:'flex',flexDirection:'column',gap:10}}>
          {wrong.length>0 && <Btn variant="primary" size="lg" full onClick={()=>{ setQi(0);setVal('');setPicked(null);setChecked(false);setCorrect(0);setDone(false); /* simple restart */ }}><NAIcon name="refresh" size={18} color={NA.yellow}/>Ôn lại câu sai</Btn>}
          <Btn variant={wrong.length>0?'ghost':'primary'} size="lg" full onClick={onExitTo}>{wrong.length>0?'Về chủ đề':<><YSq size={7} color={NA.yellow}/>Về chủ đề</>}</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:NA.bg,display:'flex',flexDirection:'column'}}>
      <div style={{paddingTop:SAFE_TOP,flexShrink:0,padding:`${SAFE_TOP}px 20px 0`}}>
        <div style={{display:'flex',alignItems:'center',gap:12,height:46}}>
          <button onClick={onBack} aria-label="Thoát" className="na-press" style={{background:'none',border:'none',cursor:'pointer',width:40,height:40,margin:'0 -8px 0 -8px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="close" size={24} color={NA.ink}/></button>
          <div style={{flex:1}}><ProgressBar pct={(qi)/qs.length*100} color={NA.yellow} h={6}/></div>
          <span style={{...NA.srf,fontSize:14,fontWeight:500,color:NA.muted,fontVariantNumeric:'tabular-nums'}}>{qi+1}/{qs.length}</span>
        </div>
      </div>

      <div className="na-scroll" style={{flex:1,overflowY:'auto',padding:'22px 24px 16px'}}>
        <Cap style={{marginBottom:12}}>{sub||'Chọn đáp án đúng'}</Cap>
        <div style={{...NA.srf,fontSize:24,fontWeight:500,lineHeight:1.35,letterSpacing:'-0.01em',marginBottom:22}}>{q.q}</div>

        {isFill ? (
          <input value={val} onChange={e=>!checked&&setVal(e.target.value)} placeholder="Nhập đáp án…" autoCapitalize="none"
            style={{width:'100%',border:`2px solid ${checked?(ok?NA.green:NA.red):NA.border}`,borderRadius:'var(--na-radius,4px)',padding:'15px 16px',font:`500 17px/1.2 'Instrument Sans'`,color:NA.ink,background:NA.bg,outline:'none'}}/>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {q.opts.map((o,i)=>{
              const sel = picked===i;
              let bg=NA.card, bd=NA.border, cc=NA.ink;
              if(checked){ if(i===q.a){bg=naSoft(NA.green,'subtle');bd=NA.green;cc=NA.green;} else if(sel){bg=naSoft(NA.red,'subtle');bd=NA.red;cc=NA.red;} }
              else if(sel){ bg=naSoft(NA.yellow,'subtle'); bd=NA.gold; }
              return (
                <button key={i} onClick={()=>!checked&&setPicked(i)} className="na-press" style={{display:'flex',alignItems:'center',gap:13,width:'100%',padding:'16px',borderRadius:'var(--na-radius,4px)',cursor:checked?'default':'pointer',textAlign:'left',background:bg,border:`${(sel||(checked&&i===q.a))?2:1}px solid ${bd}`}}>
                  <span style={{...NA.srf,fontSize:17,fontWeight:500,color:cc,flex:1}}>{o}</span>
                  {checked&&i===q.a&&<NAIcon name="check_circle" size={20} fill color={NA.green}/>}
                  {checked&&sel&&i!==q.a&&<NAIcon name="cancel" size={20} fill color={NA.red}/>}
                </button>
              );
            })}
          </div>
        )}

        {checked && (
          <Card accent={ok?NA.green:NA.orange} style={{marginTop:16,display:'flex',gap:11}}>
            <NAIcon name={ok?'check_circle':'lightbulb'} size={20} fill={ok} color={ok?NA.green:NA.orange} style={{marginTop:1}}/>
            <div><div style={{fontWeight:700,fontSize:13.5,color:ok?NA.green:NA.orange,marginBottom:4}}>{ok?'Chính xác!':`Đáp án: ${isFill?q.a:q.opts[q.a]}`}</div><div style={{fontSize:13,color:NA.ink,lineHeight:1.55}}>{q.ex}</div></div>
          </Card>
        )}
      </div>

      <div style={{flexShrink:0,borderTop:`1px solid ${NA.border}`,background:NA.card,padding:`16px 24px ${HOME_IND+14}px`}}>
        {!checked ? (
          <Btn variant="primary" size="lg" full onClick={check} style={{opacity:(isFill?val.trim():picked!==null)?1:0.5}}>Kiểm tra</Btn>
        ) : (
          <Btn variant="primary" size="lg" full onClick={next}>{qi+1<qs.length?'Câu tiếp theo':'Xem kết quả'}</Btn>
        )}
      </div>
    </div>
  );
}

function NAGrammarPractice({ onNav, state='default' }){
  const tp = window.naGetGrammar();
  const c = grContent(tp.id);
  return <GrammarQuiz qs={c.qs} sub={`${tp.t} · luyện tập`} onBack={()=>onNav('grammar-lesson')} onExitTo={()=>onNav('grammar-lesson')} onNav={onNav}/>;
}

/* ════════ ÔN TẬP (REVIEW QUEUE) ════════ */
const GR_REVIEW = [
  { type:'choice', q:'Ich helfe ___ Kindern.', opts:['die','den','der'], a:1, ex:'"helfen" + Dativ số nhiều → den Kindern.' },
  { type:'fill', q:'Er kommt mit seiner Mutter ___ . (mitkommen)', a:'mit', ex:'Động từ tách mitkommen: "mit" xuống cuối.' },
  { type:'choice', q:'Wir danken ___ Lehrer.', opts:['den','dem','der'], a:1, ex:'"danken" + Dativ → dem Lehrer.' },
];
function NAGrammarReview({ onNav, state='default' }){
  if (state==='empty' || GR_REVIEW.length===0){
    return (
      <Page title="Ôn tập" dateCap="Câu ngữ pháp từng sai" back="Ngữ pháp" onBack={()=>onNav('grammar')} hasTab={false}>
        <div style={{padding:'48px 28px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:naSoft(NA.green,'subtle'),display:'flex',alignItems:'center',justifyContent:'center'}}><NAIcon name="task_alt" size={36} color={NA.green}/></div>
          <div style={{...NA.srf,fontSize:22,fontWeight:500}}>Không có gì cần ôn</div>
          <p style={{margin:0,fontSize:13.5,color:NA.muted,lineHeight:1.55,maxWidth:260}}>Bạn đã nắm chắc các điểm ngữ pháp gần đây. Quay lại sau khi luyện thêm nhé.</p>
          <Btn variant="ghost" onClick={()=>onNav('grammar')}>Về Ngữ pháp</Btn>
        </div>
      </Page>
    );
  }
  return <GrammarQuiz qs={GR_REVIEW} sub="Ôn lại câu từng sai" onBack={()=>onNav('grammar')} onExitTo={()=>onNav('grammar')} onNav={onNav}/>;
}

Object.assign(window, { NAGrammar, NAGrammarLesson, NAGrammarPractice, NAGrammarReview, GrammarQuiz, GRAMMAR, openGrammar });
