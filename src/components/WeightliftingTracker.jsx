import { useState, useRef, useEffect, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const C={bg:"#08090C",s1:"#111318",s2:"#181B24",brd:"rgba(255,255,255,0.04)",brdL:"rgba(255,255,255,0.08)",tx:"#F2F2F4",tx2:"#9194A0",tx3:"#555866",ac:"#7B6FFF",acS:"rgba(123,111,255,0.12)",g:"#22C993",gS:"rgba(34,201,147,0.1)",o:"#F5A623",oS:"rgba(245,166,35,0.1)",r:"#EF4B4B",rS:"rgba(239,75,75,0.1)",b:"#3B8DF0",bS:"rgba(59,141,240,0.1)",coach:"#D4538E",coachS:"rgba(212,83,142,0.12)"};
const BT={PERF:{c:"#EF4B4B",l:"Mvt principal"},ESTH:{c:"#7B6FFF",l:"Hypertrophie"},BESOIN:{c:"#F5A623",l:"Besoin indiv."},ASSOC:{c:"#22C993",l:"Muscles assoc."},CORE:{c:"#9194A0",l:"Core"}};
const BLOC_COLORS=["#EF4B4B","#7B6FFF","#F5A623","#22C993","#9194A0","#3B8DF0","#D4538E","#C060D0","#E06030","#22C9C9"];
// Returns the blocs array for a session, with fallback for old data (BT keys)
const getSessionBlocs=(sess,exList)=>{
  if(sess?.blocs?.length>0)return sess.blocs;
  const used=[...new Set((exList||[]).map(e=>e.bloc).filter(Boolean))];
  if(!used.length)return[];
  return used.map((k,i)=>{const bt=BT[k];return bt?{id:k,label:bt.l,color:bt.c}:{id:k,label:k,color:BLOC_COLORS[i%BLOC_COLORS.length]};});
};

const MTREE=[{id:"Pecs",c:C.r,s:[]},{id:"Dos",c:C.g,s:[{id:"Dos-Trap"},{id:"Dos-GD"},{id:"Dos-Rhom"},{id:"Dos-Erec"}]},{id:"Epaules",c:C.ac,s:[{id:"Ep-Ant"},{id:"Ep-Lat"},{id:"Ep-Post"}]},{id:"Quads",c:C.b,s:[]},{id:"Ischios",c:C.o,s:[]},{id:"Fessiers",c:"#D4538E",s:[]},{id:"Adducteurs",c:"#C060D0",s:[]},{id:"Triceps",c:"#E06030",s:[]},{id:"Biceps",c:"#30B0E0",s:[]},{id:"Core",c:C.tx2,s:[]},{id:"Mollets",c:"#8060E0",s:[{id:"Mol-G"},{id:"Mol-S"}]},{id:"AB",c:"#60E080",s:[{id:"AB-F"},{id:"AB-E"}]}];
const ML={"Pecs":"Pecs","Dos":"Dos","Dos-Trap":"Trapeze","Dos-GD":"Gd. dorsal","Dos-Rhom":"Rhomboides","Dos-Erec":"Erecteurs","Epaules":"Epaules","Ep-Ant":"Ep. Ant.","Ep-Lat":"Ep. Lat.","Ep-Post":"Ep. Post.","Quads":"Quads","Ischios":"Ischios","Fessiers":"Fessiers","Adducteurs":"Adducteurs","Triceps":"Triceps","Biceps":"Biceps","Core":"Core","Mollets":"Mollets","Mol-G":"Gastro.","Mol-S":"Solaire","AB":"Avant-bras","AB-F":"Flechisseurs","AB-E":"Extenseurs"};
const getMC=id=>{for(const g of MTREE){if(g.id===id)return g.c;if(g.s?.some(s=>s.id===id))return g.c;}return C.ac;};
const mL=id=>ML[id]||id;
const ALL_MIDS=MTREE.flatMap(g=>g.s.length?[g.id,...g.s.map(s=>s.id)]:[g.id]);
// Helper: normalize primary to array for backward compat (old data stores string)
const normPrimary=p=>!p?[]:Array.isArray(p)?p:[p];

const DEF_SESSIONS=[];
const EX_TIER={"Dev. couche barre":1,"Back squat":1,"Traction lestee":1,"Dips lestes":2,"Dev. incline halt.":2,"Hack squat":2,"Belt squat":2,"Bulgarian split sq.":2,"DB press assis":2,"Chest-supp. row":2,"Rowing cable assis":2,"Elev. lat. cable":3,"Elev. lat. halt.":3,"Leg extension":3,"Leg curl machine":3,"Cable crossover":3,"Dev. machine incl.":3,"Pallof press":3};
const DEF_META={"Dev. couche barre":{primary:"Pecs",secondary:["Triceps","Ep-Ant"]},"Dev. incline halt.":{primary:"Pecs",secondary:["Triceps","Ep-Ant"]},"Elev. lat. cable":{primary:"Ep-Lat",secondary:[]},"Rowing cable assis":{primary:"Dos-GD",secondary:["Biceps","AB-F"]},"Leg curl machine":{primary:"Ischios",secondary:["Fessiers"]},"Pallof press":{primary:"Core",secondary:[]},"Back squat":{primary:"Quads",secondary:["Fessiers","Ischios","Core"]},"Hack squat":{primary:"Quads",secondary:["Fessiers"]},"Leg extension":{primary:"Quads",secondary:[]},"Dev. machine incl.":{primary:"Pecs",secondary:["Ep-Ant","Triceps"]},"Traction lestee":{primary:"Dos-GD",secondary:["Biceps","AB-F"]},"Elev. lat. halt.":{primary:"Ep-Lat",secondary:[]},"Bulgarian split sq.":{primary:"Quads",secondary:["Fessiers","Ischios"]},"Cable crossover":{primary:"Pecs",secondary:[]},"Chest-supp. row":{primary:"Dos-Rhom",secondary:["Biceps"]},"Belt squat":{primary:"Quads",secondary:["Fessiers"]},"DB press assis":{primary:"Ep-Ant",secondary:["Triceps"]},"Dips lestes":{primary:"Pecs",secondary:["Triceps","Ep-Ant"]}};

const INIT_EXOS={
  bv:[{id:"e1",name:"Dev. couche barre",bloc:"PERF",target:"Pecs",weeks:{1:{kg:80,sets:4,repsRange:"10",rir:2.5,tempo:"3-1-2-0"},2:{kg:80,sets:4,repsRange:"10",rir:2},3:{kg:82.5,sets:4,repsRange:"10",rir:2},4:{kg:82.5,sets:4,repsRange:"10-12",rir:2.5},5:{kg:85,sets:4,repsRange:"10",rir:1.5}}},{id:"e2",name:"Dev. incline halt.",bloc:"ESTH",target:"Pecs",weeks:{1:{kg:28,sets:3,repsRange:"12",rir:2},2:{kg:28,sets:3,repsRange:"12",rir:2},3:{kg:30,sets:3,repsRange:"10-12",rir:1.5}}},{id:"e3",name:"Elev. lat. cable",bloc:"ESTH",target:"Ep-Lat",weeks:{1:{kg:8,sets:3,repsRange:"15",rir:2.5},2:{kg:8,sets:3,repsRange:"15",rir:2.5,method:"dropset",methodParams:{drops:2,pct:20}}}},{id:"e4",name:"Rowing cable assis",bloc:"ASSOC",target:"Dos-GD",weeks:{1:{kg:55,sets:3,repsRange:"12",rir:2.5}}},{id:"e5",name:"Leg curl machine",bloc:"ASSOC",target:"Ischios",weeks:{1:{kg:40,sets:3,repsRange:"12",rir:2.5}}},{id:"e6",name:"Pallof press",bloc:"CORE",target:"Core",weeks:{1:{kg:10,sets:3,repsRange:"12",rir:3.5}}}],
  sv:[{id:"e7",name:"Back squat",bloc:"PERF",target:"Quads",weeks:{1:{kg:100,sets:4,repsRange:"10",rir:2.5},2:{kg:100,sets:4,repsRange:"10",rir:2},3:{kg:102.5,sets:4,repsRange:"8-10",rir:2}}},{id:"e8",name:"Hack squat",bloc:"ESTH",target:"Quads",weeks:{1:{kg:80,sets:3,repsRange:"12",rir:2}}},{id:"e9",name:"Leg extension",bloc:"ESTH",target:"Quads",weeks:{1:{kg:50,sets:3,repsRange:"15",rir:2,method:"myoreps",methodParams:{activation:15,minisets:4,reps_mini:5,pause:5}}}},{id:"e10",name:"Dev. machine incl.",bloc:"ASSOC",target:"Pecs",weeks:{1:{kg:40,sets:3,repsRange:"12",rir:2.5}}}],
  tv:[{id:"e11",name:"Traction lestee",bloc:"PERF",target:"Dos-GD",weeks:{1:{kg:10,sets:4,repsRange:"10",rir:2},2:{kg:12.5,sets:4,repsRange:"10",rir:1.5}}},{id:"e12",name:"Elev. lat. halt.",bloc:"ESTH",target:"Ep-Lat",weeks:{1:{kg:10,sets:3,repsRange:"15",rir:2.5}}},{id:"e13",name:"Bulgarian split sq.",bloc:"ASSOC",target:"Quads",weeks:{1:{kg:20,sets:3,repsRange:"10",rir:2.5}}}],
  bi:[{id:"e14",name:"Dev. couche barre",bloc:"PERF",target:"Pecs",weeks:{1:{kg:92.5,sets:5,repsRange:"5",rir:1},2:{kg:95,sets:5,repsRange:"5",rir:0.5}}},{id:"e15",name:"Cable crossover",bloc:"ESTH",target:"Pecs",weeks:{1:{kg:15,sets:3,repsRange:"15",rir:2.5,method:"restpause",methodParams:{rounds:3,pause:15}}}},{id:"e16",name:"Chest-supp. row",bloc:"ASSOC",target:"Dos-Rhom",weeks:{1:{kg:35,sets:3,repsRange:"12",rir:2.5}}}],
  si:[{id:"e17",name:"Back squat",bloc:"PERF",target:"Quads",weeks:{1:{kg:120,sets:5,repsRange:"5",rir:1},2:{kg:122.5,sets:5,repsRange:"5",rir:0.5}}},{id:"e18",name:"Belt squat",bloc:"ESTH",target:"Quads",weeks:{1:{kg:60,sets:3,repsRange:"8-10",rir:2}}}],
  ti:[{id:"e19",name:"Traction lestee",bloc:"PERF",target:"Dos-GD",weeks:{1:{kg:20,sets:5,repsRange:"5",rir:1},2:{kg:22.5,sets:5,repsRange:"5",rir:0.5}}},{id:"e20",name:"DB press assis",bloc:"ESTH",target:"Ep-Ant",weeks:{1:{kg:22,sets:3,repsRange:"10",rir:2}}},{id:"e21",name:"Dips lestes",bloc:"ASSOC",target:"Pecs",weeks:{1:{kg:15,sets:3,repsRange:"10",rir:2.5}}}]
};


const RIR_OPTS=[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5];
const rL=v=>v>=5.5?"5+":String(v);
const rC=r=>{const n=typeof r==="number"?r:parseFloat(r)||0;return n<=0?C.r:n<=1?C.o:n<=2.5?C.ac:C.g;};
const parseReps=r=>{const m=String(r||"").match(/(\d+)/);return m?+m[1]:0;};
const e1rm=(kg,reps)=>reps===1?kg:Math.round(kg*(1+reps/30));
// Normalize exercise name: strip tempo/pause/parenthetical suffixes to find base exercise
const normalizeExName=(n)=>{let s=(n||"").trim();s=s.replace(/\s*\([^)]*\)\s*/g,"").trim();s=s.replace(/\s+(tempo|pause|isométrique|isometrique|iso|lent|explosif|excentrique|concentrique)\s*$/i,"").trim();return s;};
const getAllPRs=exos=>{const p={};Object.values(exos).flat().forEach(ex=>{const norm=normalizeExName(ex.name);Object.entries(ex.weeks||{}).forEach(([wk,w])=>{if(!w?.kg)return;const est=e1rm(w.kg,parseReps(w.repsRange)||1);if(!p[norm]||est>p[norm].est)p[norm]={kg:w.kg,reps:parseReps(w.repsRange),est,week:+wk,name:norm};});});return p;};
const getMuscSets=(exos,exMeta)=>{const s={};Object.values(exos).flat().filter(ex=>{const et=ex.exType||(ex.isFlexibility?"mobilite":"muscu");return et==="muscu";}).forEach(ex=>{const lw=Math.max(...Object.keys(ex.weeks||{}).map(Number).filter(Boolean),0);if(!lw)return;const sets=ex.weeks[lw].sets||0;const meta=exMeta?.[ex.name]||exMeta?.[normalizeExName(ex.name)]||{};const primaries=normPrimary(meta.primary||ex.target);primaries.forEach(m=>{s[m]=(s[m]||0)+sets;});(meta.secondary||[]).forEach(m=>{s[m]=(s[m]||0)+sets*0.5;});});const r={};Object.entries(s).forEach(([k,v])=>{r[k]=Math.round(v);});return r;};
const get1rmByWeek=(exos,name,tw)=>{const b={};const totalW=tw||6;const normTarget=normalizeExName(name).toLowerCase();Object.values(exos).flat().filter(e=>normalizeExName(e.name).toLowerCase()===normTarget).forEach(ex=>{Object.entries(ex.weeks||{}).forEach(([wk,w])=>{if(!w?.kg)return;const est=e1rm(w.kg,parseReps(w.repsRange)||1);if(!b[wk]||est>b[wk])b[wk]=est;});});return Array.from({length:totalW},(_,i)=>i+1).map(w=>({week:"S"+w,val:b[w]||null}));};

const getCombinedData=(exos,sets,wh,tw)=>{const totalW=tw||6;const all=Object.values(exos).flat().filter(ex=>{const et=ex.exType||(ex.isFlexibility?"mobilite":"muscu");return et==="muscu";});return Array.from({length:totalW},(_,i)=>i+1).map(w=>{const volProg=all.reduce((a,ex)=>{const wd=ex.weeks[w];return a+(wd?(wd.sets||0)*parseReps(wd.repsRange):0);},0);const hasData=all.some(ex=>(sets[ex.id+"_"+w]||[]).length>0);const volReal=hasData?all.reduce((a,ex)=>(sets[ex.id+"_"+w]||[]).filter(s=>s.done).reduce((b,s)=>b+(s.reps||0),a),0):null;const intensity=parseFloat(all.reduce((a,ex)=>{const wd=ex.weeks[w];return a+(wd?(wd.sets||0)*(typeof wd.rir==="number"?wd.rir:2):0);},0).toFixed(1));return{s:"S"+w,volProg,volReal,intensity,wellness:wh[w]??null};});};

// Dynamic Big 3: find the first PERF exercise from bench/squat/traction sessions
const getBig3=(exos)=>{
  const find=(sids)=>{for(const sid of sids){const list=exos[sid]||[];const perf=list.find(e=>e.bloc==="PERF");if(perf)return normalizeExName(perf.name);}return null;};
  return[
    {label:"Bench",name:find(["bi","bv"]),c:C.r},
    {label:"Squat",name:find(["si","sv"]),c:C.b},
    {label:"Traction",name:find(["ti","tv"]),c:C.g}
  ].filter(x=>x.name);
};
const todayKey=()=>{const d=new Date();return String(d.getFullYear())+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");};
const checkMilestone=(log,baseline)=>{const sorted=Object.entries(log).sort((a,b)=>a[0]<b[0]?-1:1);if(sorted.length<3)return null;const last3=sorted.slice(-3);return last3.every(([,kg])=>kg>baseline)?parseFloat((last3.reduce((s,[,kg])=>s+kg,0)/3).toFixed(1)):null;};
const getWeightChartData=(log,milestones,target)=>Object.entries(log).sort((a,b)=>a[0]<b[0]?-1:1).map(([date,kg])=>({d:date.slice(6)+"/"+date.slice(4,6),kg,target,isMilestone:milestones?.some(m=>m.date===date)?1:null}));
const getWellnessChartData=(wh,period)=>{const DAY=['D','L','M','Me','J','V','S'];const MON=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];const dateEntries=Object.entries(wh).filter(([k,v])=>/^\d{8}$/.test(k)&&v&&typeof v==='object');const byDate=Object.fromEntries(dateEntries);if(period==='week'){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const k=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');const e=byDate[k];return{label:DAY[d.getDay()],score:e?.score??null,sleep:e?.sleepDur??null};});}if(period==='month'){const sorted=[...dateEntries].sort((a,b)=>a[0]<b[0]?-1:1).slice(-30);return sorted.map(([k,e])=>{const y=+k.slice(0,4),m=+k.slice(4,6)-1,dd=+k.slice(6,8);const d=new Date(y,m,dd);return{label:dd===1?MON[m]:String(dd),score:e?.score??null,sleep:e?.sleepDur??null};});}if(period==='year'){const now=new Date();return Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-11+i,1);const pfx=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0');const mes=dateEntries.filter(([k])=>k.startsWith(pfx)).map(([,v])=>v);const sc=mes.filter(v=>v?.score!=null).map(v=>v.score);const sl=mes.filter(v=>v?.sleepDur!=null).map(v=>v.sleepDur);return{label:MON[d.getMonth()],score:sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):null,sleep:sl.length?Math.round(sl.reduce((a,b)=>a+b,0)/sl.length*10)/10:null};});}return[];};

// Wellness items - doms last so zones step can be inserted after
const WELL_ITEMS=[
  {k:"fatigue",q:"Récupération",lo:"Épuisé",hi:"Très reposé",inv:false},
  {k:"sommeil",q:"Qualité du sommeil",lo:"Très mauvais",hi:"Excellent",inv:false},
  {k:"stress",q:"Sérénité / mental",lo:"Très stressé",hi:"Très détendu",inv:false},
  {k:"energie",q:"Niveau d'énergie",lo:"Très bas",hi:"Très élevé",inv:false},
  {k:"doms",q:"Fraîcheur musculaire",lo:"DOMS intenses",hi:"Aucune douleur",inv:false},
];
const calcScore=w=>{if(!w)return 0;return Math.round(((w.fatigue||3)+(w.sommeil||3)+(w.stress||3)+(w.energie||3)+(w.doms||3))/25*100);};
const getReco=score=>{if(score>=80)return{label:"Optimal",desc:"Seance a pleine charge",c:C.g};if(score>=65)return{label:"Bon",desc:"Adapter si besoin",c:"#7BC67E"};if(score>=50)return{label:"Modere",desc:"Reduire volume de 10-15%",c:C.o};if(score>=35)return{label:"Fatigue",desc:"Seance legere recommandee",c:"#F07030"};return{label:"Surmenage",desc:"Repos ou recuperation active",c:C.r};};
const getAlerts=w=>{const a=[];if(w?.fatigue<=2)a.push("Récupération faible: surveiller la technique");if(w?.doms<=2)a.push("DOMS intenses: adapter les muscles cibles");if(w?.stress<=2)a.push("Stress élevé: séance technique recommandée");if(w?.energie<=2)a.push("Énergie faible: réduire le volume");return a;};

const DEF_METHODS={myoreps:{label:"Myoreps",c:"#7B6FFF",e:"MR"},dropset:{label:"Dropset",c:"#F5A623",e:"DS"},restpause:{label:"Rest-pause",c:"#EF4B4B",e:"RP"},superset:{label:"Superset",c:"#22C993",e:"SS"},amrap:{label:"AMRAP",c:"#3B8DF0",e:"AM"},excentrique:{label:"Excentrique",c:"#D4538E",e:"EX"},isometrique:{label:"Isometrique",c:"#9194A0",e:"ISO"}};
const MDEF={dropset:{drops:3,pct:20},myoreps:{activation:12,minisets:4,reps_mini:5,pause:5},restpause:{rounds:3,pause:15},superset:{paired:null},amrap:{type:"failure",duration:30},excentrique:{eccentric_sec:4},isometrique:{hold_sec:30,positions:2}};

const generateRows=(planned,method,mp)=>{
  const sets=planned?.sets||3,kg=planned?.kg||0,reps=parseReps(planned?.repsRange)||0,rir=planned?.rir??2;
  const p=mp||MDEF[method]||{};
  if(!method||method==="excentrique")return Array.from({length:sets},()=>({type:"set",kg,reps,rir,done:false}));
  if(method==="dropset"){const rows=[];for(let s=0;s<sets;s++){rows.push({type:"set",setIdx:s+1,kg,reps,rir,done:false});for(let d=0;d<(p.drops||2);d++){const dkg=Math.round(kg*Math.pow(1-(p.pct||20)/100,d+1)/2.5)*2.5;rows.push({type:"drop",setIdx:s+1,dropIdx:d+1,kg:dkg,reps,done:false});}}return rows;}
  if(method==="myoreps"){const rows=[{type:"activation",kg,reps:p.activation||12,rir,done:false}];for(let m=0;m<(p.minisets||4);m++)rows.push({type:"mini",idx:m+1,kg,reps:p.reps_mini||5,done:false,pauseSec:p.pause||5});return rows;}
  if(method==="restpause")return Array.from({length:p.rounds||3},(_,i)=>({type:"round",idx:i+1,kg,reps,rir,done:false,pauseSec:p.pause||15}));
  if(method==="amrap")return[{type:"amrap",kg,reps:0,done:false,timed:p.type==="timed",duration:p.duration||30}];
  if(method==="isometrique")return Array.from({length:p.positions||2},(_,i)=>({type:"iso",idx:i+1,holdSec:p.hold_sec||30,done:false}));
  return Array.from({length:sets},()=>({type:"set",kg,reps,rir,done:false}));
};

// Body zones for DOMS + injuries
const BZFRONT=[
  {id:"nuque",label:"Nuque",cx:50,cy:26,r:5},{id:"ep_g",label:"Ep. G",cx:23,cy:36,r:6},{id:"ep_d",label:"Ep. D",cx:77,cy:36,r:6},
  {id:"pecs",label:"Pecs",cx:50,cy:49,r:7},
  {id:"biceps_g",label:"Biceps G",cx:16,cy:47,r:5},{id:"biceps_d",label:"Biceps D",cx:84,cy:47,r:5},
  {id:"coude_g",label:"Coude G",cx:12,cy:57,r:4},{id:"coude_d",label:"Coude D",cx:88,cy:57,r:4},
  {id:"abdos",label:"Abdos",cx:50,cy:65,r:6},{id:"hanche_g",label:"Hanche G",cx:39,cy:74,r:5},{id:"hanche_d",label:"Hanche D",cx:61,cy:74,r:5},
  {id:"cuisse_g",label:"Cuisse G",cx:38,cy:92,r:6},{id:"cuisse_d",label:"Cuisse D",cx:62,cy:92,r:6},
  {id:"genou_g",label:"Genou G",cx:37,cy:111,r:5},{id:"genou_d",label:"Genou D",cx:63,cy:111,r:5},
  {id:"mollet_g",label:"Mollet G",cx:37,cy:127,r:7},{id:"mollet_d",label:"Mollet D",cx:63,cy:127,r:7},
  {id:"cheville_g",label:"Cheville G",cx:37,cy:143,r:4},{id:"cheville_d",label:"Cheville D",cx:63,cy:143,r:4},
];
const BZBACK=[
  {id:"dos_haut",label:"Dos / Trapèzes",cx:50,cy:47,r:8},{id:"lombaires",label:"Lombaires",cx:50,cy:65,r:6},
  {id:"fessier_g",label:"Fessier G",cx:39,cy:74,r:6},{id:"fessier_d",label:"Fessier D",cx:61,cy:74,r:6},
  {id:"ischio_g",label:"Ischio G",cx:38,cy:92,r:5},{id:"ischio_d",label:"Ischio D",cx:62,cy:92,r:5},
  {id:"ep_post_g",label:"Ep. Post G",cx:23,cy:36,r:6},{id:"ep_post_d",label:"Ep. Post D",cx:77,cy:36,r:6},
  {id:"triceps_g",label:"Triceps G",cx:14,cy:47,r:5},{id:"triceps_d",label:"Triceps D",cx:86,cy:47,r:5},
  {id:"mollet_arr_g",label:"Mollet G",cx:37,cy:127,r:7},{id:"mollet_arr_d",label:"Mollet D",cx:63,cy:127,r:7},
];
const ALL_BZ=[...BZFRONT,...BZBACK];
const INJ_TYPES=["Aigu","Chronique","Tendon","Musculaire","Articulaire"];
const INJ_STATUS=["Nouvelle","En cours","Amelioration","Guerie"];
const STATUS_COL={Nouvelle:C.r,"En cours":C.o,Amelioration:"#7BC67E",Guerie:C.g};
const stC=s=>STATUS_COL[s]||C.tx3;

const DEF_TIER_CONFIG={
  1:{label:"Composé",desc:"Squat, Bench, Deadlift…",c:"#EF4B4B",mode:"rir",kgStep:2.5,rirStart:3,rirEnd:1,repsFixed:true,deloadPct:40},
  2:{label:"Accessoire",desc:"Rowing, Dev. incliné…",c:"#7B6FFF",mode:"reps",kgStep:2.5,repsStart:10,repsEnd:12,rirStart:2,rirEnd:1,deloadPct:30},
  3:{label:"Isolation",desc:"Curls, Extensions…",c:"#22C993",mode:"rir",kgStep:1.25,rirStart:2.5,rirEnd:1,deloadPct:20}
};
const roundHalf=v=>Math.round(v*2)/2;
const BLOC_TO_TIER={"PERF":1,"ESTH":2,"ASSOC":2,"BESOIN":3,"CORE":3,"MOBIL":3};
const getExTier=(name,ex)=>ex?.tier||(EX_TIER[name]||(ex?.bloc?BLOC_TO_TIER[ex.bloc]:null)||3);
const DEF_BLOCK_CONFIG={totalWeeks:6,deloadWeek:6,progressionPct:2.5,progressionType:"linear",deloadPct:40,tierConfig:DEF_TIER_CONFIG};
const SKEYS={exos:"asp:exos",exMeta:"asp:exMeta",sets:"asp:sets",wellness:"asp:wellness",wellnessHistory:"asp:wh",bw:"asp:bw",completed:"asp:completed",goals:"asp:goals",anotes:"asp:anotes",custMethods:"asp:custmethods",weightLog:"asp:wlog",weightMilestones:"asp:wmile",injuries:"asp:injuries",sessions:"asp:sessions",blockConfig:"asp:blockConfig",blockHistory:"asp:blockHistory",weekSchedule:"asp:weekschedule"};
async function sLoad(k,fb,aid){
  if(!aid)return fb;
  try{
    const {data}=await supabase.from('app_data').select('value').eq('athlete_id',aid).eq('key',k).maybeSingle();
    if(data)return data.value;
    return fb;
  }catch{return fb;}
}
function clearAllLocalStorage(){
  Object.values(SKEYS).forEach(k=>localStorage.removeItem(k));
}
async function sSave(k,v,aid){
  if(!aid)return;
  const {error}=await supabase.from('app_data').upsert({athlete_id:aid,key:k,value:v,updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});
  if(error){console.error('sSave error',k,error.message,error.code);throw error;}
}

// --- COMPONENTS ---

function RIRMini({value,onChange}){
  const idx=Math.max(0,RIR_OPTS.indexOf(value));const sy=useRef(null);
  const go=d=>{const ni=idx+d;if(ni>=0&&ni<RIR_OPTS.length)onChange(RIR_OPTS[ni]);};const c=rC(value);
  return(<div style={{position:"relative",width:44,height:72,overflow:"hidden",cursor:"ns-resize",borderRadius:8,background:C.s1,border:"1px solid "+C.brdL}} onWheel={e=>{e.preventDefault();go(e.deltaY>0?1:-1);}} onTouchStart={e=>{sy.current=e.touches[0].clientY;}} onTouchMove={e=>{if(!sy.current)return;const dy=sy.current-e.touches[0].clientY;if(Math.abs(dy)>14){go(dy>0?1:-1);sy.current=e.touches[0].clientY;}}}>
    <div style={{position:"absolute",top:24,height:24,left:3,right:3,background:c+"25",borderRadius:5,zIndex:0}}/>
    <div style={{position:"absolute",top:0,left:0,right:0,height:24,background:"linear-gradient(to bottom,"+C.s1+",transparent)",zIndex:2,pointerEvents:"none"}}/>
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:24,background:"linear-gradient(to top,"+C.s1+",transparent)",zIndex:2,pointerEvents:"none"}}/>
    {[{v:RIR_OPTS[idx-1],d:-1,y:0},{v:value,d:0,y:24},{v:RIR_OPTS[idx+1],d:1,y:48}].map(({v,d,y})=>(
      <div key={d} onClick={()=>d!==0&&v!==undefined&&go(d)} style={{position:"absolute",top:y,left:0,right:0,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:d===0?11:9,fontWeight:d===0?800:400,color:d===0?c:C.tx3,opacity:d===0?1:0.4,cursor:d!==0&&v!==undefined?"pointer":"default",zIndex:1,userSelect:"none",fontFamily:"monospace"}}>{v!==undefined?rL(v):""}</div>
    ))}
  </div>);
}

function RestTimer({timerLeft,timerDur,timerActive,timerFinished,onSetDur,onStart,onStop}){
  const pct=Math.min((timerDur-timerLeft)/timerDur*100,100);
  const m=Math.floor(Math.abs(timerLeft)/60),s=Math.abs(timerLeft)%60;
  const col=timerFinished?C.g:timerActive&&timerLeft<=10?C.r:C.ac;
  return(<div style={{display:"flex",alignItems:"center",gap:10}}>
    <div style={{position:"relative",width:44,height:44}}><svg viewBox="0 0 44 44" style={{width:44,height:44,transform:"rotate(-90deg)"}}><circle cx="22" cy="22" r="18" fill="none" stroke={C.s2} strokeWidth="3"/><circle cx="22" cy="22" r="18" fill="none" stroke={col} strokeWidth="3" strokeDasharray={String(2*Math.PI*18)} strokeDashoffset={String(2*Math.PI*18*(1-pct/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:timerFinished?16:9,fontWeight:600,color:col,fontFamily:"monospace"}}>{timerFinished?"✓":m+":"+s.toString().padStart(2,"0")}</div></div>
    <div style={{display:"flex",gap:4}}>{[60,90,120,180].map(d=><button key={d} onClick={()=>onSetDur(d)} style={{padding:"4px 7px",borderRadius:6,border:"1px solid "+(timerDur===d?C.ac:C.brdL),background:timerDur===d?C.acS:"transparent",color:timerDur===d?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{d/60+"m"}</button>)}</div>
    <button onClick={()=>{timerActive?onStop():onStart();}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:timerActive?C.rS:timerFinished?C.gS:C.acS,color:timerActive?C.r:timerFinished?C.g:C.ac,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{timerActive?"Stop":"Go"}</button>
  </div>);
}

function BodyMap({selected,onToggle,color}){
  const[view,setView]=useState("front");
  const c=color||C.r;
  const zones=view==="front"?BZFRONT:BZBACK;
  const bp=C.brdL;
  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      {["front","back"].map(v=><button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(view===v?c:C.brdL),background:view===v?c+"20":"transparent",color:view===v?c:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{v==="front"?"Vue avant":"Vue arriere"}</button>)}
    </div>
    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
      <svg viewBox="0 0 100 160" style={{width:"42%",height:"auto",flexShrink:0}}>
        <ellipse cx="50" cy="12" rx="10" ry="11" fill="none" stroke={bp} strokeWidth="1.5"/>
        <path d="M34,24 L28,28 L24,74 L76,74 L72,28 L66,24 Q60,21 50,21 Q40,21 34,24 Z" fill="none" stroke={bp} strokeWidth="1.5"/>
        <path d="M28,28 L20,32 L12,56 L9,74 L14,74 L17,56 L23,33" fill="none" stroke={bp} strokeWidth="1.5"/>
        <path d="M72,28 L80,32 L88,56 L91,74 L86,74 L83,56 L77,33" fill="none" stroke={bp} strokeWidth="1.5"/>
        <path d="M40,74 L36,110 L34,148 L41,148 L43,112 L46,74" fill="none" stroke={bp} strokeWidth="1.5"/>
        <path d="M60,74 L64,110 L66,148 L59,148 L57,112 L54,74" fill="none" stroke={bp} strokeWidth="1.5"/>
        {zones.map(z=>{const on=selected.includes(z.id);return(<g key={z.id} onClick={()=>onToggle(z.id)} style={{cursor:"pointer"}}><circle cx={z.cx} cy={z.cy} r={z.r+2} fill={on?c+"30":"transparent"} stroke={on?c:bp} strokeWidth={on?"1.8":"0.8"}/>{on&&<circle cx={z.cx} cy={z.cy} r={z.r*0.45} fill={c}/>}</g>);})}
      </svg>
      <div style={{flex:1}}>
        <div style={{fontSize:9,color:C.tx3,marginBottom:6}}>Zones selectionnees :</div>
        {selected.length===0?<div style={{fontSize:10,color:C.tx3,fontStyle:"italic"}}>Aucune - appuie sur le corps</div>:(
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {selected.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<button key={id} onClick={()=>onToggle(id)} style={{padding:"2px 7px",borderRadius:5,background:c+"20",color:c,fontSize:9,fontWeight:600,cursor:"pointer",border:"none",fontFamily:"inherit"}}>{z.label} x</button>:null;})}
          </div>
        )}
      </div>
    </div>
  </div>);
}

function InjuryForm({onSave,onCancel,existing}){
  const[zones,setZones]=useState(existing?.zones||[]);
  const[intensity,setIntensity]=useState(existing?.intensity||5);
  const[type,setType]=useState(existing?.type||"");
  const[status,setStatus]=useState(existing?.status||"Nouvelle");
  const[notes,setNotes]=useState(existing?.notes||"");
  const tog=id=>setZones(p=>p.includes(id)?p.filter(z=>z!==id):[...p,id]);
  const intC=intensity<=3?C.g:intensity<=6?C.o:C.r;
  return(<div style={{background:C.s1,borderRadius:14,padding:16,border:"1px solid "+C.brd}}>
    <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Localisation</div><BodyMap selected={zones} onToggle={tog} color={C.r}/></div>
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Intensite de la douleur</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setIntensity(p=>Math.max(1,p-1))} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit"}}>-</button>
        <div style={{flex:1,textAlign:"center"}}><span style={{fontSize:26,fontWeight:800,color:intC}}>{intensity}</span><span style={{fontSize:11,color:C.tx3}}>/10</span></div>
        <button onClick={()=>setIntensity(p=>Math.min(10,p+1))} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit"}}>+</button>
      </div>
      <div style={{height:4,background:C.s2,borderRadius:2,overflow:"hidden",marginTop:6}}><div style={{height:"100%",width:(intensity/10*100)+"%",background:intC,borderRadius:2,transition:"width 0.2s"}}/></div>
    </div>
    <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Type</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{INJ_TYPES.map(t=><button key={t} onClick={()=>setType(type===t?"":t)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(type===t?C.r:C.brdL),background:type===t?C.rS:"transparent",color:type===t?C.r:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:type===t?700:400}}>{t}</button>)}</div></div>
    <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Statut</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{INJ_STATUS.map(s=>{const sc=stC(s);return(<button key={s} onClick={()=>setStatus(s)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(status===s?sc:C.brdL),background:status===s?sc+"20":"transparent",color:status===s?sc:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:status===s?700:400}}>{s}</button>);})}</div></div>
    <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Notes</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Description, circonstances, traitements..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/></div>
    <div style={{display:"flex",gap:8}}>
      {onCancel&&<button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>}
      <button onClick={()=>onSave({id:existing?.id||Date.now(),zones,intensity,type,status,notes,date:existing?.date||todayKey()})} style={{flex:2,padding:"10px 0",borderRadius:10,border:"none",background:C.r,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{existing?"Modifier":"Ajouter"}</button>
    </div>
  </div>);
}

