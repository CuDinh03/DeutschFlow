// na-theme.jsx — Galerie design language, adapted for native iOS (DeutschFlow · Student)
// Warm-paper, Newsreader large-titles, hairline borders, sharp corners, yellow-square motif.
// Exports: NA, NACtx, useAcc, naSoft, NAIcon, YSq, Cap, Page, TabBar, Card, Btn, Pill,
//          ProgressBar, ProgressRing, Phone, Stage, SAFE_TOP, TAB_H

;(function injectNativeCSS(){
  if (document.getElementById('na-base')) return;
  const s = document.createElement('style');
  s.id = 'na-base';
  s.textContent = `
    @keyframes naFade { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
    @keyframes naPop  { 0%{transform:scale(0.6);} 60%{transform:scale(1.12);} 100%{transform:scale(1);} }
    @keyframes naWave { 0%,100%{transform:scaleY(0.28);} 50%{transform:scaleY(1);} }
    @keyframes naPulse{ 0%,100%{opacity:1;} 50%{opacity:0.35;} }
    @keyframes naSpin { to{transform:rotate(360deg);} }
    @keyframes naRise { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }
    @keyframes naDot  { 0%,80%,100%{opacity:0.25;transform:translateY(0);} 40%{opacity:1;transform:translateY(-3px);} }
    @keyframes naShimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
    @keyframes naScrPush { from{opacity:0;transform:translateX(26px);} to{opacity:1;transform:translateX(0);} }
    @keyframes naScrPop  { from{opacity:0;transform:translateX(-26px);} to{opacity:1;transform:translateX(0);} }
    @keyframes naScrFade { from{opacity:0;transform:scale(0.992);} to{opacity:1;transform:scale(1);} }
    @keyframes naSheetUp { from{transform:translateY(100%);} to{transform:translateY(0);} }
    @keyframes naLogoSpin { from{transform:rotate(-200deg) scale(0.45);opacity:0;} 70%{opacity:1;} to{transform:rotate(0deg) scale(1);opacity:1;} }
    @keyframes naLogoDraw { from{stroke-dashoffset:230;} to{stroke-dashoffset:0;} }
    @keyframes naLogoPop { 0%{transform:scale(0);} 60%{transform:scale(1.18);} 100%{transform:scale(1);} }
    .na-logo-spin { animation: naLogoSpin 0.95s cubic-bezier(0.34,1.4,0.5,1) both; }
    .na-logo-draw { stroke-dasharray:230; animation: naLogoDraw 1.05s ease both; }
    .na-logo-pop { transform-box: fill-box; transform-origin: center; animation: naLogoPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
    @keyframes naBloom { 0%,100%{transform:scale(1);opacity:0.18;} 50%{transform:scale(1.3);opacity:0.05;} }
    @keyframes naTreeSpin { to{transform:rotate(360deg);} }
    @keyframes naLeafIn { from{opacity:0;} to{opacity:1;} }
    @keyframes naGrow { from{opacity:0;} to{opacity:1;} }
    @keyframes naFlash { 0%{opacity:0;} 28%{opacity:1;} 100%{opacity:0;} }
    .na-push { animation: naScrPush 0.36s cubic-bezier(0.32,0.72,0,1) both; }
    .na-pop  { animation: naScrPop  0.36s cubic-bezier(0.32,0.72,0,1) both; }
    .na-fade { animation: naScrFade 0.28s ease-out both; }
    @media (prefers-reduced-motion: reduce){ .na-push,.na-pop,.na-fade{animation:none;} }
    .na-enter { animation: naFade 0.26s ease-out both; }
    .na-scroll { -webkit-overflow-scrolling:touch; scrollbar-width:none; }
    .na-scroll::-webkit-scrollbar { display:none; width:0; }
    .na-press { transition: transform 0.12s ease, opacity 0.12s ease; cursor:pointer; }
    .na-press:active { transform: scale(0.97); opacity:0.9; }
    .na-tap { cursor:pointer; transition: background 0.12s ease; }
    .na-headerglass {
      background: linear-gradient(180deg, rgba(251,250,247,0.82) 0%, rgba(251,250,247,0.66) 100%);
      -webkit-backdrop-filter: blur(20px) saturate(180%) brightness(1.03);
      backdrop-filter: blur(20px) saturate(180%) brightness(1.03);
      box-shadow: inset 0 -0.5px 0 rgba(22,21,19,0.10), 0 1px 12px rgba(22,21,19,0.05);
    }
    * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    @media (prefers-reduced-motion: reduce){
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* ── Liquid Glass tab bar (iOS 26) ── */
    .na-glassbar {
      position: relative;
      background: linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.24) 100%);
      -webkit-backdrop-filter: blur(26px) saturate(185%) brightness(1.07);
      backdrop-filter: blur(26px) saturate(185%) brightness(1.07);
      box-shadow:
        0 12px 34px rgba(22,21,19,0.18),
        0 3px 9px rgba(22,21,19,0.10),
        inset 0 1px 0.5px rgba(255,255,255,0.95),
        inset 0 0 0 0.5px rgba(255,255,255,0.40),
        inset 0 -10px 18px rgba(255,255,255,0.16);
    }
    .na-glassbar::before {
      content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
      background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 42%);
    }
    .na-lens {
      background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.72) 100%);
      box-shadow:
        0 6px 16px rgba(22,21,19,0.18),
        0 1px 3px rgba(22,21,19,0.12),
        inset 0 1.5px 0 rgba(255,255,255,1),
        inset 0 0 0 1px rgba(255,255,255,0.95),
        inset 0 -6px 12px rgba(199,154,0,0.06);
      transition: transform 0.62s cubic-bezier(0.32,1.28,0.42,1);
    }
    .na-lens::after {
      content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
      background: radial-gradient(125% 95% at 50% -8%, rgba(255,255,255,0.85), rgba(255,255,255,0) 62%);
    }
    .na-tabitem { transition: transform 0.42s cubic-bezier(0.32,1.28,0.42,1); }
    .na-tabitem[data-on="true"] { transform: translateY(-2px) scale(1.06); }
    @keyframes naLensLand { 0%{transform:scale(0.92);} 55%{transform:scale(1.05);} 100%{transform:scale(1);} }
  `;
  document.head.appendChild(s);
})();

