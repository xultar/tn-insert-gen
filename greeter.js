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

// Temporary stub — replaced by the full tray renderer in Task 3.
function grRenderTray(){}

function initGreeter(){
  grInitSize(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
}

initGreeter();