function WellnessFlow({existing,onSave,sleepTarget,onAddInjury}){
  const tgt=sleepTarget||8;
  const S_DOMS_ZONES=WELL_ITEMS.length; // 5 - shown if doms <= 3 (DOMS significant)
  const S_INJURY=6;const S_SLEEP=7;const S_WEIGHT=8;const S_BILAN=9;
  const[step,setStep]=useState(0);
  const[vals,setVals]=useState({fatigue:existing?.fatigue||3,sommeil:existing?.sommeil||3,stress:existing?.stress||3,energie:existing?.energie||3,doms:existing?.doms||5});
  const[domsZones,setDomsZones]=useState(existing?.domsZones||[]);
  const[coucher,setCoucher]=useState(existing?.coucher||{h:23,m:0});
  const[reveil,setReveil]=useState(existing?.reveil||{h:7,m:0});
  const[poids,setPoids]=useState(existing?.poids||"");
  const[injOui,setInjOui]=useState(null);
  const[injComment,setInjComment]=useState(existing?.injComment||"");
  const score=calcScore(vals);const reco=getReco(score);const alerts=getAlerts(vals);
  const sleepDur=()=>{const rM=reveil.h*60+reveil.m,cM=coucher.h*60+coucher.m;return Math.round((rM<=cM?rM+1440-cM:rM-cM)/60*10)/10;};
  const dur=sleepDur();const diff=Math.round((dur-tgt)*10)/10;const sleepC=Math.abs(diff)<=0.5?C.g:Math.abs(diff)<=1.5?C.o:C.r;
  const togDoms=id=>setDomsZones(p=>p.includes(id)?p.filter(z=>z!==id):[...p,id]);
  const progPct=Math.round((Math.min(step,S_BILAN)/S_BILAN)*100);
  const bSm={width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:16,cursor:"pointer",fontFamily:"inherit"};
  const progBar=(<div style={{height:3,background:C.s2,borderRadius:2,overflow:"hidden",marginBottom:24}}><div style={{height:"100%",width:progPct+"%",background:C.ac,borderRadius:2,transition:"width 0.3s"}}/></div>);
  const TimePick=({label,time,setTime})=>(<div style={{background:C.s1,borderRadius:12,padding:"12px 14px",flex:1,textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{label}</div><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><div><button onClick={()=>setTime(t=>({...t,h:(t.h+1)%24}))} style={bSm}>+</button><div style={{fontSize:22,fontWeight:800,color:C.tx,fontFamily:"monospace",margin:"4px 0"}}>{String(time.h).padStart(2,"0")}</div><button onClick={()=>setTime(t=>({...t,h:(t.h-1+24)%24}))} style={bSm}>-</button></div><div style={{fontSize:18,color:C.tx3}}>:</div><div><button onClick={()=>setTime(t=>({...t,m:(t.m+15)%60}))} style={bSm}>+</button><div style={{fontSize:22,fontWeight:800,color:C.tx,fontFamily:"monospace",margin:"4px 0"}}>{String(time.m).padStart(2,"0")}</div><button onClick={()=>setTime(t=>({...t,m:(t.m-15+60)%60}))} style={bSm}>-</button></div></div></div>);

  // 5 wellness questions
  if(step<WELL_ITEMS.length){
    const it=WELL_ITEMS[step];
    const pick=(v)=>{
      const nv={...vals,[it.k]:v};setVals(nv);
      if(step===WELL_ITEMS.length-1){// last q = fraîcheur musculaire
        setStep(nv.doms<=3?S_DOMS_ZONES:S_INJURY); // doms<=3 = douleurs significatives → zones
      } else {setStep(step+1);}
    };
    const BTN_COLORS=["#EF4B4B","#F07030","#F5A623","#7BC67E",C.g];
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Question {step+1}/5</div>
      <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:6}}>{it.q}</div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.tx3,marginBottom:20}}><span style={{color:BTN_COLORS[0]}}>😫 {it.lo}</span><span style={{color:BTN_COLORS[4]}}>😄 {it.hi}</span></div>
      <div style={{display:"flex",gap:8}}>{[1,2,3,4,5].map(n=>{const sel=vals[it.k]===n;return(<button key={n} onClick={()=>pick(n)} style={{flex:1,padding:"14px 0",borderRadius:10,border:"2px solid "+(sel?BTN_COLORS[n-1]:C.brdL),background:sel?BTN_COLORS[n-1]+"30":C.s2,color:sel?BTN_COLORS[n-1]:C.tx3,fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>);})}</div>
    </div>);
  }

  // DOMS zones (only if fraîcheur <= 3, i.e. douleurs significatives)
  if(step===S_DOMS_ZONES){
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",marginBottom:8}}>Zones de courbatures</div>
      <div style={{fontSize:18,fontWeight:800,letterSpacing:"-0.5px",marginBottom:16}}>Où as-tu des DOMS ?</div>
      <BodyMap selected={domsZones} onToggle={togDoms} color={C.o}/>
      <button onClick={()=>setStep(S_INJURY)} style={{width:"100%",marginTop:16,padding:"13px 0",borderRadius:12,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Suivant</button>
    </div>);
  }

  // Injury question — simple Oui/Non + commentaire
  if(step===S_INJURY){
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",marginBottom:8}}>Blessure</div>
      <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:4}}>Es-tu blessé ?</div>
      <div style={{fontSize:12,color:C.tx3,marginBottom:20}}>Douleur différente des courbatures habituelles</div>
      <div style={{display:"flex",gap:10,marginBottom:injOui===true?16:0}}>
        <button onClick={()=>setInjOui(true)} style={{flex:1,padding:"16px 0",borderRadius:12,border:"2px solid "+(injOui===true?C.r:C.brdL),background:injOui===true?C.rS:"transparent",color:injOui===true?C.r:C.tx2,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Oui</button>
        <button onClick={()=>{setInjOui(false);setStep(S_SLEEP);}} style={{flex:1,padding:"16px 0",borderRadius:12,border:"2px solid "+(injOui===false?C.g:C.brdL),background:injOui===false?C.gS:"transparent",color:injOui===false?C.g:C.tx2,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Non</button>
      </div>
      {injOui===true&&(<>
        <textarea value={injComment} onChange={e=>setInjComment(e.target.value)} placeholder="Décris la douleur : zone, type, intensité..." rows={4} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid "+C.r+"50",background:C.s1,color:C.tx,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:14}}/>
        <button onClick={()=>setStep(S_SLEEP)} disabled={!injComment.trim()} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:injComment.trim()?C.ac:"#333",color:injComment.trim()?"#fff":C.tx3,fontSize:14,fontWeight:700,cursor:injComment.trim()?"pointer":"default",fontFamily:"inherit"}}>Continuer</button>
      </>)}
    </div>);
  }

  // Sleep
  if(step===S_SLEEP){
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",marginBottom:8}}>Sommeil</div>
      <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:20}}>Heures de sommeil</div>
      <div style={{display:"flex",gap:10,marginBottom:16}}><TimePick label="Coucher" time={coucher} setTime={setCoucher}/><TimePick label="Reveil" time={reveil} setTime={setReveil}/></div>
      <div style={{padding:"12px 14px",borderRadius:10,background:sleepC+"12",border:"1px solid "+sleepC+"40",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:12,color:C.tx2,fontWeight:600}}>Duree estimee</div><div style={{fontSize:10,color:C.tx3}}>Objectif: {tgt}h</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:800,color:sleepC}}>{dur}h</div><div style={{fontSize:11,color:sleepC,fontWeight:600}}>{diff>0?"+":""}{diff}h</div></div>
        </div>
      </div>
      <button onClick={()=>setStep(S_WEIGHT)} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Suivant</button>
    </div>);
  }

  // Weight
  if(step===S_WEIGHT){
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",marginBottom:8}}>Poids</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>A jeun</div>
      <div style={{display:"flex",gap:8,marginBottom:24,alignItems:"center"}}>
        <button onClick={()=>setPoids(p=>Math.max(40,+(+p-0.5).toFixed(1)))} style={{width:48,height:48,borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>-</button>
        <input type="number" step="0.1" value={poids} onChange={e=>setPoids(e.target.value)} placeholder="82.5" style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:24,fontWeight:800,fontFamily:"inherit",textAlign:"center"}}/>
        <span style={{fontSize:14,color:C.tx3}}>kg</span>
        <button onClick={()=>setPoids(p=>+(+p+0.5).toFixed(1))} style={{width:48,height:48,borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>+</button>
      </div>
      <button onClick={()=>setStep(S_BILAN)} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Voir mon bilan</button>
    </div>);
  }

  // Bilan
  return(<div style={{padding:"20px 20px 40px"}}>
    <div style={{fontSize:18,fontWeight:800,letterSpacing:"-0.5px",marginBottom:20}}>Bilan du jour</div>
    <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px",borderRadius:14,background:C.s1,border:"1.5px solid "+reco.c+"40",marginBottom:14}}>
      <div style={{position:"relative",width:70,height:70,flexShrink:0}}><svg viewBox="0 0 70 70" style={{width:70,height:70,transform:"rotate(-90deg)"}}><circle cx="35" cy="35" r="28" fill="none" stroke={C.s2} strokeWidth="5"/><circle cx="35" cy="35" r="28" fill="none" stroke={reco.c} strokeWidth="5" strokeDasharray={String(2*Math.PI*28)} strokeDashoffset={String(2*Math.PI*28*(1-score/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:reco.c}}>{score}</div></div>
      <div><div style={{fontSize:20,fontWeight:800,color:reco.c}}>{reco.label}</div><div style={{fontSize:13,color:C.tx2,marginTop:4}}>{reco.desc}</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
      {WELL_ITEMS.map(it=>{const v=vals[it.k];const vc=it.inv?(v>=4?C.r:v<=2?C.g:C.o):(v>=4?C.g:v<=2?C.r:C.o);return(<div key={it.k} style={{background:C.s1,borderRadius:10,padding:"8px 10px",border:"1px solid "+C.brd}}><div style={{fontSize:8,color:C.tx3,marginBottom:2}}>{it.k}</div><div style={{fontSize:18,fontWeight:800,color:vc}}>{v}<span style={{fontSize:9,color:C.tx3}}>/5</span></div></div>);})}
      <div style={{background:C.s1,borderRadius:10,padding:"8px 10px",border:"1px solid "+sleepC+"40"}}><div style={{fontSize:8,color:C.tx3,marginBottom:2}}>Sommeil</div><div style={{fontSize:16,fontWeight:800,color:sleepC}}>{dur}h</div><div style={{fontSize:8,color:sleepC}}>{diff>0?"+":""}{diff}h</div></div>
      {poids&&<div style={{background:C.s1,borderRadius:10,padding:"8px 10px",border:"1px solid "+C.brd}}><div style={{fontSize:8,color:C.tx3,marginBottom:2}}>Poids</div><div style={{fontSize:16,fontWeight:800,color:C.ac}}>{poids} kg</div></div>}
    </div>
    {domsZones.length>0&&(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:8,background:C.o+"10",border:"1px solid "+C.o+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.o,textTransform:"uppercase",marginBottom:4}}>DOMS</div><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:C.o+"20",color:C.o}}>{z.label}</span>:null;})}</div></div>)}
    {injOui&&injComment&&(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:8,background:C.r+"10",border:"1px solid "+C.r+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.r,textTransform:"uppercase",marginBottom:4}}>Blessure signalée</div><div style={{fontSize:11,color:C.r,lineHeight:1.5}}>{injComment}</div></div>)}
    {alerts.length>0&&<div style={{marginBottom:12}}>{alerts.map((a,i)=><div key={i} style={{padding:"8px 12px",borderRadius:8,background:C.o+"10",border:"1px solid "+C.o+"30",fontSize:11,color:C.o,marginBottom:5}}>{a}</div>)}</div>}
    <button onClick={()=>onSave({...vals,domsZones,coucher,reveil,sleepDur:dur,poids:+poids||null,score,injComment:injOui?injComment:null})} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.g,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sauvegarder</button>
  </div>);
}

