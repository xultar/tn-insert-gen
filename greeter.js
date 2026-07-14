'use strict';

// ctx: { year, month, monthCount, colors } merged with the entry's config.
// Each expand(ctx) returns an array of page DOM elements, reusing the engine builders.
// mkFutureLog / mkCalendar already return arrays; the rest return single elements.
//
// CONFIG SCOPE (Plan 2a): expand reads config keys it can consume DIRECTLY from ctx
// (e.g. daily's `timeblock`, notes' `count`). Config keys that the underlying
// builders read from the GLOBAL `opts` (Future Log's `flLayout`, Plain's fill
// pattern) use whatever `opts` currently holds; wiring per-entry config into
// `opts` around each expand() is a Plan 2b responsibility (guided options set opts).
function monthsOf(ctx){
  const list=[];
  for(let i=0;i<(ctx.monthCount||1);i++){
    const idx=ctx.month+i;
    list.push({ year: ctx.year + Math.floor(idx/12), month: ((idx%12)+12)%12 });
  }
  return list;
}

// Shared guided specs: every dated page type offers Undated; Daily also gets
// a page-count input that only shows when Undated is on.
const GR_UNDATED={opt:'undated',label:'Dating',choices:[[false,'Dated'],[true,'Undated']]};
const GR_DAILY_COUNT={opt:'dailyCount',label:'Pages',input:'number',min:1,max:93,showIf:(o)=>!!o.undated};

const PAGE_TYPES = {
  cover:      { label:'Cover',              expand:(c)=>[mkCover(c.year,c.month,c.colors)], guided:[GR_UNDATED] },
  futureLog:  { label:'Future Log',         expand:(c)=>mkFutureLog(c.year,c.month,c.colors), guided:[{opt:'flLayout',label:'Layout',choices:[['stacked','Stacked'],['columns','Column'],['year','Year grid']]},GR_UNDATED] },
  monthly:    { label:'Monthly calendar',   expand:(c)=>monthsOf(c).flatMap(mm=>mkCalendar(mm.year,mm.month,c.colors)), guided:[GR_UNDATED] },
  monthlog:   { label:'Monthly Log',        expand:(c)=>monthsOf(c).flatMap(mm=>mkMonthList(mm.year,mm.month,c.colors)), guided:[GR_UNDATED] },
  habit:      { label:'Circle habit tracker',expand:(c)=>monthsOf(c).map(mm=>mkHabitMap(mm.year,mm.month,c.colors)), guided:[GR_UNDATED] },
  masterlist: { label:'Master Action List', expand:(c)=>monthsOf(c).map(mm=>mkMonthBrainDump(mm.year,mm.month,c.colors)), guided:[GR_UNDATED] },
  reflection: { label:'Reflection',         expand:(c)=>monthsOf(c).map(mm=>mkReflection(mm.year,mm.month,c.colors)), guided:[GR_UNDATED] },
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++){
                   const page=opts.dailyLayout==='timeblock'?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors);
                   if(opts.dailyFacingNotes){ out.push(...facingPair(page, DOW_ABB3[dow(mm.year,mm.month,d)]+' '+d, c.colors)); }
                   else out.push(page);
                 }
                 return out; }),
                 guided:[
                   {opt:'dailyLayout',label:'Layout',choices:[['standard','Standard'],['timeblock','Time-block']]},
                   {opt:'dailyFacingNotes',label:'Facing notes',choices:[[false,'Off'],[true,'On']]},
                   GR_UNDATED, GR_DAILY_COUNT
                 ] },
  plain:      { label:'Plain',              expand:(c)=>[mkPlain(c.year,c.month,c.colors)], guided:[{opt:'fillPattern',label:'Ruling',choices:[['dots','Dotted'],['grid','Squared'],['lines','Ruled'],['hex','Hex'],['empty','Blank']]}] },
  notes:      { label:'Notes',              expand:(c)=>{ const n=c.count||1; const out=[]; for(let i=0;i<n;i++) out.push(mkMonthNotes(c.year,c.month,c.colors)); return out; }, guided:[GR_UNDATED] }
};

let booklet = [];
let greeterSel = { type: 'futureLog' };
let grUid = 0;

function grCtx(){
  return { year: parseInt($('sel-y').value), month: parseInt($('sel-m').value),
           monthCount: Math.max(1, parseInt($('gr-months').value)||1), colors: getColors() };
}

