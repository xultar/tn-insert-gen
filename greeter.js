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
  futureLog:  { label:'Future Log',         expand:(c)=>mkFutureLog(c.year,c.month,c.colors) },
  monthly:    { label:'Monthly',            expand:(c)=>monthsOf(c).flatMap(mm=>mkCalendar(mm.year,mm.month,c.colors)) },
  monthlog:   { label:'Monthly Log',        expand:(c)=>monthsOf(c).map(mm=>mkMonthList(mm.year,mm.month,c.colors)) },
  habit:      { label:'Habit tracker',      expand:(c)=>monthsOf(c).map(mm=>mkHabitMap(mm.year,mm.month,c.colors)) },
  masterlist: { label:'Master Action List', expand:(c)=>monthsOf(c).map(mm=>mkMonthBrainDump(mm.year,mm.month,c.colors)) },
  reflection: { label:'Reflection',         expand:(c)=>monthsOf(c).map(mm=>mkReflection(mm.year,mm.month,c.colors)) },
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++) out.push(c.timeblock?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors));
                 return out; }) },
  plain:      { label:'Plain',              expand:(c)=>[mkPlain(c.year,c.month,c.colors)] },
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

// TEMPORARY (Plan 2b replaces this with the sidebar UI): render a collection.
function renderBooklet(list){
  const ctx={ year:parseInt($('sel-y').value), month:parseInt($('sel-m').value), monthCount:1, colors:getColors() };
  imposeAndRender(bookletPages(list, ctx));
}