function SmartSetEditor({planned,storeKey,sessionSets,updateSets,athleteNotes,setAthleteNotes,method,methodParams,allMethods,exosMap}){
  const initRows=()=>generateRows(planned,method,methodParams);
  const rows=sessionSets[storeKey]||initRows();
  const upd=(i,f,v)=>updateSets(storeKey,rows.map((r,j)=>j===i?{...r,[f]:v}:r));
  const done=rows.filter(r=>r.done).length;const note=athleteNotes?.[storeKey]||"";
  const iS={background:C.s1,color:C.tx,border:"1px solid "+C.brdL,fontFamily:"inherit",fontSize:14,fontWeight:700,textAlign:"center",borderRadius:6,padding:"5px 2px",width:"100%"};
  const pairedExName=method==="superset"&&methodParams?.paired?exosMap?.[methodParams.paired]:"";
  const rowLabel=r=>{if(r.type==="drop")return"Drop "+r.dropIdx;if(r.type==="activation")return"Activ.";if(r.type==="mini")return"Mini "+r.idx;if(r.type==="round")return"Rd "+r.idx;if(r.type==="amrap")return"AMRAP";if(r.type==="iso")return"Pos."+r.idx;return r.setIdx?"Set "+r.setIdx:"Set";};
  const rowC=r=>{if(r.type==="drop")return C.o;if(r.type==="activation")return C.g;if(r.type==="mini")return C.ac+"80";if(r.type==="round")return C.r;if(r.type==="amrap")return C.b;if(r.type==="iso")return C.tx2;return C.tx3;};
  return(<div>
    {method==="excentrique"&&methodParams?.eccentric_sec&&<div style={{padding:"6px 10px",borderRadius:7,background:C.coach+"12",border:"1px solid "+C.coach+"30",marginBottom:10,fontSize:11,color:C.coach}}>Phase negative: {methodParams.eccentric_sec}s par rep</div>}
    {method==="superset"&&pairedExName&&<div style={{padding:"6px 10px",borderRadius:7,background:C.g+"12",border:"1px solid "+C.g+"30",marginBottom:10,fontSize:11,color:C.g}}>Superset avec: {pairedExName}</div>}
    {planned?.repsRange&&<div style={{padding:"6px 10px",borderRadius:7,background:C.acS,border:"1px solid "+C.ac+"30",marginBottom:10,fontSize:11,color:C.ac}}>Cible: {planned.repsRange} reps</div>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{flex:1,height:3,background:C.s2,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:(rows.length?(done/rows.length)*100:0)+"%",background:C.g,borderRadius:2,transition:"width 0.3s"}}/></div><span style={{fontSize:10,color:done===rows.length&&rows.length>0?C.g:C.tx3,fontWeight:600}}>{done}/{rows.length}</span></div>
    {rows.map((r,i)=>{const isIso=r.type==="iso";const isAmrap=r.type==="amrap";const isDrop=r.type==="drop";const isMini=r.type==="mini";const showPause=(r.type==="round"||r.type==="mini")&&i<rows.length-1&&rows[i+1]?.type===r.type;
      return(<div key={i}><div style={{display:"grid",gridTemplateColumns:isIso?"40px 1fr 30px":"40px 1fr 10px 1fr "+((!isAmrap&&!isMini&&!isDrop)?"44px ":"")+"30px",gap:4,alignItems:"center",marginBottom:4,padding:"6px 8px",borderRadius:8,background:r.done?C.g+"10":isDrop?C.o+"08":isMini?C.ac+"08":C.s2,border:"1px solid "+(r.done?C.g+"30":isDrop?C.o+"20":isMini?C.ac+"20":C.brd),opacity:r.done?0.65:1,transition:"all 0.2s"}}>
        <span style={{fontSize:9,color:rowC(r),fontWeight:600,textAlign:"center"}}>{rowLabel(r)}</span>
        {!isIso&&<input type="number" value={r.kg||0} onChange={e=>upd(i,"kg",+e.target.value)} style={iS}/>}
        {isIso&&<div style={{fontSize:11,color:C.tx2,textAlign:"center"}}>{r.holdSec}s</div>}
        {!isIso&&<span style={{fontSize:10,color:C.tx3,textAlign:"center"}}>x</span>}
        {!isIso&&<input type="number" value={r.reps||0} onChange={e=>upd(i,"reps",+e.target.value)} placeholder={isAmrap?"max":""} style={iS}/>}
        {!isIso&&!isAmrap&&!isMini&&!isDrop&&<RIRMini value={r.rir??2} onChange={v=>upd(i,"rir",v)}/>}
        <button onClick={()=>upd(i,"done",!r.done)} style={{width:28,height:28,borderRadius:7,border:"1.5px solid "+(r.done?C.g:C.brdL),background:r.done?C.g:"transparent",color:r.done?"#fff":C.tx3,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>v</button>
      </div>{showPause&&<div style={{textAlign:"center",fontSize:9,color:C.tx3,padding:"2px 0",marginBottom:2}}>{r.pauseSec}s repos</div>}</div>);
    })}
    {(!method||method==="excentrique")&&<button onClick={()=>updateSets(storeKey,[...rows,{type:"set",kg:rows[rows.length-1]?.kg||0,reps:rows[rows.length-1]?.reps||0,rir:2,done:false}])} style={{width:"100%",padding:"7px 0",borderRadius:8,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Serie</button>}
    <div style={{marginTop:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Mon ressenti</div><textarea value={note} onChange={e=>setAthleteNotes&&setAthleteNotes(p=>({...p,[storeKey]:e.target.value}))} placeholder="Notes perso, sensations..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/></div>
  </div>);
}

const DarkTip=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:C.s2,border:"1px solid "+C.brdL,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>{label}</div>{payload.map((p,i)=>p.value!=null&&<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><div style={{width:8,height:8,borderRadius:2,background:p.fill||p.stroke||C.ac}}/><span style={{fontSize:10,color:C.tx2}}>{p.name}:</span><span style={{fontSize:11,fontWeight:700,color:p.fill||p.stroke||C.ac}}>{p.value}</span></div>)}</div>);};
function MiniChart({data,color,h}){const H=h||52;const pts=data.filter(d=>d.val!=null);if(!pts.length)return null;const vals=pts.map(d=>d.val),mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;const W=280,mapped=data.map((d,i)=>({...d,x:(i/(data.length-1||1))*(W-20)+10,y:d.val!=null?H-12-((d.val-mn)/rng)*(H-24):null}));const act=mapped.filter(p=>p.y!=null),line=act.map((p,i)=>(i===0?"M":"L")+p.x+","+p.y).join(" ");const area=act.length>1?line+" L"+act[act.length-1].x+","+H+" L"+act[0].x+","+H+" Z":"";const gId="mc"+color.replace("#","")+(Math.random().toString(36).slice(2,5));return(<svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,display:"block"}}><defs><linearGradient id={gId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>{area&&<path d={area} fill={"url(#"+gId+")"}/>}{act.length>1&&<path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}{mapped.map((p,i)=>p.y!=null?(<g key={i}><circle cx={p.x} cy={p.y} r={3.5} fill={C.bg} stroke={color} strokeWidth="1.5"/><text x={p.x} y={p.y-8} textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="system-ui">{p.val}</text><text x={p.x} y={H-1} textAnchor="middle" fill={C.tx3} fontSize="8" fontFamily="system-ui">{p.week}</text></g>):(<text key={i} x={p.x} y={H-1} textAnchor="middle" fill={C.tx3} fontSize="8" fontFamily="system-ui">{p.week}</text>))}</svg>);}

function WeightChart({log,milestones,target}){
  const data=getWeightChartData(log,milestones,target);
  if(!data.length)return(<div style={{textAlign:"center",color:C.tx3,fontSize:12,padding:"20px 0"}}>Aucune donnee</div>);
  const vals=data.map(d=>d.kg);const mn=Math.min(...vals,target)-0.5,mx=Math.max(...vals,target)+0.5;
  return(<div>
    <div style={{display:"flex",gap:12,marginBottom:8,flexWrap:"wrap"}}>{[{c:C.ac,l:"Poids"},{c:"rgba(255,200,0,0.6)",l:"Objectif"},{c:C.g,l:"Palier"}].map(({c,l})=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:10,color:C.tx3}}>{l}</span></div>)}</div>
    <ResponsiveContainer width="100%" height={180}><LineChart data={data} margin={{top:10,right:10,left:-20,bottom:0}}><XAxis dataKey="d" tick={{fill:C.tx3,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis domain={[mn,mx]} tick={{fill:C.tx3,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<DarkTip/>}/><ReferenceLine y={target} stroke="rgba(255,200,0,0.5)" strokeDasharray="4 2"/>{milestones?.map((m,i)=><ReferenceLine key={i} y={m.kg} stroke={C.g+"40"} strokeDasharray="3 3"/>)}<Line type="monotone" dataKey="kg" name="Poids" stroke={C.ac} strokeWidth={2.5} dot={{fill:C.bg,stroke:C.ac,r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer>
  </div>);
}

function CombinedStatsChart({data}){
  return(<div>
    <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap"}}>{[{c:"rgba(255,255,255,0.15)",l:"Programme"},{c:C.b,l:"Realise"},{c:C.g,l:"Forme /100"}].map(({c,l})=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:10,color:C.tx3}}>{l}</span></div>)}</div>
    <ResponsiveContainer width="100%" height={190}><ComposedChart data={data} margin={{top:10,right:36,left:-24,bottom:0}}><XAxis dataKey="s" tick={{fill:C.tx3,fontSize:10}} axisLine={false} tickLine={false}/><YAxis yAxisId="vol" orientation="left" tick={{fill:C.tx3,fontSize:9}} axisLine={false} tickLine={false}/><YAxis yAxisId="well" orientation="right" domain={[0,100]} tick={{fill:C.tx3,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<DarkTip/>}/><Bar yAxisId="vol" dataKey="volProg" name="Programme" fill="rgba(255,255,255,0.12)" radius={[4,4,0,0]}/><Bar yAxisId="vol" dataKey="volReal" name="Realise" fill={C.b} radius={[4,4,0,0]} fillOpacity={0.85}/><Line yAxisId="well" type="monotone" dataKey="wellness" name="Forme" stroke={C.g} strokeWidth={2.5} dot={{fill:C.bg,stroke:C.g,r:4}} connectNulls={false}/></ComposedChart></ResponsiveContainer>
    <div style={{marginTop:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Intensite RIR x series</div><ResponsiveContainer width="100%" height={100}><LineChart data={data} margin={{top:8,right:10,left:-24,bottom:0}}><XAxis dataKey="s" tick={{fill:C.tx3,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<DarkTip/>}/><Line type="monotone" dataKey="intensity" name="Intensite" stroke={C.o} strokeWidth={2.5} dot={{fill:C.bg,stroke:C.o,r:4}}/></LineChart></ResponsiveContainer></div>
  </div>);
}

function MuscleSelector({value,onChange,multi}){
  const vals=multi?normPrimary(value):[];
  const isOn=id=>multi?vals.includes(id):value===id;
  const toggle=id=>{if(multi){onChange(vals.includes(id)?vals.filter(v=>v!==id):[...vals,id]);}else{onChange(id);}};
  const[expanded,setExpanded]=useState({});const tog=id=>setExpanded(p=>({...p,[id]:!p[id]}));
  return(<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{MTREE.map(g=>{const isGroup=g.s.length>0,isActive=isOn(g.id),hasSub=isGroup&&g.s.some(s=>isOn(s.id));const c=getMC(g.id);return(<div key={g.id} style={{marginBottom:(isGroup&&expanded[g.id])?0:4}}><div style={{display:"flex",gap:2,alignItems:"center"}}><button onClick={()=>toggle(g.id)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid "+((isActive||hasSub)?c:C.brdL),background:(isActive||hasSub)?c+"20":"transparent",color:(isActive||hasSub)?c:C.tx3,fontSize:11,fontWeight:(isActive||hasSub)?700:400,cursor:"pointer",fontFamily:"inherit"}}>{mL(g.id)}</button>{isGroup&&<button onClick={()=>tog(g.id)} style={{padding:"3px 6px",borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:9,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{expanded[g.id]?"▲":"▼"}</button>}</div>{isGroup&&expanded[g.id]&&(<div style={{display:"flex",flexWrap:"wrap",gap:3,padding:"4px 0 4px 8px",borderLeft:"2px solid "+c+"40",marginLeft:4,marginBottom:4}}>{g.s.map(s=>(<button key={s.id} onClick={()=>toggle(s.id)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+(isOn(s.id)?c:C.brdL),background:isOn(s.id)?c+"20":"transparent",color:isOn(s.id)?c:C.tx3,fontSize:10,fontWeight:isOn(s.id)?700:400,cursor:"pointer",fontFamily:"inherit"}}>{mL(s.id)}</button>))}</div>)}</div>);})}</div>);
}

function MethodParamsForm({method,params,onChange,exosInSession,currentExId}){
  if(!method||!MDEF[method])return null;const p=params||MDEF[method];const upd=(k,v)=>onChange({...p,[k]:v});
  const row=(label,key,min,max,step)=>(<div key={key}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>{label}</div><div style={{display:"flex",alignItems:"center",gap:4}}><button onClick={()=>upd(key,Math.max(min,+(p[key]||0)-(step||1)))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>-</button><div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:C.tx}}>{p[key]||0}</div><button onClick={()=>upd(key,Math.min(max,+(p[key]||0)+(step||1)))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>+</button></div></div>);
  const mc=DEF_METHODS[method]?.c||C.ac;
  return(<div style={{marginTop:10,padding:"12px",borderRadius:10,background:C.s2,border:"1px solid "+mc+"40"}}>
    <div style={{fontSize:10,fontWeight:600,color:mc,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>{DEF_METHODS[method]?.label} - Parametres</div>
    {method==="dropset"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Nb drops","drops",1,6)}{row("Reduction %","pct",5,50,5)}</div>}
    {method==="myoreps"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Reps activ.","activation",5,25)}{row("Nb mini-sets","minisets",2,10)}{row("Reps/mini","reps_mini",2,10)}{row("Pause (s)","pause",3,30)}</div>}
    {method==="restpause"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Nb rounds","rounds",2,6)}{row("Pause (s)","pause",5,60,5)}</div>}
    {method==="superset"&&<div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Exercice associe</div><select value={p.paired||""} onChange={e=>upd("paired",e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit"}}><option value="">-- Choisir --</option>{(exosInSession||[]).filter(e=>e.id!==currentExId).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
    {method==="amrap"&&<div><div style={{display:"flex",gap:6,marginBottom:8}}>{["failure","timed"].map(t=><button key={t} onClick={()=>upd("type",t)} style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(p.type===t?C.b:C.brdL),background:p.type===t?C.bS:"transparent",color:p.type===t?C.b:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{t==="failure"?"A l echec":"Chrono"}</button>)}</div>{p.type==="timed"&&row("Duree (s)","duration",10,300,5)}</div>}
    {method==="excentrique"&&row("Phase neg. (s)","eccentric_sec",2,10)}
    {method==="isometrique"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Maintien (s)","hold_sec",5,120,5)}{row("Nb positions","positions",1,5)}</div>}
    <div style={{marginTop:10,padding:"6px 10px",borderRadius:6,background:C.s1,fontSize:10,color:mc}}>
      {method==="dropset"&&(p.drops||2)+" drops, -"+(p.pct||20)+"%"}
      {method==="myoreps"&&(p.activation||12)+" reps + "+(p.minisets||4)+"x"+(p.reps_mini||5)+" ("+(p.pause||5)+"s)"}
      {method==="restpause"&&(p.rounds||3)+" rounds, "+(p.pause||15)+"s"}
      {method==="amrap"&&(p.type==="timed"?"Chrono: "+(p.duration||30)+"s":"A l echec")}
      {method==="excentrique"&&"Phase negative: "+(p.eccentric_sec||4)+"s"}
      {method==="isometrique"&&(p.positions||2)+"x"+(p.hold_sec||30)+"s"}
    </div>
  </div>);
}

function AIGeneratorModal({onGenerate,onClose,allMethods,existingExos,sessions:SESSIONS}){
  const[loading,setLoading]=useState(false);const[error,setError]=useState(null);
  const[step,setStep]=useState(0); // 0=form, 1=preview
  const[preview,setPreview]=useState(null);
  const[form,setForm]=useState({goal:"Hypertrophie",level:"Intermediaire",sessionsPerWeek:6,focus:"",constraints:"",weeks:6,style:"Mixte force/volume"});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const GOALS=["Hypertrophie","Force pure","Mixte force/volume","Perte de gras + maintien","Remise en forme"];
  const LEVELS=["Debutant","Intermediaire","Avance","Elite"];
  const STYLES=["Mixte force/volume","Push/Pull/Legs","Full body","Upper/Lower","Specialisation"];
  const[aiTab,setAiTab]=useState("import");
  const[importText,setImportText]=useState("");
  const[importFiles,setImportFiles]=useState([]);// [{name,mimeType,data,preview}]
  const fileRef=useRef(null);
  // Chat IA conversationnel
  const[convMsgs,setConvMsgs]=useState([]);// [{role:"user"|"ai", content:string}]
  const[convInput,setConvInput]=useState("");
  const[convProgram,setConvProgram]=useState(null);// dernier programme généré
  const[convLoading,setConvLoading]=useState(false);
  const[convError,setConvError]=useState(null);
  const convEndRef=useRef(null);
  const handleFilesUpload=(e)=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length)return;
    files.forEach(file=>{
      const ext=file.name.split(".").pop().toLowerCase();
      const isExcel=["xlsx","xls","csv","ods"].includes(ext);
      if(isExcel){
        // Excel/CSV → convertir en texte via SheetJS puis envoyer comme texte
        const reader=new FileReader();
        reader.onload=ev=>{
          try{
            const wb=XLSX.read(ev.target.result,{type:"array"});
            const lines=[];
            wb.SheetNames.forEach(name=>{
              const ws=wb.Sheets[name];
              const txt=XLSX.utils.sheet_to_csv(ws,{blankrows:false});
              if(txt.trim())lines.push(`=== Feuille: ${name} ===\n${txt}`);
            });
            const text=lines.join("\n\n");
            setImportText(prev=>(prev?prev+"\n\n":"")+`[Fichier Excel: ${file.name}]\n${text}`);
            setImportFiles(prev=>[...prev,{name:file.name,mimeType:"text/plain",data:null,preview:null,isExcel:true}]);
          }catch(err){console.error("Erreur lecture Excel",err);}
        };
        reader.readAsArrayBuffer(file);
      }else if(file.type.startsWith("image/")){
        const url=URL.createObjectURL(file);
        const img=new Image();
        img.onload=()=>{
          const maxW=1400;const scale=Math.min(1,maxW/img.width);
          const canvas=document.createElement("canvas");
          canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const b64=canvas.toDataURL("image/jpeg",0.82).split(",")[1];
          setImportFiles(prev=>[...prev,{name:file.name,mimeType:"image/jpeg",data:b64,preview:url}]);
        };
        img.src=url;
      }else{
        // PDF et autres formats — envoi direct en base64
        const reader=new FileReader();
        reader.onload=ev=>{
          const b64=ev.target.result.split(",")[1];
          setImportFiles(prev=>[...prev,{name:file.name,mimeType:file.type||"application/pdf",data:b64,preview:null}]);
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value="";
  };
  const removeImportFile=(idx)=>{
    setImportFiles(prev=>prev.filter((_,i)=>i!==idx));
  };
  const sendConvMessage=async()=>{
    const msg=convInput.trim();if(!msg||convLoading)return;
    setConvInput("");
    const newMsgs=[...convMsgs,{role:"user",content:msg}];
    setConvMsgs(newMsgs);
    setConvLoading(true);setConvError(null);
    setTimeout(()=>convEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try{
      let payload;
      if(!convProgram){
        // Premier message → génération initiale
        payload={mode:"generate",prompt:msg,sessions:SESSIONS};
      }else{
        // Messages suivants → édition du programme en cours
        const history=convMsgs.map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}));
        payload={mode:"chat_edit",message:msg,currentProgram:convProgram.sessions,conversationHistory:history,sessions:SESSIONS};
      }
      const resp=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.error||"Erreur serveur");
      // Merger avec le programme existant si chat_edit
      const merged=convProgram?{sessions:{...convProgram.sessions,...data.sessions},rationale:data.rationale}:data;
      setConvProgram(merged);
      setConvMsgs(prev=>[...prev,{role:"ai",content:data.rationale||"Programme mis à jour."}]);
    }catch(e){setConvError(e.message);}
    setConvLoading(false);
    setTimeout(()=>convEndRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };
  const AI_URL=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-program`;

  const DETAIL_FIELDS=[
    {k:"morpho",label:"Morphologie",placeholder:"Ex: longues jambes, bras courts, dos plat naturellement, bassin large..."},
    {k:"history",label:"Historique sportif",placeholder:"Ex: 5 ans de muscu, ancien rugbyman, arret de 6 mois en 2023..."},
    {k:"injuries",label:"Blessures / zones fragiles",placeholder:"Ex: tendinite coude gauche recurrente, genou droit (menisque 2021), lombaires sensibles..."},
    {k:"strengths",label:"Points forts",placeholder:"Ex: bonne force sur tirage, bonne connection mind-muscle pecs, recup rapide..."},
    {k:"weaknesses",label:"Points faibles / a developper",placeholder:"Ex: epaules posterieures en retard, mollets resistants, pec superieur peu developpe..."},
    {k:"equipment",label:"Equipement disponible",placeholder:"Ex: salle complete, pas de belt squat, pas de hack squat machine, barres cambrees dispo..."},
    {k:"schedule",label:"Contraintes horaires",placeholder:"Ex: seances 75 min max, mardi court (45 min), match le samedi, repos obligatoire mercredi..."},
    {k:"sport",label:"Activite sportive parallele",placeholder:"Ex: rugby XV 2x/sem + match samedi, cardio HIIT vendredi, sport collectif en loisir..."},
    {k:"maxes",label:"Charges de reference (1RM ou 5RM)",placeholder:"Ex: Bench 1RM 110kg, Squat 5RM 140kg, Traction +35kg x5, DL 160kg..."},
    {k:"preferences",label:"Preferences d entrainement",placeholder:"Ex: j aime les tempo lents sur ischios, je prefere halteres au bar pour incline, pas fan de leg press..."},
    {k:"nutrition",label:"Nutrition / recuperation",placeholder:"Ex: surplus calorique, 160g proteines/j, sommeil 7h moy, pas de complementation particuliere..."},
    {k:"other",label:"Autres infos importantes",placeholder:"Ex: competition dans 12 semaines, objectif esthetique pour ete, suivi medical en cours..."},
  ];
  const[details,setDetails]=useState(Object.fromEntries(DETAIL_FIELDS.map(f=>[f.k,form[f.k]||""])));
  const updDetail=(k,v)=>{setDetails(p=>({...p,[k]:v}));upd(k,v);};

  const generate=async()=>{
    setLoading(true);setError(null);
    const detailsBlock=DETAIL_FIELDS.filter(f=>details[f.k]?.trim()).map(f=>`- ${f.label}: ${details[f.k]}`).join("\n");
    const prompt=`Tu es un preparateur physique expert en musculation. Genere un programme de musculation structure en JSON strict.

PARAMETRES PRINCIPAUX:
- Objectif: ${form.goal}
- Niveau: ${form.level}
- Style: ${form.style}
- Seances par semaine: ${form.sessionsPerWeek}
- Nombre de semaines: ${form.weeks}
- Focus: ${form.focus||"equilibre general"}
- Contraintes: ${form.constraints||"aucune"}

PROFIL DETAILLE DE L ATHLETE:
${detailsBlock||"Aucun detail supplementaire fourni"}`;

    try{
      const resp=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({mode:"generate",prompt,sessions:SESSIONS})});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.error||"Erreur serveur");
      setPreview(data);setStep(1);
    }catch(e){setError("Erreur de generation: "+e.message);}
    setLoading(false);
  };

  const importProgram=async()=>{
    if(!importText.trim()&&!importFiles.length){setError("Colle un texte ou ajoute au moins un fichier.");return;}
    setLoading(true);setError(null);
    try{
      const payload={mode:"import",prompt:importText||(importFiles.length?"Programme dans les fichiers ci-joints":""),sessions:SESSIONS};
      if(importFiles.length)payload.filesData=importFiles.map(f=>({mimeType:f.mimeType,data:f.data}));
      const resp=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.error||"Erreur serveur");
      setPreview(data);setStep(1);
    }catch(e){setError("Erreur d'import: "+e.message);}
    setLoading(false);
  };

  const sL={width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"};
  const chipRow=(label,opts,key)=>(<div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>{label}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{opts.map(o=><button key={o} onClick={()=>upd(key,o)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid "+(form[key]===o?C.coach:C.brdL),background:form[key]===o?C.coachS:"transparent",color:form[key]===o?C.coach:C.tx3,fontSize:11,fontWeight:form[key]===o?700:400,cursor:"pointer",fontFamily:"inherit"}}>{o}</button>)}</div></div>);

  return(<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.85)",display:"flex",flexDirection:"column",overflowY:"auto"}}>
    <div style={{background:C.bg,minHeight:"100%",maxWidth:480,margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div><div style={{fontSize:15,fontWeight:700}}>Generateur IA</div><div style={{fontSize:11,color:C.tx3}}>Programme base par l IA, modifiable</div></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>x</button>
      </div>

      {step===0&&(<div style={{padding:"0 0 40px"}}>
        {/* Sub-tabs */}
        <div style={{display:"flex",borderBottom:"1px solid "+C.brd,marginBottom:16}}>
          {[{k:"import",l:"Import"},{k:"conv",l:"Chat IA"},{k:"form",l:"Parametres"},{k:"details",l:"Profil"}].map(t=>(
            <button key={t.k} onClick={()=>setAiTab(t.k)} style={{flex:1,padding:"10px 0",border:"none",borderBottom:"2px solid "+(aiTab===t.k?C.coach:"transparent"),background:"transparent",color:aiTab===t.k?C.coach:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px"}}>{t.l}</button>
          ))}
        </div>

        {aiTab==="import"&&(<div style={{padding:"0 16px"}}>
          <div style={{padding:"10px 14px",borderRadius:10,background:C.coachS,border:"1px solid "+C.coach+"40",marginBottom:16,fontSize:11,color:C.coach,lineHeight:1.6}}>
            Colle le texte de ton programme ou prends en photo ta feuille. L IA convertit automatiquement.
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>Texte du programme</div>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"Ex:\nBench Volume:\n- Dev. couche 4x10 @80kg RIR 2.5\n- Dev. incline halt. 3x12 @28kg\n\nSquat Volume:\n- Back squat 4x10 @100kg\n..."} rows={8} style={{...sL,resize:"vertical",lineHeight:1.6}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>Fichiers (images, PDF…)</div>
            <input ref={fileRef} type="file" accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.ods" multiple onChange={handleFilesUpload} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"14px 0",borderRadius:10,border:"1.5px dashed "+C.coach+"60",background:importFiles.length?C.gS:C.coachS,color:importFiles.length?C.g:C.coach,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {importFiles.length?`${importFiles.length} fichier${importFiles.length>1?"s":" "} selectionne${importFiles.length>1?"s":""} — Ajouter d'autres`:"+ Ajouter fichiers (JPG, PNG, PDF…)"}
            </button>
            {importFiles.length>0&&(<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              {importFiles.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.s2,borderRadius:8,padding:"8px 10px",border:"1px solid "+C.brdL}}>
                  {f.preview
                    ?<img src={f.preview} alt={f.name} style={{width:36,height:36,borderRadius:6,objectFit:"cover",background:C.s1,flexShrink:0}}/>
                    :<div style={{width:36,height:36,borderRadius:6,background:C.rS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📄</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                    <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase"}}>{f.mimeType.split("/")[1]}</div>
                  </div>
                  <button onClick={()=>removeImportFile(i)} style={{background:"none",border:"none",color:C.tx3,fontSize:16,cursor:"pointer",padding:"0 4px",flexShrink:0,fontFamily:"inherit"}}>×</button>
                </div>
              ))}
            </div>)}
          </div>
          {error&&<div style={{padding:"10px 14px",borderRadius:8,background:C.rS,border:"1px solid "+C.r+"40",color:C.r,fontSize:11,marginBottom:12}}>{error}</div>}
          <button onClick={importProgram} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:loading?"#333":C.coach,color:loading?C.tx3:"#fff",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>
            {loading?"Analyse en cours...":"Importer le programme"}
          </button>
        </div>)}

        {aiTab==="conv"&&(<div style={{padding:"0 16px",display:"flex",flexDirection:"column",height:"calc(100vh - 200px)"}}>
          <div style={{padding:"10px 14px",borderRadius:10,background:C.coachS,border:"1px solid "+C.coach+"40",marginBottom:12,fontSize:11,color:C.coach,lineHeight:1.6}}>
            Decris le programme que tu veux. L IA genere, tu ajustes, elle corrige. Quand c est bon → Appliquer.
          </div>
          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:12,paddingRight:4}}>
            {convMsgs.length===0&&(<div style={{textAlign:"center",padding:"30px 0",color:C.tx3,fontSize:12}}>
              Ex: "PPL 6 semaines, niveau intermediaire, epaule fragile gauche"
            </div>)}
            {convMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"85%",padding:"9px 13px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?C.coach:C.s2,color:m.role==="user"?"#fff":C.tx,fontSize:12,lineHeight:1.5}}>
                  {m.content}
                </div>
              </div>
            ))}
            {convLoading&&(<div style={{display:"flex",justifyContent:"flex-start"}}>
              <div style={{padding:"9px 13px",borderRadius:"12px 12px 12px 4px",background:C.s2,color:C.tx3,fontSize:12}}>...</div>
            </div>)}
            {convError&&(<div style={{padding:"8px 12px",borderRadius:8,background:C.rS,color:C.r,fontSize:11}}>{convError}</div>)}
            <div ref={convEndRef}/>
          </div>
          {/* Aperçu programme si généré */}
          {convProgram&&(<div style={{background:C.s1,borderRadius:10,padding:"10px 12px",border:"1px solid "+C.g+"40",marginBottom:10,maxHeight:160,overflowY:"auto"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.g,marginBottom:6}}>Programme actuel</div>
            {Object.entries(convProgram.sessions||{}).map(([sid,exList])=>{const s=SESSIONS.find(x=>x.id===sid);if(!s||!exList?.length)return null;return(<div key={sid} style={{fontSize:10,color:C.tx2,marginBottom:3}}><span style={{color:C.tx,fontWeight:600}}>{s.name}</span> — {exList.map(e=>e.name).join(", ")}</div>);})}
          </div>)}
          {/* Input */}
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <textarea value={convInput} onChange={e=>setConvInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendConvMessage();}}} placeholder={convProgram?"Ajuste le programme...":"Decris ce que tu veux..."} rows={2} style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",lineHeight:1.5}}/>
            <button onClick={sendConvMessage} disabled={convLoading||!convInput.trim()} style={{padding:"9px 14px",borderRadius:10,border:"none",background:convInput.trim()?C.coach:"#333",color:convInput.trim()?"#fff":C.tx3,fontSize:13,fontWeight:700,cursor:convInput.trim()?"pointer":"default",fontFamily:"inherit",flexShrink:0,alignSelf:"flex-end"}}>↑</button>
          </div>
          {convProgram&&(<button onClick={()=>onGenerate(convProgram.sessions)} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.coach,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:10}}>Appliquer ce programme</button>)}
        </div>)}

        {aiTab==="form"&&(<div style={{padding:"0 16px"}}>
          <div style={{padding:"10px 14px",borderRadius:10,background:C.coachS,border:"1px solid "+C.coach+"40",marginBottom:16,fontSize:11,color:C.coach,lineHeight:1.6}}>
            Complete aussi l onglet <strong>Profil detaille</strong> pour un programme vraiment personnalise.
          </div>
          {chipRow("Objectif",GOALS,"goal")}
          {chipRow("Niveau",LEVELS,"level")}
          {chipRow("Style",STYLES,"style")}
          <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>Seances / semaine</div><div style={{display:"flex",gap:6}}>{[3,4,5,6].map(n=><button key={n} onClick={()=>upd("sessionsPerWeek",n)} style={{flex:1,padding:"8px 0",borderRadius:7,border:"1px solid "+(form.sessionsPerWeek===n?C.coach:C.brdL),background:form.sessionsPerWeek===n?C.coachS:"transparent",color:form.sessionsPerWeek===n?C.coach:C.tx3,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>)}</div></div>
          <div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>Focus particulier (optionnel)</div><input value={form.focus} onChange={e=>upd("focus",e.target.value)} placeholder="Ex: epaules, force sur bench, post-blessure genou..." style={sL}/></div>
          <div style={{marginBottom:20}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:7}}>Contraintes rapides</div><textarea value={form.constraints} onChange={e=>upd("constraints",e.target.value)} placeholder="Resume rapide de contraintes importantes..." rows={2} style={{...sL,resize:"none",lineHeight:1.5}}/></div>
          {error&&<div style={{padding:"10px 14px",borderRadius:8,background:C.rS,border:"1px solid "+C.r+"40",color:C.r,fontSize:11,marginBottom:12}}>{error}</div>}
          <button onClick={()=>setAiTab("details")} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>Completer le profil detaille &gt;</button>
          <button onClick={generate} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:loading?"#333":C.coach,color:loading?C.tx3:"#fff",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>
            {loading?"Generation en cours...":"Generer le programme"}
          </button>
        </div>)}

        {aiTab==="details"&&(<div style={{padding:"0 16px"}}>
          <div style={{padding:"10px 14px",borderRadius:10,background:C.s2,border:"1px solid "+C.brdL,marginBottom:16,fontSize:11,color:C.tx2,lineHeight:1.6}}>
            Plus tu remplis ces champs, plus l IA pourra personnaliser le programme. Laisse vide ce qui ne s applique pas.
          </div>
          {DETAIL_FIELDS.map(f=>{
            const filled=details[f.k]?.trim();
            return(<div key={f.k} style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{fontSize:10,fontWeight:600,color:filled?C.g:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>{f.label}</div>
                {filled&&<div style={{width:6,height:6,borderRadius:"50%",background:C.g,flexShrink:0}}/>}
              </div>
              <textarea value={details[f.k]} onChange={e=>updDetail(f.k,e.target.value)} placeholder={f.placeholder} rows={2} style={{...sL,resize:"none",lineHeight:1.5,border:"1px solid "+(filled?C.g+"40":C.brdL)}}/>
            </div>);
          })}
          <div style={{padding:"10px 14px",borderRadius:8,background:C.gS,border:"1px solid "+C.g+"30",marginBottom:16,fontSize:11,color:C.g}}>
            {DETAIL_FIELDS.filter(f=>details[f.k]?.trim()).length} / {DETAIL_FIELDS.length} champs remplis
          </div>
          {error&&<div style={{padding:"10px 14px",borderRadius:8,background:C.rS,border:"1px solid "+C.r+"40",color:C.r,fontSize:11,marginBottom:12}}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:loading?"#333":C.coach,color:loading?C.tx3:"#fff",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>
            {loading?"Generation en cours...":"Generer le programme"}
          </button>
        </div>)}
      </div>)}

      {step===1&&preview&&(<div style={{padding:"16px"}}>
        <div style={{padding:"12px 14px",borderRadius:10,background:C.gS,border:"1px solid "+C.g+"40",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.g,marginBottom:4}}>Programme genere avec succes</div>
          <div style={{fontSize:11,color:C.tx2,lineHeight:1.6}}>{preview.rationale}</div>
        </div>
        <div style={{marginBottom:16}}>
          {Object.entries(preview.sessions||{}).map(([sid,exList])=>{const s=SESSIONS.find(x=>x.id===sid);if(!s||!exList?.length)return null;return(<div key={sid} style={{background:C.s1,borderRadius:10,padding:"10px 14px",marginBottom:8,border:"1px solid "+C.brd}}><div style={{fontSize:12,fontWeight:700,color:C.tx,marginBottom:6}}>{s.name} <span style={{fontSize:10,color:C.tx3}}>({exList.length} exos)</span></div>{exList.map((ex,i)=>{const wks=Object.keys(ex.weeks||{});return(<div key={i} style={{fontSize:11,color:C.tx2,padding:"3px 0",borderTop:i>0?"1px solid "+C.brd:""}}><span style={{color:getMC(ex.target||"Pecs"),fontWeight:600}}>{ex.name}</span> <span style={{color:C.tx3}}>- {ex.bloc} - S{wks[0]} a S{wks[wks.length-1]}</span></div>);})}</div>);})}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setStep(0)} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Regenerer</button>
          <button onClick={()=>onGenerate(preview.sessions)} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:C.coach,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Appliquer ce programme</button>
        </div>
        <div style={{fontSize:10,color:C.tx3,textAlign:"center",marginTop:8}}>Tu pourras modifier chaque exercice dans l editeur</div>
      </div>)}
    </div>
  </div>);
}

function CoachProgramEditor({exos,setExos,sessions,setSessions,athleteNotes,allMethods,customMethods,setCustomMethods,blockConfig,exMeta,currentWeek=1}){
  const tw=blockConfig?.totalWeeks||6;const dw=blockConfig?.deloadWeek||0;const progPct=blockConfig?.progressionPct||2.5;const deloadPct=blockConfig?.deloadPct||40;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const[sess,setSess]=useState(0);const[week,setWeek]=useState(1);const[openEx,setOpenEx]=useState(null);const[exosSearch,setExosSearch]=useState("");const[exosTypeFilter,setExosTypeFilter]=useState("");
  const[newMForm,setNewMForm]=useState(false);const[newM,setNewM]=useState({label:"",c:"#7B6FFF",e:"NEW"});
  const dropRef=useRef(null);
  const[showAI,setShowAI]=useState(false);
  const[addForm,setAddForm]=useState(false);
  const[newEx,setNewEx]=useState({name:"",bloc:null,target:"Pecs",exType:"muscu"});
  const[exSearch,setExSearch]=useState("");const[showExDropdown,setShowExDropdown]=useState(false);
  // normalizeExName is now defined at the top level
  // Close dropdown on click outside
  useEffect(()=>{if(!showExDropdown)return;const h=e=>{if(dropRef.current&&!dropRef.current.contains(e.target))setShowExDropdown(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[showExDropdown]);
  // Build unified exercise DB for picker — deduplicate by normalized name
  const exoDB=(()=>{const seen=new Set();const res=[];
    const addIfNew=(e)=>{const norm=normalizeExName(e.name).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({...e,name:normalizeExName(e.name)||e.name});}};
    Object.values(exos||{}).flat().forEach(addIfNew);
    Object.keys(exMeta||{}).forEach(n=>{const norm=normalizeExName(n).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({name:normalizeExName(n)||n,target:exMeta[n]?.target||"Pecs",bloc:"PERF",tier:exMeta[n]?.tier||3});}});
    return res;
  })();
  const[undoStack,setUndoStack]=useState([]);
  const[editingSession,setEditingSession]=useState(null);
  const[newSessForm,setNewSessForm]=useState(false);
  const[newSess,setNewSess]=useState({name:"",short:""});
  const[editingBlocs,setEditingBlocs]=useState(false);
  const[newBlocForm,setNewBlocForm]=useState(false);
  const[newBloc,setNewBloc]=useState({label:"",color:BLOC_COLORS[0]});
  const[editingBlocId,setEditingBlocId]=useState(null);
  const[dragId,setDragId]=useState(null);
  const[dragOverId,setDragOverId]=useState(null);

  const safeSessions=Array.isArray(sessions)?sessions:[];
  const safeSess=sess<safeSessions.length?sess:0;
  const sid=safeSessions[safeSess]?.id;const exList=exos[sid]||[];
  const sessBlocs=getSessionBlocs(safeSessions[safeSess],exList);
  const getBlocById=id=>sessBlocs.find(b=>b.id===id)||null;

  const tierCfg=blockConfig?.tierConfig||DEF_TIER_CONFIG;

  const autoFillProgression=()=>{
    const newExos={};
    Object.keys(exos).forEach(sessId=>{
      newExos[sessId]=(exos[sessId]||[]).map(ex=>{
        const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");if(eType!=="muscu"&&eType!=="halterophilie")return ex;
        const w1=ex.weeks?.[1]||{};
        const tier=getExTier(ex.name,ex);
        const tc=tierCfg[tier]||tierCfg[3];
        const newWeeks={...ex.weeks};
        const trainWeeks=weeksArr.filter(w=>w!==dw&&w>1);
        const totalTrainWeeks=trainWeeks.length;
        const defSets=w1.sets||3;
        const defReps=w1.repsRange||(tc.repsStart?String(tc.repsStart):"10");

        newWeeks[1]={...(newWeeks[1]||{}),sets:defSets,repsRange:defReps};
        if(tc.mode==="rir")newWeeks[1]={...newWeeks[1],rir:tc.rirStart};
        else if(tc.mode==="reps")newWeeks[1]={...newWeeks[1],repsRange:String(tc.repsStart),rir:tc.rirStart};
        else newWeeks[1]={...newWeeks[1],repsRange:String(tc.repsStart),rir:tc.rir??0};

        for(let w=2;w<=tw;w++){
          const isDeloadW=w===dw;
          const prevW=newWeeks[w-1]||w1;
          if(isDeloadW){
            const dlPct=tc.deloadPct||40;
            newWeeks[w]={...prevW,...(w1.kg?{kg:Math.round(w1.kg*(1-dlPct/100)/2.5)*2.5}:{}),sets:Math.max(2,Math.round((prevW.sets||defSets)*0.6)),rir:(tc.rirStart||2)+2,repsRange:prevW.repsRange};
          }else{
            const weekIdx=trainWeeks.indexOf(w);const progress=totalTrainWeeks>1?weekIdx/(totalTrainWeeks-1):0;
            if(tc.mode==="rir"){
              const rirRange=tc.rirStart-tc.rirEnd;
              const newRir=Math.round((tc.rirStart-rirRange*progress)*2)/2;
              const kgStep=tc.kgStep??2.5;
              newWeeks[w]={...prevW,...(w1.kg?{kg:roundHalf(w1.kg+kgStep*weekIdx)}:{}),sets:defSets,repsRange:defReps,rir:Math.max(0,newRir)};
            }else if(tc.mode==="reps"){
              const repRange=tc.repsEnd-tc.repsStart;
              const cycleLen=Math.max(2,repRange+1);
              const cycle=Math.floor(weekIdx/cycleLen);
              const posInCycle=weekIdx%cycleLen;
              const newReps=Math.min(tc.repsEnd,tc.repsStart+posInCycle);
              const kgStep=tc.kgStep??2.5;
              const rirRange=(tc.rirStart||2)-(tc.rirEnd||1);
              const repProgress=posInCycle/(cycleLen-1||1);
              const newRir=Math.round(((tc.rirStart||2)-rirRange*repProgress)*2)/2;
              newWeeks[w]={...prevW,...(w1.kg?{kg:roundHalf(w1.kg+kgStep*cycle)}:{}),sets:prevW.sets||defSets,repsRange:String(newReps),rir:Math.max(0,newRir)};
            }else{
              const repRange=tc.repsEnd-tc.repsStart;
              const cycleLen=repRange+1;
              const cycle=Math.floor(weekIdx/cycleLen);
              const posInCycle=weekIdx%cycleLen;
              const kgStep=tc.kgStep??1.25;
              newWeeks[w]={...prevW,...(w1.kg?{kg:roundHalf(w1.kg+kgStep*cycle)}:{}),sets:prevW.sets||defSets,repsRange:String(tc.repsStart+posInCycle),rir:tc.rir??0};
            }
          }
        }
        return{...ex,weeks:newWeeks};
      });
    });
    setExos(newExos);
  };

  const pickExFromDB=(dbEx)=>{
    const et=dbEx.exType||(dbEx.isFlexibility?"mobilite":"muscu");
    // Try to map old BT key to a session bloc by id match, else use first bloc
    const mappedBloc=sessBlocs.find(b=>b.id===dbEx.bloc)?.id||sessBlocs[0]?.id||null;
    setNewEx({name:dbEx.name,bloc:mappedBloc,target:dbEx.target||"Pecs",exType:et,tier:dbEx.tier||EX_TIER[dbEx.name]||3});
    setExSearch(dbEx.name);setShowExDropdown(false);
  };
  const addExercise=()=>{
    if(!newEx.name.trim())return;
    const raw=newEx.name.trim();
    const norm=normalizeExName(raw);
    const suffix=raw!==norm?raw.replace(norm,"").replace(/^\s*\(?/,"").replace(/\)?\s*$/,"").trim():"";
    const id="custom_"+sid+"_"+Date.now();
    const coachNote=suffix||"";
    const isMuscu=newEx.exType==="muscu"||newEx.exType==="halterophilie";
    setExos(prev=>({...prev,[sid]:[...(prev[sid]||[]),{id,name:norm||raw,bloc:newEx.bloc,target:newEx.target,exType:newEx.exType||"muscu",isFlexibility:!isMuscu,tier:isMuscu?(newEx.tier||3):undefined,weeks:{1:{coachNote:coachNote||undefined}}}]}));
    setNewEx({name:"",bloc:sessBlocs[0]?.id||null,target:"Pecs",exType:"muscu",tier:3});setExSearch("");setAddForm(false);
  };

  const removeExercise=(eid)=>{
    const ex=exList.find(e=>e.id===eid);
    const idx=exList.findIndex(e=>e.id===eid);
    if(ex)setUndoStack(prev=>[...prev,{sid,exercise:ex,index:idx}]);
    setExos(prev=>({...prev,[sid]:prev[sid].filter(e=>e.id!==eid)}));
    if(openEx===eid)setOpenEx(null);
  };

  const undoLast=()=>{
    if(!undoStack.length)return;
    const last=undoStack[undoStack.length-1];
    setUndoStack(prev=>prev.slice(0,-1));
    setExos(prev=>{
      const list=[...(prev[last.sid]||[])];
      list.splice(last.index,0,last.exercise);
      return{...prev,[last.sid]:list};
    });
  };

  const moveExercise=(eid,dir)=>{
    setExos(prev=>{
      const list=[...prev[sid]];
      const idx=list.findIndex(e=>e.id===eid);
      const newIdx=idx+dir;
      if(newIdx<0||newIdx>=list.length)return prev;
      [list[idx],list[newIdx]]=[list[newIdx],list[idx]];
      return{...prev,[sid]:list};
    });
  };

  const reorderExercise=(fromId,toId)=>{if(fromId===toId)return;setExos(prev=>{const list=[...(prev[sid]||[])];const fi=list.findIndex(e=>e.id===fromId);const ti=list.findIndex(e=>e.id===toId);if(fi<0||ti<0)return prev;const[moved]=list.splice(fi,1);list.splice(ti,0,moved);return{...prev,[sid]:list};});};
  const updField=(eid,f,val)=>setExos(prev=>({...prev,[sid]:prev[sid].map(e=>e.id===eid?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),[f]:f==="sets"||f==="kg"||f==="rir"?isNaN(+val)?val:+val:val}}}:e)}));
  const updExField=(eid,f,val)=>setExos(prev=>({...prev,[sid]:prev[sid].map(e=>e.id===eid?{...e,[f]:val}:e)}));
  const updMP=(eid,p)=>setExos(prev=>({...prev,[sid]:prev[sid].map(e=>e.id===eid?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),methodParams:p}}}:e)}));
  const fS={background:C.s2,color:C.tx,border:"1px solid "+C.brdL,fontFamily:"inherit",fontSize:13,fontWeight:700,textAlign:"center",borderRadius:8,padding:"7px 4px",width:"100%"};
  const addCM=()=>{if(!newM.label)return;const key="custom_"+Date.now();setCustomMethods(p=>[...p,{key,...newM}]);setNewMForm(false);};

  const renameSession=(idx,field,val)=>{setSessions(prev=>prev.map((s,i)=>i===idx?{...s,[field]:val}:s));};
  const duplicateSession=(idx)=>{const src=safeSessions[idx];if(!src)return;const newId="s_"+Date.now();setSessions(prev=>[...prev,{...src,id:newId,name:src.name+" (copie)",short:src.short.slice(0,2)+"2"}]);setExos(prev=>({...prev,[newId]:(prev[src.id]||[]).map(ex=>({...ex,id:"cp_"+Date.now()+"_"+ex.id}))}));};
  const addSession=()=>{if(!newSess.name.trim())return;const id="s_"+Date.now();setSessions(prev=>[...prev,{id,name:newSess.name.trim(),short:newSess.short.trim()||newSess.name.trim().slice(0,3).toUpperCase()}]);setExos(prev=>({...prev,[id]:[]}));setNewSess({name:"",short:""});setNewSessForm(false);};
  const removeSession=(idx)=>{const removedId=safeSessions[idx]?.id;setSessions(prev=>{const next=prev.filter((_,i)=>i!==idx);if(sess>=next.length)setSess(Math.max(0,next.length-1));return next;});if(removedId)setExos(prev=>{const next={...prev};delete next[removedId];return next;});};
  const addSessionBloc=()=>{if(!newBloc.label.trim())return;const id="bloc_"+Date.now();const base=safeSessions[safeSess]?.blocs?.length>0?safeSessions[safeSess].blocs:sessBlocs;setSessions(prev=>prev.map((s,i)=>i===safeSess?{...s,blocs:[...base,{id,label:newBloc.label.trim(),color:newBloc.color}]}:s));setNewBloc({label:"",color:BLOC_COLORS[(base.length+1)%BLOC_COLORS.length]});setNewBlocForm(false);};
  const removeSessionBloc=(bid)=>{const base=safeSessions[safeSess]?.blocs?.length>0?safeSessions[safeSess].blocs:sessBlocs;setSessions(prev=>prev.map((s,i)=>i===safeSess?{...s,blocs:base.filter(b=>b.id!==bid)}:s));setExos(prev=>({...prev,[sid]:(prev[sid]||[]).map(e=>e.bloc===bid?{...e,bloc:null}:e)}));};
  const updateSessionBloc=(bid,changes)=>{const base=safeSessions[safeSess]?.blocs?.length>0?safeSessions[safeSess].blocs:sessBlocs;setSessions(prev=>prev.map((s,i)=>i===safeSess?{...s,blocs:base.map(b=>b.id===bid?{...b,...changes}:b)}:s));};

  const applyAI=sessionsData=>{
    const newExos={...exos};
    Object.entries(sessionsData).forEach(([sid,list])=>{if(list&&Array.isArray(list))newExos[sid]=list.map(ex=>({...ex,weeks:Object.fromEntries(Object.entries(ex.weeks).map(([w,v])=>[w,{...v,repsRange:v.repsRange||String(v.reps||10)}]))}));});
    setExos(newExos);setShowAI(false);
  };

  return(<div>
    {showAI&&<AIGeneratorModal onGenerate={applyAI} onClose={()=>setShowAI(false)} allMethods={allMethods} existingExos={exos} sessions={safeSessions}/>}
    <button onClick={()=>setShowAI(true)} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1.5px dashed "+C.coach+"60",background:C.coachS,color:C.coach,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      <span style={{fontSize:14}}>*</span> Generer une base avec l IA
    </button>

    {/* Session tabs */}
    <div style={{display:"flex",gap:4,marginBottom:8,overflowX:"auto",scrollbarWidth:"none",alignItems:"center"}}>
      {safeSessions.map((s,i)=><button key={s.id} onClick={()=>{setSess(i);setOpenEx(null);}} onDoubleClick={()=>setEditingSession(i)} style={{flexShrink:0,padding:"7px 12px",borderRadius:8,border:"1px solid "+(i===safeSess?C.coach:C.brdL),background:i===safeSess?C.coachS:"transparent",color:i===safeSess?C.coach:C.tx2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s.short}</button>)}
      <button onClick={()=>setNewSessForm(o=>!o)} style={{flexShrink:0,width:28,height:28,borderRadius:7,border:"1px dashed "+C.coach+"50",background:"transparent",color:C.coach,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>+</button>
    </div>

    {editingSession!==null&&(<div style={{background:C.s1,borderRadius:10,padding:"10px 12px",border:"1px solid "+C.coach+"40",marginBottom:8}}>
      <div style={{fontSize:10,fontWeight:600,color:C.coach,marginBottom:8}}>Renommer la seance</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:6,marginBottom:8}}>
        <input value={sessions[editingSession]?.name||""} onChange={e=>renameSession(editingSession,"name",e.target.value)} placeholder="Nom complet" style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
        <input value={sessions[editingSession]?.short||""} onChange={e=>renameSession(editingSession,"short",e.target.value)} placeholder="Court" style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setEditingSession(null)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",background:C.coach,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>OK</button>
        <button onClick={()=>{duplicateSession(editingSession);setEditingSession(null);}} style={{padding:"7px 12px",borderRadius:7,border:"1px solid "+C.ac+"40",background:C.acS,color:C.ac,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Copier</button>
        <button onClick={()=>{removeSession(editingSession);setEditingSession(null);}} style={{padding:"7px 12px",borderRadius:7,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Suppr.</button>
      </div>
    </div>)}

    {newSessForm&&(<div style={{background:C.s1,borderRadius:10,padding:"10px 12px",border:"1px solid "+C.g+"40",marginBottom:8}}>
      <div style={{fontSize:10,fontWeight:600,color:C.g,marginBottom:8}}>Nouvelle seance</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:6,marginBottom:8}}>
        <input value={newSess.name} onChange={e=>setNewSess(p=>({...p,name:e.target.value}))} placeholder="Ex: Seance de la mort" style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
        <input value={newSess.short} onChange={e=>setNewSess(p=>({...p,short:e.target.value}))} placeholder="SDM" style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setNewSessForm(false)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
        <button onClick={addSession} style={{flex:2,padding:"7px 0",borderRadius:7,border:"none",background:C.g,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Ajouter</button>
      </div>
    </div>)}

    <div style={{fontSize:10,color:C.tx3,marginBottom:10}}>Double-cliquer sur un onglet pour renommer</div>

    {/* Bloc management per session */}
    <div style={{marginBottom:12,background:C.s1,borderRadius:10,padding:"10px 12px",border:"1px solid "+C.brdL}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Blocs de la séance</div>
        <button onClick={()=>{setEditingBlocs(o=>!o);setEditingBlocId(null);setNewBlocForm(false);}} style={{fontSize:10,color:editingBlocs?C.coach:C.tx3,fontWeight:editingBlocs?700:400,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{editingBlocs?"Fermer":"Gérer"}</button>
      </div>
      {/* Pills display */}
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {sessBlocs.length===0&&!editingBlocs&&<span style={{fontSize:10,color:C.tx3,fontStyle:"italic"}}>Aucun bloc — cliquez Gérer pour créer</span>}
        {sessBlocs.map(b=>(
          <div key={b.id} style={{padding:"3px 10px",borderRadius:6,border:"1px solid "+b.color+"50",background:b.color+"15",color:b.color,fontSize:10,fontWeight:600}}>{b.label}</div>
        ))}
      </div>
      {/* Editing panel */}
      {editingBlocs&&(<div style={{marginTop:10}}>
        {sessBlocs.map(b=>(
          <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"6px 8px",borderRadius:8,background:C.s2,border:"1px solid "+b.color+"30"}}>
            {/* Color swatch / picker toggle */}
            <div style={{position:"relative",flexShrink:0}}>
              <div onClick={()=>setEditingBlocId(editingBlocId===b.id?null:b.id)} style={{width:18,height:18,borderRadius:4,background:b.color,cursor:"pointer",border:"2px solid "+b.color+"80"}}/>
              {editingBlocId===b.id&&(
                <div style={{position:"absolute",top:"100%",left:0,zIndex:50,display:"flex",flexWrap:"wrap",gap:3,padding:6,background:C.s1,borderRadius:8,border:"1px solid "+C.brdL,width:108,marginTop:3,boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                  {BLOC_COLORS.map(col=><div key={col} onClick={()=>{updateSessionBloc(b.id,{color:col});setEditingBlocId(null);}} style={{width:18,height:18,borderRadius:4,background:col,cursor:"pointer",outline:b.color===col?"2px solid white":"none"}}/>)}
                </div>
              )}
            </div>
            <input value={b.label} onChange={e=>updateSessionBloc(b.id,{label:e.target.value})} style={{flex:1,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:11,fontFamily:"inherit"}}/>
            <button onClick={()=>removeSessionBloc(b.id)} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
        ))}
        {newBlocForm?(
          <div style={{display:"flex",gap:6,alignItems:"center",padding:"6px 8px",borderRadius:8,background:C.gS,border:"1px solid "+C.g+"40"}}>
            <div style={{width:18,height:18,borderRadius:4,background:newBloc.color,flexShrink:0,border:"2px solid "+newBloc.color+"80"}}/>
            <input value={newBloc.label} onChange={e=>setNewBloc(p=>({...p,label:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")addSessionBloc();if(e.key==="Escape")setNewBlocForm(false);}} placeholder="Nom du bloc..." style={{flex:1,padding:"4px 8px",borderRadius:6,border:"1px solid "+C.g+"50",background:C.s2,color:C.tx,fontSize:11,fontFamily:"inherit"}} autoFocus/>
            <div style={{display:"flex",flexWrap:"wrap",gap:2,maxWidth:72}}>
              {BLOC_COLORS.map(col=><div key={col} onClick={()=>setNewBloc(p=>({...p,color:col}))} style={{width:14,height:14,borderRadius:3,background:col,cursor:"pointer",outline:newBloc.color===col?"2px solid white":"none"}}/>)}
            </div>
            <button onClick={addSessionBloc} style={{padding:"4px 10px",borderRadius:6,border:"none",background:C.g,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>OK</button>
          </div>
        ):(
          <button onClick={()=>setNewBlocForm(true)} style={{width:"100%",padding:"6px 0",borderRadius:7,border:"1px dashed "+C.g+"50",background:"transparent",color:C.g,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Nouveau bloc</button>
        )}
      </div>)}
    </div>

    <div style={{display:"flex",gap:3,marginBottom:6,flexWrap:"wrap"}}>{weeksArr.map(w=><button key={w} onClick={()=>setWeek(w)} style={{flex:1,minWidth:36,padding:"9px 0",borderRadius:7,border:w===week?"2px solid "+C.coach:"1px solid "+(w===dw?C.b+"60":C.brd),background:w===week?C.coachS:(w===dw?C.bS:"transparent"),color:w===week?C.coach:(w===dw?C.b:C.tx3),fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>{w===dw&&<span style={{position:"absolute",top:-6,right:-2,fontSize:7,background:C.b,color:"#fff",padding:"1px 4px",borderRadius:4,fontWeight:700}}>DL</span>}S{w}</button>)}</div>
    {dw>0&&<div style={{fontSize:10,color:C.b,marginBottom:6,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:C.b,display:"inline-block"}}/> S{dw} = Deload (-{deloadPct}% charge, volume reduit)</div>}

    <button onClick={autoFillProgression} style={{width:"100%",padding:"9px 0",borderRadius:8,border:"1px solid "+C.o+"50",background:C.oS,color:C.o,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      ↗ Surcharge progressive — tout le bloc (S1→S{tw})
    </button>

    {undoStack.length>0&&(<button onClick={undoLast} style={{width:"100%",padding:"8px 0",borderRadius:8,border:"1px solid "+C.o+"50",background:C.oS,color:C.o,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      ← Annuler la suppression ({undoStack.length})
    </button>)}

    {exList.length>3&&<div style={{marginBottom:10}}>
      <input value={exosSearch} onChange={e=>setExosSearch(e.target.value)} placeholder="Rechercher dans la séance..." style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",marginBottom:6,outline:"none"}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[{k:"",l:"Tous"},{k:"muscu",l:"Muscu"},{k:"halterophilie",l:"Halté."},{k:"plio",l:"Plio"},{k:"mobilite",l:"Mob."}].map(({k,l})=>{const on=exosTypeFilter===k;const tc={muscu:C.tx2,halterophilie:"#8b5cf6",plio:C.o,mobilite:C.b,"":C.tx3}[k];return(<button key={k} onClick={()=>setExosTypeFilter(k)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(on?(k?tc:C.coach):C.brdL),background:on?(k?tc+"20":C.coachS):"transparent",color:on?(k?tc:C.coach):C.tx3,fontSize:11,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
        {(exosSearch||exosTypeFilter)&&<button onClick={()=>{setExosSearch("");setExosTypeFilter("");}} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+C.r+"50",background:C.rS,color:C.r,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
      </div>
    </div>}
    {(()=>{
      // Group exercises by bloc preserving display order
      const groups=[];const seenBloc=new Set();
      const filteredExList=exList.filter(ex=>{const nameMatch=!exosSearch||ex.name.toLowerCase().includes(exosSearch.toLowerCase());const et=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const typeMatch=!exosTypeFilter||et===exosTypeFilter;return nameMatch&&typeMatch;});
      filteredExList.forEach(ex=>{
        const key=ex.bloc||"__no_bloc__";
        if(!seenBloc.has(key)){seenBloc.add(key);groups.push({blocId:ex.bloc,exs:[]});}
        groups.find(g=>g.blocId===ex.bloc).exs.push(ex);
      });
      if(filteredExList.length===0&&exList.length>0)return[<div key="empty" style={{textAlign:"center",padding:"20px 0",color:C.tx3,fontSize:12}}>Aucun exercice ne correspond</div>];
      return groups.map(({blocId,exs:groupExs})=>{
        const bloc=getBlocById(blocId);const blocC=bloc?.color||C.tx3;
        return(<div key={blocId||"__no_bloc__"} style={{marginBottom:14,borderRadius:14,border:"1px solid "+blocC+(bloc?"40":"20"),background:blocC+(bloc?"0D":"00"),overflow:"hidden"}}>
          {/* Bloc header */}
          {bloc&&(<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:blocC+"22",borderBottom:"1px solid "+blocC+"30"}}>
            <div style={{width:4,height:16,borderRadius:2,background:blocC,flexShrink:0}}/>
            <span style={{fontSize:12,fontWeight:800,color:blocC,letterSpacing:"0.2px"}}>{bloc.label}</span>
            <span style={{fontSize:9,color:C.tx3,marginLeft:"auto"}}>{groupExs.length} exercice{groupExs.length>1?"s":""}</span>
          </div>)}
          {/* Exercises */}
          <div style={{padding:bloc?"6px 8px":"0"}}>
          {groupExs.map(ex=>{
            const exIdx=exList.indexOf(ex);const wd=ex.weeks[week]||{};const isOpen=openEx===ex.id;const sk=ex.id+"_"+week;const aNote=athleteNotes[sk]||"";const curM=allMethods[wd.method];const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isFlex=eType!=="muscu"&&eType!=="halterophilie";const exTier=getExTier(ex.name,ex);const exTc=tierCfg[exTier]||tierCfg[3];const typeLabels={muscu:"Muscu",plio:"Plio",mobilite:"Mobilité",halterophilie:"Halté."};const typeColors={muscu:C.tx3,plio:C.o,mobilite:C.b,halterophilie:"#8b5cf6"};
            return(<div key={ex.id} draggable={true} onDragStart={e=>{setDragId(ex.id);e.dataTransfer.effectAllowed="move";}} onDragOver={e=>{e.preventDefault();setDragOverId(ex.id);}} onDrop={e=>{e.preventDefault();if(dragId&&dragId!==ex.id)reorderExercise(dragId,ex.id);setDragId(null);setDragOverId(null);}} onDragEnd={()=>{setDragId(null);setDragOverId(null);}} style={{background:C.s1,borderRadius:10,marginBottom:4,border:"1px solid "+(dragOverId===ex.id?C.ac:C.brd),overflow:"hidden",opacity:dragId===ex.id?0.45:1,transition:"opacity 0.15s,border-color 0.15s"}}>
              <div onClick={()=>setOpenEx(isOpen?null:ex.id)} style={{display:"flex",alignItems:"center",padding:"11px 13px",cursor:"pointer",gap:10}}>
                <div style={{color:C.tx3+"60",fontSize:13,cursor:"grab",userSelect:"none",flexShrink:0}} onMouseDown={e=>e.stopPropagation()}>⠿</div>
                <div style={{width:3,height:28,borderRadius:2,background:blocC,flexShrink:0,position:"relative"}}><span style={{position:"absolute",top:-6,left:-3,fontSize:7,fontWeight:800,color:exTc.c,background:exTc.c+"20",padding:"0 3px",borderRadius:3}}>{isFlex?"":("T"+exTier)}</span></div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:600}}>{ex.name}</span>
                    {eType!=="muscu"&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:typeColors[eType]+"20",color:typeColors[eType],fontWeight:600}}>{typeLabels[eType]}</span>}
                  </div>
                  {!isFlex&&(wd.pdc||wd.kg)?<div style={{fontSize:11,color:C.tx2,marginTop:2}}>{wd.pdc?"PDC":wd.kg+"kg"} - {wd.sets}x{wd.repsRange||"?"} - <span style={{color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</span>{curM?" - "+curM.e+" "+curM.label:""}</div>
                  :isFlex&&wd.sets?<div style={{fontSize:11,color:C.tx2,marginTop:2}}>{wd.sets}x{wd.repsRange||"?"}{wd.tempo?" tempo "+wd.tempo:""}</div>
                  :<div style={{fontSize:11,color:C.tx3,marginTop:2}}>Aucune prescription</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  {aNote&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:C.b+"20",color:C.b,fontWeight:600}}>retour</span>}
                  <button onClick={e=>{e.stopPropagation();moveExercise(ex.id,-1);}} disabled={exIdx===0} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:exIdx===0?C.tx3+"40":C.tx2,fontSize:10,cursor:exIdx===0?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↑</button>
                  <button onClick={e=>{e.stopPropagation();moveExercise(ex.id,1);}} disabled={exIdx===exList.length-1} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:exIdx===exList.length-1?C.tx3+"40":C.tx2,fontSize:10,cursor:exIdx===exList.length-1?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↓</button>
                  <button onClick={e=>{e.stopPropagation();removeExercise(ex.id);}} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>x</button>
                  <span style={{fontSize:12,color:C.tx3}}>{isOpen?"^":"v"}</span>
                </div>
              </div>
              {isOpen&&(<div onMouseDown={e=>e.stopPropagation()} style={{padding:"0 13px 16px",borderTop:"1px solid "+C.brd}}>
                {aNote&&<div style={{margin:"12px 0",padding:"10px 12px",borderRadius:8,background:C.b+"12",border:"1px solid "+C.b+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.b,textTransform:"uppercase",marginBottom:4}}>Retour S{week}</div><div style={{fontSize:12,color:C.tx2,lineHeight:1.5,fontStyle:"italic"}}>"{aNote}"</div></div>}
                <div style={{paddingTop:12,marginBottom:12,padding:"10px 12px",borderRadius:8,background:C.s2,border:"1px solid "+C.brdL}}>
                  <div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Parametres exercice</div>
                  <div style={{marginBottom:8}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4}}>Nom</div><input value={ex.name} onChange={e=>updExField(ex.id,"name",e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4}}>Bloc</div>
                      <select value={ex.bloc||""} onChange={e=>updExField(ex.id,"bloc",e.target.value||null)} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+(getBlocById(ex.bloc)?.color||C.brdL),background:C.s1,color:getBlocById(ex.bloc)?.color||C.tx,fontSize:12,fontFamily:"inherit"}}>
                        <option value="">— Aucun —</option>
                        {sessBlocs.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
                      </select>
                    </div>
                    <div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4}}>Type</div>
                      <div style={{display:"flex",gap:3}}>{[{k:"muscu",l:"Muscu",c:C.tx3},{k:"halterophilie",l:"Halté.",c:"#8b5cf6"},{k:"plio",l:"Plio",c:C.o},{k:"mobilite",l:"Mob.",c:C.b}].map(({k,l,c})=>{const on=eType===k;return(<button key={k} onClick={()=>updExField(ex.id,"exType",k)} style={{flex:1,padding:"5px 2px",borderRadius:6,border:"1px solid "+(on?c:C.brdL),background:on?c+"20":"transparent",color:on?c:C.tx3,fontSize:10,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}</div>
                    </div>
                  </div>
                </div>
                {!isFlex?(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>Charge<button onClick={()=>updField(ex.id,"pdc",!wd.pdc)} style={{padding:"1px 5px",borderRadius:4,border:"1px solid "+(wd.pdc?C.ac:C.brdL),background:wd.pdc?C.acS:"transparent",color:wd.pdc?C.ac:C.tx3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>PDC</button></div>{wd.pdc?<div style={{...fS,display:"flex",alignItems:"center",justifyContent:"center",background:C.acS,border:"1px solid "+C.ac,color:C.ac,fontWeight:700}}>PDC</div>:<input type="number" value={wd.kg??""} placeholder="--" onChange={e=>updField(ex.id,"kg",e.target.value)} style={fS}/>}</div><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center"}}>Series</div><input type="number" value={wd.sets??""} placeholder="--" onChange={e=>updField(ex.id,"sets",e.target.value)} style={fS}/></div></div>
                ):(<div style={{marginBottom:10}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center"}}>Series</div><input type="number" value={wd.sets||""} placeholder="--" onChange={e=>updField(ex.id,"sets",e.target.value)} style={fS}/></div>)}
                <div style={{marginBottom:10}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5}}>Repetitions / Duree</div><input type="text" value={wd.repsRange||""} placeholder={isFlex?"30s ou 10":"10 ou 8-12"} onChange={e=>updField(ex.id,"repsRange",e.target.value)} style={{...fS,textAlign:"left",paddingLeft:10}}/></div>
                <div style={{display:"grid",gridTemplateColumns:isFlex?"1fr":"1fr 1fr",gap:8,marginBottom:14}}>
                  <div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5,textAlign:"center"}}>Tempo</div><input type="text" value={wd.tempo||""} placeholder="3-1-2-0" onChange={e=>updField(ex.id,"tempo",e.target.value)} style={{...fS,fontSize:12}}/></div>
                  {!isFlex&&<div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5,textAlign:"center"}}>RIR cible</div><div style={{display:"flex",justifyContent:"center"}}><RIRMini value={wd.rir??2} onChange={v=>updField(ex.id,"rir",v)}/></div></div>}
                </div>
                {!isFlex&&(<div style={{marginBottom:14}}>
                  <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Methode</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    <button onClick={()=>{updField(ex.id,"method",null);updMP(ex.id,null);}} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(!wd.method?C.coach:C.brdL),background:!wd.method?C.coachS:"transparent",color:!wd.method?C.coach:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:!wd.method?700:400}}>Standard</button>
                    {Object.entries(allMethods).map(([k,m])=><button key={k} onClick={()=>{updField(ex.id,"method",wd.method===k?null:k);if(wd.method!==k)updMP(ex.id,MDEF[k]||null);}} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(wd.method===k?m.c:C.brdL),background:wd.method===k?m.c+"20":"transparent",color:wd.method===k?m.c:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:wd.method===k?700:400}}>{m.e} {m.label}</button>)}
                    <button onClick={()=>setNewMForm(o=>!o)} style={{padding:"5px 10px",borderRadius:7,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Custom</button>
                  </div>
                  {wd.method&&<MethodParamsForm method={wd.method} params={wd.methodParams} onChange={p=>updMP(ex.id,p)} exosInSession={exList} currentExId={ex.id}/>}
                  {newMForm&&(<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+C.brdL}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><input value={newM.label} onChange={e=>setNewM(p=>({...p,label:e.target.value}))} placeholder="Nom" style={{padding:"6px 8px",borderRadius:6,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit"}}/><input value={newM.e} onChange={e=>setNewM(p=>({...p,e:e.target.value}))} placeholder="Code" style={{padding:"6px 8px",borderRadius:6,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit"}}/></div><button onClick={addCM} style={{padding:"6px 14px",borderRadius:7,border:"none",background:C.coachS,color:C.coach,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ajouter</button></div>)}
                </div>)}
                <div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Consigne technique</div><textarea value={wd.coachNote||""} onChange={e=>updField(ex.id,"coachNote",e.target.value)} placeholder="Ex: garder les omoplates retractees..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.coach+"60",background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/></div>
                {!isFlex&&wd.kg&&wd.repsRange&&<div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:C.s2,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:C.tx3}}>1RM estime</span><span style={{fontSize:14,fontWeight:700,color:C.coach}}>{e1rm(wd.kg,parseReps(wd.repsRange)||1)} kg</span></div>}
              </div>)}
            </div>);
          })}
          </div>
        </div>);
      });
    })()}

    {/* Add exercise */}
    <div style={{marginTop:8}}>
      {!addForm?(<button onClick={()=>setAddForm(true)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px dashed "+C.g+"50",background:C.gS,color:C.g,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter un exercice ({exList.length})</button>):(
        <div style={{background:C.s1,borderRadius:12,padding:"14px",border:"1px solid "+C.g+"40"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.g,marginBottom:12}}>Nouvel exercice</div>
           <div style={{marginBottom:10,position:"relative"}} ref={dropRef}>
            <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5}}>Nom (depuis la base Exos)</div>
            <input value={exSearch} onChange={e=>{setExSearch(e.target.value);setNewEx(p=>({...p,name:e.target.value}));setShowExDropdown(true);}} onFocus={()=>setShowExDropdown(true)} placeholder="Rechercher ou créer..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&addExercise()}/>
            {/* Duplicate/similar alert */}
            {(()=>{
              const typed=normalizeExName(exSearch||"").toLowerCase();
              if(!typed)return null;
              const inThisSession=exList.some(x=>normalizeExName(x.name).toLowerCase()===typed);
              const otherSessions=safeSessions.filter(s=>s.id!==sid&&(exos[s.id]||[]).some(x=>normalizeExName(x.name).toLowerCase()===typed));
              if(!inThisSession&&!otherSessions.length)return null;
              return(<div style={{marginTop:4,padding:"6px 10px",borderRadius:7,border:"1px solid "+(inThisSession?C.o:C.g)+"50",background:inThisSession?C.oS:C.gS,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,color:inThisSession?C.o:C.g}}>{inThisSession?"⚠ Déjà dans cette séance":"✓ Présent dans : "+otherSessions.map(s=>s.short).join(", ")+" → progression liée"}</span>
              </div>);
            })()}
            {showExDropdown&&(()=>{const matches=exoDB.filter(e=>e.name.toLowerCase().includes((exSearch||"").toLowerCase()));const exact=matches.some(e=>e.name.toLowerCase()===(exSearch||"").toLowerCase());return(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:20,background:C.s1,border:"1px solid "+C.brdL,borderRadius:8,maxHeight:200,overflowY:"auto",marginTop:2}}>
              {matches.slice(0,10).map(e=>{const mc=getMC(e.target||"Pecs");const normE=normalizeExName(e.name).toLowerCase();const inThisSess=exList.some(x=>normalizeExName(x.name).toLowerCase()===normE);const usedIn=safeSessions.filter(s=>(exos[s.id]||[]).some(x=>normalizeExName(x.name).toLowerCase()===normE)).map(s=>s.short);return(<div key={e.name} onClick={()=>{if(!inThisSess)pickExFromDB(e);}} style={{padding:"8px 12px",cursor:inThisSess?"default":"pointer",display:"flex",alignItems:"center",gap:8,opacity:inThisSess?0.4:1,borderBottom:"1px solid "+C.brd}}>
                <span style={{width:3,height:16,borderRadius:2,background:mc,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <span style={{fontSize:12}}>{e.name}</span>
                  {usedIn.length>0&&<div style={{fontSize:8,color:C.g,marginTop:1}}>↔ {usedIn.join(", ")}</div>}
                </div>
                {inThisSess&&<span style={{fontSize:9,color:C.tx3}}>déjà ajouté</span>}
                <span style={{fontSize:9,color:mc}}>{mL(e.target||"Pecs")}</span>
              </div>);})}
              {exSearch.trim()&&!exact&&(()=>{
                const normTyped=normalizeExName(exSearch.trim()).toLowerCase();
                const similar=exoDB.filter(e=>normalizeExName(e.name).toLowerCase()===normTyped&&e.name.toLowerCase()!==exSearch.trim().toLowerCase());
                return(<>
                  {similar.length>0&&<div style={{padding:"6px 12px",background:C.oS,borderBottom:"1px solid "+C.brd}}>
                    <div style={{fontSize:10,color:C.o}}>⚠ Variante existante : {similar.map(s=>s.name).join(", ")}</div>
                    <div style={{fontSize:9,color:C.tx3}}>Les stats seront fusionnées automatiquement</div>
                  </div>}
                  <div onClick={()=>{setNewEx(p=>({...p,name:exSearch.trim()}));setShowExDropdown(false);}} style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,background:C.gS}}>
                    <span style={{fontSize:12,color:C.g,fontWeight:600}}>+ Créer "{exSearch.trim()}"</span>
                  </div>
                </>);
              })()}
              {!exSearch.trim()&&matches.length===0&&<div style={{padding:"8px 12px",fontSize:11,color:C.tx3}}>Aucun exercice</div>}
            </div>);})()}
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5}}>Type d'exercice</div>
            <div style={{display:"flex",gap:4}}>{[{k:"muscu",l:"Musculation",c:C.tx2},{k:"halterophilie",l:"Haltérophilie",c:"#8b5cf6"},{k:"plio",l:"Pliométrie",c:C.o},{k:"mobilite",l:"Mobilité",c:C.b}].map(({k,l,c})=>{const on=(newEx.exType||"muscu")===k;return(<button key={k} onClick={()=>setNewEx(p=>({...p,exType:k}))} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"1px solid "+(on?c:C.brdL),background:on?c+"20":"transparent",color:on?c:C.tx3,fontSize:10,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}</div>
          </div>
          {["muscu","halterophilie"].includes(newEx.exType||"muscu")&&<div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5}}>Categorie surcharge</div>
            <div style={{display:"flex",gap:4}}>{[1,2,3].map(t=>{const tc=tierCfg[t];return(<button key={t} onClick={()=>setNewEx(p=>({...p,tier:t}))} style={{flex:1,padding:"6px 4px",borderRadius:7,border:"1px solid "+((newEx.tier||3)===t?tc.c:C.brdL),background:(newEx.tier||3)===t?tc.c+"20":"transparent",color:(newEx.tier||3)===t?tc.c:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tc.label}</button>);})}</div>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:!["muscu","halterophilie"].includes(newEx.exType||"muscu")?"1fr":"1fr 1fr",gap:8,marginBottom:12}}>
            <div>
              <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5}}>Bloc</div>
              <select value={newEx.bloc||""} onChange={e=>setNewEx(p=>({...p,bloc:e.target.value||null}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+(sessBlocs.find(b=>b.id===newEx.bloc)?.color||C.brdL),background:C.s2,color:sessBlocs.find(b=>b.id===newEx.bloc)?.color||C.tx,fontSize:12,fontFamily:"inherit"}}>
                <option value="">— Aucun —</option>
                {sessBlocs.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            {["muscu","halterophilie"].includes(newEx.exType||"muscu")&&<div>
              <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5}}>Muscle cible</div>
              <select value={newEx.target} onChange={e=>setNewEx(p=>({...p,target:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}>
                {ALL_MIDS.filter(m=>!MTREE.find(g=>g.id===m&&g.s.length>0)).map(m=><option key={m} value={m}>{mL(m)}</option>)}
              </select>
            </div>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAddForm(false);setNewEx({name:"",bloc:"PERF",target:"Pecs",exType:"muscu"});setExSearch("");setShowExDropdown(false);}} style={{flex:1,padding:"9px 0",borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
            <button onClick={addExercise} style={{flex:2,padding:"9px 0",borderRadius:8,border:"none",background:C.g,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ajouter</button>
          </div>
        </div>
      )}
    </div>
  </div>);
}

function CoachExoParams({exMeta,setExMeta,exos,setExos,blockConfig}){
  const[search,setSearch]=useState("");const[open,setOpen]=useState(null);
  const[addMode,setAddMode]=useState(false);const[newName,setNewName]=useState("");const[newTarget,setNewTarget]=useState(["Pecs"]);
  const[editName,setEditName]=useState(null);const[editVal,setEditVal]=useState("");
  const[confirmDel,setConfirmDel]=useState(null);
  const tierCfg=blockConfig?.tierConfig||DEF_TIER_CONFIG;
  const allU=(()=>{const seen=new Set();const res=[];
    const addIfNew=(e)=>{const norm=normalizeExName(e.name).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({...e,name:normalizeExName(e.name)||e.name});}};
    Object.values(exos||{}).flat().forEach(addIfNew);
    Object.keys(exMeta||{}).forEach(name=>{const norm=normalizeExName(name).toLowerCase();if(!seen.has(norm)){seen.add(norm);const pr=normPrimary(exMeta[name]?.primary);res.push({id:"meta_"+name,name:normalizeExName(name)||name,bloc:"ESTH",target:pr[0]||"Pecs",weeks:{},exType:exMeta[name]?.exType||"muscu"});}});
    return res;
  })();
  const usageCount=(name)=>{const norm=normalizeExName(name).toLowerCase();return Object.values(exos||{}).flat().filter(e=>normalizeExName(e.name).toLowerCase()===norm).length;};
  const filt=allU.filter(e=>e.name.toLowerCase().includes(search.toLowerCase()));
  const upd=(name,f,v)=>setExMeta(p=>({...p,[name]:{...(p[name]||{}),[f]:v}}));
  const togSec=(name,m,curMeta)=>{const base=curMeta||exMeta[name]||{};const pr=normPrimary(base.primary);if(pr.includes(m))return;const c=base.secondary||[];setExMeta({...exMeta,[name]:{...base,secondary:c.includes(m)?c.filter(x=>x!==m):[...c,m]}});};
  const updTierForEx=(exName,newTier)=>{
    const norm=normalizeExName(exName).toLowerCase();
    const newExos={};Object.keys(exos||{}).forEach(sid=>{newExos[sid]=(exos[sid]||[]).map(e=>normalizeExName(e.name).toLowerCase()===norm?{...e,tier:newTier}:e);});
    setExos(newExos);
    setExMeta({...exMeta,[exName]:{...(exMeta[exName]||{}),tier:newTier}});
  };
  const updExTypeForEx=(exName,newType)=>{
    const norm=normalizeExName(exName).toLowerCase();
    const newExos={};Object.keys(exos||{}).forEach(sid=>{newExos[sid]=(exos[sid]||[]).map(e=>normalizeExName(e.name).toLowerCase()===norm?{...e,exType:newType,isFlexibility:newType!=="muscu"&&newType!=="halterophilie"}:e);});
    setExos(newExos);
    setExMeta({...exMeta,[exName]:{...(exMeta[exName]||{}),exType:newType}});
  };
  const getExTierFromExos=(exName)=>{
    const norm=normalizeExName(exName).toLowerCase();
    for(const sid of Object.keys(exos||{})){const found=(exos[sid]||[]).find(e=>normalizeExName(e.name).toLowerCase()===norm);if(found&&found.tier)return found.tier;}
    if(exMeta[exName]?.tier)return exMeta[exName].tier;
    return EX_TIER[exName]||3;
  };
  const addExo=()=>{
    const n=newName.trim();if(!n)return;
    if(allU.some(e=>e.name.toLowerCase()===n.toLowerCase()))return;
    setExMeta(p=>({...p,[n]:{primary:newTarget,secondary:[],tier:3}}));
    setNewName("");setAddMode(false);setNewTarget(["Pecs"]);
  };
  const renameExo=(oldName,newN)=>{
    const trimmed=newN.trim();if(!trimmed||trimmed===oldName)return setEditName(null);
    if(allU.some(e=>e.name.toLowerCase()===trimmed.toLowerCase()&&e.name!==oldName))return;
    const normOld=normalizeExName(oldName).toLowerCase();
    setExos(prev=>{const n={...prev};Object.keys(n).forEach(sid=>{n[sid]=n[sid].map(e=>normalizeExName(e.name).toLowerCase()===normOld?{...e,name:trimmed}:e);});return n;});
    setExMeta(p=>{const n={...p};if(n[oldName]){n[trimmed]=n[oldName];delete n[oldName];}return n;});
    setEditName(null);
  };
  const deleteExo=(name)=>{
    setExos(prev=>{const n={...prev};Object.keys(n).forEach(sid=>{n[sid]=n[sid].filter(e=>e.name!==name);});return n;});
    setExMeta(p=>{const n={...p};delete n[name];return n;});
    setConfirmDel(null);setOpen(null);
  };
  return(<div>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
      <button onClick={()=>setAddMode(!addMode)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid "+C.g+"50",background:addMode?C.gS:"transparent",color:C.g,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{addMode?"✕":"+ Exo"}</button>
    </div>
    {addMode&&(<div style={{background:C.s1,borderRadius:12,padding:14,border:"1px solid "+C.g+"40",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.g,marginBottom:8}}>Nouvel exercice</div>
      <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nom de l'exercice..." onKeyDown={e=>e.key==="Enter"&&addExo()} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{fontSize:10,fontWeight:600,color:C.tx3,marginBottom:6}}>Muscles principaux <span style={{fontWeight:400}}>(max 4)</span></div>
      <MuscleSelector value={newTarget} onChange={v=>{const arr=normPrimary(v);if(arr.length<=4)setNewTarget(arr);}} multi/>
      <button onClick={addExo} disabled={!newName.trim()} style={{width:"100%",padding:"8px",borderRadius:8,border:"none",background:C.g,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:newName.trim()?1:0.4}}>Ajouter</button>
    </div>)}
    {filt.map(ex=>{const bt=BT[ex.bloc]||{c:C.tx3,l:"?"};const isOpen=open===(ex.id||ex.name);const meta=exMeta[ex.name]||{primary:ex.target,secondary:[]};const primaries=normPrimary(meta.primary);const pc=primaries.length>0?getMC(primaries[0]):getMC(ex.target);const curTier=getExTierFromExos(ex.name);const curTc=tierCfg[curTier]||tierCfg[3];const usage=usageCount(ex.name);const isEditing=editName===ex.name;const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isMuscu=eType==="muscu"||eType==="halterophilie";
      return(<div key={ex.id||ex.name} style={{background:C.s1,borderRadius:12,marginBottom:6,border:"1px solid "+(confirmDel===ex.name?C.r+"60":C.brd),overflow:"hidden"}}>
        <div onClick={()=>{if(!isEditing&&confirmDel!==ex.name)setOpen(isOpen?null:(ex.id||ex.name));}} style={{display:"flex",alignItems:"center",padding:"12px 14px",cursor:"pointer",gap:10}}>
          <div style={{width:3,height:28,borderRadius:2,background:bt.c,flexShrink:0}}/>
          <div style={{flex:1}}>
            {isEditing?(<input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>renameExo(ex.name,editVal)} onKeyDown={e=>{if(e.key==="Enter")renameExo(ex.name,editVal);if(e.key==="Escape")setEditName(null);}} onClick={e=>e.stopPropagation()} style={{fontSize:13,fontWeight:600,background:C.s2,border:"1px solid "+C.acS,borderRadius:6,padding:"4px 8px",color:C.tx,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>):(
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600}}>{ex.name}</span>{usage>0&&<span style={{fontSize:8,fontWeight:700,padding:"2px 6px",borderRadius:5,background:C.acS,color:C.ac}}>{usage} séance{usage>1?"s":""}</span>}{usage===0&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:5,background:C.s2,color:C.tx3}}>non utilisé</span>}</div>)}
            <div style={{display:"flex",gap:5,marginTop:4,flexWrap:"wrap"}}>{isMuscu&&primaries.map(m=>{const mc=getMC(m);return <span key={m} style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:mc+"20",color:mc}}>{mL(m)}</span>;})}{isMuscu&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:curTc.c+"20",color:curTc.c}}>T{curTier}</span>}{!isMuscu&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:eType==="plio"?C.o+"20":C.b+"20",color:eType==="plio"?C.o:C.b}}>{eType==="plio"?"Plio":"Mobilité"}</span>}{isMuscu&&(meta.secondary||[]).slice(0,3).map(m=><span key={m} style={{fontSize:9,padding:"2px 6px",borderRadius:5,background:getMC(m)+"15",color:getMC(m)}}>{mL(m)}</span>)}</div>
          </div>
          <span style={{fontSize:12,color:C.tx3}}>{isOpen?"^":"v"}</span>
        </div>
        {confirmDel===ex.name&&(<div style={{padding:"10px 14px",background:C.rS,borderTop:"1px solid "+C.r+"30",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:C.r,fontWeight:600}}>Supprimer {ex.name} ?{usage>0?` (${usage} séance${usage>1?"s":""})`:""}</span>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setConfirmDel(null)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Non</button>
            <button onClick={()=>deleteExo(ex.name)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:C.r,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Oui</button>
          </div>
        </div>)}
        {isOpen&&(<div style={{padding:"0 14px 16px",borderTop:"1px solid "+C.brd}}><div style={{paddingTop:12}}>
          {/* Edit / Delete buttons */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <button onClick={(e)=>{e.stopPropagation();setEditName(ex.name);setEditVal(ex.name);}} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.ac+"40",background:C.acS,color:C.ac,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️ Renommer</button>
            <button onClick={(e)=>{e.stopPropagation();setConfirmDel(ex.name);}} style={{flex:1,padding:"6px",borderRadius:7,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑 Supprimer</button>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Type d'exercice</div>
            <div style={{display:"flex",gap:4}}>{[{v:"muscu",l:"Muscu"},{v:"halterophilie",l:"Halté."},{v:"plio",l:"Plio"},{v:"mobilite",l:"Mobilité"}].map(({v,l})=>(<button key={v} onClick={()=>updExTypeForEx(ex.name,v)} style={{flex:1,padding:"6px 4px",borderRadius:7,border:"1px solid "+(eType===v?C.ac:C.brdL),background:eType===v?C.acS:"transparent",color:eType===v?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}</div>
          </div>
          {isMuscu&&(<div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Categorie surcharge</div>
            <div style={{display:"flex",gap:4}}>{[1,2,3].map(t=>{const tc=tierCfg[t];return(<button key={t} onClick={()=>updTierForEx(ex.name,t)} style={{flex:1,padding:"6px 4px",borderRadius:7,border:"1px solid "+(curTier===t?tc.c:C.brdL),background:curTier===t?tc.c+"20":"transparent",color:curTier===t?tc.c:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tc.label}</button>);})}</div>
            <div style={{fontSize:9,color:C.tx3,marginTop:4}}>{curTc.mode==="rir"?"+"+( curTc.kgStep??2.5)+"kg/sem · RIR "+curTc.rirStart+"→"+curTc.rirEnd:curTc.mode==="reps"?"Reps "+curTc.repsStart+"→"+curTc.repsEnd+" puis +"+( curTc.kgStep??2.5)+"kg":"Reps "+curTc.repsStart+"→"+curTc.repsEnd+" échec puis +"+( curTc.kgStep??1.25)+"kg"}</div>
          </div>)}
          {isMuscu&&<><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Muscles principaux <span style={{fontWeight:400,textTransform:"none"}}>(max 4)</span></div><MuscleSelector value={primaries} onChange={v=>{const arr=normPrimary(v);if(arr.length<=4){const sec=(meta.secondary||[]).filter(m=>!arr.includes(m));setExMeta(p=>({...p,[ex.name]:{...(p[ex.name]||{}),primary:arr,secondary:sec}}));}}} multi/><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",margin:"12px 0 8px"}}>Muscles secondaires <span style={{fontWeight:400,textTransform:"none"}}>(comptent 50% du volume)</span></div><MuscleSelector value={meta.secondary||[]} onChange={v=>{const arr=normPrimary(v).filter(m=>!primaries.includes(m));setExMeta({...exMeta,[ex.name]:{...meta,secondary:arr}});}} multi/></>}</div></div>)}
      </div>);
    })}
    <div style={{fontSize:10,color:C.tx3,textAlign:"center",padding:"12px 0"}}>{filt.length} exercice{filt.length>1?"s":""} dans la base</div>
  </div>);
}

function DataManager({exos,setExos,sets,setSets,sessions,setSessions,completedSessions,setCompletedSessions,athleteNotes,setAthleteNotes,blockHistory,setBlockHistory,exMeta,setExMeta,wellness,setWellness,wellnessHistory,setWellnessHistory,weightLog,setWeightLog,injuries,setInjuries,weeksArr}){
  const[confirm,setConfirm]=useState(null);
  const section=(title,desc,items)=>(<div style={{background:C.s1,borderRadius:14,padding:"12px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>{title}</div>
    {desc&&<div style={{fontSize:10,color:C.tx3,marginBottom:10}}>{desc}</div>}
    {items.length===0&&<div style={{fontSize:11,color:C.tx3,textAlign:"center",padding:"8px 0"}}>Aucune donnée</div>}
    {items.map(({label,detail,action,key})=>(
      <div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.brd}}>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600}}>{label}</div>{detail&&<div style={{fontSize:10,color:C.tx3}}>{detail}</div>}</div>
        {confirm===key?(<div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>setConfirm(null)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Non</button>
          <button onClick={()=>{action();setConfirm(null);}} style={{padding:"5px 10px",borderRadius:6,border:"none",background:C.r,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Confirmer</button>
        </div>):(<button onClick={()=>setConfirm(key)} style={{padding:"5px 12px",borderRadius:7,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Supprimer</button>)}
      </div>
    ))}
  </div>);

  const totalExos=Object.values(exos).flat().length;
  const totalSets=Object.keys(sets).length;
  const totalLogs=Object.values(sets).flat().filter(s=>s.done).length;
  const totalCompleted=Object.values(completedSessions).flat().length;

  return(<div>
    <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Gestion des données</div>
    <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Supprimer sélectivement des données</div>

    <div style={{background:C.s1,borderRadius:14,padding:"12px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Résumé</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {l:"Séances",v:sessions.length,c:C.coach},
          {l:"Exercices",v:totalExos,c:C.ac},
          {l:"Séries logguées",v:totalLogs,c:C.g},
          {l:"Blocs archivés",v:(blockHistory||[]).length,c:C.b},
        ].map(({l,v,c})=><div key={l} style={{background:C.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:9,color:C.tx3}}>{l}</div>
        </div>)}
      </div>
    </div>

    {section("Séances du bloc","Supprimer une séance et ses exercices",
      sessions.map((s,i)=>({key:"sess_"+s.id,label:s.name+" ("+s.short+")",detail:(exos[s.id]||[]).length+" exercices",
        action:()=>{setSessions(p=>p.filter((_,idx)=>idx!==i));setExos(p=>{const n={...p};delete n[s.id];return n;});}
      }))
    )}

    {section("Logs d'entraînement","Supprimer les données de séances réalisées",
      weeksArr.map(w=>({key:"logs_w"+w,label:"Semaine "+w,detail:(completedSessions[w]||[]).length+" séances validées",
        action:()=>{
          const newSets={...sets};Object.keys(newSets).forEach(k=>{if(k.endsWith("_"+w))delete newSets[k];});setSets(newSets);
          setCompletedSessions({...completedSessions,[w]:[]});
          const na={...athleteNotes};Object.keys(na).forEach(k=>{if(k.endsWith("_"+w))delete na[k];});setAthleteNotes(na);
        }
      }))
    )}

    {section("Historique des blocs","Supprimer des blocs archivés",
      (blockHistory||[]).map((b,i)=>({key:"block_"+i,label:b.blockConfig?.blockName||"Bloc "+(i+1),
        detail:new Date(b.archivedAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}),
        action:()=>setBlockHistory(blockHistory.filter((_,idx)=>idx!==i))
      }))
    )}

    {section("Nettoyage rapide","Effacer des données par catégorie",[
      {key:"all_logs",label:"Tous les logs du bloc",detail:totalLogs+" séries enregistrées + "+totalCompleted+" séances validées",
        action:()=>{setSets({});setCompletedSessions({});setAthleteNotes({});}},
      {key:"all_wellness",label:"Wellness & poids",detail:"Score du jour + historique poids",
        action:()=>{setWellness(null);setWellnessHistory({});setWeightLog({});}},
      {key:"all_injuries",label:"Toutes les blessures",detail:(injuries||[]).length+" blessure(s)",
        action:()=>setInjuries([])},
    ])}
  </div>);
}

function BlockHistoryViewer({blockHistory,onClose}){
  if(!blockHistory?.length)return(<div style={{padding:20,textAlign:"center"}}><div style={{fontSize:14,color:C.tx3,marginBottom:16}}>Aucun bloc archive</div><button onClick={onClose} style={{padding:"8px 20px",borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Fermer</button></div>);
  return(<div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:1}}>
      <div style={{fontSize:14,fontWeight:700}}>Historique des blocs</div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>×</button>
    </div>
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      {blockHistory.slice().reverse().map((block,i)=>{
        const prs=getAllPRs(block.exos||{});const totalDone=Object.values(block.completedSessions||{}).flat().length;
        const tw=block.blockConfig?.totalWeeks||6;const totalTarget=(block.goals?.sessionsPerWeek||6)*tw;
        const adherence=totalTarget?Math.round((totalDone/totalTarget)*100):0;
        const date=block.archivedAt?new Date(block.archivedAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
        const big3=getBig3(block.exos||{});
        return(<div key={block.id||i} style={{background:C.s1,borderRadius:14,padding:16,border:"1px solid "+C.brd}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>{block.blockConfig?.blockName||"Bloc "+(blockHistory.length-i)}</div>
              <div style={{fontSize:10,color:C.tx3}}>{date} · {tw} sem. · {totalDone}/{totalTarget} seances ({adherence}%)</div>
            </div>
            <div style={{padding:"4px 10px",borderRadius:8,background:adherence>=80?C.gS:adherence>=50?C.oS:C.rS,color:adherence>=80?C.g:adherence>=50?C.o:C.r,fontSize:11,fontWeight:700}}>{adherence}%</div>
          </div>
          {big3.length>0&&<div style={{display:"flex",gap:8,marginBottom:10}}>
            {big3.map(({name,label,c})=>{const pr=prs[name];return(<div key={label} style={{flex:1,background:C.s2,borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid "+c+"20"}}>
              <div style={{fontSize:9,color:C.tx3,marginBottom:2}}>{label}</div>
              <div style={{fontSize:16,fontWeight:800,color:c}}>{pr?.est||"--"}</div>
              <div style={{fontSize:8,color:C.tx3}}>kg est.</div>
            </div>);})}
          </div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {(block.sessions||[]).map(s=><span key={s.id} style={{padding:"3px 8px",borderRadius:6,background:C.s2,border:"1px solid "+C.brd,fontSize:10,color:C.tx2}}>{s.short||s.name}</span>)}
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function NewBlockModal({onStart,onClose,hasCurrentData,currentSessions}){
  const[step,setStep]=useState(0);
  const[blockName,setBlockName]=useState("");
  const[objective,setObjective]=useState("");
  const[totalWeeks,setTotalWeeks]=useState(6);
  const[sessPerWeek,setSessPerWeek]=useState(4);
  const[deloadWeek,setDeloadWeek]=useState(0);
  const[newSessions,setNewSessions]=useState([]);
  const[sessInput,setSessInput]=useState({name:"",short:""});
  const[keep,setKeep]=useState({exos:false,config:true,exMeta:true});
  const toggle=k=>setKeep(p=>({...p,[k]:!p[k]}));
  const addSess=()=>{if(!sessInput.name.trim())return;setNewSessions(p=>[...p,{id:"s_"+Date.now()+"_"+p.length,name:sessInput.name.trim(),short:sessInput.short.trim()||sessInput.name.trim().slice(0,3).toUpperCase()}]);setSessInput({name:"",short:""});};
  const removeSess=i=>setNewSessions(p=>p.filter((_,idx)=>idx!==i));
  const canFinish=blockName.trim();
  const finish=()=>{
    let finalSessions=newSessions;
    if(finalSessions.length===0){
      finalSessions=Array.from({length:sessPerWeek},(_,i)=>({id:"s_"+Date.now()+"_"+i,name:"Séance "+(i+1),short:"S"+(i+1)}));
    }
    onStart({...keep,blockName:blockName.trim(),objective:objective.trim(),totalWeeks,sessPerWeek,deloadWeek,sessions:finalSessions});
  };

  const rowCtrl=(label,val,onM,onP,fmt)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.brd}}>
    <span style={{fontSize:12,fontWeight:600}}>{label}</span>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <button onClick={onM} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>-</button>
      <span style={{fontSize:14,fontWeight:800,color:C.coach,minWidth:36,textAlign:"center"}}>{fmt?fmt(val):val}</span>
      <button onClick={onP} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>+</button>
    </div>
  </div>);

  return(<div style={{position:"fixed",inset:0,zIndex:250,background:C.bg,overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:1}}>
      <div style={{fontSize:14,fontWeight:700,color:C.coach}}>Nouveau bloc</div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>×</button>
    </div>
    <div style={{padding:16}}>
      {hasCurrentData&&step===0&&(<>
        <div style={{fontSize:11,color:C.tx2,marginBottom:12}}>Le bloc actuel sera archivé.</div>
        <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Que garder du bloc précédent ?</div>
        {[
          {k:"exos",l:"Exercices (prog)",desc:"Garder les exercices planifiés"},
          {k:"config",l:"Config (tiers, deload...)",desc:"Garder les réglages de surcharge"},
          {k:"exMeta",l:"Base Exos (muscles)",desc:"Garder les métadonnées exercices"},
        ].map(({k,l,desc})=>(<div key={k} onClick={()=>toggle(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:keep[k]?C.gS:"transparent",border:"1px solid "+(keep[k]?C.g+"50":C.brdL),marginBottom:6,cursor:"pointer"}}>
          <div style={{width:18,height:18,borderRadius:5,border:"2px solid "+(keep[k]?C.g:C.tx3),background:keep[k]?C.g:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,flexShrink:0}}>{keep[k]?"✓":""}</div>
          <div><div style={{fontSize:12,fontWeight:600,color:keep[k]?C.g:C.tx2}}>{l}</div><div style={{fontSize:10,color:C.tx3}}>{desc}</div></div>
        </div>))}
        <button onClick={()=>setStep(1)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:C.coach,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:10}}>Suivant</button>
      </>)}

      {(step===1||(!hasCurrentData))&&(<>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.coach,textTransform:"uppercase",marginBottom:8}}>Identité du bloc</div>
          <input value={blockName} onChange={e=>setBlockName(e.target.value)} placeholder="Nom du bloc (ex: Force S1, Hypertrophie...)" style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontWeight:600,fontFamily:"inherit",boxSizing:"border-box",marginBottom:8}}/>
          <input value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Objectif (ex: Augmenter bench +5kg, couper 2kg...)" style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.coach,textTransform:"uppercase",marginBottom:6}}>Structure</div>
          {rowCtrl("Semaines",totalWeeks,()=>setTotalWeeks(v=>Math.max(3,v-1)),()=>setTotalWeeks(v=>Math.min(16,v+1)),v=>v+" sem.")}
          {rowCtrl("Séances / semaine",sessPerWeek,()=>setSessPerWeek(v=>Math.max(1,v-1)),()=>setSessPerWeek(v=>Math.min(12,v+1)))}
          {rowCtrl("Deload",deloadWeek,()=>setDeloadWeek(v=>Math.max(0,v-1)),()=>setDeloadWeek(v=>Math.min(totalWeeks,v+1)),v=>v===0?"Aucune":"S"+v)}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:600,color:C.coach,textTransform:"uppercase"}}>Séances du bloc</div>
            <span style={{fontSize:10,color:C.tx3}}>{newSessions.length} séance{newSessions.length>1?"s":""}</span>
          </div>
          {newSessions.map((s,i)=>(<div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:C.s2,border:"1px solid "+C.brd,marginBottom:4}}>
            <span style={{fontSize:10,fontWeight:800,color:C.coach,width:24}}>{s.short}</span>
            <span style={{flex:1,fontSize:12,color:C.tx}}>{s.name}</span>
            <button onClick={()=>removeSess(i)} style={{background:"none",border:"none",color:C.r,fontSize:14,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>×</button>
          </div>))}
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <input value={sessInput.name} onChange={e=>setSessInput(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSess()} placeholder="Nom (ex: Upper A)" style={{flex:2,padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
            <input value={sessInput.short} onChange={e=>setSessInput(p=>({...p,short:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSess()} placeholder="Court" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit"}}/>
            <button onClick={addSess} style={{padding:"8px 14px",borderRadius:8,border:"none",background:C.g,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+</button>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {hasCurrentData&&<button onClick={()=>setStep(0)} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Retour</button>}
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button disabled={!canFinish} onClick={finish} style={{flex:2,padding:"10px 0",borderRadius:10,border:"none",background:canFinish?C.coach:C.s2,color:canFinish?"#fff":C.tx3,fontSize:12,fontWeight:700,cursor:canFinish?"pointer":"default",fontFamily:"inherit"}}>Créer le bloc</button>
        </div>
      </>)}
    </div>
  </div>);
}

function CoachConfig({goals,setGoals,bodyWeight,setBodyWeight,completedSessions,uncompleteSession,sessions,blockConfig,setBlockConfig,weeksArr,onNewBlock,onShowHistory,blockHistoryCount}){
  const tw=blockConfig?.totalWeeks||6;
  const totalTarget=goals.sessionsPerWeek*tw;
  const row=(label,desc,val,onM,onP,fmt)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid "+C.brd}}><div><div style={{fontSize:13,fontWeight:600}}>{label}</div><div style={{fontSize:10,color:C.tx3}}>{desc}</div></div><div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={onM} style={{width:30,height:30,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>-</button><span style={{fontSize:16,fontWeight:800,color:C.coach,minWidth:44,textAlign:"center"}}>{fmt?fmt(val):val}</span><button onClick={onP} style={{width:30,height:30,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>+</button></div></div>);
  return(<div>
    <div style={{background:C.s1,borderRadius:14,padding:"4px 16px",border:"1px solid "+C.b+"30",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.b,textTransform:"uppercase",letterSpacing:"0.5px",padding:"12px 0 4px"}}>Bloc d entrainement</div>
      <div style={{padding:"8px 0 4px",borderBottom:"1px solid "+C.brd}}>
        <div style={{fontSize:10,color:C.tx3,marginBottom:4}}>Nom du bloc</div>
        <input value={blockConfig?.blockName||""} onChange={e=>setBlockConfig(c=>({...c,blockName:e.target.value}))} placeholder="Ex: Prepa competition, Hypertrophie S1..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontWeight:600,fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
      {row("Nb semaines","Duree du bloc",tw,()=>setBlockConfig(c=>({...c,totalWeeks:Math.max(3,c.totalWeeks-1)})),()=>setBlockConfig(c=>({...c,totalWeeks:Math.min(16,c.totalWeeks+1)})),v=>v+" sem.")}
      {row("Semaine deload","0 = pas de deload",blockConfig?.deloadWeek||0,()=>setBlockConfig(c=>({...c,deloadWeek:Math.max(0,(c.deloadWeek||0)-1)})),()=>setBlockConfig(c=>({...c,deloadWeek:Math.min(tw,(c.deloadWeek||0)+1)})),v=>v===0?"Aucune":"S"+v)}
      <div style={{padding:"10px 0"}}><div style={{fontSize:10,color:C.tx3,lineHeight:1.5}}>La semaine deload reduit charges et volume pour la recuperation.</div></div>
    </div>
    {/* Tier config */}
    <div style={{background:C.s1,borderRadius:14,padding:"4px 16px",border:"1px solid "+C.o+"30",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.o,textTransform:"uppercase",letterSpacing:"0.5px",padding:"12px 0 8px"}}>Surcharge progressive (3 categories)</div>
      {[1,2,3].map(t=>{const tc=(blockConfig?.tierConfig||DEF_TIER_CONFIG)[t];const updTier=(f,v)=>setBlockConfig(c=>{const tc2={...(c.tierConfig||DEF_TIER_CONFIG)};tc2[t]={...tc2[t],[f]:v};return{...c,tierConfig:tc2};});
        return(<div key={t} style={{marginBottom:12,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+tc.c+"30"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:800,color:tc.c}}>T{t}</span><span style={{fontSize:12,fontWeight:700,color:tc.c}}>{tc.label}</span><span style={{fontSize:10,color:C.tx3}}>{tc.desc}</span></div>
          <div style={{fontSize:9,color:C.tx3,marginBottom:6}}>Strategie : {tc.mode==="rir"?"+"+( tc.kgStep??2.5)+"kg/sem, RIR "+tc.rirStart+"→"+tc.rirEnd:tc.mode==="reps"?"Reps "+tc.repsStart+"→"+tc.repsEnd+" puis +"+( tc.kgStep??2.5)+"kg":"Reps "+tc.repsStart+"→"+tc.repsEnd+" à l'échec puis +"+( tc.kgStep??1.25)+"kg"}</div>
          {tc.mode==="rir"&&(<div>
            {row("RIR depart","",tc.rirStart,()=>updTier("rirStart",Math.max(1,tc.rirStart-0.5)),()=>updTier("rirStart",Math.min(5,tc.rirStart+0.5)))}
            {row("RIR fin","",tc.rirEnd,()=>updTier("rirEnd",Math.max(0,tc.rirEnd-0.5)),()=>updTier("rirEnd",Math.min(tc.rirStart-0.5,tc.rirEnd+0.5)))}
            {row("kg/semaine","incrément fixe",tc.kgStep??2.5,()=>updTier("kgStep",Math.max(0.5,(tc.kgStep??2.5)-0.5)),()=>updTier("kgStep",Math.min(20,(tc.kgStep??2.5)+0.5)),v=>"+"+v+"kg")}
          </div>)}
          {tc.mode==="reps"&&(<div>
            {row("Reps debut","",tc.repsStart,()=>updTier("repsStart",Math.max(6,tc.repsStart-1)),()=>updTier("repsStart",Math.min(tc.repsEnd-1,tc.repsStart+1)))}
            {row("Reps fin","",tc.repsEnd,()=>updTier("repsEnd",Math.max(tc.repsStart+1,tc.repsEnd-1)),()=>updTier("repsEnd",Math.min(20,tc.repsEnd+1)))}
            {row("kg/cycle","incrément au reset",tc.kgStep??2.5,()=>updTier("kgStep",Math.max(0.5,(tc.kgStep??2.5)-0.5)),()=>updTier("kgStep",Math.min(20,(tc.kgStep??2.5)+0.5)),v=>"+"+v+"kg")}
          </div>)}
          {tc.mode==="failure"&&(<div>
            {row("Reps debut","",tc.repsStart,()=>updTier("repsStart",Math.max(8,tc.repsStart-1)),()=>updTier("repsStart",Math.min(tc.repsEnd-1,tc.repsStart+1)))}
            {row("Reps max","",tc.repsEnd,()=>updTier("repsEnd",Math.max(tc.repsStart+1,tc.repsEnd-1)),()=>updTier("repsEnd",Math.min(25,tc.repsEnd+1)))}
            {row("kg/cycle","incrément au reset",tc.kgStep??1.25,()=>updTier("kgStep",Math.max(0.25,(tc.kgStep??1.25)-0.25)),()=>updTier("kgStep",Math.min(10,(tc.kgStep??1.25)+0.25)),v=>"+"+v+"kg")}
          </div>)}
          {(blockConfig?.deloadWeek||0)>0&&<div style={{marginTop:6}}>{row("Deload","% reduction",tc.deloadPct,()=>updTier("deloadPct",Math.max(10,tc.deloadPct-5)),()=>updTier("deloadPct",Math.min(60,tc.deloadPct+5)),v=>"-"+v+"%")}</div>}
        </div>);
      })}
    </div>
    <div style={{background:C.s1,borderRadius:14,padding:"4px 16px",border:"1px solid "+C.brd,marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",padding:"12px 0 4px"}}>Programme</div>
      {row("Seances / semaine","Nb a valider",goals.sessionsPerWeek,()=>setGoals(g=>({...g,sessionsPerWeek:Math.max(1,g.sessionsPerWeek-1)})),()=>setGoals(g=>({...g,sessionsPerWeek:Math.min(12,g.sessionsPerWeek+1)})))}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid "+C.brd}}><div><div style={{fontSize:13,fontWeight:600}}>Objectif total</div><div style={{fontSize:10,color:C.tx3}}>Auto ({goals.sessionsPerWeek} x {tw} sem.)</div></div><div style={{fontSize:16,fontWeight:800,color:C.tx2}}>{totalTarget}</div></div>
    </div>
    <div style={{background:C.s1,borderRadius:14,padding:"4px 16px",border:"1px solid "+C.brd,marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",padding:"12px 0 4px"}}>Sommeil</div>
      {row("Objectif sommeil","Heures par nuit",goals.sleepTarget||8,()=>setGoals(g=>({...g,sleepTarget:Math.max(5,+((g.sleepTarget||8)-0.5).toFixed(1))})),()=>setGoals(g=>({...g,sleepTarget:Math.min(12,+((g.sleepTarget||8)+0.5).toFixed(1))})),v=>v+"h")}
    </div>
    <div style={{background:C.s1,borderRadius:14,padding:"4px 16px",border:"1px solid "+C.brd,marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",padding:"12px 0 4px"}}>Poids de corps</div>
      {row("Poids actuel","kg",bodyWeight.current,()=>setBodyWeight(b=>({...b,current:Math.max(40,+(b.current-0.5).toFixed(1))})),()=>setBodyWeight(b=>({...b,current:+(b.current+0.5).toFixed(1)})),v=>v+" kg")}
      {row("Objectif","kg",bodyWeight.target,()=>setBodyWeight(b=>({...b,target:Math.max(40,+(b.target-0.5).toFixed(1))})),()=>setBodyWeight(b=>({...b,target:+(b.target+0.5).toFixed(1)})),v=>v+" kg")}
    </div>
    <div style={{background:C.s1,borderRadius:14,padding:"12px 16px",border:"1px solid "+C.brd}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Annuler seances</div>
      {weeksArr.map(w=>{const done=completedSessions[w]||[];if(!done.length)return null;return(<div key={w} style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.tx2,marginBottom:6}}>S{w}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{done.map(sid=>{const s=sessions.find(x=>x.id===sid);return(<button key={sid} onClick={()=>uncompleteSession(sid,w)} style={{padding:"5px 10px",borderRadius:8,border:"1px solid "+C.r+"40",background:C.rS+"80",color:C.r,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s?.short||sid} x</button>);})}</div></div>);})}
      {Object.values(completedSessions).every(a=>!a?.length)&&<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"8px 0"}}>Aucune seance validee</div>}
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}>
      <button onClick={onNewBlock} style={{flex:2,padding:"12px 0",borderRadius:12,border:"none",background:C.coach,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button>
      <button onClick={onShowHistory} style={{flex:1,padding:"12px 0",borderRadius:12,border:"1px solid "+C.brdL,background:C.s1,color:C.tx2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>Historique{blockHistoryCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.ac,color:"#fff",fontSize:9,fontWeight:800,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{blockHistoryCount}</span>}</button>
    </div>
  </div>);
}

function PRsView({prs,exos,tw}){
  const[selEx,setSelEx]=useState(null);
  const allExNames=Object.keys(prs).sort((a,b)=>prs[b].est-prs[a].est);

  // Build weekly 1RM data for selected exercise
  const getWeeklyData=(name)=>{
    const byWeek={};
    Object.values(exos).flat().filter(e=>e.name===name).forEach(ex=>{
      Object.entries(ex.weeks||{}).forEach(([wk,w])=>{
        if(!w?.kg)return;const est=e1rm(w.kg,parseReps(w.repsRange)||1);
        if(!byWeek[wk]||est>byWeek[wk])byWeek[wk]=est;
      });
    });
    return Array.from({length:tw||6},(_,i)=>i+1).map(w=>({week:w,val:byWeek[w]||null}));
  };

  const selData=selEx?getWeeklyData(selEx):null;
  const selFilled=selData?.filter(d=>d.val!=null)||[];
  const selMin=selFilled.length?Math.min(...selFilled.map(d=>d.val)):0;
  const selMax=selFilled.length?Math.max(...selFilled.map(d=>d.val)):0;
  const selProg=selFilled.length>=2?selFilled[selFilled.length-1].val-selFilled[0].val:null;

  // Top 3 progressors
  const progressors=allExNames.map(name=>{
    const data=getWeeklyData(name);const filled=data.filter(d=>d.val!=null);
    const prog=filled.length>=2?filled[filled.length-1].val-filled[0].val:0;
    return{name,prog,current:filled.length?filled[filled.length-1].val:0};
  }).filter(p=>p.prog>0).sort((a,b)=>b.prog-a.prog).slice(0,3);

  return(<div style={{padding:"16px 16px 40px"}}>
    <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Personal Records</div>
    <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>1RM estimes (Epley)</div>

    {/* Top progressions banner */}
    {progressors.length>0&&(<div style={{background:C.gS,borderRadius:14,padding:"12px 14px",border:"1px solid "+C.g+"30",marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:600,color:C.g,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Meilleures progressions</div>
      <div style={{display:"flex",gap:8}}>{progressors.map((p,i)=><div key={p.name} onClick={()=>setSelEx(p.name)} style={{flex:1,background:C.s1,borderRadius:10,padding:"8px 6px",textAlign:"center",cursor:"pointer",border:"1px solid "+(selEx===p.name?C.g:C.brd)}}>
        <div style={{fontSize:9,color:C.tx3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.length>12?p.name.slice(0,12)+"…":p.name}</div>
        <div style={{fontSize:16,fontWeight:800,color:C.g,lineHeight:1.2}}>+{p.prog}</div>
        <div style={{fontSize:8,color:C.tx3}}>kg</div>
      </div>)}</div>
    </div>)}

    {/* Selected exercise evolution */}
    {selEx&&selData&&(<div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.ac+"30",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div><div style={{fontSize:13,fontWeight:700}}>{selEx}</div><div style={{fontSize:10,color:C.tx3}}>Evolution 1RM estime</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {selProg!=null&&<span style={{fontSize:16,fontWeight:800,color:selProg>0?C.g:selProg<0?C.r:C.tx3}}>{selProg>0?"+":""}{selProg} kg</span>}
          <button onClick={()=>setSelEx(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>×</button>
        </div>
      </div>
      {/* Bar chart */}
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,padding:"0 4px"}}>
        {selData.map(d=>{const h=d.val!=null&&selMax>selMin?Math.max(12,((d.val-selMin*0.9)/(selMax-selMin*0.9+0.01))*90):d.val!=null?50:6;
          return(<div key={d.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{fontSize:8,fontWeight:700,color:d.val!=null?C.ac:C.tx3}}>{d.val!=null?d.val:""}</div>
            <div style={{width:"100%",height:h,borderRadius:4,background:d.val!=null?C.ac+"60":C.s2,transition:"height 0.3s"}}/>
            <div style={{fontSize:8,color:C.tx3}}>S{d.week}</div>
          </div>);
        })}
      </div>
    </div>)}

    {/* PR list by tier */}
    {[{tier:1,c:C.o,bg:C.oS,label:"Fondamentaux",desc:"Compound lourd"},{tier:2,c:C.ac,bg:C.acS,label:"Composes secondaires",desc:"Force appliquee"},{tier:3,c:C.g,bg:C.gS,label:"Isolation",desc:"Hypertrophie ciblee"}].map(({tier,c,bg,label,desc})=>{
      const tp=Object.entries(prs).filter(([n])=>(EX_TIER[n]||3)===tier).sort((a,b)=>b[1].est-a[1].est);if(!tp.length)return null;
      return(<div key={tier} style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 12px",borderRadius:10,background:bg,border:"1px solid "+c+"30"}}><div style={{width:30,height:30,borderRadius:8,background:c+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:c}}>T{tier}</div><div><div style={{fontSize:12,fontWeight:700,color:c}}>{label}</div><div style={{fontSize:10,color:C.tx2}}>{desc}</div></div></div>
        {tp.map(([name,pr],i)=>{
          const weekData=getWeeklyData(name);const filled=weekData.filter(d=>d.val!=null);const prog=filled.length>=2?filled[filled.length-1].val-filled[0].val:null;
          return(<div key={name} onClick={()=>setSelEx(selEx===name?null:name)} style={{background:selEx===name?c+"08":C.s1,borderRadius:tier===1?14:10,padding:tier===1?"13px 16px":"10px 14px",marginBottom:6,border:"1px solid "+(selEx===name?c+"50":i===0&&tier===1?c+"50":C.brd),cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:tier===1?36:28,height:tier===1?36:28,borderRadius:tier===1?10:7,background:i===0?bg:C.s2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:tier===1?13:11,fontWeight:700,color:i===0?c:C.tx3}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:tier===1?14:13,fontWeight:600}}>{name}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2}}>
                <span style={{fontSize:10,color:C.tx2}}>{pr.kg}kg x {pr.reps} - S{pr.week}</span>
                {prog!=null&&prog!==0&&<span style={{fontSize:10,fontWeight:700,color:prog>0?C.g:C.r,padding:"1px 5px",borderRadius:4,background:prog>0?C.gS:C.rS}}>{prog>0?"+":""}{prog}</span>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:tier===1?24:18,fontWeight:800,color:i===0?c:C.tx,letterSpacing:"-0.5px",lineHeight:1}}>{pr.est}</div>
              <div style={{fontSize:9,color:C.tx3,marginTop:2}}>kg est.</div>
            </div>
          </div>);
        })}
      </div>);
    })}
  </div>);
}

function InjuriesView({injuries,addInjury,updateInjury,deleteInjury}){
  const[showForm,setShowForm]=useState(false);const[editing,setEditing]=useState(null);
  const active=injuries.filter(i=>i.status!=="Guerie");const healed=injuries.filter(i=>i.status==="Guerie");
  const Card=({inj})=>{const sc=stC(inj.status);const zoneNames=ALL_BZ.filter(z=>inj.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee";const intC=inj.intensity<=3?C.g:inj.intensity<=6?C.o:C.r;
    return(<div style={{background:C.s1,borderRadius:12,padding:"12px 14px",marginBottom:8,border:"1px solid "+sc+"30"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
        <div style={{flex:1}}><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:4}}><span style={{fontSize:12,fontWeight:700,color:C.tx}}>{zoneNames}</span>{inj.type&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:C.s2,color:C.tx3}}>{inj.type}</span>}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:6,background:sc+"20"}}>{inj.status}</span><span style={{fontSize:10,color:C.tx3}}>{inj.date?inj.date.slice(6)+"/"+inj.date.slice(4,6)+"/"+inj.date.slice(0,4):""}</span></div></div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}><div style={{textAlign:"center"}}><span style={{fontSize:18,fontWeight:800,color:intC}}>{inj.intensity}</span><span style={{fontSize:9,color:C.tx3}}>/10</span></div><button onClick={()=>{setEditing(inj);setShowForm(true);}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Edit</button><button onClick={()=>deleteInjury(inj.id)} style={{width:22,height:22,borderRadius:5,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button></div>
      </div>
      {inj.notes&&<div style={{fontSize:11,color:C.tx3,fontStyle:"italic",lineHeight:1.5}}>{inj.notes}</div>}
      <div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>
        {INJ_STATUS.filter(s=>s!==inj.status).map(s=>{const sc2=stC(s);return(<button key={s} onClick={()=>updateInjury({...inj,status:s})} style={{fontSize:9,padding:"3px 8px",borderRadius:5,border:"1px solid "+sc2+"40",background:"transparent",color:sc2,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>);})}
      </div>
    </div>);
  };
  return(<div>
    <button onClick={()=>{setEditing(null);setShowForm(true);}} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"1.5px solid "+C.r+"50",background:C.rS,color:C.r,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>+ Nouvelle blessure / douleur</button>
    {showForm&&<div style={{marginBottom:16}}><InjuryForm onSave={inj=>{editing?updateInjury(inj):addInjury(inj);setShowForm(false);setEditing(null);}} onCancel={()=>{setShowForm(false);setEditing(null);}} existing={editing}/></div>}
    {active.length>0&&(<div><div style={{fontSize:11,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{active.length} active(s)</div>{active.map(i=><Card key={i.id} inj={i}/>)}</div>)}
    {healed.length>0&&(<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:600,color:C.g,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{healed.length} guerie(s)</div>{healed.map(i=><Card key={i.id} inj={i}/>)}</div>)}
    {injuries.length===0&&!showForm&&<div style={{textAlign:"center",color:C.tx3,fontSize:12,padding:"20px 0"}}>Aucune blessure enregistree</div>}
  </div>);
}

function LogView({exos,sets,updSets,completedSessions,completeSession,uncompleteSession,goals,currentWeek,allMethods,athleteNotes,setAthleteNotes,sessions,blockConfig,initialSess=null,timerLeft,timerDur,timerActive,timerFinished,onTimerSetDur,onTimerStart,onTimerStop}){
  const tw=blockConfig?.totalWeeks||6;const dw=blockConfig?.deloadWeek||0;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const[step,setStep]=useState(initialSess?1:0);const[wk,setWk]=useState(currentWeek);
  const[selectedSess,setSelectedSess]=useState(initialSess||null);const[openEx,setOpenEx]=useState(null);
  useEffect(()=>{if(step===0)setWk(currentWeek);},[currentWeek,step]);
  const sid=selectedSess?.id||null;const exercises=sid?exos[sid]||[]:[];
  const sessIsDone=(completedSessions[wk]||[]).includes(sid);
  const allSetsDone=useMemo(()=>{if(!sid||!exercises.length)return false;return exercises.every(ex=>{const s=sets[ex.id+"_"+wk];return s?.length>0&&s.every(x=>x.done);});},[exercises,sets,wk,sid]);
  useEffect(()=>{if(allSetsDone&&sid&&step===1&&!sessIsDone)completeSession(sid,wk);},[allSetsDone,sid,wk,step,sessIsDone]);
  const exosMap=useMemo(()=>exercises.reduce((a,e)=>({...a,[e.id]:e.name}),{}),[exercises]);

  const crumb=(<div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px 0",fontSize:11,color:C.tx3,flexWrap:"wrap"}}>
    <button onClick={()=>{setStep(0);setSelectedSess(null);}} style={{background:"none",border:"none",color:step>0?C.tx2:C.ac,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0,fontWeight:step===0?700:400}}>Seances</button>
    {step>=1&&selectedSess&&<><span>&gt;</span><span style={{color:C.ac,fontWeight:700}}>{selectedSess.name}</span></>}
  </div>);

  if(step===0){
    const weekDone=(completedSessions[wk]||[]).length;const weekTotal=goals.sessionsPerWeek;const weekPct=Math.min(Math.round((weekDone/weekTotal)*100),100);
    return(<div style={{padding:"0 0 40px"}}><div style={{padding:"16px 16px 0"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.5px"}}>Semaine {wk}</div>
      <div style={{fontSize:12,fontWeight:700,color:weekPct>=100?C.g:C.ac,padding:"4px 10px",borderRadius:8,background:weekPct>=100?C.gS:C.acS}}>{weekDone}/{weekTotal} seances</div>
    </div>
    <div style={{height:4,background:C.s2,borderRadius:3,overflow:"hidden",marginBottom:16}}><div style={{height:"100%",width:weekPct+"%",background:weekPct>=100?C.g:C.ac,borderRadius:3,transition:"width 0.4s"}}/></div>
    <div style={{display:"flex",gap:4,marginBottom:18,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>{weeksArr.map(w=>{const wd=(completedSessions[w]||[]).length,total=goals.sessionsPerWeek,complete=wd>=total,isCur=w===currentWeek,isDL=w===dw,sel=w===wk;return(<button key={w} onClick={()=>setWk(w)} style={{flexShrink:0,width:42,padding:"8px 0",borderRadius:10,border:sel?"2px solid "+(isDL?C.b:complete?C.g:C.ac):"1px solid "+(complete?C.g+"30":C.brd),background:sel?(isDL?C.bS:complete?C.gS:C.acS):(complete?C.g+"08":"transparent"),cursor:"pointer",fontFamily:"inherit",textAlign:"center",position:"relative",transition:"all 0.2s"}}>{isDL&&<span style={{position:"absolute",top:-5,right:-2,fontSize:6,background:C.b,color:"#fff",padding:"1px 3px",borderRadius:3,fontWeight:700}}>DL</span>}{isCur&&!sel&&<div style={{position:"absolute",top:-2,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:C.ac}}/>}<div style={{fontSize:10,fontWeight:sel?800:600,color:sel?(isDL?C.b:complete?C.g:C.ac):(complete?C.g:C.tx3)}}>S{w}</div>{complete&&<div style={{fontSize:8,color:C.g,marginTop:1}}>✓</div>}</button>);})}</div>
    {dw>0&&wk===dw&&<div style={{padding:"10px 14px",borderRadius:10,background:C.bS,border:"1px solid "+C.b+"40",marginBottom:14,fontSize:12,color:C.b,fontWeight:600,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>~</span> Deload - Recuperation active</div>}
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>{sessions.map(s=>{const done=(completedSessions[wk]||[]).includes(s.id);const sessExos=exos[s.id]||[];const hasExos=sessExos.length>0;const exosDone=sessExos.filter(ex=>{const sk=ex.id+"_"+wk;const rows=sets[sk]||[];return rows.length>0&&rows.every(r=>r.done);}).length;const muscles=[...new Set(sessExos.map(e=>e.target))];
      return(<button key={s.id} onClick={()=>{if(!done&&hasExos){setSelectedSess(s);setStep(1);setOpenEx(null);}}} style={{width:"100%",padding:0,borderRadius:14,border:"1.5px solid "+(done?C.g+"40":C.brd),background:C.s1,cursor:done||!hasExos?"default":"pointer",fontFamily:"inherit",textAlign:"center",display:"block",opacity:hasExos?1:0.35,overflow:"hidden",position:"relative",transition:"all 0.2s",boxSizing:"border-box"}}>
        {done&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:C.g,borderRadius:"14px 14px 0 0"}}/>}
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
          <div style={{width:48,height:48,borderRadius:12,background:done?C.gS:C.acS,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1.5px solid "+(done?C.g+"40":C.ac+"30")}}>
            {done?<span style={{fontSize:20,color:C.g,fontWeight:700}}>✓</span>:<span style={{fontSize:13,fontWeight:800,color:C.ac,letterSpacing:"-0.3px"}}>{s.short}</span>}
          </div>
          <div style={{width:"100%",overflow:"hidden"}}>
            <div style={{fontSize:15,fontWeight:800,color:done?C.g:C.tx,letterSpacing:"-0.3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
            {!done&&hasExos&&<div style={{fontSize:10,color:C.tx2,fontWeight:600,marginTop:2}}>{sessExos.length} exercices</div>}
            {hasExos&&<div style={{display:"flex",gap:3,marginTop:6,flexWrap:"wrap",justifyContent:"center"}}>{muscles.slice(0,4).map(m=>{const mc=getMC(m);return(<span key={m} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:mc+"18",color:mc,fontWeight:600}}>{mL(m)}</span>);})}</div>}
            {!done&&hasExos&&exosDone>0&&<div style={{marginTop:6}}><div style={{height:3,background:C.s2,borderRadius:2,overflow:"hidden",width:"100%"}}><div style={{height:"100%",width:Math.round((exosDone/sessExos.length)*100)+"%",background:C.ac,borderRadius:2}}/></div><div style={{fontSize:9,color:C.tx3,marginTop:2}}>{exosDone}/{sessExos.length} faits</div></div>}
          </div>
        </div>
        {done&&<div style={{position:"absolute",top:8,right:8}}><button onClick={e=>{e.stopPropagation();uncompleteSession(s.id,wk);}} style={{width:20,height:20,borderRadius:5,border:"1px solid "+C.r+"50",background:C.rS,color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button></div>}
      </button>);})}</div>
    {(()=>{const next=sessions.find(s=>!(completedSessions[wk]||[]).includes(s.id)&&(exos[s.id]||[]).length>0);if(!next)return weekPct>=100?<div style={{padding:"14px",borderRadius:14,background:C.gS,border:"1px solid "+C.g+"40",color:C.g,fontSize:13,fontWeight:700,textAlign:"center"}}>Semaine {wk} complete !</div>:null;return(<button onClick={()=>{setSelectedSess(next);setStep(1);}} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-0.3px"}}>Commencer {next.short} - {next.name} ›</button>);})()}
  </div></div>);}

  if(step===1&&sid){let lb=null;return(<div style={{padding:"0 0 40px"}}>{crumb}<div style={{padding:"12px 16px 0"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"14px 16px",borderRadius:14,background:C.s1,border:"1px solid "+C.ac+"25"}}><div style={{flex:1}}><div style={{fontSize:17,fontWeight:800}}>{selectedSess.name}</div><div style={{fontSize:11,color:C.tx3,marginTop:2}}>{exercises.length} exo - S{wk}</div></div>{sessIsDone&&<div style={{padding:"4px 10px",borderRadius:8,background:C.gS,color:C.g,fontSize:11,fontWeight:700}}>OK</div>}</div>
    {wk===dw&&<div style={{padding:"8px 14px",borderRadius:8,background:C.bS,border:"1px solid "+C.b+"40",marginBottom:10,fontSize:11,color:C.b,fontWeight:600}}>Semaine deload</div>}
    <div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}}>{weeksArr.map(w=><button key={w} onClick={()=>setWk(w)} style={{flex:1,minWidth:36,padding:"9px 0",borderRadius:7,border:w===wk?"2px solid "+C.ac:"1px solid "+(w===dw?C.b+"60":C.brd),background:w===wk?C.acS:(w===dw?C.bS:"transparent"),color:w===wk?C.ac:(w===dw?C.b:C.tx3),fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>{w===dw&&<span style={{position:"absolute",top:-6,right:-2,fontSize:7,background:C.b,color:"#fff",padding:"1px 4px",borderRadius:4,fontWeight:700}}>DL</span>}S{w}</button>)}</div>
    <div style={{marginBottom:14,background:C.s1,borderRadius:12,padding:"10px 12px",border:"1px solid "+C.brd}}><div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Timer repos</div><RestTimer timerLeft={timerLeft} timerDur={timerDur} timerActive={timerActive} timerFinished={timerFinished} onSetDur={onTimerSetDur} onStart={onTimerStart} onStop={onTimerStop}/></div>
    {exercises.map(ex=>{const wd=ex.weeks[wk];const showH=ex.bloc!==lb;lb=ex.bloc;const bt=BT[ex.bloc]||{c:C.tx3,l:ex.bloc};const isOpen=openEx===ex.id;const sk=ex.id+"_"+wk;const rows=sets[sk]||[];const done=rows.filter(r=>r.done).length;const total=rows.length||wd?.sets||0;const allDone=total>0&&done===total;const method=wd?.method;const mp=wd?.methodParams;const mInfo=allMethods[method];const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isFlex=eType!=="muscu"&&eType!=="halterophilie";
      return(<div key={ex.id}>
        {showH&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 8px",padding:"7px 12px",borderRadius:8,background:bt.c+"18",border:"1px solid "+bt.c+"35"}}><div style={{width:4,height:16,borderRadius:2,background:bt.c,flexShrink:0}}/><span style={{fontSize:10,fontWeight:700,color:bt.c,textTransform:"uppercase",letterSpacing:"0.8px"}}>{bt.l}</span></div>}
        <div style={{background:C.s1,borderRadius:12,marginBottom:6,border:"1px solid "+(allDone?C.g+"50":C.brd),overflow:"hidden"}}>
          <div onClick={()=>setOpenEx(isOpen?null:ex.id)} style={{display:"flex",alignItems:"center",padding:"12px 14px",cursor:"pointer",gap:10}}>
            <div style={{width:3,height:32,borderRadius:2,background:allDone?C.g:bt.c,flexShrink:0}}/>
            <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:600}}>{ex.name}</span>{allDone&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:C.gS,color:C.g}}>OK</span>}{isFlex&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.b+"20",color:C.b,fontWeight:600}}>Souplesse</span>}{mInfo&&!isFlex&&<span style={{padding:"3px 8px",borderRadius:6,border:"1px solid "+mInfo.c+"60",background:mInfo.c+"22",color:mInfo.c,fontSize:10,fontWeight:700}}>{mInfo.e} {mInfo.label}</span>}</div>{wd?(!isFlex?<div style={{fontSize:11,color:C.tx2,marginTop:3}}>{wd.pdc?"PDC":wd.kg+"kg"} - {wd.sets}x{wd.repsRange||"?"}{wd.tempo?" - "+wd.tempo:""} - <span style={{color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</span></div>:<div style={{fontSize:11,color:C.tx2,marginTop:3}}>{wd.sets}x{wd.repsRange||"?"}{wd.tempo?" tempo "+wd.tempo:""}</div>):<div style={{fontSize:11,color:C.tx3,marginTop:3,fontStyle:"italic"}}>Non programme S{wk}</div>}{wd?.coachNote&&<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:C.coachS,border:"1px solid "+C.coach+"30",fontSize:11,color:C.coach,lineHeight:1.5}}>{wd.coachNote}</div>}{!isFlex&&method&&mp&&mInfo&&<div style={{fontSize:10,color:mInfo.c,marginTop:4}}>{method==="dropset"&&(mp.drops||2)+" drops -"+(mp.pct||20)+"%"}{method==="myoreps"&&(mp.activation||12)+" + "+(mp.minisets||4)+"x"+(mp.reps_mini||5)}{method==="restpause"&&(mp.rounds||3)+" rounds"}{method==="amrap"&&(mp.type==="timed"?mp.duration+"s":"A l echec")}{method==="excentrique"&&"Neg: "+(mp.eccentric_sec||4)+"s"}{method==="isometrique"&&(mp.positions||2)+"x"+(mp.hold_sec||30)+"s"}</div>}</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>{rows.length>0&&<span style={{fontSize:12,fontWeight:700,color:allDone?C.g:C.tx2,fontFamily:"monospace"}}>{done}/{total}</span>}<span style={{fontSize:11,color:C.tx3}}>{isOpen?"^":"v"}</span></div>
          </div>
          {isOpen&&(<div style={{padding:"0 14px 14px",borderTop:"1px solid "+C.brd}}>{wd?(<>{!isFlex&&<div style={{display:"grid",gridTemplateColumns:wd.pdc?"1fr":"1fr 1fr",gap:6,paddingTop:12,marginBottom:14}}>{!wd.pdc&&<div style={{background:C.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>1RM estime</div><div style={{fontSize:18,fontWeight:800,color:C.ac}}>{e1rm(wd.kg,parseReps(wd.repsRange)||1)} kg</div></div>}<div style={{background:C.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>RIR cible</div><div style={{fontSize:18,fontWeight:800,color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</div></div></div>}<SmartSetEditor planned={wd} storeKey={sk} sessionSets={sets} updateSets={updSets} athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes} method={isFlex?null:method} methodParams={isFlex?null:mp} allMethods={allMethods} exosMap={exosMap}/></>):<div style={{padding:"14px 0",fontSize:12,color:C.tx3,textAlign:"center"}}>Pas de prescription S{wk}</div>}</div>)}
        </div>
      </div>);
    })}
    {!sessIsDone&&<button onClick={()=>completeSession(sid,wk)} style={{width:"100%",marginTop:16,padding:"15px 0",borderRadius:14,border:"none",background:C.g,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Terminer la seance</button>}
    {sessIsDone&&<div style={{marginTop:16}}><div style={{padding:"14px 0",borderRadius:14,background:C.gS,border:"1px solid "+C.g+"40",color:C.g,fontSize:14,fontWeight:700,textAlign:"center",marginBottom:8}}>Seance validee !</div><button onClick={()=>uncompleteSession(sid,wk)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler la validation</button></div>}
  </div></div>);}
  return null;
}

function MuscleVolumeCard({exos,exMeta,sets,sessions,weeksArr,tw}){
  const wks=weeksArr||Array.from({length:tw||6},(_,i)=>i+1);
  const[wk,setWk]=useState(wks[0]);
  const[showSubs,setShowSubs]=useState(false);
  const[panel,setPanel]=useState(null);
  const muscleData=useMemo(()=>{
    const m={};
    Object.entries(exos).forEach(([sid,exList])=>{
      const sess=sessions.find(s=>s.id===sid);
      (exList||[]).filter(ex=>{const et=ex.exType||(ex.isFlexibility?"mobilite":"muscu");return (et==="muscu"||et==="halterophilie")&&ex.weeks?.[wk]?.sets;}).forEach(ex=>{
        const meta=exMeta[ex.name]||exMeta[normalizeExName(ex.name)]||{};
        const prim=normPrimary(meta.primary||ex.target);
        const sec=meta.secondary||[];
        const pl=ex.weeks[wk]?.sets||0;
        const done=(sets[ex.id+"_"+wk]||[]).filter(r=>r.done).length;
        const add=(mid,factor)=>{
          if(!m[mid])m[mid]={pl:0,done:0,exs:[]};
          m[mid].pl+=pl*factor;m[mid].done+=done*factor;
          if(!m[mid].exs.find(e=>e.name===ex.name&&e.sid===sid))m[mid].exs.push({name:ex.name,sid,sessName:sess?.name||sess?.short||"",pl,done,factor,reps:ex.weeks[wk]?.repsRange,kg:ex.weeks[wk]?.kg});
        };
        prim.forEach(mid=>add(mid,1));sec.forEach(mid=>add(mid,0.5));
      });
    });
    Object.values(m).forEach(v=>{v.pl=Math.round(v.pl);v.done=Math.round(v.done);});
    return m;
  },[exos,exMeta,sets,sessions,wk]);
  const dispData=useMemo(()=>{
    if(showSubs)return muscleData;
    const agg={};
    Object.entries(muscleData).forEach(([mid,data])=>{
      const par=MTREE.find(g=>g.id===mid)||MTREE.find(g=>g.s?.some(s=>s.id===mid));
      const pid=par?.id||mid;
      if(!agg[pid])agg[pid]={pl:0,done:0,exs:[]};
      agg[pid].pl+=data.pl;agg[pid].done+=data.done;
      data.exs.forEach(e=>{if(!agg[pid].exs.find(x=>x.name===e.name&&x.sid===e.sid))agg[pid].exs.push(e);});
    });
    return agg;
  },[muscleData,showSubs]);
  const sorted=Object.entries(dispData).sort((a,b)=>b[1].pl-a[1].pl);
  const maxP=Math.max(...sorted.map(([,d])=>d.pl),1);
  const panelD=panel?dispData[panel]:null;
  const bNav={padding:"5px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:13,cursor:"pointer",fontFamily:"inherit"};
  if(!sorted.length)return(<div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.brd,marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Séries par muscle</div><div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"14px 0"}}>Aucun exercice configuré pour S{wk}</div></div>);
  return(<>
    {panel&&<div onClick={()=>setPanel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:199}}/>}
    {panel&&panelD&&(<div style={{position:"fixed",top:0,right:0,bottom:0,width:340,background:C.bg,zIndex:200,borderLeft:"1px solid "+C.brdL,display:"flex",flexDirection:"column",overflowY:"auto",boxShadow:"-8px 0 32px rgba(0,0,0,0.4)"}}>
      <div style={{padding:"16px 20px",borderBottom:"1px solid "+C.brd,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:C.bg,zIndex:1}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:getMC(panel)}}>{mL(panel)}</div>
          <div style={{fontSize:11,color:C.tx3,marginTop:2}}>S{wk} — <span style={{color:panelD.done>=panelD.pl&&panelD.pl>0?C.g:C.tx2,fontWeight:600}}>{panelD.done} réalisées</span> / {panelD.pl} prévues</div>
        </div>
        <button onClick={()=>setPanel(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:22,cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:"4px 8px"}}>×</button>
      </div>
      <div style={{padding:"14px 16px",flex:1}}>
        <div style={{height:5,background:C.s2,borderRadius:3,overflow:"hidden",marginBottom:16}}>
          <div style={{height:"100%",width:panelD.pl>0?Math.min(panelD.done/panelD.pl*100,100)+"%":"0%",background:panelD.done>=panelD.pl&&panelD.pl>0?C.g:getMC(panel),borderRadius:3,transition:"width 0.4s"}}/>
        </div>
        {panelD.exs.length===0&&<div style={{color:C.tx3,fontSize:11,textAlign:"center",padding:"20px 0"}}>Aucun exercice</div>}
        {panelD.exs.map((ex,i)=>{
          const mc=getMC(panel);const donePct=ex.pl>0?Math.min(ex.done/ex.pl*100,100):0;
          return(<div key={i} style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.s1,border:"1px solid "+(ex.factor<1?C.brdL:mc+"40")}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.tx,marginBottom:2}}>{ex.name}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:C.tx3,background:C.s2,padding:"2px 7px",borderRadius:5}}>{ex.sessName}</span>
                  {ex.factor<1&&<span style={{fontSize:9,color:C.tx3,fontStyle:"italic",padding:"2px 7px",borderRadius:5,background:C.s2}}>secondaire ×0.5</span>}
                </div>
              </div>
              <div style={{textAlign:"right",marginLeft:8}}>
                <div style={{fontSize:16,fontWeight:800,color:donePct>=100?C.g:mc}}>{ex.done}<span style={{fontSize:10,color:C.tx3,fontWeight:400}}>/{ex.pl}</span></div>
                <div style={{fontSize:9,color:C.tx3}}>séries</div>
              </div>
            </div>
            {(ex.kg>0||ex.reps)&&<div style={{fontSize:10,color:C.tx3,marginBottom:6}}>{ex.kg>0?ex.kg+"kg":""}{ex.kg>0&&ex.reps?" × ":""}{ex.reps||""}</div>}
            <div style={{height:4,background:C.s2,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:donePct+"%",background:donePct>=100?C.g:mc,borderRadius:2,transition:"width 0.4s"}}/>
            </div>
          </div>);
        })}
      </div>
    </div>)}
    <div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.brd,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Séries par muscle</div>
        <button onClick={()=>setShowSubs(!showSubs)} style={{padding:"3px 10px",borderRadius:6,border:"1px solid "+(showSubs?C.ac:C.brdL),background:showSubs?C.acS:"transparent",color:showSubs?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Sous-groupes</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button onClick={()=>setWk(w=>wks[Math.max(0,wks.indexOf(w)-1)])} disabled={wk===wks[0]} style={{...bNav,opacity:wk===wks[0]?0.3:1}}>←</button>
        <div style={{display:"flex",gap:4,flex:1,justifyContent:"center",flexWrap:"wrap"}}>
          {wks.map(w=><button key={w} onClick={()=>setWk(w)} style={{padding:"4px 10px",borderRadius:7,border:"none",background:wk===w?C.ac:C.s2,color:wk===w?"#fff":C.tx3,fontSize:10,fontWeight:wk===w?700:400,cursor:"pointer",fontFamily:"inherit"}}> S{w}</button>)}
        </div>
        <button onClick={()=>setWk(w=>wks[Math.min(wks.length-1,wks.indexOf(w)+1)])} disabled={wk===wks[wks.length-1]} style={{...bNav,opacity:wk===wks[wks.length-1]?0.3:1}}>→</button>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:C.ac+"35"}}/><span style={{fontSize:9,color:C.tx3}}>Prévu</span></div>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:C.g}}/><span style={{fontSize:9,color:C.tx3}}>Réalisé</span></div>
        <div style={{fontSize:9,color:C.tx3,marginLeft:"auto"}}>Cliquer pour détail →</div>
      </div>
      {sorted.map(([mid,data])=>{
        const c=getMC(mid);const sel=panel===mid;
        const planPct=data.pl/maxP*100;const realPct=data.pl>0?Math.min(data.done/data.pl*100,100)*planPct/100:0;
        return(<div key={mid} onClick={()=>setPanel(sel?null:mid)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer",borderRadius:8,padding:"5px 6px",background:sel?C.s2:"transparent",border:"1px solid "+(sel?c+"40":"transparent"),transition:"all 0.15s"}}>
          <span style={{fontSize:10,color:sel?c:C.tx2,width:76,flexShrink:0,textAlign:"right",fontWeight:sel?700:400}}>{mL(mid)}</span>
          <div style={{flex:1,height:16,background:C.s2,borderRadius:4,overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",inset:0,width:planPct+"%",background:c+"25",borderRadius:4}}/>
            <div style={{position:"absolute",inset:0,width:realPct+"%",background:c,borderRadius:4,transition:"width 0.4s"}}/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:data.done>0?c:C.tx3,width:46,textAlign:"right",fontFamily:"monospace"}}>{data.done}/{data.pl}s</span>
        </div>);
      })}
    </div>
  </>);
}
function WeeklyVolumeCard({exos,sets,sessions,weeksArr,tw,C}){
  const[sel,setSel]=useState(null);
  const wks=weeksArr||Array.from({length:tw||6},(_,i)=>i+1);
  const data=wks.map(wk=>{
    const planned=Object.values(exos).flat().filter(ex=>(["muscu","halterophilie"].includes(ex.exType||"muscu"))).reduce((s,ex)=>s+(ex.weeks[wk]?.sets||0),0);
    const done=Object.entries(sets).filter(([k])=>k.endsWith("_"+wk)).reduce((s,[,rows])=>s+rows.filter(r=>r.done).length,0);
    return{wk,planned,done};
  });
  const maxP=Math.max(...data.map(d=>d.planned),1);
  return(<div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Volume hebdomadaire (séries)</div>
    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:70,marginBottom:4}}>
      {data.map(({wk,planned,done},i)=>{
        const prev=i>0?data[i-1].planned:null;
        const delta=prev!==null?planned-prev:null;
        const isSel=sel===wk;
        const barH=maxP>0?(planned/maxP*100):0;
        const doneH=planned>0?(done/planned*barH):0;
        return(<div key={wk} onClick={()=>setSel(isSel?null:wk)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}>
          {delta!==null&&<div style={{fontSize:7,fontWeight:700,color:delta>0?C.g:delta<0?C.r:C.tx3,marginBottom:1}}>{delta>0?"+":""}{delta}</div>}
          <div style={{width:"100%",flex:1,display:"flex",flexDirection:"column-reverse",position:"relative"}}>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:barH+"%",background:isSel?C.ac:C.ac+"55",borderRadius:"4px 4px 0 0",transition:"height 0.3s"}}/>
            {done>0&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:doneH+"%",background:isSel?C.g:C.g+"80",borderRadius:"4px 4px 0 0"}}/>}
          </div>
          <div style={{fontSize:9,fontWeight:isSel?800:400,color:isSel?C.ac:C.tx3,marginTop:2}}>S{wk}</div>
          <div style={{fontSize:9,fontWeight:600,color:C.tx2}}>{planned}</div>
        </div>);
      })}
    </div>
    {sel&&(()=>{
      const d=data.find(x=>x.wk===sel);
      const prev=data.find(x=>x.wk===sel-1);
      if(!d)return null;
      return(<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+C.ac+"30"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:C.ac}}>Semaine {sel}</div>
          <div style={{display:"flex",gap:12}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.ac}}>{d.planned}</div><div style={{fontSize:8,color:C.tx3}}>prévues</div></div>
            {d.done>0&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.g}}>{d.done}</div><div style={{fontSize:8,color:C.tx3}}>réalisées</div></div>}
            {prev&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:d.planned-prev.planned>0?C.g:d.planned-prev.planned<0?C.r:C.tx3}}>{d.planned-prev.planned>0?"+":""}{d.planned-prev.planned}</div><div style={{fontSize:8,color:C.tx3}}>vs S{sel-1}</div></div>}
          </div>
        </div>
        {sessions.filter(s=>(exos[s.id]||[]).some(ex=>(["muscu","halterophilie"].includes(ex.exType||"muscu"))&&ex.weeks[sel]?.sets)).map(s=>{
          const sp=(exos[s.id]||[]).filter(ex=>(["muscu","halterophilie"].includes(ex.exType||"muscu"))).reduce((sum,ex)=>sum+(ex.weeks[sel]?.sets||0),0);
          if(!sp)return null;
          return(<div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <div style={{fontSize:10,color:C.tx2,width:80,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name||s.short}</div>
            <div style={{flex:1,height:6,background:C.s1,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(sp/d.planned*100)+"%",background:C.ac+"70",borderRadius:3}}/></div>
            <div style={{fontSize:10,fontWeight:700,color:C.tx,width:24,textAlign:"right"}}>{sp}</div>
          </div>);
        })}
      </div>);
    })()}
  </div>);
}

const CHAT_AI_URL=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-program`;

function AIChatBar({exos,sessions,chatHistory,setChatHistory,onApply,onOpenChange,C}){
  const[open,setOpen]=useState(false);
  useEffect(()=>{onOpenChange?.(open);},[open]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[pendingEdit,setPendingEdit]=useState(null);
  const[error,setError]=useState(null);
  const msgEndRef=useRef(null);
  useEffect(()=>{if(open&&msgEndRef.current)msgEndRef.current.scrollIntoView({behavior:"smooth"});},[chatHistory,open]);

  const send=async()=>{
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");setLoading(true);setError(null);
    const newHistory=[...chatHistory,{role:"user",content:msg}];
    setChatHistory(newHistory);
    try{
      const resp=await fetch(CHAT_AI_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({mode:"chat_edit",currentProgram:exos,sessions,message:msg,conversationHistory:chatHistory})});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.error||"Erreur serveur");
      if(!data.sessions)throw new Error("Reponse invalide");
      const reply=data.rationale||"Modifications appliquées. Confirmez pour appliquer.";
      setChatHistory([...newHistory,{role:"assistant",content:reply}]);
      setPendingEdit(data.sessions);
    }catch(e){setError(e.message);setChatHistory([...newHistory,{role:"assistant",content:"Erreur: "+e.message}]);}
    setLoading(false);
  };

  const confirm=()=>{if(pendingEdit){onApply(pendingEdit);setPendingEdit(null);}};
  const cancel=()=>setPendingEdit(null);

  return(<>
    {/* Floating toggle button */}
    {!open&&<button onClick={()=>setOpen(true)} style={{position:"fixed",bottom:24,right:24,zIndex:90,width:52,height:52,borderRadius:"50%",border:"none",background:C.coach,color:"#fff",fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(212,83,142,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>✦</button>}

    {/* Chat panel */}
    {open&&(<div style={{position:"fixed",bottom:0,right:0,left:0,zIndex:90,background:C.s1,borderTop:"1px solid "+C.coach+"40",boxShadow:"0 -4px 30px rgba(0,0,0,0.5)",maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:"1px solid "+C.brd,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:14,color:C.coach}}>✦</div>
          <div style={{fontSize:13,fontWeight:700,color:C.tx}}>Editer avec l'IA</div>
          {loading&&<div style={{fontSize:10,color:C.tx3,animation:"pulse 1.5s infinite"}}>Analyse en cours...</div>}
        </div>
        <div style={{display:"flex",gap:8}}>
          {chatHistory.length>0&&<button onClick={()=>{setChatHistory([]);setPendingEdit(null);}} style={{fontSize:10,color:C.tx3,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Effacer</button>}
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:18,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>×</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {chatHistory.length===0&&<div style={{textAlign:"center",color:C.tx3,fontSize:12,padding:"20px 0"}}>Décris les modifications à apporter au programme.<br/><span style={{fontSize:11}}>Ex: "Ajoute 1 semaine au squat", "Remplace les dips par du triceps machine"</span></div>}
        {chatHistory.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.role==="user"?C.coach:C.s2,color:m.role==="user"?"#fff":C.tx,fontSize:12,lineHeight:1.5}}>{m.content}</div>
          </div>
        ))}
        {pendingEdit&&<div style={{background:C.gS,border:"1px solid "+C.g+"40",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{fontSize:12,color:C.g,fontWeight:600}}>Modifications pretes. Voulez-vous les appliquer ?</div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button onClick={cancel} style={{padding:"5px 12px",borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
            <button onClick={confirm} style={{padding:"5px 12px",borderRadius:7,border:"none",background:C.g,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Appliquer</button>
          </div>
        </div>}
        <div ref={msgEndRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"10px 16px",borderTop:"1px solid "+C.brd,display:"flex",gap:8,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ex: Ajoute une semaine de plus, augmente le volume pecs..." style={{flex:1,padding:"9px 12px",borderRadius:9,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",outline:"none"}} disabled={loading}/>
        <button onClick={send} disabled={loading||!input.trim()} style={{padding:"9px 16px",borderRadius:9,border:"none",background:loading||!input.trim()?"#333":C.coach,color:loading||!input.trim()?C.tx3:"#fff",fontSize:12,fontWeight:700,cursor:loading||!input.trim()?"default":"pointer",fontFamily:"inherit",flexShrink:0}}>Envoyer</button>
      </div>
    </div>)}
  </>);
}

function WeekCalendar({sessions,completedSessions,currentWeek,weekSchedule,setWeekSchedule,C}){
  const[selectDay,setSelectDay]=useState(null);
  const[customLabel,setCustomLabel]=useState('');
  const DAYS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const ACTIVITIES=[{label:'Course',emoji:'🏃'},{label:'Five',emoji:'⚽'},{label:'Vélo',emoji:'🚴'},{label:'Natation',emoji:'🏊'},{label:'Tennis',emoji:'🎾'},{label:'Boxe',emoji:'🥊'},{label:'Yoga',emoji:'🧘'},{label:'Basket',emoji:'🏀'},{label:'Ski',emoji:'🎿'},{label:'Golf',emoji:'⛳'}];
  const today=new Date();
  const dow=today.getDay();
  const monday=new Date(today);
  monday.setDate(today.getDate()-(dow===0?6:dow-1));
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
  const todStr=todayKey();
  const doneSet=new Set(completedSessions[currentWeek]||[]);
  const normDay=v=>!v?[]:Array.isArray(v)?v:[v];
  const wk=weekSchedule||{};
  const extras=wk.extras||{};
  const dayExtras=idx=>extras[idx]||[];
  const toggleDay=(dayIdx,sessId)=>{const cur=normDay(wk[dayIdx]);const updated=cur.includes(sessId)?cur.filter(id=>id!==sessId):[...cur,sessId];setWeekSchedule({...wk,[dayIdx]:updated.length?updated:null});};
  const clearDay=(dayIdx)=>{setWeekSchedule({...wk,[dayIdx]:null,extras:{...extras,[dayIdx]:undefined}});setSelectDay(null);};
  const addExtra=(dayIdx,label,emoji)=>{const cur=dayExtras(dayIdx);setWeekSchedule({...wk,extras:{...extras,[dayIdx]:[...cur,{id:String(Date.now()),label,emoji}]}});};
  const removeExtra=(dayIdx,id)=>{const cur=dayExtras(dayIdx).filter(e=>e.id!==id);setWeekSchedule({...wk,extras:{...extras,[dayIdx]:cur.length?cur:undefined}});};
  return(<div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Semaine du {monday.getDate()}/{monday.getMonth()+1}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:selectDay!==null?10:0}}>
      {weekDays.map((date,i)=>{
        const dateStr=String(date.getFullYear())+String(date.getMonth()+1).padStart(2,"0")+String(date.getDate()).padStart(2,"0");
        const isToday=dateStr===todStr;
        const isPast=date<new Date(new Date().setHours(0,0,0,0))&&!isToday;
        const sessIds=normDay(wk[i]);
        const sessList=sessIds.map(id=>sessions.find(s=>s.id===id)).filter(Boolean);
        const allDone=sessList.length>0&&sessList.every(s=>doneSet.has(s.id));
        const exs=dayExtras(i);
        const isSel=selectDay===i;
        return(<div key={i} onClick={()=>setSelectDay(isSel?null:i)} style={{borderRadius:10,padding:"7px 3px",textAlign:"center",cursor:"pointer",border:"1.5px solid "+(isSel?C.ac:isToday?C.ac+"60":allDone?C.g+"50":exs.length>0?C.o+"50":C.brd),background:allDone?C.g+"10":isToday?C.acS:isSel?"rgba(123,111,255,0.08)":exs.length>0&&sessList.length===0?C.oS:C.s2,transition:"all 0.15s"}}>
          <div style={{fontSize:9,fontWeight:isToday?700:400,color:isToday?C.ac:C.tx3,marginBottom:2}}>{DAYS[i]}</div>
          <div style={{fontSize:12,fontWeight:isToday?800:500,color:isToday?C.ac:isPast?C.tx3:C.tx,marginBottom:(sessList.length||exs.length)?3:5}}>{date.getDate()}</div>
          {sessList.length>0&&<div style={{display:"flex",flexDirection:"column",gap:1}}>{sessList.map(s=>{const done=doneSet.has(s.id);return(<div key={s.id} style={{fontSize:7,fontWeight:700,padding:"1px 2px",borderRadius:3,background:done?C.g+"25":C.acS,color:done?C.g:C.ac,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{done?"✓ ":""}{s.short}</div>);})}</div>}
          {exs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:1,marginTop:sessList.length?1:0}}>{exs.map(e=>(<div key={e.id} style={{fontSize:8,lineHeight:1.3}}>{e.emoji}</div>))}</div>}
          {sessList.length===0&&exs.length===0&&<div style={{width:5,height:5,borderRadius:"50%",background:C.s1,margin:"0 auto"}}/>}
        </div>);
      })}
    </div>
    {selectDay!==null&&(<div style={{padding:"10px 12px",borderRadius:12,background:C.s2,border:"1px solid "+C.brdL}}>
      <div style={{fontSize:10,fontWeight:600,color:C.tx3,marginBottom:8}}>{DAYS[selectDay]} — planifier</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
        <button onClick={()=>clearDay(selectDay)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(normDay(wk[selectDay]).length===0&&dayExtras(selectDay).length===0?C.tx2:C.brdL),background:normDay(wk[selectDay]).length===0&&dayExtras(selectDay).length===0?"rgba(255,255,255,0.06)":"transparent",color:normDay(wk[selectDay]).length===0&&dayExtras(selectDay).length===0?C.tx:C.tx3,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:normDay(wk[selectDay]).length===0&&dayExtras(selectDay).length===0?700:400}}>Repos</button>
        {sessions.map(s=>{const sel=normDay(wk[selectDay]).includes(s.id);return(<button key={s.id} onClick={()=>toggleDay(selectDay,s.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(sel?C.ac:C.brdL),background:sel?C.acS:"transparent",color:sel?C.ac:C.tx2,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}}>{sel?"✓ ":""}{s.short}</button>);})}
      </div>
      <div style={{borderTop:"1px solid "+C.brd,paddingTop:8}}>
        <div style={{fontSize:10,fontWeight:600,color:C.o,marginBottom:7}}>+ Activité libre</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
          {ACTIVITIES.map(a=>(<button key={a.label} onClick={()=>addExtra(selectDay,a.label,a.emoji)} style={{padding:"4px 9px",borderRadius:7,border:"1px solid "+C.o+"40",background:C.oS,color:C.o,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{a.emoji} {a.label}</button>))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={customLabel} onChange={e=>setCustomLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&customLabel.trim()){addExtra(selectDay,customLabel.trim(),'🏅');setCustomLabel('');}}} placeholder="Autre activité..." style={{flex:1,padding:"5px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>{if(customLabel.trim()){addExtra(selectDay,customLabel.trim(),'🏅');setCustomLabel('');}}} style={{padding:"5px 12px",borderRadius:7,border:"none",background:C.o,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+</button>
        </div>
        {dayExtras(selectDay).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
          {dayExtras(selectDay).map(e=>(<span key={e.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:C.o+"20",border:"1px solid "+C.o+"40",color:C.o,fontSize:10,fontWeight:600}}>{e.emoji} {e.label}<span onClick={ev=>{ev.stopPropagation();removeExtra(selectDay,e.id);}} style={{cursor:"pointer",fontSize:12,lineHeight:1,marginLeft:2}}>×</span></span>))}
        </div>}
      </div>
    </div>)}
  </div>);
}

// ── EXERCISE BANK COMPONENTS ─────────────────────────────────────────────────

function ExerciseCreateModal({coachId,onSave,onClose}){
  const[form,setForm]=useState({name:'',target:'Pecs',secondary:[],equipment:'Barre',difficulty:'Intermédiaire',ex_type:'muscu',is_compound:true,is_unilateral:false,youtube_id:'',instructions:'',tips:''});
  const[saving,setSaving]=useState(false);
  const TARGETS=['Pecs','Dos-GD','Dos-Trap','Dos-Rhom','Ep-Ant','Ep-Lat','Ep-Post','Quads','Ischios','Fessiers','Adducteurs','Triceps','Biceps','Core','Mollets'];
  const EQUIPS=['Barre','Haltères','Cable','Machine','Poids de corps','Élastique','Kettlebell','Smith'];
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const parseYtId=v=>{const m=(v||'').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:v.trim();};
  const fS={padding:'9px 12px',borderRadius:9,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:'inherit',width:'100%',boxSizing:'border-box',outline:'none'};
  const lS={fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5,display:'block'};
  const save=async()=>{
    if(!form.name.trim())return;setSaving(true);
    const ytId=form.youtube_id?parseYtId(form.youtube_id):null;
    const{error}=await supabase.from('exercises').insert({...form,name:form.name.trim(),youtube_id:ytId||null,created_by:coachId,is_public:true,is_verified:false});
    setSaving(false);if(!error)onSave();
  };
  return(<div style={{position:'fixed',inset:0,zIndex:310,background:'rgba(0,0,0,0.88)',overflowY:'auto'}}>
    <div style={{padding:16,maxWidth:480,margin:'0 auto'}}>
      <div style={{background:C.s1,borderRadius:16,padding:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700}}>Nouvel exercice</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.tx3,fontSize:22,cursor:'pointer'}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={lS}>Nom *</label><input value={form.name} onChange={e=>upd('name',e.target.value)} placeholder="Ex: Développé couché barre" style={fS}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={lS}>Muscle principal</label><select value={form.target} onChange={e=>upd('target',e.target.value)} style={fS}>{TARGETS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={lS}>Équipement</label><select value={form.equipment} onChange={e=>upd('equipment',e.target.value)} style={fS}>{EQUIPS.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={lS}>Difficulté</label><select value={form.difficulty} onChange={e=>upd('difficulty',e.target.value)} style={fS}>{['Débutant','Intermédiaire','Avancé'].map(d=><option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={lS}>Type</label><select value={form.ex_type} onChange={e=>upd('ex_type',e.target.value)} style={fS}><option value="muscu">Musculation</option><option value="plio">Pliométrique</option><option value="halterophilie">Haltérophilie</option><option value="mobilite">Mobilité</option></select></div>
          </div>
          <div style={{display:'flex',gap:16}}>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:C.tx2}}><input type="checkbox" checked={form.is_compound} onChange={e=>upd('is_compound',e.target.checked)} style={{accentColor:C.ac}}/>Polyarticulaire</label>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:C.tx2}}><input type="checkbox" checked={form.is_unilateral} onChange={e=>upd('is_unilateral',e.target.checked)} style={{accentColor:C.ac}}/>Unilatéral</label>
          </div>
          <div><label style={lS}>Lien YouTube (URL ou ID)</label><input value={form.youtube_id} onChange={e=>upd('youtube_id',e.target.value)} placeholder="https://youtube.com/watch?v=..." style={fS}/></div>
          <div><label style={lS}>Instructions</label><textarea value={form.instructions} onChange={e=>upd('instructions',e.target.value)} placeholder="Décris l'exécution technique..." rows={3} style={{...fS,resize:'vertical'}}/></div>
          <div><label style={lS}>Conseils</label><textarea value={form.tips} onChange={e=>upd('tips',e.target.value)} placeholder="Erreurs fréquentes, points clés..." rows={2} style={{...fS,resize:'vertical'}}/></div>
        </div>
        <button onClick={save} disabled={saving||!form.name.trim()} style={{width:'100%',padding:'12px 0',borderRadius:12,border:'none',background:form.name.trim()?C.ac:'#333',color:'#fff',fontSize:14,fontWeight:700,cursor:form.name.trim()?'pointer':'default',fontFamily:'inherit',marginTop:16}}>{saving?'Enregistrement...':'Créer l\'exercice'}</button>
      </div>
    </div>
  </div>);
}

function MergeModal({source,onMerge,onClose}){
  const[search,setSearch]=useState('');const[results,setResults]=useState([]);const[target,setTarget]=useState(null);
  useEffect(()=>{
    if(search.length<2){setResults([]);return;}
    supabase.from('exercises').select('id,name,target,youtube_id').ilike('name',`%${search}%`).neq('id',source.id).limit(8).then(({data})=>setResults(data||[]));
  },[search]);
  return(<div style={{position:'fixed',inset:0,zIndex:320,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.s1,borderRadius:16,padding:20,width:'100%',maxWidth:400}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Fusionner avec...</div>
      <div style={{fontSize:11,color:C.tx3,marginBottom:14}}>"{source.name}" sera conservé, l'autre supprimé.</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Chercher l'exercice doublon..." style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:'inherit',boxSizing:'border-box',marginBottom:10,outline:'none'}}/>
      {results.map(r=>(<div key={r.id} onClick={()=>setTarget(r)} style={{padding:'10px 12px',borderRadius:9,border:'1px solid '+(target?.id===r.id?C.ac:C.brdL),background:target?.id===r.id?C.acS:C.s2,marginBottom:6,cursor:'pointer'}}>
        <div style={{fontSize:13,fontWeight:600,color:C.tx}}>{r.name}</div>
        {r.target&&<div style={{fontSize:10,color:C.tx3}}>{r.target}</div>}
      </div>))}
      <div style={{display:'flex',gap:8,marginTop:14}}>
        <button onClick={onClose} style={{flex:1,padding:'10px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
        <button onClick={()=>target&&onMerge(source.id,target.id)} disabled={!target} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',background:target?C.ac:'#444',color:'#fff',fontSize:12,fontWeight:700,cursor:target?'pointer':'default',fontFamily:'inherit'}}>Fusionner</button>
      </div>
    </div>
  </div>);
}

function ExerciseDetailModal({ex,coachId,onClose,onAdd,onDelete,onMergeClick,onRefresh}){
  const isOwner=!ex.created_by||ex.created_by===coachId;
  return(<div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.88)',overflowY:'auto'}} onClick={onClose}>
    <div style={{minHeight:'100%',display:'flex',alignItems:'flex-end'}} onClick={e=>e.stopPropagation()}>
      <div style={{width:'100%',background:C.s1,borderRadius:'16px 16px 0 0',maxHeight:'92vh',overflowY:'auto',paddingBottom:40}}>
        {ex.youtube_id&&<div style={{width:'100%',maxWidth:420,margin:'0 auto',background:'#000',aspectRatio:'16/9'}}><iframe src={`https://www.youtube.com/embed/${ex.youtube_id}?rel=0`} style={{width:'100%',height:'100%',border:'none'}} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/></div>}
        {!ex.youtube_id&&ex.image_url&&<img src={ex.image_url} style={{width:'100%',maxWidth:420,margin:'0 auto',aspectRatio:'16/9',objectFit:'cover',display:'block'}} alt={ex.name}/>}
        {!ex.youtube_id&&!ex.image_url&&<div style={{width:'100%',aspectRatio:'16/9',background:C.s2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>💪</div>}
        <div style={{padding:'16px 16px 0'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
            <div style={{flex:1,marginRight:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                {ex.is_verified?<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:C.gS,color:C.g,fontWeight:700}}>✓ Officiel</span>:<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:C.oS,color:C.o,fontWeight:600}}>Communauté</span>}
                {ex.difficulty&&<span style={{fontSize:10,color:C.tx3}}>{ex.difficulty}</span>}
              </div>
              <div style={{fontSize:18,fontWeight:800,lineHeight:1.2}}>{ex.name}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:C.tx3,fontSize:24,cursor:'pointer',flexShrink:0,padding:0}}>×</button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            {ex.target&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:6,background:C.acS,color:C.ac,fontWeight:600}}>{ex.target}</span>}
            {(ex.secondary||[]).map(m=><span key={m} style={{fontSize:11,padding:'3px 10px',borderRadius:6,background:C.s2,color:C.tx3}}>{m}</span>)}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
            {ex.equipment&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:C.s2,color:C.tx2}}>{ex.equipment}</span>}
            {ex.is_compound!=null&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:C.s2,color:C.tx2}}>{ex.is_compound?'Polyarticulaire':'Monoarticulaire'}</span>}
            {ex.is_unilateral&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:C.s2,color:C.tx2}}>Unilatéral</span>}
          </div>
          {ex.instructions&&<div style={{marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Instructions</div><div style={{fontSize:12,color:C.tx2,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{ex.instructions}</div></div>}
          {ex.tips&&<div style={{marginBottom:16,padding:'10px 12px',borderRadius:10,background:C.oS,border:'1px solid '+C.o+'30'}}><div style={{fontSize:10,fontWeight:700,color:C.o,marginBottom:4}}>💡 Conseils</div><div style={{fontSize:12,color:C.tx2,lineHeight:1.6}}>{ex.tips}</div></div>}
          <button onClick={onAdd} style={{width:'100%',padding:'12px 0',borderRadius:12,border:'none',background:C.ac,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>+ Ajouter à mes exercices</button>
          {isOwner&&<div style={{display:'flex',gap:8}}>
            <button onClick={onMergeClick} style={{flex:1,padding:'9px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Fusionner</button>
            <button onClick={onDelete} style={{flex:1,padding:'9px 0',borderRadius:10,border:'1px solid '+C.r+'50',background:C.rS,color:C.r,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Supprimer</button>
          </div>}
        </div>
      </div>
    </div>
  </div>);
}

function ExerciseBank({coachId,onAddToExos}){
  const PAGE=20;
  const[exList,setExList]=useState([]);const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');const[page,setPage]=useState(0);const[total,setTotal]=useState(0);
  const[fMuscles,setFMuscles]=useState([]);const[fEquip,setFEquip]=useState('');const[fDiff,setFDiff]=useState('');const[fType,setFType]=useState('');
  const[showMusclePanel,setShowMusclePanel]=useState(false);
  const[sel,setSel]=useState(null);const[showCreate,setShowCreate]=useState(false);
  const[showMerge,setShowMerge]=useState(false);const[confirmDel,setConfirmDel]=useState(null);
  const TARGETS=['Pecs','Dos-GD','Dos-Trap','Dos-Rhom','Ep-Ant','Ep-Lat','Ep-Post','Quads','Ischios','Fessiers','Adducteurs','Triceps','Biceps','Core','Mollets'];
  const EQUIPS=['Barre','Haltères','Cable','Machine','Poids de corps','Élastique','Kettlebell','Smith'];
  const toggleMuscle=m=>{setFMuscles(prev=>prev.includes(m)?prev.filter(x=>x!==m):[...prev,m]);setPage(0);};
  useEffect(()=>{loadEx();},[search,fMuscles,fEquip,fDiff,fType,page]);
  const loadEx=async()=>{
    setLoading(true);
    let q=supabase.from('exercises').select('*',{count:'exact'}).order('name').range(page*PAGE,(page+1)*PAGE-1);
    if(search)q=q.ilike('name',`%${search}%`);
    if(fMuscles.length>0){const orParts=fMuscles.flatMap(m=>[`target.eq.${m}`,`secondary.cs.{${m}}`]);q=q.or(orParts.join(','));}
    if(fEquip)q=q.eq('equipment',fEquip);
    if(fDiff)q=q.eq('difficulty',fDiff);
    if(fType)q=q.eq('ex_type',fType);
    const{data,count}=await q;
    setExList(data||[]);setTotal(count||0);setLoading(false);
  };
  const deleteEx=async(id)=>{await supabase.from('exercises').delete().eq('id',id);setConfirmDel(null);setSel(null);loadEx();};
  const mergeEx=async(keepId,delId)=>{
    const keep=exList.find(e=>e.id===keepId)||sel;
    const del=exList.find(e=>e.id===delId);
    if(keep&&del){
      const upd={};
      if(!keep.youtube_id&&del.youtube_id)upd.youtube_id=del.youtube_id;
      if(!keep.image_url&&del.image_url)upd.image_url=del.image_url;
      if(!keep.instructions&&del.instructions)upd.instructions=del.instructions;
      if(!keep.tips&&del.tips)upd.tips=del.tips;
      if(Object.keys(upd).length)await supabase.from('exercises').update(upd).eq('id',keepId);
    }
    await supabase.from('exercises').delete().eq('id',delId);
    setShowMerge(false);setSel(null);loadEx();
  };
  const hasFilter=fMuscles.length>0||fEquip||fDiff||fType;
  return(<div style={{padding:'0 0 60px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
      <div><div style={{fontSize:16,fontWeight:700}}>Banque d'exercices</div><div style={{fontSize:11,color:C.tx3}}>{total} exercice{total>1?'s':''}</div></div>
      <button onClick={()=>setShowCreate(true)} style={{padding:'7px 14px',borderRadius:10,border:'none',background:C.ac,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Créer</button>
    </div>
    <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Rechercher un exercice..." style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid '+C.brdL,background:C.s1,color:C.tx,fontSize:13,fontFamily:'inherit',boxSizing:'border-box',marginBottom:10,outline:'none'}}/>
    <div style={{display:'flex',gap:6,marginBottom:fMuscles.length>0?8:14,overflowX:'auto',paddingBottom:4}}>
      <button onClick={()=>setShowMusclePanel(v=>!v)} style={{flexShrink:0,padding:'5px 10px',borderRadius:8,border:'1px solid '+(fMuscles.length>0?C.ac:C.brdL),background:fMuscles.length>0?C.acS:C.s1,color:fMuscles.length>0?C.ac:C.tx3,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
        Muscles{fMuscles.length>0&&<span style={{background:C.ac,color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{fMuscles.length}</span>}
      </button>
      {[{l:'Équip.',v:fEquip,s:setFEquip,o:EQUIPS},{l:'Niveau',v:fDiff,s:setFDiff,o:['Débutant','Intermédiaire','Avancé']},{l:'Type',v:fType,s:setFType,o:['muscu','halterophilie','plio','mobilite']}].map(({l,v,s,o})=>(
        <select key={l} value={v} onChange={e=>{s(e.target.value);setPage(0);}} style={{flexShrink:0,padding:'5px 8px',borderRadius:8,border:'1px solid '+(v?C.ac:C.brdL),background:v?C.acS:C.s1,color:v?C.ac:C.tx3,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',outline:'none'}}>
          <option value=''>{l}</option>{o.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
      ))}
      {hasFilter&&<button onClick={()=>{setFMuscles([]);setFEquip('');setFDiff('');setFType('');}} style={{flexShrink:0,padding:'5px 10px',borderRadius:8,border:'1px solid '+C.r+'50',background:C.rS,color:C.r,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✕</button>}
    </div>
    {showMusclePanel&&<div style={{background:C.s1,borderRadius:12,padding:'10px 12px',marginBottom:10,border:'1px solid '+C.brdL}}>
      <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Principal ou secondaire</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        {TARGETS.map(m=>{const on=fMuscles.includes(m);return(<button key={m} onClick={()=>toggleMuscle(m)} style={{padding:'4px 10px',borderRadius:20,border:'1px solid '+(on?C.ac:C.brdL),background:on?C.ac:'transparent',color:on?'#fff':C.tx2,fontSize:11,fontWeight:on?700:400,cursor:'pointer',fontFamily:'inherit'}}>{m}</button>);})}
      </div>
    </div>}
    {fMuscles.length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
      {fMuscles.map(m=><span key={m} onClick={()=>toggleMuscle(m)} style={{padding:'3px 10px',borderRadius:20,background:C.acS,border:'1px solid '+C.ac+'60',color:C.ac,fontSize:11,fontWeight:600,cursor:'pointer'}}>
        {m} ×
      </span>)}
    </div>}
    {loading?<div style={{textAlign:'center',padding:'40px 0',color:C.tx3,fontSize:13}}>Chargement...</div>:(
      <>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {exList.map(ex=>(
            <div key={ex.id} onClick={()=>setSel(ex)} style={{background:C.s1,borderRadius:12,overflow:'hidden',border:'1px solid '+C.brd,cursor:'pointer'}}>
              <div style={{width:'100%',height:90,background:C.s2,position:'relative',overflow:'hidden'}}>
                {ex.youtube_id?<img src={`https://img.youtube.com/vi/${ex.youtube_id}/mqdefault.jpg`} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={ex.name}/>:ex.image_url?<img src={ex.image_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={ex.name}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:C.tx3,fontSize:28}}>💪</div>}
                {ex.youtube_id&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:30,height:30,borderRadius:'50%',background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff'}}>▶</div></div>}
                <div style={{position:'absolute',top:4,left:4,padding:'2px 6px',borderRadius:5,background:'rgba(0,0,0,0.72)',fontSize:9,color:ex.is_verified?C.g:C.o,fontWeight:700}}>{ex.is_verified?'✓ Off.':'Comm.'}</div>
              </div>
              <div style={{padding:'8px 10px'}}>
                <div style={{fontSize:12,fontWeight:700,color:C.tx,marginBottom:3,lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{ex.name}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {ex.target&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:C.acS,color:C.ac,fontWeight:600}}>{ex.target}</span>}
                  {ex.equipment&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:C.s2,color:C.tx3}}>{ex.equipment}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {total>PAGE&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginTop:16}}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+C.brdL,background:C.s1,color:page===0?C.tx3:C.tx,cursor:page===0?'default':'pointer',fontFamily:'inherit',fontSize:12}}>←</button>
          <span style={{fontSize:12,color:C.tx3}}>{page+1} / {Math.ceil(total/PAGE)}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=total} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+C.brdL,background:C.s1,color:(page+1)*PAGE>=total?C.tx3:C.tx,cursor:(page+1)*PAGE>=total?'default':'pointer',fontFamily:'inherit',fontSize:12}}>→</button>
        </div>}
      </>
    )}
    {sel&&!showMerge&&<ExerciseDetailModal ex={sel} coachId={coachId} onClose={()=>setSel(null)} onAdd={()=>{onAddToExos(sel);setSel(null);}} onDelete={()=>setConfirmDel(sel.id)} onMergeClick={()=>setShowMerge(true)} onRefresh={()=>{loadEx();setSel(null);}}/>}
    {sel&&showMerge&&<MergeModal source={sel} onMerge={mergeEx} onClose={()=>setShowMerge(false)}/>}
    {confirmDel&&<div style={{position:'fixed',inset:0,zIndex:320,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:C.s1,borderRadius:16,padding:20,width:'100%',maxWidth:320}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Supprimer cet exercice ?</div>
        <div style={{fontSize:12,color:C.tx3,marginBottom:16}}>Cette action est irréversible.</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setConfirmDel(null)} style={{flex:1,padding:'10px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx2,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
          <button onClick={()=>deleteEx(confirmDel)} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',background:C.r,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Supprimer</button>
        </div>
      </div>
    </div>}
    {showCreate&&<ExerciseCreateModal coachId={coachId} onSave={()=>{setShowCreate(false);loadEx();}} onClose={()=>setShowCreate(false)}/>}
  </div>);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App({athleteId,defaultMode,canToggleMode=true,userName}){
  const load=(k,fb)=>sLoad(k,fb,athleteId);
  const save=(k,v)=>sSave(k,v,athleteId);
  const[mode,setMode]=useState(defaultMode||"athlete");const[tab,setTab]=useState("dash");const[coachTab,setCoachTab]=useState("prog");
  const[exos,setExosState]=useState({});const[exMeta,setExMetaState]=useState({});
  const[aW,setAW]=useState(1);const[sets,setSetsState]=useState({});const[anaTab,setAnaTab]=useState("combined");const[weightRange,setWeightRange]=useState("bloc");
  const[wellness,setWellnessState]=useState(null);const[wellnessHistory,setWellnessHistoryState]=useState({});const[wellnessPeriod,setWellnessPeriod]=useState("month");
  const[bodyWeight,setBodyWeightState]=useState({current:82,target:85});
  const[completedSessions,setCompletedSessionsState]=useState({});
  const[goals,setGoalsState]=useState({sessionsPerWeek:6,sleepTarget:8});
  const[athleteNotes,setAthleteNotesState]=useState({});const[customMethods,setCustomMethodsState]=useState([]);
  const[weightLog,setWeightLogState]=useState({});const[weightMilestones,setWeightMilestonesState]=useState([]);
  const[injuries,setInjuriesState]=useState([]);
  const[sessions,setSessionsState]=useState(DEF_SESSIONS);
  const[blockConfig,setBlockConfigState]=useState(DEF_BLOCK_CONFIG);
  const[loaded,setLoaded]=useState(false);const[saveStatus,setSaveStatus]=useState(null);
  const[weekJustCompleted,setWeekJustCompleted]=useState(null);const[showBilan,setShowBilan]=useState(false);
  const[showWellness,setShowWellness]=useState(false);const[milestoneNotif,setMilestoneNotif]=useState(null);const[autoProgNotif,setAutoProgNotif]=useState(null);
  const[blockHistory,setBlockHistoryState]=useState([]);
  const[weekSchedule,setWeekScheduleState]=useState({});
  const[showNewBlock,setShowNewBlock]=useState(false);const[showBlockHistory,setShowBlockHistory]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[aiChatOpen,setAiChatOpen]=useState(false);
  const[initialLogSess,setInitialLogSess]=useState(null);
  const[timerLeft,setTimerLeft]=useState(120);const[timerDur,setTimerDur]=useState(120);
  const[timerActive,setTimerActive]=useState(false);const[timerFinished,setTimerFinished]=useState(false);
  const timerRef=useRef(null);
  const playDing=()=>{try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const mk=(freq,t0,dur,vol=0.4)=>{const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);o.start(t0);o.stop(t0+dur);};mk(880,ctx.currentTime,1.2);mk(1108,ctx.currentTime+0.25,1.0,0.3);mk(1318,ctx.currentTime+0.5,0.9,0.2);}catch(e){}};
  useEffect(()=>{if(!timerActive||timerLeft<=0)return;const tid=setInterval(()=>setTimerLeft(l=>l-1),1000);timerRef.current=tid;return()=>clearInterval(tid);},[timerActive]);
  useEffect(()=>{if(timerActive&&timerLeft<=0){setTimerActive(false);setTimerFinished(true);playDing();}},[timerActive,timerLeft]);
  const timerSetDur=d=>{setTimerDur(d);setTimerLeft(d);setTimerActive(false);setTimerFinished(false);};
  const timerStart=()=>{setTimerLeft(timerDur);setTimerActive(true);setTimerFinished(false);};
  const timerStop=()=>{clearInterval(timerRef.current);setTimerActive(false);setTimerFinished(false);setTimerLeft(timerDur);};

  useEffect(()=>{
    clearAllLocalStorage();
    (async()=>{
      const[e,m,s,w,wh,bw,cs,g,an,cm,wl,wmil,inj,sess,bc,bh,ws]=await Promise.all([load(SKEYS.exos,{}),load(SKEYS.exMeta,{}),load(SKEYS.sets,{}),load(SKEYS.wellness,null),load(SKEYS.wellnessHistory,{}),load(SKEYS.bw,{current:82,target:85}),load(SKEYS.completed,{}),load(SKEYS.goals,{sessionsPerWeek:6,sleepTarget:8}),load(SKEYS.anotes,{}),load(SKEYS.custMethods,[]),load(SKEYS.weightLog,{}),load(SKEYS.weightMilestones,[]),load(SKEYS.injuries,[]),load(SKEYS.sessions,DEF_SESSIONS),load(SKEYS.blockConfig,DEF_BLOCK_CONFIG),load(SKEYS.blockHistory,[]),load(SKEYS.weekSchedule,{})]);
      const todayW=w?.date===todayKey()?w:null;if(w&&!todayW)save(SKEYS.wellness,null).catch(()=>{});
      setExosState(e);setExMetaState(m);setSetsState(s);setWellnessState(todayW);setWellnessHistoryState(wh);setBodyWeightState(bw);setCompletedSessionsState(cs);setGoalsState(g);setAthleteNotesState(an);setCustomMethodsState(cm);setWeightLogState(wl);setWeightMilestonesState(wmil);setInjuriesState(inj);setSessionsState(sess);setBlockConfigState(bc);setBlockHistoryState(bh||[]);setWeekScheduleState(ws||{});setLoaded(true);
    })();
  },[]);

  useEffect(()=>{
    if(!wellness)return;
    const now=new Date();const midnight=new Date(now);midnight.setHours(24,0,0,0);
    const tid=setTimeout(()=>{setWellnessState(null);save(SKEYS.wellness,null).catch(()=>{});},midnight-now);
    return()=>clearTimeout(tid);
  },[wellness]);

  const flash=ok=>{setSaveStatus(ok?"saved":"error");setTimeout(()=>setSaveStatus(null),2000);};
  const setExos=v=>{const val=typeof v==='function'?v(exos):v;setExosState(val);save(SKEYS.exos,val).then(()=>flash(true)).catch(()=>flash(false));};
  const setExMeta=v=>{const val=typeof v==='function'?v(exMeta):v;setExMetaState(val);save(SKEYS.exMeta,val).then(()=>flash(true)).catch(()=>flash(false));};
  const setSets=v=>{setSetsState(v);save(SKEYS.sets,v).catch(()=>{});};
  const setBodyWeight=v=>{setBodyWeightState(v);save(SKEYS.bw,v).catch(()=>{});};
  const setGoals=v=>{setGoalsState(v);save(SKEYS.goals,v).then(()=>flash(true)).catch(()=>flash(false));};
  const setCompletedSessions=v=>{setCompletedSessionsState(v);save(SKEYS.completed,v).catch(()=>{});};
  const setAthleteNotes=v=>{setAthleteNotesState(v);save(SKEYS.anotes,v).catch(()=>{});};
  const setCustomMethods=v=>{setCustomMethodsState(v);save(SKEYS.custMethods,v).then(()=>flash(true)).catch(()=>flash(false));};
  const setSessions=v=>{const val=typeof v==='function'?v(sessions):v;setSessionsState(val);save(SKEYS.sessions,val).then(()=>flash(true)).catch(()=>flash(false));};
  const setBlockConfig=v=>{const val=typeof v==='function'?v(blockConfig):v;setBlockConfigState(val);save(SKEYS.blockConfig,val).then(()=>flash(true)).catch(()=>flash(false));};
  const setWeekSchedule=v=>{setWeekScheduleState(v);save(SKEYS.weekSchedule,v).catch(()=>{});};
  const updSets=(k,ns)=>setSets({...sets,[k]:ns});
  const setInjuries=v=>{setInjuriesState(v);save(SKEYS.injuries,v).catch(()=>{});};
  const addInjury=inj=>setInjuries([...injuries,inj]);
  const updateInjury=inj=>setInjuries(injuries.map(i=>i.id===inj.id?inj:i));
  const deleteInjury=id=>setInjuries(injuries.filter(i=>i.id!==id));
  const setBlockHistory=v=>{setBlockHistoryState(v);save(SKEYS.blockHistory,v).then(()=>flash(true)).catch(()=>flash(false));};
  const archiveAndNewBlock=(opts)=>{
    const hasData=Object.values(exos).flat().length>0||Object.values(completedSessions).flat().length>0;
    if(hasData){
      const archived={id:"blk_"+Date.now(),archivedAt:new Date().toISOString(),exos,sets,completedSessions,sessions,blockConfig,goals,wellnessHistory,bodyWeight,athleteNotes};
      setBlockHistory([...blockHistory,archived]);
    }
    // Set new sessions from wizard
    setSessions(opts.sessions||[]);
    // Reset or keep exos
    if(!opts.exos){const newExos={};(opts.sessions||[]).forEach(s=>{newExos[s.id]=[];});setExos(newExos);}
    else{const newExos={...exos};(opts.sessions||[]).forEach(s=>{if(!newExos[s.id])newExos[s.id]=[];});setExos(newExos);}
    // Block config
    const newBc=opts.config?{...blockConfig}:{...DEF_BLOCK_CONFIG};
    newBc.blockName=opts.blockName||"";newBc.objective=opts.objective||"";newBc.totalWeeks=opts.totalWeeks||6;newBc.deloadWeek=opts.deloadWeek||0;
    setBlockConfig(newBc);
    setGoals(g=>({...g,sessionsPerWeek:opts.sessPerWeek||g.sessionsPerWeek}));
    // Always reset progress
    setSets({});setCompletedSessions({});setAthleteNotes({});
    setWellnessState(null);save(SKEYS.wellness,null).catch(()=>{});
    setWellnessHistoryState({});save(SKEYS.wellnessHistory,{}).catch(()=>{});
    setAW(1);setShowNewBlock(false);setShowBilan(false);
  };

  const applyAIEdit=(newSessions)=>{
    const merged={...exos};
    Object.entries(newSessions).forEach(([sid,exList])=>{merged[sid]=exList;});
    setExos(merged);
  };

  const saveWellness=(data)=>{
    const dataWithDate={...data,date:todayKey()};
    setWellnessState(dataWithDate);save(SKEYS.wellness,dataWithDate).catch(()=>{});
    const wh={...wellnessHistory,[todayKey()]:dataWithDate,[currentWeek]:data.score};setWellnessHistoryState(wh);save(SKEYS.wellnessHistory,wh).catch(()=>{});
    if(data.poids){const key=todayKey();const nwl={...weightLog,[key]:data.poids};setWeightLogState(nwl);save(SKEYS.weightLog,nwl).catch(()=>{});const milestone=checkMilestone(nwl,bodyWeight.current);if(milestone&&milestone>bodyWeight.current){const nm=[...weightMilestones,{date:key,kg:milestone}];setWeightMilestonesState(nm);save(SKEYS.weightMilestones,nm).catch(()=>{});const newBw={...bodyWeight,current:milestone};setBodyWeightState(newBw);save(SKEYS.bw,newBw).catch(()=>{});setMilestoneNotif(milestone);setTimeout(()=>setMilestoneNotif(null),3500);}}
    setShowWellness(false);
  };

  const allMethods=useMemo(()=>({...DEF_METHODS,...Object.fromEntries(customMethods.map(m=>[m.key,m]))}),[customMethods]);
  const tw=blockConfig.totalWeeks||6;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const isDeload=w=>blockConfig.deloadWeek&&w===blockConfig.deloadWeek;
  const currentWeek=useMemo(()=>{for(let w=1;w<=tw;w++){if((completedSessions[w]||[]).length<goals.sessionsPerWeek)return w;}return tw;},[completedSessions,goals.sessionsPerWeek,tw]);
  const totalTarget=goals.sessionsPerWeek*tw;
  const streak=useMemo(()=>{let s=0;for(let w=currentWeek-1;w>=1;w--){if((completedSessions[w]||[]).length>=goals.sessionsPerWeek)s++;else break;}return s;},[completedSessions,currentWeek,goals.sessionsPerWeek]);
  const weekAdherence=Math.round(((completedSessions[currentWeek]||[]).length/goals.sessionsPerWeek)*100);
  const motivMsg=()=>{if(isDeload(currentWeek))return{t:"Semaine deload",d:"Recuperation active.",c:C.b};if(currentWeek===tw)return{t:"Derniere semaine !",d:"Tout donner.",c:C.coach};if(streak>=3&&(wellness?.score||50)>=70)return{t:"En feu ! "+streak+" sem.",d:"Continue.",c:C.g};if((wellness?.score||50)<40)return{t:"Corps en recuperation",d:"Seance legere.",c:C.o};if(weekAdherence>=100)return{t:"Semaine "+currentWeek+" complete !",d:"Repos merite.",c:C.g};return{t:"Reste focus",d:"Chaque seance compte.",c:C.ac};};
  const msg=motivMsg();
  const prs=getAllPRs(exos);const muscSets=getMuscSets(exos,exMeta);
  const wScore=wellness?.score||50;const wReco=getReco(wScore);
  const combinedData=getCombinedData(exos,sets,wellnessHistory,tw);const totalDone=Object.values(completedSessions).flat().length;
  const activeInjuries=injuries.filter(i=>i.status!=="Guerie");

  const switchMode=m=>{setMode(m);if(m==="coach")setCoachTab("prog");else setTab("dash");};
  const autoProgressOnComplete=(sessId,completedWeek,currentExos)=>{
    const sessExos=(currentExos||exos)[sessId]||[];
    if(!sessExos.length)return;
    const tierCfgL=blockConfig?.tierConfig||DEF_TIER_CONFIG;
    const dwL=blockConfig?.deloadWeek||tw;
    const futureWeeks=weeksArr.filter(w=>w>completedWeek);
    const futureTrainWeeks=futureWeeks.filter(w=>w!==dwL);
    if(!futureWeeks.length)return;
    let changed=false;
    const newSessExos=sessExos.map(ex=>{
      const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");
      if(eType!=="muscu"&&eType!=="halterophilie")return ex;
      const doneRows=(sets[ex.id+"_"+completedWeek]||[]).filter(r=>r.done);
      if(!doneRows.length)return ex;
      const tier=getExTier(ex.name,ex);
      const tc=tierCfgL[tier]||tierCfgL[3];
      const plannedWd=ex.weeks[completedWeek]||{};
      // Compute effective performance from done rows
      const mainRows=doneRows.filter(r=>!r.type||r.type==="set");
      const refRows=mainRows.length?mainRows:doneRows;
      const kgVals=refRows.map(r=>r.kg||0).filter(v=>v>0);
      const baseKg=kgVals.length?kgVals[Math.floor(kgVals.length/2)]:(plannedWd.pdc?0:(plannedWd.kg||0));
      const basePdc=!!(plannedWd.pdc&&!baseKg);
      const repsVals=mainRows.filter(r=>r.reps>0).map(r=>r.reps);
      const baseReps=repsVals.length?Math.round(repsVals.reduce((a,b)=>a+b,0)/repsVals.length):(parseReps(plannedWd.repsRange)||10);
      const rirVals=mainRows.map(r=>r.rir).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
      const baseRir=rirVals.length?Math.round(rirVals.reduce((a,b)=>a+b,0)/rirVals.length*2)/2:(plannedWd.rir??tc.rirStart??2);
      const baseSets=mainRows.length||plannedWd.sets||3;
      const newWeeks={...ex.weeks};
      futureWeeks.forEach(w=>{
        if((completedSessions[w]||[]).includes(sessId))return;// skip already-done weeks
        const existingWd=newWeeks[w]||{};
        const preserve={coachNote:existingWd.coachNote,tempo:existingWd.tempo,method:existingWd.method,methodParams:existingWd.methodParams};
        const kgBase=basePdc?undefined:baseKg;
        if(w===dwL){
          const dlPct=tc.deloadPct||40;
          newWeeks[w]={...preserve,...(basePdc?{pdc:true}:(kgBase?{kg:Math.round(kgBase*(1-dlPct/100)/2.5)*2.5}:{})),sets:Math.max(2,Math.round(baseSets*0.6)),rir:(tc.rirStart||2)+2,repsRange:String(baseReps)};
        }else{
          const wIdx=futureTrainWeeks.indexOf(w);// 0-based among future training weeks
          const total=futureTrainWeeks.length;
          const kgStep=tc.kgStep??2.5;
          if(tc.mode==="rir"){
            const rirDrop=baseRir>=(tc.rirEnd??0)?Math.max(0,baseRir-(tc.rirEnd??0))/Math.max(1,total):0;
            const newRir=Math.max(tc.rirEnd??0,Math.round((baseRir-rirDrop*(wIdx+1))*2)/2);
            newWeeks[w]={...preserve,...(basePdc?{pdc:true}:(kgBase?{kg:roundHalf(kgBase+kgStep*(wIdx+1))}:{})),sets:baseSets,repsRange:String(baseReps),rir:newRir};
          }else if(tc.mode==="reps"){
            const repTarget=tc.repsEnd||12;
            const repGap=Math.max(0,repTarget-baseReps);
            const repStep=total?Math.ceil(repGap/total):0;
            const newReps=Math.min(repTarget,baseReps+repStep*(wIdx+1));
            const rirDrop=(baseRir-(tc.rirEnd||1))/Math.max(1,total);
            const newRir=Math.max(tc.rirEnd||1,Math.round((baseRir-rirDrop*(wIdx+1))*2)/2);
            const cycleLen=repGap+1||1;const cycleNum=Math.floor((wIdx+1)/cycleLen);
            newWeeks[w]={...preserve,...(basePdc?{pdc:true}:(kgBase?{kg:roundHalf(kgBase+kgStep*cycleNum)}:{})),sets:baseSets,repsRange:String(newReps),rir:newRir};
          }else{
            newWeeks[w]={...preserve,...(basePdc?{pdc:true}:(kgBase?{kg:roundHalf(kgBase+kgStep*(wIdx+1))}:{})),sets:baseSets,repsRange:String(baseReps),rir:tc.rir??0};
          }
        }
        changed=true;
      });
      return{...ex,weeks:newWeeks};
    });
    if(changed){
      const newExos={...(currentExos||exos),[sessId]:newSessExos};
      setExos(newExos);
      setAutoProgNotif(`Progression S${completedWeek+1}→S${tw} mise à jour`);
      setTimeout(()=>setAutoProgNotif(null),3500);
    }
  };
  const completeSession=(sessId,week)=>{const prev=completedSessions[week]||[];if(prev.includes(sessId))return;const newW=[...prev,sessId];const newC={...completedSessions,[week]:newW};setCompletedSessions(newC);autoProgressOnComplete(sessId,week);if(newW.length>=goals.sessionsPerWeek){setWeekJustCompleted(week);setTimeout(()=>{setWeekJustCompleted(null);if(week>=tw)setShowBilan(true);else setAW(week+1);},2800);}};
  const uncompleteSession=(sessId,week)=>setCompletedSessions({...completedSessions,[week]:(completedSessions[week]||[]).filter(s=>s!==sessId)});
  const[bankAddEx,setBankAddEx]=useState(null);const[bankAddMsg,setBankAddMsg]=useState('');
  const handleBankAdd=ex=>{
    if(sessions.length===0){setBankAddMsg('Crée un bloc programme d\'abord (onglet Prog)');setTimeout(()=>setBankAddMsg(''),3000);return;}
    const makeEx=sid=>({id:"g_"+Date.now(),name:ex.name,bloc:ex.bloc||"ESTH",target:ex.target||"Pecs",exType:ex.ex_type||"muscu",exercise_id:ex.id,weeks:{1:{kg:0,sets:3,repsRange:"10",rir:2}}});
    if(sessions.length===1){const sid=sessions[0].id;setExos(prev=>({...prev,[sid]:[...(prev[sid]||[]),makeEx(sid)]}));setCoachTab("prog");setBankAddMsg('Ajouté à '+sessions[0].name+' !');setTimeout(()=>setBankAddMsg(''),2500);}
    else setBankAddEx(ex);
  };
  const coachTabs=[{k:"prog",l:"Prog"},{k:"exos",l:"Exos"},{k:"banque",l:"Banque"},{k:"config",l:"Config"},{k:"stats",l:"Stats"},{k:"data",l:"Données"}];
  const athTabs=[{k:"dash",l:"Accueil"},{k:"log",l:"Seance"},{k:"stats",l:"Stats"}];
  const activeTabs=mode==="coach"?coachTabs:athTabs;const activeTab=mode==="coach"?coachTab:tab;const setActiveTab=mode==="coach"?setCoachTab:setTab;
  const tabS=t=>({flex:1,padding:"10px 0",border:"none",borderBottom:"2px solid "+(activeTab===t?(mode==="coach"?C.coach:C.ac):"transparent"),background:"transparent",color:activeTab===t?(mode==="coach"?C.coach:C.ac):C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px"});

  if(!loaded)return(<div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"system-ui"}}><div style={{width:48,height:48,borderRadius:14,background:C.acS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>~</div><div style={{fontSize:13,color:C.tx2}}>Chargement...</div></div>);

  return(<div style={{background:C.bg,minHeight:"100vh",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",color:C.tx,maxWidth:mode==="athlete"?480:"100%",margin:mode==="athlete"?"0 auto":0}}>

    {showWellness&&(<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg,overflowY:"auto"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd}}><div style={{fontSize:14,fontWeight:700}}>Wellness du jour</div><button onClick={()=>setShowWellness(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>x</button></div><WellnessFlow existing={wellness} onSave={saveWellness} sleepTarget={goals.sleepTarget} onAddInjury={addInjury}/></div>)}
    {milestoneNotif&&(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:250,background:C.s1,border:"1px solid "+C.g+"50",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}><div><div style={{fontSize:13,fontWeight:700,color:C.g}}>Nouveau palier valide !</div><div style={{fontSize:11,color:C.tx2}}>Poids mis a jour : {milestoneNotif} kg</div></div></div>)}
    {autoProgNotif&&(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:251,background:C.s1,border:"1px solid "+C.coach+"50",borderRadius:14,padding:"10px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}><span style={{fontSize:18}}>↗</span><div><div style={{fontSize:13,fontWeight:700,color:C.coach}}>Surcharge progressive mise à jour</div><div style={{fontSize:11,color:C.tx2}}>{autoProgNotif}</div></div></div>)}
    {weekJustCompleted&&(<div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{fontSize:26,fontWeight:800,color:C.g}}>Semaine {weekJustCompleted} validee !</div><div style={{fontSize:14,color:C.tx2}}>{weekJustCompleted<tw?"En route pour S"+(weekJustCompleted+1):"Bloc termine !"}</div><div style={{display:"flex",gap:6,marginTop:8}}>{[...Array(tw)].map((_,i)=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<weekJustCompleted?C.g:C.s2}}/>)}</div></div>)}
    {showBilan&&(<div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,overflowY:"auto"}}><div style={{padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}><div style={{fontSize:28,fontWeight:800,textAlign:"center"}}>Bloc termine !</div><div style={{fontSize:14,color:C.tx2}}>{totalDone} seances realisees</div><div style={{display:"flex",gap:12,width:"100%"}}>{getBig3(exos).map(({name,label,c})=>{const pr=prs[name];return(<div key={label} style={{flex:1,background:C.s1,borderRadius:14,padding:"14px 10px",textAlign:"center",border:"1px solid "+c+"30"}}><div style={{fontSize:11,color:C.tx3,marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:c}}>{pr?.est||"--"}</div><div style={{fontSize:9,color:C.tx3}}>kg est.</div></div>);})}</div><div style={{width:"100%",background:C.s1,borderRadius:14,padding:16,border:"1px solid "+C.brd}}><CombinedStatsChart data={combinedData}/></div><button onClick={()=>{setShowBilan(false);setShowNewBlock(true);}} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",background:C.coach,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button><button onClick={()=>setShowBilan(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Fermer</button></div></div>)}
    {showNewBlock&&<NewBlockModal onStart={archiveAndNewBlock} onClose={()=>setShowNewBlock(false)} hasCurrentData={sessions.length>0&&Object.values(exos).flat().length>0}/>}
    {showBlockHistory&&<BlockHistoryViewer blockHistory={blockHistory} onClose={()=>setShowBlockHistory(false)}/>}
    {mode==="coach"&&coachTab==="prog"&&sessions.length>0&&<AIChatBar exos={exos} sessions={sessions} chatHistory={chatHistory} setChatHistory={setChatHistory} onApply={applyAIEdit} onOpenChange={setAiChatOpen} C={C}/>}
    {mode==="athlete"&&(timerActive||timerFinished)&&tab!=="log"&&(<div style={{position:"fixed",bottom:64,left:"50%",transform:"translateX(-50%)",zIndex:150,background:timerFinished?"rgba(34,201,147,0.15)":C.s1,border:"1px solid "+(timerFinished?C.g:timerActive&&timerLeft<=10?C.r:C.ac)+"70",borderRadius:50,padding:"9px 18px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 24px rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}>
      {timerFinished?<span style={{fontSize:16}}>🔔</span>:<div style={{width:24,height:24,position:"relative"}}><svg viewBox="0 0 24 24" style={{width:24,height:24,transform:"rotate(-90deg)"}}><circle cx="12" cy="12" r="9" fill="none" stroke={C.s2} strokeWidth="2.5"/><circle cx="12" cy="12" r="9" fill="none" stroke={timerLeft<=10?C.r:C.ac} strokeWidth="2.5" strokeDasharray={String(2*Math.PI*9)} strokeDashoffset={String(2*Math.PI*9*(1-Math.min((timerDur-timerLeft)/timerDur,1)))} strokeLinecap="round"/></svg></div>}
      <span style={{fontSize:13,fontWeight:700,color:timerFinished?C.g:timerLeft<=10?C.r:C.tx,fontFamily:"monospace",minWidth:42}}>{timerFinished?"Repos OK !":Math.floor(timerLeft/60)+":"+String(timerLeft%60).padStart(2,"0")}</span>
      <button onClick={timerStop} style={{width:22,height:22,borderRadius:"50%",border:"none",background:(timerFinished?C.g:C.r)+"25",color:timerFinished?C.g:C.r,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
    </div>)}

    <div style={{position:"sticky",top:0,zIndex:20,background:C.bg,borderBottom:"1px solid "+C.brd}}>
      <div style={{padding:"8px "+(mode==="coach"?"40px":"16px")+" 0",display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:mode==="coach"?1400:"none",margin:mode==="coach"?"0 auto":"0"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:"-0.3px"}}>MyPrepaPro</div>
          {saveStatus&&<div style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:6,background:saveStatus==="saved"?C.gS:C.rS,color:saveStatus==="saved"?C.g:C.r}}>{saveStatus==="saved"?"OK":"Err"}</div>}
          {activeInjuries.length>0&&<div style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:6,background:C.rS,color:C.r}}>{activeInjuries.length} bless.</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {canToggleMode&&<div style={{display:"flex",background:C.s1,borderRadius:8,padding:2,border:"1px solid "+C.brdL}}>{[{k:"athlete",l:"Athlete"},{k:"coach",l:"Coach"}].map(({k,l})=>(<button key={k} onClick={()=>switchMode(k)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:mode===k?(k==="coach"?C.coach:C.ac):"transparent",color:mode===k?"#fff":C.tx3,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{l}</button>))}</div>}
          {userName&&<div style={{fontSize:11,color:C.tx3,fontWeight:500,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userName}</div>}
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href="/login";}} title="Déconnexion" style={{width:30,height:30,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>⏻</button>
        </div>
      </div>
      <div style={{display:"flex",marginTop:4,maxWidth:mode==="coach"?1400:"none",margin:mode==="coach"?"0 auto":"unset",paddingLeft:mode==="coach"?40:0}}>{activeTabs.map(t=><button key={t.k} onClick={()=>setActiveTab(t.k)} style={tabS(t.k)}>{t.l}</button>)}</div>
    </div>

    {mode==="coach"&&(<div style={{padding:"20px 40px "+(aiChatOpen?"calc(60vh + 40px)":"60px"),maxWidth:1400,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:C.coachS,border:"1px solid "+C.coach+"30",marginBottom:20}}><div style={{fontSize:13,fontWeight:700,color:C.coach}}>Mode Coach</div><div style={{fontSize:11,color:C.tx3}}>- Planification</div></div>
      {coachTab==="prog"&&<><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div><div style={{fontSize:16,fontWeight:700}}>Programme</div>{blockConfig?.blockName&&<div style={{fontSize:11,color:C.b,fontWeight:600,marginTop:2}}>{blockConfig.blockName}{blockConfig?.objective?" · "+blockConfig.objective:""} · {tw} sem.</div>}</div><button onClick={()=>setShowNewBlock(true)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid "+C.coach+"40",background:C.coachS,color:C.coach,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button></div>{sessions.length===0?(<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:4}}>Aucun bloc actif</div><div style={{fontSize:12,color:C.tx3,marginBottom:16}}>Crée un nouveau bloc pour commencer à planifier.</div><button onClick={()=>setShowNewBlock(true)} style={{padding:"12px 24px",borderRadius:12,border:"none",background:C.coach,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Créer un bloc</button></div>):<CoachProgramEditor exos={exos} setExos={setExos} sessions={sessions} setSessions={setSessions} athleteNotes={athleteNotes} allMethods={allMethods} customMethods={customMethods} setCustomMethods={setCustomMethods} blockConfig={blockConfig} exMeta={exMeta} currentWeek={currentWeek}/>}</>}
      {coachTab==="exos"&&<><div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Exercices</div><div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Muscles, hierarchie &amp; categorie</div><CoachExoParams exMeta={exMeta} setExMeta={setExMeta} exos={exos} setExos={setExos} blockConfig={blockConfig}/></>}
      {coachTab==="banque"&&<><ExerciseBank coachId={athleteId} onAddToExos={handleBankAdd}/>{bankAddMsg&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:250,background:C.g,color:"#fff",borderRadius:12,padding:"10px 20px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{bankAddMsg}</div>}</>}
      {bankAddEx&&sessions.length>1&&(<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setBankAddEx(null)}><div style={{width:"100%",maxWidth:640,background:C.s1,borderRadius:"16px 16px 0 0",padding:24}} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:6}}>Ajouter à quelle séance ?</div><div style={{fontSize:12,color:C.tx3,marginBottom:16}}>{bankAddEx.name}</div>{sessions.map(s=>(<button key={s.id} onClick={()=>{const newEx={id:"g_"+Date.now(),name:bankAddEx.name,bloc:bankAddEx.bloc||"ESTH",target:bankAddEx.target||"Pecs",exType:bankAddEx.ex_type||"muscu",exercise_id:bankAddEx.id,weeks:{1:{kg:0,sets:3,repsRange:"10",rir:2}}};setExos(prev=>({...prev,[s.id]:[...(prev[s.id]||[]),newEx]}));setBankAddEx(null);setCoachTab("prog");}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,marginBottom:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}><div style={{width:32,height:32,borderRadius:8,background:C.acS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.ac}}>{s.short||s.name.charAt(0)}</div><div style={{fontSize:13,fontWeight:600,color:C.tx}}>{s.name}</div></button>))}<button onClick={()=>setBankAddEx(null)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>Annuler</button></div></div>)}
      {coachTab==="config"&&<><div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Configuration</div><div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Objectifs athlete</div><CoachConfig goals={goals} setGoals={setGoals} bodyWeight={bodyWeight} setBodyWeight={setBodyWeight} completedSessions={completedSessions} uncompleteSession={uncompleteSession} sessions={sessions} blockConfig={blockConfig} setBlockConfig={setBlockConfig} weeksArr={weeksArr} onNewBlock={()=>setShowNewBlock(true)} onShowHistory={()=>setShowBlockHistory(true)} blockHistoryCount={blockHistory.length}/></>}
      {coachTab==="stats"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Suivi athlete</div>
        <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>{sessions.length>0?(blockConfig?.blockName||"Programme")+" · S"+currentWeek+"/"+tw:"Aucun bloc actif"}</div>

        {/* 1RM Progression */}
        <div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.brd,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Progression 1RM</div>
          {getBig3(exos).map(({name,label,c})=>{const pr=prs[name]||null;const data=get1rmByWeek(exos,name,tw);const filled=data.filter(d=>d.val!=null);const prog=filled.length>=2?filled[filled.length-1].val-filled[0].val:null;return(<div key={name} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:16,borderRadius:2,background:c}}/><span style={{fontSize:13,fontWeight:700}}>{label}</span></div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}><span style={{fontSize:18,fontWeight:800,color:c}}>{pr?.est||"--"}</span><span style={{fontSize:10,color:C.tx3}}>kg</span>{prog!=null&&<span style={{fontSize:11,fontWeight:700,color:prog>0?C.g:prog<0?C.r:C.tx3,padding:"2px 6px",borderRadius:5,background:(prog>0?C.g:prog<0?C.r:C.tx3)+"15"}}>{prog>0?"+":""}{prog}</span>}</div>
            </div>
            <MiniChart data={data} color={c} h={44}/>
          </div>);})}
        </div>

        {/* Poids de corps */}
        <div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.brd,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Poids de corps</div>
            <div style={{fontSize:13,fontWeight:800,color:C.ac}}>{bodyWeight.current} <span style={{fontSize:10,fontWeight:400,color:C.tx3}}>/ {bodyWeight.target} kg</span></div>
          </div>
          {Object.keys(weightLog).length>0?<WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target}/>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"14px 0"}}>Aucune mesure</div>}
        </div>

        {/* Séries par muscle */}
        <MuscleVolumeCard exos={exos} exMeta={exMeta} sets={sets} sessions={sessions} weeksArr={weeksArr} tw={tw}/>

        {/* Blessures */}
        {injuries.length>0?(<div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.r+"30"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Blessures ({activeInjuries.length} active{activeInjuries.length>1?"s":""})</div>
          {injuries.map(inj=>{const sc=stC(inj.status);const zn=ALL_BZ.filter(z=>inj.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee";return(<div key={inj.id} style={{padding:"8px 12px",borderRadius:8,background:C.s2,border:"1px solid "+sc+"30",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:12,fontWeight:600,color:C.tx}}>{zn}</div><div style={{fontSize:10,color:C.tx3}}>{inj.type||"Type non precise"} - Intensite {inj.intensity}/10</div></div><span style={{fontSize:10,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:5,background:sc+"15"}}>{inj.status}</span></div>);})}
        </div>):(<div style={{background:C.s1,borderRadius:14,padding:"14px",border:"1px solid "+C.g+"30",textAlign:"center"}}><span style={{fontSize:12,color:C.g,fontWeight:600}}>Aucune blessure</span></div>)}
      <WeekCalendar sessions={sessions} completedSessions={completedSessions} currentWeek={currentWeek} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} C={C}/>
      </>)}
      {coachTab==="data"&&(<DataManager
        exos={exos} setExos={setExos} sets={sets} setSets={setSets} sessions={sessions} setSessions={setSessions}
        completedSessions={completedSessions} setCompletedSessions={setCompletedSessions}
        athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes}
        blockHistory={blockHistory} setBlockHistory={setBlockHistory}
        exMeta={exMeta} setExMeta={setExMeta}
        wellness={wellness} setWellness={v=>{setWellnessState(v);save(SKEYS.wellness,v).catch(()=>{});}}
        wellnessHistory={wellnessHistory} setWellnessHistory={v=>{setWellnessHistoryState(v);save(SKEYS.wellnessHistory,v).catch(()=>{});}}
        weightLog={weightLog} setWeightLog={v=>{setWeightLogState(v);save(SKEYS.weightLog,v).catch(()=>{});}}
        injuries={injuries} setInjuries={setInjuries}
        weeksArr={weeksArr}
      />)}
    </div>)}

    {mode==="athlete"&&(<>
      {tab==="dash"&&(<div style={{padding:"16px 16px 40px"}}>
        <div style={{marginBottom:18}}><div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}>Bonjour</div>{sessions.length>0?<div style={{fontSize:12,color:C.tx2,marginTop:2}}>{blockConfig?.blockName||"Programme"} · S{currentWeek}/{tw}{isDeload(currentWeek)?" (Deload)":""}</div>:<div style={{fontSize:12,color:C.tx3,marginTop:2}}>Aucun bloc actif</div>}</div>
        {activeInjuries.length>0&&(<button onClick={()=>setTab("stats")} style={{width:"100%",background:C.rS,borderRadius:14,padding:"10px 14px",border:"1.5px solid "+C.r+"50",marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",background:C.r,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:C.r}}>{activeInjuries.length} blessure(s) en cours</div><div style={{fontSize:10,color:C.r+"90"}}>{activeInjuries.map(i=>ALL_BZ.filter(z=>i.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee").join(" | ")}</div></div><span style={{fontSize:12,color:C.r}}>&gt;</span></button>)}
        <button onClick={()=>setShowWellness(true)} style={{width:"100%",background:C.s1,borderRadius:16,padding:"14px 16px",border:"1.5px solid "+wReco.c+"35",marginBottom:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"block"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Wellness du jour</div><div style={{fontSize:10,color:C.ac,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.ac+"40",fontWeight:600}}>{wellness?"Modifier":"Remplir"} &gt;</div></div>
          {wellness?(<div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{position:"relative",width:64,height:64,flexShrink:0}}><svg viewBox="0 0 64 64" style={{width:64,height:64,transform:"rotate(-90deg)"}}><circle cx="32" cy="32" r="26" fill="none" stroke={C.s2} strokeWidth="5"/><circle cx="32" cy="32" r="26" fill="none" stroke={wReco.c} strokeWidth="5" strokeDasharray={String(2*Math.PI*26)} strokeDashoffset={String(2*Math.PI*26*(1-wScore/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:wReco.c}}>{wScore}</div></div>
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:wReco.c,marginBottom:4}}>{wReco.label}</div><div style={{fontSize:11,color:C.tx2}}>{wReco.desc}</div>
              <div style={{display:"flex",gap:8,marginTop:8}}>{WELL_ITEMS.map(it=>{const v=wellness[it.k];const vc=it.inv?(v>=4?C.r:v<=2?C.g:C.o):(v>=4?C.g:v<=2?C.r:C.o);return(<div key={it.k} style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:vc}}>{v}</div><div style={{fontSize:8,color:C.tx3}}>{it.k.slice(0,4)}</div></div>);})}{wellness.sleepDur&&<div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.b}}>{wellness.sleepDur}h</div><div style={{fontSize:8,color:C.tx3}}>som.</div></div>}{wellness.poids&&<div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.ac}}>{wellness.poids}</div><div style={{fontSize:8,color:C.tx3}}>kg</div></div>}</div>
              {wellness.domsZones?.length>0&&<div style={{display:"flex",gap:3,marginTop:6,flexWrap:"wrap"}}>{wellness.domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.o+"20",color:C.o}}>{z.label}</span>:null;})}</div>}
            </div>
          </div>):<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"10px 0"}}>Appuyez pour remplir le bilan</div>}
        </button>
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1.5px solid "+msg.c+"30",marginBottom:12}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Motivation</div><div style={{padding:"4px 10px",borderRadius:8,background:msg.c+"18",color:msg.c,fontSize:11,fontWeight:700}}>{msg.t}</div></div><div style={{display:"flex",gap:8,marginBottom:12}}><div style={{flex:1,background:C.s2,borderRadius:10,padding:"10px 0",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,marginBottom:4}}>Streak</div><div style={{fontSize:24,fontWeight:800,color:streak>0?C.o:C.tx3}}>{streak}</div><div style={{fontSize:8,color:C.tx3}}>sem.</div></div><div style={{flex:1,background:C.s2,borderRadius:10,padding:"10px 0",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,marginBottom:4}}>S{currentWeek}</div><div style={{fontSize:24,fontWeight:800,color:weekAdherence>=100?C.g:C.ac}}>{(completedSessions[currentWeek]||[]).length}/{goals.sessionsPerWeek}</div><div style={{fontSize:8,color:C.tx3}}>seances</div></div><div style={{flex:1,background:C.s2,borderRadius:10,padding:"10px 0",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,marginBottom:4}}>Bloc</div><div style={{fontSize:24,fontWeight:800,color:C.b}}>{Math.round((totalDone/totalTarget)*100)}%</div><div style={{fontSize:8,color:C.tx3}}>complete</div></div></div>
        {(()=>{
          const todayDow=(new Date().getDay()+6)%7;
          const normDay=v=>!v?[]:Array.isArray(v)?v:[v];
          const todayIds=normDay((weekSchedule||{})[todayDow]);
          const doneNow=completedSessions[currentWeek]||[];
          const todaySessions=todayIds.map(id=>sessions.find(s=>s.id===id)).filter(Boolean).filter(s=>(exos[s.id]||[]).length>0);
          const todayNotDone=todaySessions.filter(s=>!doneNow.includes(s.id));
          const todayAllDone=todaySessions.length>0&&todayNotDone.length===0;
          if(todayAllDone){
            const nextSess=sessions.find(s=>!doneNow.includes(s.id)&&(exos[s.id]||[]).length>0);
            return(<div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{padding:"10px 14px",borderRadius:10,background:C.gS,border:"1px solid "+C.g+"40",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>✓</span><div style={{fontSize:12,fontWeight:700,color:C.g}}>Séance du jour effectuée !</div></div>
              {nextSess&&(<button onClick={()=>{setInitialLogSess(nextSess);setTab("log");}} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",background:C.acS,color:C.ac,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><div><div style={{fontSize:11,fontWeight:700}}>Prochaine séance</div><div style={{fontSize:10,color:C.tx2}}>{nextSess.short} - {nextSess.name}</div></div><span style={{marginLeft:"auto",fontSize:14}}>&gt;</span></button>)}
            </div>);
          }
          if(todayNotDone.length>0){
            const s=todayNotDone[0];
            return(<button onClick={()=>{setInitialLogSess(s);setTab("log");}} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",background:C.coachS,color:C.coach,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
              <div><div style={{fontSize:11,fontWeight:700,color:C.coach}}>Séance du jour</div><div style={{fontSize:10,color:C.tx2}}>{s.short} - {s.name}</div>{todayNotDone.length>1&&<div style={{fontSize:9,color:C.tx3,marginTop:2}}>+{todayNotDone.length-1} autre(s) aujourd'hui</div>}</div>
              <span style={{marginLeft:"auto",fontSize:14}}>&gt;</span>
            </button>);
          }
          const nextSess=sessions.find(s=>!doneNow.includes(s.id)&&(exos[s.id]||[]).length>0);
          if(!nextSess)return(<div style={{padding:"10px",borderRadius:10,background:C.gS,color:C.g,fontSize:11,fontWeight:600,textAlign:"center"}}>Semaine {currentWeek} complete !</div>);
          return(<button onClick={()=>{setInitialLogSess(nextSess);setTab("log");}} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",background:C.acS,color:C.ac,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><div><div style={{fontSize:11,fontWeight:700}}>Prochaine séance</div><div style={{fontSize:10,color:C.tx2}}>{nextSess.short} - {nextSess.name}</div></div><span style={{marginLeft:"auto",fontSize:14}}>&gt;</span></button>);
        })()}
        </div>
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Records 1RM</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{[{label:"Squat",name:"Back squat",c:C.b},{label:"Bench",name:"Dev. couche barre",c:C.r},{label:"Traction",name:"Traction lestee",c:C.g}].map(({label,name,c})=>{const pr=prs[name]||null;return(<div key={label} style={{background:C.s2,borderRadius:12,padding:"12px 10px",textAlign:"center",border:"1px solid "+c+"20"}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,marginBottom:6}}>{label}</div>{pr?(<><div style={{fontSize:22,fontWeight:800,color:c,letterSpacing:"-1px",lineHeight:1}}>{pr.est}</div><div style={{fontSize:9,color:C.tx3,marginTop:2}}>kg est.</div><div style={{fontSize:9,color:C.tx3,marginTop:4,padding:"2px 6px",borderRadius:4,background:C.s1,display:"inline-block"}}>S{pr.week}</div></>):<div style={{fontSize:11,color:C.tx3,marginTop:4}}>--</div>}</div>);})}</div></div>
        <WeekCalendar sessions={sessions} completedSessions={completedSessions} currentWeek={currentWeek} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} C={C}/>
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Objectifs</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div style={{background:C.s2,borderRadius:12,padding:"14px 12px"}}><div style={{fontSize:10,color:C.tx3,marginBottom:8}}>Seances realisees</div><div style={{display:"flex",alignItems:"baseline",gap:3,marginBottom:8}}><span style={{fontSize:26,fontWeight:800,color:C.g,letterSpacing:"-1px"}}>{totalDone}</span><span style={{fontSize:14,color:C.tx3}}>/{totalTarget}</span></div><div style={{height:5,background:C.s1,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min((totalDone/totalTarget)*100,100)+"%",background:C.g,borderRadius:3}}/></div><div style={{fontSize:9,color:C.tx3,marginTop:5}}>{Math.max(0,totalTarget-totalDone)} restantes</div></div><div style={{background:C.s2,borderRadius:12,padding:"14px 12px"}}><div style={{fontSize:10,color:C.tx3,marginBottom:8}}>Poids de corps</div><div style={{display:"flex",alignItems:"baseline",gap:3,marginBottom:8}}><span style={{fontSize:26,fontWeight:800,color:C.ac,letterSpacing:"-1px"}}>{bodyWeight.current}</span><span style={{fontSize:14,color:C.tx3}}>/{bodyWeight.target} kg</span></div><div style={{height:5,background:C.s1,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min((bodyWeight.current/bodyWeight.target)*100,100)+"%",background:C.ac,borderRadius:3}}/></div><div style={{fontSize:9,color:C.tx3,marginTop:5}}>Objectif: {bodyWeight.target} kg</div></div></div></div>
      </div>)}

      {tab==="log"&&<LogView exos={exos} sets={sets} updSets={updSets} completedSessions={completedSessions} completeSession={completeSession} uncompleteSession={uncompleteSession} goals={goals} currentWeek={currentWeek} allMethods={allMethods} athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes} sessions={sessions} blockConfig={blockConfig} initialSess={initialLogSess} timerLeft={timerLeft} timerDur={timerDur} timerActive={timerActive} timerFinished={timerFinished} onTimerSetDur={timerSetDur} onTimerStart={timerStart} onTimerStop={timerStop}/>}

      {tab==="stats"&&(()=>{
        const filteredLog=(()=>{if(weightRange==="all")return weightLog;const entries=Object.entries(weightLog).sort((a,b)=>a[0]<b[0]?-1:1);if(weightRange==="3m"){const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-3);const key=String(cutoff.getFullYear())+String(cutoff.getMonth()+1).padStart(2,"0")+String(cutoff.getDate()).padStart(2,"0");return Object.fromEntries(entries.filter(([k])=>k>=key));}return Object.fromEntries(entries.slice(-tw*2));})();
        return(<div style={{padding:"16px 16px 40px"}}>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.5px",marginBottom:16}}>Mon bilan</div>

        {/* 1RM Progression */}
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Progression 1RM</div>
          {getBig3(exos).map(({label,name,c})=>{const pr=prs[name]||null;const data=get1rmByWeek(exos,name,tw);const filled=data.filter(d=>d.val!=null);const prog=filled.length>=2?filled[filled.length-1].val-filled[0].val:null;return(<div key={name} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:3,height:18,borderRadius:2,background:c}}/>
                <span style={{fontSize:13,fontWeight:700}}>{label}</span>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontSize:20,fontWeight:800,color:c}}>{pr?.est||"--"}</span>
                <span style={{fontSize:10,color:C.tx3}}>kg</span>
                {prog!=null&&<span style={{fontSize:12,fontWeight:700,color:prog>0?C.g:prog<0?C.r:C.tx3,padding:"2px 6px",borderRadius:5,background:(prog>0?C.g:prog<0?C.r:C.tx3)+"15"}}>{prog>0?"+":""}{prog}</span>}
              </div>
            </div>
            <MiniChart data={data} color={c} h={44}/>
          </div>);})}
        </div>

        {/* Volume hebdomadaire */}
        <WeeklyVolumeCard exos={exos} sets={sets} sessions={sessions} weeksArr={weeksArr} tw={tw} C={C}/>

        {/* Poids de corps avec filtre */}
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Poids de corps</div>
            <div style={{fontSize:13,fontWeight:800,color:C.ac}}>{bodyWeight.current} <span style={{fontSize:10,fontWeight:400,color:C.tx3}}>/ {bodyWeight.target} kg</span></div>
          </div>
          <div style={{display:"flex",gap:4,marginBottom:10}}>{[{k:"bloc",l:"Ce bloc"},{k:"3m",l:"3 mois"},{k:"all",l:"Tout"}].map(t=><button key={t.k} onClick={()=>setWeightRange(t.k)} style={{padding:"4px 10px",borderRadius:6,border:"none",background:weightRange===t.k?C.acS:"transparent",color:weightRange===t.k?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>)}</div>
          {Object.keys(filteredLog).length>0?<WeightChart log={filteredLog} milestones={weightMilestones} target={bodyWeight.target}/>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"16px 0"}}>Remplis le wellness pour suivre ton poids</div>}
        </div>

        {/* Forme du jour */}
        <div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+(wReco.c||C.brd)+"30",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Forme du jour</div>
            <button onClick={()=>setShowWellness(true)} style={{fontSize:10,color:C.ac,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.ac+"40",background:"transparent",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{wellness?"Modifier":"Remplir"}</button>
          </div>
          {wellness?(<div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{position:"relative",width:56,height:56,flexShrink:0}}><svg viewBox="0 0 56 56" style={{width:56,height:56,transform:"rotate(-90deg)"}}><circle cx="28" cy="28" r="22" fill="none" stroke={C.s2} strokeWidth="4"/><circle cx="28" cy="28" r="22" fill="none" stroke={wReco.c} strokeWidth="4" strokeDasharray={String(2*Math.PI*22)} strokeDashoffset={String(2*Math.PI*22*(1-wScore/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:wReco.c}}>{wScore}</div></div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:wReco.c,marginBottom:2}}>{wReco.label}</div>
              <div style={{fontSize:11,color:C.tx2}}>{wReco.desc}</div>
              {wellness.sleepDur&&<div style={{fontSize:10,color:C.b,marginTop:4,fontWeight:600}}>Sommeil : {wellness.sleepDur}h</div>}
            </div>
          </div>):(<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"10px 0"}}>Pas encore rempli aujourd'hui</div>)}
        </div>

        {/* Historique sante */}
        {(()=>{const wData=getWellnessChartData(wellnessHistory,wellnessPeriod);const hasSomeData=wData.some(d=>d.score!==null);return(<div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:12}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Score de santé</div><div style={{display:"flex",gap:3}}>{[{k:"week",l:"7j"},{k:"month",l:"30j"},{k:"year",l:"12m"}].map(t=>(<button key={t.k} onClick={()=>setWellnessPeriod(t.k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:wellnessPeriod===t.k?C.acS:"transparent",color:wellnessPeriod===t.k?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>))}</div></div>{hasSomeData?(<div><div style={{display:"flex",gap:12,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:3,borderRadius:2,background:C.g}}/><span style={{fontSize:9,color:C.tx3}}>Forme /100</span></div><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:C.b,opacity:0.5}}/><span style={{fontSize:9,color:C.tx3}}>Sommeil (h)</span></div></div><ResponsiveContainer width="100%" height={110}><ComposedChart data={wData} margin={{top:4,right:4,bottom:0,left:-28}}><XAxis dataKey="label" tick={{fontSize:9,fill:C.tx3}} tickLine={false} axisLine={false}/><YAxis yAxisId="score" domain={[0,100]} hide/><YAxis yAxisId="sleep" orientation="right" domain={[0,12]} hide/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const sc=payload.find(p=>p.dataKey==='score');const sl=payload.find(p=>p.dataKey==='sleep');return(<div style={{background:C.s1,border:"1px solid "+C.brdL,borderRadius:8,padding:"6px 10px",fontSize:10}}><div style={{color:C.tx3,marginBottom:4}}>{label}</div>{sc?.value!=null&&<div style={{color:getReco(sc.value).c,fontWeight:700}}>Forme : {sc.value}</div>}{sl?.value!=null&&<div style={{color:C.b}}>Sommeil : {sl.value}h</div>}</div>);}}/><Bar yAxisId="sleep" dataKey="sleep" fill={C.b} opacity={0.3} radius={[3,3,0,0]} maxBarSize={20}/><Line yAxisId="score" dataKey="score" stroke={C.g} strokeWidth={2} dot={(props)=>{if(props.value==null)return<g/>;const rc=getReco(props.value);return<circle cx={props.cx} cy={props.cy} r={3.5} fill={rc.c} stroke={C.bg} strokeWidth={1}/>;}} connectNulls={false}/></ComposedChart></ResponsiveContainer></div>):(<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"16px 0"}}>Aucune donnée wellness pour cette période</div>)}</div>);})()}

        {/* Blessures actives */}
        {activeInjuries.length>0&&(<div style={{background:C.s1,borderRadius:16,padding:"14px 16px",border:"1px solid "+C.r+"30",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Blessures actives ({activeInjuries.length})</div>
          {activeInjuries.map(inj=>{const sc=stC(inj.status);const zn=ALL_BZ.filter(z=>inj.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee";return(<div key={inj.id} style={{padding:"8px 12px",borderRadius:8,background:C.s2,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:12,fontWeight:600,color:C.tx}}>{zn}</div><div style={{fontSize:10,color:C.tx3}}>Intensite {inj.intensity}/10</div></div><span style={{fontSize:10,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:5,background:sc+"15"}}>{inj.status}</span></div>);})}
        </div>)}
      </div>);})()}

    </>)}

  </div>);
}