function grInitSize(){
  const sel = $('gr-size');
  sel.innerHTML = '';
  Object.keys(TN_SIZES).forEach(k=>{
    const o=document.createElement('option'); o.value=k;
    o.textContent = TN_SIZES[k].label + ' ('+TN_SIZES[k].w+'×'+TN_SIZES[k].h+')';
    if(k===opts.tnsize) o.selected=true;
    sel.appendChild(o);
  });
}
function grOnSizeChange(){ opts.tnsize=$('gr-size').value; grPreview(); }
function grOnMonthsChange(){ grPreview(); }

// The wall's sel-m/sel-y stay the single source of truth (grCtx reads them);
// the greeter inputs are a mirror synced both ways.
function grSeedDate(){
  $('gr-m').value=$('sel-m').value;
  $('gr-y').value=$('sel-y').value;
}
function grOnDateChange(){
  $('sel-m').value=$('gr-m').value;
  $('sel-y').value=$('gr-y').value;
  saveState(); grPreview();
}

function grToggleTools(){
  const cb=$('gr-tools');
  // if called from the wall's back link, the checkbox is still checked → force off
  if(document.body.classList.contains('show-tools')) cb.checked=false;
  document.body.classList.toggle('show-tools', cb.checked);
  // The greeter and wall share the global `opts`. Reseed whichever panel we're switching
  // TO from `opts` so neither silently reverts the other's choices.
  if(cb.checked){
    applyOptsToUI();                                 // wall inputs ← opts
  }else{
    grInitSize(); grSeedDate(); grRenderGuided(); grPreview();  // greeter ← opts/wall
  }
  // On mobile the wall is a slide-in drawer opened by the hamburger; switching
  // panels (e.g. the wall's "Back to greeter" link) should also close it.
  const cfgEl=document.getElementById('cfg');
  if(cfgEl) cfgEl.classList.remove('open');
  const bd=document.getElementById('menu-backdrop');
  if(bd) bd.style.display='none';
}

function grRenderTypes(){
  const grid=$('gr-types'); grid.innerHTML='';
  Object.keys(PAGE_TYPES).forEach(type=>{
    const b=document.createElement('div');
    b.className='gr-type'+(type===greeterSel.type?' on':'');
    b.textContent=PAGE_TYPES[type].label;
    b.setAttribute('role','button'); b.tabIndex=0;
    b.setAttribute('aria-pressed', type===greeterSel.type?'true':'false');
    b.onclick=()=>{ greeterSel={type}; grRenderTypes(); grRenderGuided(); grPreview();
      // re-render replaces this node; keep keyboard focus on the now-selected tile
      const sel=$('gr-types').querySelector('.gr-type.on'); if(sel) sel.focus();
    };
    grid.appendChild(b);
  });
}

function grRenderGuided(){
  const box=$('gr-guided'); box.innerHTML='';
  const g=(PAGE_TYPES[greeterSel.type]||{}).guided||[];
  g.forEach(spec=>{
    if(spec.showIf && !spec.showIf(opts)) return;
    const lbl=document.createElement('div'); lbl.className='gr-lbl'; lbl.textContent=spec.label; box.appendChild(lbl);
    const row=document.createElement('div'); row.className='gr-opt';
    if(spec.input==='number'){
      const inp=document.createElement('input');
      inp.type='number'; inp.min=spec.min; inp.max=spec.max;
      inp.style.width='56px';
      inp.value=TNCore.clampDailyCount(opts[spec.opt]);
      inp.setAttribute('aria-label',spec.label);
      inp.onchange=()=>{ opts[spec.opt]=TNCore.clampDailyCount(inp.value); inp.value=opts[spec.opt]; grPreview(); };
      row.appendChild(inp);
      box.appendChild(row);
      return;
    }
    spec.choices.forEach(([val,text])=>{
      const chip=document.createElement('div');
      chip.className='gr-chip'+(opts[spec.opt]===val?' on':'');
      chip.textContent=text;
      chip.setAttribute('role','button'); chip.tabIndex=0;
      chip.setAttribute('aria-pressed', opts[spec.opt]===val?'true':'false');
      chip.dataset.opt=spec.opt; chip.dataset.val=String(val);
      chip.onclick=()=>{ opts[spec.opt]=val; grRenderGuided(); grPreview();
        // re-render replaces this node; keep keyboard focus on the chosen chip
        const sel=$('gr-guided').querySelector('.gr-chip[data-opt="'+spec.opt+'"][data-val="'+String(val)+'"]');
        if(sel) sel.focus();
      };
      row.appendChild(chip);
    });
    box.appendChild(row);
  });
}

function grPreview(){
  const ctx=grCtx();
  const pages=PAGE_TYPES[greeterSel.type].expand(Object.assign({}, ctx));
  renderSinglePage(pages);
}