const NA = {
  bg:'#FBFAF7', paper:'#F6F3EC', card:'#FFFFFF', ink:'#161513',
  muted:'#76716A', subtle:'#B3ADA5', faint:'#C9C4BC',
  border:'#E7E3DA', hair:'#EDEAE2', line:'#161513',
  yellow:'#FFCD00', gold:'#C79A00',
  red:'#DA291C', green:'#1E9E61', blue:'#2F6FC9', violet:'#7C56C8',
  teal:'#11888A', orange:'#E07B39',
  srf:{ fontFamily:"var(--na-display,'Newsreader',Georgia,serif)" },
  ui :{ fontFamily:"'Instrument Sans',system-ui,sans-serif" },
};

const SAFE_TOP = 54;   // status bar / island clearance
const TAB_H    = 58;   // tab bar body height
const HOME_IND = 26;   // home-indicator clearance

const NACtx = React.createContext({ accent:'balanced', plan:'free' });
function useAcc(){ return React.useContext(NACtx).accent; }
function usePlan(){ return React.useContext(NACtx).plan || 'free'; }

// hex -> rgba with accent-intensity-driven alpha
function hexRGB(hex){
  const h = hex.replace('#',''); const x = h.length===3 ? h.replace(/./g,c=>c+c) : h;
  const n = parseInt(x,16); return [(n>>16)&255,(n>>8)&255,n&255];
}
function naSoft(hex, level='balanced'){
  const a = level==='subtle'?0.09 : level==='bold'?0.22 : 0.14;
  const [r,g,b] = hexRGB(hex); return `rgba(${r},${g},${b},${a})`;
}

