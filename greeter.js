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

const PAGE_TYPES = {
  cover:      { label:'Cover',              expand:(c)=>[mkCover(c.year,c.month,c.colors)] },
  futureLog:  { label:'Future Log',         expand:(c)=>mkFutureLog(c.year,c.month,c.colors), guided:[{opt:'flLayout',label:'Layout',choices:[['stacked','Stacked'],['columns','Column'],['year','Year grid']]}] },
  monthly:    { label:'Monthly',            expand:(c)=>monthsOf(c).flatMap(mm=>mkCalendar(mm.year,mm.month,c.colors)) },
  monthlog:   { label:'Monthly Log',        expand:(c)=>monthsOf(c).flatMap(mm=>mkMonthList(mm.year,mm.month,c.colors)) },
  habit:      { label:'Habit tracker',      expand:(c)=>monthsOf(c).map(mm=>mkHabitMap(mm.year,mm.month,c.colors)) },
  masterlist: { label:'Master Action List', expand:(c)=>monthsOf(c).map(mm=>mkMonthBrainDump(mm.year,mm.month,c.colors)) },
  reflection: { label:'Reflection',         expand:(c)=>monthsOf(c).map(mm=>mkReflection(mm.year,mm.month,c.colors)) },
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++) out.push(opts.dailyLayout==='timeblock'?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors));
                 return out; }), guided:[{opt:'dailyLayout',label:'Layout',choices:[['standard','Standard'],['timeblock','Time-block']]}] },
  plain:      { label:'Plain',              expand:(c)=>[mkPlain(c.year,c.month,c.colors)], guided:[{opt:'fillPattern',label:'Ruling',choices:[['dots','Dotted'],['grid','Squared'],['lines','Ruled'],['hex','Hex'],['empty','Blank']]}] },
  notes:      { label:'Notes',              expand:(c)=>{ const n=c.count||1; const out=[]; for(let i=0;i<n;i++) out.push(mkMonthNotes(c.year,c.month,c.colors)); return out; } }
};

// Expand a whole collection into a flat page array.
function bookletPages(list, ctx){
  return list.flatMap(function(entry){
    const type=PAGE_TYPES[entry.type];
    if(!type) return [];
    return type.expand(Object.assign({}, ctx, entry.config||{}));
  });
}

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

function grToggleTools(){
  const cb=$('gr-tools');
  // if called from the wall's back link, the checkbox is still checked → force off
  if(document.body.classList.contains('show-tools')) cb.checked=false;
  document.body.classList.toggle('show-tools', cb.checked);
}

function grRenderTypes(){
  const grid=$('gr-types'); grid.innerHTML='';
  Object.keys(PAGE_TYPES).forEach(type=>{
    const b=document.createElement('div');
    b.className='gr-type'+(type===greeterSel.type?' on':'');
    b.textContent=PAGE_TYPES[type].label;
    b.onclick=()=>{ greeterSel={type}; grRenderTypes(); grRenderGuided(); grPreview(); };
    grid.appendChild(b);
  });
}

function grRenderGuided(){
  const box=$('gr-guided'); box.innerHTML='';
  const g=(PAGE_TYPES[greeterSel.type]||{}).guided||[];
  g.forEach(spec=>{
    const lbl=document.createElement('div'); lbl.className='gr-lbl'; lbl.textContent=spec.label; box.appendChild(lbl);
    const row=document.createElement('div'); row.className='gr-opt';
    spec.choices.forEach(([val,text])=>{
      const chip=document.createElement('div');
      chip.className='gr-chip'+(opts[spec.opt]===val?' on':'');
      chip.textContent=text;
      chip.onclick=()=>{ opts[spec.opt]=val; grRenderGuided(); grPreview(); };
      row.appendChild(chip);
    });
    box.appendChild(row);
  });
}

function grPreview(){
  const ctx=grCtx();
  const pages=PAGE_TYPES[greeterSel.type].expand(Object.assign({}, ctx, greeterSel.config||{}));
  renderSinglePage(pages);
}

function grGenerate(){
  if(!booklet.length){ grPreview(); return; }
  const ctx=grCtx();
  // apply each entry's opts-based guided choices around its expansion, so mixed entries render with their own settings
  const pages=booklet.flatMap(entry=>{
    const g=(PAGE_TYPES[entry.type].guided||[]);
    const saved={}; g.forEach(spec=>{ saved[spec.opt]=opts[spec.opt]; opts[spec.opt]=entry.config[spec.opt]; });
    const out=PAGE_TYPES[entry.type].expand(Object.assign({}, ctx, entry.config||{}));
    g.forEach(spec=>{ opts[spec.opt]=saved[spec.opt]; });
    return out;
  });
  imposeAndRender(pages);
}

function grAdd(){
  const ctx=grCtx();
  const cfg=Object.assign({}, greeterSel.config||{});
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
  const parts=g.map(spec=>entry.config[spec.opt]).filter(Boolean);
  if(parts.length) l+=' · '+parts.join(' ');
  return l;
}

function grRenderTray(){
  const tray=$('gr-tray'); tray.innerHTML='';
  booklet.forEach(entry=>{
    const row=document.createElement('div'); row.className='gr-trow';
    const up=document.createElement('button'); up.textContent='▲'; up.title='Move up';
    up.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,-1); grRenderTray(); saveState(); };
    const dn=document.createElement('button'); dn.textContent='▼'; dn.title='Move down';
    dn.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,1); grRenderTray(); saveState(); };
    const lab=document.createElement('span'); lab.className='gr-tlabel'; lab.textContent=grEntryLabel(entry);
    const ct=document.createElement('span'); ct.className='gr-tct'; ct.textContent=entry.pageCount+'p';
    const rm=document.createElement('button'); rm.textContent='✕'; rm.title='Remove';
    rm.onclick=()=>{ booklet=TNCore.bookletRemove(booklet,entry.id); grRenderTray(); saveState(); };
    row.appendChild(up); row.appendChild(dn); row.appendChild(lab); row.appendChild(ct); row.appendChild(rm);
    tray.appendChild(row);
  });
  $('gr-total').textContent=TNCore.bookletTotalPages(booklet)+' pages';
}

function initGreeter(){
  grInitSize(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
}

initGreeter();
