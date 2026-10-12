// Deterministic compact UML layout with obstacle-aware relationship routing.
// Import buildIpawcusDiagrams(tables, modules); outputs are returned in memory.
function buildIpawcusDiagrams(tables, modules) {
 const names=new Map(tables.map(t=>[t.name,t]));
 const pageFor=new Map(modules.flatMap((m,i)=>m.names.map(n=>[n,i+1])));
 const override={branches:"Branch",inventory_batches:"InventoryBatch",room_unit_statuses:"RoomUnitStatus",users:"User",pets_information:"Pet",pet_ownership:"PetOwnership",bookings:"Booking",queues:"Queue",vet_diagnoses:"VetDiagnosis",vet_queue_assignments:"VetQueueAssignment",vet_schedules:"OnlineVetSchedule",veterinarian_booking_clinics:"VetClinicBookingPreference",veterinarian_working_hours:"LegacyVetWorkingHours",veterinarian_booking_time_off:"LegacyVetTimeOff",veterinarian_branch_schedules:"LegacyVetClinicVisit",online_consultation_diagnoses:"OnlineConsultationDiagnosis"};
 const className=n=>override[n]||n.split("_").map((p,i,a)=>{if(i===a.length-1){if(p.endsWith("ies"))p=p.slice(0,-3)+"y";else if(p.endsWith("s")&&!p.endsWith("ss")&&!p.endsWith("status"))p=p.slice(0,-1);}return p[0].toUpperCase()+p.slice(1);}).join("");
 const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
 const type=c=>c.type==="enum"?"enum":c.type==="longtext"&&/json_valid/.test(c.definition)?"json":c.type+(c.size?"("+c.size+")":"");
 const attribute=(t,c)=>{const marks=[];if(t.pk.includes(c.name))marks.push("PK");if(t.fks.some(f=>f.columns.includes(c.name)))marks.push("FK");if(t.unique.some(k=>k.length===1&&k[0]===c.name))marks.push("UK");return "+ "+c.name+": "+type(c)+(c.nullable?" ?":"")+(marks.length?" ["+marks.join(",")+"]":"");};
 const core=["users","branches","user_branch_assignments","veterinarian_booking_clinics","pets_information","pet_ownership","bookings","vet_schedules","queues","vet_queue_assignments","vet_diagnoses","online_consultations","prescription_plans","prescription_items","prescription_occurrences","online_consultation_diagnoses"];
 const important={users:["first_Name","last_Name","role","account_status"],branches:["branch_name","status"],bookings:["booking_number","booking_date","booking_time","status"],vet_diagnoses:["diagnosis","physical_exam"],online_consultations:["scheduled_start","scheduled_end","status"],prescription_plans:["source_type","version_number","status"],prescription_items:["medicine","dose","schedule_type","status"],prescription_occurrences:["due_at","status"],pets_information:["pet_name","pet_species","pet_breed"],queues:["queue_number","status"],vet_schedules:["day_of_week","time_slot","is_available"],user_branch_assignments:["is_active","is_primary"],veterinarian_booking_clinics:["accepts_bookings"],vet_queue_assignments:["status"],pet_ownership:["relationship","is_primary"],online_consultation_diagnoses:["diagnosis"]};
 const pages=[{id:"overview",title:"Core class overview",names:core,overview:true},...modules];
 class Heap {constructor(){this.a=[];}push(v){let i=this.a.length;this.a.push(v);while(i){let p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){let top=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(this.a[c][0]>=last[0])break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return top;}get length(){return this.a.length;}}
 const hit=(a,b,r,margin=0)=>{const x=r.x-margin,y=r.y-margin,w=r.w+2*margin,h=r.h+2*margin;if(Math.abs(a.y-b.y)<0.001)return a.y>y+0.001&&a.y<y+h-0.001&&Math.max(a.x,b.x)>x+0.001&&Math.min(a.x,b.x)<x+w-0.001;if(Math.abs(a.x-b.x)<0.001)return a.x>x+0.001&&a.x<x+w-0.001&&Math.max(a.y,b.y)>y+0.001&&Math.min(a.y,b.y)<y+h-0.001;throw Error("Non-orthogonal path");};
 const simplify=points=>points.filter((p,i)=>{if(i===0||i===points.length-1)return true;const a=points[i-1],b=points[i+1];return !((a.x===p.x&&p.x===b.x)||(a.y===p.y&&p.y===b.y));});
 for(const page of pages){
  const owned=page.names.map(n=>names.get(n));
  page.edges=owned.flatMap(t=>t.fks.filter(f=>!page.overview||page.names.includes(f.table)).map(f=>({source:t.name,target:f.table,columns:f.columns,references:f.references,constraint:f.constraint,nullable:f.columns.some(c=>t.columns.find(col=>col.name===c)?.nullable),childMultiplicity:[t.pk,...t.unique].some(k=>k.length&&k.every(c=>f.columns.includes(c)))?"0..1":"0..*"})));
  const referenceNames=[...new Set(page.edges.map(e=>e.target).filter(n=>!page.names.includes(n)))].sort();
  const degree=n=>page.edges.filter(e=>e.target===n).length;
  const nodes=[...page.names,...referenceNames].map(n=>{
   const t=names.get(n),reference=!page.names.includes(n);
   const columns=reference?t.columns.filter(c=>t.pk.includes(c.name)):page.overview?t.columns.filter(c=>t.pk.includes(c.name)||t.fks.some(f=>f.columns.includes(c.name))||(important[n]||[]).includes(c.name)):t.columns;
   const attrs=columns.map(c=>attribute(t,c));
   return {id:n,className:className(n),reference,page:pageFor.get(n),columns:columns.map(c=>c.name),attrs,w:Math.max(340,Math.ceil((Math.max(className(n).length*1.25,n.length,...attrs.map(a=>a.length))*7+32)/20)*20),h:Math.max(68+attrs.length*18,76+degree(n)*18)};
  });
  const commonWidth=Math.max(...nodes.map(n=>n.w));
  nodes.forEach(n=>n.w=commonWidth);
  const ownedNodes=nodes.slice(0,page.names.length),cols=page.overview?4:3,xGap=120,yGap=90;
  const columnY=Array(cols).fill(150);
  ownedNodes.forEach((n,index)=>{const col=index%cols;n.x=110+col*(commonWidth+xGap);n.y=columnY[col];columnY[col]+=n.h+yGap;});
  const y=Math.max(...columnY);
  let refY=150;
  nodes.slice(ownedNodes.length).forEach(n=>{n.x=110+cols*(commonWidth+xGap);n.y=refY;refY+=n.h+80;});
  page.nodes=nodes;page.width=Math.max(...nodes.map(n=>n.x+n.w))+110;page.height=Math.max(y-yGap,refY-80)+100;
  const nodeMap=new Map(nodes.map(n=>[n.id,n]));
  const targetCounts=new Map();
  page.edges.forEach((e,i)=>{
   e.id=page.id+"-edge-"+i;
   const s=nodeMap.get(e.source),t=nodeMap.get(e.target),self=s.id===t.id;
   const right=self||s.x<t.x||s.x===t.x;
   e.sourceSide=right?"R":"L";e.targetSide=self||s.x===t.x?"R":right?"L":"R";
   const sourceIndex=Math.max(0,s.columns.indexOf(e.columns[0]));
   e.start={x:e.sourceSide==="R"?s.x+s.w:s.x,y:s.y+60+sourceIndex*18};
   const index=targetCounts.get(t.id)||0;targetCounts.set(t.id,index+1);
   e.end={x:e.targetSide==="R"?t.x+t.w:t.x,y:t.y+62+index*18};
   const pad=self?56+16*(i%3):56;
   e.startAnchor={x:e.start.x+(e.sourceSide==="R"?pad:-pad),y:e.start.y};
   e.endAnchor={x:e.end.x+(e.targetSide==="R"?pad:-pad),y:e.end.y};
  });
  // Each endpoint gets its own docking row. This prevents source and target
  // captions from being stacked on top of one another at a shared port.
  const ports=new Map();
  for(const edge of page.edges)for(const kind of ['start','end']){
   const owner=kind==='start'?edge.source:edge.target;
   const side=kind==='start'?edge.sourceSide:edge.targetSide;
   const key=owner+':'+side;
   if(!ports.has(key))ports.set(key,[]);
   ports.get(key).push({edge,kind,owner,desired:edge[kind].y});
  }
  for(const group of ports.values()){
   group.sort((a,b)=>a.desired-b.desired||a.edge.id.localeCompare(b.edge.id)||a.kind.localeCompare(b.kind));
   const node=nodeMap.get(group[0].owner),low=node.y+28,high=node.y+node.h-16;
   if((group.length-1)*18>high-low)throw Error('Insufficient individual docking rows for '+node.id);
   let previous=low-18;
   group.forEach(port=>{port.y=Math.max(low,port.desired,previous+18);previous=port.y;});
   for(let index=group.length-1;index>=0;index--)group[index].y=Math.min(group[index].y,high-(group.length-1-index)*18);
   for(const port of group){port.edge[port.kind].y=port.y;port.edge[port.kind+'Anchor'].y=port.y;}
  }
  const caption=(edge,kind,text)=>{
   const endpoint=edge[kind],side=kind==='start'?edge.sourceSide:edge.targetSide;
   const w=text.length*7+2;
   return {text,owner:kind==='start'?edge.source:edge.target,endpoint:kind,lineY:endpoint.y,
    x:side==='R'?endpoint.x+12:endpoint.x-12-w,y:endpoint.y-14,w,h:10,baselineOffset:9};
  };
  page.edges.forEach(edge=>{edge.labels=[caption(edge,'start',edge.childMultiplicity),caption(edge,'end',edge.nullable?'0..1':'1')];});
  // Reserve all captions before routing any relationship, rather than hiding
  // interfering connectors behind a white text background.
  const captions=page.edges.flatMap(edge=>edge.labels);
  const obstacles=[...nodes.map(n=>({x:n.x-22,y:n.y-22,w:n.w+44,h:n.h+44})),
   ...captions.map(l=>({x:l.x-2,y:l.y-2,w:l.w+4,h:l.h+4}))];
  const xs=[40,page.width-40,...obstacles.flatMap(o=>[o.x,o.x+o.w]),...page.edges.flatMap(e=>[e.startAnchor.x,e.endAnchor.x])].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]);
  const ys=[110,page.height-40,...obstacles.flatMap(o=>[o.y,o.y+o.h]),...page.edges.flatMap(e=>[e.startAnchor.y,e.endAnchor.y])].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]);
  const W=xs.length,H=ys.length,blocked=new Uint8Array(W*H),xIdx=new Map(xs.map((x,i)=>[x,i])),yIdx=new Map(ys.map((v,i)=>[v,i]));
  for(let yi=0;yi<H;yi++)for(let xi=0;xi<W;xi++)if(obstacles.some(o=>xs[xi]>o.x+0.001&&xs[xi]<o.x+o.w-0.001&&ys[yi]>o.y+0.001&&ys[yi]<o.y+o.h-0.001))blocked[yi*W+xi]=1;
  const adjacency=Array.from({length:W*H},()=>[]);
  for(let yi=0;yi<H;yi++)for(let xi=0;xi<W;xi++){
   const index=yi*W+xi;if(blocked[index])continue;
   for(const [dx,dy,dir]of[[1,0,0],[-1,0,1],[0,1,2],[0,-1,3]]){
    const nx=xi+dx,ny=yi+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
    const next=ny*W+nx;if(blocked[next])continue;
    const a={x:xs[xi],y:ys[yi]},b={x:xs[nx],y:ys[ny]};
    if(obstacles.some(o=>hit(a,b,o)))continue;
    adjacency[index].push({next,dir,length:Math.abs(a.x-b.x)+Math.abs(a.y-b.y)});
   }
  }
  const used=new Map();
  for(const edge of page.edges){
   const start=yIdx.get(edge.startAnchor.y)*W+xIdx.get(edge.startAnchor.x),goal=yIdx.get(edge.endAnchor.y)*W+xIdx.get(edge.endAnchor.x);
   const costs=new Float64Array(W*H*4);costs.fill(Infinity);
   const previous=new Int32Array(W*H*4);previous.fill(-1);
   const heap=new Heap(),gxi=goal%W,gyi=Math.floor(goal/W);
   const heuristic=index=>Math.abs(xs[index%W]-xs[gxi])+Math.abs(ys[Math.floor(index/W)]-ys[gyi]);
   for(let dir=0;dir<4;dir++){costs[start*4+dir]=0;heap.push([heuristic(start),start*4+dir,0]);}
   let found=-1;
   while(heap.length){
    const [,state,g]=heap.pop();if(g!==costs[state])continue;
    const index=Math.floor(state/4),dir=state%4;if(index===goal){found=state;break;}
    for(const a of adjacency[index]){
     // Keep the full horizontal docking stub under its own caption. A route
     // must not reverse into the box immediately after leaving an endpoint.
     if(index===start&&a.dir===(edge.sourceSide==='R'?1:0))continue;
     if(a.next===goal&&a.dir===(edge.targetSide==='R'?0:1))continue;
     const nextState=a.next*4+a.dir,key=index<a.next?index+":"+a.next:a.next+":"+index;
     const candidate=g+a.length+(a.dir===dir?0:42)+(used.get(key)||0)*24;
     if(candidate<costs[nextState]){costs[nextState]=candidate;previous[nextState]=state;heap.push([candidate+heuristic(a.next),nextState,candidate]);}
    }
   }
   if(found<0)throw Error("No obstacle-free route for "+edge.constraint+" on "+page.id);
   const gridPath=[];for(let at=found;at>=0;at=previous[at]){const index=Math.floor(at/4);gridPath.push(index);}gridPath.reverse();
   for(let i=1;i<gridPath.length;i++){const a=gridPath[i-1],b=gridPath[i],key=a<b?a+":"+b:b+":"+a;used.set(key,(used.get(key)||0)+1);}
   edge.points=simplify([edge.start,...gridPath.map(i=>({x:xs[i%W],y:ys[Math.floor(i/W)]})),edge.end]);
   for(const label of edge.labels){
    const at=label.endpoint==='start'?0:edge.points.length-2;
    const first=edge.points[at],last=edge.points[at+1];
    if(first.y!==last.y||first.y!==label.lineY||Math.min(first.x,last.x)>label.x||Math.max(first.x,last.x)<label.x+label.w)throw Error('A caption is not over its own endpoint segment: '+edge.id);
   }
   for(let i=1;i<edge.points.length;i++)for(const node of nodes)if(hit(edge.points[i-1],edge.points[i],node))throw Error("Line crosses a class: "+edge.constraint+" / "+node.id);
   for(const label of edge.labels)for(const n of nodes)if(label.x<n.x+n.w&&label.x+label.w>n.x&&label.y<n.y+n.h&&label.y+label.h>n.y)throw Error("Multiplicity overlaps class: "+edge.constraint+" / "+n.id);
  }
  const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  captions.forEach((label,index)=>{
   if(label.y+label.h>=label.lineY)throw Error('A caption is not above its own line.');
   if(captions.slice(index+1).some(other=>intersects(label,other)))throw Error('Relationship captions overlap on '+page.id);
   for(const edge of page.edges)for(let i=1;i<edge.points.length;i++)if(hit(edge.points[i-1],edge.points[i],label,2))throw Error('A connector crosses relationship text on '+page.id);
  });
 }
 const neutral="#2d3748",muted="#596579",line="#8793a3",border="#c4cbd4";
 const svg=page=>{
  const title=page.overview?"iPawcus / Core class overview":"iPawcus / "+page.title;
  const subtitle=page.overview?"Selected core attributes. See the module pages for every schema field.":"Complete attributes for this module; reference boxes link to other pages.";
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title desc">`,`<title id="title">${esc(title)}</title><desc id="desc">UML entity class diagram. Relationship lines avoid all unrelated class boxes. Source: iPawcus_ERD_Schema.sql.</desc>`,`<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4.5 L0 9" fill="none" stroke="${line}" stroke-width="1.4"/></marker></defs>`,`<rect width="100%" height="100%" fill="#ffffff"/>`,`<text x="110" y="45" font-family="Arial,sans-serif" font-size="26" font-weight="600" fill="${neutral}">${esc(title)}</text>`,`<text x="110" y="76" font-family="Arial,sans-serif" font-size="14" fill="${muted}">${esc(subtitle)}</text>`,`<text x="110" y="100" font-family="Arial,sans-serif" font-size="13" fill="${muted}">1 required · 0..1 optional · 0..* zero-to-many · ? nullable · PK primary key · FK foreign key · UK unique key</text>`];
  for(const e of page.edges)parts.push(`<path d="${e.points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ")}" fill="none" stroke="${line}" stroke-width="1.2" stroke-linejoin="round" marker-end="url(#arrow)"><title>${esc(e.source+"."+e.columns.join(",")+" → "+e.target+"."+e.references.join(",")+" ["+e.constraint+"]")}</title></path>`);
  for(const n of page.nodes){
   parts.push(`<g id="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${n.reference?"#f8fafc":"#ffffff"}" stroke="${border}" stroke-width="1.2"${n.reference?' stroke-dasharray="5 4"':""}/><line x1="${n.x}" y1="${n.y+48}" x2="${n.x+n.w}" y2="${n.y+48}" stroke="${border}"/><text x="${n.x+16}" y="${n.y+23}" font-family="Arial,sans-serif" font-size="17" font-weight="600" fill="${neutral}">${esc(n.className)}</text><text x="${n.x+16}" y="${n.y+40}" font-family="Arial,sans-serif" font-size="11.5" fill="${muted}">${esc(n.id+(n.reference?" · reference / page "+String(n.page).padStart(2,"0"):""))}</text>`);
   n.attrs.forEach((a,i)=>parts.push(`<text x="${n.x+14}" y="${n.y+64+i*18}" font-family="Consolas,monospace" font-size="12" fill="${neutral}">${esc(a)}</text>`));
   if(n.reference)parts.push(`<text x="${n.x+14}" y="${n.y+n.h-12}" font-family="Arial,sans-serif" font-size="11.5" fill="${muted}">Full class on page ${String(n.page).padStart(2,"0")}</text>`);
   parts.push("</g>");
  }
  for(const e of page.edges)for(const l of e.labels)parts.push(`<text x="${l.x}" y="${l.y+l.baselineOffset}" font-family="Consolas,monospace" font-size="11.5" fill="${muted}" data-relationship="${e.id}" data-endpoint="${l.endpoint}">${esc(l.text)}</text>`);
  parts.push("</svg>");return parts.join("\n");
 };
 const mx=[];
 for(const [i,page]of pages.entries()){
  mx.push(`<diagram id="${page.id}" name="${String(i).padStart(2,"0")} - ${esc(page.title)}"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`);
  mx.push(`<mxCell id="title" value="iPawcus / ${esc(page.title)}" style="text;html=0;align=left;fontSize=26;fontStyle=1;fontColor=${neutral};strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="110" y="15" width="${page.width-220}" height="40" as="geometry"/></mxCell>`);
  mx.push(`<mxCell id="legend" value="1 required · 0..1 optional · 0..* zero-to-many · ? nullable · PK/FK/UK keys. Arrows reference the parent class. SQL schema only; no inferred methods." style="text;html=0;align=left;fontSize=13;fontColor=${muted};strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="110" y="63" width="${page.width-220}" height="42" as="geometry"/></mxCell>`);
  for(const n of page.nodes){
   mx.push(`<mxCell id="${n.id}" value="${esc(n.className)}&#xa;${esc(n.id+(n.reference?" · ref / page "+String(n.page).padStart(2,"0"):""))}" style="swimlane;html=0;startSize=48;horizontal=1;align=left;spacingLeft=14;fontSize=15;fontStyle=1;fontColor=${neutral};fillColor=${n.reference?"#f8fafc":"#ffffff"};swimlaneFillColor=${n.reference?"#f8fafc":"#ffffff"};strokeColor=${border};strokeWidth=1.2;rounded=0;collapsible=0;${n.reference?"dashed=1;":""}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`);
   n.attrs.forEach((a,index)=>mx.push(`<mxCell id="${n.id}-attribute-${index}" value="${esc(a)}" style="text;html=0;whiteSpace=nowrap;overflow=hidden;align=left;verticalAlign=middle;spacingLeft=14;strokeColor=none;fillColor=none;fontFamily=Consolas;fontSize=12;fontColor=${neutral};" vertex="1" parent="${n.id}"><mxGeometry y="${50+index*18}" width="${n.w}" height="18" as="geometry"/></mxCell>`));
  }
  for(const e of page.edges){
   const s=page.nodes.find(n=>n.id===e.source),t=page.nodes.find(n=>n.id===e.target),tooltip=e.source+"."+e.columns.join(",")+" → "+e.target+"."+e.references.join(",")+"; "+e.constraint;
   mx.push(`<object id="${e.id}" label="" tooltip="${esc(tooltip)}"><mxCell style="edgeStyle=none;html=0;rounded=0;orthogonal=1;endArrow=open;endFill=0;endSize=8;strokeColor=${line};strokeWidth=1.2;jumpStyle=arc;jumpSize=5;exitX=${e.sourceSide==="R"?1:0};exitY=${(e.start.y-s.y)/s.h};exitPerimeter=0;entryX=${e.targetSide==="R"?1:0};entryY=${(e.end.y-t.y)/t.h};entryPerimeter=0;" edge="1" parent="1" source="${e.source}" target="${e.target}"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(p=>`<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array></mxGeometry></mxCell></object>`);
   for(const [j,l]of e.labels.entries())mx.push(`<mxCell id="${e.id}-multiplicity-${j}" value="${l.text}" style="edgeLabel;html=0;align=left;verticalAlign=middle;spacing=0;fontFamily=Consolas;fontSize=11.5;fontColor=${muted};fillColor=none;strokeColor=none;resizable=0;points=[];" vertex="1" connectable="0" parent="${e.id}"><mxGeometry x="${j===0?-1:1}" y="0" width="${l.w}" height="${l.h}" relative="1" as="geometry"><mxPoint x="${l.x-(j===0?e.start.x:e.end.x)}" y="${l.y-(j===0?e.start.y:e.end.y)}" as="offset"/></mxGeometry></mxCell>`);
  }
  mx.push("</root></mxGraphModel></diagram>");
 }
 const drawio=`<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-10-06T00:00:00.000Z" agent="Codex" type="device" compressed="false">\n${mx.join("\n")}\n</mxfile>`;
 const files={"ipawcus-class-diagram.drawio":drawio};
 pages.forEach((p,i)=>files[`${String(i).padStart(2,"0")}-${p.id}.svg`]=svg(p));
 const fullMermaid=["classDiagram","direction LR","%% Generated from iPawcus_ERD_Schema.sql; actual SQL entity attributes."];
 tables.forEach(t=>{fullMermaid.push(`class ${className(t.name)} {`);t.columns.forEach(c=>{let merType=c.type==="enum"?"enum":c.type==="longtext"&&/json_valid/.test(c.definition)?"json":c.type;fullMermaid.push(`    +${merType} ${c.name}`);});fullMermaid.push("}");});
 tables.forEach(t=>t.fks.forEach(f=>{const unique=[t.pk,...t.unique].some(k=>k.length&&k.every(c=>f.columns.includes(c)));const optional=f.columns.some(c=>t.columns.find(a=>a.name===c)?.nullable);fullMermaid.push(`${className(t.name)} "${unique?"0..1":"0..*"}" --> "${optional?"0..1":"1"}" ${className(f.table)} : ${f.columns.join("_and_")}`);}));
 files["full-schema.mmd"]=fullMermaid.join("\n");
 files["layout.json"]=JSON.stringify({source:"C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql",tableCount:tables.length,columnCount:tables.reduce((n,t)=>n+t.columns.length,0),foreignKeyCount:tables.reduce((n,t)=>n+t.fks.length,0),pages},null,2);
 const md=["# iPawcus class diagram","", "Source: `C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql` (2026-10-06).","",`Coverage: **${tables.length} tables, ${tables.reduce((n,t)=>n+t.columns.length,0)} attributes, ${tables.reduce((n,t)=>n+t.fks.length,0)} declared foreign keys**.`, "", "Open `ipawcus-class-diagram.drawio` in diagrams.net for an editable, ten-page class diagram. Open `00-overview.svg` for the main diagram; the remaining SVG files show all module details. The original schema and existing project diagram are not modified.","","## Reading the diagram","","- Class names are UML-friendly aliases of the exact SQL table names shown underneath.","- Attributes preserve SQL column names and types. `?` means nullable; `PK`, `FK`, and `UK` identify primary, foreign, and single-column unique keys.","- Enum values and composite unique constraints are preserved in the schema metadata, not expanded inside every class box.","- Multiplicities come from nullability and uniqueness in the SQL. SQL does not require parents to have children, so the minimum child count is zero.","- Association arrows point from the class holding the foreign key to the referenced parent class.","- Dashed boxes are references to classes whose full definition is on another module page, not additional tables.","- Every declared foreign key appears on its source class's module page. Core associations are repeated in the overview for context.","- This is a persistent-entity UML class model, not a claim that the PHP backend contains matching object-oriented classes. Methods are omitted because SQL does not define application operations.","","## Layout validation","","Each relation is routed on an orthogonal, obstacle-aware grid. All class rectangles are treated as obstacles with 22-pixel routing clearance. An independent segment/rectangle check rejects any line entering a class box; source and target endpoints only touch their boundaries. Every multiplicity is placed above its own horizontal relationship segment, 12 pixels from the adjacent class box. Source and target captions each have their own docking row; labels are never combined into a grouped list. Each caption is reserved as a routing obstacle with 2-pixel clearance, so text cannot touch another connector, caption, or class box. The editable diagram attaches each caption to its own relationship endpoint. The compact class-box arrangement is preserved. The saved initial layout is collision-checked. Moving a box manually may require rerouting its connectors.","","## Source limitations","","- `clinical_intakes` is absent from this schema even though the current application uses it for admin physical examinations; no fictional SQL class was added.","- `bookings.veterinarian_id` is `varchar(50)` and has no declared foreign key to `users.user_id`. The application's assigned-vet relationship is not represented as a declared SQL association.","- `consent_form_records` has reference-like ID columns but no declared foreign keys in this file. The class is shown without invented associations.","- Legacy `veterinarian_working_hours`, `veterinarian_booking_time_off`, and `veterinarian_branch_schedules` tables remain in the supplied schema and are retained in the diagram; the current booking flow no longer uses them for scheduling.","","## Pages","",...pages.map((p,i)=>`${i}. ${p.title} — ${p.names.length} full classes${p.overview?" (overview uses selected attributes)":""}`),"","## Exact table-to-class mapping","","| SQL table | UML class | Module page |","| --- | --- | --- |",...tables.map(t=>`| ${t.name} | ${className(t.name)} | ${String(pageFor.get(t.name)).padStart(2,"0")} |`),"","## Declared relationships","","| Child / foreign-key fields | Parent / key fields | Child count | Parent count | Constraint |","| --- | --- | --- | --- | --- |"];
 tables.forEach(t=>t.fks.forEach(f=>{const unique=[t.pk,...t.unique].some(k=>k.length&&k.every(c=>f.columns.includes(c)));const optional=f.columns.some(c=>t.columns.find(a=>a.name===c)?.nullable);md.push(`| ${t.name}.${f.columns.join(",")} | ${f.table}.${f.references.join(",")} | ${unique?"0..1":"0..*"} | ${optional?"0..1":"1"} | ${f.constraint} |`);}));
 files["README.md"]=md.join("\n");
 files["schema-model.json"]=JSON.stringify({tables,modules},null,2);
 return {files,pages,statistics:{tables:tables.length,attributes:tables.reduce((n,t)=>n+t.columns.length,0),declaredRelations:tables.reduce((n,t)=>n+t.fks.length,0),pages:pages.length,routedRelations:pages.reduce((n,p)=>n+p.edges.length,0),boxIntersections:0,labelIntersections:0,labelLineIntersections:0,labelLabelIntersections:0,relationshipLabels:pages.reduce((n,p)=>n+p.edges.length*2,0),labelsAboveOwnLine:pages.reduce((n,p)=>n+p.edges.length*2,0)}};
}
export { buildIpawcusDiagrams };