/* ── Material Symbols ── */
function NAIcon({ name, size=22, weight=300, fill=false, color='currentColor', style={} }){
  return (
    <span className="material-symbols-outlined" aria-hidden="true" style={{
      fontSize:size, color, lineHeight:1, flexShrink:0,
      fontVariationSettings:`'FILL' ${fill?1:0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.max(20,Math.min(48,size))}`,
      ...style,
    }}>{name}</span>
  );
}

/* ── Yellow square motif ── */
function YSq({ size=7, color=NA.yellow, style={} }){
  return <span style={{width:size,height:size,background:color,display:'inline-block',flexShrink:0,...style}} />;
}

/* ── Editorial caption / overline ── */
function Cap({ children, color=NA.muted, style={} }){
  return <div style={{font:`600 10.5px/1.3 'Instrument Sans',sans-serif`,letterSpacing:'0.16em',textTransform:'uppercase',color,...style}}>{children}</div>;
}

/* ── Brand mark ── */
function NAMark({ size=24, color=NA.ink }){
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{display:'block',flexShrink:0}}>
      <path d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z" stroke={color} strokeWidth="6" strokeLinejoin="miter" fill="none" />
      <polygon points="52,38 74,50 52,62" fill="#DA291C" />
      <rect x="24" y="45" width="9" height="9" fill="#FFCD00" />
    </svg>
  );
}

/* ── Buttons ── */
function Btn({ children, onClick, variant='primary', size='reg', full=false, style={} }){
  const pad = size==='sm' ? '11px 16px' : size==='lg' ? '17px 22px' : '14px 20px';
  const fs  = size==='sm' ? 14 : 15.5;
  const base = { display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,
    border:'none',borderRadius:'var(--na-radius,4px)',font:`700 ${fs}px/1 'Instrument Sans',sans-serif`,
    padding:pad, width:full?'100%':'auto', whiteSpace:'nowrap' };
  const v = {
    primary:{ background:NA.ink, color:NA.bg },
    yellow :{ background:NA.yellow, color:NA.ink },
    ghost  :{ background:'transparent', color:NA.ink, border:`1px solid ${NA.border}` },
    soft   :{ background:NA.paper, color:NA.ink },
    danger :{ background:'transparent', color:NA.red, border:`1px solid ${naSoft(NA.red,'bold')}` },
  };
  return <button onClick={onClick} className="na-press" style={{...base,...v[variant],...style}}>{children}</button>;
}

/* ── Card ── */
function Card({ children, pad=18, onClick, style={}, accent }){
  return (
    <div onClick={onClick} className={onClick?'na-press':''} style={{
      background:NA.card, border:`1px solid ${NA.border}`, borderRadius:'var(--na-radius,4px)',
      padding:pad, position:'relative', overflow:'hidden',
      ...(accent?{borderLeft:`3px solid ${accent}`}:{}), ...style,
    }}>{children}</div>
  );
}

/* ── Pill / tag ── */
function Pill({ children, tone='muted', solid=false, style={} }){
  const acc = useAcc();
  const map = { muted:NA.muted, yellow:NA.gold, green:NA.green, red:NA.red, blue:NA.blue, violet:NA.violet, orange:NA.orange, teal:NA.teal, ink:NA.ink };
  const c = map[tone]||NA.muted;
  const base = { display:'inline-flex',alignItems:'center',gap:6,font:`600 10px/1 'Instrument Sans',sans-serif`,
    letterSpacing:'0.09em',textTransform:'uppercase',padding:'6px 9px',borderRadius:'var(--na-radius,4px)',whiteSpace:'nowrap' };
  return <span style={{...base, ...(solid?{background:c,color:tone==='yellow'?NA.ink:'#fff'}:{background:naSoft(c,acc),color:c}), ...style}}>{children}</span>;
}

/* ── Progress bar ── */
function ProgressBar({ pct, color=NA.yellow, h=4, track=NA.border }){
  return <div style={{height:h,background:track,borderRadius:h,overflow:'hidden'}}><div style={{width:`${Math.max(0,Math.min(100,pct))}%`,height:'100%',background:color,transition:'width 0.4s ease'}} /></div>;
}

