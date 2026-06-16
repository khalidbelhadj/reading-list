/**
 * Renders analysis/code/metrics.json into a standalone interactive HTML report:
 * summary cards, treemap (size + hook density), dependency graph (import coupling),
 * ranked tables, and a React antipattern audit.
 *
 *   bun scripts/build-complexity-report.ts
 *
 * Output: analysis/code/report.html  (open directly in a browser; d3 loads from CDN).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "analysis", "code");
const metrics = readFileSync(join(OUT_DIR, "metrics.json"), "utf8");

const html = TEMPLATE_FN().replace("/*__DATA__*/null", metrics);
writeFileSync(join(OUT_DIR, "report.html"), html);
console.log(`Wrote analysis/code/report.html (${(html.length / 1024).toFixed(0)} KB). Open it in a browser.`);

// The template is defined after use; hoisting via function declaration keeps the file readable.
function TEMPLATE_FN(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Code complexity — reading-list</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<style>
  :root {
    --bg: #faf9f5; --panel: #fff; --ink: #1c1b18; --muted: #6b6a64; --faint: #9a988f;
    --line: rgba(0,0,0,.1); --accent: #534ab7;
    --gray:#888780; --green:#639922; --amber:#ba7517; --red:#e24b4a;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1a1916; --panel:#232220; --ink:#ece9e2; --muted:#a8a69d; --faint:#75736b;
      --line: rgba(255,255,255,.12); --accent:#afa9ec;
      --gray:#b4b2a9; --green:#97c459; --amber:#ef9f27; --red:#f09595; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; line-height:1.5; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { font-size: 24px; font-weight: 600; margin: 0 0 4px; }
  h2 { font-size: 17px; font-weight: 600; margin: 40px 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap:10px; margin:20px 0; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .card .v { font-size:24px; font-weight:600; }
  .card .l { font-size:12px; color:var(--muted); margin-top:2px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:8px; margin-top:8px; }
  .legend { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--muted); margin:6px 2px 10px; }
  .legend i { width:11px; height:11px; border-radius:3px; display:inline-block; vertical-align:-1px; margin-right:5px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:var(--muted); font-weight:500; padding:6px 10px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--panel); }
  td { padding:6px 10px; border-bottom:1px solid var(--line); }
  td.path { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size:12px; }
  td.num { text-align:right; font-variant-numeric: tabular-nums; }
  .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
  @media (max-width: 760px){ .grid2 { grid-template-columns: 1fr; } }
  .tablewrap { max-height: 340px; overflow:auto; border:1px solid var(--line); border-radius:12px; }
  .pill { display:inline-block; font-size:11px; padding:1px 7px; border-radius:999px; font-weight:500; }
  .audit { display:flex; flex-direction:column; gap:8px; }
  .finding { background:var(--panel); border:1px solid var(--line); border-left:3px solid var(--amber); border-radius:0 10px 10px 0; padding:10px 14px; }
  .finding.high { border-left-color: var(--red); }
  .finding.low { border-left-color: var(--green); }
  .finding h3 { margin:0 0 4px; font-size:14px; font-weight:600; }
  .finding p { margin:0; font-size:12.5px; color:var(--muted); }
  .finding ul { margin:6px 0 0; padding-left:18px; font-size:12.5px; }
  .finding code { font-family: ui-monospace, Menlo, monospace; font-size:12px; }
  text { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  .gen { color:var(--faint); font-size:12px; margin-top:6px; }
  svg .grp-label { fill: var(--muted); font-weight:600; }
  .cp { display:inline-flex; align-items:center; justify-content:center; vertical-align:-2px;
    width:16px; height:16px; margin-left:5px; padding:0; border:0; border-radius:4px; background:transparent;
    color:var(--faint); cursor:pointer; opacity:.55; transition:opacity .12s, color .12s; }
  .cp:hover { opacity:1; color:var(--accent); background:var(--line); }
  .cp svg { width:12px; height:12px; pointer-events:none; }
  tr:hover .cp { opacity:.85; }
  #toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%) translateY(20px);
    background:var(--ink); color:var(--bg); font-size:13px; padding:8px 14px; border-radius:8px;
    opacity:0; pointer-events:none; transition:opacity .18s, transform .18s; z-index:50; }
  #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
  .glegend { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--muted); margin:6px 2px 0; }
  .glegend i { width:11px; height:11px; border-radius:3px; display:inline-block; vertical-align:-1px; margin-right:5px; }
  .glegend .ring { border:2px solid var(--red); background:transparent; }
  svg .blk { cursor:pointer; }
  svg .blk:hover .blk-bg { stroke-width:1.6; }
  svg .clbox { fill:none; stroke:var(--line); stroke-width:1.2; }
  svg .cllabel { fill:var(--muted); font-weight:600; }
  svg .edge { fill:none; stroke:var(--faint); }
  .toggle { display:inline-flex; gap:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin:8px 0 0; }
  .toggle button { border:0; background:transparent; color:var(--muted); font-size:13px; padding:6px 14px; cursor:pointer; }
  .toggle button + button { border-left:1px solid var(--line); }
  .toggle button.active { background:var(--accent); color:#fff; }
  #graph-caption { font-size:12.5px; color:var(--muted); margin:8px 2px 0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Code complexity report</h1>
  <p class="sub" id="gensub"></p>

  <div class="cards" id="cards"></div>

  <h2>1. Files — size &amp; hook density</h2>
  <p class="sub">Area = lines of code. Color = hook calls per 100 lines. Grouped by folder. Hover for detail, click to copy path.</p>
  <div class="legend">
    <span><i style="background:var(--gray)"></i>no hooks</span>
    <span><i style="background:var(--green)"></i>low &lt;3</span>
    <span><i style="background:var(--amber)"></i>medium 3–5</span>
    <span><i style="background:var(--red)"></i>high &gt;5</span>
  </div>
  <div class="panel"><div id="treemap"></div></div>

  <h2>2. Components — size &amp; complexity</h2>
  <p class="sub">One tile per detected component (PascalCase function containing JSX). Area = the component's own line span; color = cyclomatic complexity. The many tiny tiles are inline render helpers — that is why the headline component count is a ceiling.</p>
  <div class="legend">
    <span><i style="background:var(--green)"></i>simple ≤5</span>
    <span><i style="background:var(--amber)"></i>moderate 6–15</span>
    <span><i style="background:var(--red)"></i>complex &gt;15</span>
  </div>
  <div class="panel"><div id="ctreemap"></div></div>

  <h2>3. Module map — dependency structure</h2>
  <p class="sub">Each block is a file. Block accent = hook density; red outline = file in an import cycle. Hover a block to light up its imports (out) and importers (in); click to copy its path. Scroll to zoom, drag to pan.</p>
  <div class="toggle" id="graph-toggle">
    <button data-mode="layered" class="active">Layered by depth</button>
    <button data-mode="clusters">Coupling clusters</button>
  </div>
  <div class="glegend">
    <span><i style="background:var(--gray)"></i>no hooks</span>
    <span><i style="background:var(--green)"></i>low</span>
    <span><i style="background:var(--amber)"></i>medium</span>
    <span><i style="background:var(--red)"></i>high</span>
    <span><i class="ring"></i>import cycle</span>
    <span style="color:var(--accent)">━ imports (out)</span>
    <span style="color:var(--green)">━ importers (in)</span>
  </div>
  <p id="graph-caption"></p>
  <div class="panel"><div id="graph"></div></div>

  <h2>4. Component graph — render hierarchy</h2>
  <p class="sub">Each node is a component; an arrow A → B means A renders &lt;B/&gt; in its JSX. Color = cyclomatic complexity. Hover to light up what a component renders (out) and what renders it (in); click to copy its file path. External/library components (icons, base-ui primitives) are not shown. Scroll to zoom, drag to pan.</p>
  <div class="glegend">
    <span><i style="background:var(--green)"></i>simple ≤5</span>
    <span><i style="background:var(--amber)"></i>moderate 6–15</span>
    <span><i style="background:var(--red)"></i>complex &gt;15</span>
    <span style="color:var(--accent)">→ renders (out)</span>
    <span style="color:var(--green)">→ rendered by (in)</span>
  </div>
  <div class="panel"><div id="cgraph"></div></div>

  <h2>5. Worst offenders — ranked</h2>
  <div class="grid2">
    <div><p class="sub">Biggest files (lines)</p><div class="tablewrap" id="t-size"></div></div>
    <div><p class="sub">Most hook calls per file</p><div class="tablewrap" id="t-hooks"></div></div>
    <div><p class="sub">Highest cyclomatic complexity (function)</p><div class="tablewrap" id="t-cx"></div></div>
    <div><p class="sub">Most useEffect per file</p><div class="tablewrap" id="t-fx"></div></div>
    <div><p class="sub">Most depended-on (fan-in)</p><div class="tablewrap" id="t-fanin"></div></div>
    <div><p class="sub">Deepest JSX nesting</p><div class="tablewrap" id="t-jsx"></div></div>
  </div>

  <h2>6. Antipattern audit</h2>
  <p class="sub">Heuristic flags — not all are bugs, but each is worth a look.</p>
  <div class="audit" id="audit"></div>

  <p class="gen" id="footer"></p>
</div>
<div id="toast"></div>

<script>
const DATA = /*__DATA__*/null;
const files = DATA.files, edges = DATA.edges, totals = DATA.totals;
const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---- copy-to-clipboard + toast ----
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
let toastTimer = null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('show'), 1400);
}
function copyPath(path){
  const done = ()=>toast('Copied  ' + path);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(path).then(done).catch(()=>fallbackCopy(path,done));
  } else fallbackCopy(path, done);
}
function fallbackCopy(text, done){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e) { toast('Copy failed'); }
  document.body.removeChild(ta);
}
// Delegate clicks on any copy button (works for dynamically-rendered tables/audit).
document.addEventListener('click', (e)=>{
  const btn = e.target.closest && e.target.closest('.cp');
  if (btn) { e.preventDefault(); copyPath(btn.getAttribute('data-p')); }
});
// A filename + copy button, for HTML (tables/audit). full is the path copied.
const fileLabel = (display, full) =>
  '<span class="mono">'+display+'</span><button class="cp" data-p="'+full+'" title="Copy '+full+'" aria-label="Copy path">'+COPY_SVG+'</button>';