function grGenerate(){
  if(!booklet.length){ grPreview(); if(typeof toast==='function') toast('Add pages to your booklet first, then Generate.'); return; }
  const ctx=grCtx();
  // apply each entry's opts-based guided choices around its expansion, so mixed entries render with their own settings
  const pages=booklet.flatMap(entry=>{
    const g=(PAGE_TYPES[entry.type].guided||[]);
    const saved={}; g.forEach(spec=>{ saved[spec.opt]=opts[spec.opt]; opts[spec.opt]=entry.config[spec.opt]; });
    try{
      return PAGE_TYPES[entry.type].expand(Object.assign({}, ctx, entry.config||{}));
    }finally{
      g.forEach(spec=>{ opts[spec.opt]=saved[spec.opt]; });  // restore even if expand throws
    }
  });
  imposeAndRender(pages);
}

// Renders the booklet, then opens the browser print/PDF dialog. (grGenerate only
// renders — the greeter had a "Generate / Print" button that never printed.)
function grPrint(){
  if(!booklet.length){ grPreview(); if(typeof toast==='function') toast('Add pages to your booklet first, then Print.'); return; }
  grGenerate();
  window.print();
}

function grAdd(){
  const ctx=grCtx();
  const cfg={};
  const type=greeterSel.type;
  // snapshot the opts-based guided choices onto the entry so the label + count reflect them
  const g=(PAGE_TYPES[type].guided||[]);
  g.forEach(spec=>{ cfg[spec.opt]=opts[spec.opt]; });
  const pageCount=PAGE_TYPES[type].expand(Object.assign({}, ctx, cfg)).length;
  const entry={ id:'e'+(++grUid), type, config:cfg, pageCount };
  booklet=TNCore.bookletAdd(booklet, entry);
  grRenderTray(); saveState();
}

function grEntryLabel(entry){
  let l=PAGE_TYPES[entry.type].label;
  const g=(PAGE_TYPES[entry.type].guided||[]);
  const parts=g.map(spec=>{
    if(spec.showIf && !spec.showIf(entry.config)) return null; // hidden option → not in label
    const v=entry.config[spec.opt];
    if(v===false || v==null || v==='') return null;         // skip off/unset (e.g. Facing notes Off)
    if(spec.input==='number') return spec.label+' '+v;      // e.g. "Pages 20"
    const choice=(spec.choices||[]).find(ch=>ch[0]===v);
    return choice?choice[1]:v;                              // display text, fallback to raw value
  }).filter(Boolean);
  if(parts.length) l+=' · '+parts.join(' · ');
  return l;
}

function grRenderTray(){
  const tray=$('gr-tray'); tray.innerHTML='';
  booklet.forEach(entry=>{
    const row=document.createElement('div'); row.className='gr-trow';
    const up=document.createElement('button'); up.textContent='▲'; up.title='Move up'; up.setAttribute('aria-label','Move up');
    up.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,-1); grRenderTray(); saveState(); };
    const dn=document.createElement('button'); dn.textContent='▼'; dn.title='Move down'; dn.setAttribute('aria-label','Move down');
    dn.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,1); grRenderTray(); saveState(); };
    const lab=document.createElement('span'); lab.className='gr-tlabel'; lab.textContent=grEntryLabel(entry);
    const ct=document.createElement('span'); ct.className='gr-tct'; ct.textContent=entry.pageCount+'p';
    const rm=document.createElement('button'); rm.textContent='✕'; rm.title='Remove'; rm.setAttribute('aria-label','Remove from booklet');
    rm.onclick=()=>{ booklet=TNCore.bookletRemove(booklet,entry.id); grRenderTray(); saveState(); };
    row.appendChild(up); row.appendChild(dn); row.appendChild(lab); row.appendChild(ct); row.appendChild(rm);
    tray.appendChild(row);
  });
  $('gr-total').textContent=TNCore.bookletTotalPages(booklet)+' pages';
}

function initGreeter(){
  // loadState() ran during weekly.js init, before this file defined `booklet`,
  // so restore the persisted collection here (first point where `booklet` exists).
  try{ const s=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(s && Array.isArray(s.booklet)) booklet=s.booklet; }catch(e){}
  // Drop any persisted entry whose page type no longer exists (renamed/removed),
  // so a stale saved booklet can't crash tray render / generate.
  booklet = booklet.filter(e=>e && PAGE_TYPES[e.type]);
  // Avoid id collisions with restored entries (ids look like 'e3').
  booklet.forEach(e=>{ const n=parseInt(String(e.id).replace(/\D/g,''))||0; if(n>grUid) grUid=n; });
  grInitSize(); grSeedDate(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
}

initGreeter();