/* ── Progress ring ── */
function ProgressRing({ pct, size=54, stroke=5, color=NA.yellow, track=NA.border, children }){
  const r = (size-stroke)/2, c = 2*Math.PI*r, off = c*(1-Math.max(0,Math.min(100,pct))/100);
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="butt" style={{transition:'stroke-dashoffset 0.5s ease'}} />
      </svg>
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{children}</div>
    </div>
  );
}

/* ── Page scaffold: fixed top bar (condenses on scroll) + large serif title + scroll body ── */
function Page({ title, dateCap, back, onBack, right, children, hasTab=true, bg=NA.bg, scrollRef }){
  const [scrolled, setScrolled] = React.useState(false);
  const innerRef = scrollRef || React.useRef(null);
  const actionRow = !!(back || right);
  const topH = SAFE_TOP + (actionRow ? 46 : 10);
  // floating glass tab bar sits at bottom:HOME_IND, height TAB_H → clear its top + breathing room
  const botPad = hasTab ? (TAB_H + HOME_IND + 30) : (HOME_IND + 18);
  return (
    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:bg,overflow:'hidden'}}>
      {/* fixed top bar */}
      <div className={scrolled ? 'na-headerglass' : ''} style={{position:'absolute',top:0,left:0,right:0,zIndex:8,height:topH,
        background: scrolled ? undefined : bg,
        transition:'background 0.25s ease' }}>
        {actionRow && (
          <div style={{position:'absolute',left:0,right:0,bottom:8,height:38,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px'}}>
            {back ? (
              <button onClick={onBack} className="na-press" style={{display:'inline-flex',alignItems:'center',gap:3,background:'none',border:'none',padding:'11px 10px 11px 0',margin:'-11px 0',color:NA.ink,font:`600 15px/1 'Instrument Sans'`,cursor:'pointer'}}>
                <NAIcon name="chevron_left" size={26} weight={400} /> <span style={{marginLeft:-3}}>{back===true?'':back}</span>
              </button>
            ) : <span />}
            {right || <span />}
          </div>
        )}
        {/* condensed title */}
        <div style={{position:'absolute',left:0,right:0,bottom: actionRow?12:8,textAlign:'center',
          opacity:scrolled?1:0, transform:scrolled?'translateY(0)':'translateY(6px)', transition:'all 0.2s', pointerEvents:'none'}}>
          <span style={{...NA.srf,fontSize:17,fontWeight:600,color:NA.ink}}>{title}</span>
        </div>
      </div>

      {/* scroll body */}
      <div ref={innerRef} className="na-scroll" onScroll={e=>{ const s=e.target.scrollTop>26; setScrolled(p=>p===s?p:s); }}
        style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflowY:'auto',overflowX:'hidden',paddingTop:topH+6,paddingBottom:botPad}}>
        {(title || dateCap) && (
          <div style={{padding:'0 20px 14px'}}>
            {dateCap && <Cap style={{marginBottom:8}}>{dateCap}</Cap>}
            {title && <h1 style={{margin:0,...NA.srf,fontSize:32,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.12,textWrap:'balance'}}>{title}</h1>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Bottom tab bar — iOS 26 Liquid Glass: floating capsule, sliding glass lens, drag-to-scrub ── */
function TabBar({ tabs, active, onChange }){
  const N = tabs.length;
  const idx = Math.max(0, tabs.findIndex(t=>t.id===active));
  const CAP_H = TAB_H;                 // height of glass capsule body
  const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));

  const trackRef = React.useRef(null);
  const g = React.useRef({down:false,moved:false,startX:0}).current;
  const [dragK, setDragK] = React.useState(null);   // null = not dragging; else fractional lens position 0..N-1
  const dragging = dragK !== null;

  const fracOf = e => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  };
  const kFromFrac = f => clamp(f * N - 0.5, 0, N - 1);

  const onDown = e => {
    g.down = true; g.moved = false; g.startX = e.clientX;
    try { trackRef.current.setPointerCapture(e.pointerId); } catch(_){}
  };
  const onMove = e => {
    if (!g.down) return;
    if (!g.moved && Math.abs(e.clientX - g.startX) < 5) return;
    g.moved = true;
    setDragK(kFromFrac(fracOf(e)));
  };
  const onUp = e => {
    if (!g.down) return;
    g.down = false;
    // commit on release for BOTH tap and drag: pick the tab under the finger
    const i = clamp(Math.round(kFromFrac(fracOf(e))), 0, N - 1);
    setDragK(null);
    if (tabs[i].id !== active) onChange(tabs[i].id);
  };

  const lensK = dragging ? dragK : idx;
  const visualIdx = dragging ? Math.round(lensK) : idx;

  return (
    <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:30,
      paddingBottom:HOME_IND, paddingLeft:12, paddingRight:12, pointerEvents:'none'}}>
      <div className="na-glassbar" style={{position:'relative', height:CAP_H, borderRadius:CAP_H/2, pointerEvents:'auto', overflow:'hidden'}}>
        {/* sliding glass lens — follows finger while dragging, springs on release */}
        <div className="na-lens" style={{position:'absolute', top:5, bottom:5, left:5,
          width:`calc((100% - 10px) / ${N})`, borderRadius:(CAP_H-10)/2,
          transform:`translateX(${lensK*100}%)`,
          transition: dragging ? 'transform 0s' : undefined}} />
        <div ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{position:'relative', display:'flex', height:'100%', touchAction:'none'}}>
          {tabs.map((tb,i)=>{
            const on = i===visualIdx;
            return (
              <button key={tb.id} onClick={()=>{ if(!g.moved) onChange(tb.id); }} className="na-press" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,background:'none',border:'none',cursor:'pointer',position:'relative'}}>
                <div className="na-tabitem" data-on={on} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,pointerEvents:'none'}}>
                  <NAIcon name={tb.icon} size={23} fill={on} weight={on?500:300} color={on?NA.yellow:NA.muted} style={{transition:'color 0.32s'}} />
                  <span style={{font:`${on?700:500} 10px/1 'Instrument Sans',sans-serif`,letterSpacing:'0.01em',color:on?NA.ink:NA.muted,transition:'color 0.32s'}}>{tb.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Phone frame (reuses IOSStatusBar from ios-frame.jsx) ── */
function Phone({ children }){
  return (
    <div style={{width:402,height:874,borderRadius:52,overflow:'hidden',position:'relative',background:NA.bg,
      boxShadow:'0 50px 90px rgba(22,21,19,0.22), 0 0 0 1px rgba(22,21,19,0.10)',
      fontFamily:"'Instrument Sans',system-ui,sans-serif", color:NA.ink, WebkitFontSmoothing:'antialiased'}}>
      {/* dynamic island */}
      <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',width:120,height:35,borderRadius:24,background:'#000',zIndex:50}} />
      {/* status bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:40,pointerEvents:'none'}}>
        <IOSStatusBar dark={false} />
      </div>
      {/* content */}
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0}}>{children}</div>
      {/* home indicator */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:60,height:26,display:'flex',justifyContent:'center',alignItems:'flex-end',paddingBottom:8,pointerEvents:'none'}}>
        <div style={{width:134,height:5,borderRadius:100,background:'rgba(22,21,19,0.28)'}} />
      </div>
    </div>
  );
}

/* ── Stage: center + scale phone to fit viewport ── */
function Stage({ children }){
  const [scale, setScale] = React.useState(1);
  React.useEffect(()=>{
    const fit = ()=>{ const s = Math.min(1, (window.innerHeight-48)/874, (window.innerWidth-32)/402); setScale(s>0?s:1); };
    fit(); window.addEventListener('resize', fit); return ()=>window.removeEventListener('resize', fit);
  },[]);
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#E7E2D8',overflow:'hidden'}}>
      <div style={{transform:`scale(${scale})`,transformOrigin:'center center'}}>{children}</div>
    </div>
  );
}

Object.assign(window, { NA, SAFE_TOP, TAB_H, HOME_IND, NACtx, useAcc, usePlan, naSoft, hexRGB, NAIcon, YSq, Cap, NAMark, Btn, Card, Pill, ProgressBar, ProgressRing, Page, TabBar, Phone, Stage });