document.getElementById('gensub').textContent =
  totals.files + ' files · ' + totals.loc.toLocaleString() + ' lines · ' +
  totals.components + ' components · ' + totals.customHooks + ' custom hooks · ' + totals.internalEdges + ' import edges';

// ---- summary cards ----
const cardDefs = [
  ['Files', totals.files], ['Lines', totals.loc.toLocaleString()],
  ['Components', totals.components], ['Custom hooks', totals.customHooks],
  ['Hook calls', totals.hooks], ['useEffect', totals.useEffect],
  ['useState', totals.useState], ['Import edges', totals.internalEdges],
];
document.getElementById('cards').innerHTML = cardDefs
  .map(([l,v]) => '<div class="card"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>').join('');

// ---- shared helpers ----
const density = (f) => f.loc ? f.hooks.total / f.loc * 100 : 0;
const densityColor = (f) => {
  if (f.hooks.total === 0) return css('--gray');
  const d = density(f);
  if (d < 3) return css('--green');
  if (d <= 5) return css('--amber');
  return css('--red');
};
const short = (p) => p.replace(/^(app|components|lib|db)\\//,'').replace(/\\.(tsx?|ts)$/,'');
const palette = ['#534ab7','#1d9e75','#d85a30','#d4537e','#378add','#ba7517','#639922','#888780'];
const groups = [...new Set(files.map(f=>f.group))];
const groupColor = (g) => palette[groups.indexOf(g) % palette.length];

// ---- 1. treemap ----
(function(){
  const W = 1040, H = 460;
  const root = d3.hierarchy({children: d3.groups(files, f=>f.group).map(([k,v])=>({name:k,children:v}))})
    .sum(d => d.loc).sort((a,b)=>b.value-a.value);
  d3.treemap().size([W,H]).paddingInner(2).paddingTop(16).paddingOuter(2).round(true)(root);
  const svg = d3.select('#treemap').append('svg').attr('viewBox','0 0 '+W+' '+H)
    .attr('width','100%').style('display','block');
  svg.selectAll('g.g').data(root.children).join('g').append('text')
    .attr('class','grp-label').attr('x',d=>d.x0+2).attr('y',d=>d.y0+12).attr('font-size',11)
    .text(d=>d.data.name);
  const leaf = svg.selectAll('g.l').data(root.leaves()).join('g')
    .style('cursor','pointer').on('click',(e,d)=>copyPath(d.data.path));
  leaf.append('rect').attr('x',d=>d.x0).attr('y',d=>d.y0)
    .attr('width',d=>Math.max(0,d.x1-d.x0)).attr('height',d=>Math.max(0,d.y1-d.y0))
    .attr('rx',2).attr('fill',d=>densityColor(d.data)).attr('fill-opacity', isDark?0.55:0.78)
    .attr('stroke',d=>densityColor(d.data)).attr('stroke-width',0.75);
  leaf.append('title').text(d=>{
    const f=d.data; return f.path+'\\n'+f.loc+' lines · '+f.hooks.total+' hooks ('+density(f).toFixed(1)+'/100)'+
      '\\n'+f.hooks.useEffect+' effects · max complexity '+f.maxComplexity+' · imported by '+f.importedBy.length; });
  leaf.append('text').each(function(d){
    const w=d.x1-d.x0,h=d.y1-d.y0; if(w<48||h<22)return;
    const t=d3.select(this).attr('x',d.x0+4).attr('y',d.y0+13).attr('font-size',10.5)
      .attr('fill',isDark?'#fff':'#1c1b18').attr('font-weight',500);
    const nm=short(d.data.path); t.append('tspan').attr('x',d.x0+4).text(nm.length>18?nm.slice(0,17)+'…':nm);
    if(h>38) t.append('tspan').attr('x',d.x0+4).attr('dy',13).attr('font-size',9.5).attr('font-weight',400)
      .attr('opacity',0.75).text(d.data.loc+'L · '+d.data.hooks.total+'h');
  });
})();

// ---- 2. component treemap ----
const cxColor = (cc) => cc<=5 ? css('--green') : cc<=15 ? css('--amber') : css('--red');
(function(){
  const comps = files.flatMap(f=>f.functions.filter(fn=>fn.isComponent)
    .map(fn=>({name:fn.name, file:f.path, group:f.group, loc:Math.max(1,fn.loc), cc:fn.complexity, jsx:fn.jsxDepth, props:fn.props})));
  const W=1040,H=460;
  const root = d3.hierarchy({children: d3.groups(comps, c=>c.group).map(([k,v])=>({name:k,children:v}))})
    .sum(d=>d.loc).sort((a,b)=>b.value-a.value);
  d3.treemap().size([W,H]).paddingInner(1.5).paddingTop(16).paddingOuter(2).round(true)(root);
  const svg = d3.select('#ctreemap').append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%').style('display','block');
  svg.selectAll('g.g').data(root.children).join('g').append('text')
    .attr('class','grp-label').attr('x',d=>d.x0+2).attr('y',d=>d.y0+12).attr('font-size',11).text(d=>d.data.name);
  const leaf = svg.selectAll('g.l').data(root.leaves()).join('g')
    .style('cursor','pointer').on('click',(e,d)=>copyPath(d.data.file));
  leaf.append('rect').attr('x',d=>d.x0).attr('y',d=>d.y0)
    .attr('width',d=>Math.max(0,d.x1-d.x0)).attr('height',d=>Math.max(0,d.y1-d.y0))
    .attr('rx',2).attr('fill',d=>cxColor(d.data.cc)).attr('fill-opacity',isDark?0.55:0.78)
    .attr('stroke',d=>cxColor(d.data.cc)).attr('stroke-width',0.6);
  leaf.append('title').text(d=>d.data.name+'  ('+d.data.file+')\\n'+d.data.loc+' lines · complexity '+d.data.cc+' · JSX depth '+d.data.jsx+' · '+d.data.props+' props');
  leaf.append('text').each(function(d){
    const w=d.x1-d.x0,h=d.y1-d.y0; if(w<44||h<20)return;
    const t=d3.select(this).attr('x',d.x0+4).attr('y',d.y0+13).attr('font-size',10).attr('fill',isDark?'#fff':'#1c1b18').attr('font-weight',500);
    const nm=d.data.name; t.text(nm.length>18?nm.slice(0,17)+'…':nm);
  });
})();

// ---- detect import cycles (for graph rings) ----
const inCycle = new Set();
(function(){
  const adj = new Map(files.map(f=>[f.path, []]));
  edges.forEach(e=>{ if(adj.has(e.from)) adj.get(e.from).push(e.to); });
  const WHITE=0,GRAY=1,BLACK=2; const color=new Map(files.map(f=>[f.path,WHITE])); const stack=[];
  const dfs=(u)=>{ color.set(u,GRAY); stack.push(u);
    for(const v of (adj.get(u)||[])){
      if(color.get(v)===GRAY){ // back-edge: mark the cycle slice
        const i=stack.lastIndexOf(v); for(let k=i;k<stack.length;k++) inCycle.add(stack[k]); inCycle.add(v);
      } else if(color.get(v)===WHITE) dfs(v);
    }
    color.set(u,BLACK); stack.pop(); };
  files.forEach(f=>{ if(color.get(f.path)===WHITE) dfs(f.path); });
})();

// ---- shared: settle a network of block-nodes with a force sim, then draw it static ----
// Nodes need {id, name, sub, accent, ring, copy, title} plus either {fyBand, bandLabel}
// (layered) or {clusterId, clusterLabel} (clustered). Links are {source, target} ids.
const BW=150, BH=40;
function settledNetwork(sel, nodes, links, opts){
  d3.select(sel+' svg').remove();
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const adjOut=new Map(nodes.map(n=>[n.id,new Set()])), adjIn=new Map(nodes.map(n=>[n.id,new Set()]));
  links.forEach(l=>{ if(byId.has(l.source)&&byId.has(l.target)){ adjOut.get(l.source).add(l.target); adjIn.get(l.target).add(l.source); } });

  let targets=null;
  if(opts.layered){
    nodes.forEach((n,i)=>{ n.x=(i%24)*44; n.y=n.fyBand; n.fy=n.fyBand; });
  } else {
    const cids=[...new Set(nodes.map(n=>n.clusterId))];
    const span=Math.ceil(Math.sqrt(cids.length)), cell=640;
    targets=new Map(cids.map((c,i)=>[c,{x:(i%span)*cell+cell/2, y:Math.floor(i/span)*cell+cell/2}]));
    nodes.forEach((n,i)=>{ const t=targets.get(n.clusterId); n.x=t.x+((i%7)-3)*34; n.y=t.y+((Math.floor(i/7)%7)-3)*34; });
  }
  const sim=d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id).distance(opts.layered?64:92).strength(opts.layered?0.05:0.14))
    .force('charge', d3.forceManyBody().strength(opts.layered?-200:-320))
    .force('collide', d3.forceCollide().radius(opts.layered? BW*0.55 : 80))
    .stop();
  if(opts.layered) sim.force('x', d3.forceX(0).strength(0.01));
  else { sim.force('cx', d3.forceX(n=>targets.get(n.clusterId).x).strength(0.07));
         sim.force('cy', d3.forceY(n=>targets.get(n.clusterId).y).strength(0.07)); }
  for(let i=0;i<440;i++) sim.tick();

  // normalise to positive coords with padding
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  nodes.forEach(n=>{ minX=Math.min(minX,n.x-BW/2); maxX=Math.max(maxX,n.x+BW/2); minY=Math.min(minY,n.y-BH/2); maxY=Math.max(maxY,n.y+BH/2); });
  const PADV=44, ox=-minX+PADV, oy=-minY+PADV+(opts.layered?14:0);
  nodes.forEach(n=>{ n.x+=ox; n.y+=oy; });
  const W=(maxX-minX)+PADV*2, H=(maxY-minY)+PADV*2+(opts.layered?14:0);

  const svg=d3.select(sel).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%').style('display','block');
  if(opts.arrow){
    const defs=svg.append('defs');
    [['faint',css('--faint')],['out',css('--accent')],['in',css('--green')]].forEach(([k,col])=>{
      defs.append('marker').attr('id',opts.prefix+'-'+k).attr('viewBox','0 0 10 10').attr('refX',9).attr('refY',5)
        .attr('markerWidth',5.5).attr('markerHeight',5.5).attr('orient','auto')
        .append('path').attr('d','M0,0 L10,5 L0,10 z').attr('fill',col); });
  }
  const g=svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.15,4]).on('zoom',ev=>g.attr('transform',ev.transform)));

  // boundaries
  if(opts.hulls){
    const hl=g.append('g');
    d3.groups(nodes, n=>n.clusterId).forEach(([cid,ns])=>{
      const pts=[]; ns.forEach(n=>{ const hw=BW/2+18, hh=BH/2+18;
        pts.push([n.x-hw,n.y-hh],[n.x+hw,n.y-hh],[n.x+hw,n.y+hh],[n.x-hw,n.y+hh]); });
      const hull=d3.polygonHull(pts); if(!hull) return;
      hl.append('path').attr('class','clbox').attr('d','M'+hull.map(p=>p.join(',')).join('L')+'Z');
      const top=hull.reduce((a,b)=>b[1]<a[1]?b:a);
      hl.append('text').attr('class','cllabel').attr('x',top[0]).attr('y',top[1]-7)
        .attr('font-size',11).attr('text-anchor','middle').text(ns[0].clusterLabel);
    });
  }
  if(opts.layered){
    const bl=g.append('g');
    d3.groups(nodes, n=>n.bandLabel).forEach(([lab,ns])=>{ const yy=ns[0].y;
      bl.append('line').attr('x1',0).attr('x2',W).attr('y1',yy-BH/2-13).attr('y2',yy-BH/2-13)
        .attr('stroke',css('--line')).attr('stroke-width',1);
      bl.append('text').attr('class','cllabel').attr('x',4).attr('y',yy-BH/2-17).attr('font-size',11).text(lab); });
  }

  // edges
  const hw=BW/2+2, hh=BH/2+2;
  const rectEdge=(tx,ty,fx,fy)=>{ const dx=fx-tx, dy=fy-ty; if(!dx&&!dy) return {x:tx,y:ty};
    const s=Math.min(dx?hw/Math.abs(dx):Infinity, dy?hh/Math.abs(dy):Infinity); return {x:tx+dx*s, y:ty+dy*s}; };
  // After the simulation, forceLink has replaced source/target ids with node objects.
  const epath=(l)=>{ const s=(typeof l.source==='object')?l.source:byId.get(l.source), t=(typeof l.target==='object')?l.target:byId.get(l.target);
    const a=rectEdge(s.x,s.y,t.x,t.y), b=rectEdge(t.x,t.y,s.x,s.y); return 'M'+a.x+','+a.y+' L'+b.x+','+b.y; };
  const edgeSel=g.append('g').selectAll('path').data(links).join('path')
    .attr('class','edge').attr('d',epath).attr('stroke-opacity',0.08).attr('stroke-width',0.7)
    .attr('fill','none').attr('marker-end',opts.arrow?('url(#'+opts.prefix+'-faint)'):null);

  // blocks
  const blk=g.append('g').selectAll('g').data(nodes).join('g')
    .attr('class','blk').attr('transform',n=>'translate('+(n.x-BW/2)+','+(n.y-BH/2)+')')
    .on('click',(e,n)=>copyPath(n.copy))
    .on('mouseenter',(e,n)=>highlight(n.id)).on('mouseleave',()=>highlight(null));
  blk.append('rect').attr('class','blk-bg').attr('width',BW).attr('height',BH).attr('rx',7)
    .attr('fill',isDark?'#2c2b28':'#fff')
    .attr('stroke',n=>n.ring?css('--red'):n.accent).attr('stroke-width',n=>n.ring?1.8:1);
  blk.append('rect').attr('width',3.5).attr('height',BH).attr('rx',2).attr('fill',n=>n.accent);
  blk.append('title').text(n=>n.title);
  blk.append('text').attr('x',9).attr('y',16).attr('font-size',11).attr('font-weight',500)
    .attr('fill',isDark?'#ece9e2':'#1c1b18').text(n=>n.name.length>20?n.name.slice(0,19)+'…':n.name);
  blk.append('text').attr('x',9).attr('y',31).attr('font-size',9.5).attr('fill',css('--muted'))
    .text(n=>n.sub.length>22?n.sub.slice(0,21)+'…':n.sub);

  function highlight(id){
    if(!id){ edgeSel.attr('stroke',css('--faint')).attr('stroke-opacity',0.08).attr('stroke-width',0.7)
        .attr('marker-end',opts.arrow?('url(#'+opts.prefix+'-faint)'):null); blk.attr('opacity',1); return; }
    const rel=new Set([id, ...adjOut.get(id), ...adjIn.get(id)]);
    blk.attr('opacity',n=>rel.has(n.id)?1:0.16);
    edgeSel
      .attr('stroke',l=> l.source===id||l.source.id===id ? css('--accent') : (l.target===id||l.target.id===id) ? css('--green') : css('--faint'))
      .attr('stroke-opacity',l=>{ const s=l.source.id||l.source, t=l.target.id||l.target; return (s===id||t===id)?0.95:0.03; })
      .attr('stroke-width',l=>{ const s=l.source.id||l.source, t=l.target.id||l.target; return (s===id||t===id)?1.5:0.5; })
      .attr('marker-end',l=>{ if(!opts.arrow) return null; const s=l.source.id||l.source, t=l.target.id||l.target;
        return 'url(#'+opts.prefix+'-'+(s===id?'out':t===id?'in':'faint')+')'; });
    edgeSel.filter(l=>{ const s=l.source.id||l.source, t=l.target.id||l.target; return s===id||t===id; }).raise();
  }
}

// ---- 3. module map: layered-by-depth / coupling clusters, as settled networks ----
(function(){
  const fileById=new Map(files.map(f=>[f.path,f]));
  const internalEdges=edges.filter(e=>fileById.has(e.from)&&fileById.has(e.to));
  const out=new Map(files.map(f=>[f.path,new Set()]));
  internalEdges.forEach(e=>out.get(e.from).add(e.to));
  const links=internalEdges.map(e=>({source:e.from, target:e.to}));
  const baseNode=(f)=>({ id:f.path, name:f.path.split('/').pop().replace(/\\.(tsx?|ts)$/,''),
    sub:f.loc+'L · '+f.hooks.total+'h · '+f.importedBy.length+' in', accent:densityColor(f), ring:inCycle.has(f.path),
    copy:f.path, title:f.path+'\\n'+f.loc+' lines · '+f.hooks.total+' hooks · imported by '+f.importedBy.length+' · imports '+out.get(f.path).size });

  // depths (longest import chain), cycle-guarded
  const depth=new Map(), onstack=new Set();
  const dep=(p)=>{ if(depth.has(p))return depth.get(p); onstack.add(p); let d=0;
    for(const t of out.get(p)){ if(onstack.has(t))continue; d=Math.max(d,dep(t)+1); } onstack.delete(p); depth.set(p,d); return d; };
  files.forEach(f=>dep(f.path));
  const maxL=Math.max(0,...depth.values());
  function layeredNodes(){
    return files.map(f=>{ const L=depth.get(f.path);
      const tag=L===0?' — leaf utilities':L===maxL?' — entry points':'';
      return Object.assign(baseNode(f), {fyBand:(maxL-L)*150, bandLabel:'Layer '+L+tag}); });
  }
  const layeredCaption='Files by longest import chain: layer 0 = leaf utilities, layer '+maxL+' = entry points. '+(maxL+1)+' layers = your deepest dependency chain is '+maxL+' hops. Edges flow downward; red outline = import cycle.';

  // coupling clusters (label propagation, hubs removed)
  const HUB=8;
  const hub=new Set(files.filter(f=>f.importedBy.length>=HUB).map(f=>f.path));
  const nbr=new Map(files.map(f=>[f.path,new Set()]));
  internalEdges.forEach(e=>{ if(hub.has(e.from)||hub.has(e.to)) return; nbr.get(e.from).add(e.to); nbr.get(e.to).add(e.from); });
  const lab=new Map(files.map((f,i)=>[f.path,i]));
  for(let it=0; it<40; it++){ let changed=false;
    for(const f of files){ const p=f.path; if(hub.has(p)) continue; const nb=nbr.get(p); if(!nb.size) continue;
      const counts=new Map(); for(const q of nb){ const l=lab.get(q); counts.set(l,(counts.get(l)||0)+1); }
      let best=lab.get(p), bc=-1; for(const [l,c] of counts){ if(c>bc||(c===bc&&l<best)){ best=l; bc=c; } }
      if(best!==lab.get(p)){ lab.set(p,best); changed=true; } }
    if(!changed) break; }
  const groups=new Map(); files.forEach(f=>{ if(!hub.has(f.path)&&nbr.get(f.path).size){ const l=lab.get(f.path); if(!groups.has(l))groups.set(l,[]); groups.get(l).push(f); } });
  const small=[...groups.entries()].filter(([,v])=>v.length<2).map(([k])=>k); small.forEach(k=>groups.delete(k));
  // assign a stable cluster label per file
  const clusterOf=new Map(), clusterLabelOf=new Map();
  [...groups.values()].sort((a,b)=>b.length-a.length).forEach(items=>{
    items.sort((a,b)=>b.importedBy.length-a.importedBy.length);
    const id='c'+items[0].path, lbl='~'+items[0].path.split('/').pop().replace(/\\.(tsx?|ts)$/,'')+' ('+items.length+')';
    items.forEach(f=>{ clusterOf.set(f.path,id); clusterLabelOf.set(f.path,lbl); }); });
  files.forEach(f=>{ if(clusterOf.has(f.path)) return;
    if(hub.has(f.path)){ clusterOf.set(f.path,'hub'); clusterLabelOf.set(f.path,'shared infrastructure ('+hub.size+')'); }
    else { clusterOf.set(f.path,'loose'); clusterLabelOf.set(f.path,'unconnected'); } });
  function clusterNodes(){ return files.map(f=>Object.assign(baseNode(f), {clusterId:clusterOf.get(f.path), clusterLabel:clusterLabelOf.get(f.path)})); }
  const nClusters=new Set([...clusterOf.values()]).size;
  const clusterCaption=nClusters+' clusters: feature modules by who-imports-whom (folders ignored), after pulling out '+hub.size+' shared-infrastructure hubs that otherwise glue everything together. A module spanning several folders means your folders and your real dependencies disagree.';

  function render(mode){
    if(mode==='layered'){ settledNetwork('#graph', layeredNodes(), links.map(l=>({...l})), {layered:true}); document.getElementById('graph-caption').textContent=layeredCaption; }
    else { settledNetwork('#graph', clusterNodes(), links.map(l=>({...l})), {hulls:true}); document.getElementById('graph-caption').textContent=clusterCaption; }
  }
  render('layered');
  document.querySelectorAll('#graph-toggle button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#graph-toggle button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); render(b.getAttribute('data-mode')); }));
})();

// ---- 4. component graph: components linked by render (A renders <B/>) ----
(function(){
  const comps=files.flatMap(f=>f.functions.filter(fn=>fn.isComponent)
    .map(fn=>({id:f.path+'::'+fn.name, name:fn.name, file:f.path, loc:Math.max(1,fn.loc), cc:fn.complexity, renders:fn.renders})));
  const byName=new Map(); comps.forEach(c=>{ if(!byName.has(c.name)) byName.set(c.name,[]); byName.get(c.name).push(c); });
  const importsOf=new Map(files.map(f=>[f.path,new Set(f.imports.internal)]));
  const links=[], seen=new Set();
  for(const c of comps){ for(const tag of c.renders){ const cand=byName.get(tag); if(!cand) continue;
    let tgt = cand.length===1 ? cand[0] : (cand.find(x=>x.file===c.file) || cand.find(x=>importsOf.get(c.file)&&importsOf.get(c.file).has(x.file)));
    if(!tgt || tgt.id===c.id) continue; const k=c.id+'>'+tgt.id; if(seen.has(k)) continue; seen.add(k); links.push({source:c.id, target:tgt.id}); } }
  const inGraph=new Set(); links.forEach(l=>{ inGraph.add(l.source); inGraph.add(l.target); });
  const compById=new Map(comps.map(c=>[c.id,c]));
  const nodes=[...inGraph].map(id=>{ const c=compById.get(id);
    return { id, name:c.name, sub:short(c.file), accent:cxColor(c.cc), ring:false, copy:c.file, clusterId:'all', clusterLabel:'',
      title:c.name+'  ('+c.file+')\\n'+c.loc+' lines · complexity '+c.cc }; });
  settledNetwork('#cgraph', nodes, links, {arrow:true, prefix:'cg'});
})();

// ---- 3. tables ----
function renderTable(elId, rows, cols){
  const head = '<tr>'+cols.map(c=>'<th'+(c.num?' style="text-align:right"':'')+'>'+c.h+'</th>').join('')+'</tr>';
  const body = rows.map(r=>'<tr>'+cols.map(c=>{
    const v=c.get(r);
    const cell = c.copy ? fileLabel(v, c.copy(r)) : v;
    return '<td class="'+(c.num?'num':(c.path?'path':''))+'">'+cell+'</td>';
  }).join('')+'</tr>').join('');
  document.getElementById(elId).innerHTML='<table>'+head+body+'</table>';
}
const topN=(arr,key,n=15)=>[...arr].sort((a,b)=>key(b)-key(a)).slice(0,n);
renderTable('t-size', topN(files,f=>f.loc), [
  {h:'File',path:true,get:f=>short(f.path),copy:f=>f.path},{h:'Lines',num:true,get:f=>f.loc},{h:'Code',num:true,get:f=>f.codeLoc}]);
renderTable('t-hooks', topN(files,f=>f.hooks.total), [
  {h:'File',path:true,get:f=>short(f.path),copy:f=>f.path},{h:'Hooks',num:true,get:f=>f.hooks.total},{h:'/100',num:true,get:f=>density(f).toFixed(1)}]);
const allFns = files.flatMap(f=>f.functions.map(fn=>({...fn,file:f.path})));
renderTable('t-cx', topN(allFns,f=>f.complexity), [
  {h:'Function',path:true,get:f=>f.name},{h:'File',path:true,get:f=>short(f.file),copy:f=>f.file},{h:'CC',num:true,get:f=>f.complexity}]);
renderTable('t-fx', topN(files,f=>f.hooks.useEffect).filter(f=>f.hooks.useEffect>0), [
  {h:'File',path:true,get:f=>short(f.path),copy:f=>f.path},{h:'Effects',num:true,get:f=>f.hooks.useEffect},
  {h:'No deps',num:true,get:f=>f.effects.filter(e=>e.depCount===null).length}]);
renderTable('t-fanin', topN(files,f=>f.importedBy.length), [
  {h:'File',path:true,get:f=>short(f.path),copy:f=>f.path},{h:'Fan-in',num:true,get:f=>f.importedBy.length}]);
renderTable('t-jsx', topN(files,f=>f.maxJsxDepth), [
  {h:'File',path:true,get:f=>short(f.path),copy:f=>f.path},{h:'Max JSX depth',num:true,get:f=>f.maxJsxDepth}]);

// ---- 4. audit ----
const audit = [];
const list = (items, fmt) => '<ul>'+items.slice(0,12).map(fmt).join('')+'</ul>'+(items.length>12?'<p>…and '+(items.length-12)+' more</p>':'');

const god = files.filter(f=>f.loc>400 || f.hooks.total>20).sort((a,b)=>b.loc-a.loc);
if(god.length) audit.push({sev:'high',t:god.length+' god files (>400 lines or >20 hook calls)',
  d:'These concentrate too much responsibility — prime candidates for splitting into sub-components and extracting hooks.',
  body:list(god,f=>'<li><code>'+short(f.path)+'</code> — '+f.loc+' lines, '+f.hooks.total+' hooks, '+f.hooks.useEffect+' effects</li>')});

const noDep = files.map(f=>({f,n:f.effects.filter(e=>e.depCount===null).length})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
if(noDep.length) audit.push({sev:'high',t:'Effects with no dependency array (run on every render)',
  d:'A useEffect without a dep array fires after every render. Sometimes intentional, but often a missed [] or a value that should be derived, not synced.',
  body:list(noDep,x=>'<li><code>'+short(x.f.path)+'</code> — '+x.n+' effect(s)</li>')});

const fxHeavy = files.filter(f=>f.hooks.useEffect>=5).sort((a,b)=>b.hooks.useEffect-a.hooks.useEffect);
if(fxHeavy.length) audit.push({sev:'',t:'Effect-heavy files (≥5 useEffect)',
  d:'Many effects in one component usually means state is being synchronized that could be derived during render, or logic that belongs in event handlers / a reducer.',
  body:list(fxHeavy,f=>'<li><code>'+short(f.path)+'</code> — '+f.hooks.useEffect+' effects</li>')});

const stateSprawl = files.filter(f=>f.hooks.useState>=6).sort((a,b)=>b.hooks.useState-a.hooks.useState);
if(stateSprawl.length) audit.push({sev:'',t:'State sprawl (≥6 useState in one file)',
  d:'Many independent useState calls often want to be a single useReducer or be colocated into smaller components.',
  body:list(stateSprawl,f=>'<li><code>'+short(f.path)+'</code> — '+f.hooks.useState+' useState</li>')});

const complexFns = allFns.filter(f=>f.complexity>15).sort((a,b)=>b.complexity-a.complexity);
if(complexFns.length) audit.push({sev:'high',t:'High cyclomatic complexity (>15)',
  d:'Deeply branching functions are hard to test and reason about. Extract helpers or flatten conditionals.',
  body:list(complexFns,f=>'<li><code>'+f.name+'</code> in <code>'+short(f.file)+'</code> — CC '+f.complexity+'</li>')});

const deepJsx = files.filter(f=>f.maxJsxDepth>=9).sort((a,b)=>b.maxJsxDepth-a.maxJsxDepth);
if(deepJsx.length) audit.push({sev:'',t:'Deep JSX nesting (≥9 levels)',
  d:'Deeply nested markup is a signal to extract sub-components.',
  body:list(deepJsx,f=>'<li><code>'+short(f.path)+'</code> — depth '+f.maxJsxDepth+'</li>')});

const propsHeavy = allFns.filter(f=>f.isComponent&&f.props>=8).sort((a,b)=>b.props-a.props);
if(propsHeavy.length) audit.push({sev:'',t:'Components with many props (≥8)',
  d:'Large prop lists hint at prop drilling or a component doing too much — consider composition or context.',
  body:list(propsHeavy,f=>'<li><code>'+f.name+'</code> in <code>'+short(f.file)+'</code> — '+f.props+' props</li>')});

if(inCycle.size) audit.push({sev:'high',t:inCycle.size+' files in circular import dependencies',
  d:'Import cycles make modules hard to reason about and can break tree-shaking / cause init-order bugs.',
  body:list([...inCycle],p=>'<li><code>'+short(p)+'</code></li>')});

const fanInHubs = files.filter(f=>f.importedBy.length>=10).sort((a,b)=>b.importedBy.length-a.importedBy.length);
if(fanInHubs.length) audit.push({sev:'low',t:'High fan-in hubs (≥10 importers)',
  d:'Not a problem in itself, but changes here ripple widely — keep these stable and well-tested.',
  body:list(fanInHubs,f=>'<li><code>'+short(f.path)+'</code> — '+f.importedBy.length+' importers</li>')});

document.getElementById('audit').innerHTML = audit.length ? audit.map(a=>
  '<div class="finding '+a.sev+'"><h3>'+a.t+'</h3><p>'+a.d+'</p>'+(a.body||'')+'</div>').join('')
  : '<div class="finding low"><h3>No flags</h3><p>Nothing tripped the heuristics.</p></div>';

document.getElementById('footer').textContent = 'Generated from analysis/code/metrics.json. Re-run bun run analyze to refresh.';
</script>
</body>
</html>`;
}
