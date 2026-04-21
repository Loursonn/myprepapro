import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getNutritionStrategy } from "@/lib/nutrition";
import NutritionView from "@/components/athlete/NutritionView";
import EnergySessionLog from "@/components/athlete/EnergySessionLog";
import PerformanceProfile from "@/components/athlete/PerformanceProfile";
import TestSessionView from "@/components/TestSessionView";
import CoachPerfNotification from "@/components/coach/CoachPerfNotification";
import EnergyExerciseBank from "@/components/coach/EnergyExerciseBank";
import EnergySessionEditor from "@/components/coach/EnergySessionEditor";
import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";

const C={bg:"#08090C",s1:"#111318",s2:"#181B24",brd:"rgba(255,255,255,0.04)",brdL:"rgba(255,255,255,0.08)",tx:"#F2F2F4",tx2:"#9194A0",tx3:"#555866",ac:"#7B6FFF",acS:"rgba(123,111,255,0.12)",g:"#22C993",gS:"rgba(34,201,147,0.1)",o:"#F5A623",oS:"rgba(245,166,35,0.1)",y:"#E8C93A",yS:"rgba(232,201,58,0.1)",r:"#EF4B4B",rS:"rgba(239,75,75,0.1)",b:"#3B8DF0",bS:"rgba(59,141,240,0.1)",coach:"#D4538E",coachS:"rgba(212,83,142,0.12)"};
const BT={PERF:{c:"#EF4B4B",l:"Mvt principal"},ESTH:{c:"#7B6FFF",l:"Hypertrophie"},BESOIN:{c:"#F5A623",l:"Besoin indiv."},ASSOC:{c:"#22C993",l:"Muscles assoc."},CORE:{c:"#9194A0",l:"Core"}};
const BLOC_COLORS=["#EF4B4B","#7B6FFF","#F5A623","#22C993","#9194A0","#3B8DF0","#D4538E","#C060D0","#E06030","#22C9C9"];
const HABIT_COLORS=['#F5A623','#22C993','#7B6FFF','#3B8DF0','#EF4B4B','#E8C93A','#D4538E','#C060D0'];
const HABIT_EMOJIS=['💪','🏃','🧘','💧','📖','🛌','🥗','🎯','⚡','🔥','❤️','🎵','✍️','🏋️','🚴','🌅','🍎','💊','🧠','🎾','⛷️','🏊','🚶','🌿','☀️','🌙','🧹','🧴'];
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
const normForMatch=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const fuzzyExMatch=(a,b)=>{const na=normForMatch(a),nb=normForMatch(b);if(na===nb)return true;const wa=na.split(' ').filter(Boolean),wb=nb.split(' ').filter(Boolean);const[sh,lg]=wa.length<=wb.length?[wa,wb]:[wb,wa];return sh.length>0&&sh.every(sw=>lg.some(lw=>lw.startsWith(sw)||sw.startsWith(lw)));}
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
const hISO=d=>(d||new Date()).toISOString().slice(0,10);
const hAddDays=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
const calcHabitStreak=logs=>{const today=new Date();const todayISO=hISO(today);const todayDone=logs.includes(todayISO);const base=todayDone?0:1;let s=0;for(let i=base;i<365;i++){if(logs.includes(hISO(hAddDays(today,-i))))s++;else break;}return s;};
const streakMsg=s=>{if(s===0)return"🧊 Fais le aujourd'hui au moins";if(s===1)return"1er jour, garde la pêche 🍑";if(s<=2)return`🔥 ${s} jours d'affilée`;if(s<=4)return`🔥🔥 ${s} jours d'affilée`;if(s<=9)return`🔥🔥🔥 ${s} jours d'affilée`;if(s<=29)return`🔥🔥🔥🔥 ${s} jours d'affilée`;if(s<365)return`🔥🔥🔥🔥🔥 ${s} jours d'affilée`;const y=Math.floor(s/365),d=s%365;return`🏆🔥 ${y} an${y>1?'s':''} et ${d} jours d'affilée !`;};
const getHabitWeekDays=()=>{const today=new Date();return Array.from({length:7},(_,i)=>hAddDays(today,i-6));};
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

const DEF_METHODS={myoreps:{label:"Myoreps",c:"#7B6FFF",e:"MR"},dropset:{label:"Dropset",c:"#F5A623",e:"DS"},restpause:{label:"Rest-pause",c:"#EF4B4B",e:"RP"},cluster:{label:"Cluster",c:"#C060D0",e:"CL"},superset:{label:"Superset",c:"#22C993",e:"SS"},amrap:{label:"AMRAP",c:"#3B8DF0",e:"AM"},excentrique:{label:"Excentrique",c:"#D4538E",e:"EX"},isometrique:{label:"Isometrique",c:"#9194A0",e:"ISO"}};
const MDEF={dropset:{drops:3,pct:20},myoreps:{activation:12,minisets:4,reps_mini:5,pause:5},restpause:{rounds:3,pause:15},cluster:{clusters:3,reps:[2,2,2],pause:10},superset:{paired:null},amrap:{type:"failure",duration:30},excentrique:{eccentric_sec:4},isometrique:{hold_sec:30,positions:2}};
const clusterReps=p=>p.reps||Array.from({length:p.clusters||3},()=>p.reps_per_cluster||2);
const fmtMR=(method,mp,sets,repsRange)=>{if(!method||method==="excentrique"||method==="superset")return sets+"x"+(repsRange||"?");if(method==="cluster")return sets+"×("+clusterReps(mp||{}).join("+")+")";if(method==="dropset")return sets+"x"+(repsRange||"?")+" DS×"+(mp?.drops||2)+" -"+(mp?.pct||20)+"%";if(method==="myoreps")return sets+" | "+(mp?.activation||12)+"+"+(mp?.minisets||4)+"×"+(mp?.reps_mini||5);if(method==="restpause")return sets+"x"+(repsRange||"?")+" RP×"+(mp?.rounds||3);if(method==="amrap")return sets+" AMRAP";if(method==="isometrique")return sets+"×"+(mp?.positions||2)+"×"+(mp?.hold_sec||30)+"s";return sets+"x"+(repsRange||"?");};

const generateRows=(planned,method,mp)=>{
  const sets=planned?.sets||3,kg=planned?.kg||0,reps=parseReps(planned?.repsRange)||0,rir=planned?.rir??2;
  const p=mp||MDEF[method]||{};
  if(!method||method==="excentrique")return Array.from({length:sets},()=>({type:"set",kg,reps,rir,done:false}));
  if(method==="dropset"){const rows=[];for(let s=0;s<sets;s++){rows.push({type:"set",setIdx:s+1,kg,reps,rir,done:false});for(let d=0;d<(p.drops||2);d++){const dkg=p.dropWeights?.[d]??Math.round(kg*Math.pow(1-(p.pct||20)/100,d+1)/2.5)*2.5;rows.push({type:"drop",setIdx:s+1,dropIdx:d+1,kg:dkg,reps,done:false});}}return rows;}
  if(method==="myoreps"){const rows=[{type:"activation",kg,reps:p.activation||12,rir,done:false}];for(let m=0;m<(p.minisets||4);m++)rows.push({type:"mini",idx:m+1,kg,reps:p.reps_mini||5,done:false,pauseSec:p.pause||5});return rows;}
  if(method==="restpause")return Array.from({length:p.rounds||3},(_,i)=>({type:"round",idx:i+1,kg,reps,rir,done:false,pauseSec:p.pause||15}));
  if(method==="cluster"){const rows=[];const nCl=p.clusters||3;const ps=p.pause||10;const ra=clusterReps(p);for(let s=0;s<sets;s++){for(let c=0;c<nCl;c++){rows.push({type:"cluster",setIdx:s+1,clusterIdx:c+1,totalClusters:nCl,kg,reps:ra[c]||2,rir,done:false,pauseSec:ps,isLast:c===nCl-1});}}return rows;}
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
const DEF_BLOCK_CONFIG={totalWeeks:6,deloadWeek:6,progressionPct:2.5,progressionType:"linear",deloadPct:40,tierConfig:DEF_TIER_CONFIG,startDate:null};
const SKEYS={exos:"asp:exos",exMeta:"asp:exMeta",sets:"asp:sets",wellness:"asp:wellness",wellnessHistory:"asp:wh",bw:"asp:bw",completed:"asp:completed",goals:"asp:goals",anotes:"asp:anotes",custMethods:"asp:custmethods",weightLog:"asp:wlog",weightMilestones:"asp:wmile",injuries:"asp:injuries",sessions:"asp:sessions",blockConfig:"asp:blockConfig",blockHistory:"asp:blockHistory",weekSchedule:"asp:weekschedule",sessionLogs:"asp:sessionlogs",freeSessions:"asp:freesess"};
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

function RIRPicker({value,onChange}){
  const[open,setOpen]=useState(false);const ref=useRef(null);const c=rC(value);
  useEffect(()=>{if(!open)return;const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[open]);
  return(<div ref={ref} style={{position:'relative',width:44}}>
    <button onClick={()=>setOpen(v=>!v)} style={{width:44,height:28,borderRadius:7,border:'1.5px solid '+c+'60',background:c+'20',color:c,fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'monospace',lineHeight:1}}>
      {rL(value)}
    </button>
    {open&&(<div style={{position:'absolute',bottom:'calc(100% + 4px)',left:'50%',transform:'translateX(-50%)',zIndex:200,background:C.s1,border:'1px solid '+C.brdL,borderRadius:10,padding:5,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',minWidth:148}}>
      {RIR_OPTS.map(v=>{const vc=rC(v);const sel=value===v;return(<button key={v} onClick={()=>{onChange(v);setOpen(false);}} style={{padding:'6px 2px',borderRadius:6,border:'1.5px solid '+(sel?vc:C.brdL),background:sel?vc+'25':'transparent',color:sel?vc:C.tx2,fontSize:11,fontWeight:sel?800:500,cursor:'pointer',fontFamily:'monospace'}}>{rL(v)}</button>);})}
    </div>)}
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

function WellnessFlow({existing,onSave,sleepTarget,onAddInjury,weightLog}){
  const tgt=sleepTarget||8;
  const S_DOMS_ZONES=WELL_ITEMS.length; // 5 - shown if doms <= 3 (DOMS significant)
  const S_INJURY=6;const S_SLEEP=7;const S_WEIGHT=8;const S_BILAN=9;
  const[step,setStep]=useState(0);
  const[vals,setVals]=useState({fatigue:existing?.fatigue||3,sommeil:existing?.sommeil||3,stress:existing?.stress||3,energie:existing?.energie||3,doms:existing?.doms||5});
  const[domsZones,setDomsZones]=useState(existing?.domsZones||[]);
  const[coucher,setCoucher]=useState(existing?.coucher||{h:23,m:0});
  const[reveil,setReveil]=useState(existing?.reveil||{h:7,m:0});
  const[poids,setPoids]=useState(existing?.poids||"");
  const[sleepInterrupt,setSleepInterrupt]=useState(existing?.sleepInterrupt??null);
  const[sleepInterruptNote,setSleepInterruptNote]=useState(existing?.sleepInterruptNote||"");
  const prevPoids=(()=>{if(!weightLog)return null;const d=new Date();d.setDate(d.getDate()-1);const k=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");return weightLog[k]||null;})();
  const[injOui,setInjOui]=useState(null);
  const[injComment,setInjComment]=useState(existing?.injComment||"");
  const score=calcScore(vals);const reco=getReco(score);const alerts=getAlerts(vals);
  const sleepDur=()=>{const rM=reveil.h*60+reveil.m,cM=coucher.h*60+coucher.m;return Math.round((rM<=cM?rM+1440-cM:rM-cM)/60*10)/10;};
  const dur=sleepDur();const diff=Math.round((dur-tgt)*10)/10;const sleepC=Math.abs(diff)<=0.5?C.g:Math.abs(diff)<=1.5?C.o:C.r;
  const togDoms=id=>setDomsZones(p=>p.includes(id)?p.filter(z=>z!==id):[...p,id]);
  const progPct=Math.round((Math.min(step,S_BILAN)/S_BILAN)*100);
  const bSm={width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:16,cursor:"pointer",fontFamily:"inherit"};
  const goBack=()=>{
    if(step===0)return;
    if(step<WELL_ITEMS.length){setStep(step-1);return;}
    if(step===S_DOMS_ZONES){setStep(WELL_ITEMS.length-1);return;}
    if(step===S_INJURY){setStep(vals.doms<=3?S_DOMS_ZONES:WELL_ITEMS.length-1);return;}
    if(step===S_SLEEP){setStep(S_INJURY);return;}
    if(step===S_WEIGHT){setStep(S_SLEEP);return;}
    if(step===S_BILAN){setStep(S_WEIGHT);return;}
  };
  const progBar=(<div style={{marginBottom:24}}>
    {step>0&&<button onClick={goBack} style={{background:'none',border:'none',color:C.tx3,fontSize:20,cursor:'pointer',fontFamily:'inherit',padding:'0 0 10px',display:'flex',alignItems:'center',gap:4,lineHeight:1}}>← <span style={{fontSize:11,color:C.tx3}}>Retour</span></button>}
    <div style={{height:3,background:C.s2,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:progPct+"%",background:C.ac,borderRadius:2,transition:"width 0.3s"}}/></div>
  </div>);
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
      <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:4}}>Es-tu blessé/malade ?</div>
      <div style={{fontSize:12,color:C.tx3,marginBottom:20}}>Douleur, maladie ou gêne différente des courbatures</div>
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
      <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid "+C.brd}}>
        <div style={{fontSize:13,fontWeight:700,color:C.tx2,marginBottom:10}}>Avez-vous été réveillé cette nuit ?</div>
        <div style={{display:"flex",gap:10,marginBottom:sleepInterrupt===true?12:0}}>
          <button onClick={()=>setSleepInterrupt(true)} style={{flex:1,padding:"12px 0",borderRadius:10,border:"2px solid "+(sleepInterrupt===true?C.o:C.brdL),background:sleepInterrupt===true?C.oS:"transparent",color:sleepInterrupt===true?C.o:C.tx2,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Oui</button>
          <button onClick={()=>{setSleepInterrupt(false);setSleepInterruptNote("");}} style={{flex:1,padding:"12px 0",borderRadius:10,border:"2px solid "+(sleepInterrupt===false?C.g:C.brdL),background:sleepInterrupt===false?C.gS:"transparent",color:sleepInterrupt===false?C.g:C.tx2,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Non</button>
        </div>
        {sleepInterrupt===true&&(<textarea value={sleepInterruptNote} onChange={e=>setSleepInterruptNote(e.target.value)} placeholder="Durée, raison... (ex: bruit, bébé — ~45 min)" rows={2} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid "+C.o+"50",background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",outline:"none",boxSizing:"border-box",marginTop:8}}/>)}
      </div>
      <button onClick={()=>setStep(S_WEIGHT)} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:16}}>Suivant</button>
    </div>);
  }

  // Weight
  if(step===S_WEIGHT){
    return(<div style={{padding:"20px 20px 40px"}}>{progBar}
      <div style={{fontSize:13,fontWeight:600,color:C.tx2,textTransform:"uppercase",marginBottom:8}}>Poids</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>A jeun</div>
      <div style={{display:"flex",gap:8,marginBottom:24,alignItems:"center"}}>
        <button onClick={()=>setPoids(p=>Math.max(40,+(+p-0.5).toFixed(1)))} style={{width:48,height:48,borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>-</button>
        <input type="number" step="0.1" value={poids} onChange={e=>setPoids(e.target.value)} placeholder={prevPoids?String(prevPoids):"82.5"} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:24,fontWeight:800,fontFamily:"inherit",textAlign:"center"}}/>
        <span style={{fontSize:14,color:C.tx3}}>kg</span>
        <button onClick={()=>setPoids(p=>+(+p+0.5).toFixed(1))} style={{width:48,height:48,borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>+</button>
      </div>
      {prevPoids&&!poids&&<div style={{textAlign:"center",fontSize:12,color:C.tx3,marginTop:-16,marginBottom:16}}>Hier : {prevPoids} kg</div>}
      <button onClick={()=>{setPoids("");setStep(S_BILAN);}} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>Pas de pesée</button>
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
    {sleepInterrupt===true&&sleepInterruptNote&&(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:8,background:C.o+"10",border:"1px solid "+C.o+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.o,textTransform:"uppercase",marginBottom:4}}>Réveil nocturne</div><div style={{fontSize:11,color:C.o,lineHeight:1.5}}>{sleepInterruptNote}</div></div>)}
    <button onClick={()=>onSave({...vals,domsZones,coucher,reveil,sleepDur:dur,poids:+poids||null,score,injComment:injOui?injComment:null,sleepInterrupt:sleepInterrupt??null,sleepInterruptNote:sleepInterrupt?sleepInterruptNote||null:null})} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.g,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sauvegarder</button>
  </div>);
}

function SmartSetEditor({planned,storeKey,sessionSets,updateSets,athleteNotes,setAthleteNotes,method,methodParams,allMethods,exosMap,viewOnly=false,onTimerStart=null,postSession=false}){
  const initRows=()=>generateRows(planned,method,methodParams);
  const rows=(()=>{const stored=sessionSets[storeKey];if(!stored||!stored.length)return initRows();const specialType={cluster:"cluster",myoreps:"activation",restpause:"round",amrap:"amrap",isometrique:"iso",dropset:"drop"}[method||""];if(specialType&&!stored.some(r=>r.type===specialType))return initRows();if(!specialType&&stored.some(r=>r.type!=="set"))return initRows();return stored;})();
  const upd=(i,f,v)=>updateSets(storeKey,rows.map((r,j)=>j===i?{...r,[f]:v}:r));
  const updR=(i,patch)=>updateSets(storeKey,rows.map((r,j)=>j===i?{...r,...patch}:r));
  const done=rows.filter(r=>r.done||r.skipped).length;const note=athleteNotes?.[storeKey]||"";
  const iS={background:C.s1,color:C.tx,border:"1px solid "+C.brdL,fontFamily:"inherit",fontSize:14,fontWeight:700,textAlign:"center",borderRadius:6,padding:"5px 2px",width:"100%"};
  const pairedExName=method==="superset"&&methodParams?.paired?exosMap?.[methodParams.paired]:"";
  const rowLabel=r=>{if(r.type==="drop")return"Drop "+r.dropIdx;if(r.type==="activation")return"Activ.";if(r.type==="mini")return"Mini "+r.idx;if(r.type==="round")return"Rd "+r.idx;if(r.type==="amrap")return"AMRAP";if(r.type==="iso")return"Pos."+r.idx;if(r.type==="cluster")return"S"+r.setIdx+" C"+r.clusterIdx;return r.setIdx?"Set "+r.setIdx:"Set";};
  const rowC=r=>{if(r.type==="drop")return C.o;if(r.type==="activation")return C.g;if(r.type==="mini")return C.ac+"80";if(r.type==="round")return C.r;if(r.type==="amrap")return C.b;if(r.type==="iso")return C.tx2;if(r.type==="cluster")return"#C060D0";return C.tx3;};
  return(<div>
    {method==="excentrique"&&methodParams?.eccentric_sec&&<div style={{padding:"6px 10px",borderRadius:7,background:C.coach+"12",border:"1px solid "+C.coach+"30",marginBottom:10,fontSize:11,color:C.coach}}>Phase negative: {methodParams.eccentric_sec}s par rep</div>}
    {method==="superset"&&pairedExName&&<div style={{padding:"6px 10px",borderRadius:7,background:C.g+"12",border:"1px solid "+C.g+"30",marginBottom:10,fontSize:11,color:C.g}}>Superset avec: {pairedExName}</div>}
    {planned?.repsRange&&<div style={{padding:"6px 10px",borderRadius:7,background:C.acS,border:"1px solid "+C.ac+"30",marginBottom:10,fontSize:11,color:C.ac}}>Cible: {planned.repsRange} reps</div>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{flex:1,height:3,background:C.s2,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:(rows.length?(done/rows.length)*100:0)+"%",background:C.g,borderRadius:2,transition:"width 0.3s"}}/></div><span style={{fontSize:10,color:done===rows.length&&rows.length>0?C.g:C.tx3,fontWeight:600}}>{done}/{rows.length}</span></div>
    {rows.map((r,i)=>{const isIso=r.type==="iso";const isAmrap=r.type==="amrap";const isDrop=r.type==="drop";const isMini=r.type==="mini";const isCluster=r.type==="cluster";const showPause=((r.type==="round"||r.type==="mini")&&i<rows.length-1&&rows[i+1]?.type===r.type)||(isCluster&&!r.isLast&&i<rows.length-1&&rows[i+1]?.type==="cluster");
      const delCol=postSession&&!viewOnly?" 24px":"";
      return(<div key={i}><div style={{display:"grid",gridTemplateColumns:isIso?"40px 1fr 28px 28px"+delCol:"40px 1fr 10px 1fr "+((!isAmrap&&!isMini&&!isDrop&&!isCluster)?"44px ":"")+"28px 28px"+delCol,gap:4,alignItems:"center",marginBottom:4,padding:"6px 8px",borderRadius:8,background:r.done?C.g+"10":r.skipped?C.tx3+"08":isDrop?C.o+"08":isMini?C.ac+"08":isCluster?"#C060D008":C.s2,border:"1px solid "+(r.done?C.g+"30":r.skipped?C.tx3+"20":isDrop?C.o+"20":isMini?C.ac+"20":isCluster?"#C060D030":C.brd),opacity:r.skipped?0.5:1,transition:"all 0.2s"}}>
        <span style={{fontSize:9,color:rowC(r),fontWeight:600,textAlign:"center"}}>{rowLabel(r)}</span>
        {!isIso&&<input type="number" step="0.5" value={r.kg||""} onChange={viewOnly?undefined:e=>upd(i,"kg",+e.target.value)} readOnly={viewOnly} placeholder="0" style={iS}/>}
        {isIso&&<div style={{fontSize:11,color:C.tx2,textAlign:"center"}}>{r.holdSec}s</div>}
        {!isIso&&<span style={{fontSize:10,color:C.tx3,textAlign:"center"}}>x</span>}
        {!isIso&&<input type="number" value={r.reps||""} onChange={viewOnly?undefined:e=>upd(i,"reps",+e.target.value)} readOnly={viewOnly} placeholder={isAmrap?"max":"0"} style={iS}/>}
        {!isIso&&!isAmrap&&!isMini&&!isDrop&&!isCluster&&<RIRPicker value={r.rir??2} onChange={viewOnly?()=>{}:v=>upd(i,"rir",v)}/>}
        <button onClick={viewOnly?undefined:()=>updR(i,{skipped:!r.skipped,done:false})} style={{width:28,height:28,borderRadius:7,border:"1.5px solid "+(r.skipped?C.o:C.brdL),background:r.skipped?C.o+"30":"transparent",color:r.skipped?C.o:C.tx3,cursor:viewOnly?"default":"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",visibility:r.done||viewOnly?"hidden":"visible"}}>—</button>
        <button onClick={viewOnly?undefined:()=>{const nd=!r.done;updR(i,{done:nd,skipped:false});if(nd&&onTimerStart)onTimerStart();}} style={{width:28,height:28,borderRadius:7,border:"1.5px solid "+(r.done?C.g:C.brdL),background:r.done?C.g:"transparent",color:r.done?"#fff":C.tx3,cursor:viewOnly?"default":"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",visibility:viewOnly?"hidden":"visible"}}>✓</button>
        {postSession&&!viewOnly&&<button onClick={()=>updateSets(storeKey,rows.filter((_,j)=>j!==i))} style={{width:22,height:22,borderRadius:6,border:"1px solid "+C.r+"50",background:C.rS,color:C.r,fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>}
      </div>{showPause&&<div style={{textAlign:"center",fontSize:9,color:C.tx3,padding:"2px 0",marginBottom:2}}>{r.pauseSec}s repos</div>}</div>);
    })}
    {((!method||method==="excentrique")||postSession)&&!viewOnly&&<button onClick={()=>updateSets(storeKey,[...rows,{type:"set",kg:rows[rows.length-1]?.kg||0,reps:rows[rows.length-1]?.reps||0,rir:2,done:false}])} style={{width:"100%",padding:"7px 0",borderRadius:8,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Série</button>}
    <div style={{marginTop:14}}><div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Mon ressenti</div><textarea value={note} onChange={viewOnly?undefined:e=>setAthleteNotes&&setAthleteNotes(p=>({...p,[storeKey]:e.target.value}))} readOnly={viewOnly} placeholder="Notes perso, sensations..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/></div>
  </div>);
}

const DarkTip=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:C.s2,border:"1px solid "+C.brdL,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>{label}</div>{payload.map((p,i)=>p.value!=null&&<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><div style={{width:8,height:8,borderRadius:2,background:p.fill||p.stroke||C.ac}}/><span style={{fontSize:10,color:C.tx2}}>{p.name}:</span><span style={{fontSize:11,fontWeight:700,color:p.fill||p.stroke||C.ac}}>{p.value}</span></div>)}</div>);};
function MiniChart({data,color,h}){const H=h||52;const pts=data.filter(d=>d.val!=null);if(!pts.length)return null;const vals=pts.map(d=>d.val),mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;const W=280,mapped=data.map((d,i)=>({...d,x:(i/(data.length-1||1))*(W-20)+10,y:d.val!=null?H-12-((d.val-mn)/rng)*(H-24):null}));const act=mapped.filter(p=>p.y!=null),line=act.map((p,i)=>(i===0?"M":"L")+p.x+","+p.y).join(" ");const area=act.length>1?line+" L"+act[act.length-1].x+","+H+" L"+act[0].x+","+H+" Z":"";const gId="mc"+color.replace("#","")+(Math.random().toString(36).slice(2,5));return(<svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,display:"block"}}><defs><linearGradient id={gId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>{area&&<path d={area} fill={"url(#"+gId+")"}/>}{act.length>1&&<path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}{mapped.map((p,i)=>p.y!=null?(<g key={i}><circle cx={p.x} cy={p.y} r={3.5} fill={C.bg} stroke={color} strokeWidth="1.5"/><text x={p.x} y={p.y-8} textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="system-ui">{p.val}</text><text x={p.x} y={H-1} textAnchor="middle" fill={C.tx3} fontSize="8" fontFamily="system-ui">{p.week}</text></g>):(<text key={i} x={p.x} y={H-1} textAnchor="middle" fill={C.tx3} fontSize="8" fontFamily="system-ui">{p.week}</text>))}</svg>);}

function SleepTunnel({wellnessHistory,C}){
  const DAY=['D','L','M','Me','J','V','S'];
  const WIN_START=21*60;const WIN_SPAN=13*60;// 21h→10h next day
  const toOffset=({h,m})=>{const t=h*60+m;return t<WIN_START?t+24*60-WIN_START:t-WIN_START;};
  const entries=Object.entries(wellnessHistory).filter(([k,v])=>/^\d{8}$/.test(k)&&v?.coucher&&v?.reveil).sort((a,b)=>a[0]<b[0]?-1:1).slice(-10);
  if(!entries.length)return(<div style={{textAlign:'center',color:C.tx3,fontSize:11,padding:'16px 0'}}>Aucune donnée de sommeil</div>);
  const bars=entries.map(([key,v])=>{
    const y2=+key.slice(0,4),mo=+key.slice(4,6)-1,d=+key.slice(6,8);
    const dt=new Date(y2,mo,d);
    const s=toOffset(v.coucher);let e=toOffset(v.reveil);
    if(e<=s)e+=24*60;
    const durH=Math.round((e-s)/60*10)/10;
    const clamp=n=>Math.min(Math.max(n,0),WIN_SPAN);
    return{label:DAY[dt.getDay()]+'\n'+d,s:clamp(s),e:clamp(Math.min(e,WIN_SPAN)),durH,color:durH>=7.5?C.g:durH>=6.5?C.o:C.r};
  });
  const N=bars.length;const W=300;const H=85;
  const LH=12;// bottom label height
  const TW=20;// left time axis width
  const chartW=W-TW-4;const chartH=H-LH-4;
  const colW=chartW/N;
  const yOf=o=>4+(o/WIN_SPAN)*chartH;
  const tLabels=[{l:'22h',o:60},{l:'0h',o:180},{l:'3h',o:360},{l:'6h',o:540},{l:'9h',o:720}];
  return(<svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',display:'block'}}>
    {/* Grid lines + time labels (Y axis) */}
    {tLabels.map(({l,o})=>{const y=yOf(o);return(<g key={l}><line x1={TW} y1={y} x2={W-2} y2={y} stroke={C.brdL} strokeWidth={0.5}/><text x={TW-2} y={y+3} textAnchor='end' fill={C.tx3} fontSize={6}>{l}</text></g>);})}
    {/* Day columns */}
    {bars.map((b,i)=>{
      const x=TW+i*colW;const bw=Math.max(colW-2,2);
      const y1=yOf(b.s);const y2=yOf(b.e);const bh=Math.max(y2-y1,2);
      return(<g key={i}>
        <rect x={x} y={y1} width={bw} height={bh} rx={2} fill={b.color} opacity={0.25}/>
        <rect x={x} y={y1} width={bw} height={bh} rx={2} fill='none' stroke={b.color} strokeWidth={1} opacity={0.8}/>
        {bh>14&&<text x={x+bw/2} y={y1+bh/2+3} textAnchor='middle' fill={b.color} fontSize={6} fontWeight='700'>{b.durH}h</text>}
        {/* Day label bottom */}
        {b.label.split('\n').map((ln,li)=><text key={li} x={x+bw/2} y={H-LH+10+li*7} textAnchor='middle' fill={C.tx3} fontSize={5.5}>{ln}</text>)}
      </g>);
    })}
  </svg>);
}

function WeightChart({log,milestones,target,nutritionStrategy}){
  const data=getWeightChartData(log,milestones,target);
  if(!data.length)return(<div style={{textAlign:"center",color:C.tx3,fontSize:12,padding:"20px 0"}}>Aucune donnee</div>);
  const vals=data.map(d=>d.kg);const dataMin=Math.min(...vals),dataMax=Math.max(...vals),dataRange=Math.max(dataMax-dataMin,1),pad=Math.max(0.5,dataRange*0.2),mid=(dataMin+dataMax)/2,inclT=target!=null&&Math.abs(target-mid)<dataRange*2+3;const mn=Math.min(dataMin,inclT?target:dataMin)-pad,mx=Math.max(dataMax,inclT?target:dataMax)+pad;
  // Tendance par régression linéaire
  const nPts=vals.length;let trend=null;
  if(nPts>=3){const mX=(nPts-1)/2,mY=vals.reduce((s,v)=>s+v,0)/nPts,num=vals.reduce((s,v,i)=>s+(i-mX)*(v-mY),0),den=vals.reduce((s,_,i)=>s+(i-mX)*(i-mX),0),slope=den?num/den:0;const rate=+(slope*7).toFixed(2);
    let tc;const strat=nutritionStrategy?.strategy;const wt=nutritionStrategy?.weekly_target_kg;
    if(strat==="seche"){const exp=wt??-0.25;const tol=Math.max(0.05,Math.abs(exp)*0.4);tc=rate<=exp+tol&&rate<-0.05?C.g:Math.abs(rate)<0.1?C.o:C.r;}
    else if(strat==="prise_de_masse"){const exp=wt??0.2;const tol=Math.max(0.05,Math.abs(exp)*0.4);tc=rate>=exp-tol&&rate>0.05?C.g:Math.abs(rate)<0.1?C.o:C.r;}
    else if(strat==="maintenance"){tc=Math.abs(rate)<0.1?C.g:Math.abs(rate)<0.25?C.o:C.r;}
    else{const isToward=target!=null?(target>mY?rate>0:rate<0):null;tc=Math.abs(rate)<0.05?C.tx3:isToward===null?C.ac:isToward?C.g:C.r;}
    trend={rate,tc,dir:Math.abs(rate)<0.05?"→":rate>0?"↑":"↓",label:Math.abs(rate)<0.05?"Stable":(rate>0?"+":"")+rate+" kg/sem"};}
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{[{c:C.ac,l:"Poids"},{c:"rgba(255,200,0,0.6)",l:"Objectif"},{c:C.g,l:"Palier"}].map(({c,l})=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:10,color:C.tx3}}>{l}</span></div>)}</div>
      {trend&&<div title="Tendance estimée (régression linéaire, ~quotidien)" style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:trend.tc+"15",border:"1px solid "+trend.tc+"30",cursor:"default"}}><span style={{fontSize:13,color:trend.tc,lineHeight:1}}>{trend.dir}</span><span style={{fontSize:10,fontWeight:700,color:trend.tc}}>{trend.label}</span></div>}
    </div>
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

function MethodParamsForm({method,params,onChange,exosInSession,currentExId,plannedKg}){
  if(!method||!MDEF[method])return null;const p=params||MDEF[method];const upd=(k,v)=>onChange({...p,[k]:v});
  const row=(label,key,min,max,step)=>(<div key={key}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>{label}</div><div style={{display:"flex",alignItems:"center",gap:4}}><button onClick={()=>upd(key,Math.max(min,+(p[key]||0)-(step||1)))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>-</button><div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:C.tx}}>{p[key]||0}</div><button onClick={()=>upd(key,Math.min(max,+(p[key]||0)+(step||1)))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>+</button></div></div>);
  const mc=DEF_METHODS[method]?.c||C.ac;
  return(<div style={{marginTop:10,padding:"12px",borderRadius:10,background:C.s2,border:"1px solid "+mc+"40"}}>
    <div style={{fontSize:10,fontWeight:600,color:mc,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>{DEF_METHODS[method]?.label} - Parametres</div>
    {method==="dropset"&&(()=>{const nD=p.drops||2;const pct=p.pct||20;const autoW=i=>plannedKg?Math.round(plannedKg*Math.pow(1-pct/100,i+1)/2.5)*2.5:null;const dw=i=>p.dropWeights?.[i]??autoW(i);const updNCl=(n)=>{const newW=plannedKg?Array.from({length:n},(_,i)=>dw(i)):undefined;onChange({...p,drops:n,...(newW?{dropWeights:newW}:{})});};const updPct=(v)=>{const newW=plannedKg?Array.from({length:nD},(_,i)=>Math.round(plannedKg*Math.pow(1-v/100,i+1)/2.5)*2.5):undefined;onChange({...p,pct:v,...(newW?{dropWeights:newW}:{})});};const updDW=(i,v)=>{const arr=Array.from({length:nD},(_,j)=>dw(j));arr[i]=v;onChange({...p,dropWeights:arr});};return(<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:plannedKg?10:0}}><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Nb drops</div><div style={{display:"flex",alignItems:"center",gap:4}}><button onClick={()=>updNCl(Math.max(1,nD-1))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>-</button><div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:C.tx}}>{nD}</div><button onClick={()=>updNCl(Math.min(6,nD+1))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>+</button></div></div><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Réduction %</div><div style={{display:"flex",alignItems:"center",gap:4}}><button onClick={()=>updPct(Math.max(5,pct-5))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>-</button><div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:C.tx}}>{pct}%</div><button onClick={()=>updPct(Math.min(50,pct+5))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>+</button></div></div></div>{plannedKg&&<div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Charges par drop</div><div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><div style={{textAlign:"center",padding:"4px 8px",borderRadius:6,background:C.s1,fontSize:12,fontWeight:700,color:C.tx}}>{plannedKg}<span style={{fontSize:9,color:C.tx3}}> kg</span></div>{Array.from({length:nD},(_,i)=>{const w=dw(i);return(<div key={i} style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:C.tx3,fontSize:12}}>→</span><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:9,color:C.o}}>Drop {i+1}</div><div style={{display:"flex",alignItems:"center",gap:2}}><button onClick={()=>updDW(i,Math.max(0,Math.round(((w||0)-2.5)/2.5)*2.5))} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:10,flexShrink:0}}>-</button><div style={{width:36,textAlign:"center",fontSize:12,fontWeight:700,color:C.o}}>{w??"-"}</div><button onClick={()=>updDW(i,Math.round(((w||0)+2.5)/2.5)*2.5)} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:10,flexShrink:0}}>+</button></div></div></div>);})}</div></div>}</div>);})()}
    {method==="myoreps"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Reps activ.","activation",5,25)}{row("Nb mini-sets","minisets",2,10)}{row("Reps/mini","reps_mini",2,10)}{row("Pause (s)","pause",3,30)}</div>}
    {method==="restpause"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Nb rounds","rounds",2,6)}{row("Pause (s)","pause",5,60,5)}</div>}
    {method==="cluster"&&(()=>{const ra=clusterReps(p);const nCl=p.clusters||3;const updRep=(i,v)=>{const nr=[...ra];nr[i]=v;onChange({...p,reps:nr});};const updNCl=(n)=>{const nr=n>ra.length?[...ra,...Array(n-ra.length).fill(ra[ra.length-1]||2)]:ra.slice(0,n);onChange({...p,clusters:n,reps:nr});};return(<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Nb clusters</div><div style={{display:"flex",alignItems:"center",gap:4}}><button onClick={()=>updNCl(Math.max(2,nCl-1))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>-</button><div style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700,color:C.tx}}>{nCl}</div><button onClick={()=>updNCl(Math.min(8,nCl+1))} style={{width:26,height:26,borderRadius:6,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>+</button></div></div>{row("Pause (s)","pause",5,30,5)}</div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Reps par cluster</div><div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>{ra.map((v,i)=>(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:1,minWidth:32}}><div style={{fontSize:9,color:C.tx3}}>C{i+1}</div><div style={{display:"flex",alignItems:"center",gap:2}}><button onClick={()=>updRep(i,Math.max(1,v-1))} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:10,flexShrink:0}}>-</button><div style={{width:22,textAlign:"center",fontSize:13,fontWeight:700,color:mc}}>{v}</div><button onClick={()=>updRep(i,Math.min(10,v+1))} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:10,flexShrink:0}}>+</button></div></div>))}</div><div style={{padding:"6px 10px",borderRadius:6,background:C.s1,fontSize:12,fontWeight:700,color:mc,textAlign:"center",letterSpacing:"1px"}}>{ra.join("+")} <span style={{fontSize:10,fontWeight:400,color:C.tx3}}>({p.pause||10}s repos)</span></div></div>);})()}
    {method==="superset"&&<div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:6}}>Exercice associe</div><select value={p.paired||""} onChange={e=>upd("paired",e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:12,fontFamily:"inherit"}}><option value="">-- Choisir --</option>{(exosInSession||[]).filter(e=>e.id!==currentExId).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
    {method==="amrap"&&<div><div style={{display:"flex",gap:6,marginBottom:8}}>{["failure","timed"].map(t=><button key={t} onClick={()=>upd("type",t)} style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(p.type===t?C.b:C.brdL),background:p.type===t?C.bS:"transparent",color:p.type===t?C.b:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{t==="failure"?"A l echec":"Chrono"}</button>)}</div>{p.type==="timed"&&row("Duree (s)","duration",10,300,5)}</div>}
    {method==="excentrique"&&row("Phase neg. (s)","eccentric_sec",2,10)}
    {method==="isometrique"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{row("Maintien (s)","hold_sec",5,120,5)}{row("Nb positions","positions",1,5)}</div>}
    <div style={{marginTop:10,padding:"6px 10px",borderRadius:6,background:C.s1,fontSize:10,color:mc}}>
      {method==="dropset"&&(p.drops||2)+" drops, -"+(p.pct||20)+"%"}
      {method==="myoreps"&&(p.activation||12)+" reps + "+(p.minisets||4)+"x"+(p.reps_mini||5)+" ("+(p.pause||5)+"s)"}
      {method==="restpause"&&(p.rounds||3)+" rounds, "+(p.pause||15)+"s"}
      {method==="cluster"&&clusterReps(p).join("+")+", "+(p.pause||10)+"s"}
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
  const[importFiles,setImportFiles]=useState([]);// [{name,mimeType,data,preview,sessionTags}]
  const importTargetRef=useRef([]);// sessions ciblées — ref pour éviter problèmes d'async state
  const fileRef=useRef(null);
  // Chat IA conversationnel
  const[convMsgs,setConvMsgs]=useState([]);// [{role:"user"|"ai", content:string}]
  const[convInput,setConvInput]=useState("");
  const[convProgram,setConvProgram]=useState(null);// dernier programme généré
  const[convLoading,setConvLoading]=useState(false);
  const[convError,setConvError]=useState(null);
  const[convCooldown,setConvCooldown]=useState(0);// secondes restantes avant prochain envoi
  const convEndRef=useRef(null);
  useEffect(()=>{
    if(convCooldown<=0)return;
    const t=setTimeout(()=>setConvCooldown(c=>Math.max(0,c-1)),1000);
    return()=>clearTimeout(t);
  },[convCooldown]);
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
            setImportFiles(prev=>[...prev,{name:file.name,mimeType:"text/plain",data:null,preview:null,isExcel:true,sessionTags:[]}]);
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
          setImportFiles(prev=>[...prev,{name:file.name,mimeType:"image/jpeg",data:b64,preview:url,sessionTags:[]}]);
        };
        img.src=url;
      }else{
        // PDF et autres formats — envoi direct en base64
        const reader=new FileReader();
        reader.onload=ev=>{
          const b64=ev.target.result.split(",")[1];
          setImportFiles(prev=>[...prev,{name:file.name,mimeType:file.type||"application/pdf",data:b64,preview:null,sessionTags:[]}]);
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value="";
  };
  const removeImportFile=(idx)=>{
    setImportFiles(prev=>prev.filter((_,i)=>i!==idx));
  };
  const toggleFileSessionTag=(idx,sessId)=>{
    setImportFiles(prev=>prev.map((f,i)=>{
      if(i!==idx)return f;
      const tags=f.sessionTags||[];
      return{...f,sessionTags:tags.includes(sessId)?tags.filter(t=>t!==sessId):[...tags,sessId]};
    }));
  };
  const clearFileTags=(idx)=>{
    setImportFiles(prev=>prev.map((f,i)=>i===idx?{...f,sessionTags:[]}:f));
  };
  const sendConvMessage=async()=>{
    const msg=convInput.trim();if(!msg||convLoading||convCooldown>0||!preview)return;
    setConvInput("");
    setConvMsgs(prev=>[...prev,{role:"user",content:msg}]);
    setConvLoading(true);setConvError(null);
    setTimeout(()=>convEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try{
      const history=convMsgs.map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}));
      const payload={mode:"chat_edit",message:msg,currentProgram:preview.sessions,conversationHistory:history,sessions:SESSIONS};
      const resp=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
      const data=await resp.json();
      if(resp.status===429){setConvCooldown(30);throw new Error(data.error||"Trop de requetes");}
      if(!resp.ok)throw new Error(data.error||"Erreur serveur");
      setPreview(prev=>({sessions:{...prev.sessions,...data.sessions},rationale:data.rationale}));
      setConvMsgs(prev=>[...prev,{role:"ai",content:data.rationale||"Programme mis à jour."}]);
      setConvCooldown(8);// cooldown entre chaque message
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

  const stitchImages=async(images)=>{
    // Charge toutes les images et les empile verticalement sur un seul canvas
    const imgs=await Promise.all(images.map(f=>new Promise((res,rej)=>{
      const img=new Image();
      img.onload=()=>res(img);
      img.onerror=rej;
      img.src="data:"+f.mimeType+";base64,"+f.data;
    })));
    const maxW=Math.min(1400,Math.max(...imgs.map(i=>i.width)));
    const totalH=imgs.reduce((s,i)=>s+Math.round(i.height*(maxW/i.width)),0);
    const canvas=document.createElement("canvas");
    canvas.width=maxW;canvas.height=Math.min(totalH,8000);
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
    let y=0;
    for(const img of imgs){
      const scale=maxW/img.width;
      const h=Math.round(img.height*scale);
      if(y+h>canvas.height)break;
      ctx.drawImage(img,0,y,maxW,h);
      y+=h;
    }
    const b64=canvas.toDataURL("image/jpeg",0.82).split(",")[1];
    return{name:"fusion_images.jpg",mimeType:"image/jpeg",data:b64,preview:null};
  };

  const mergePDFs=async(pdfs)=>{
    const merged=await PDFDocument.create();
    for(const f of pdfs){
      const bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0));
      const doc=await PDFDocument.load(bytes);
      const pages=await merged.copyPages(doc,doc.getPageIndices());
      pages.forEach(p=>merged.addPage(p));
    }
    const bytes=await merged.save();
    const b64=btoa(String.fromCharCode(...bytes));
    return{name:"fusion.pdf",mimeType:"application/pdf",data:b64,preview:null};
  };

  const mergeFilesForImport=async(files)=>{
    const images=files.filter(f=>f.mimeType.startsWith("image/"));
    const pdfs=files.filter(f=>f.mimeType==="application/pdf");
    const others=files.filter(f=>!f.mimeType.startsWith("image/")&&f.mimeType!=="application/pdf");
    const result=[];
    if(images.length===1)result.push(images[0]);
    else if(images.length>1)result.push(await stitchImages(images));
    if(pdfs.length===1)result.push(pdfs[0]);
    else if(pdfs.length>1)result.push(await mergePDFs(pdfs));
    result.push(...others);
    return result;
  };

  const importProgram=async()=>{
    if(!importText.trim()&&!importFiles.length){setError("Colle un texte ou ajoute au moins un fichier.");return;}
    setLoading(true);setError(null);
    try{
      const payload={mode:"import",prompt:importText||(importFiles.length?"Programme dans les fichiers ci-joints":""),sessions:SESSIONS};
      const binaryFiles=importFiles.filter(f=>f.data!==null);
      // Collecter les sessions explicitement ciblées (tous fichiers confondus)
      const targetIds=[...new Set(importFiles.flatMap(f=>f.sessionTags||[]))];
      importTargetRef.current=targetIds;
      if(binaryFiles.length){
        const hasTagged=binaryFiles.some(f=>f.sessionTags?.length>0);
        if(hasTagged){
          payload.filesData=binaryFiles.map(f=>({mimeType:f.mimeType,data:f.data,name:f.name,sessionTags:f.sessionTags||[]}));
        }else{
          const merged=await mergeFilesForImport(binaryFiles);
          payload.filesData=merged.map(f=>({mimeType:f.mimeType,data:f.data,name:f.name,sessionTags:[]}));
        }
      }
      // Restreindre l'IA aux sessions ciblées si précisées
      if(targetIds.length>0)payload.targetSessions=targetIds;
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
          {[{k:"import",l:"Import"},{k:"form",l:"Parametres"},{k:"details",l:"Profil"}].map(t=>(
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
              {importFiles.map((f,i)=>{
                const tags=f.sessionTags||[];
                const isTagged=tags.length>0;
                return(<div key={i} style={{background:C.s2,borderRadius:8,padding:"8px 10px",border:"1px solid "+(isTagged?C.coach+"50":C.brdL)}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {f.preview
                      ?<img src={f.preview} alt={f.name} style={{width:36,height:36,borderRadius:6,objectFit:"cover",background:C.s1,flexShrink:0}}/>
                      :<div style={{width:36,height:36,borderRadius:6,background:isTagged?C.coachS:C.s1,border:"1px solid "+C.brdL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📄</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                      <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase"}}>{f.mimeType.split("/")[1]}</div>
                    </div>
                    <button onClick={()=>removeImportFile(i)} style={{background:"none",border:"none",color:C.tx3,fontSize:16,cursor:"pointer",padding:"0 4px",flexShrink:0,fontFamily:"inherit"}}>×</button>
                  </div>
                  <div style={{marginTop:7}}>
                    <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.3px",marginBottom:5}}>Affecter à :</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      <button onClick={()=>clearFileTags(i)} style={{padding:"3px 9px",borderRadius:5,border:"1px solid "+(!isTagged?C.coach:C.brdL),background:!isTagged?C.coachS:"transparent",color:!isTagged?C.coach:C.tx3,fontSize:9,fontWeight:!isTagged?700:400,cursor:"pointer",fontFamily:"inherit"}}>Global</button>
                      {SESSIONS.map(s=>{
                        const on=tags.includes(s.id);
                        return(<button key={s.id} onClick={()=>toggleFileSessionTag(i,s.id)} style={{padding:"3px 9px",borderRadius:5,border:"1px solid "+(on?C.coach:C.brdL),background:on?C.coachS:"transparent",color:on?C.coach:C.tx3,fontSize:9,fontWeight:on?700:400,cursor:"pointer",fontFamily:"inherit"}}>{s.short||s.id}</button>);
                      })}
                    </div>
                  </div>
                </div>);
              })}
              {importFiles.some(f=>(f.sessionTags||[]).length>0)&&(
                <div style={{padding:"7px 10px",borderRadius:7,background:C.coachS,border:"1px solid "+C.coach+"30",fontSize:10,color:C.coach,lineHeight:1.5}}>
                  L'IA placera les exercices de chaque fichier tagué uniquement dans les séances sélectionnées.
                </div>
              )}
            </div>)}
          </div>
          {error&&<div style={{padding:"10px 14px",borderRadius:8,background:C.rS,border:"1px solid "+C.r+"40",color:C.r,fontSize:11,marginBottom:12}}>{error}</div>}
          <button onClick={importProgram} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:loading?"#333":C.coach,color:loading?C.tx3:"#fff",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>
            {loading?"Analyse en cours...":"Importer le programme"}
          </button>
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
        {/* Résumé IA */}
        <div style={{padding:"10px 14px",borderRadius:10,background:C.gS,border:"1px solid "+C.g+"40",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:C.g,marginBottom:2}}>Programme généré</div>
          <div style={{fontSize:11,color:C.tx2,lineHeight:1.5}}>{preview.rationale}</div>
        </div>
        {/* Liste exercices */}
        <div style={{marginBottom:12}}>
          {Object.entries(preview.sessions||{}).map(([sid,exList])=>{const s=SESSIONS.find(x=>x.id===sid);if(!s||!exList?.length)return null;return(<div key={sid} style={{background:C.s1,borderRadius:10,padding:"10px 14px",marginBottom:6,border:"1px solid "+C.brd}}><div style={{fontSize:12,fontWeight:700,color:C.tx,marginBottom:5}}>{s.name} <span style={{fontSize:10,color:C.tx3}}>({exList.length} exos)</span></div>{exList.map((ex,i)=>{const wks=Object.keys(ex.weeks||{});return(<div key={i} style={{fontSize:11,color:C.tx2,padding:"3px 0",borderTop:i>0?"1px solid "+C.brd:""}}><span style={{color:getMC(ex.target||"Pecs"),fontWeight:600}}>{ex.name}</span><span style={{color:C.tx3}}> - {ex.bloc} - S{wks[0]}→S{wks[wks.length-1]}</span></div>);})}</div>);})}
        </div>
        {/* Chat IA pour affiner */}
        <div style={{borderTop:"1px solid "+C.brd,paddingTop:12,marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Affiner avec l'IA</div>
          {convMsgs.length>0&&(<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10,maxHeight:200,overflowY:"auto"}}>
            {convMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?C.coach:C.s2,color:m.role==="user"?"#fff":C.tx,fontSize:11,lineHeight:1.5}}>{m.content}</div>
              </div>
            ))}
            {convLoading&&<div style={{display:"flex"}}><div style={{padding:"8px 12px",borderRadius:"12px 12px 12px 4px",background:C.s2,color:C.tx3,fontSize:11}}>...</div></div>}
            {convError&&<div style={{fontSize:11,color:C.r,padding:"6px 10px",borderRadius:7,background:C.rS}}>{convError}</div>}
            <div ref={convEndRef}/>
          </div>)}
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <textarea value={convInput} onChange={e=>setConvInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendConvMessage();}}} placeholder='Ex: "plus de volume triceps, remplace le hack squat..."' rows={2} disabled={convLoading||convCooldown>0} style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1px solid "+(convCooldown>0?C.o+"60":C.brdL),background:C.s2,color:convCooldown>0?C.tx3:C.tx,fontSize:12,fontFamily:"inherit",resize:"none",lineHeight:1.5}}/>
            <button onClick={sendConvMessage} disabled={convLoading||convCooldown>0||!convInput.trim()} style={{padding:"9px 14px",borderRadius:10,border:"none",background:convInput.trim()&&!convLoading&&!convCooldown?C.coach:convCooldown>0?C.o+"30":"#333",color:convInput.trim()&&!convLoading&&!convCooldown?"#fff":convCooldown>0?C.o:C.tx3,fontSize:convCooldown>0?11:14,fontWeight:700,cursor:convInput.trim()&&!convLoading&&!convCooldown?"pointer":"default",fontFamily:"inherit",flexShrink:0,alignSelf:"flex-end",minWidth:40}}>{convLoading?"...":convCooldown>0?convCooldown+"s":"↑"}</button>
          </div>
        </div>
        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setStep(0);setConvMsgs([]);setConvError(null);}} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Régénérer</button>
          <button onClick={()=>{
            const targets=importTargetRef.current;
            if(targets.length>0){
              // Fusion : garder les séances existantes non ciblées, appliquer l'IA sur les séances ciblées
              const merged={};
              SESSIONS.forEach(s=>{
                if(targets.includes(s.id)){
                  // Séance ciblée : prendre le résultat IA s'il a des exercices, sinon garder l'existant
                  const aiResult=preview.sessions[s.id];
                  merged[s.id]=(aiResult&&aiResult.length>0)?aiResult:(existingExos[s.id]||[]);
                }else{
                  // Séance non ciblée : toujours garder l'existant
                  merged[s.id]=existingExos[s.id]||[];
                }
              });
              onGenerate(merged);
            }else{
              onGenerate(preview.sessions);
            }
          }} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:C.coach,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Appliquer</button>
        </div>
        <div style={{fontSize:10,color:C.tx3,textAlign:"center",marginTop:8}}>Tu pourras modifier chaque exercice dans l'éditeur</div>
      </div>)}
    </div>
  </div>);
}

function RetoursView(){
  const{user,profile}=useAuth();
  const isAdmin=profile?.is_admin===true;
  const[retours,setRetours]=useState([]);
  const[votes,setVotes]=useState({});
  const[profiles,setProfiles]=useState({});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[newContent,setNewContent]=useState('');
  const[showAdd,setShowAdd]=useState(false);
  const[submitting,setSubmitting]=useState(false);
  const[submitErr,setSubmitErr]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);

  const load=async()=>{
    setLoading(true);setError(null);
    const{data:rData,error:rErr}=await supabase.from('retours').select('*').order('created_at',{ascending:false});
    if(rErr){setError(rErr.code==='42P01'?'Les tables ne sont pas encore créées. Applique la migration SQL dans Supabase.':rErr.message);setLoading(false);return;}
    const{data:vData}=await supabase.from('retours_votes').select('*');
    // Fetch profiles for authors
    const ids=[...new Set((rData||[]).map(r=>r.athlete_id))];
    let profMap={};
    if(ids.length>0){
      const{data:pData}=await supabase.from('profiles').select('id,full_name,first_name,last_name').in('id',ids);
      (pData||[]).forEach(p=>{profMap[p.id]=p;});
    }
    setRetours(rData||[]);
    setProfiles(profMap);
    if(vData){
      const v={};
      vData.forEach(vote=>{
        if(!v[vote.retour_id])v[vote.retour_id]={likes:0,dislikes:0,myVote:null};
        if(vote.vote==='like')v[vote.retour_id].likes++;
        else v[vote.retour_id].dislikes++;
        if(vote.user_id===user?.id)v[vote.retour_id].myVote=vote.vote;
      });
      setVotes(v);
    }
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const addRetour=async()=>{
    if(!newContent.trim()||!user)return;
    setSubmitting(true);setSubmitErr(null);
    const{error:err}=await supabase.from('retours').insert({athlete_id:user.id,content:newContent.trim()});
    if(err){setSubmitErr(err.code==='42P01'?'Table manquante — applique la migration SQL dans Supabase.':err.message);setSubmitting(false);return;}
    setNewContent('');setShowAdd(false);setSubmitting(false);load();
  };

  const doVote=async(retourId,voteType)=>{
    if(!user)return;
    const current=votes[retourId]?.myVote;
    if(current===voteType){
      await supabase.from('retours_votes').delete().match({retour_id:retourId,user_id:user.id});
    }else{
      await supabase.from('retours_votes').upsert({retour_id:retourId,user_id:user.id,vote:voteType},{onConflict:'retour_id,user_id'});
    }
    load();
  };

  const deleteRetour=async(id)=>{
    await supabase.from('retours').delete().eq('id',id);
    setConfirmDel(null);load();
  };

  const getName=athleteId=>{
    if(athleteId===user?.id)return profile?([profile.first_name,profile.last_name].filter(Boolean).join(' ')||profile.full_name||'Moi'):'Moi';
    const p=profiles[athleteId];
    return p?([p.first_name,p.last_name].filter(Boolean).join(' ')||p.full_name||'Athlète'):'Athlète';
  };

  const fmtDate=dt=>{const d=new Date(dt);const now=new Date();const diff=Math.floor((now-d)/60000);if(diff<1)return"à l'instant";if(diff<60)return diff+'min';if(diff<1440)return Math.floor(diff/60)+'h';return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});};

  return(<div style={{padding:'16px 16px 80px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:'-0.5px'}}>Retours</div>
      <button onClick={()=>{setShowAdd(v=>!v);setSubmitErr(null);}} style={{padding:'7px 14px',borderRadius:10,border:'none',background:C.ac,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Ajouter</button>
    </div>
    <div style={{fontSize:12,color:C.tx3,marginBottom:20}}>Remarques & suggestions de la communauté</div>

    {showAdd&&(<div style={{background:C.s1,borderRadius:14,padding:16,border:'1px solid '+C.brdL,marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:600,color:C.tx2,marginBottom:8}}>Nouvelle remarque</div>
      <textarea value={newContent} onChange={e=>setNewContent(e.target.value)} placeholder="Partage une réflexion, une suggestion, un retour sur l'app..." rows={4} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:'inherit',resize:'none',boxSizing:'border-box',outline:'none',lineHeight:1.5}}/>
      {submitErr&&<div style={{marginTop:8,padding:'8px 12px',borderRadius:8,background:C.rS,border:'1px solid '+C.r+'40',fontSize:12,color:C.r}}>{submitErr}</div>}
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button onClick={()=>{setShowAdd(false);setSubmitErr(null);}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx3,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
        <button onClick={addRetour} disabled={!newContent.trim()||submitting} style={{flex:2,padding:'10px 0',borderRadius:10,border:'none',background:newContent.trim()&&!submitting?C.ac:'#333',color:newContent.trim()&&!submitting?'#fff':C.tx3,fontSize:13,fontWeight:700,cursor:newContent.trim()&&!submitting?'pointer':'default',fontFamily:'inherit'}}>{submitting?'Envoi...':'Publier'}</button>
      </div>
    </div>)}

    {loading?<div style={{textAlign:'center',padding:'40px 0',color:C.tx3,fontSize:13}}>Chargement...</div>:
     error?(<div style={{padding:'16px',borderRadius:12,background:C.rS,border:'1px solid '+C.r+'40',marginTop:8}}>
      <div style={{fontSize:13,fontWeight:700,color:C.r,marginBottom:4}}>Erreur</div>
      <div style={{fontSize:12,color:C.r,lineHeight:1.5}}>{error}</div>
      {error.includes('migration')&&<div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'rgba(0,0,0,0.2)',fontSize:11,color:C.tx3,fontFamily:'monospace',lineHeight:1.7}}>Supabase → SQL Editor → colle le contenu de :<br/>supabase/migrations/20260412_retours.sql</div>}
     </div>):(
      retours.length===0?(<div style={{textAlign:'center',padding:'40px 0'}}>
        <div style={{fontSize:32,marginBottom:12}}>💬</div>
        <div style={{fontSize:14,color:C.tx3}}>Aucun retour pour l'instant. Sois le premier !</div>
      </div>):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {retours.map(r=>{
            const v=votes[r.id]||{likes:0,dislikes:0,myVote:null};
            const name=getName(r.athlete_id);
            const isOwn=r.athlete_id===user?.id;
            return(<div key={r.id} style={{background:C.s1,borderRadius:14,padding:'14px 16px',border:'1px solid '+C.brd}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:C.acS,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:C.ac,flexShrink:0}}>{name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.tx}}>{name}{isOwn&&<span style={{fontSize:9,color:C.tx3,fontWeight:400,marginLeft:4}}>(moi)</span>}</div>
                    <div style={{fontSize:10,color:C.tx3}}>{fmtDate(r.created_at)}</div>
                  </div>
                </div>
                {(isOwn||isAdmin)&&<button onClick={()=>setConfirmDel(r.id)} style={{background:'none',border:'none',color:C.tx3,fontSize:14,cursor:'pointer',fontFamily:'inherit',padding:'0 4px'}}>✕</button>}
              </div>
              <div style={{fontSize:13,color:C.tx,lineHeight:1.6,marginBottom:12}}>{r.content}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>doVote(r.id,'like')} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:8,border:'1.5px solid '+(v.myVote==='like'?C.g:C.brdL),background:v.myVote==='like'?C.gS:'transparent',color:v.myVote==='like'?C.g:C.tx3,fontSize:12,fontWeight:v.myVote==='like'?700:400,cursor:'pointer',fontFamily:'inherit'}}>
                  👍 <span>{v.likes}</span>
                </button>
                <button onClick={()=>doVote(r.id,'dislike')} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:8,border:'1.5px solid '+(v.myVote==='dislike'?C.r:C.brdL),background:v.myVote==='dislike'?C.rS:'transparent',color:v.myVote==='dislike'?C.r:C.tx3,fontSize:12,fontWeight:v.myVote==='dislike'?700:400,cursor:'pointer',fontFamily:'inherit'}}>
                  👎 <span>{v.dislikes}</span>
                </button>
              </div>
            </div>);
          })}
        </div>
      )
    )}

    {confirmDel&&(<div onClick={()=>setConfirmDel(null)} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.s1,borderRadius:16,padding:24,width:'100%',maxWidth:320}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Supprimer ce retour ?</div>
        <div style={{fontSize:13,color:C.tx3,marginBottom:20}}>Cette action est irréversible.</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setConfirmDel(null)} style={{flex:1,padding:'10px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx3,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
          <button onClick={()=>deleteRetour(confirmDel)} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',background:C.r,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Supprimer</button>
        </div>
      </div>
    </div>)}
  </div>);
}

function SessionDetailModal({sid,wk,sessions,exos,sets,completedSessions,allMethods,blockConfig,currentWeek,onClose}){
  const sess=sessions.find(s=>s.id===sid);if(!sess)return null;
  const exList=exos[sid]||[];
  const isDone=(completedSessions[wk]||[]).includes(sid);
  const dw=blockConfig?.deloadWeek||0;
  const prevWk=wk>1?wk-1:null;
  const sBlocs=getSessionBlocs(sess,exList);
  const getBloc=id=>sBlocs.find(b=>b.id===id)||{color:C.tx3,label:id||"Sans bloc"};
  // Stats globales
  const musExs=exList.filter(ex=>{const t=ex.exType||(ex.isFlexibility?"mobilite":"muscu");return t==="muscu"||t==="halterophilie";});
  const volAct=musExs.reduce((s,ex)=>{const r=sets[ex.id+"_"+wk]||[];return s+r.filter(x=>x.done).reduce((a,x)=>a+(x.kg||0)*(x.reps||0),0);},0);
  const volPrev=prevWk?musExs.reduce((s,ex)=>{const r=sets[ex.id+"_"+prevWk]||[];return s+r.filter(x=>x.done).reduce((a,x)=>a+(x.kg||0)*(x.reps||0),0);},0):0;
  const setsPl=musExs.reduce((s,ex)=>s+(ex.weeks[wk]?.sets||0),0);
  const setsDone=musExs.reduce((s,ex)=>{const r=sets[ex.id+"_"+wk]||[];return s+r.filter(x=>x.done).length;},0);
  const setsSkip=musExs.reduce((s,ex)=>{const r=sets[ex.id+"_"+wk]||[];return s+r.filter(x=>x.skipped).length;},0);
  const volDiff=prevWk&&volPrev>0?Math.round((volAct-volPrev)/volPrev*100):null;
  // Groupes
  const groups=[];const seen=new Set();
  exList.forEach(ex=>{const k=ex.bloc||"__";if(!seen.has(k)){seen.add(k);groups.push({blocId:ex.bloc,exs:[]});}groups.find(g=>g.blocId===ex.bloc).exs.push(ex);});
  groups.sort((a,b)=>{const ai=sBlocs.findIndex(s=>s.id===a.blocId);const bi=sBlocs.findIndex(s=>s.id===b.blocId);if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;});
  const statusC=isDone?C.g:wk<currentWeek?C.o:C.ac;
  const statusL=isDone?"✓ Faite":wk<currentWeek?"Non faite":"À faire";
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.88)",overflowY:"auto",padding:"14px 12px 40px"}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:580,margin:"0 auto",background:C.bg,borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        {/* Header */}
        <div style={{padding:"14px 16px",background:statusC+"18",borderBottom:"1px solid "+statusC+"30",display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800}}>{sess.name}</div>
            <div style={{fontSize:10,color:C.tx3,marginTop:2}}>Semaine {wk}{dw===wk?" · Deload":""}</div>
          </div>
          <div style={{padding:"4px 10px",borderRadius:8,background:statusC,color:"#fff",fontSize:11,fontWeight:700}}>{statusL}</div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",color:C.tx2,fontSize:22,cursor:"pointer",fontFamily:"inherit",lineHeight:"28px",textAlign:"center",flexShrink:0}}>×</button>
        </div>
        {/* Stats séance faite */}
        {isDone&&setsDone>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,padding:"10px 14px",borderBottom:"1px solid "+C.brd,background:C.s1}}>
          <div style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px"}}>
            <div style={{fontSize:8,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>Volume réalisé</div>
            <div style={{fontSize:14,fontWeight:800,color:C.ac}}>{volAct>0?Math.round(volAct).toLocaleString()+" kg":"—"}</div>
          </div>
          <div style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px"}}>
            <div style={{fontSize:8,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>Séries</div>
            <div style={{fontSize:14,fontWeight:800,color:setsDone>=setsPl?C.g:C.o}}>{setsDone}/{setsPl}</div>
            {setsSkip>0&&<div style={{fontSize:8,color:C.tx3}}>{setsSkip} skip</div>}
          </div>
          <div style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px"}}>
            <div style={{fontSize:8,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>vs S{prevWk||"—"}</div>
            {volDiff!==null?<div style={{fontSize:14,fontWeight:800,color:volDiff>0?C.g:volDiff<0?C.r:C.tx}}>{volDiff>0?"+":""}{volDiff}%</div>:<div style={{fontSize:12,color:C.tx3}}>Nouveau</div>}
            {volPrev>0&&<div style={{fontSize:8,color:C.tx3}}>{Math.round(volPrev/100)*100} kg</div>}
          </div>
        </div>}
        {/* Exercices */}
        <div style={{padding:"12px 14px 20px"}}>
          {!isDone&&<div style={{padding:"7px 10px",borderRadius:8,background:C.acS,border:"1px solid "+C.ac+"30",marginBottom:10,fontSize:11,color:C.ac,fontWeight:600}}>Programme prévu — Semaine {wk}</div>}
          {groups.map(({blocId,exs:gExs})=>{
            const bl=getBloc(blocId);
            return(<div key={blocId||"__"} style={{marginBottom:12}}>
              {blocId&&<div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,padding:"3px 8px",borderRadius:6,background:bl.color+"18",border:"1px solid "+bl.color+"30"}}>
                <div style={{width:3,height:10,borderRadius:2,background:bl.color,flexShrink:0}}/>
                <span style={{fontSize:9,fontWeight:700,color:bl.color,textTransform:"uppercase",letterSpacing:"0.7px"}}>{bl.label}</span>
              </div>}
              {gExs.map(ex=>{
                const wd=ex.weeks[wk];const rows=sets[ex.id+"_"+wk]||[];
                const dRows=rows.filter(r=>r.done);const sRows=rows.filter(r=>r.skipped);
                const prevRows=prevWk?sets[ex.id+"_"+prevWk]||[]:[];const prevD=prevRows.filter(r=>r.done);
                const avgKg=dRows.length>0?Math.round(dRows.reduce((s,r)=>s+(r.kg||0),0)/dRows.length*10)/10:0;
                const prevAvg=prevD.length>0?Math.round(prevD.reduce((s,r)=>s+(r.kg||0),0)/prevD.length*10)/10:0;
                const kgDiff=prevAvg>0&&avgKg>0?Math.round((avgKg-prevAvg)*10)/10:null;
                const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isFlex=eType!=="muscu"&&eType!=="halterophilie";
                const mc=getMC(ex.target||"Pecs");const mInf=wd?.method?allMethods[wd.method]:null;
                const exDone=isDone&&dRows.length>0;const exAllDone=isDone&&(dRows.length+sRows.length)>=(wd?.sets||0)&&(wd?.sets||0)>0;
                return(<div key={ex.id} style={{background:C.s1,borderRadius:9,padding:"9px 11px",marginBottom:5,border:"1px solid "+(exAllDone?C.g+"30":C.brd)}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:700}}>{ex.name}</span>
                        {ex.target&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:mc+"18",color:mc,fontWeight:600}}>{mL(ex.target)}</span>}
                        {mInf&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:mInf.c+"20",color:mInf.c,fontWeight:700}}>{mInf.e}</span>}
                        {exAllDone&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:C.gS,color:C.g,fontWeight:700}}>✓</span>}
                      </div>
                      {wd?<div style={{fontSize:10,color:C.tx3}}>{isFlex?wd.sets+"×"+(wd.repsRange||"?"):(wd.pdc?"PDC":wd.kg+"kg")+" · "+wd.sets+"×"+(wd.repsRange||"?")+(!isFlex?" · RIR "+rL(wd.rir??2):"")}</div>:<div style={{fontSize:10,color:C.tx3,fontStyle:"italic"}}>Non prescrit S{wk}</div>}
                    </div>
                    {/* Badge progression */}
                    {isDone&&kgDiff!==null&&<div style={{flexShrink:0,textAlign:"center",padding:"3px 7px",borderRadius:7,background:kgDiff>0?C.gS:kgDiff<0?C.rS:C.s2,border:"1px solid "+(kgDiff>0?C.g+"40":kgDiff<0?C.r+"40":C.brdL)}}>
                      <div style={{fontSize:7,color:C.tx3}}>vs S{prevWk}</div>
                      <div style={{fontSize:11,fontWeight:700,color:kgDiff>0?C.g:kgDiff<0?C.r:C.tx}}>{kgDiff>0?"+":""}{kgDiff}kg</div>
                    </div>}
                    {!isDone&&prevD.length>0&&<div style={{flexShrink:0,textAlign:"center",padding:"3px 7px",borderRadius:7,background:C.s2,border:"1px solid "+C.brdL}}>
                      <div style={{fontSize:7,color:C.tx3}}>Réf S{prevWk}</div>
                      <div style={{fontSize:10,fontWeight:600,color:C.tx2}}>{prevAvg>0?prevAvg+"kg":""}</div>
                      <div style={{fontSize:9,color:C.tx3}}>{prevD.length} séries</div>
                    </div>}
                  </div>
                  {/* Tableau sets (séance faite) */}
                  {isDone&&rows.length>0&&<div style={{marginTop:6,overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{fontSize:8,color:C.tx3,textTransform:"uppercase"}}>
                        <td style={{padding:"2px 4px",width:18}}>#</td>
                        {!isFlex&&<td style={{padding:"2px 4px",textAlign:"center",opacity:0.5}}>Prévu</td>}
                        <td style={{padding:"2px 4px",textAlign:"center"}}>kg</td>
                        <td style={{padding:"2px 4px",textAlign:"center"}}>Reps</td>
                        {!isFlex&&<td style={{padding:"2px 4px",textAlign:"center"}}>RIR</td>}
                        <td style={{padding:"2px 4px",textAlign:"center"}}>✓</td>
                      </tr></thead>
                      <tbody>{rows.map((r,i)=>{
                        const overKg=r.done&&wd&&!wd.pdc&&r.kg>(wd.kg||0);
                        return(<tr key={i} style={{borderTop:"1px solid "+C.brd,background:r.done?C.g+"06":r.skipped?C.tx3+"06":"transparent",opacity:r.skipped?0.45:1}}>
                          <td style={{padding:"3px 4px",fontSize:9,color:C.tx3}}>{i+1}</td>
                          {!isFlex&&<td style={{padding:"3px 4px",textAlign:"center",fontSize:9,color:C.tx3+"60"}}>{wd&&!wd.pdc?wd.kg+"kg":""}</td>}
                          <td style={{padding:"3px 4px",textAlign:"center",fontSize:11,fontWeight:700,color:r.done?(overKg?C.g:C.tx):C.tx3}}>{r.done||r.skipped?r.kg+"kg":"—"}</td>
                          <td style={{padding:"3px 4px",textAlign:"center",fontSize:11}}>{r.done?r.reps:r.skipped?"—":"—"}</td>
                          {!isFlex&&<td style={{padding:"3px 4px",textAlign:"center",fontSize:10,color:r.done?rC(r.rir??2):C.tx3}}>{r.done?rL(r.rir??2):"—"}</td>}
                          <td style={{padding:"3px 4px",textAlign:"center",fontSize:10,color:r.done?C.g:r.skipped?C.tx3:"transparent",fontWeight:700}}>{r.done?"✓":r.skipped?"—":""}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>}
                </div>);
              })}
            </div>);
          })}
          {exList.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.tx3,fontSize:12}}>Aucun exercice configuré</div>}
        </div>
      </div>
    </div>
  );
}

function CoachProgramEditor({exos,setExos,sessions,setSessions,athleteNotes,allMethods,customMethods,setCustomMethods,blockConfig,exMeta,setExMeta,currentWeek=1,sets={},completedSessions={},weekSchedule={},setWeekSchedule}){
  const tw=blockConfig?.totalWeeks||6;const dw=blockConfig?.deloadWeek||0;const progPct=blockConfig?.progressionPct||2.5;const deloadPct=blockConfig?.deloadPct||40;
  const blockStarted=!blockConfig?.startDate||Math.floor((Date.now()-new Date(blockConfig.startDate).getTime())/86400000)>=0;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const[sess,setSess]=useState(0);const[week,setWeek]=useState(1);const[openEx,setOpenEx]=useState(null);const[exosSearch,setExosSearch]=useState("");const[exosTypeFilter,setExosTypeFilter]=useState("");
  const[newMForm,setNewMForm]=useState(false);const[newM,setNewM]=useState({label:"",c:"#7B6FFF",e:"NEW"});
  const dropRef=useRef(null);
  const[showAI,setShowAI]=useState(false);
  const[addForm,setAddForm]=useState(false);
  const[newEx,setNewEx]=useState({name:"",bloc:null,target:"Pecs",exType:"muscu"});
  const[exSearch,setExSearch]=useState("");const[showExDropdown,setShowExDropdown]=useState(false);
  const[supabaseExos,setSupabaseExos]=useState([]);
  // normalizeExName is now defined at the top level
  // Close dropdown on click outside
  useEffect(()=>{if(!showExDropdown)return;const h=e=>{if(dropRef.current&&!dropRef.current.contains(e.target))setShowExDropdown(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[showExDropdown]);
  // Fetch exercises from Supabase DB on mount
  useEffect(()=>{supabase.from('exercises').select('id,name,target,ex_type,secondary,youtube_id,image_url').order('name').then(({data})=>{if(data)setSupabaseExos(data);});},[]);
  // Inject drag shake keyframe
  useEffect(()=>{const s=document.createElement('style');s.id='exShakeKf';s.textContent='@keyframes exShake{0%,100%{transform:rotate(0deg) translateX(0)}25%{transform:rotate(-0.6deg) translateX(-1.5px)}75%{transform:rotate(0.6deg) translateX(1.5px)}}';if(!document.getElementById('exShakeKf'))document.head.appendChild(s);return()=>{const el=document.getElementById('exShakeKf');if(el)el.remove();};},[]);
  // Build unified exercise DB for picker — deduplicate by normalized name
  const exoDB=(()=>{const seen=new Set();const res=[];
    const addIfNew=(e)=>{const norm=normalizeExName(e.name).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({...e,name:normalizeExName(e.name)||e.name});}};
    Object.values(exos||{}).flat().forEach(addIfNew);
    Object.keys(exMeta||{}).forEach(n=>{const norm=normalizeExName(n).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({name:normalizeExName(n)||n,target:exMeta[n]?.target||"Pecs",bloc:"PERF",tier:exMeta[n]?.tier||3});}});
    supabaseExos.forEach(e=>{const norm=normalizeExName(e.name).toLowerCase();if(!seen.has(norm)){seen.add(norm);res.push({name:normalizeExName(e.name)||e.name,target:e.target||"Pecs",exType:e.ex_type||"muscu",bloc:"PERF",tier:3,secondary:e.secondary||[],fromDB:true});}});
    return res;
  })();
  const[undoStack,setUndoStack]=useState([]);
  const[editingSession,setEditingSession]=useState(null);
  const[newSessForm,setNewSessForm]=useState(false);
  const[videoEx,setVideoEx]=useState(null);
  const[newSess,setNewSess]=useState({name:"",short:""});
  const[editingBlocs,setEditingBlocs]=useState(false);
  const[newBlocForm,setNewBlocForm]=useState(false);
  const[newBloc,setNewBloc]=useState({label:"",color:BLOC_COLORS[0]});
  const[editingBlocId,setEditingBlocId]=useState(null);
  const[dragId,setDragId]=useState(null);
  const[dragOverId,setDragOverId]=useState(null);
  const[dragOverBloc,setDragOverBloc]=useState(null);
  const[dragBlocId,setDragBlocId]=useState(null);
  const[dragOverBlocId,setDragOverBlocId]=useState(null);
  const[touchDragId,setTouchDragId]=useState(null);
  const touchTimerRef=useRef(null);
  const touchStartPosRef=useRef(null);
  // Bloquer scroll + sélection pendant touch drag
  useEffect(()=>{
    if(!touchDragId)return;
    const prev={us:document.body.style.userSelect,wus:document.body.style.webkitUserSelect,ov:document.body.style.overflow};
    document.body.style.userSelect='none';document.body.style.webkitUserSelect='none';document.body.style.overflow='hidden';
    return()=>{document.body.style.userSelect=prev.us;document.body.style.webkitUserSelect=prev.wus;document.body.style.overflow=prev.ov;};
  },[touchDragId]);
  const[calWeek,setCalWeek]=useState(currentWeek);
  const[showEditorModal,setShowEditorModal]=useState(false);

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
        const allTrainWeeks=weeksArr.filter(w=>w!==dw);
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
            const weekIdx=trainWeeks.indexOf(w);
            const allWeekIdx=allTrainWeeks.indexOf(w);
            const totalAll=allTrainWeeks.length;
            const progress=totalAll>1?allWeekIdx/(totalAll-1):0;
            if(tc.mode==="rir"){
              const rirRange=tc.rirStart-tc.rirEnd;
              const newRir=Math.round((tc.rirStart-rirRange*progress)*2)/2;
              const kgStep=tc.kgStep??2.5;
              newWeeks[w]={...prevW,...(w1.kg?{kg:roundHalf(w1.kg+kgStep*allWeekIdx)}:{}),sets:defSets,repsRange:defReps,rir:Math.max(0,newRir)};
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
    const mappedBloc=sessBlocs.find(b=>b.id===dbEx.bloc)?.id||sessBlocs[0]?.id||null;
    setNewEx({name:dbEx.name,bloc:mappedBloc,target:dbEx.target||"Pecs",exType:et,tier:dbEx.tier||EX_TIER[dbEx.name]||3});
    setExSearch(dbEx.name);setShowExDropdown(false);
    // Sync target + secondary muscles into exMeta for volume counting
    if(setExMeta&&(dbEx.target||dbEx.secondary?.length)){
      setExMeta(prev=>({...prev,[dbEx.name]:{...(prev[dbEx.name]||{}),primary:dbEx.target||(prev[dbEx.name]?.primary||"Pecs"),...(dbEx.secondary?.length?{secondary:dbEx.secondary}:{})}}));
    }
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
    setOpenEx(id);
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
  const assignToBloc=(exId,blocId)=>{setExos(prev=>({...prev,[sid]:(prev[sid]||[]).map(e=>e.id===exId?{...e,bloc:blocId||null}:e)}));};
  const reorderBloc=(fromId,toId)=>{if(fromId===toId)return;setSessions(prev=>prev.map((s,i)=>{if(i!==safeSess)return s;const base=[...(s.blocs?.length>0?s.blocs:sessBlocs)];const fi=base.findIndex(b=>b.id===fromId);const ti=base.findIndex(b=>b.id===toId);if(fi<0||ti<0)return s;const[moved]=base.splice(fi,1);base.splice(ti,0,moved);return{...s,blocs:base};}));};
  const moveExToBloc=(fromId,toId,targetBlocId)=>{setExos(prev=>{const list=[...(prev[sid]||[])];const fi=list.findIndex(e=>e.id===fromId);const ti=list.findIndex(e=>e.id===toId);if(fi<0||ti<0)return prev;const moved={...list[fi],bloc:targetBlocId||null};list.splice(fi,1);const nti=list.findIndex(e=>e.id===toId);list.splice(nti>=0?nti:ti,0,moved);return{...prev,[sid]:list};});};
  const updField=(eid,f,val)=>setExos(prev=>({...prev,[sid]:prev[sid].map(e=>e.id===eid?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),[f]:f==="sets"||f==="kg"||f==="rir"?isNaN(+val)?val:+val:val}}}:e)}));
  const updExField=(eid,f,val)=>setExos(prev=>({...prev,[sid]:prev[sid].map(e=>e.id===eid?{...e,[f]:val}:e)}));
  const updMP=(eid,p)=>setExos(prev=>{
    const list=(prev[sid]||[]).map(e=>e.id===eid?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),methodParams:p}}}:e);
    const thisMethod=list.find(e=>e.id===eid)?.weeks?.[week]?.method;
    // Auto-pairing superset : met à jour automatiquement l'exercice associé
    if(thisMethod==="superset"&&p?.paired){
      return{...prev,[sid]:list.map(e=>e.id!==p.paired?e:{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),method:"superset",methodParams:{paired:eid}}}})};
    }
    return{...prev,[sid]:list};
  });
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

    {/* ── CALENDRIER SEMAINES ── */}
    {(()=>{
      const weeks=Array.from({length:tw},(_,i)=>i+1);
      return(<div style={{marginBottom:18,background:C.s1,borderRadius:14,overflow:"hidden",border:"1px solid "+C.brd}}>
        {/* Nav semaine */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid "+C.brd,background:C.s2}}>
          <button onClick={()=>setCalWeek(w=>Math.max(1,w-1))} disabled={calWeek<=1} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:calWeek<=1?C.tx3+"40":C.tx2,cursor:calWeek<=1?"default":"pointer",fontSize:16,fontFamily:"inherit",flexShrink:0}}>‹</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:calWeek===currentWeek&&blockStarted?C.g:C.tx}}>Semaine {calWeek} <span style={{fontSize:10,fontWeight:400,color:C.tx3}}>/ {tw}</span></div>
            <div style={{fontSize:10,fontWeight:600,color:calWeek===dw?C.b:calWeek===currentWeek&&blockStarted?C.g:calWeek<currentWeek&&blockStarted?C.o:C.tx3}}>{calWeek===dw?"Deload":calWeek===currentWeek&&blockStarted?"En cours":calWeek<currentWeek&&blockStarted?"Passée":"À venir"}</div>
          </div>
          <button onClick={()=>setCalWeek(w=>Math.min(tw,w+1))} disabled={calWeek>=tw} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:calWeek>=tw?C.tx3+"40":C.tx2,cursor:calWeek>=tw?"default":"pointer",fontSize:16,fontFamily:"inherit",flexShrink:0}}>›</button>
        </div>
        {/* Séances */}
        <div style={{display:"flex",overflowX:"auto",scrollbarWidth:"none"}}>
          {safeSessions.length===0&&<div style={{flex:1,padding:"20px",textAlign:"center",color:C.tx3,fontSize:11}}>Aucune séance</div>}
          {safeSessions.map(s=>{
            const done=(completedSessions[calWeek]||[]).includes(s.id);
            const hasP=(exos[s.id]||[]).some(ex=>ex.weeks[calWeek]);
            const isPast=calWeek<currentWeek&&blockStarted;
            const sc=done?C.g:isPast?C.o:calWeek===currentWeek&&blockStarted?C.ac:C.tx3;
            const sl=done?"Validée":isPast?"Non faite":calWeek===currentWeek&&blockStarted?"En cours":"Planifiée";
            // Stats rapides
            const exs=exos[s.id]||[];
            const setsDoneQ=exs.reduce((a,ex)=>{const r=sets[ex.id+"_"+calWeek]||[];return a+r.filter(x=>x.done).length;},0);
            const setsPlQ=exs.reduce((a,ex)=>a+(ex.weeks[calWeek]?.sets||0),0);
            return(<div key={s.id} onClick={()=>hasP&&(()=>{setSess(safeSessions.findIndex(x=>x.id===s.id));setWeek(calWeek);setShowEditorModal(true);})()} style={{flex:1,minWidth:88,maxWidth:140,padding:"10px 6px 8px",textAlign:"center",cursor:hasP?"pointer":"default",borderRight:"1px solid "+C.brd,background:done?C.g+"08":"transparent",opacity:hasP?1:0.3,transition:"background 0.12s",boxSizing:"border-box"}}
              onMouseEnter={e=>{if(hasP)e.currentTarget.style.background=done?C.g+"14":C.acS;}}
              onMouseLeave={e=>{e.currentTarget.style.background=done?C.g+"08":"transparent";}}>
              <div style={{width:34,height:34,borderRadius:10,background:sc+"20",border:"1.5px solid "+sc+"50",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 5px",fontSize:done?17:12,fontWeight:800,color:sc}}>{done?"✓":s.short}</div>
              <div style={{fontSize:10,fontWeight:700,color:C.tx,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingLeft:2,paddingRight:2}}>{s.name}</div>
              <div style={{fontSize:9,fontWeight:600,color:sc}}>{sl}</div>
              {done&&setsPlQ>0&&<div style={{fontSize:8,color:C.tx3,marginTop:2}}>{setsDoneQ}/{setsPlQ} séries</div>}
            </div>);
          })}
        </div>
        {/* Dots nav semaines */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:3,padding:"7px 10px",borderTop:"1px solid "+C.brd}}>
          {weeks.map(w=>{const wDone=(completedSessions[w]||[]).length>=safeSessions.filter(s=>(exos[s.id]||[]).some(ex=>ex.weeks[w])).length&&safeSessions.filter(s=>(exos[s.id]||[]).some(ex=>ex.weeks[w])).length>0;return(<button key={w} onClick={()=>setCalWeek(w)} title={"S"+w} style={{width:w===calWeek?18:6,height:6,borderRadius:3,border:"none",background:w===calWeek?C.ac:wDone?C.g+"70":(completedSessions[w]||[]).length>0?C.o+"60":C.brdL,cursor:"pointer",transition:"all 0.2s",padding:0,flexShrink:0}}/>);})}
        </div>
      </div>);
    })()}

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
      <div style={{marginBottom:8}}>
        <div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:5}}>Jour assigné</div>
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d,i)=>{const sel=sessions[editingSession]?.day_of_week===i;return(<button key={i} onClick={()=>renameSession(editingSession,"day_of_week",sel?null:i)} style={{padding:"4px 7px",borderRadius:6,border:"1px solid "+(sel?C.coach:C.brdL),background:sel?C.coachS:"transparent",color:sel?C.coach:C.tx3,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}}>{d}</button>);})}
        </div>
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

    {safeSessions.length>0&&<button onClick={()=>setShowEditorModal(true)} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px dashed "+C.coach+"60",background:C.coachS,color:C.coach,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>✎ Éditer le contenu des séances</button>}

    {showEditorModal&&(<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{position:"sticky",top:0,zIndex:5,background:C.bg,borderBottom:"1px solid "+C.brd,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={()=>{setShowEditorModal(false);setOpenEx(null);}} style={{width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:800,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{safeSessions[safeSess]?.name||"Séance"}</div>
          <div style={{fontSize:10,color:C.tx3}}>Semaine {week} / {tw}{week===dw?" · Deload":""}</div>
        </div>
        <div style={{display:"flex",gap:3,flexShrink:0,overflowX:"auto",scrollbarWidth:"none",maxWidth:"40%"}}>
          {safeSessions.map((s,i)=><button key={s.id} onClick={()=>{setSess(i);setOpenEx(null);}} style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"1px solid "+(i===safeSess?C.coach:C.brdL),background:i===safeSess?C.coachS:"transparent",color:i===safeSess?C.coach:C.tx2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s.short}</button>)}
        </div>
      </div>
      <div style={{padding:"16px",maxWidth:900,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

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

    {safeSessions.length>0&&setWeekSchedule&&<div style={{marginBottom:10,background:C.s1,borderRadius:9,padding:"8px 10px",border:"1px solid "+C.brdL}}>
      <div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>Jours séances — S{week}</div>
      {safeSessions.map(s=>{
        const curDay=weekSchedule?.sessions?.[week]?.[s.id]??s.day_of_week??null;
        const setDay=(i)=>{const prev=weekSchedule||{};const prevSess=prev.sessions||{};const wMap={...(prevSess[week]||{})};if(curDay===i){delete wMap[s.id];}else{wMap[s.id]=i;}setWeekSchedule({...prev,sessions:{...prevSess,[week]:wMap}});};
        return(<div key={s.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
          <span style={{fontSize:10,fontWeight:700,color:C.coach,minWidth:46,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.short}</span>
          <div style={{display:"flex",gap:2}}>
            {["L","Ma","Me","J","V","S","D"].map((d,i)=>{const sel=curDay===i;return(<button key={i} onClick={()=>setDay(i)} style={{padding:"3px 5px",borderRadius:5,border:"1px solid "+(sel?C.coach:C.brdL),background:sel?C.coachS:"transparent",color:sel?C.coach:C.tx3,fontSize:9,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}}>{d}</button>);})}
          </div>
        </div>);})}
    </div>}

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
      groups.sort((a,b)=>{const ai=sessBlocs.findIndex(s=>s.id===a.blocId);const bi=sessBlocs.findIndex(s=>s.id===b.blocId);if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return -1;return ai-bi;});
      if(filteredExList.length===0&&exList.length>0)return[<div key="empty" style={{textAlign:"center",padding:"20px 0",color:C.tx3,fontSize:12}}>Aucun exercice ne correspond</div>];
      return groups.map(({blocId,exs:groupExs})=>{
        const bloc=getBlocById(blocId);const blocC=bloc?.color||C.tx3;
        return(<div key={blocId||"__no_bloc__"} onDragOver={e=>{e.preventDefault();if(dragBlocId&&dragBlocId!==blocId)setDragOverBlocId(blocId);else if(dragId&&!dragBlocId)setDragOverBloc(blocId||null);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setDragOverBloc(null);setDragOverBlocId(null);}}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragBlocId&&dragBlocId!==blocId){reorderBloc(dragBlocId,blocId);setDragBlocId(null);setDragOverBlocId(null);}else if(dragId&&!dragBlocId){assignToBloc(dragId,blocId||null);setDragId(null);setDragOverId(null);setDragOverBloc(null);}}} style={{marginBottom:14,borderRadius:14,border:"1px solid "+(dragOverBlocId===blocId&&dragBlocId?blocC+"90":dragOverBloc===blocId&&dragId?blocC+"90":blocC+(bloc?"40":"20")),background:blocC+(bloc?"0D":"00"),overflow:"hidden",transition:"border-color 0.15s",opacity:dragBlocId===blocId?0.5:1}}>
          {/* Bloc header */}
          {bloc&&(<div draggable={true} onDragStart={e=>{e.stopPropagation();setDragBlocId(blocId);e.dataTransfer.effectAllowed="move";}} onDragOver={e=>{e.preventDefault();e.stopPropagation();if(dragBlocId&&dragBlocId!==blocId)setDragOverBlocId(blocId);}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragBlocId&&dragBlocId!==blocId){reorderBloc(dragBlocId,blocId);setDragBlocId(null);setDragOverBlocId(null);}}} onDragEnd={()=>{setDragBlocId(null);setDragOverBlocId(null);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:dragOverBlocId===blocId&&dragBlocId?blocC+"40":dragOverBloc===blocId&&dragId?blocC+"35":blocC+"22",borderBottom:"1px solid "+blocC+"30",cursor:dragBlocId?"grabbing":"grab",transition:"background 0.15s"}}>
            <div style={{color:blocC+"80",fontSize:12,userSelect:"none",flexShrink:0,lineHeight:1}}>⠿</div>
            <div style={{width:4,height:16,borderRadius:2,background:blocC,flexShrink:0}}/>
            <span style={{fontSize:12,fontWeight:800,color:blocC,letterSpacing:"0.2px"}}>{bloc.label}</span>
            <span style={{fontSize:9,color:C.tx3,marginLeft:"auto"}}>{groupExs.length} exercice{groupExs.length>1?"s":""}</span>
          </div>)}
          {/* Exercises */}
          <div style={{padding:bloc?"6px 8px":"0"}}>
          {groupExs.map(ex=>{
            const exIdx=exList.indexOf(ex);const wd=ex.weeks[week]||{};const isOpen=openEx===ex.id;const sk=ex.id+"_"+week;const aNote=athleteNotes[sk]||"";const curM=allMethods[wd.method];const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isFlex=eType!=="muscu"&&eType!=="halterophilie";const exTier=getExTier(ex.name,ex);const exTc=tierCfg[exTier]||tierCfg[3];const typeLabels={muscu:"Muscu",plio:"Plio",mobilite:"Mobilité",halterophilie:"Halté."};const typeColors={muscu:C.tx3,plio:C.o,mobilite:C.b,halterophilie:"#8b5cf6"};
            const bankEx=supabaseExos.find(b=>(ex.exercise_id&&b.id===ex.exercise_id)||fuzzyExMatch(b.name,ex.name));
            const hasVideo=!!(bankEx?.youtube_id||bankEx?.image_url);
            return(<div key={ex.id} data-exid={ex.id} draggable={true} onDragStart={e=>{setDragId(ex.id);e.dataTransfer.effectAllowed="move";}} onDragOver={e=>{e.preventDefault();if(dragBlocId){return;}e.stopPropagation();setDragOverId(ex.id);if(dragId)setDragOverBloc(ex.bloc||null);}} onDrop={e=>{e.preventDefault();if(dragBlocId){return;}e.stopPropagation();if(dragId&&dragId!==ex.id)moveExToBloc(dragId,ex.id,ex.bloc);setDragId(null);setDragOverId(null);setDragOverBloc(null);}} onDragEnd={()=>{setDragId(null);setDragOverId(null);setDragOverBloc(null);}}
              onTouchStart={e=>{const t=e.touches[0];touchStartPosRef.current={x:t.clientX,y:t.clientY};touchTimerRef.current=setTimeout(()=>{setTouchDragId(ex.id);setDragId(ex.id);if(navigator.vibrate)navigator.vibrate(40);},800);}}
              onTouchMove={e=>{if(!touchDragId){const t=e.touches[0];if(Math.abs(t.clientX-(touchStartPosRef.current?.x||0))>8||Math.abs(t.clientY-(touchStartPosRef.current?.y||0))>8)clearTimeout(touchTimerRef.current);return;}e.preventDefault();const t=e.touches[0];const hit=[...document.querySelectorAll('[data-exid]')].find(el=>{const r=el.getBoundingClientRect();return t.clientY>=r.top&&t.clientY<=r.bottom;});if(hit&&hit.dataset.exid!==touchDragId){setDragOverId(hit.dataset.exid);setDragOverBloc(exList.find(x=>x.id===hit.dataset.exid)?.bloc||null);}}}
              onTouchEnd={()=>{clearTimeout(touchTimerRef.current);if(touchDragId){if(dragOverId&&touchDragId!==dragOverId){const tgt=exList.find(x=>x.id===dragOverId);if(tgt)moveExToBloc(touchDragId,dragOverId,tgt.bloc);}setTouchDragId(null);setDragId(null);setDragOverId(null);setDragOverBloc(null);}}}
              style={{background:C.s1,borderRadius:10,marginBottom:4,border:"1px solid "+(dragOverId===ex.id?C.ac:C.brd),overflow:"hidden",opacity:dragId===ex.id?0.65:1,animation:dragId===ex.id?"exShake 0.4s ease-in-out infinite":"none",transition:"opacity 0.15s,border-color 0.15s",userSelect:"none",WebkitUserSelect:"none"}}>
              <div onClick={()=>setOpenEx(isOpen?null:ex.id)} style={{display:"flex",alignItems:"center",padding:"11px 13px",cursor:"pointer",gap:10}}>
                <div style={{width:3,height:28,borderRadius:2,background:blocC,flexShrink:0,position:"relative"}}><span style={{position:"absolute",top:-6,left:-3,fontSize:7,fontWeight:800,color:exTc.c,background:exTc.c+"20",padding:"0 3px",borderRadius:3}}>{isFlex?"":("T"+exTier)}</span></div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:600}}>{ex.name}</span>
                    {eType!=="muscu"&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:typeColors[eType]+"20",color:typeColors[eType],fontWeight:600}}>{typeLabels[eType]}</span>}
                  </div>
                  {!isFlex&&(wd.pdc||wd.kg)?<div style={{fontSize:11,color:C.tx2,marginTop:2}}>{wd.pdc?"PDC":wd.kg+"kg"} - {fmtMR(wd.method,wd.methodParams,wd.sets,wd.repsRange)}{(!wd.method||wd.method==="excentrique"||wd.method==="superset"||wd.method==="dropset"||wd.method==="restpause")?" - ":""}{(!wd.method||wd.method==="excentrique"||wd.method==="superset"||wd.method==="dropset"||wd.method==="restpause")?<span style={{color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</span>:""}</div>
                  :isFlex&&wd.sets?<div style={{fontSize:11,color:C.tx2,marginTop:2}}>{wd.sets}x{wd.repsRange||"?"}{wd.tempo?" tempo "+wd.tempo:""}</div>
                  :<div style={{fontSize:11,color:C.tx3,marginTop:2}}>Aucune prescription</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  {aNote&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:C.b+"20",color:C.b,fontWeight:600}}>retour</span>}
                  {hasVideo&&<button onClick={e=>{e.stopPropagation();setVideoEx(bankEx);}} style={{background:'none',border:'none',color:C.tx3,fontSize:16,cursor:'pointer',padding:'0',lineHeight:1}} title="Voir la vidéo">📹</button>}
                  <button onClick={e=>{e.stopPropagation();moveExercise(ex.id,-1);}} disabled={exIdx===0} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:exIdx===0?C.tx3+"40":C.tx2,fontSize:10,cursor:exIdx===0?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↑</button>
                  <button onClick={e=>{e.stopPropagation();moveExercise(ex.id,1);}} disabled={exIdx===exList.length-1} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.brdL,background:"transparent",color:exIdx===exList.length-1?C.tx3+"40":C.tx2,fontSize:10,cursor:exIdx===exList.length-1?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↓</button>
                  <button onClick={e=>{e.stopPropagation();removeExercise(ex.id);}} style={{width:20,height:20,borderRadius:4,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>x</button>
                  <span style={{fontSize:12,color:C.tx3}}>{isOpen?"^":"v"}</span>
                </div>
              </div>
              {isOpen&&(<div onMouseDown={e=>e.stopPropagation()} style={{padding:"0 13px 16px",borderTop:"1px solid "+C.brd}}>
                {aNote&&<div style={{margin:"12px 0",padding:"10px 12px",borderRadius:8,background:C.b+"12",border:"1px solid "+C.b+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.b,textTransform:"uppercase",marginBottom:4}}>Retour S{week}</div><div style={{fontSize:12,color:C.tx2,lineHeight:1.5,fontStyle:"italic"}}>"{aNote}"</div></div>}
                {(()=>{
                  if(week<=1)return null;
                  const prevW=week-1;
                  const prevSets=(sets[ex.id+"_"+prevW]||[]).filter(s=>s.done);
                  if(!prevSets.length)return null;
                  const prevWd=ex.weeks[prevW]||{};
                  const bestPrev=prevSets.reduce((b,s)=>{const est=e1rm(s.kg||0,s.reps||1);return est>b.est?{...s,est}:b;},{est:0});
                  return(<div style={{margin:"12px 0 0",padding:"10px 12px",borderRadius:8,background:C.g+"0D",border:"1px solid "+C.g+"30"}}>
                    <div style={{fontSize:9,fontWeight:600,color:C.g,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>Réalisé S{prevW}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {prevSets.map((s,i)=>{const rc=rC(s.rir??2);return(<div key={i} style={{padding:"4px 8px",borderRadius:6,background:C.s1,border:"1px solid "+C.brd,fontSize:10}}>
                        <span style={{fontWeight:700,color:C.tx}}>{s.kg||prevWd.kg||"?"}kg</span>
                        <span style={{color:C.tx3}}> × {Array.isArray(s.reps)?s.reps.join("+"):s.reps||"?"}</span>
                        {s.rir!=null&&<span style={{color:rc,marginLeft:3,fontWeight:600}}>RIR{rL(s.rir)}</span>}
                      </div>);})}
                      {bestPrev.est>0&&prevSets.length>1&&<div style={{padding:"4px 8px",borderRadius:6,background:C.g+"15",border:"1px solid "+C.g+"30",fontSize:10,fontWeight:700,color:C.g}}>~{bestPrev.est}kg 1RM</div>}
                    </div>
                    {prevWd.kg&&prevSets[0]?.kg&&prevSets[0].kg!==prevWd.kg&&<div style={{fontSize:9,color:C.tx3,marginTop:4}}>Prévu {prevWd.kg}kg · Réalisé {prevSets[0].kg}kg</div>}
                  </div>);
                })()}
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
                {!isFlex?(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>Charge<button onClick={()=>updField(ex.id,"pdc",!wd.pdc)} style={{padding:"1px 5px",borderRadius:4,border:"1px solid "+(wd.pdc?C.ac:C.brdL),background:wd.pdc?C.acS:"transparent",color:wd.pdc?C.ac:C.tx3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>PDC</button></div>{wd.pdc?<div style={{...fS,display:"flex",alignItems:"center",justifyContent:"center",background:C.acS,border:"1px solid "+C.ac,color:C.ac,fontWeight:700}}>PDC</div>:<input type="number" step="0.5" value={wd.kg??""} placeholder="--" onChange={e=>updField(ex.id,"kg",e.target.value)} style={fS}/>}</div><div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center"}}>Series</div><input type="number" value={wd.sets??""} placeholder="--" onChange={e=>updField(ex.id,"sets",e.target.value)} style={fS}/></div></div>
                ):(<div style={{marginBottom:10}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,textAlign:"center"}}>Series</div><input type="number" value={wd.sets||""} placeholder="--" onChange={e=>updField(ex.id,"sets",e.target.value)} style={fS}/></div>)}
                <div style={{marginBottom:10}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5}}>Repetitions / Duree</div><input type="text" value={wd.repsRange||""} placeholder={isFlex?"30s ou 10":"10 ou 8-12"} onChange={e=>updField(ex.id,"repsRange",e.target.value)} style={{...fS,textAlign:"left",paddingLeft:10}}/></div>
                <div style={{display:"grid",gridTemplateColumns:isFlex?"1fr":"1fr 1fr",gap:8,marginBottom:14}}>
                  <div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5,textAlign:"center"}}>Tempo</div><input type="text" value={wd.tempo||""} placeholder="3-1-2-0" onChange={e=>updField(ex.id,"tempo",e.target.value)} style={{...fS,fontSize:12}}/></div>
                  {!isFlex&&<div><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:5,textAlign:"center"}}>RIR cible</div><div style={{display:"flex",justifyContent:"center"}}><RIRPicker value={wd.rir??2} onChange={v=>updField(ex.id,"rir",v)}/></div></div>}
                </div>
                {!isFlex&&(<div style={{marginBottom:14}}>
                  <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Methode</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    <button onClick={()=>{const oldP=wd.method==="superset"?wd.methodParams?.paired:null;setExos(prev=>{let list=(prev[sid]||[]).map(e=>e.id===ex.id?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),method:null,methodParams:null}}}:e);if(oldP)list=list.map(e=>e.id!==oldP?e:{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),method:null,methodParams:null}}});return{...prev,[sid]:list};});}} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(!wd.method?C.coach:C.brdL),background:!wd.method?C.coachS:"transparent",color:!wd.method?C.coach:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:!wd.method?700:400}}>Standard</button>
                    {Object.entries(allMethods).map(([k,m])=><button key={k} onClick={()=>{const nm=wd.method===k?null:k;const oldP=wd.method==="superset"?wd.methodParams?.paired:null;setExos(prev=>{let list=(prev[sid]||[]).map(e=>e.id===ex.id?{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),method:nm,methodParams:nm?(MDEF[nm]||null):null}}}:e);if(oldP&&nm!=="superset")list=list.map(e=>e.id!==oldP?e:{...e,weeks:{...e.weeks,[week]:{...(e.weeks[week]||{}),method:null,methodParams:null}}});return{...prev,[sid]:list};});}} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(wd.method===k?m.c:C.brdL),background:wd.method===k?m.c+"20":"transparent",color:wd.method===k?m.c:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:wd.method===k?700:400}}>{m.e} {m.label}</button>)}
                    <button onClick={()=>setNewMForm(o=>!o)} style={{padding:"5px 10px",borderRadius:7,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Custom</button>
                  </div>
                  {wd.method&&<MethodParamsForm method={wd.method} params={wd.methodParams} onChange={p=>updMP(ex.id,p)} exosInSession={exList} currentExId={ex.id} plannedKg={wd.pdc?null:wd.kg}/>}
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
      {!addForm?(<button onClick={()=>{setAddForm(true);setNewEx(p=>({...p,bloc:sessBlocs[0]?.id||null}));}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px dashed "+C.g+"50",background:C.gS,color:C.g,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter un exercice ({exList.length})</button>):(
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
                {e.fromDB&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:C.b+"30",color:C.b,fontWeight:700,flexShrink:0}}>DB</span>}
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
            <button onClick={()=>{setAddForm(false);setNewEx({name:"",bloc:sessBlocs[0]?.id||null,target:"Pecs",exType:"muscu"});setExSearch("");setShowExDropdown(false);}} style={{flex:1,padding:"9px 0",borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
            <button onClick={addExercise} style={{flex:2,padding:"9px 0",borderRadius:8,border:"none",background:C.g,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ajouter</button>
          </div>
        </div>
      )}
    </div>
      </div>
    </div>)}
  {videoEx&&(<div onClick={()=>setVideoEx(null)} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{width:'100%',maxWidth:480}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:700,color:C.tx}}>{videoEx.name}</div>
        <button onClick={()=>setVideoEx(null)} style={{background:'none',border:'none',color:C.tx2,fontSize:24,cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>×</button>
      </div>
      {videoEx.youtube_id?(<div style={{position:'relative',paddingBottom:'56.25%',background:'#000',borderRadius:12,overflow:'hidden'}}>
        <iframe src={'https://www.youtube.com/embed/'+videoEx.youtube_id+'?autoplay=1'} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} allow="autoplay; encrypted-media" allowFullScreen/>
      </div>):videoEx.image_url?(
        <img src={videoEx.image_url} style={{width:'100%',borderRadius:12,display:'block'}} alt={videoEx.name}/>
      ):null}
      <button onClick={()=>setVideoEx(null)} style={{width:'100%',marginTop:14,padding:'11px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx3,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Fermer</button>
    </div>
  </div>)}
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

function BlockHistoryViewer({blockHistory,onClose,onDelete}){
  if(!blockHistory?.length)return(<div style={{padding:20,textAlign:"center"}}><div style={{fontSize:14,color:C.tx3,marginBottom:16}}>Aucun bloc archive</div><button onClick={onClose} style={{padding:"8px 20px",borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Fermer</button></div>);
  return(<div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,overflowY:"auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:1}}>
      <div style={{fontSize:14,fontWeight:700}}>Historique des blocs</div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>×</button>
    </div>
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      {blockHistory.slice().reverse().map((block,i)=>{
        const realIdx=blockHistory.length-1-i;
        const prs=getAllPRs(block.exos||{});const totalDone=Object.values(block.completedSessions||{}).flat().length;
        const tw=block.blockConfig?.totalWeeks||6;const totalTarget=(block.goals?.sessionsPerWeek||6)*tw;
        const adherence=totalTarget?Math.round((totalDone/totalTarget)*100):0;
        const date=block.archivedAt?new Date(block.archivedAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
        const big3=getBig3(block.exos||{});
        return(<div key={block.id||i} style={{background:C.s1,borderRadius:14,padding:16,border:"1px solid "+C.brd}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700}}>{block.blockConfig?.blockName||"Bloc "+(blockHistory.length-i)}</div>
              <div style={{fontSize:10,color:C.tx3}}>{date} · {tw} sem. · {totalDone}/{totalTarget} seances ({adherence}%)</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{padding:"4px 10px",borderRadius:8,background:adherence>=80?C.gS:adherence>=50?C.oS:C.rS,color:adherence>=80?C.g:adherence>=50?C.o:C.r,fontSize:11,fontWeight:700}}>{adherence}%</div>
              {onDelete&&<button onClick={()=>onDelete(realIdx)} style={{padding:"4px 10px",borderRadius:8,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Suppr.</button>}
            </div>
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

function NewBlockModal({onStart,onClose,onResume,hasCurrentData,blockHistory=[],onDelete}){
  const[step,setStep]=useState(hasCurrentData?0:1);
  const[blockName,setBlockName]=useState("");
  const[objective,setObjective]=useState("");
  const[totalWeeks,setTotalWeeks]=useState(6);
  const[sessPerWeek,setSessPerWeek]=useState(4);
  const[deloadWeek,setDeloadWeek]=useState(0);
  const[newSessions,setNewSessions]=useState([]);
  const[sessInput,setSessInput]=useState({name:"",short:""});
  const[keep,setKeep]=useState({exos:false,config:true,exMeta:true});
  const[showHistory,setShowHistory]=useState(false);
  const[fromHistory,setFromHistory]=useState(false);
  const[restoredExos,setRestoredExos]=useState(null);
  const toggle=k=>setKeep(p=>({...p,[k]:!p[k]}));
  const addSess=()=>{if(!sessInput.name.trim())return;setNewSessions(p=>[...p,{id:"s_"+Date.now()+"_"+p.length,name:sessInput.name.trim(),short:sessInput.short.trim()||sessInput.name.trim().slice(0,3).toUpperCase()}]);setSessInput({name:"",short:""});};
  const removeSess=i=>setNewSessions(p=>p.filter((_,idx)=>idx!==i));
  const canFinish=blockName.trim();
  const finish=()=>{
    let finalSessions=newSessions;
    if(finalSessions.length===0){finalSessions=Array.from({length:sessPerWeek},(_,i)=>({id:"s_"+Date.now()+"_"+i,name:"Séance "+(i+1),short:"S"+(i+1)}));}
    onStart({...keep,blockName:blockName.trim(),objective:objective.trim(),totalWeeks,sessPerWeek,deloadWeek,sessions:finalSessions,restoredExos:fromHistory?restoredExos:null});
  };
  const loadFromHistory=(block)=>{
    // Remappe les sessions avec de nouveaux IDs et reconstruit les exos correspondants
    const idMap={};
    const mappedSessions=(block.sessions||[]).map(s=>{
      const newId="s_"+Date.now()+"_"+Math.random().toString(36).slice(2);
      idMap[s.id]=newId;
      return{...s,id:newId};
    });
    const mappedExos={};
    Object.entries(block.exos||{}).forEach(([oldId,exList])=>{
      const newId=idMap[oldId];
      if(newId)mappedExos[newId]=exList;
    });
    setBlockName((block.blockConfig?.blockName||"")+" (reprise)");
    setObjective(block.blockConfig?.objective||"");
    setTotalWeeks(block.blockConfig?.totalWeeks||6);
    setSessPerWeek(block.goals?.sessionsPerWeek||4);
    setDeloadWeek(block.blockConfig?.deloadWeek||0);
    setNewSessions(mappedSessions);
    setRestoredExos(mappedExos);
    setFromHistory(true);setShowHistory(false);setStep(1);
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
      <div style={{fontSize:14,fontWeight:700,color:C.coach}}>{step===0?"Que faire du bloc actuel ?":"Nouveau bloc"}</div>
      <button onClick={onClose} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>×</button>
    </div>
    <div style={{padding:16}}>

      {/* Étape 0 : choix si bloc actuel existe */}
      {step===0&&(<>
        <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Un bloc est déjà en cours. Que veux-tu faire ?</div>
        <button onClick={onResume||onClose} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"2px solid "+C.g+"50",background:C.gS,marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.g+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>↩</div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.g}}>Reprendre le bloc en cours</div><div style={{fontSize:11,color:C.tx3}}>Continuer exactement là où tu en étais</div></div>
        </button>
        <button onClick={()=>setShowHistory(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1px solid "+C.b+"50",background:showHistory?C.bS:"transparent",marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.b+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📂</div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.b}}>Reprendre depuis l'historique</div><div style={{fontSize:11,color:C.tx3}}>{blockHistory.length} bloc{blockHistory.length!==1?"s":""} archivé{blockHistory.length!==1?"s":""}</div></div>
        </button>
        {showHistory&&blockHistory.length>0&&(<div style={{marginBottom:10,borderRadius:10,border:"1px solid "+C.brd,overflow:"hidden"}}>
          {blockHistory.slice().reverse().map((block,i)=>{
            const realIdx=blockHistory.length-1-i;
            const date=block.archivedAt?new Date(block.archivedAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"";
            const totalDone=Object.values(block.completedSessions||{}).flat().length;
            return(<div key={block.id||i} style={{display:"flex",alignItems:"center",borderBottom:"1px solid "+C.brd}}>
              <button onClick={()=>loadFromHistory(block)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:C.tx}}>{block.blockConfig?.blockName||"Bloc "+(blockHistory.length-i)}</div>
                  <div style={{fontSize:10,color:C.tx3}}>{date} · {block.blockConfig?.totalWeeks||6} sem. · {totalDone} séances</div>
                </div>
                <span style={{fontSize:11,color:C.b,fontWeight:600,flexShrink:0,marginLeft:8}}>Reprendre →</span>
              </button>
              {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete(realIdx);}} style={{padding:"6px 10px",margin:"0 8px",borderRadius:7,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Suppr.</button>}
            </div>);
          })}
          {blockHistory.length===0&&<div style={{padding:"14px",fontSize:11,color:C.tx3,textAlign:"center"}}>Aucun bloc archivé</div>}
        </div>)}
        <button onClick={()=>setStep(1)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1px solid "+C.coach+"50",background:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.coachS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>➕</div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.coach}}>Créer un nouveau bloc</div><div style={{fontSize:11,color:C.tx3}}>Archiver le bloc actuel et repartir</div></div>
        </button>
      </>)}

      {/* Étape 1 : configuration du bloc */}
      {step===1&&(<>
        {/* Partir d'un ancien bloc */}
        {blockHistory.length>0&&(<div style={{marginBottom:16}}>
          {fromHistory?(
            <div style={{padding:"10px 14px",borderRadius:10,background:C.bS,border:"1px solid "+C.b+"40",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:11,color:C.b,fontWeight:600}}>📂 Basé sur un ancien bloc</div>
              <button onClick={()=>{setFromHistory(false);setRestoredExos(null);setBlockName("");setObjective("");setNewSessions([]);}} style={{fontSize:10,color:C.r,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Effacer</button>
            </div>
          ):(
            <button onClick={()=>setShowHistory(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:"1px solid "+C.b+"40",background:showHistory?C.bS:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{fontSize:16}}>📂</span>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.b}}>Partir d'un ancien bloc</div><div style={{fontSize:10,color:C.tx3}}>{blockHistory.length} bloc{blockHistory.length!==1?"s":""} disponible{blockHistory.length!==1?"s":""}</div></div>
              <span style={{fontSize:11,color:C.tx3,transform:showHistory?"rotate(180deg)":"none",display:"inline-block",transition:"transform 0.2s"}}>∨</span>
            </button>
          )}
          {showHistory&&!fromHistory&&(<div style={{marginTop:6,borderRadius:10,border:"1px solid "+C.brd,overflow:"hidden"}}>
            {blockHistory.slice().reverse().map((block,i)=>{
              const realIdx=blockHistory.length-1-i;
              const date=block.archivedAt?new Date(block.archivedAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"";
              const totalDone=Object.values(block.completedSessions||{}).flat().length;
              return(<div key={block.id||i} style={{display:"flex",alignItems:"center",borderBottom:"1px solid "+C.brd}}>
                <button onClick={()=>loadFromHistory(block)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.tx}}>{block.blockConfig?.blockName||"Bloc "+(blockHistory.length-i)}</div>
                    <div style={{fontSize:10,color:C.tx3}}>{date}{date?" · ":""}{block.blockConfig?.totalWeeks||6} sem. · {totalDone} séances réalisées</div>
                  </div>
                  <span style={{fontSize:11,color:C.b,fontWeight:600,flexShrink:0,marginLeft:8}}>Utiliser →</span>
                </button>
                {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete(realIdx);}} style={{padding:"6px 10px",margin:"0 8px",borderRadius:7,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Suppr.</button>}
              </div>);
            })}
          </div>)}
        </div>)}
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
        {hasCurrentData&&!fromHistory&&(<div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",marginBottom:8}}>Que garder du bloc précédent ?</div>
          {[{k:"exos",l:"Exercices (prog)",desc:"Garder les exercices planifiés"},{k:"config",l:"Config (tiers, deload...)",desc:"Garder les réglages de surcharge"},{k:"exMeta",l:"Base Exos (muscles)",desc:"Garder les métadonnées exercices"}].map(({k,l,desc})=>(<div key={k} onClick={()=>toggle(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:keep[k]?C.gS:"transparent",border:"1px solid "+(keep[k]?C.g+"50":C.brdL),marginBottom:6,cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:5,border:"2px solid "+(keep[k]?C.g:C.tx3),background:keep[k]?C.g:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,flexShrink:0}}>{keep[k]?"✓":""}</div>
            <div><div style={{fontSize:12,fontWeight:600,color:keep[k]?C.g:C.tx2}}>{l}</div><div style={{fontSize:10,color:C.tx3}}>{desc}</div></div>
          </div>))}
        </div>)}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>hasCurrentData?setStep(0):onClose()} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{hasCurrentData?"Retour":"Annuler"}</button>
          <button disabled={!canFinish} onClick={finish} style={{flex:2,padding:"10px 0",borderRadius:10,border:"none",background:canFinish?C.coach:C.s2,color:canFinish?"#fff":C.tx3,fontSize:12,fontWeight:700,cursor:canFinish?"pointer":"default",fontFamily:"inherit"}}>Créer le bloc</button>
        </div>
      </>)}
    </div>
  </div>);
}

function CoachEnergyProgram({athleteId,energyEditorKey,setEnergyEditorKey,energySessions,setEnergySessions,energySessionsLoaded,setEnergySessionsLoaded,C,blockConfig,currentWeek=1,weekPlan,setWeekPlan,dayPlan,setDayPlan}){
  const[creating,setCreating]=useState(false);const[newLabel,setNewLabel]=useState("");const[loading,setLoading]=useState(false);
  const[weekPlanLoaded,setWeekPlanLoaded]=useState(false);
  const[selWeek,setSelWeek]=useState(currentWeek||1);const[showAssign,setShowAssign]=useState(false);
  const tw=blockConfig?.totalWeeks||6;const dw=blockConfig?.deloadWeek||0;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);

  const loadSessions=async()=>{
    setLoading(true);
    const{data}=await supabase.from("energy_session_config").select("id,session_key,session_label,appareil_types,updated_at").eq("athlete_id",athleteId).order("updated_at",{ascending:false});
    setEnergySessions(data||[]);setEnergySessionsLoaded(true);setLoading(false);
  };
  useEffect(()=>{if(!energySessionsLoaded)loadSessions();},[athleteId,energySessionsLoaded]);
  const saveWeekPlan=async(plan)=>{await supabase.from('app_data').upsert({athlete_id:athleteId,key:'asp:energy_week_plan',value:plan,updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});};
  const saveDayPlan=async(plan)=>{await supabase.from('app_data').upsert({athlete_id:athleteId,key:'asp:energy_day_plan',value:plan,updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});};
  const toggleSessionInWeek=(w,key)=>{const cur=weekPlan[w]||[];const next=cur.includes(key)?cur.filter(k=>k!==key):[...cur,key];const plan={...weekPlan,[w]:next};setWeekPlan(plan);saveWeekPlan(plan);};
  const setSessionDay=(w,key,day)=>{const wDays={...(dayPlan[w]||{}),[key]:day};const plan={...dayPlan,[w]:wDays};setDayPlan(plan);saveDayPlan(plan);};

  const handleCreate=async()=>{
    if(!newLabel.trim())return;
    const key="energy_"+Date.now();
    const{data,error}=await supabase.from("energy_session_config").insert({athlete_id:athleteId,session_key:key,session_label:newLabel.trim(),appareil_types:[],custom_appareils:[],blocks:[],created_by:athleteId}).select("id,session_key,session_label").single();
    if(!error&&data){setEnergySessionsLoaded(false);setEnergyEditorKey({key:data.session_key,label:data.session_label});}
    setCreating(false);setNewLabel("");
  };
  const handleDelete=async(sessionKey,e)=>{
    e.stopPropagation();
    if(!window.confirm("Supprimer cette séance énergétique ?"))return;
    await supabase.from("energy_session_config").delete().eq("athlete_id",athleteId).eq("session_key",sessionKey);
    const newPlan={};Object.entries(weekPlan).forEach(([w,keys])=>{newPlan[w]=keys.filter(k=>k!==sessionKey);});setWeekPlan(newPlan);saveWeekPlan(newPlan);const newDayPlan={};Object.entries(dayPlan).forEach(([w,d])=>{const nd={...d};delete nd[sessionKey];newDayPlan[w]=nd;});setDayPlan(newDayPlan);saveDayPlan(newDayPlan);
    setEnergySessionsLoaded(false);
  };
  if(energyEditorKey){
    return(<EnergySessionEditor athleteId={athleteId} sessionKey={energyEditorKey.key} sessionLabel={energyEditorKey.label} onClose={()=>{setEnergyEditorKey(null);setEnergySessionsLoaded(false);}} C={C}/>);
  }

  const weekKeys=weekPlan[selWeek]||[];
  const weekSessions=weekKeys.map(k=>energySessions.find(s=>s.session_key===k)).filter(Boolean);

  return(<div>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{fontSize:16,fontWeight:700}}>Énergétique{blockConfig?.blockName&&<span style={{fontSize:11,color:C.coach,fontWeight:600,marginLeft:8}}>{blockConfig.blockName} · {tw} sem.</span>}</div>
      <button onClick={()=>setCreating(true)} style={{padding:"7px 14px",borderRadius:9,border:"none",background:C.coach,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Séance</button>
    </div>

    {/* Create form */}
    {creating&&(<div style={{background:C.s1,borderRadius:12,padding:"14px 16px",border:"1px solid "+C.coach+"40",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>Nom de la séance</div>
      <div style={{display:"flex",gap:8}}>
        <input autoFocus value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleCreate();if(e.key==="Escape"){setCreating(false);setNewLabel("");}}} placeholder="ex: Fractionné 30/30" style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        <button onClick={handleCreate} style={{padding:"8px 16px",borderRadius:8,border:"none",background:C.coach,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Créer</button>
        <button onClick={()=>{setCreating(false);setNewLabel("");}} style={{padding:"8px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
      </div>
    </div>)}

    {loading?(<div style={{textAlign:"center",padding:"40px 0",color:C.tx3,fontSize:12}}>Chargement…</div>):(<>
      {/* ── CALENDRIER BLOC SEMAINES ── */}
      <div style={{marginBottom:18,background:C.s1,borderRadius:14,overflow:"hidden",border:"1px solid "+C.brd}}>
        {/* Nav semaine */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid "+C.brd,background:C.s2}}>
          <button onClick={()=>setSelWeek(w=>Math.max(1,w-1))} disabled={selWeek<=1} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:selWeek<=1?C.tx3+"40":C.tx2,cursor:selWeek<=1?"default":"pointer",fontSize:16,fontFamily:"inherit",flexShrink:0}}>‹</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:selWeek===currentWeek?C.g:C.tx}}>Semaine {selWeek} <span style={{fontSize:10,fontWeight:400,color:C.tx3}}>/ {tw}</span></div>
            <div style={{fontSize:10,fontWeight:600,color:selWeek===dw?C.b:selWeek===currentWeek?C.g:C.tx3}}>{selWeek===dw?"Deload":selWeek===currentWeek?"En cours":selWeek<currentWeek?"Passée":"À venir"}</div>
          </div>
          <button onClick={()=>setSelWeek(w=>Math.min(tw,w+1))} disabled={selWeek>=tw} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:selWeek>=tw?C.tx3+"40":C.tx2,cursor:selWeek>=tw?"default":"pointer",fontSize:16,fontFamily:"inherit",flexShrink:0}}>›</button>
        </div>
        {/* Séances assignées à cette semaine */}
        <div style={{padding:12,minHeight:70}}>
          {energySessions.length===0?(<div style={{textAlign:"center",padding:"16px 0",color:C.tx3,fontSize:12}}>Crée d'abord des séances énergétiques ci-dessous</div>)
          :weekSessions.length===0?(<div style={{textAlign:"center",padding:"16px 0",color:C.tx3,fontSize:12}}>Aucune séance assignée à S{selWeek} — <span style={{color:C.coach,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowAssign(true)}>assigner</span></div>)
          :(<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
            {weekSessions.map(s=>{const appareilStr=(s.appareil_types||[]).join(", ")||"";return(<div key={s.session_key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+C.coach+"30"}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.coach+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⚡</div>
              <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setEnergyEditorKey({key:s.session_key,label:s.session_label||s.session_key})}>
                <div style={{fontSize:12,fontWeight:700,color:C.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.session_label||s.session_key}</div>
                {appareilStr&&<div style={{fontSize:9,color:C.tx3}}>{appareilStr}</div>}
              </div>
              <button onClick={()=>toggleSessionInWeek(selWeek,s.session_key)} title="Retirer de cette semaine" style={{width:22,height:22,borderRadius:5,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
            </div>);})}
          </div>)}
          <button onClick={()=>setShowAssign(true)} style={{width:"100%",padding:"8px 0",borderRadius:8,border:"1px dashed "+C.coach+"60",background:"transparent",color:C.coach,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:weekSessions.length>0?4:0}}>+ Assigner une séance à S{selWeek}</button>
        </div>
        {/* Dots nav semaines */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:3,padding:"7px 10px",borderTop:"1px solid "+C.brd}}>
          {weeksArr.map(w=>{const hasSess=(weekPlan[w]||[]).length>0;const isDL=w===dw;return(<button key={w} onClick={()=>setSelWeek(w)} title={"S"+w} style={{width:w===selWeek?18:6,height:6,borderRadius:3,border:"none",background:w===selWeek?C.coach:isDL?C.b+"70":hasSess?C.coach+"60":C.brdL,cursor:"pointer",transition:"all 0.2s",padding:0,flexShrink:0}}/>);})}
        </div>
      </div>

      {/* ── LISTE DES TEMPLATES ── */}
      {energySessions.length>0&&(<>
        <div style={{fontSize:10,fontWeight:700,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Templates de séances</div>
        {energySessions.map(s=>{
          const usedInWeeks=weeksArr.filter(w=>(weekPlan[w]||[]).includes(s.session_key));
          return(<div key={s.session_key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid "+C.brdL,background:C.s1,marginBottom:8}}>
            <div onClick={()=>setEnergyEditorKey({key:s.session_key,label:s.session_label||s.session_key})} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,cursor:"pointer"}}>
              <div style={{width:34,height:34,borderRadius:9,background:C.coach+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⚡</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:C.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.session_label||s.session_key}</div>
                <div style={{fontSize:9,color:C.tx3,marginTop:1}}>
                  {(s.appareil_types||[]).join(", ")||"—"}
                  {usedInWeeks.length>0&&<span style={{color:C.coach,marginLeft:6}}>S{usedInWeeks.join(", S")}</span>}
                </div>
              </div>
            </div>
            <button onClick={e=>handleDelete(s.session_key,e)} style={{padding:"4px 8px",borderRadius:7,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Suppr.</button>
            <div onClick={()=>setEnergyEditorKey({key:s.session_key,label:s.session_label||s.session_key})} style={{color:C.tx3,fontSize:14,cursor:"pointer",flexShrink:0}}>›</div>
          </div>);
        })}
      </>)}

      {energySessions.length===0&&(<div style={{textAlign:"center",padding:"32px 20px"}}><div style={{fontSize:36,marginBottom:12}}>⚡</div><div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:4}}>Aucune séance énergétique</div><div style={{fontSize:12,color:C.tx3}}>Crée une séance pour configurer le cardio de l'athlète.</div></div>)}
    </>)}

    {/* Modal assignation */}
    {showAssign&&(<div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowAssign(false)}>
      <div style={{width:"100%",maxWidth:640,background:C.s1,borderRadius:"16px 16px 0 0",padding:"20px 20px 32px",overflowY:"auto",maxHeight:"70vh"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.tx}}>Séances — Semaine {selWeek}</div>
          <button onClick={()=>setShowAssign(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {energySessions.map(s=>{const assigned=(weekPlan[selWeek]||[]).includes(s.session_key);const sessDay=dayPlan[selWeek]?.[s.session_key]??null;const DAY_S=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];return(<div key={s.session_key} style={{marginBottom:8,borderRadius:10,border:"1px solid "+(assigned?C.coach+"60":C.brdL),background:assigned?C.coach+"12":C.s2,overflow:"hidden"}}>
          <div onClick={()=>toggleSessionInWeek(selWeek,s.session_key)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(assigned?C.coach:C.tx3),background:assigned?C.coach:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,flexShrink:0}}>{assigned?"✓":""}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:assigned?C.coach:C.tx}}>{s.session_label||s.session_key}</div>
              {(s.appareil_types||[]).length>0&&<div style={{fontSize:10,color:C.tx3}}>{(s.appareil_types||[]).join(", ")}</div>}
            </div>
          </div>
          {assigned&&(<div style={{padding:"0 14px 12px",display:"flex",gap:5,flexWrap:"wrap"}}>
            <div style={{fontSize:9,color:C.tx3,width:"100%",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.3px"}}>Jour :</div>
            {DAY_S.map((d,i)=>(<button key={i} onClick={e=>{e.stopPropagation();setSessionDay(selWeek,s.session_key,sessDay===i?null:i);}} style={{padding:"3px 8px",borderRadius:6,border:"1px solid "+(sessDay===i?C.coach:C.brdL),background:sessDay===i?C.coach:"transparent",color:sessDay===i?"#fff":C.tx3,fontSize:10,fontWeight:sessDay===i?700:400,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>))}
          </div>)}
        </div>);})}</div>
    </div>)}
  </div>);
}

function CoachConfig({completedSessions,uncompleteSession,sessions,weeksArr,onNewBlock,onShowHistory,blockHistoryCount}){
  return(<div>
    <div style={{background:C.s1,borderRadius:14,padding:"12px 16px",border:"1px solid "+C.brd,marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Annuler séances</div>
      {weeksArr.map(w=>{const done=completedSessions[w]||[];if(!done.length)return null;return(<div key={w} style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.tx2,marginBottom:6}}>S{w}</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{done.map(sid=>{const s=sessions.find(x=>x.id===sid);return(<button key={sid} onClick={()=>uncompleteSession(sid,w)} style={{padding:"5px 10px",borderRadius:8,border:"1px solid "+C.r+"40",background:C.rS+"80",color:C.r,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s?.short||sid} x</button>);})}</div></div>);})}
      {Object.values(completedSessions).every(a=>!a?.length)&&<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"8px 0"}}>Aucune séance validée</div>}
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}>
      <button onClick={onNewBlock} style={{flex:2,padding:"12px 0",borderRadius:12,border:"none",background:C.coach,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button>
      <button onClick={onShowHistory} style={{flex:1,padding:"12px 0",borderRadius:12,border:"1px solid "+C.brdL,background:C.s1,color:C.tx2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>Historique{blockHistoryCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.ac,color:"#fff",fontSize:9,fontWeight:800,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{blockHistoryCount}</span>}</button>
    </div>
  </div>);
}

function TierConfigModal({blockConfig,setBlockConfig,onClose}){
  const tw=blockConfig?.totalWeeks||6;
  const row=(label,desc,val,onM,onP,fmt)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.brd}}><div><div style={{fontSize:13,fontWeight:600}}>{label}</div>{desc&&<div style={{fontSize:10,color:C.tx3}}>{desc}</div>}</div><div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={onM} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>-</button><span style={{fontSize:15,fontWeight:800,color:C.o,minWidth:40,textAlign:"center"}}>{fmt?fmt(val):val}</span><button onClick={onP} style={{width:28,height:28,borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>+</button></div></div>);
  return(<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{width:"100%",maxWidth:640,background:C.s1,borderRadius:"16px 16px 0 0",padding:24,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div><div style={{fontSize:15,fontWeight:700}}>Surcharge progressive</div><div style={{fontSize:11,color:C.tx3,marginTop:2}}>Paramètres de progression par catégorie d'exercice</div></div>
        <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      {[1,2,3].map(t=>{const tc=(blockConfig?.tierConfig||DEF_TIER_CONFIG)[t];const updTier=(f,v)=>setBlockConfig(c=>{const tc2={...(c.tierConfig||DEF_TIER_CONFIG)};tc2[t]={...tc2[t],[f]:v};return{...c,tierConfig:tc2};});
        return(<div key={t} style={{marginBottom:12,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+tc.c+"30"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:800,color:tc.c}}>T{t}</span><span style={{fontSize:12,fontWeight:700,color:tc.c}}>{tc.label}</span><span style={{fontSize:10,color:C.tx3}}>{tc.desc}</span></div>
          <div style={{fontSize:9,color:C.tx3,marginBottom:6}}>Stratégie : {tc.mode==="rir"?"+"+( tc.kgStep??2.5)+"kg/sem, RIR "+tc.rirStart+"→"+tc.rirEnd:tc.mode==="reps"?"Reps "+tc.repsStart+"→"+tc.repsEnd+" puis +"+( tc.kgStep??2.5)+"kg":"Reps "+tc.repsStart+"→"+tc.repsEnd+" à l'échec puis +"+( tc.kgStep??1.25)+"kg"}</div>
          {tc.mode==="rir"&&(<div>{row("RIR départ","",tc.rirStart,()=>updTier("rirStart",Math.max(1,tc.rirStart-0.5)),()=>updTier("rirStart",Math.min(5,tc.rirStart+0.5)))}{row("RIR fin","",tc.rirEnd,()=>updTier("rirEnd",Math.max(0,tc.rirEnd-0.5)),()=>updTier("rirEnd",Math.min(tc.rirStart-0.5,tc.rirEnd+0.5)))}{row("kg/semaine","incrément fixe",tc.kgStep??2.5,()=>updTier("kgStep",Math.max(0.5,(tc.kgStep??2.5)-0.5)),()=>updTier("kgStep",Math.min(20,(tc.kgStep??2.5)+0.5)),v=>"+"+v+"kg")}</div>)}
          {tc.mode==="reps"&&(<div>{row("Reps début","",tc.repsStart,()=>updTier("repsStart",Math.max(6,tc.repsStart-1)),()=>updTier("repsStart",Math.min(tc.repsEnd-1,tc.repsStart+1)))}{row("Reps fin","",tc.repsEnd,()=>updTier("repsEnd",Math.max(tc.repsStart+1,tc.repsEnd-1)),()=>updTier("repsEnd",Math.min(20,tc.repsEnd+1)))}{row("kg/cycle","incrément au reset",tc.kgStep??2.5,()=>updTier("kgStep",Math.max(0.5,(tc.kgStep??2.5)-0.5)),()=>updTier("kgStep",Math.min(20,(tc.kgStep??2.5)+0.5)),v=>"+"+v+"kg")}</div>)}
          {tc.mode==="failure"&&(<div>{row("Reps début","",tc.repsStart,()=>updTier("repsStart",Math.max(8,tc.repsStart-1)),()=>updTier("repsStart",Math.min(tc.repsEnd-1,tc.repsStart+1)))}{row("Reps max","",tc.repsEnd,()=>updTier("repsEnd",Math.max(tc.repsStart+1,tc.repsEnd-1)),()=>updTier("repsEnd",Math.min(25,tc.repsEnd+1)))}{row("kg/cycle","incrément au reset",tc.kgStep??1.25,()=>updTier("kgStep",Math.max(0.25,(tc.kgStep??1.25)-0.25)),()=>updTier("kgStep",Math.min(10,(tc.kgStep??1.25)+0.25)),v=>"+"+v+"kg")}</div>)}
          {(blockConfig?.deloadWeek||0)>0&&<div style={{marginTop:6}}>{row("Deload","% réduction",tc.deloadPct,()=>updTier("deloadPct",Math.max(10,tc.deloadPct-5)),()=>updTier("deloadPct",Math.min(60,tc.deloadPct+5)),v=>"-"+v+"%")}</div>}
        </div>);
      })}
      <button onClick={onClose} style={{width:"100%",marginTop:8,padding:"13px 0",borderRadius:12,border:"none",background:C.o,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Appliquer</button>
    </div>
  </div>);
}

function CoachWeeklyFeedback({athleteId,sessions,completedSessions,energySessions,currentWeek,blockConfig,exos,sets,wellnessHistory={},C}){
  const tw=blockConfig?.totalWeeks||6;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const[selWeek,setSelWeek]=useState(currentWeek);
  const[feedbacks,setFeedbacks]=useState({});
  const[draft,setDraft]=useState("");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[expandedSess,setExpandedSess]=useState(null);

  useEffect(()=>{(async()=>{const{data}=await supabase.from('app_data').select('value').eq('athlete_id',athleteId).eq('key','asp:coach_feedback').maybeSingle();if(data?.value)setFeedbacks(data.value);})();},[athleteId]);
  useEffect(()=>{setDraft(feedbacks[selWeek]?.note||"");},[selWeek,feedbacks]);

  const saveFeedback=async()=>{
    setSaving(true);
    const updated={...feedbacks,[selWeek]:{note:draft,date:new Date().toISOString(),week:selWeek}};
    await supabase.from('app_data').upsert({athlete_id:athleteId,key:'asp:coach_feedback',value:updated,updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});
    setFeedbacks(updated);setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const deleteFeedback=async(wk)=>{
    const updated={...feedbacks};delete updated[wk];
    await supabase.from('app_data').upsert({athlete_id:athleteId,key:'asp:coach_feedback',value:updated,updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});
    setFeedbacks(updated);if(+wk===selWeek)setDraft("");
  };

  const doneIds=completedSessions[selWeek]||[];
  const doneSessions=sessions.filter(s=>doneIds.includes(s.id));
  const missedSessions=sessions.filter(s=>!doneIds.includes(s.id));
  const energyDone=(energySessions||[]).filter(s=>{const logs=s._logs||[];return logs.some(l=>l.week===selWeek);});

  // Données wellness de la semaine
  const weekScore=typeof wellnessHistory[selWeek]==="number"?wellnessHistory[selWeek]:null;
  const weekEntries=(()=>{
    if(!blockConfig?.startDate)return[];
    const start=new Date(blockConfig.startDate);
    const wkStart=new Date(start.getTime()+(selWeek-1)*7*86400000);
    const wkEnd=new Date(wkStart.getTime()+7*86400000);
    return Object.entries(wellnessHistory).filter(([k,v])=>/^\d{8}$/.test(k)&&v?.score!=null).map(([k,v])=>{
      const y=+k.slice(0,4),mo=+k.slice(4,6)-1,d=+k.slice(6,8);
      return{date:new Date(y,mo,d),data:v,key:k};
    }).filter(e=>e.date>=wkStart&&e.date<wkEnd).sort((a,b)=>a.date-b.date);
  })();
  const avgScore=weekEntries.length?Math.round(weekEntries.reduce((s,e)=>s+(e.data.score||0),0)/weekEntries.length):weekScore;
  const sleepEntries=weekEntries.filter(e=>e.data.sleepDur!=null);
  const avgSleep=sleepEntries.length?Math.round(sleepEntries.reduce((s,e)=>s+e.data.sleepDur,0)/sleepEntries.length*10)/10:null;
  const scColor=sc=>sc>=80?C.g:sc>=65?C.o:sc>=50?"#f5a623":C.r;
  const fmtReps=r=>Array.isArray(r)?r.join("+"):r;

  return(<div style={{padding:"16px 16px 80px"}}>
    <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.5px",marginBottom:4}}>Retour de la semaine</div>
    <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Bilan hebdomadaire pour l'athlète</div>

    {/* Sélecteur semaine */}
    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>{weeksArr.map(w=>{const hasFb=!!feedbacks[w]?.note;const isDone=(completedSessions[w]||[]).length>0;return(<button key={w} onClick={()=>setSelWeek(w)} style={{flexShrink:0,minWidth:44,padding:"8px 10px",borderRadius:10,border:selWeek===w?"2px solid "+C.coach:"1px solid "+(hasFb?C.g+"40":isDone?C.brdL:C.brd),background:selWeek===w?C.coachS:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"center",position:"relative"}}>{hasFb&&<div style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:C.g}}/>}<div style={{fontSize:10,fontWeight:selWeek===w?800:600,color:selWeek===w?C.coach:C.tx3}}>S{w}</div>{isDone&&<div style={{fontSize:7,color:(completedSessions[w]||[]).length>=sessions.filter(s=>(exos[s.id]||[]).length>0).length?C.g:C.o}}>●</div>}</button>);})}</div>

    {/* Résumé forme + sommeil */}
    {(avgScore!=null||avgSleep!=null)&&<div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brdL,padding:"12px 14px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
      {avgScore!=null&&<div style={{textAlign:"center",minWidth:52}}>
        <div style={{fontSize:8,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>Forme</div>
        <div style={{fontSize:28,fontWeight:900,color:scColor(avgScore),lineHeight:1}}>{avgScore}</div>
        <div style={{fontSize:8,color:C.tx3}}>/100</div>
      </div>}
      {avgScore!=null&&avgSleep!=null&&<div style={{width:1,alignSelf:"stretch",background:C.brd}}/>}
      {avgSleep!=null&&<div style={{textAlign:"center",minWidth:52}}>
        <div style={{fontSize:8,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>Sommeil</div>
        <div style={{fontSize:28,fontWeight:900,color:avgSleep>=7.5?C.g:avgSleep>=6?C.o:C.r,lineHeight:1}}>{avgSleep}</div>
        <div style={{fontSize:8,color:C.tx3}}>h moy.</div>
      </div>}
      {weekEntries.length>0&&<div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:8,color:C.tx3,marginBottom:4}}>{weekEntries.length} bilan(s) cette semaine</div>
        <div style={{display:"flex",gap:3}}>{weekEntries.map(e=>{const sc=e.data.score||0;return(<div key={e.key} style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:7,color:C.tx3}}>{String(e.date.getDate()).padStart(2,"0")}/{String(e.date.getMonth()+1).padStart(2,"0")}</div>
          <div style={{height:22,borderRadius:3,background:scColor(sc)+"40",display:"flex",alignItems:"center",justifyContent:"center",marginTop:2}}><span style={{fontSize:8,fontWeight:700,color:scColor(sc)}}>{sc}</span></div>
          {e.data.sleepDur!=null&&<div style={{fontSize:7,color:C.b,marginTop:1}}>💤{e.data.sleepDur}h</div>}
        </div>);})}
        </div>
      </div>}
    </div>}

    {/* Séances */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Séances — S{selWeek}</div>
      {doneSessions.length===0&&energyDone.length===0&&missedSessions.length===0&&<div style={{fontSize:12,color:C.tx3,padding:"8px 0"}}>Aucune séance programmée</div>}

      {/* Faites */}
      {doneSessions.map(s=>{
        const sessExos=exos[s.id]||[];const isExp=expandedSess===s.id;
        return(<div key={s.id} style={{background:C.s1,borderRadius:12,border:"1px solid "+C.g+"40",marginBottom:6,overflow:"hidden"}}>
          <button onClick={()=>setExpandedSess(isExp?null:s.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{width:28,height:28,borderRadius:8,background:C.g+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>✅</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.g}}>{s.name}</div><div style={{fontSize:10,color:C.tx3}}>{sessExos.length} exercices</div></div>
            <span style={{fontSize:11,color:C.tx3,transform:isExp?"rotate(180deg)":"none",transition:"transform 0.2s"}}>∨</span>
          </button>
          {isExp&&<div style={{borderTop:"1px solid "+C.brd,padding:"8px 14px 12px"}}>
            {sessExos.map(ex=>{
              const sk=ex.id+"_"+selWeek;const rows=(sets[sk]||[]).filter(r=>r.done);
              const planned=ex.weeks?.[selWeek];
              return(<div key={ex.id} style={{padding:"6px 0",borderBottom:"1px solid "+C.brd+"50"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:rows.length?4:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.tx}}>{ex.name}</div>
                  {planned?.sets&&planned?.repsRange&&<div style={{fontSize:10,color:C.tx3,background:C.s2,padding:"1px 6px",borderRadius:5}}>{planned.sets}×{planned.repsRange}</div>}
                </div>
                {rows.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{rows.map((r,i)=>{const rc=r.rir!=null?(r.rir<=0?C.r:r.rir<=1?C.o:C.g):C.tx3;return(<span key={i} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:C.g+"15",color:C.g,fontWeight:600}}>{r.kg}kg×{fmtReps(r.reps)}{r.rir!=null&&<span style={{color:rc,fontWeight:400}}> R{r.rir}</span>}</span>);})}</div>}
                {rows.length===0&&<div style={{fontSize:9,color:C.tx3}}>Pas de séries enregistrées</div>}
              </div>);
            })}
          </div>}
        </div>);
      })}

      {/* Énergie faites */}
      {energyDone.map(s=><div key={s.session_key} style={{background:C.s1,borderRadius:12,border:"1px solid "+C.coach+"40",padding:"11px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,borderRadius:8,background:C.coach+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>⚡</div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.coach}}>{s.session_label||s.session_key}</div></div>
        <span style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:C.coach+"20",color:C.coach}}>Énergie</span>
      </div>)}

      {/* Non réalisées */}
      {missedSessions.length>0&&<div style={{marginTop:doneSessions.length||energyDone.length?10:0}}>
        <div style={{fontSize:9,color:C.tx3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>Non réalisées</div>
        {missedSessions.map(s=>{const sessExos=exos[s.id]||[];return(<div key={s.id} style={{background:C.s1,borderRadius:12,border:"1px solid "+C.r+"25",marginBottom:5,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,opacity:0.7}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.r+"12",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>❌</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.tx2}}>{s.name}</div><div style={{fontSize:10,color:C.tx3}}>{sessExos.length} exercices programmés</div></div>
        </div>);})}
      </div>}
    </div>

    {/* Note hebdomadaire */}
    <div style={{background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.coach+"40",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.coach,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Bilan coach — S{selWeek}</div>
      <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={"Retour sur la semaine "+selWeek+" : progression, points forts, axes d'amélioration..."} rows={5} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:12,lineHeight:1.6}}/>
      {feedbacks[selWeek]?.date&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:10,color:C.tx3}}>Dernière modif. : {new Date(feedbacks[selWeek].date).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</div><button onClick={()=>deleteFeedback(selWeek)} style={{padding:"3px 9px",borderRadius:6,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Supprimer</button></div>}
      <button onClick={saveFeedback} disabled={saving||!draft.trim()} style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",background:saved?C.g:draft.trim()?C.coach:"#333",color:saved||draft.trim()?"#fff":C.tx3,fontSize:13,fontWeight:700,cursor:draft.trim()&&!saving?"pointer":"default",fontFamily:"inherit"}}>
        {saving?"Enregistrement…":saved?"✓ Retour enregistré":"Enregistrer le retour"}
      </button>
    </div>

    {/* Historique retours */}
    {Object.entries(feedbacks).filter(([,f])=>f?.note).sort((a,b)=>+b[0]-+a[0]).slice(0,5).length>0&&(<div>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Retours précédents</div>
      {Object.entries(feedbacks).filter(([,f])=>f?.note).sort((a,b)=>+b[0]-+a[0]).slice(0,5).map(([wk,f])=>(
        <div key={wk} style={{background:C.s1,borderRadius:10,padding:"10px 14px",border:"1px solid "+C.brd,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:700,color:C.coach}}>S{wk}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:C.tx3}}>{f.date?new Date(f.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):""}</span>
              <button onClick={()=>deleteFeedback(wk)} style={{padding:"2px 8px",borderRadius:5,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          </div>
          <div style={{fontSize:12,color:C.tx2,lineHeight:1.55}}>{f.note}</div>
        </div>
      ))}
    </div>)}
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

function SessionEndModal({duration,onSave,C}){
  const[note,setNote]=useState("");
  const[forme,setForme]=useState(7);
  const mins=Math.floor(duration/60);const secs=duration%60;
  const formeColor=forme>=8?C.g:forme>=5?C.o:C.r;
  return(<><div onClick={()=>onSave("",null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:399}}/><div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:600,background:C.s1,borderRadius:"20px 20px 0 0",padding:24,zIndex:400,boxSizing:"border-box"}}>
    <div style={{fontSize:20,fontWeight:800,marginBottom:4,textAlign:"center"}}>Séance terminée !</div>
    <div style={{fontSize:13,color:C.tx2,textAlign:"center",marginBottom:18}}>Durée : {mins}min {secs}s</div>
    <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ressenti, points forts, à améliorer..." style={{width:"100%",minHeight:80,background:C.s2,border:"1px solid "+C.brdL,borderRadius:12,color:C.tx,fontSize:13,fontFamily:"inherit",padding:"10px 12px",resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:16}}/>
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontWeight:600,color:C.tx2}}>Forme du jour</span><span style={{fontSize:20,fontWeight:900,color:formeColor,fontFamily:"monospace"}}>{forme}<span style={{fontSize:11,color:C.tx3}}>/10</span></span></div>
      <input type="range" min={0} max={10} value={forme} onChange={e=>setForme(+e.target.value)} style={{width:"100%",accentColor:formeColor,height:6,cursor:"pointer"}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.tx3,marginTop:4}}><span>Épuisé</span><span>Top shape</span></div>
    </div>
    <button onClick={()=>onSave(note,forme)} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",background:C.g,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>Valider la séance</button>
    <button onClick={()=>onSave("",null)} style={{width:"100%",padding:"10px 0",borderRadius:12,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Passer</button>
  </div></>);
}

function LogView({exos,sets,updSets,completedSessions,completeSession,uncompleteSession,goals,weeklyTarget={},currentWeek,allMethods,athleteNotes,setAthleteNotes,sessions,blockConfig,initialSess=null,timerLeft,timerDur,timerActive,timerFinished,onTimerSetDur,onTimerStart,onTimerStop,viewOnly=false,sessionLogs={},setSessionLogs,freeSessions=[],setFreeSessions,onAddExercise,weekSchedule={}}){
  const tw=blockConfig?.totalWeeks||6;const dw=blockConfig?.deloadWeek||0;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const[step,setStep]=useState(initialSess?1:0);const[wk,setWk]=useState(currentWeek);
  const[selectedSess,setSelectedSess]=useState(initialSess||null);const[openEx,setOpenEx]=useState(null);
  const[showEndModal,setShowEndModal]=useState(false);const[endDuration,setEndDuration]=useState(0);
  const[showSkipWarning,setShowSkipWarning]=useState(false);
  const[selectedFree,setSelectedFree]=useState(null);const[showFreeEndModal,setShowFreeEndModal]=useState(false);const[freeEndDuration,setFreeEndDuration]=useState(0);
  const[sessStartedAt,setSessStartedAt]=useState(null);const[elapsedSecs,setElapsedSecs]=useState(0);
  const[freeStartedAt,setFreeStartedAt]=useState(null);const[freeElapsed,setFreeElapsed]=useState(0);
  useEffect(()=>{if(step===0)setWk(currentWeek);},[currentWeek,step]);
  const sid=selectedSess?.id||null;const exercises=sid?exos[sid]||[]:[];
  const exercisesSorted=useMemo(()=>{if(!exercises.length)return exercises;const sBlocs=getSessionBlocs(selectedSess,exercises);const order=sBlocs.map(b=>b.id);return[...exercises].sort((a,b)=>{const ai=order.indexOf(a.bloc??'');const bi=order.indexOf(b.bloc??'');if(ai===bi)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;});},[exercises,selectedSess]);
  const sessIsDone=(completedSessions[wk]||[]).includes(sid);
  const allSetsDone=useMemo(()=>{if(!sid||!exercises.length)return false;return exercises.every(ex=>{const s=sets[ex.id+"_"+wk];return s?.length>0&&s.every(x=>x.done||x.skipped);});},[exercises,sets,wk,sid]);
  // Restore session start from localStorage
  useEffect(()=>{if(!sid||step!==1){setSessStartedAt(null);return;}try{const d=JSON.parse(localStorage.getItem('mpp:sess_start')||'null');if(d?.sid===sid&&d?.wk===wk){setSessStartedAt(d.startedAt);}else{setSessStartedAt(null);}}catch{}},[sid,wk,step]);
  // Restore free session start from localStorage
  useEffect(()=>{if(!selectedFree||step!==2){setFreeStartedAt(null);return;}try{const d=JSON.parse(localStorage.getItem('mpp:free_start')||'null');if(d?.id===selectedFree.id){setFreeStartedAt(d.startedAt);}else{setFreeStartedAt(null);}}catch{}},[selectedFree?.id,step]);
  // Live elapsed counters
  useEffect(()=>{if(!sessStartedAt)return;setElapsedSecs(Math.floor((Date.now()-sessStartedAt)/1000));const t=setInterval(()=>setElapsedSecs(Math.floor((Date.now()-sessStartedAt)/1000)),1000);return()=>clearInterval(t);},[sessStartedAt]);
  useEffect(()=>{if(!freeStartedAt)return;setFreeElapsed(Math.floor((Date.now()-freeStartedAt)/1000));const t=setInterval(()=>setFreeElapsed(Math.floor((Date.now()-freeStartedAt)/1000)),1000);return()=>clearInterval(t);},[freeStartedAt]);
  const fmtTime=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return(h>0?h+"h ":"")+m+"min "+String(sec).padStart(2,"0")+"s";};
  const startSess=()=>{const at=Date.now();localStorage.setItem('mpp:sess_start',JSON.stringify({sid,wk,startedAt:at}));setSessStartedAt(at);};
  const startFree=()=>{const at=Date.now();localStorage.setItem('mpp:free_start',JSON.stringify({id:selectedFree.id,startedAt:at}));setFreeStartedAt(at);};
  const endSess=()=>{const dur=sessStartedAt?Math.floor((Date.now()-sessStartedAt)/1000):0;setEndDuration(dur);setShowEndModal(true);};
  const endFree=()=>{const dur=freeStartedAt?Math.floor((Date.now()-freeStartedAt)/1000):0;setFreeEndDuration(dur);setShowFreeEndModal(true);};
  const onSessValidate=(note,forme)=>{completeSession(sid,wk);if(setSessionLogs)setSessionLogs(prev=>({...prev,[sid+"_"+wk]:{note,forme,duration:endDuration,date:new Date().toISOString()}}));localStorage.removeItem('mpp:sess_start');setSessStartedAt(null);setShowEndModal(false);};
  const onFreeValidate=(note,forme)=>{const updFn=(patch)=>{const updated={...selectedFree,...patch};setSelectedFree(updated);setFreeSessions(prev=>prev.map(f=>f.id===selectedFree.id?updated:f));};updFn({completed:true,duration:freeEndDuration,note,forme});localStorage.removeItem('mpp:free_start');setFreeStartedAt(null);setShowFreeEndModal(false);};
  const exosMap=useMemo(()=>exercises.reduce((a,e)=>({...a,[e.id]:e.name}),{}),[exercises]);
  const[addBankModal,setAddBankModal]=useState(false);
  const[bankExos,setBankExos]=useState([]);
  const[bankSearch,setBankSearch]=useState("");
  const[bankPick,setBankPick]=useState(null);
  const[bankForm,setBankForm]=useState({sets:3,repsRange:"10",kg:"",rir:2});
  const[videoEx,setVideoEx]=useState(null);
  useEffect(()=>{supabase.from('exercises').select('id,name,target,ex_type,youtube_id,image_url').order('name').then(({data})=>{if(data)setBankExos(data);});},[]);
  const bankFiltered=bankExos.filter(e=>!bankSearch||e.name.toLowerCase().includes(bankSearch.toLowerCase())).slice(0,30);
  const addFromBankConfirm=()=>{
    if(!bankPick||!sid)return;
    const id="athl_"+sid+"_"+Date.now();
    const ex={id,name:bankPick.name,target:bankPick.target||"Pecs",exType:bankPick.ex_type||"muscu",isFlexibility:false,bloc:null,tier:3,weeks:{[wk]:{sets:+bankForm.sets||3,repsRange:bankForm.repsRange||"10",...(bankForm.kg?{kg:+bankForm.kg}:{}),rir:bankForm.rir??2}}};
    if(onAddExercise)onAddExercise(sid,ex);
    const sk=id+"_"+wk;
    const rows=Array.from({length:+bankForm.sets||3},()=>({type:"set",kg:bankForm.kg?+bankForm.kg:0,reps:parseFloat(bankForm.repsRange)||10,rir:bankForm.rir??2,done:false}));
    updSets(sk,rows);
    setAddBankModal(false);setBankSearch("");setBankPick(null);setBankForm({sets:3,repsRange:"10",kg:"",rir:2});
  };

  const crumb=(<div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px 0",fontSize:11,color:C.tx3,flexWrap:"wrap"}}>
    <button onClick={()=>{setStep(0);setSelectedSess(null);}} style={{background:"none",border:"none",color:step>0?C.tx2:C.ac,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0,fontWeight:step===0?700:400}}>Seances</button>
    {step>=1&&selectedSess&&<><span>&gt;</span><span style={{color:C.ac,fontWeight:700}}>{selectedSess.name}</span></>}
  </div>);

  if(step===0){
    const weekDone=(completedSessions[wk]||[]).length;const weekTotal=weeklyTarget[wk]||sessions.filter(s=>(exos[s.id]||[]).some(ex=>ex.weeks?.[wk]?.sets)).length||goals.sessionsPerWeek;const weekPct=Math.min(Math.round((weekDone/weekTotal)*100),100);
    const lsActiveSess=(()=>{try{const d=JSON.parse(localStorage.getItem('mpp:sess_start')||'null');if(d?.sid&&d?.wk){const s=sessions.find(x=>x.id===d.sid);return s?{...d,name:s.name,short:s.short}:null;}return null;}catch{return null;}})();
    const lsActiveFree=(()=>{try{const d=JSON.parse(localStorage.getItem('mpp:free_start')||'null');if(d?.id){const f=freeSessions.find(x=>x.id===d.id);return f&&!f.completed?{...d,name:f.name}:null;}return null;}catch{return null;}})();
    return(<div style={{padding:"0 0 40px"}}><div style={{padding:"16px 16px 0"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.5px"}}>Semaine {wk}</div>
      <div style={{fontSize:12,fontWeight:700,color:weekPct>=100?C.g:C.ac,padding:"4px 10px",borderRadius:8,background:weekPct>=100?C.gS:C.acS}}>{weekDone}/{weekTotal} seances</div>
    </div>
    <div style={{height:4,background:C.s2,borderRadius:3,overflow:"hidden",marginBottom:16}}><div style={{height:"100%",width:weekPct+"%",background:weekPct>=100?C.g:C.ac,borderRadius:3,transition:"width 0.4s"}}/></div>
    <div style={{display:"flex",gap:4,marginBottom:18,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>{weeksArr.map(w=>{const wd=(completedSessions[w]||[]).length,total=goals.sessionsPerWeek,complete=wd>=total,isCur=w===currentWeek,isDL=w===dw,sel=w===wk;return(<button key={w} onClick={()=>setWk(w)} style={{flexShrink:0,width:42,padding:"8px 0",borderRadius:10,border:sel?"2px solid "+(isDL?C.b:complete?C.g:C.ac):"1px solid "+(complete?C.g+"30":C.brd),background:sel?(isDL?C.bS:complete?C.gS:C.acS):(complete?C.g+"08":"transparent"),cursor:"pointer",fontFamily:"inherit",textAlign:"center",position:"relative",transition:"all 0.2s"}}>{isDL&&<span style={{position:"absolute",top:-5,right:-2,fontSize:6,background:C.b,color:"#fff",padding:"1px 3px",borderRadius:3,fontWeight:700}}>DL</span>}{isCur&&!sel&&<div style={{position:"absolute",top:-2,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:C.ac}}/>}<div style={{fontSize:10,fontWeight:sel?800:600,color:sel?(isDL?C.b:complete?C.g:C.ac):(complete?C.g:C.tx3)}}>S{w}</div>{complete&&<div style={{fontSize:8,color:C.g,marginTop:1}}>✓</div>}</button>);})}</div>
    {dw>0&&wk===dw&&<div style={{padding:"10px 14px",borderRadius:10,background:C.bS,border:"1px solid "+C.b+"40",marginBottom:14,fontSize:12,color:C.b,fontWeight:600,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>~</span> Deload - Recuperation active</div>}
    {(()=>{const DAY_S=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];return(<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>{sessions.map(s=>{
      const done=(completedSessions[wk]||[]).includes(s.id);
      const sessExos=exos[s.id]||[];const hasExos=sessExos.length>0;
      const exosDone=sessExos.filter(ex=>{const sk=ex.id+"_"+wk;const rows=sets[sk]||[];return rows.length>0&&rows.every(r=>r.done||r.skipped);}).length;
      const muscles=[...new Set(sessExos.map(e=>e.target))];
      const dayLabel=s.day_of_week!=null?DAY_S[s.day_of_week]:null;
      const sLog=sessionLogs?.[s.id+"_"+wk];
      return(<button key={s.id} onClick={()=>{if(hasExos&&!viewOnly){setSelectedSess(s);setStep(1);setOpenEx(null);}}} style={{width:"100%",padding:0,borderRadius:14,border:"1.5px solid "+(done?C.g+"40":C.brd),background:C.s1,cursor:!hasExos||viewOnly?"default":"pointer",fontFamily:"inherit",textAlign:"left",display:"block",opacity:hasExos?1:0.35,overflow:"hidden",position:"relative",transition:"all 0.2s",boxSizing:"border-box"}}>
        {done&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:C.g,borderRadius:"14px 14px 0 0"}}/>}
        <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:done?C.gS:C.acS,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1.5px solid "+(done?C.g+"40":C.ac+"30")}}>
            {done?<span style={{fontSize:20,color:C.g,fontWeight:700}}>✓</span>:<span style={{fontSize:13,fontWeight:800,color:C.ac,letterSpacing:"-0.3px"}}>{s.short}</span>}
          </div>
          <div style={{flex:1,overflow:"hidden",minWidth:0}}>
            <div style={{fontSize:14,fontWeight:800,color:done?C.g:C.tx,letterSpacing:"-0.3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
            <div style={{fontSize:10,color:C.tx3,marginTop:1,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
              {dayLabel&&<span style={{fontWeight:600,color:done?C.g+"90":C.tx3}}>{dayLabel}</span>}
              {dayLabel&&<span>·</span>}
              <span>{sessExos.length} exercice{sessExos.length>1?"s":""}</span>
              {done&&sLog?.duration&&<><span>·</span><span>{fmtTime(sLog.duration)}</span></>}
            </div>
            {hasExos&&muscles.length>0&&<div style={{display:"flex",gap:3,marginTop:5,flexWrap:"wrap"}}>{muscles.slice(0,5).map(m=>{const mc=getMC(m);return(<span key={m} style={{fontSize:8,padding:"1px 6px",borderRadius:4,background:mc+"18",color:mc,fontWeight:600}}>{mL(m)}</span>);})}</div>}
            {!done&&hasExos&&exosDone>0&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:3,background:C.s2,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.round((exosDone/sessExos.length)*100)+"%",background:C.ac,borderRadius:2}}/></div><span style={{fontSize:9,color:C.tx3,flexShrink:0}}>{exosDone}/{sessExos.length}</span></div>}
            {done&&sLog?.note&&<div style={{fontSize:9,color:C.tx3,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>"{sLog.note}"</div>}
          </div>
          {done&&!viewOnly?<button onClick={e=>{e.stopPropagation();uncompleteSession(s.id,wk);}} style={{width:22,height:22,borderRadius:6,border:"1px solid "+C.r+"50",background:C.rS,color:C.r,fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",padding:0,flexShrink:0}}>×</button>:(!done&&hasExos&&!viewOnly&&<span style={{fontSize:16,color:C.tx3,flexShrink:0}}>›</span>)}
        </div>
      </button>);})}</div>);})()}
    {(()=>{const next=sessions.find(s=>!(completedSessions[wk]||[]).includes(s.id)&&(exos[s.id]||[]).length>0);if(!next)return weekPct>=100?<div style={{padding:"14px",borderRadius:14,background:C.gS,border:"1px solid "+C.g+"40",color:C.g,fontSize:13,fontWeight:700,textAlign:"center"}}>Semaine {wk} complete !</div>:null;if(viewOnly)return null;return(<button onClick={()=>{setSelectedSess(next);setStep(1);}} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-0.3px"}}>Commencer {next.short} - {next.name} ›</button>);})()}
    {!viewOnly&&freeSessions.filter(f=>f.date===new Date().toISOString().slice(0,10)).map(f=>(<button key={f.id} onClick={()=>{setSelectedFree(f);setStep(2);}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid "+(f.completed?C.g+"40":C.brdL),background:C.s1,cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginTop:6,display:"flex",alignItems:"center",gap:10}}><div style={{width:38,height:38,borderRadius:10,background:f.completed?C.gS:C.acS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📝</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:f.completed?C.g:C.tx}}>{f.name}</div><div style={{fontSize:10,color:C.tx3}}>{f.exercises.length} exo{f.completed?" · Terminée":""}</div></div>{f.completed&&<span style={{color:C.g,fontSize:14}}>✓</span>}</button>))}
    {(()=>{
      const extras=weekSchedule?.extras||{};
      // Calculer la plage de dates de la semaine sélectionnée
      const wkExtras=(()=>{
        if(blockConfig?.startDate){
          const s=new Date(blockConfig.startDate);
          s.setDate(s.getDate()+(wk-1)*7);
          const e=new Date(s);e.setDate(e.getDate()+6);
          const fmt=d=>d.toISOString().slice(0,10);
          const allEntries=[];
          for(const[dateKey,acts] of Object.entries(extras)){
            const d=dateKey.slice(0,4)+"-"+dateKey.slice(4,6)+"-"+dateKey.slice(6,8);
            if(d>=fmt(s)&&d<=fmt(e))acts.forEach(a=>allEntries.push({...a,date:d}));
          }
          return allEntries.sort((a,b)=>a.date<b.date?-1:1);
        }
        // Sans startDate : afficher les 7 derniers jours
        const cutoff=new Date();cutoff.setDate(cutoff.getDate()-6);
        const cutStr=cutoff.toISOString().slice(0,10);
        const allEntries=[];
        for(const[dateKey,acts] of Object.entries(extras)){
          const d=dateKey.slice(0,4)+"-"+dateKey.slice(4,6)+"-"+dateKey.slice(6,8);
          if(d>=cutStr)acts.forEach(a=>allEntries.push({...a,date:d}));
        }
        return allEntries.sort((a,b)=>a.date<b.date?-1:1);
      })();
      if(!wkExtras.length)return null;
      return(<>
        <div style={{fontSize:10,fontWeight:700,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:16,marginBottom:6}}>Activités libres</div>
        {wkExtras.map((a,i)=>{
          const INT_COLORS=["#22c55e","#84cc16","#eab308","#f97316","#ef4444","#dc2626","#b91c1c","#991b1b","#7f1d1d","#450a0a"];
          const ic=a.intensity?INT_COLORS[a.intensity-1]:C.y;
          return(<div key={a.id||i} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid "+C.y+"40",background:C.y+"08",marginBottom:6,display:"flex",alignItems:"center",gap:10,boxSizing:"border-box"}}>
            <div style={{width:38,height:38,borderRadius:10,background:C.y+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{a.emoji||"🏅"}</div>
            <div style={{flex:1,overflow:"hidden",minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.y,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.label}</div>
              <div style={{fontSize:10,color:C.tx3,marginTop:1,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                <span>{a.date}</span>
                {a.duration&&<><span>·</span><span>⏱ {a.duration} min</span></>}
                {a.intensity&&<><span>·</span><span style={{color:ic,fontWeight:600}}>RPE {a.intensity}/10</span></>}
              </div>
              {a.notes&&<div style={{fontSize:9,color:C.tx3,marginTop:2,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{a.notes}"</div>}
            </div>
          </div>);
        })}
      </>);
    })()}
    {!viewOnly&&<button onClick={()=>{const id="free_"+Date.now();const fs={id,name:"Séance libre",date:new Date().toISOString().slice(0,10),completed:false,duration:null,note:"",exercises:[]};setFreeSessions(prev=>[...prev,fs]);setSelectedFree(fs);setStep(2);}} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>+ Séance libre</button>}
  </div>
  {lsActiveSess&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:300,maxWidth:360,width:"calc(100% - 32px)"}}>
    <button onClick={()=>{const s=sessions.find(x=>x.id===lsActiveSess.sid);if(s){setSelectedSess(s);setWk(lsActiveSess.wk);setStep(1);}}} style={{width:"100%",padding:"12px 16px",borderRadius:16,border:"none",background:C.ac,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:10,justifyContent:"center",boxShadow:"0 4px 24px rgba(123,111,255,0.45)"}}>
      <span style={{fontSize:16}}>▶</span><span>Reprendre — {lsActiveSess.name}</span>
    </button>
  </div>}
  {lsActiveFree&&!lsActiveSess&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:300,maxWidth:360,width:"calc(100% - 32px)"}}>
    <button onClick={()=>{const f=freeSessions.find(x=>x.id===lsActiveFree.id);if(f){setSelectedFree(f);setStep(2);}}} style={{width:"100%",padding:"12px 16px",borderRadius:16,border:"none",background:C.ac,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:10,justifyContent:"center",boxShadow:"0 4px 24px rgba(123,111,255,0.45)"}}>
      <span style={{fontSize:16}}>▶</span><span>Reprendre — {lsActiveFree.name}</span>
    </button>
  </div>}
  </div>);}

  if(step===1&&sid){let lb=null;return(<div style={{padding:"0 0 40px"}}>{crumb}<div style={{padding:"12px 16px 0"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"14px 16px",borderRadius:14,background:C.s1,border:"1px solid "+C.ac+"25"}}><div style={{flex:1}}><div style={{fontSize:17,fontWeight:800}}>{selectedSess.name}</div><div style={{fontSize:11,color:C.tx3,marginTop:2}}>{exercises.length} exo - S{wk}</div></div>{sessStartedAt&&!sessIsDone&&<div style={{padding:"4px 10px",borderRadius:8,background:C.acS,color:C.ac,fontSize:13,fontWeight:800,fontFamily:"monospace"}}>{fmtTime(elapsedSecs)}</div>}{sessIsDone&&<div style={{padding:"4px 10px",borderRadius:8,background:C.gS,color:C.g,fontSize:11,fontWeight:700}}>OK</div>}</div>
    {!sessIsDone&&!viewOnly&&!sessStartedAt&&<button onClick={startSess} style={{width:"100%",marginBottom:16,padding:"15px 0",borderRadius:14,border:"none",background:C.ac,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>▶ Débuter la séance</button>}
    {wk===dw&&<div style={{padding:"8px 14px",borderRadius:8,background:C.bS,border:"1px solid "+C.b+"40",marginBottom:10,fontSize:11,color:C.b,fontWeight:600}}>Semaine deload</div>}
    <div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}}>{weeksArr.map(w=><button key={w} onClick={()=>setWk(w)} style={{flex:1,minWidth:36,padding:"9px 0",borderRadius:7,border:w===wk?"2px solid "+C.ac:"1px solid "+(w===dw?C.b+"60":C.brd),background:w===wk?C.acS:(w===dw?C.bS:"transparent"),color:w===wk?C.ac:(w===dw?C.b:C.tx3),fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>{w===dw&&<span style={{position:"absolute",top:-6,right:-2,fontSize:7,background:C.b,color:"#fff",padding:"1px 4px",borderRadius:4,fontWeight:700}}>DL</span>}S{w}</button>)}</div>
    {sessStartedAt&&<div style={{marginBottom:14,background:C.s1,borderRadius:12,padding:"10px 12px",border:"1px solid "+C.brd}}><div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Timer repos</div><RestTimer timerLeft={timerLeft} timerDur={timerDur} timerActive={timerActive} timerFinished={timerFinished} onSetDur={onTimerSetDur} onStart={onTimerStart} onStop={onTimerStop}/></div>}
    <div style={{opacity:(!sessStartedAt&&!sessIsDone)?0.3:1,transition:"opacity 0.3s"}}>{(()=>{
      // ── Pré-groupe les supersets ──────────────────────────────────────────
      const rGroups=[];const seen=new Set();
      exercisesSorted.forEach(ex=>{
        if(seen.has(ex.id))return;
        const wd=ex.weeks[wk];
        const pid=wd?.method==="superset"?wd?.methodParams?.paired:null;
        if(pid){
          const pEx=exercisesSorted.find(e=>e.id===pid);
          if(pEx&&!seen.has(pid)){
            seen.add(ex.id);seen.add(pid);
            const gExs=[ex,pEx];
            // Chaîne : si pEx est lui-même en superset avec un 3ème
            const wd2=pEx.weeks[wk];const pid2=wd2?.method==="superset"?wd2?.methodParams?.paired:null;
            if(pid2&&pid2!==ex.id){const e3=exercisesSorted.find(e=>e.id===pid2);if(e3&&!seen.has(pid2)){gExs.push(e3);seen.add(pid2);}}
            rGroups.push({ss:true,exs:gExs});return;
          }
        }
        seen.add(ex.id);rGroups.push({ss:false,ex});
      });
      // ── Helper : rendu d'une carte exercice ───────────────────────────────
      const exCard=(ex,inSS,isLastInSS)=>{
        const wd=ex.weeks[wk];const bt=BT[ex.bloc]||{c:C.tx3,l:ex.bloc};
        const isOpen=openEx===ex.id;const sk=ex.id+"_"+wk;
        const rows=sets[sk]||[];const done=rows.filter(r=>r.done||r.skipped).length;
        const total=rows.length||wd?.sets||0;const allDone=total>0&&done===total;
        const method=wd?.method;const mp=wd?.methodParams;const mInfo=allMethods[method];
        const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");const isFlex=eType!=="muscu"&&eType!=="halterophilie";
        // Surcharge basée sur le réel S-1 plutôt que la planif initiale
        const prevDoneRows=(!wd?.pdc&&!isFlex&&wk>1)?(sets[ex.id+"_"+(wk-1)]||[]).filter(r=>r.done&&(r.kg||0)>0):[];
        const prevMedianKg=prevDoneRows.length?prevDoneRows.map(r=>r.kg).sort((a,b)=>a-b)[Math.floor(prevDoneRows.length/2)]:null;
        const exTierCfg=(blockConfig?.tierConfig||DEF_TIER_CONFIG)[getExTier(ex.name,ex)]||(blockConfig?.tierConfig||DEF_TIER_CONFIG)[3];
        const exKgStep=exTierCfg?.kgStep??2.5;
        const effectiveKg=prevMedianKg!==null?roundHalf(prevMedianKg+exKgStep):(wd?.kg??null);
        const effectivePlanned=wd&&prevMedianKg!==null&&!wd.pdc?{...wd,kg:effectiveKg}:wd;
        const kgFromActual=!!(wd&&!wd.pdc&&!isFlex&&prevMedianKg!==null&&effectiveKg!==wd?.kg);
        const bankEx=bankExos.find(b=>(ex.exercise_id&&b.id===ex.exercise_id)||fuzzyExMatch(b.name,ex.name));
        const hasVideo=!!(bankEx?.youtube_id||bankEx?.image_url);
        return(
          <div key={ex.id}>
            <div style={inSS?{background:"transparent",overflow:"hidden"}:{background:C.s1,borderRadius:12,marginBottom:6,border:"1px solid "+(allDone?C.g+"50":C.brd),overflow:"hidden"}}>
              <div onClick={()=>setOpenEx(isOpen?null:ex.id)} style={{display:"flex",alignItems:"center",padding:"12px 14px",cursor:"pointer",gap:10}}>
                <div style={{width:3,height:32,borderRadius:2,background:allDone?C.g:bt.c,flexShrink:0}}/>
                <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:600}}>{ex.name}</span>{allDone&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:C.gS,color:C.g}}>OK</span>}{isFlex&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.b+"20",color:C.b,fontWeight:600}}>Souplesse</span>}{mInfo&&!isFlex&&method!=="superset"&&<span style={{padding:"3px 8px",borderRadius:6,border:"1px solid "+mInfo.c+"60",background:mInfo.c+"22",color:mInfo.c,fontSize:10,fontWeight:700}}>{mInfo.e} {mInfo.label}</span>}</div>{wd?(!isFlex?<div style={{fontSize:11,color:C.tx2,marginTop:3}}>{wd.pdc?"PDC":(effectiveKg??wd.kg)+"kg"} - {fmtMR(method,mp,wd.sets,wd.repsRange)}{wd.tempo?" - "+wd.tempo:""}{(!method||method==="excentrique"||method==="superset"||method==="dropset"||method==="restpause")?" - ":""}{(!method||method==="excentrique"||method==="superset"||method==="dropset"||method==="restpause")?<span style={{color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</span>:""}{kgFromActual&&<span style={{fontSize:9,color:C.g,marginLeft:6,fontWeight:600}}>↑ S{wk-1}+{exKgStep}kg</span>}</div>:<div style={{fontSize:11,color:C.tx2,marginTop:3}}>{wd.sets}x{wd.repsRange||"?"}{wd.tempo?" tempo "+wd.tempo:""}</div>):<div style={{fontSize:11,color:C.tx3,marginTop:3,fontStyle:"italic"}}>Non programme S{wk}</div>}{wd?.coachNote&&<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:C.coachS,border:"1px solid "+C.coach+"30",fontSize:11,color:C.coach,lineHeight:1.5}}>{wd.coachNote}</div>}{!isFlex&&method&&method!=="superset"&&mp&&mInfo&&<div style={{fontSize:10,color:mInfo.c,marginTop:4}}>{method==="dropset"&&(mp.drops||2)+" drops -"+(mp.pct||20)+"%"}{method==="myoreps"&&(mp.activation||12)+" + "+(mp.minisets||4)+"x"+(mp.reps_mini||5)}{method==="restpause"&&(mp.rounds||3)+" rounds"}{method==="cluster"&&clusterReps(mp).join("+")+", "+(mp.pause||10)+"s"}{method==="amrap"&&(mp.type==="timed"?mp.duration+"s":"A l echec")}{method==="excentrique"&&"Neg: "+(mp.eccentric_sec||4)+"s"}{method==="isometrique"&&(mp.positions||2)+"x"+(mp.hold_sec||30)+"s"}</div>}</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  {hasVideo&&<button onClick={e=>{e.stopPropagation();setVideoEx(bankEx);}} style={{background:'none',border:'none',color:C.tx3,fontSize:16,cursor:'pointer',padding:'0',lineHeight:1,pointerEvents:'all'}} title="Voir la vidéo">📹</button>}
                  {rows.length>0&&<span style={{fontSize:12,fontWeight:700,color:allDone?C.g:C.tx2,fontFamily:"monospace"}}>{done}/{total}</span>}
                  <span style={{fontSize:11,color:C.tx3}}>{isOpen?"^":"v"}</span>
                </div>
              </div>
              {isOpen&&(<div style={{padding:"0 14px 14px",borderTop:"1px solid "+C.brd}}>{wd?(<>{!isFlex&&<div style={{display:"grid",gridTemplateColumns:wd.pdc?"1fr":"1fr 1fr",gap:6,paddingTop:12,marginBottom:14}}>{!wd.pdc&&<div style={{background:C.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>1RM estime</div><div style={{fontSize:18,fontWeight:800,color:C.ac}}>{e1rm((effectivePlanned||wd)?.kg||0,parseReps(wd.repsRange)||1)} kg</div></div>}<div style={{background:C.s2,borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",marginBottom:2}}>RIR cible</div><div style={{fontSize:18,fontWeight:800,color:rC(wd.rir??2)}}>RIR {rL(wd.rir??2)}</div></div></div>}{kgFromActual&&<div style={{marginBottom:10,padding:"6px 10px",borderRadius:8,background:C.g+"10",border:"1px solid "+C.g+"30",fontSize:10,color:C.g,display:"flex",alignItems:"center",gap:6}}><span>Basé sur S{wk-1} réel :</span><span style={{fontWeight:700}}>{prevMedianKg}kg → {effectiveKg}kg (+{exKgStep}kg)</span></div>}<SmartSetEditor planned={effectivePlanned||wd} storeKey={sk} sessionSets={sets} updateSets={updSets} athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes} method={isFlex?null:method} methodParams={isFlex?null:mp} allMethods={allMethods} exosMap={exosMap} viewOnly={viewOnly||(!sessStartedAt&&!sessIsDone)} onTimerStart={onTimerStart} postSession={sessIsDone&&!viewOnly}/></>):<div style={{padding:"14px 0",fontSize:12,color:C.tx3,textAlign:"center"}}>Pas de prescription S{wk}</div>}</div>)}
            </div>
            {/* Badge SS centré entre les exercices du superset */}
            {inSS&&!isLastInSS&&<div style={{position:"relative",display:"flex",alignItems:"center",height:20,margin:"0 16px"}}>
              <div style={{flex:1,borderTop:"1px dashed "+C.g+"28"}}/>
              <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",background:C.s2,border:"1px solid "+C.g+"50",borderRadius:10,padding:"1px 10px",fontSize:8,fontWeight:800,color:C.g,letterSpacing:"0.8px",whiteSpace:"nowrap"}}>SS</div>
            </div>}
          </div>
        );
      };
      // ── Rendu des groupes ─────────────────────────────────────────────────
      return rGroups.map((item)=>{
        if(!item.ss){
          const ex=item.ex;const bt=BT[ex.bloc]||{c:C.tx3,l:ex.bloc};
          const showH=ex.bloc!==lb;lb=ex.bloc;
          return(<div key={ex.id}>{showH&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 8px",padding:"7px 12px",borderRadius:8,background:bt.c+"18",border:"1px solid "+bt.c+"35"}}><div style={{width:4,height:16,borderRadius:2,background:bt.c,flexShrink:0}}/><span style={{fontSize:10,fontWeight:700,color:bt.c,textTransform:"uppercase",letterSpacing:"0.8px"}}>{bt.l}</span></div>}{exCard(ex,false,false)}</div>);
        } else {
          const firstEx=item.exs[0];const bt=BT[firstEx.bloc]||{c:C.tx3,l:firstEx.bloc};
          const showH=firstEx.bloc!==lb;lb=firstEx.bloc;
          const ssC=C.g;
          return(
            <div key={firstEx.id+"_ss"}>
              {showH&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0 8px",padding:"7px 12px",borderRadius:8,background:bt.c+"18",border:"1px solid "+bt.c+"35"}}><div style={{width:4,height:16,borderRadius:2,background:bt.c,flexShrink:0}}/><span style={{fontSize:10,fontWeight:700,color:bt.c,textTransform:"uppercase",letterSpacing:"0.8px"}}>{bt.l}</span></div>}
              {/* ── Conteneur visuel superset — sans header, badge centré entre les exos ── */}
              <div style={{border:"2px solid "+ssC+"45",borderRadius:14,overflow:"hidden",marginBottom:8,background:ssC+"05"}}>
                {/* Exercices liés */}
                {item.exs.map((ex,ei)=>exCard(ex,true,ei===item.exs.length-1))}
              </div>
            </div>
          );
        }
      });
    })()}</div>
    {!sessIsDone&&!viewOnly&&sessStartedAt&&<button onClick={()=>{const incomplete=exercisesSorted.filter(ex=>{const rows=sets[ex.id+"_"+wk]||[];return rows.length===0||rows.some(r=>!r.done&&!r.skipped);});if(incomplete.length>0){setShowSkipWarning(true);}else{endSess();}}} style={{width:"100%",marginTop:16,padding:"15px 0",borderRadius:14,border:"none",background:C.g,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Terminer la séance</button>}
    {sessIsDone&&<div style={{marginTop:16}}><div style={{padding:"14px 0",borderRadius:14,background:C.gS,border:"1px solid "+C.g+"40",color:C.g,fontSize:14,fontWeight:700,textAlign:"center",marginBottom:8}}>Séance validée !</div>{sessionLogs?.[sid+"_"+wk]?.note&&<div style={{padding:"10px 12px",borderRadius:8,background:C.s2,fontSize:12,color:C.tx2,lineHeight:1.5,fontStyle:"italic",marginBottom:6}}>"{sessionLogs[sid+"_"+wk].note}"</div>}{sessionLogs?.[sid+"_"+wk]?.duration&&<div style={{fontSize:11,color:C.tx3,textAlign:"center",marginBottom:8}}>Durée : {fmtTime(sessionLogs[sid+"_"+wk].duration)}</div>}{!viewOnly&&<button onClick={()=>uncompleteSession(sid,wk)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler la validation</button>}</div>}
    {showSkipWarning&&(()=>{
      const incomplete=exercisesSorted.filter(ex=>{const rows=sets[ex.id+"_"+wk]||[];return rows.length===0||rows.some(r=>!r.done&&!r.skipped);});
      const autoSkipAndValidate=()=>{
        incomplete.forEach(ex=>{
          const sk=ex.id+"_"+wk;
          const wd=ex.weeks[wk];
          const existing=sets[sk]||[];
          const rows=existing.length>0?existing:generateRows(wd,wd?.method,wd?.methodParams);
          updSets(sk,rows.map(r=>(!r.done&&!r.skipped)?{...r,skipped:true}:r));
        });
        setShowSkipWarning(false);
        endSess();
      };
      return(<div style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setShowSkipWarning(false)}>
        <div style={{background:C.s1,borderRadius:16,padding:24,width:'100%',maxWidth:340,border:'1px solid '+C.brd}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:800,color:C.tx,marginBottom:6}}>Séries non renseignées</div>
          <div style={{fontSize:12,color:C.tx3,marginBottom:12,lineHeight:1.6}}>Les exercices suivants ont des séries non validées :</div>
          <div style={{marginBottom:16,display:'flex',flexDirection:'column',gap:4,maxHeight:200,overflowY:'auto'}}>
            {incomplete.map(ex=>{
              const rows=sets[ex.id+"_"+wk]||[];
              const untouchedCount=rows.length===0?(ex.weeks[wk]?.sets||0):rows.filter(r=>!r.done&&!r.skipped).length;
              return(<div key={ex.id} style={{fontSize:12,padding:'7px 10px',borderRadius:8,background:C.o+'12',border:'1px solid '+C.o+'30',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:C.tx,fontWeight:600}}>{ex.name}</span>
                <span style={{color:C.o,fontWeight:700,flexShrink:0,marginLeft:8}}>{untouchedCount} série{untouchedCount>1?'s':''} manquante{untouchedCount>1?'s':''}</span>
              </div>);
            })}
          </div>
          <div style={{fontSize:11,color:C.tx3,marginBottom:14,padding:'8px 10px',borderRadius:8,background:C.s2}}>En validant, les séries manquantes seront automatiquement marquées comme skippées (—).</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={()=>setShowSkipWarning(false)} style={{width:'100%',padding:'12px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx2,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Revenir finir la séance</button>
            <button onClick={autoSkipAndValidate} style={{width:'100%',padding:'12px 0',borderRadius:10,border:'none',background:C.g,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Valider et skipper les séries manquantes</button>
          </div>
        </div>
      </div>);
    })()}
    {showEndModal&&<SessionEndModal duration={endDuration} onSave={onSessValidate} C={C}/>}
    {videoEx&&(<div onClick={()=>setVideoEx(null)} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:C.tx}}>{videoEx.name}</div>
          <button onClick={()=>setVideoEx(null)} style={{background:'none',border:'none',color:C.tx2,fontSize:24,cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>×</button>
        </div>
        {videoEx.youtube_id?(
          <div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',borderRadius:12,background:C.s1}}>
            <iframe src={'https://www.youtube.com/embed/'+videoEx.youtube_id+'?autoplay=1'} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} allow="autoplay; encrypted-media" allowFullScreen/>
          </div>
        ):videoEx.image_url?(
          <img src={videoEx.image_url} style={{width:'100%',borderRadius:12,display:'block'}} alt={videoEx.name}/>
        ):null}
        <button onClick={()=>setVideoEx(null)} style={{width:'100%',marginTop:14,padding:'11px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx3,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Fermer</button>
      </div>
    </div>)}
    {!sessIsDone&&!viewOnly&&sessStartedAt&&<button onClick={()=>setAddBankModal(true)} style={{width:"100%",marginTop:8,padding:"11px 0",borderRadius:12,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter un exercice depuis la banque</button>}
    {addBankModal&&(<div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end"}} onClick={()=>setAddBankModal(false)}>
      <div style={{background:C.s1,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:12}}>Ajouter un exercice</div>
        {!bankPick?(<>
          <input value={bankSearch} onChange={e=>setBankSearch(e.target.value)} placeholder="Rechercher dans la banque..." autoFocus style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:8,outline:"none"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
            {bankFiltered.map(e=>(<button key={e.id} onClick={()=>setBankPick(e)} style={{padding:"9px 12px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontWeight:600}}>{e.name}</span><span style={{fontSize:10,color:C.tx3}}>{e.target}</span></button>))}
            {bankSearch&&bankFiltered.length===0&&<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"16px 0"}}>Aucun résultat — tape "Entrée" pour créer</div>}
            {bankSearch&&bankFiltered.length===0&&<button onClick={()=>setBankPick({id:"new",name:bankSearch,target:"Pecs",ex_type:"muscu"})} style={{padding:"9px 12px",borderRadius:8,border:"1px dashed "+C.ac+"60",background:C.acS,color:C.ac,fontSize:13,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter "{bankSearch}"</button>}
          </div>
        </>):(<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"10px 12px",borderRadius:10,background:C.ac+"18",border:"1px solid "+C.ac+"40"}}>
            <div style={{flex:1,fontSize:13,fontWeight:700,color:C.tx}}>{bankPick.name}</div>
            <button onClick={()=>setBankPick(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:18,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            <div><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>Séries</div><input type="number" min={1} max={10} value={bankForm.sets} onChange={e=>setBankForm(p=>({...p,sets:+e.target.value||3}))} style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:15,fontWeight:700,textAlign:"center",fontFamily:"inherit",boxSizing:"border-box"}}/></div>
            <div><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>Répétitions</div><input value={bankForm.repsRange} onChange={e=>setBankForm(p=>({...p,repsRange:e.target.value}))} placeholder="ex: 10 ou 8-12" style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/></div>
            <div><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>Charge (kg)</div><input type="number" min={0} step={0.5} value={bankForm.kg} onChange={e=>setBankForm(p=>({...p,kg:e.target.value}))} placeholder="0" style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/></div>
            <div><div style={{fontSize:10,color:C.tx3,marginBottom:4}}>RIR cible</div><select value={bankForm.rir} onChange={e=>setBankForm(p=>({...p,rir:+e.target.value}))} style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}>{[0,1,2,3,4,5].map(v=><option key={v} value={v}>RIR {v}</option>)}</select></div>
          </div>
          <button onClick={addFromBankConfirm} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:C.ac,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ajouter à la séance</button>
        </>)}
        <button onClick={()=>{setAddBankModal(false);setBankSearch("");setBankPick(null);}} style={{width:"100%",marginTop:10,padding:"10px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
      </div>
    </div>)}
  </div></div>);}
  if(step===2&&selectedFree){
    const sf=selectedFree;
    const updFree=(patch)=>{const updated={...sf,...patch};setSelectedFree(updated);setFreeSessions(prev=>prev.map(f=>f.id===sf.id?updated:f));};
    const addExo=()=>{const ex={id:"fex_"+Date.now(),name:"",sets:[{kg:0,reps:0,done:false}]};updFree({exercises:[...sf.exercises,ex]});};
    const updExo=(eid,patch)=>updFree({exercises:sf.exercises.map(e=>e.id===eid?{...e,...patch}:e)});
    const updSet=(eid,sidx,patch)=>updExo(eid,{sets:sf.exercises.find(e=>e.id===eid).sets.map((s,i)=>i===sidx?{...s,...patch}:s)});
    const removeExo=(eid)=>updFree({exercises:sf.exercises.filter(e=>e.id!==eid)});
    return(<div style={{padding:"0 0 40px"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px 0",fontSize:11,color:C.tx3}}>
        <button onClick={()=>{setStep(0);setSelectedFree(null);}} style={{background:"none",border:"none",color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0}}>Séances</button>
        <span>&gt;</span><span style={{color:C.ac,fontWeight:700}}>{sf.name}</span>
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <input value={sf.name} onChange={e=>updFree({name:e.target.value})} style={{width:"100%",fontSize:18,fontWeight:800,background:"transparent",border:"none",color:C.tx,fontFamily:"inherit",outline:"none",marginBottom:10,padding:0,boxSizing:"border-box"}}/>
        <textarea value={sf.quickNote||""} onChange={e=>updFree({quickNote:e.target.value})} placeholder="Commentaire rapide (optionnel)..." style={{width:"100%",minHeight:60,background:C.s1,border:"1px solid "+C.brdL,borderRadius:10,color:C.tx2,fontSize:12,fontFamily:"inherit",padding:"8px 10px",resize:"none",outline:"none",boxSizing:"border-box",marginBottom:14}} readOnly={sf.completed}/>
        {sf.exercises.map((ex,ei)=>{const allDone=ex.sets.length>0&&ex.sets.every(s=>s.done);return(<div key={ex.id} style={{background:C.s1,borderRadius:12,marginBottom:8,border:"1px solid "+(allDone?C.g+"50":C.brd),overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",padding:"10px 12px",gap:8}}><input value={ex.name} onChange={e=>updExo(ex.id,{name:e.target.value})} placeholder={"Exercice "+(ei+1)} style={{flex:1,background:"transparent",border:"none",color:C.tx,fontSize:14,fontWeight:600,fontFamily:"inherit",outline:"none"}}/><button onClick={()=>removeExo(ex.id)} style={{width:20,height:20,borderRadius:5,border:"1px solid "+C.r+"40",background:C.rS,color:C.r,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>×</button></div><div style={{padding:"0 12px 12px"}}>{ex.sets.map((s,si)=>(<div key={si} style={{display:"grid",gridTemplateColumns:"40px 1fr 10px 1fr 28px",gap:4,alignItems:"center",marginBottom:4,padding:"5px 8px",borderRadius:8,background:s.done?C.g+"10":C.s2,border:"1px solid "+(s.done?C.g+"30":C.brd)}}><span style={{fontSize:9,color:C.tx3,textAlign:"center"}}>S{si+1}</span><input type="number" step="0.5" value={s.kg||""} onChange={e=>updSet(ex.id,si,{kg:+e.target.value})} placeholder="0" style={{background:C.s1,color:C.tx,border:"1px solid "+C.brdL,fontFamily:"inherit",fontSize:13,fontWeight:700,textAlign:"center",borderRadius:6,padding:"5px 2px",width:"100%"}}/><span style={{fontSize:10,color:C.tx3,textAlign:"center"}}>x</span><input type="number" value={s.reps||""} onChange={e=>updSet(ex.id,si,{reps:+e.target.value})} placeholder="0" style={{background:C.s1,color:C.tx,border:"1px solid "+C.brdL,fontFamily:"inherit",fontSize:13,fontWeight:700,textAlign:"center",borderRadius:6,padding:"5px 2px",width:"100%"}}/><button onClick={()=>updSet(ex.id,si,{done:!s.done})} style={{width:28,height:28,borderRadius:7,border:"1.5px solid "+(s.done?C.g:C.brdL),background:s.done?C.g:"transparent",color:s.done?"#fff":C.tx3,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button></div>))}<button onClick={()=>{const last=ex.sets[ex.sets.length-1]||{kg:0,reps:0};updExo(ex.id,{sets:[...ex.sets,{kg:last.kg,reps:last.reps,done:false}]});}} style={{width:"100%",padding:"5px 0",borderRadius:7,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx3,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:2}}>+ Série</button></div></div>);})}
        <button onClick={addExo} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px dashed "+C.brdL,background:"transparent",color:C.tx2,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>+ Ajouter un exercice</button>
        {!sf.completed&&!freeStartedAt&&<button onClick={startFree} style={{width:"100%",padding:"15px 0",borderRadius:14,border:"none",background:C.ac,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>▶ Débuter la séance</button>}
        {!sf.completed&&freeStartedAt&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{flex:1,padding:"8px 12px",borderRadius:10,background:C.acS,border:"1px solid "+C.ac+"40",fontSize:14,fontWeight:800,color:C.ac,fontFamily:"monospace"}}>{fmtTime(freeElapsed)}</div><button onClick={endFree} style={{padding:"8px 18px",borderRadius:10,border:"none",background:C.g,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Terminer</button></div>}
        {sf.completed&&<div style={{padding:"14px 0",borderRadius:14,background:C.gS,border:"1px solid "+C.g+"40",color:C.g,fontSize:14,fontWeight:700,textAlign:"center",marginBottom:8}}>Séance validée !</div>}
        {sf.completed&&sf.note&&<div style={{padding:"10px 12px",borderRadius:8,background:C.s2,fontSize:12,color:C.tx2,lineHeight:1.5,fontStyle:"italic",marginBottom:6}}>"{sf.note}"</div>}
        {sf.completed&&sf.duration&&<div style={{fontSize:11,color:C.tx3,textAlign:"center"}}>Durée : {fmtTime(sf.duration)}</div>}
      </div>
      {showFreeEndModal&&<SessionEndModal duration={freeEndDuration} onSave={onFreeValidate} C={C}/>}
    </div>);
  }
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

function MonthCalendar({sessions,completedSessions,blockConfig,weekSchedule,setWeekSchedule,exos={},sets={},energySessions=[],energyWeekPlan={},energyDayPlan={},allMethods={},wellnessHistory={},nutritionLog={},sessionLogs={},currentWeek=1,C}){
  const[vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const[selDk,setSelDk]=useState(null);
  const[addEv,setAddEv]=useState(null);
  const[dragging,setDragging]=useState(null);
  const[dragOverDk,setDragOverDk]=useState(null);
  const[sessDetail,setSessDetail]=useState(null);
  const[previewWell,setPreviewWell]=useState(null);
  const[previewNutr,setPreviewNutr]=useState(null);
  const MONTHS_FR=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const DAYS_S=["L","Ma","Me","J","V","S","D"];
  const DAYS_FULL=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
  const EV_TYPES=[{k:'match',l:'Match',e:'⚔️'},{k:'compet',l:'Compétition',e:'🏆'},{k:'stage',l:'Stage',e:'🏕️'},{k:'autre',l:'Autre',e:'📅'}];
  const toKey=d=>String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const todKey=toKey(new Date());
  const calEvs=weekSchedule?.calendarEvents||{};
  const dayEvs=dk=>calEvs[dk]||[];
  const tw=blockConfig?.totalWeeks||6;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const getWell=dk=>wellnessHistory[dk]||null;
  const calcScore=w=>w?Math.round(((w.fatigue||3)+(w.sommeil||3)+(w.stress||3)+(w.energie||3)+(w.doms||3))/25*100):null;
  const wColor=s=>s>=80?C.g:s>=65?'#6FCF97':s>=50?C.o:s>=35?'#E8956D':C.r;
  const wLabel=s=>s>=80?'Optimal':s>=65?'Bon':s>=50?'Modéré':s>=35?'Fatigué':'Surmenage';
  const fmtDur=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return(h>0?h+'h ':'')+m+'min';};
  const getNutr=dk=>{const y=dk.slice(0,4),mo=dk.slice(4,6),d2=dk.slice(6,8);return nutritionLog[dk]||nutritionLog[`${y}-${mo}-${d2}`]||null;};
  const sessMap=useMemo(()=>{
    const map={};
    if(!blockConfig?.startDate)return map;
    const start=new Date(blockConfig.startDate);
    weeksArr.forEach(week=>{
      (sessions||[]).forEach(sess=>{
        const dayIdx=weekSchedule?.sessions?.[week]?.[sess.id]??sess.day_of_week??null;
        if(dayIdx==null)return;
        const d=new Date(start);d.setDate(start.getDate()+(week-1)*7+dayIdx);
        const dk=toKey(d);if(!map[dk])map[dk]=[];
        const done=(completedSessions[week]||[]).includes(sess.id);
        map[dk].push({type:'muscu',sessId:sess.id,week,done,sess});
      });
      const wkKeys=energyWeekPlan[week]||[];
      (energySessions||[]).forEach(sess=>{
        if(!wkKeys.includes(sess.session_key))return;
        const dayIdx=energyDayPlan[week]?.[sess.session_key]??null;
        if(dayIdx==null)return;
        const d=new Date(start);d.setDate(start.getDate()+(week-1)*7+dayIdx);
        const dk=toKey(d);if(!map[dk])map[dk]=[];
        map[dk].push({type:'energy',sessId:sess.session_key,week,done:false,sess});
      });
    });
    return map;
  },[sessions,completedSessions,blockConfig,weekSchedule,energySessions,energyWeekPlan,energyDayPlan]);
  const firstDay=new Date(vm.y,vm.m,1);const lastDay=new Date(vm.y,vm.m+1,0);
  const startOffset=(firstDay.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<startOffset;i++)cells.push(null);
  for(let d=1;d<=lastDay.getDate();d++)cells.push(new Date(vm.y,vm.m,d));
  while(cells.length%7!==0)cells.push(null);
  const prevM=()=>{setSelDk(null);setVm(v=>{const nm=v.m===0?11:v.m-1;const ny=v.m===0?v.y-1:v.y;return{y:ny,m:nm};});};
  const nextM=()=>{setSelDk(null);setVm(v=>{const nm=v.m===11?0:v.m+1;const ny=v.m===11?v.y+1:v.y;return{y:ny,m:nm};});};
  const toggleDayOff=dk=>{
    const cur=calEvs[dk]||[];const has=cur.some(e=>e.type==='dayoff');
    const next=has?cur.filter(e=>e.type!=='dayoff'):[...cur,{type:'dayoff',id:String(Date.now())}];
    setWeekSchedule({...weekSchedule,calendarEvents:{...calEvs,[dk]:next.length?next:undefined}});
  };
  const saveEvent=(dk,ev)=>{
    const cur=calEvs[dk]||[];
    setWeekSchedule({...weekSchedule,calendarEvents:{...calEvs,[dk]:[...cur,{...ev,id:String(Date.now())}]}});
  };
  const removeEvent=(dk,id)=>{
    const cur=(calEvs[dk]||[]).filter(e=>e.id!==id);
    setWeekSchedule({...weekSchedule,calendarEvents:{...calEvs,[dk]:cur.length?cur:undefined}});
  };
  const getWeekForDate=date=>{
    if(!blockConfig?.startDate)return null;
    const start=new Date(blockConfig.startDate);
    const diff=Math.floor((date-start)/86400000);
    if(diff<0||diff>=tw*7)return null;
    return Math.floor(diff/7)+1;
  };
  const handleDragStart=(e,item)=>{setDragging(item);e.dataTransfer.effectAllowed='move';e.stopPropagation();};
  const handleDragEnd=()=>{setDragging(null);setDragOverDk(null);};
  const handleDragOver=(e,date)=>{
    if(!dragging||!date||dragging.type!=='muscu')return;
    const tw2=getWeekForDate(date);
    if(tw2===null||tw2!==dragging.week)return;
    e.preventDefault();e.dataTransfer.dropEffect='move';
    setDragOverDk(toKey(date));
  };
  const handleDrop=(e,date)=>{
    e.preventDefault();
    if(!dragging||!date||dragging.type!=='muscu')return;
    const tw2=getWeekForDate(date);
    if(tw2===null||tw2!==dragging.week)return;
    const dayIdx=(date.getDay()+6)%7;
    const prev=weekSchedule||{};const prevSess=prev.sessions||{};
    const wMap={...(prevSess[dragging.week]||{}),[dragging.sessId]:dayIdx};
    setWeekSchedule({...prev,sessions:{...prevSess,[dragging.week]:wMap}});
    setDragging(null);setDragOverDk(null);
  };

  // Données du jour sélectionné
  const selEvs=selDk?dayEvs(selDk):[];
  const selSess=selDk?sessMap[selDk]||[]:[];
  const hasDayOff=selEvs.some(e=>e.type==='dayoff');
  const sportEvs=selEvs.filter(e=>e.type!=='dayoff');
  const selWell=selDk?getWell(selDk):null;
  const selScore=calcScore(selWell);
  const selNutr=selDk?getNutr(selDk):null;
  const selDateLabel=selDk?(()=>{const[sy,sm,sd]=[+selDk.slice(0,4),+selDk.slice(4,6)-1,+selDk.slice(6,8)];return new Date(sy,sm,sd).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});})():null;

  return(<div style={{background:C.s1,borderRadius:18,border:'1px solid '+C.brd,overflow:'hidden',marginBottom:14}}>
    {/* En-tête */}
    <div style={{padding:'14px 16px 12px',borderBottom:'1px solid '+C.brd+'80'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontSize:15,fontWeight:800,color:C.tx,letterSpacing:'-0.2px'}}>{MONTHS_FR[vm.m]} <span style={{color:C.tx3,fontWeight:500}}>{vm.y}</span></div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button onClick={prevM} style={{width:28,height:28,borderRadius:8,border:'1px solid '+C.brdL,background:C.s2,color:C.tx2,fontSize:15,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <button onClick={()=>{setSelDk(null);setVm({y:new Date().getFullYear(),m:new Date().getMonth()});}} style={{padding:'4px 10px',borderRadius:7,border:'1px solid '+C.brdL,background:C.s2,color:C.tx3,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Auj.</button>
          <button onClick={nextM} style={{width:28,height:28,borderRadius:8,border:'1px solid '+C.brdL,background:C.s2,color:C.tx2,fontSize:15,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
        </div>
      </div>
    </div>
    {/* Jours de semaine */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0,borderBottom:'1px solid '+C.brd+'60',padding:'0 2px'}}>
      {DAYS_S.map(d=><div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',padding:'6px 0'}}>{d}</div>)}
    </div>
    {/* Grille mensuelle */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0}}>
      {cells.map((date,i)=>{
        if(!date)return<div key={'e'+i} style={{minHeight:88,borderRight:i%7<6?'1px solid '+C.brd+'30':'none',borderBottom:'1px solid '+C.brd+'30'}}/>;
        const dk=toKey(date);
        const isToday=dk===todKey;
        const isSel=selDk===dk;
        const isDragOver=dragOverDk===dk;
        const isPast=date<new Date(new Date().setHours(0,0,0,0))&&!isToday;
        const sessList=sessMap[dk]||[];
        const evs=dayEvs(dk);
        const isDayOff=evs.some(e=>e.type==='dayoff');
        const sports=evs.filter(e=>e.type!=='dayoff');
        const well=getWell(dk);
        const ws=calcScore(well);
        const nutr=getNutr(dk);
        const canDrop=dragging&&getWeekForDate(date)===dragging?.week;
        const allDone=sessList.length>0&&sessList.filter(s=>s.type==='muscu').every(s=>s.done);
        const hasMissed=isPast&&sessList.filter(s=>s.type==='muscu').some(s=>!s.done);
        const bgCell=isDayOff?C.rS+'55':isToday?C.acS+'60':isSel?C.acS+'40':allDone&&sessList.length>0?C.g+'08':hasMissed?C.r+'08':'transparent';
        return(<div key={dk}
          onClick={()=>!dragging&&setSelDk(isSel?null:dk)}
          onDragOver={e=>handleDragOver(e,date)}
          onDrop={e=>handleDrop(e,date)}
          onDragLeave={()=>setDragOverDk(null)}
          style={{
            minHeight:88,position:'relative',
            background:bgCell,
            borderRight:i%7<6?'1px solid '+C.brd+'30':'none',
            borderBottom:'2px solid '+(isSel?C.ac:isToday?C.ac+'80':'transparent'),
            padding:'5px 4px 4px',cursor:dragging?'crosshair':'pointer',
            transition:'background 0.1s',userSelect:'none',overflow:'hidden',
          }}>
          {/* Overlay drag — filtre coloré sur le survol */}
          {isDragOver&&canDrop&&<div style={{position:'absolute',inset:0,background:C.acS,border:'2px solid '+C.ac,borderRadius:0,zIndex:2,pointerEvents:'none',boxShadow:'inset 0 0 0 1px '+C.ac+'60'}}/>}
          {/* Trait aujourd'hui à gauche */}
          {isToday&&<div style={{position:'absolute',top:4,left:0,width:2,height:'calc(100% - 8px)',borderRadius:2,background:C.ac}}/>}
          {/* Numéro */}
          <div style={{fontSize:isToday?15:12,fontWeight:isToday?800:400,color:isToday?C.ac:isDayOff?C.r:isPast?C.tx3:C.tx,textAlign:'center',lineHeight:1,marginBottom:3}}>
            {date.getDate()}
            {isDayOff&&<span style={{fontSize:7,color:C.r,marginLeft:2,fontWeight:700,verticalAlign:'top'}}>off</span>}
          </div>
          {/* Séances */}
          <div style={{display:'flex',flexDirection:'column',gap:2,marginBottom:2,padding:'0 1px'}}>
            {sessList.slice(0,3).map((s,j)=>{
              const missed=isPast&&!s.done&&s.type==='muscu';
              const col=s.type==='energy'?C.coach:s.done?C.g:missed?C.r:C.b;
              const indicator=s.type==='energy'?'⚡':s.done?'✓':missed?'✗':'·';
              const isDraggingThis=dragging?.sessId===s.sessId&&dragging?.week===s.week;
              return(<div key={j}
                draggable={s.type==='muscu'}
                onDragStart={e=>handleDragStart(e,s)}
                onDragEnd={handleDragEnd}
                onClick={e=>{e.stopPropagation();if(s.type==='muscu')setSessDetail({sessId:s.sessId,week:s.week});}}
                style={{fontSize:8,fontWeight:700,color:col,background:col+'22',borderRadius:4,padding:'2px 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:s.type==='muscu'?'grab':'default',opacity:isDraggingThis?0.25:1,display:'flex',alignItems:'center',gap:2,lineHeight:1.5}}>
                <span style={{flexShrink:0}}>{indicator}</span>
                <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{s.sess?.short||s.sessId}</span>
              </div>);
            })}
            {sessList.length>3&&<div style={{fontSize:7,color:C.tx3,textAlign:'center'}}>+{sessList.length-3}</div>}
          </div>
          {/* Événements sport — violet, avec label tronqué */}
          {sports.slice(0,2).map((ev,j)=><div key={j} style={{display:'flex',alignItems:'center',gap:2,background:C.acS,border:'1px solid '+C.ac+'40',borderRadius:4,padding:'2px 4px',marginBottom:1,overflow:'hidden'}}>
            <span style={{fontSize:8,flexShrink:0}}>{ev.emoji}</span>
            <span style={{fontSize:7,fontWeight:700,color:C.ac,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</span>
          </div>)}
          {/* Wellness dot */}
          {ws!==null&&<div style={{width:16,height:16,borderRadius:'50%',background:wColor(ws),margin:'2px auto 0',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px '+wColor(ws)+'50'}}>
            <span style={{fontSize:6,fontWeight:800,color:'#fff',lineHeight:1}}>{ws}</span>
          </div>}
          {/* Nutrition */}
          {nutr&&<div style={{textAlign:'center',fontSize:8,marginTop:1}}>🍽</div>}
        </div>);
      })}
    </div>

    {/* Panneau jour sélectionné */}
    {selDk&&<div style={{borderTop:'1px solid '+C.brd+'80',background:C.s2}}>
      {/* Header */}
      <div style={{padding:'10px 14px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.tx,textTransform:'capitalize'}}>{selDateLabel}</div>
          {!blockConfig?.startDate&&<div style={{fontSize:9,color:C.o,marginTop:2}}>Définis une date de début de bloc pour voir les séances.</div>}
        </div>
        <button onClick={()=>setSelDk(null)} style={{background:'none',border:'none',color:C.tx3,cursor:'pointer',fontSize:22,lineHeight:1,padding:'0 4px'}}>×</button>
      </div>
      {/* Cartes résumé — cliquables */}
      <div style={{padding:'0 14px 10px',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {/* Wellness */}
        {selWell&&selScore!==null&&<div onClick={()=>setPreviewWell(selWell)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:10,background:wColor(selScore)+'15',border:'1px solid '+wColor(selScore)+'30',cursor:'pointer'}}>
          <div style={{width:24,height:24,borderRadius:'50%',background:wColor(selScore),display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 4px '+wColor(selScore)+'60'}}>
            <span style={{fontSize:9,fontWeight:800,color:'#fff'}}>{selScore}</span>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:wColor(selScore)}}>{wLabel(selScore)}</div>
            <div style={{fontSize:9,color:C.tx3}}>forme ↗</div>
          </div>
        </div>}
        {/* Séances muscu */}
        {selSess.filter(s=>s.type==='muscu').map((item,i)=>{
          const missed=item.sess&&!item.done;
          const dc=item.done?C.g:missed?C.r:C.b;
          const log=sessionLogs[item.sessId+'_'+item.week];
          return(<div key={i} onClick={()=>setSessDetail({sessId:item.sessId,week:item.week})} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:10,background:dc+'12',border:'1px solid '+dc+'30',cursor:'pointer'}}>
            <span style={{fontSize:14}}>{item.done?'✅':missed?'❌':'🏋'}</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:dc}}>{item.sess?.name||item.sessId}</div>
              {log?.duration?<div style={{fontSize:9,color:C.tx3}}>{fmtDur(log.duration)}</div>:<div style={{fontSize:9,color:C.tx3}}>S{item.week}</div>}
            </div>
            <span style={{fontSize:9,color:C.tx3,marginLeft:'auto'}}>↗</span>
          </div>);
        })}
        {/* Séances énergie */}
        {selSess.filter(s=>s.type==='energy').map((item,i)=><div key={'e'+i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:10,background:C.coach+'12',border:'1px solid '+C.coach+'30'}}>
          <span style={{fontSize:14}}>⚡</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.coach}}>{item.sess?.session_label||'Séance énergie'}</div>
            <div style={{fontSize:9,color:C.tx3}}>S{item.week}</div>
          </div>
        </div>)}
        {/* Nutrition */}
        {selNutr&&<div onClick={()=>setPreviewNutr(selNutr)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:10,background:C.o+'12',border:'1px solid '+C.o+'30',cursor:'pointer'}}>
          <span style={{fontSize:14}}>🍽</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.o}}>{selNutr.total_calories_consumed!=null?selNutr.total_calories_consumed+' kcal':'Nutrition'}</div>
            <div style={{fontSize:9,color:C.tx3}}>consommées ↗</div>
          </div>
        </div>}
        {/* Événements */}
        {sportEvs.length>0&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:10,background:C.bS,border:'1px solid '+C.b+'30',flexWrap:'wrap'}}>
          {sportEvs.map(ev=><div key={ev.id} style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:12}}>{ev.emoji}</span>
            <span style={{fontSize:10,fontWeight:600,color:C.b}}>{ev.label}</span>
            <button onClick={e=>{e.stopPropagation();removeEvent(selDk,ev.id);}} style={{background:'none',border:'none',color:C.r,cursor:'pointer',fontSize:13,padding:'0 2px',lineHeight:1}}>×</button>
          </div>)}
        </div>}
        {!selWell&&!selSess.length&&!selNutr&&!sportEvs.length&&<span style={{fontSize:11,color:C.tx3}}>Aucune donnée pour ce jour</span>}
      </div>
      {/* Actions */}
      <div style={{borderTop:'1px solid '+C.brd+'60',padding:'10px 14px 12px',display:'flex',gap:6,flexWrap:'wrap'}}>
        <button onClick={()=>toggleDayOff(selDk)} style={{padding:'6px 12px',borderRadius:20,border:'1px solid '+(hasDayOff?C.r+'60':C.brdL),background:hasDayOff?C.rS:'transparent',color:hasDayOff?C.r:C.tx3,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {hasDayOff?'✕ Retirer OFF':'+ Jour OFF'}
        </button>
        <button onClick={()=>setAddEv(addEv?null:{label:'',eventType:'match',emoji:'⚔️'})} style={{padding:'6px 12px',borderRadius:20,border:'1px solid '+C.b+'40',background:addEv?C.bS:'transparent',color:C.b,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          {addEv?'Annuler':'+ Événement'}
        </button>
      </div>
      {addEv&&<div style={{padding:'0 14px 14px'}}>
        <div style={{padding:'12px',borderRadius:10,background:C.s1,border:'1px solid '+C.brd}}>
          <input value={addEv.label} onChange={e=>setAddEv(f=>({...f,label:e.target.value}))} placeholder="Nom de l'événement..." style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:'inherit',marginBottom:8,boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
            {EV_TYPES.map(t=><button key={t.k} onClick={()=>setAddEv(f=>({...f,eventType:t.k,emoji:t.e}))} style={{padding:'5px 10px',borderRadius:7,border:'1px solid '+(addEv.eventType===t.k?C.b+'60':C.brdL),background:addEv.eventType===t.k?C.bS:'transparent',color:addEv.eventType===t.k?C.b:C.tx3,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{t.e} {t.l}</button>)}
          </div>
          <button onClick={()=>{if(addEv.label.trim()){saveEvent(selDk,{...addEv,type:'sport_event'});setAddEv(null);}}} style={{width:'100%',padding:'8px 0',borderRadius:9,border:'none',background:C.b,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Ajouter</button>
        </div>
      </div>}
    </div>}

    {/* Modal wellness (bottom sheet) */}
    {previewWell&&<div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setPreviewWell(null)}>
      <div style={{width:'100%',maxWidth:500,background:C.s1,borderRadius:'20px 20px 0 0',padding:'20px 20px 32px',overflowY:'auto',maxHeight:'80vh'}} onClick={e=>e.stopPropagation()}>
        {(()=>{const w=previewWell;const ws2=calcScore(w);const wc=wColor(ws2);return(<>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:wc,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:15,fontWeight:800,color:'#fff'}}>{ws2}</span></div>
              <div><div style={{fontSize:15,fontWeight:700,color:wc}}>{wLabel(ws2)}</div><div style={{fontSize:10,color:C.tx3}}>Forme du jour</div></div>
            </div>
            <button onClick={()=>setPreviewWell(null)} style={{background:'none',border:'none',color:C.tx3,fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:14}}>
            {[{l:'Récup.',v:w.fatigue,e:'😴'},{l:'Sommeil',v:w.sommeil,e:'💤'},{l:'Stress',v:w.stress,e:'🧠'},{l:'Énergie',v:w.energie,e:'⚡'},{l:'DOMS',v:w.doms,e:'💪'}].map(item=>{const iv=item.v||0;const ic=iv>=4?C.g:iv>=3?C.o:C.r;return(<div key={item.l} style={{background:C.s2,borderRadius:10,padding:'8px 4px',textAlign:'center',border:'1px solid '+ic+'20'}}><div style={{fontSize:13,marginBottom:2}}>{item.e}</div><div style={{fontSize:15,fontWeight:800,color:ic}}>{item.v||'—'}<span style={{fontSize:8,color:C.tx3}}>/5</span></div><div style={{fontSize:8,color:C.tx3,marginTop:1}}>{item.l}</div></div>);})}
          </div>
          {(w.coucher||w.reveil||w.sleepDur!=null)&&<div style={{padding:'10px 14px',borderRadius:10,background:C.s2,marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Sommeil</div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>{w.coucher&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:8,background:C.bg}}><span style={{fontSize:11}}>🌙</span><span style={{fontSize:12,fontWeight:600,color:C.tx}}>{String(w.coucher.h).padStart(2,'0')}:{String(w.coucher.m).padStart(2,'0')}</span></div>}{w.reveil&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:8,background:C.bg}}><span style={{fontSize:11}}>☀️</span><span style={{fontSize:12,fontWeight:600,color:C.tx}}>{String(w.reveil.h).padStart(2,'0')}:{String(w.reveil.m).padStart(2,'0')}</span></div>}{w.sleepDur!=null&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:8,background:C.b+'18'}}><span style={{fontSize:11}}>💤</span><span style={{fontSize:12,fontWeight:700,color:C.b}}>{typeof w.sleepDur==='number'?w.sleepDur.toFixed(1):w.sleepDur}h</span></div>}</div>{w.sleepInterrupt===true&&<div style={{marginTop:6,fontSize:11,color:C.o,padding:'4px 8px',borderRadius:6,background:C.o+'12'}}>⚠ Réveil nocturne{w.sleepInterruptNote?' — '+w.sleepInterruptNote:''}</div>}</div>}
          {w.poids&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:10,background:C.s2,marginBottom:10}}><span style={{fontSize:12}}>⚖️</span><div><div style={{fontSize:12,fontWeight:700,color:C.tx}}>{w.poids} kg</div><div style={{fontSize:9,color:C.tx3}}>Poids ce matin</div></div></div>}
          {w.domsZones?.length>0&&<div style={{padding:'10px 14px',borderRadius:10,background:C.o+'10',border:'1px solid '+C.o+'30',marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:C.o,textTransform:'uppercase',marginBottom:6}}>Zones DOMS</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{w.domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:10,padding:'3px 8px',borderRadius:6,background:C.o+'20',color:C.o}}>{z.label}</span>:null;})}</div></div>}
          {w.injComment&&<div style={{padding:'10px 14px',borderRadius:10,background:C.r+'10',border:'1px solid '+C.r+'30',fontSize:11,color:C.r}}>🩺 {w.injComment}</div>}
        </>);})()}
      </div>
    </div>}

    {/* Modal nutrition (bottom sheet) */}
    {previewNutr&&<div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setPreviewNutr(null)}>
      <div style={{width:'100%',maxWidth:500,background:C.s1,borderRadius:'20px 20px 0 0',padding:'20px 20px 32px',overflowY:'auto',maxHeight:'80vh'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.tx}}>Alimentation</div>
          <button onClick={()=>setPreviewNutr(null)} style={{background:'none',border:'none',color:C.tx3,fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
        </div>
        {(()=>{const n=previewNutr;return(<>
          {n.total_calories_consumed!=null&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius:10,background:C.o+'12',border:'1px solid '+C.o+'25',marginBottom:12}}><span style={{fontSize:11,color:C.tx3}}>Total consommé</span><span style={{fontSize:20,fontWeight:800,color:C.o}}>{n.total_calories_consumed}<span style={{fontSize:11,fontWeight:400,color:C.tx3}}> kcal</span></span></div>}
          {(n.glucides_consumed!=null||n.lipides_consumed!=null||n.proteines_consumed!=null)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>{[{l:'Glucides',v:n.glucides_consumed,c:C.b,e:'🍞'},{l:'Lipides',v:n.lipides_consumed,c:C.o,e:'🥑'},{l:'Protéines',v:n.proteines_consumed,c:C.g,e:'🥩'}].map(m=><div key={m.l} style={{background:C.s2,borderRadius:10,padding:'12px 6px',textAlign:'center',border:'1px solid '+m.c+'20'}}><div style={{fontSize:14,marginBottom:4}}>{m.e}</div><div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v!=null?Math.round(m.v):'-'}<span style={{fontSize:9,color:C.tx3}}>g</span></div><div style={{fontSize:10,color:C.tx3,marginTop:2}}>{m.l}</div></div>)}</div>}
        </>);})()}
      </div>
    </div>}

    {/* SessionDetailModal — toutes séances (faites ou planifiées) */}
    {sessDetail&&<SessionDetailModal sid={sessDetail.sessId} wk={sessDetail.week} sessions={sessions} exos={exos} sets={sets} completedSessions={completedSessions} allMethods={allMethods} blockConfig={blockConfig} currentWeek={sessDetail.week} onClose={()=>setSessDetail(null)}/>}
  </div>);
}

function WeekCalendar({sessions,completedSessions,currentWeek,weekSchedule,setWeekSchedule,C,wellnessHistory={},weightLog={},sessionLogs={},nutritionLog={},exos={},energySessions=[],energyWeekPlan={},energyDayPlan={}}){
  const[selectDay,setSelectDay]=useState(null);
  const[weekOffset,setWeekOffset]=useState(0);
  const[activityModal,setActivityModal]=useState(null);// {dayIdx} | null
  const[activityForm,setActivityForm]=useState({label:'',emoji:'🏅',duration:30,intensity:3,notes:''});
  const[previewSess,setPreviewSess]=useState(null);// session to preview
  const[previewWell,setPreviewWell]=useState(null);// wellness to preview
  const[previewNutr,setPreviewNutr]=useState(null);// nutrition to preview
  const DAYS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const DAYS_FULL=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
  const MONTHS=["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  const ACTIVITIES=[{label:'Course',emoji:'🏃'},{label:'Five',emoji:'⚽'},{label:'Vélo',emoji:'🚴'},{label:'Natation',emoji:'🏊'},{label:'Tennis',emoji:'🎾'},{label:'Boxe',emoji:'🥊'},{label:'Yoga',emoji:'🧘'},{label:'Basket',emoji:'🏀'},{label:'Ski',emoji:'🎿'},{label:'Golf',emoji:'⛳'}];
  const EMOJI_OPTS=['🏃','🚴','🏊','⚽','🎾','🥊','🧘','🏀','🎿','⛳','🏋','🤸','🧗','🏄','⛷','🏇','🤺','🏓','🥋','🤾','🎯','🛹','🏂','🤽','🚣','🎸','📚','🎨','🛼','🧩','🎭','🥾'];
  const today=new Date();
  const dow=today.getDay();
  const baseMonday=new Date(today);
  baseMonday.setDate(today.getDate()-(dow===0?6:dow-1));
  const monday=new Date(baseMonday);
  monday.setDate(baseMonday.getDate()+weekOffset*7);
  const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
  const todStr=todayKey();
  const doneSet=new Set(completedSessions[currentWeek]||[]);
  const wk=weekSchedule||{};
  const extras=wk.extras||{};
  const dKey=d=>String(d.getFullYear())+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  const dayExtras=idx=>extras[dKey(weekDays[idx])]||[];
  const sessionsForDay=dayIdx=>(sessions||[]).filter(s=>{const d=wk.sessions?.[currentWeek]?.[s.id]??s.day_of_week??null;return d===dayIdx;});
  const energySessionsForDay=dayIdx=>{const wkSessKeys=energyWeekPlan[currentWeek]||[];return(energySessions||[]).filter(s=>wkSessKeys.includes(s.session_key)&&energyDayPlan[currentWeek]?.[s.session_key]===dayIdx);};
  const savedActivities=wk.savedActivities||[];
  const allActivities=[...ACTIVITIES,...savedActivities.filter(s=>!ACTIVITIES.find(a=>a.label===s.label))];
  const INT_LABELS=['Récup','Très facile','Facile','Modéré','Modéré+','Soutenu','Dur','Très dur','Maximal','Limite'];
  const INT_COLORS=['#4ADE80','#6FCF97','#86EFAC',C.o,'#F59E0B','#F97316','#EF4444','#DC2626','#B91C1C','#7F1D1D'];
  const chargeScore=(dur,int)=>Math.round((dur||0)*(int||1)/10);
  const openActivityModal=(dayIdx,label,emoji)=>{setActivityForm({label,emoji:emoji||'🏅',duration:30,intensity:7,notes:''});setActivityModal({dayIdx});};
  const confirmActivity=()=>{
    if(!activityModal)return;
    const{dayIdx}=activityModal;
    const{label,emoji,duration,intensity,notes}=activityForm;
    if(!label.trim())return;
    const dateKey=dKey(weekDays[dayIdx]);
    const cur=dayExtras(dayIdx);
    const newExtra={id:String(Date.now()),label:label.trim(),emoji,duration,intensity,notes:notes.trim()||undefined};
    const isDefault=ACTIVITIES.find(a=>a.label===label.trim());
    const newSaved=isDefault?savedActivities:[...savedActivities.filter(a=>a.label!==label.trim()),{label:label.trim(),emoji}];
    setWeekSchedule({...wk,extras:{...extras,[dateKey]:[...cur,newExtra]},savedActivities:newSaved});
    setActivityModal(null);
  };
  const removeExtra=(dayIdx,id)=>{const dateKey=dKey(weekDays[dayIdx]);const cur=dayExtras(dayIdx).filter(e=>e.id!==id);setWeekSchedule({...wk,extras:{...extras,[dateKey]:cur.length?cur:undefined}});};
  const removeCustomActivity=(label)=>{const newSaved=savedActivities.filter(a=>a.label!==label);setWeekSchedule({...wk,savedActivities:newSaved});};
  const isoKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const getWell=d=>wellnessHistory[dKey(d)]||null;
  const getNutr=d=>nutritionLog[isoKey(d)]||nutritionLog[dKey(d)]||null;
  const wScore=w=>w?Math.round(((w.fatigue||3)+(w.sommeil||3)+(w.stress||3)+(w.energie||3)+(w.doms||3))/25*100):null;
  const wColor=s=>s>=80?C.g:s>=65?"#6FCF97":s>=50?C.o:s>=35?"#E8956D":C.r;
  const isThisWeek=weekOffset===0;
  const sameMonth=monday.getMonth()===sunday.getMonth();
  const weekLabel=isThisWeek?"Cette semaine":sameMonth?(monday.getDate()+" – "+sunday.getDate()+" "+MONTHS[monday.getMonth()]):(monday.getDate()+" "+MONTHS[monday.getMonth()]+" – "+sunday.getDate()+" "+MONTHS[sunday.getMonth()]);
  // Stats résumé de la semaine
  const weekSessions=weekDays.flatMap((_,i)=>sessionsForDay(i));
  const weekDone=weekSessions.filter(s=>doneSet.has(s.id)).length;
  const weekWellDays=weekDays.filter(d=>getWell(d)!==null).length;
  const weekAvgWell=(()=>{const sc=weekDays.map(d=>{const w=getWell(d);return w?wScore(w):null}).filter(v=>v!==null);return sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):null;})();
  const selData=selectDay!==null?{date:weekDays[selectDay],well:getWell(weekDays[selectDay]),nutr:getNutr(weekDays[selectDay]),sessList:sessionsForDay(selectDay),energyList:energySessionsForDay(selectDay),exs:dayExtras(selectDay)}:null;

  return(<div style={{background:C.s1,borderRadius:18,border:"1px solid "+C.brd,overflow:"hidden",marginBottom:14}}>
    {/* Header */}
    <div style={{padding:"14px 16px 12px",borderBottom:"1px solid "+C.brd+"80"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        {/* Nav semaine */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>{setWeekOffset(p=>p-1);setSelectDay(null);setDetailType(null);}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,fontSize:15,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>‹</button>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:isThisWeek?C.ac:C.tx,letterSpacing:"-0.2px"}}>{weekLabel}</div>
            {isThisWeek&&<div style={{fontSize:9,color:C.tx3,marginTop:1}}>Semaine en cours</div>}
          </div>
          <button onClick={()=>{if(weekOffset<0){setWeekOffset(p=>p+1);setSelectDay(null);setDetailType(null);}}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+(weekOffset<0?C.brdL:C.brd+"40"),background:weekOffset<0?C.s2:"transparent",color:weekOffset<0?C.tx2:C.tx3+"30",fontSize:15,cursor:weekOffset<0?"pointer":"default",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
        {/* KPIs semaine */}
        <div style={{display:"flex",gap:8}}>
          {weekSessions.length>0&&<div style={{textAlign:"center",padding:"4px 10px",borderRadius:8,background:C.s2}}>
            <div style={{fontSize:13,fontWeight:800,color:weekDone===weekSessions.length?C.g:C.tx}}>{weekDone}<span style={{fontSize:10,fontWeight:400,color:C.tx3}}>/{weekSessions.length}</span></div>
            <div style={{fontSize:8,color:C.tx3,marginTop:1}}>séances</div>
          </div>}
          {weekAvgWell!==null&&<div style={{textAlign:"center",padding:"4px 10px",borderRadius:8,background:wColor(weekAvgWell)+"15"}}>
            <div style={{fontSize:13,fontWeight:800,color:wColor(weekAvgWell)}}>{weekAvgWell}</div>
            <div style={{fontSize:8,color:C.tx3,marginTop:1}}>forme moy.</div>
          </div>}
          {weekWellDays>0&&weekAvgWell===null&&<div style={{textAlign:"center",padding:"4px 10px",borderRadius:8,background:C.s2}}>
            <div style={{fontSize:13,fontWeight:800,color:C.g}}>{weekWellDays}</div>
            <div style={{fontSize:8,color:C.tx3,marginTop:1}}>wellness</div>
          </div>}
        </div>
      </div>
    </div>

    {/* Grille jours */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:0}}>
      {weekDays.map((date,i)=>{
        const isToday=dKey(date)===todStr;
        const isPast=date<new Date(new Date().setHours(0,0,0,0))&&!isToday;
        const isFuture=!isPast&&!isToday;
        const sessList=sessionsForDay(i);
        const exs=dayExtras(i);
        const isSel=selectDay===i;
        const allDone=sessList.length>0&&sessList.every(s=>doneSet.has(s.id));
        const anyDone=sessList.some(s=>doneSet.has(s.id));
        const hasMissed=isPast&&sessList.some(s=>!doneSet.has(s.id));
        const well=getWell(date);
        const ws=well?wScore(well):null;
        const nutr=getNutr(date);
        // Couleur de fond
        const bgTop=allDone?C.g+"12":hasMissed&&!anyDone?C.r+"08":isToday?C.ac+"10":isSel?C.ac+"08":"transparent";
        const energyList=energySessionsForDay(i);
        const accentLeft=allDone?C.g:hasMissed&&!anyDone?C.r:sessList.length>0&&isFuture?C.b:isToday?C.ac:isSel?C.ac+"80":"transparent";
        return(<div key={i} onClick={()=>setSelectDay(isSel?null:i)}
          style={{position:"relative",padding:"10px 4px 8px",textAlign:"center",cursor:"pointer",background:bgTop,borderRight:i<6?"1px solid "+C.brd+"40":"none",borderBottom:isSel?"2px solid "+C.ac:"2px solid transparent",transition:"all 0.15s",minHeight:80}}>
          {/* Accent ligne gauche pour aujourd'hui */}
          {isToday&&<div style={{position:"absolute",top:6,left:0,width:2,height:"calc(100% - 12px)",borderRadius:2,background:C.ac}}/>}
          {/* Jour label */}
          <div style={{fontSize:8,fontWeight:isToday?700:500,color:isToday?C.ac:C.tx3,marginBottom:3,letterSpacing:"0.3px",textTransform:"uppercase"}}>{DAYS[i]}</div>
          {/* Numéro */}
          <div style={{fontSize:isToday?16:14,fontWeight:isToday?800:500,color:isToday?C.ac:isPast?C.tx3:C.tx,marginBottom:4,lineHeight:1}}>{date.getDate()}</div>
          {/* Sessions muscu */}
          {sessList.length>0&&<div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:3,padding:"0 2px"}}>
            {sessList.map(s=>{const done=doneSet.has(s.id);const missed=isPast&&!done;const dc=done?C.g:missed?C.r:C.b;return(<div key={s.id} style={{fontSize:7,fontWeight:700,padding:"2px 3px",borderRadius:4,background:dc+"20",color:dc,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",justifyContent:"center",gap:1}}><span>{done?"✓":missed?"✗":"·"}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{s.short||s.name.slice(0,3)}</span></div>);})}
          </div>}
          {/* Sessions énergie */}
          {energyList.length>0&&<div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:3,padding:"0 2px"}}>
            {energyList.map(s=><div key={s.session_key} style={{fontSize:7,fontWeight:700,padding:"2px 3px",borderRadius:4,background:C.coach+"20",color:C.coach,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",justifyContent:"center",gap:1}}><span>⚡</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{(s.session_label||"Énergie").slice(0,5)}</span></div>)}
          </div>}
          {/* Wellness dot */}
          {ws!==null&&<div title={"Forme "+ws+"/100"} style={{width:18,height:18,borderRadius:"50%",background:wColor(ws),margin:"2px auto",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px "+wColor(ws)+"50"}}><span style={{fontSize:7,fontWeight:800,color:"#fff",lineHeight:1}}>{ws}</span></div>}
          {/* Icônes bottom */}
          <div style={{display:"flex",justifyContent:"center",gap:2,marginTop:2,flexWrap:"wrap"}}>
            {nutr&&<span style={{fontSize:9}} title="Nutrition">🍽</span>}
            {exs.slice(0,2).map(e=>(<span key={e.id} style={{fontSize:9}}>{e.emoji}</span>))}
          </div>
          {/* Jour vide */}
          {sessList.length===0&&energyList.length===0&&exs.length===0&&ws===null&&!nutr&&<div style={{width:3,height:3,borderRadius:"50%",background:C.brd,margin:"4px auto 0"}}/>}
        </div>);
      })}
    </div>

    {/* Panel détail jour */}
    {selectDay!==null&&selData&&(<div style={{borderTop:"1px solid "+C.brd+"80",background:C.s2}}>
      {/* Header du jour */}
      <div style={{padding:"10px 14px 8px"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.tx}}>{DAYS_FULL[selectDay]}</div>
        <div style={{fontSize:10,color:C.tx3}}>{selData.date.getDate()} {MONTHS[selData.date.getMonth()]} {selData.date.getFullYear()}</div>
      </div>
      {/* Vue résumé — tout toujours visible */}
      <div style={{padding:"0 14px 10px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {selData.well&&(()=>{const ws2=wScore(selData.well);const wc=wColor(ws2);return(<div onClick={()=>setPreviewWell(selData.well)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:10,background:wc+"15",border:"1px solid "+wc+"30",cursor:"pointer"}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:wc,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px "+wc+"60"}}><span style={{fontSize:9,fontWeight:800,color:"#fff"}}>{ws2}</span></div>
          <div><div style={{fontSize:11,fontWeight:700,color:wc}}>{ws2>=80?"Optimal":ws2>=65?"Bon":ws2>=50?"Modéré":ws2>=35?"Fatigué":"Surmenage"}</div><div style={{fontSize:9,color:C.tx3}}>forme ↗</div></div>
        </div>);})()}
        {selData.sessList.map(s=>{const done=doneSet.has(s.id);const isPD=selData.date<new Date(new Date().setHours(0,0,0,0));const missed=isPD&&!done;const dc=done?C.g:missed?C.r:C.b;const log=sessionLogs[s.id+"_"+currentWeek];return(<div key={s.id} onClick={()=>setPreviewSess(s)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:10,background:dc+"12",border:"1px solid "+dc+"30",cursor:"pointer"}}>
          <span style={{fontSize:14}}>{done?"✅":missed?"❌":"🏋"}</span>
          <div><div style={{fontSize:11,fontWeight:700,color:dc}}>{s.name}</div>{log?.duration&&<div style={{fontSize:9,color:C.tx3}}>{fmtTime(log.duration)}</div>}</div>
          <span style={{fontSize:9,color:C.tx3,marginLeft:"auto"}}>↗</span>
        </div>);})}
        {(selData.energyList||[]).map(s=><div key={s.session_key} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:10,background:C.coach+"12",border:"1px solid "+C.coach+"30"}}>
          <span style={{fontSize:14}}>⚡</span>
          <div><div style={{fontSize:11,fontWeight:700,color:C.coach}}>{s.session_label||"Séance énergie"}</div><div style={{fontSize:9,color:C.tx3}}>{(s.appareil_types||[]).join(", ")||"Énergétique"}</div></div>
        </div>)}
        {selData.nutr&&<div onClick={()=>setPreviewNutr(selData.nutr)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:10,background:C.o+"12",border:"1px solid "+C.o+"30",cursor:"pointer"}}>
          <span style={{fontSize:14}}>🍽</span>
          <div><div style={{fontSize:11,fontWeight:700,color:C.o}}>{selData.nutr.total_calories_consumed!=null?selData.nutr.total_calories_consumed+" kcal":"Nutrition"}</div><div style={{fontSize:9,color:C.tx3}}>consommées ↗</div></div>
        </div>}
        {selData.exs.length>0&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:10,background:C.y+"12",border:"1px solid "+C.y+"30"}}>
          <span style={{fontSize:12}}>{selData.exs.map(e=>e.emoji).join(" ")}</span>
          <div style={{fontSize:10,fontWeight:600,color:C.y}}>{selData.exs.map(e=>e.label).join(", ")}</div>
        </div>}
        {!selData.well&&!selData.sessList.length&&!(selData.energyList||[]).length&&!selData.nutr&&!selData.exs.length&&<span style={{fontSize:11,color:C.tx3}}>Aucune donnée pour ce jour</span>}
      </div>
      {/* Activités libres + ajout */}
      <div style={{borderTop:"1px solid "+C.brd+"60",padding:"10px 14px 12px"}}>
        <button onClick={()=>openActivityModal(selectDay,'','🏅')} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:"1px solid "+C.y+"50",background:C.y+"10",color:C.y,fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:dayExtras(selectDay).length>0?8:0}}>
          <span style={{fontSize:10}}>+</span> Ajouter une activité
        </button>
        {/* Activités du jour */}
        {dayExtras(selectDay).length>0&&<div style={{display:"flex",flexDirection:"column",gap:5}}>
          {dayExtras(selectDay).map(e=>{const charge=chargeScore(e.duration,e.intensity);const ic=e.intensity?INT_COLORS[e.intensity-1]:C.y;return(
            <div key={e.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:9,background:C.y+"0C",border:"1px solid "+C.y+"30"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{e.emoji}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.y}}>{e.label}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:1}}>
                    {e.duration&&<span style={{fontSize:9,color:C.tx3}}>⏱ {e.duration} min</span>}
                    {e.intensity&&<span style={{fontSize:9,fontWeight:600,color:ic}}>RPE {e.intensity}/10</span>}
                    {charge>0&&<span style={{fontSize:9,padding:"0px 5px",borderRadius:4,background:C.ac+"18",color:C.ac,fontWeight:700}}>+{charge} pts</span>}
                  </div>
                  {e.notes&&<div style={{fontSize:9,color:C.tx3,marginTop:1,fontStyle:"italic"}}>"{e.notes}"</div>}
                </div>
              </div>
              <button onClick={ev=>{ev.stopPropagation();removeExtra(selectDay,e.id);}} style={{background:"none",border:"none",color:C.tx3,fontSize:16,cursor:"pointer",padding:4,lineHeight:1}}>×</button>
            </div>
          );})}
        </div>}
      </div>
    </div>)}

    {/* Modal prévisualisation séance */}
    {previewSess&&(<div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setPreviewSess(null)}>
      <div style={{width:"100%",maxWidth:500,background:C.s1,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",overflowY:"auto",maxHeight:"80vh"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.tx}}>{previewSess.name}</div>
            {previewSess.short&&<div style={{fontSize:10,color:C.tx3,marginTop:1}}>{previewSess.short}</div>}
          </div>
          <button onClick={()=>setPreviewSess(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {/* Exercices de la séance groupés par bloc */}
        {(()=>{
          const exList=exos[previewSess.id]||[];
          const weekExos=exList.filter(ex=>ex.weeks&&ex.weeks[currentWeek]);
          if(!weekExos.length&&!exList.length)return(<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"20px 0"}}>Aucun exercice configuré</div>);
          const displayList=weekExos.length?weekExos:exList;
          // Group by bloc
          const blocs=getSessionBlocs(previewSess,displayList);
          const byBloc={};const noBloc=[];
          displayList.forEach(ex=>{if(ex.bloc&&blocs.find(b=>b.id===ex.bloc))byBloc[ex.bloc]=[...(byBloc[ex.bloc]||[]),ex];else noBloc.push(ex);});
          const renderEx=(ex,idx)=>{const wData=ex.weeks?.[currentWeek]||{};const method=wData.method;const mInfo=method?DEF_METHODS[method]:null;const blocColor=ex.bloc&&BT[ex.bloc]?BT[ex.bloc].c:(blocs.find(b=>b.id===ex.bloc)?.color||C.ac);return(<div key={ex.id||idx} style={{padding:"9px 12px",borderRadius:9,background:C.bg,border:"1px solid "+C.brdL,marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:wData.kg||wData.sets?3:0}}>
              <span style={{fontSize:12,fontWeight:600,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{ex.name}</span>
              {mInfo&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:mInfo.c+"20",color:mInfo.c,fontWeight:700,flexShrink:0,marginLeft:6}}>{mInfo.e}</span>}
            </div>
            {(wData.kg||wData.sets||wData.repsRange)&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:3}}>
              {wData.sets&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:C.ac+"15",color:C.ac,fontWeight:600}}>{fmtMR(method,wData.methodParams,wData.sets,wData.repsRange)}</span>}
              {wData.kg&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:C.s2,color:C.tx,fontWeight:600}}>{wData.kg} kg</span>}
              {wData.rir!=null&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:rC(wData.rir)+"15",color:rC(wData.rir),fontWeight:600}}>RIR {rL(wData.rir)}</span>}
              {wData.tempo&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:5,background:C.s2,color:C.tx3}}>{wData.tempo}</span>}
            </div>}
          </div>);};
          return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {blocs.map(bloc=>{const exs=byBloc[bloc.id]||[];if(!exs.length)return null;return(<div key={bloc.id}><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:bloc.color+"18",border:"1px solid "+bloc.color+"40",marginBottom:6}}><div style={{width:8,height:8,borderRadius:2,background:bloc.color,flexShrink:0}}/><span style={{fontSize:10,fontWeight:700,color:bloc.color,textTransform:"uppercase",letterSpacing:"0.3px"}}>{bloc.label}</span><span style={{fontSize:9,color:C.tx3,marginLeft:"auto"}}>{exs.length} ex.</span></div>{exs.map(renderEx)}</div>);})}
            {noBloc.length>0&&<div>{noBloc.map(renderEx)}</div>}
          </div>);
        })()}
        <div style={{marginTop:16,fontSize:10,color:C.tx3,textAlign:"center"}}>
          Semaine {currentWeek} · {(exos[previewSess.id]||[]).filter(ex=>ex.weeks&&ex.weeks[currentWeek]).length} exercice{(exos[previewSess.id]||[]).filter(ex=>ex.weeks&&ex.weeks[currentWeek]).length!==1?"s":""}
        </div>
      </div>
    </div>)}

    {/* Modal forme du jour */}
    {previewWell&&(<div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setPreviewWell(null)}>
      <div style={{width:"100%",maxWidth:500,background:C.s1,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",overflowY:"auto",maxHeight:"80vh"}} onClick={e=>e.stopPropagation()}>
        {(()=>{const w=previewWell;const ws2=wScore(w);const wc=wColor(ws2);return(<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:wc,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:15,fontWeight:800,color:"#fff"}}>{ws2}</span></div>
              <div><div style={{fontSize:15,fontWeight:700,color:wc}}>{ws2>=80?"Optimal":ws2>=65?"Bon":ws2>=50?"Modéré":ws2>=35?"Fatigué":"Surmenage"}</div><div style={{fontSize:10,color:C.tx3}}>Forme du jour</div></div>
            </div>
            <button onClick={()=>setPreviewWell(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:14}}>
            {[{l:"Récup.",v:w.fatigue,e:"😴"},{l:"Sommeil",v:w.sommeil,e:"💤"},{l:"Stress",v:w.stress,e:"🧠"},{l:"Énergie",v:w.energie,e:"⚡"},{l:"DOMS",v:w.doms,e:"💪"}].map(item=>{const iv=item.v||0;const ic=iv>=4?C.g:iv>=3?C.o:C.r;return(<div key={item.l} style={{background:C.s2,borderRadius:10,padding:"8px 4px",textAlign:"center",border:"1px solid "+ic+"20"}}><div style={{fontSize:13,marginBottom:2}}>{item.e}</div><div style={{fontSize:15,fontWeight:800,color:ic}}>{item.v||"—"}<span style={{fontSize:8,color:C.tx3}}>/5</span></div><div style={{fontSize:8,color:C.tx3,marginTop:1}}>{item.l}</div></div>);})}
          </div>
          {(w.coucher||w.reveil||w.sleepDur!=null)&&<div style={{padding:"10px 14px",borderRadius:10,background:C.s2,marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Sommeil</div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{w.coucher&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.bg}}><span style={{fontSize:11}}>🌙</span><span style={{fontSize:12,fontWeight:600,color:C.tx}}>{String(w.coucher.h).padStart(2,"0")}:{String(w.coucher.m).padStart(2,"0")}</span></div>}{w.reveil&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.bg}}><span style={{fontSize:11}}>☀️</span><span style={{fontSize:12,fontWeight:600,color:C.tx}}>{String(w.reveil.h).padStart(2,"0")}:{String(w.reveil.m).padStart(2,"0")}</span></div>}{w.sleepDur!=null&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.b+"18"}}><span style={{fontSize:11}}>💤</span><span style={{fontSize:12,fontWeight:700,color:C.b}}>{typeof w.sleepDur==="number"?w.sleepDur.toFixed(1):w.sleepDur}h</span></div>}</div>{w.sleepInterrupt===true&&<div style={{marginTop:6,fontSize:11,color:C.o,padding:"4px 8px",borderRadius:6,background:C.o+"12"}}>⚠ Réveil nocturne{w.sleepInterruptNote?" — "+w.sleepInterruptNote:""}</div>}</div>}
          {w.poids&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,background:C.s2,marginBottom:10}}><span style={{fontSize:12}}>⚖️</span><div><div style={{fontSize:12,fontWeight:700,color:C.tx}}>{w.poids} kg</div><div style={{fontSize:9,color:C.tx3}}>Poids ce matin</div></div></div>}
          {w.domsZones?.length>0&&<div style={{padding:"10px 14px",borderRadius:10,background:C.o+"10",border:"1px solid "+C.o+"30",marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:C.o,textTransform:"uppercase",marginBottom:6}}>Zones DOMS</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{w.domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.o+"20",color:C.o}}>{z.label}</span>:null;})}</div></div>}
          {w.injComment&&<div style={{padding:"10px 14px",borderRadius:10,background:C.r+"10",border:"1px solid "+C.r+"30",fontSize:11,color:C.r}}>🩺 {w.injComment}</div>}
        </>);})()}
      </div>
    </div>)}

    {/* Modal nutrition */}
    {previewNutr&&(<div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setPreviewNutr(null)}>
      <div style={{width:"100%",maxWidth:500,background:C.s1,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",overflowY:"auto",maxHeight:"80vh"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:C.tx}}>Alimentation</div>
          <button onClick={()=>setPreviewNutr(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {(()=>{const n=previewNutr;return(<>
          {n.total_calories_consumed!=null&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:10,background:C.o+"12",border:"1px solid "+C.o+"25",marginBottom:12}}><span style={{fontSize:11,color:C.tx3}}>Total consommé</span><span style={{fontSize:20,fontWeight:800,color:C.o}}>{n.total_calories_consumed}<span style={{fontSize:11,fontWeight:400,color:C.tx3}}> kcal</span></span></div>}
          {(n.glucides_consumed!=null||n.lipides_consumed!=null||n.proteines_consumed!=null)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[{l:"Glucides",v:n.glucides_consumed,c:C.b,e:"🍞"},{l:"Lipides",v:n.lipides_consumed,c:C.o,e:"🥑"},{l:"Protéines",v:n.proteines_consumed,c:C.g,e:"🥩"}].map(m=>(<div key={m.l} style={{background:C.s2,borderRadius:10,padding:"12px 6px",textAlign:"center",border:"1px solid "+m.c+"20"}}><div style={{fontSize:14,marginBottom:4}}>{m.e}</div><div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v!=null?m.v:"-"}<span style={{fontSize:9,color:C.tx3}}>g</span></div><div style={{fontSize:10,color:C.tx3,marginTop:2}}>{m.l}</div></div>))}</div>}
        </>);})()}
      </div>
    </div>)}

    {/* Modal ajout activité */}
    {activityModal!==null&&(<div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setActivityModal(null)}>
      <div style={{width:"100%",maxWidth:500,background:C.s1,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",overflowY:"auto",maxHeight:"90vh"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div style={{fontSize:15,fontWeight:700,color:C.tx}}>Détails de l'activité</div>
          <button onClick={()=>setActivityModal(null)} style={{background:"none",border:"none",color:C.tx3,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {/* Emoji + Nom */}
        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:C.tx3,marginBottom:5,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px"}}>Logo</div>
            <div style={{width:46,height:46,borderRadius:12,background:C.s2,border:"2px solid "+C.ac+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{activityForm.emoji}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:C.tx3,marginBottom:5,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px"}}>Activité</div>
            <input value={activityForm.label} onChange={e=>setActivityForm(p=>({...p,label:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontWeight:600,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>
        {/* Emoji picker */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,color:C.tx3,marginBottom:6,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px"}}>Choisir un logo</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {EMOJI_OPTS.map(em=>(<button key={em} onClick={()=>setActivityForm(p=>({...p,emoji:em}))} style={{width:34,height:34,borderRadius:8,border:"2px solid "+(activityForm.emoji===em?C.ac:C.brdL),background:activityForm.emoji===em?C.acS:"transparent",fontSize:17,cursor:"pointer",transition:"all 0.1s"}}>{em}</button>))}
          </div>
        </div>
        {/* Durée */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px"}}>Durée</div>
            <div style={{fontSize:14,fontWeight:800,color:C.tx}}>{activityForm.duration}<span style={{fontSize:10,fontWeight:400,color:C.tx3}}> min</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <button onClick={()=>setActivityForm(p=>({...p,duration:Math.max(5,p.duration-5)}))} style={{width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:16,flexShrink:0}}>−</button>
            <div style={{flex:1,height:5,background:C.s2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(Math.min(activityForm.duration,180)/180*100)+"%",background:C.ac,borderRadius:3,transition:"width 0.15s"}}/></div>
            <button onClick={()=>setActivityForm(p=>({...p,duration:Math.min(300,p.duration+5)}))} style={{width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx2,cursor:"pointer",fontFamily:"inherit",fontSize:16,flexShrink:0}}>+</button>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {[15,30,45,60,90,120].map(d=>(<button key={d} onClick={()=>setActivityForm(p=>({...p,duration:d}))} style={{padding:"4px 9px",borderRadius:7,border:"1px solid "+(activityForm.duration===d?C.ac:C.brdL),background:activityForm.duration===d?C.acS:"transparent",color:activityForm.duration===d?C.ac:C.tx3,fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{d}min</button>))}
          </div>
        </div>
        {/* Intensité */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px",marginBottom:6}}>Intensité</div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
            {INT_LABELS.map((l,i)=>{const ic=INT_COLORS[i];const active=activityForm.intensity===i+1;return(<button key={i} onClick={()=>setActivityForm(p=>({...p,intensity:i+1}))} style={{flex:"0 0 calc(20% - 3px)",padding:"7px 2px",borderRadius:8,border:"1.5px solid "+(active?ic:C.brdL),background:active?ic+"20":"transparent",color:active?ic:C.tx3,fontSize:8,fontWeight:active?700:400,cursor:"pointer",fontFamily:"inherit",textAlign:"center",lineHeight:1.4,transition:"all 0.15s"}}><span style={{fontSize:12,display:"block",fontWeight:700}}>{i+1}</span>{l}</button>);})}
          </div>
        </div>
        {/* Notes */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.4px",marginBottom:5}}>Notes <span style={{fontSize:8,fontWeight:400}}>(optionnel)</span></div>
          <textarea value={activityForm.notes} onChange={e=>setActivityForm(p=>({...p,notes:e.target.value}))} placeholder="Détails, ressenti, distance, parcours..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:11,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>
        {/* Charge estimée */}
        <div style={{marginBottom:16,padding:"9px 12px",borderRadius:10,background:C.s2,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:10,color:C.tx3}}>Charge estimée</div><div style={{fontSize:9,color:C.tx3,marginTop:1}}>durée × RPE / 10</div></div>
          <div style={{fontSize:20,fontWeight:800,color:C.ac}}>{chargeScore(activityForm.duration,activityForm.intensity)}<span style={{fontSize:10,fontWeight:400,color:C.tx3}}> pts</span></div>
        </div>
        {/* Confirmer */}
        <button onClick={confirmActivity} disabled={!activityForm.label.trim()} style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:activityForm.label.trim()?C.ac:"#333",color:activityForm.label.trim()?"#fff":C.tx3,fontSize:14,fontWeight:700,cursor:activityForm.label.trim()?"pointer":"default",fontFamily:"inherit",transition:"background 0.15s"}}>
          ✓ Ajouter l'activité
        </button>
      </div>
    </div>)}
  </div>);
}

// ── EXERCISE BANK COMPONENTS ─────────────────────────────────────────────────

const parseYtId=v=>{const m=(v||'').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:v.trim();};

function ExerciseCreateModal({coachId,onSave,onClose}){
  const{profile}=useAuth();
  const isAdmin=profile?.is_admin===true;
  const[form,setForm]=useState({name:'',target:'Pecs',secondary:[],equipment:'Barre',difficulty:'Intermédiaire',ex_type:'muscu',is_compound:true,is_unilateral:false,youtube_id:'',instructions:'',tips:''});
  const[saving,setSaving]=useState(false);const[saveError,setSaveError]=useState('');
  const TARGETS=['Pecs','Dos-GD','Dos-Trap','Dos-Rhom','Ep-Ant','Ep-Lat','Ep-Post','Quads','Ischios','Fessiers','Adducteurs','Triceps','Biceps','Core','Mollets'];
  const EQUIPS=['Barre','Haltères','Cable','Machine','Poids de corps','Élastique','Kettlebell','Smith'];
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const fS={padding:'9px 12px',borderRadius:9,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:'inherit',width:'100%',boxSizing:'border-box',outline:'none'};
  const lS={fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5,display:'block'};
  const save=async()=>{
    if(!form.name.trim())return;setSaving(true);setSaveError('');
    const ytId=form.youtube_id?parseYtId(form.youtube_id):null;
    const{error}=await supabase.from('exercises').insert({...form,name:form.name.trim(),youtube_id:ytId||null,created_by:coachId,is_public:true,is_verified:isAdmin});
    setSaving(false);
    if(error){setSaveError(error.message||JSON.stringify(error));console.error('ExerciseCreateModal insert error:',error);}
    else onSave();
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
        {saveError&&<div style={{background:C.rS,border:'1px solid '+C.r+'60',borderRadius:10,padding:'10px 14px',fontSize:12,color:C.r,marginTop:12}}>{saveError}</div>}
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
  const{profile}=useAuth();
  const isAdmin=profile?.is_admin===true;
  const isOwner=!ex.created_by||ex.created_by===coachId;
  const[promoting,setPromoting]=useState(false);
  const promote=async()=>{setPromoting(true);await supabase.from('exercises').update({is_verified:true}).eq('id',ex.id);setPromoting(false);onRefresh();onClose();};
  const[localYtId,setLocalYtId]=useState(ex.youtube_id||'');
  const[ytInput,setYtInput]=useState(ex.youtube_id||'');
  const[ytSaving,setYtSaving]=useState(false);
  const[ytMsg,setYtMsg]=useState('');
  const saveVideo=async(overrideId)=>{
    setYtSaving(true);setYtMsg('');
    const raw=overrideId!==undefined?overrideId:ytInput.trim();
    const id=raw?parseYtId(raw):null;
    const{error}=await supabase.from('exercises').update({youtube_id:id??null}).eq('id',ex.id);
    setYtSaving(false);
    if(error){setYtMsg('Erreur: '+error.message);}
    else{setLocalYtId(id||'');setYtInput(id||'');setYtMsg(id?'Vidéo ajoutée !':'Vidéo supprimée');onRefresh();setTimeout(()=>setYtMsg(''),2500);}
  };
  return(<div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.88)',overflowY:'auto'}} onClick={onClose}>
    <div style={{minHeight:'100%',display:'flex',alignItems:'flex-end'}} onClick={e=>e.stopPropagation()}>
      <div style={{width:'100%',background:C.s1,borderRadius:'16px 16px 0 0',maxHeight:'92vh',overflowY:'auto',paddingBottom:40}}>
        {localYtId&&<div style={{width:'100%',maxWidth:420,margin:'0 auto',background:'#000',aspectRatio:'16/9'}}><iframe src={`https://www.youtube.com/embed/${localYtId}?rel=0`} style={{width:'100%',height:'100%',border:'none'}} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/></div>}
        {!localYtId&&ex.image_url&&<img src={ex.image_url} style={{width:'100%',maxWidth:420,margin:'0 auto',aspectRatio:'16/9',objectFit:'cover',display:'block'}} alt={ex.name}/>}
        {!localYtId&&!ex.image_url&&<div style={{width:'100%',aspectRatio:'16/9',background:C.s2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>💪</div>}
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
          {isAdmin&&!ex.is_verified&&<button onClick={promote} disabled={promoting} style={{width:'100%',padding:'9px 0',borderRadius:10,border:'1px solid '+C.g+'50',background:C.gS,color:C.g,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>{promoting?'En cours...':'✓ Promouvoir en Officiel'}</button>}
          {isAdmin&&<div style={{marginBottom:8}}>
            {!localYtId?(<div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input value={ytInput} onChange={e=>setYtInput(e.target.value)} placeholder="Lien YouTube (vidéo, Short, live…)" style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid '+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
              <button onClick={()=>saveVideo()} disabled={ytSaving||!ytInput.trim()} style={{padding:'9px 16px',borderRadius:10,border:'none',background:ytInput.trim()?C.ac:C.s2,color:ytInput.trim()?'#fff':C.tx3,fontSize:13,fontWeight:700,cursor:ytInput.trim()?'pointer':'default',fontFamily:'inherit',flexShrink:0,opacity:ytSaving?0.7:1}}>{ytSaving?'...':'+ Vidéo'}</button>
            </div>):(<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,background:C.s2,border:'1px solid '+C.brdL}}>
              <span style={{fontSize:12,color:C.tx2,flex:1,fontFamily:'monospace'}}>{localYtId}</span>
              <button onClick={()=>saveVideo('')} disabled={ytSaving} style={{padding:'5px 12px',borderRadius:8,border:'1px solid '+C.r+'50',background:C.rS,color:C.r,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>{ytSaving?'...':'Supprimer vidéo'}</button>
            </div>)}
            {ytMsg&&<div style={{marginTop:5,fontSize:11,color:ytMsg.startsWith('Erreur')?C.r:C.g,fontWeight:600}}>{ytMsg}</div>}
          </div>}
          {(isOwner||isAdmin)&&<div style={{display:'flex',gap:8}}>
            <button onClick={onMergeClick} style={{flex:1,padding:'9px 0',borderRadius:10,border:'1px solid '+C.brdL,background:'transparent',color:C.tx2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Fusionner</button>
            <button onClick={onDelete} style={{flex:1,padding:'9px 0',borderRadius:10,border:'1px solid '+C.r+'50',background:C.rS,color:C.r,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Supprimer</button>
          </div>}
        </div>
      </div>
    </div>
  </div>);
}

function ExerciseBank({coachId,onAddToExos}){
  const{user}=useAuth();
  const myId=user?.id||coachId;
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
  const deleteEx=async(id)=>{const{error}=await supabase.from('exercises').delete().eq('id',id);if(error){alert('Erreur suppression : '+error.message);return;}setConfirmDel(null);setSel(null);loadEx();};
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
    {sel&&!showMerge&&<ExerciseDetailModal ex={sel} coachId={myId} onClose={()=>setSel(null)} onAdd={()=>{onAddToExos(sel);setSel(null);}} onDelete={()=>setConfirmDel(sel.id)} onMergeClick={()=>setShowMerge(true)} onRefresh={()=>{loadEx();setSel(null);}}/>}
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
    {showCreate&&<ExerciseCreateModal coachId={myId} onSave={()=>{setShowCreate(false);loadEx();}} onClose={()=>setShowCreate(false)}/>}
  </div>);
}

// ─────────────────────────────────────────────────────────────────────────────

// ── HABIT TRACKER COMPONENTS ─────────────────────────────────────────────────

function HabitCreateModal({onSave,onClose,initial=null}){
  const[name,setName]=useState(initial?.name||'');
  const[emoji,setEmoji]=useState(initial?.emoji||'💪');
  const[color,setColor]=useState(initial?.color||HABIT_COLORS[0]);
  return(<div onClick={onClose} style={{position:'fixed',inset:0,zIndex:450,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,background:C.s1,borderRadius:'16px 16px 0 0',padding:'24px 24px 48px',boxSizing:'border-box'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><div style={{fontSize:16,fontWeight:800,color:C.tx}}>{initial?'Modifier':'Nouvelle habitude'}</div><button onClick={onClose} style={{background:'none',border:'none',color:C.tx2,fontSize:22,cursor:'pointer',fontFamily:'inherit'}}>×</button></div>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:14,background:C.s2,border:`2px solid ${color}40`,marginBottom:20}}>
        <div style={{width:44,height:44,borderRadius:12,background:color+'20',border:`2px solid ${color}60`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{emoji}</div>
        <div style={{fontSize:15,fontWeight:700,color:name?C.tx:C.tx3,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name||"Nom de l'habitude"}</div>
      </div>
      <label style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>Nom</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Boire 2L d'eau" maxLength={40} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:`1px solid ${C.brdL}`,background:C.s2,color:C.tx,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:18}}/>
      <label style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:8}}>Emoji</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:18}}>{HABIT_EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{width:38,height:38,borderRadius:10,border:`2px solid ${emoji===e?color:C.brdL}`,background:emoji===e?color+'20':C.s2,fontSize:20,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{e}</button>)}</div>
      <label style={{fontSize:10,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:8}}>Couleur</label>
      <div style={{display:'flex',gap:10,marginBottom:24}}>{HABIT_COLORS.map(hc=><button key={hc} onClick={()=>setColor(hc)} style={{width:34,height:34,borderRadius:'50%',background:hc,border:`3px solid ${color===hc?C.tx:'transparent'}`,cursor:'pointer',flexShrink:0,transform:color===hc?'scale(1.2)':'scale(1)',transition:'transform 0.15s'}}/>)}</div>
      <button onClick={()=>{if(name.trim())onSave({name:name.trim(),emoji,color});}} disabled={!name.trim()} style={{width:'100%',padding:'14px 0',borderRadius:12,border:'none',background:name.trim()?color:C.s2,color:name.trim()?'#fff':C.tx3,fontSize:15,fontWeight:800,cursor:name.trim()?'pointer':'default',fontFamily:'inherit',transition:'all 0.2s'}}>{initial?'Enregistrer':'Créer l\'habitude'}</button>
    </div>
  </div>);
}

function HabitDashboard({habits,setHabits,habitLogs,onToggle,viewOnly,athleteId}){
  const[showCreate,setShowCreate]=useState(false);
  const[menuId,setMenuId]=useState(null);
  const[editHabit,setEditHabit]=useState(null);
  const wdays=getHabitWeekDays();
  const todayISO=hISO();
  const yISO=hISO(hAddDays(new Date(),-1));
  const DL=['L','M','M','J','V','S','D'];
  const handleCreate=async d=>{
    const{data:h,error}=await supabase.from('habits').insert({...d,athlete_id:athleteId,sort_order:habits.length}).select().single();
    if(!error&&h)setHabits(p=>[...p,h]);
    setShowCreate(false);
  };
  const handleEdit=async(id,d)=>{
    const{error}=await supabase.from('habits').update({name:d.name,emoji:d.emoji,color:d.color}).eq('id',id);
    if(!error)setHabits(p=>p.map(h=>h.id===id?{...h,...d}:h));
    setEditHabit(null);
  };
  const handleDelete=async id=>{
    await supabase.from('habits').update({is_active:false}).eq('id',id);
    setHabits(p=>p.filter(h=>h.id!==id));
    setMenuId(null);
  };
  const handleMove=async(idx,dir)=>{
    const ni=idx+dir;
    if(ni<0||ni>=habits.length)return;
    const next=[...habits];[next[idx],next[ni]]=[next[ni],next[idx]];
    setHabits(next);
    setMenuId(null);
    await Promise.all([
      supabase.from('habits').update({sort_order:idx}).eq('id',next[idx].id),
      supabase.from('habits').update({sort_order:ni}).eq('id',next[ni].id),
    ]);
  };
  return(<div style={{background:C.s1,borderRadius:16,padding:'14px 16px',border:`1px solid ${C.brd}`,marginBottom:12}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px'}}>Mes habitudes</div>
      {!viewOnly&&<button onClick={()=>setShowCreate(true)} style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,border:`1px solid ${C.ac}40`,background:C.acS,color:C.ac,cursor:'pointer',fontFamily:'inherit'}}>+ Habitude</button>}
    </div>
    {habits.length===0?(<div style={{textAlign:'center',padding:'18px 0',color:C.tx3,fontSize:12}}>{viewOnly?'Aucune habitude définie':'Ajoute ta première habitude →'}</div>):(
      <div>
        <div style={{display:'grid',gridTemplateColumns:'1fr repeat(7,28px)',gap:4,marginBottom:8}}>
          <div/>
          {wdays.map((d,i)=><div key={i} style={{textAlign:'center',fontSize:9,fontWeight:600,color:hISO(d)===todayISO?C.ac:C.tx3,textTransform:'uppercase'}}>{DL[(d.getDay()+6)%7]}</div>)}
        </div>
        {habits.map((h,idx)=>{
          const logs=habitLogs[h.id]||[];const streak=calcHabitStreak(logs);
          return(<div key={h.id} style={{marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr repeat(7,28px)',gap:4,alignItems:'center'}}>
              <button onClick={()=>setMenuId(menuId===h.id?null:h.id)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',padding:'2px 0',minWidth:0}}>
                <span style={{fontSize:15,flexShrink:0}}>{h.emoji}</span>
                <span style={{fontSize:12,fontWeight:600,color:C.tx,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</span>
              </button>
              {wdays.map((d,i)=>{
                const iso=hISO(d);const done=logs.includes(iso);const canTap=!viewOnly&&(iso===todayISO||iso===yISO);const future=iso>todayISO;
                return(<button key={i} onClick={canTap?()=>onToggle(h.id,iso):undefined} style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${done?h.color:future?C.brd:C.brdL}`,background:done?h.color+'22':'transparent',cursor:canTap?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.18s'}}>
                  {done?<div style={{width:10,height:10,borderRadius:'50%',background:h.color}}/>:(!future&&iso===todayISO&&!viewOnly)?<div style={{width:4,height:4,borderRadius:'50%',background:C.ac}}/>:null}
                </button>);
              })}
            </div>
            <div style={{fontSize:10,color:streak>0?h.color:C.tx3,fontWeight:streak>0?600:400,paddingLeft:2,marginTop:3}}>{streakMsg(streak)}</div>
            {menuId===h.id&&!viewOnly&&<div style={{marginTop:6,padding:'8px 10px',borderRadius:10,background:C.s2,border:`1px solid ${C.brd}`,display:'flex',flexWrap:'wrap',gap:6}}>
              <button onClick={()=>{setEditHabit(h);setMenuId(null);}} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${C.ac}40`,background:C.acS,color:C.ac,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minWidth:70}}>Modifier</button>
              {idx>0&&<button onClick={()=>handleMove(idx,-1)} style={{width:34,padding:'7px 0',borderRadius:8,border:`1px solid ${C.brdL}`,background:'transparent',color:C.tx2,fontSize:14,cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}>↑</button>}
              {idx<habits.length-1&&<button onClick={()=>handleMove(idx,1)} style={{width:34,padding:'7px 0',borderRadius:8,border:`1px solid ${C.brdL}`,background:'transparent',color:C.tx2,fontSize:14,cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}>↓</button>}
              <button onClick={()=>handleDelete(h.id)} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${C.r}40`,background:C.rS,color:C.r,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',minWidth:70}}>Supprimer</button>
              <button onClick={()=>setMenuId(null)} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${C.brdL}`,background:'transparent',color:C.tx3,fontSize:11,cursor:'pointer',fontFamily:'inherit',minWidth:70}}>Annuler</button>
            </div>}
          </div>);
        })}
      </div>
    )}
    {showCreate&&<HabitCreateModal onSave={handleCreate} onClose={()=>setShowCreate(false)}/>}
    {editHabit&&<HabitCreateModal initial={editHabit} onSave={d=>handleEdit(editHabit.id,d)} onClose={()=>setEditHabit(null)}/>}
  </div>);
}

function HabitTrackerProfile({habits,habitLogs,onToggle,viewOnly}){
  const[hTab,setHTab]=useState('week');
  const[monthDate,setMonthDate]=useState(new Date());
  const[selHabit,setSelHabit]=useState(null);
  const wdays=getHabitWeekDays();
  const todayISO=hISO();
  const yISO=hISO(hAddDays(new Date(),-1));
  const DL=['L','M','M','J','V','S','D'];
  const activeH=(selHabit&&habits.find(h=>h.id===selHabit))||habits[0];

  const renderWeek=()=>(<div>
    <div style={{display:'grid',gridTemplateColumns:'1fr repeat(7,34px)',gap:4,marginBottom:10}}>
      <div/>
      {wdays.map((d,i)=>{const iso=hISO(d);const isT=iso===todayISO;return(<div key={i} style={{textAlign:'center'}}><div style={{fontSize:9,fontWeight:600,color:isT?C.ac:C.tx3,textTransform:'uppercase'}}>{DL[(d.getDay()+6)%7]}</div><div style={{fontSize:11,color:isT?C.ac:C.tx2,fontWeight:isT?700:400}}>{d.getDate()}</div></div>);})}
    </div>
    {habits.map(h=>{
      const logs=habitLogs[h.id]||[];const streak=calcHabitStreak(logs);
      return(<div key={h.id} style={{marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
          <span style={{fontSize:18}}>{h.emoji}</span>
          <div><div style={{fontSize:13,fontWeight:700,color:C.tx}}>{h.name}</div><div style={{fontSize:10,color:streak>0?h.color:C.tx3,fontWeight:streak>0?600:400}}>{streakMsg(streak)}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr repeat(7,34px)',gap:4}}>
          <div/>
          {wdays.map((d,i)=>{
            const iso=hISO(d);const done=logs.includes(iso);const canTap=!viewOnly&&(iso===todayISO||iso===yISO);const future=iso>todayISO;
            return(<button key={i} onClick={canTap?()=>onToggle(h.id,iso):undefined} style={{width:34,height:34,borderRadius:10,border:`2px solid ${done?h.color:future?C.brd:C.brdL}`,background:done?h.color+'20':'transparent',cursor:canTap?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.18s'}}>
              {done?<div style={{width:13,height:13,borderRadius:'50%',background:h.color}}/>:(!future&&iso===todayISO&&!viewOnly)?<div style={{width:5,height:5,borderRadius:'50%',background:C.ac}}/>:null}
            </button>);
          })}
        </div>
      </div>);
    })}
  </div>);

  const renderMonth=()=>{
    const yr=monthDate.getFullYear(),mo=monthDate.getMonth();
    const fd=new Date(yr,mo,1);const ld=new Date(yr,mo+1,0);
    const startDow=(fd.getDay()+6)%7;const dim=ld.getDate();
    const now=new Date();const isCurMo=yr===now.getFullYear()&&mo===now.getMonth();
    const MON=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const cells=[];for(let i=0;i<startDow;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
    return(<div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <button onClick={()=>setMonthDate(new Date(yr,mo-1,1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.brdL}`,background:C.s2,color:C.tx2,fontSize:18,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <div style={{fontSize:14,fontWeight:700,color:C.tx}}>{MON[mo]} {yr}</div>
        <button onClick={()=>setMonthDate(new Date(yr,mo+1,1))} disabled={isCurMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.brdL}`,background:C.s2,color:C.tx2,fontSize:18,cursor:isCurMo?'default':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',opacity:isCurMo?0.3:1}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:6}}>{DL.map((l,i)=><div key={i} style={{textAlign:'center',fontSize:9,fontWeight:600,color:C.tx3,textTransform:'uppercase',padding:'2px 0'}}>{l}</div>)}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
        {cells.map((day,i)=>{
          if(!day)return<div key={i}/>;
          const iso=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isT=iso===todayISO;const future=iso>todayISO;
          const dots=habits.filter(h=>(habitLogs[h.id]||[]).includes(iso));
          return(<div key={i} style={{aspectRatio:'1',borderRadius:8,background:isT?C.acS:C.s2,border:`1px solid ${isT?C.ac+'50':C.brd}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:2,opacity:future?0.35:1}}>
            <div style={{fontSize:10,fontWeight:isT?700:400,color:isT?C.ac:C.tx3,lineHeight:1.2}}>{day}</div>
            {dots.length>0&&<div style={{display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center',marginTop:2}}>{dots.slice(0,4).map(h=><div key={h.id} style={{width:5,height:5,borderRadius:'50%',background:h.color}}/>)}{dots.length>4&&<div style={{width:5,height:5,borderRadius:'50%',background:C.tx3}}/>}</div>}
          </div>);
        })}
      </div>
      {habits.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>{habits.map(h=><div key={h.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:C.tx2}}><div style={{width:7,height:7,borderRadius:'50%',background:h.color,flexShrink:0}}/>{h.emoji} {h.name}</div>)}</div>}
    </div>);
  };

  const renderYear=()=>{
    const h=activeH;if(!h)return<div style={{textAlign:'center',padding:'20px 0',color:C.tx3,fontSize:12}}>Aucune habitude</div>;
    const logs=habitLogs[h.id]||[];const today=new Date();const todayISO=hISO(today);
    const totalDone=logs.filter(d=>d>=hISO(hAddDays(today,-364))).length;const streak=calcHabitStreak(logs);
    const MON=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const DL=['L','M','M','J','V','S','D'];
    // Build 12 mini-calendars: current month going back 11 months
    const months=Array.from({length:12},(_,i)=>{
      const d=new Date(today.getFullYear(),today.getMonth()-11+i,1);
      return{year:d.getFullYear(),month:d.getMonth()};
    });
    return(<div>
      {/* Dropdown sélecteur d'habitude */}
      {habits.length>0&&<div style={{position:'relative',marginBottom:16}}>
        <select value={selHabit||habits[0]?.id||''} onChange={e=>setSelHabit(e.target.value)}
          style={{width:'100%',padding:'10px 36px 10px 14px',borderRadius:10,border:`2px solid ${h.color}50`,background:C.s2,color:C.tx,fontSize:13,fontWeight:600,fontFamily:'inherit',outline:'none',cursor:'pointer',appearance:'none',WebkitAppearance:'none'}}>
          {habits.map(hb=><option key={hb.id} value={hb.id}>{hb.emoji} {hb.name}</option>)}
        </select>
        <div style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:h.color,pointerEvents:'none'}}>▼</div>
      </div>}
      {/* Stats */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <div style={{flex:1,background:C.s2,borderRadius:10,padding:'10px 0',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:h.color}}>{totalDone}</div><div style={{fontSize:9,color:C.tx3}}>jours / an</div></div>
        <div style={{flex:1,background:C.s2,borderRadius:10,padding:'10px 0',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:streak>0?h.color:C.tx3}}>{streak}</div><div style={{fontSize:9,color:C.tx3}}>streak actuel</div></div>
        <div style={{flex:1,background:C.s2,borderRadius:10,padding:'10px 0',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:C.ac}}>{Math.round(totalDone/365*100)}%</div><div style={{fontSize:9,color:C.tx3}}>complétion</div></div>
      </div>
      <div style={{fontSize:11,fontWeight:600,color:streak>0?h.color:C.tx3,textAlign:'center',marginBottom:16}}>{streakMsg(streak)}</div>
      {/* Grille 12 mini-calendriers */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {months.map(({year,month})=>{
          const fd=new Date(year,month,1);const dim=new Date(year,month+1,0).getDate();
          const startDow=(fd.getDay()+6)%7;
          const cells=[];for(let i=0;i<startDow;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
          const monthDone=logs.filter(iso=>iso.startsWith(`${year}-${String(month+1).padStart(2,'0')}-`)).length;
          const pct=Math.round(monthDone/dim*100);
          const isCurMonth=year===today.getFullYear()&&month===today.getMonth();
          return(<div key={`${year}-${month}`} style={{background:C.s2,borderRadius:10,padding:'8px 6px',border:`1px solid ${isCurMonth?h.color+'50':C.brd}`}}>
            {/* En-tête mois */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5,paddingLeft:2,paddingRight:2}}>
              <div style={{fontSize:9,fontWeight:700,color:isCurMonth?h.color:C.tx2,textTransform:'uppercase',letterSpacing:'0.3px'}}>{MON[month]}</div>
              <div style={{fontSize:8,fontWeight:700,color:pct>0?h.color:C.tx3,padding:'1px 5px',borderRadius:4,background:pct>0?h.color+'18':'transparent'}}>{pct>0?pct+'%':''}</div>
            </div>
            {/* Jours header */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:3}}>
              {DL.map((l,i)=><div key={i} style={{textAlign:'center',fontSize:6,color:C.tx3,fontWeight:600}}>{l}</div>)}
            </div>
            {/* Jours */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1}}>
              {cells.map((day,i)=>{
                if(!day)return<div key={i}/>;
                const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const done=logs.includes(iso);const future=iso>todayISO;const isToday=iso===todayISO;
                return(<div key={i} style={{aspectRatio:'1',borderRadius:2,background:future?'transparent':done?h.color:C.bg,border:isToday?`1px solid ${h.color}`:done?'none':'none',opacity:future?0.15:1,transition:'background 0.15s'}}/>);
              })}
            </div>
          </div>);
        })}
      </div>
    </div>);
  };

  return(<div style={{background:C.s1,borderRadius:16,padding:'14px 16px',border:`1px solid ${C.brd}`,marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:14}}>Tracker d'habitudes</div>
    {habits.length===0?(<div style={{textAlign:'center',padding:'20px 0',color:C.tx3,fontSize:12}}>Aucune habitude. Ajoute-en depuis l'onglet Accueil.</div>):(
      <>
        <div style={{display:'flex',gap:6,marginBottom:16}}>{[{k:'week',l:'Semaine'},{k:'month',l:'Mois'},{k:'year',l:'Année'}].map(t=><button key={t.k} onClick={()=>setHTab(t.k)} style={{flex:1,padding:'7px 0',borderRadius:9,border:'none',background:hTab===t.k?C.acS:C.s2,color:hTab===t.k?C.ac:C.tx3,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{t.l}</button>)}</div>
        {hTab==='week'&&renderWeek()}
        {hTab==='month'&&renderMonth()}
        {hTab==='year'&&renderYear()}
      </>
    )}
  </div>);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App({athleteId,defaultMode,canToggleMode=true,userName,athleteProfile,onEditProfile,viewOnly=false}){
  const{profile:myProfile}=useAuth();
  const load=(k,fb)=>sLoad(k,fb,athleteId);
  const save=(k,v)=>sSave(k,v,athleteId);
  const[mode,setMode]=useState(defaultMode||"athlete");const[tab,setTab]=useState("dash");const[coachTab,setCoachTab]=useState("prog");const[logSubTab,setLogSubTab]=useState("muscu");const[testSubTab,setTestSubTab]=useState("musculation");const[banqueSubTab,setBanqueSubTab]=useState("muscu");const[progSubTab,setProgSubTab]=useState("muscu");const[energyEditorKey,setEnergyEditorKey]=useState(null);const[energySessions,setEnergySessions]=useState([]);const[energySessionsLoaded,setEnergySessionsLoaded]=useState(false);const[energyWeekPlan,setEnergyWeekPlan]=useState({});const[energyDayPlan,setEnergyDayPlan]=useState({});const[energyPlanLoaded,setEnergyPlanLoaded]=useState(false);const[drawerPrOpen,setDrawerPrOpen]=useState(false);const[drawerInjOpen,setDrawerInjOpen]=useState(false);
  const[exos,setExosState]=useState({});const[exMeta,setExMetaState]=useState({});
  const[aW,setAW]=useState(1);const[sets,setSetsState]=useState({});const[anaTab,setAnaTab]=useState("combined");const[weightRange,setWeightRange]=useState("bloc");
  const[wellness,setWellnessState]=useState(null);const[wellnessHistory,setWellnessHistoryState]=useState({});const[wellnessPeriod,setWellnessPeriod]=useState("month");
  const[bodyWeight,setBodyWeightState]=useState({current:0,target:0});
  const[completedSessions,setCompletedSessionsState]=useState({});
  const[goals,setGoalsState]=useState({sessionsPerWeek:6,sleepTarget:8});
  const[athleteNotes,setAthleteNotesState]=useState({});const[customMethods,setCustomMethodsState]=useState([]);
  const[weightLog,setWeightLogState]=useState({});const[weightMilestones,setWeightMilestonesState]=useState([]);
  const[injuries,setInjuriesState]=useState([]);
  const[nutritionStrategy,setNutritionStrategy]=useState(null);
  const[nutritionLog,setNutritionLogState]=useState({});
  const[prExName,setPrExName]=useState(null);const[prSearch,setPrSearch]=useState('');const[prTab,setPrTab]=useState("est");
  const[sessions,setSessionsState]=useState(DEF_SESSIONS);
  const[blockConfig,setBlockConfigState]=useState(DEF_BLOCK_CONFIG);
  const[loaded,setLoaded]=useState(false);const[saveStatus,setSaveStatus]=useState(null);
  const[weekJustCompleted,setWeekJustCompleted]=useState(null);const[showBilan,setShowBilan]=useState(false);
  const[showWellness,setShowWellness]=useState(false);const[milestoneNotif,setMilestoneNotif]=useState(null);const[autoProgNotif,setAutoProgNotif]=useState(null);
  const[blockHistory,setBlockHistoryState]=useState([]);
  const[weekSchedule,setWeekScheduleState]=useState({});
  const[sessionLogs,setSessionLogsState]=useState({});
  const[freeSessions,setFreeSessionsState]=useState([]);
  const[showNewBlock,setShowNewBlock]=useState(false);const[showBlockHistory,setShowBlockHistory]=useState(false);
  const[chatHistory,setChatHistory]=useState([]);
  const[aiChatOpen,setAiChatOpen]=useState(false);
  const[initialLogSess,setInitialLogSess]=useState(null);
  const[habits,setHabits]=useState([]);const[habitLogs,setHabitLogs]=useState({});const[habitEnabled,setHabitEnabled]=useState(false);
  const[habitToggling,setHabitToggling]=useState(false);const[habitToggleErr,setHabitToggleErr]=useState('');
  const[drawerOpen,setDrawerOpen]=useState(false);const[drawerSportOpen,setDrawerSportOpen]=useState(false);const[drawerZoom,setDrawerZoom]=useState(null);const[showLogoutConfirm,setShowLogoutConfirm]=useState(false);
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
      const[e,m,s,w,wh,bw,cs,g,an,cm,wl,wmil,inj,sess,bc,bh,ws,ns,nl,sl,fs]=await Promise.all([load(SKEYS.exos,{}),load(SKEYS.exMeta,{}),load(SKEYS.sets,{}),load(SKEYS.wellness,null),load(SKEYS.wellnessHistory,{}),load(SKEYS.bw,{current:0,target:0}),load(SKEYS.completed,{}),load(SKEYS.goals,{sessionsPerWeek:6,sleepTarget:8}),load(SKEYS.anotes,{}),load(SKEYS.custMethods,[]),load(SKEYS.weightLog,{}),load(SKEYS.weightMilestones,[]),load(SKEYS.injuries,[]),load(SKEYS.sessions,DEF_SESSIONS),load(SKEYS.blockConfig,DEF_BLOCK_CONFIG),load(SKEYS.blockHistory,[]),load(SKEYS.weekSchedule,{}),getNutritionStrategy(athleteId).catch(()=>null),load("asp:nutrition_log",{}),load(SKEYS.sessionLogs,{}),load(SKEYS.freeSessions,[])]);
      const todayW=w?.date===todayKey()?w:null;if(w&&!todayW)save(SKEYS.wellness,null).catch(()=>{});
      setExosState(e);setExMetaState(m);setSetsState(s);setWellnessState(todayW);setWellnessHistoryState(wh);setBodyWeightState(bw);setCompletedSessionsState(cs);setGoalsState(g);setAthleteNotesState(an);setCustomMethodsState(cm);setWeightLogState(wl);setWeightMilestonesState(wmil);setInjuriesState(inj);setSessionsState(sess);setBlockConfigState(bc);setBlockHistoryState(bh||[]);setWeekScheduleState(ws||{});setNutritionStrategy(ns);setNutritionLogState(nl||{});setSessionLogsState(sl);setFreeSessionsState(fs);setLoaded(true);
    })();
  },[]);

  useEffect(()=>{
    if(energyPlanLoaded)return;
    Promise.all([
      supabase.from('app_data').select('value').eq('athlete_id',athleteId).eq('key','asp:energy_week_plan').maybeSingle(),
      supabase.from('app_data').select('value').eq('athlete_id',athleteId).eq('key','asp:energy_day_plan').maybeSingle(),
      supabase.from('energy_session_config').select('id,session_key,session_label,appareil_types').eq('athlete_id',athleteId)
    ]).then(([wp,dp,es])=>{
      if(wp.data?.value)setEnergyWeekPlan(wp.data.value);
      if(dp.data?.value)setEnergyDayPlan(dp.data.value);
      if(es.data)setEnergySessions(es.data);
      setEnergyPlanLoaded(true);
    });
  },[athleteId,energyPlanLoaded]);

  useEffect(()=>{
    if(!wellness)return;
    const now=new Date();const midnight=new Date(now);midnight.setHours(24,0,0,0);
    const tid=setTimeout(()=>{setWellnessState(null);save(SKEYS.wellness,null).catch(()=>{});},midnight-now);
    return()=>clearTimeout(tid);
  },[wellness]);

  useEffect(()=>{
    if(!athleteId)return;
    supabase.from('habits').select('*').eq('athlete_id',athleteId).eq('is_active',true).order('sort_order',{ascending:true,nullsFirst:false}).then(({data})=>{if(data)setHabits(data);});
    const cutoff=hAddDays(new Date(),-365).toISOString().slice(0,10);
    supabase.from('habit_logs').select('habit_id,date').eq('athlete_id',athleteId).gte('date',cutoff).then(({data})=>{if(data){const l={};data.forEach(r=>{if(!l[r.habit_id])l[r.habit_id]=[];l[r.habit_id].push(r.date);});setHabitLogs(l);}});
    supabase.from('profiles').select('habit_tracker_enabled').eq('id',athleteId).single().then(({data})=>{if(data)setHabitEnabled(!!data.habit_tracker_enabled);});
  },[athleteId]);

  useEffect(()=>{
    if(!athleteId||mode!=="athlete")return;
    supabase.from('app_data').select('value').eq('athlete_id',athleteId).eq('key','asp:coach_feedback').maybeSingle().then(({data})=>{if(data?.value)setCoachFeedbacks(data.value);});
  },[athleteId,mode]);
  useEffect(()=>{
    if(!athleteId)return;
    supabase.from('app_data').select('value').eq('athlete_id',athleteId).eq('key','app:user_feedback').maybeSingle().then(({data})=>{if(data?.value?.entries)setAppFeedbacks(data.value.entries);});
  },[athleteId]);

  const toggleHabitLog=async(habitId,dateISO)=>{
    const logs=habitLogs[habitId]||[];
    if(logs.includes(dateISO)){
      await supabase.from('habit_logs').delete().match({habit_id:habitId,date:dateISO});
      setHabitLogs(p=>({...p,[habitId]:(p[habitId]||[]).filter(d=>d!==dateISO)}));
    }else{
      await supabase.from('habit_logs').insert({habit_id:habitId,athlete_id:athleteId,date:dateISO});
      setHabitLogs(p=>({...p,[habitId]:[...(p[habitId]||[]),dateISO]}));
    }
  };

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
  const setSessionLogs=v=>{setSessionLogsState(v);save(SKEYS.sessionLogs,v).catch(()=>{});};
  const setFreeSessions=v=>{setFreeSessionsState(v);save(SKEYS.freeSessions,v).catch(()=>{});};
  const archiveAndNewBlock=(opts)=>{
    const hasData=Object.values(exos).flat().length>0||Object.values(completedSessions).flat().length>0;
    if(hasData){
      const archived={id:"blk_"+Date.now(),archivedAt:new Date().toISOString(),exos,sets,completedSessions,sessions,blockConfig,goals,wellnessHistory,bodyWeight,athleteNotes};
      setBlockHistory([...blockHistory,archived]);
    }
    // Set new sessions from wizard
    setSessions(opts.sessions||[]);
    // Exos : reprise historique > garder actuels > reset
    if(opts.restoredExos){
      // Restauration depuis l'historique : exos déjà remappés aux nouveaux IDs
      setExos(opts.restoredExos);
    }else if(!opts.exos){
      const newExos={};(opts.sessions||[]).forEach(s=>{newExos[s.id]=[];});setExos(newExos);
    }else{
      const newExos={...exos};(opts.sessions||[]).forEach(s=>{if(!newExos[s.id])newExos[s.id]=[];});setExos(newExos);
    }
    // Block config
    const newBc=opts.config?{...blockConfig}:{...DEF_BLOCK_CONFIG};
    newBc.blockName=opts.blockName||"";newBc.objective=opts.objective||"";newBc.totalWeeks=opts.totalWeeks||6;newBc.deloadWeek=opts.deloadWeek||0;newBc.startDate=new Date().toISOString().slice(0,10);
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
  const dw=blockConfig.deloadWeek||0;
  const weeksArr=Array.from({length:tw},(_,i)=>i+1);
  const isDeload=w=>blockConfig.deloadWeek&&w===blockConfig.deloadWeek;
  const weeklyTarget=useMemo(()=>{const t={};for(let w=1;w<=tw;w++){const n=sessions.filter(s=>(exos[s.id]||[]).some(ex=>ex.weeks?.[w]?.sets)).length;t[w]=n>0?n:sessions.length||1;}return t;},[sessions,exos,tw]);
  const currentWeek=useMemo(()=>{
    if(blockConfig?.startDate){
      const days=Math.floor((Date.now()-new Date(blockConfig.startDate).getTime())/86400000);
      return Math.min(Math.max(1,Math.floor(days/7)+1),tw);
    }
    // Fallback pour les blocs sans date de début (ancien comportement)
    for(let w=1;w<=tw;w++){if((completedSessions[w]||[]).length<(weeklyTarget[w]||goals.sessionsPerWeek))return w;}
    return tw;
  },[blockConfig?.startDate,completedSessions,weeklyTarget,goals.sessionsPerWeek,tw]);
  const totalTarget=useMemo(()=>weeksArr.reduce((acc,w)=>acc+(weeklyTarget[w]||goals.sessionsPerWeek),0),[weeksArr,weeklyTarget,goals.sessionsPerWeek]);
  const streak=useMemo(()=>{let s=0;for(let w=currentWeek-1;w>=1;w--){if((completedSessions[w]||[]).length>=(weeklyTarget[w]||goals.sessionsPerWeek))s++;else break;}return s;},[completedSessions,currentWeek,weeklyTarget,goals.sessionsPerWeek]);
  const weekAdherence=Math.round(((completedSessions[currentWeek]||[]).length/(weeklyTarget[currentWeek]||goals.sessionsPerWeek))*100);
  const motivMsg=()=>{if(isDeload(currentWeek))return{t:"Semaine deload",d:"Recuperation active.",c:C.b};if(currentWeek===tw)return{t:"Derniere semaine !",d:"Tout donner.",c:C.coach};if(streak>=3&&(wellness?.score||50)>=70)return{t:"En feu ! "+streak+" sem.",d:"Continue.",c:C.g};if((wellness?.score||50)<40)return{t:"Corps en recuperation",d:"Seance legere.",c:C.o};if(weekAdherence>=100)return{t:"Semaine "+currentWeek+" complete !",d:"Repos merite.",c:C.g};return{t:"Reste focus",d:"Chaque seance compte.",c:C.ac};};
  const msg=motivMsg();
  const prs=getAllPRs(exos);const muscSets=getMuscSets(exos,exMeta);
  const wScore=wellness?.score||50;const wReco=getReco(wScore);
  const combinedData=getCombinedData(exos,sets,wellnessHistory,tw);const totalDone=Object.values(completedSessions).flat().length;
  const activeInjuries=injuries.filter(i=>i.status!=="Guerie");

  const switchMode=m=>{setMode(m);if(m==="coach")setCoachTab("prog");else setTab("dash");};
  // Calcule la surcharge depuis le réel — fonction pure, ne modifie pas l'état
  const computeAutoProgress=(sessId,completedWeek,srcExos)=>{
    const sessExos=(srcExos||exos)[sessId]||[];
    if(!sessExos.length)return null;
    const tierCfgL=blockConfig?.tierConfig||DEF_TIER_CONFIG;
    const dwL=blockConfig?.deloadWeek||tw;
    const futureWeeks=weeksArr.filter(w=>w>completedWeek);
    const futureTrainWeeks=futureWeeks.filter(w=>w!==dwL);
    if(!futureWeeks.length)return null;
    let changed=false;
    const newSessExos=sessExos.map(ex=>{
      const eType=ex.exType||(ex.isFlexibility?"mobilite":"muscu");
      if(eType!=="muscu"&&eType!=="halterophilie")return ex;
      const doneRows=(sets[ex.id+"_"+completedWeek]||[]).filter(r=>r.done);
      if(!doneRows.length)return ex;
      const tier=getExTier(ex.name,ex);
      const tc=tierCfgL[tier]||tierCfgL[3];
      const plannedWd=ex.weeks[completedWeek]||{};
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
        if((completedSessions[w]||[]).includes(sessId))return;
        const existingWd=newWeeks[w]||{};
        const preserve={coachNote:existingWd.coachNote,tempo:existingWd.tempo,method:existingWd.method,methodParams:existingWd.methodParams};
        const kgBase=basePdc?undefined:baseKg;
        if(w===dwL){
          const dlPct=tc.deloadPct||40;
          newWeeks[w]={...preserve,...(basePdc?{pdc:true}:(kgBase?{kg:Math.round(kgBase*(1-dlPct/100)/2.5)*2.5}:{})),sets:Math.max(2,Math.round(baseSets*0.6)),rir:(tc.rirStart||2)+2,repsRange:String(baseReps)};
        }else{
          const wIdx=futureTrainWeeks.indexOf(w);
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
    if(!changed)return null;
    return{...(srcExos||exos),[sessId]:newSessExos};
  };
  const autoProgressOnComplete=(sessId,completedWeek,currentExos)=>{
    const newExos=computeAutoProgress(sessId,completedWeek,currentExos||exos);
    if(newExos){
      setExos(newExos);
      setAutoProgNotif(`Progression S${completedWeek+1}→S${tw} mise à jour`);
      setTimeout(()=>setAutoProgNotif(null),3500);
    }
  };
  // Synchronisation au chargement : applique la surcharge réelle sur toutes les semaines avec des données réelles
  useEffect(()=>{
    if(!loaded)return;
    let current=exos;let anyChanged=false;
    weeksArr.forEach(week=>{
      sessions.forEach(s=>{
        const hasActual=(current[s.id]||[]).some(ex=>(sets[ex.id+"_"+week]||[]).some(r=>r.done&&(r.kg||0)>0));
        if(!hasActual)return;
        const result=computeAutoProgress(s.id,week,current);
        if(result){current=result;anyChanged=true;}
      });
    });
    if(anyChanged){setExos(current);setAutoProgNotif('Progression synchronisée depuis le réel');setTimeout(()=>setAutoProgNotif(null),3500);}
  },[loaded]);// eslint-disable-line react-hooks/exhaustive-deps
  const completeSession=(sessId,week)=>{const prev=completedSessions[week]||[];if(prev.includes(sessId))return;const newW=[...prev,sessId];const newC={...completedSessions,[week]:newW};setCompletedSessions(newC);autoProgressOnComplete(sessId,week);if(newW.length>=(weeklyTarget[week]||goals.sessionsPerWeek)){setWeekJustCompleted(week);setTimeout(()=>{setWeekJustCompleted(null);if(week>=tw)setShowBilan(true);else setAW(week+1);},2800);}};
  const uncompleteSession=(sessId,week)=>setCompletedSessions({...completedSessions,[week]:(completedSessions[week]||[]).filter(s=>s!==sessId)});
  const[bankAddEx,setBankAddEx]=useState(null);const[bankAddMsg,setBankAddMsg]=useState('');
  const handleBankAdd=ex=>{
    if(sessions.length===0){setBankAddMsg('Crée un bloc programme d\'abord (onglet Prog)');setTimeout(()=>setBankAddMsg(''),3000);return;}
    const makeEx=sid=>({id:"g_"+Date.now(),name:ex.name,bloc:ex.bloc||"ESTH",target:ex.target||"Pecs",exType:ex.ex_type||"muscu",exercise_id:ex.id,weeks:{1:{kg:0,sets:3,repsRange:"10",rir:2}}});
    if(sessions.length===1){const sid=sessions[0].id;setExos(prev=>({...prev,[sid]:[...(prev[sid]||[]),makeEx(sid)]}));setCoachTab("prog");setBankAddMsg('Ajouté à '+sessions[0].name+' !');setTimeout(()=>setBankAddMsg(''),2500);}
    else setBankAddEx(ex);
  };
  const[showTierModal,setShowTierModal]=useState(false);
  const[showExoParams,setShowExoParams]=useState(false);
  const[coachFeedbacks,setCoachFeedbacks]=useState({});
  const[showAppFeedback,setShowAppFeedback]=useState(false);
  const[appFeedbacks,setAppFeedbacks]=useState([]);
  const coachTabs=[{k:"prog",l:"Prog"},{k:"banque",l:"Banque"},{k:"stats",l:"Stats"},{k:"data",l:"Données"},{k:"test",l:"Test"},{k:"retours",l:"Retours"}];
  const athTabs=[{k:"dash",l:"Accueil"},{k:"log",l:"Seance"},{k:"alim",l:"Alim"},{k:"test",l:"Test"}];
  const activeTabs=mode==="coach"?coachTabs:athTabs;const activeTab=mode==="coach"?coachTab:tab;const setActiveTab=mode==="coach"?setCoachTab:setTab;
  const tabS=t=>({flex:1,padding:"10px 0",border:"none",borderBottom:"2px solid "+(activeTab===t?(mode==="coach"?C.coach:C.ac):"transparent"),background:"transparent",color:activeTab===t?(mode==="coach"?C.coach:C.ac):C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px"});

  if(!loaded)return(<div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"system-ui"}}><div style={{width:48,height:48,borderRadius:14,background:C.acS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>~</div><div style={{fontSize:13,color:C.tx2}}>Chargement...</div></div>);

  return(<div style={{background:C.bg,minHeight:"100vh",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif",color:C.tx,maxWidth:mode==="athlete"?480:"100%",margin:mode==="athlete"?"0 auto":0}}>

    {drawerOpen&&mode==="athlete"&&(<>
      <div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(2px)"}}/>
      {drawerZoom&&(<div style={{position:"fixed",inset:0,zIndex:103,background:C.bg,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:2}}>
          <button onClick={()=>setDrawerZoom(null)} style={{width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
          <div style={{fontSize:14,fontWeight:700}}>{drawerZoom==="weight"?"Poids de corps":drawerZoom==="wellness"?"Forme du jour":drawerZoom==="goals"?"Objectifs":"Score de santé"}</div>
        </div>
        <div style={{padding:"16px"}}>
          {drawerZoom==="weight"&&(<div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:13,fontWeight:700}}>Évolution du poids</div><div style={{fontSize:13,fontWeight:800,color:C.ac}}>{bodyWeight.current||"—"}<span style={{fontSize:10,fontWeight:400,color:C.tx3}}> / {bodyWeight.target||"—"} kg</span></div></div>{Object.keys(weightLog).length>0?<WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy}/>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"24px 0"}}>Aucune mesure enregistrée</div>}</div>)}
          {drawerZoom==="wellness"&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Aujourd'hui */}
            <div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
              <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Forme du jour</div>
              {wellness?(<>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
                  <div style={{position:"relative",width:72,height:72,flexShrink:0}}><svg viewBox="0 0 64 64" style={{width:72,height:72,transform:"rotate(-90deg)"}}><circle cx="32" cy="32" r="26" fill="none" stroke={C.s2} strokeWidth="5"/><circle cx="32" cy="32" r="26" fill="none" stroke={wReco.c} strokeWidth="5" strokeDasharray={String(2*Math.PI*26)} strokeDashoffset={String(2*Math.PI*26*(1-wScore/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:wReco.c}}>{wScore}</div></div>
                  <div><div style={{fontSize:16,fontWeight:700,color:wReco.c}}>{wReco.label}</div><div style={{fontSize:12,color:C.tx2,marginTop:4}}>{wReco.desc}</div>{wellness.sleepDur&&<div style={{fontSize:11,color:C.b,fontWeight:600,marginTop:4}}>💤 {wellness.sleepDur}h de sommeil</div>}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>{[{l:"Récupération",v:wellness.fatigue,e:"😴"},{l:"Sommeil",v:wellness.sommeil,e:"💤"},{l:"Sérénité",v:wellness.stress,e:"🧠"},{l:"Énergie",v:wellness.energie,e:"⚡"},{l:"Fraîcheur",v:wellness.doms,e:"💪"}].map(m=>{const mv=m.v||0;const mc=mv>=4?C.g:mv>=3?C.o:C.r;return(<div key={m.l} style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:C.tx3,width:84,flexShrink:0}}>{m.e} {m.l}</span><div style={{flex:1,height:6,background:C.s2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(mv/5*100)+"%",background:mc,borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:700,color:mc,width:16,textAlign:"right"}}>{mv||"?"}</span></div>);})}</div>
                {(wellness.coucher||wellness.reveil||wellness.sleepDur)&&<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {wellness.coucher&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.s2}}><span style={{fontSize:10}}>🌙</span><span style={{fontSize:10,color:C.tx2,fontWeight:600}}>{String(wellness.coucher.h).padStart(2,"0")}:{String(wellness.coucher.m).padStart(2,"0")}</span></div>}
                  {wellness.reveil&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.s2}}><span style={{fontSize:10}}>☀️</span><span style={{fontSize:10,color:C.tx2,fontWeight:600}}>{String(wellness.reveil.h).padStart(2,"0")}:{String(wellness.reveil.m).padStart(2,"0")}</span></div>}
                  {wellness.sleepDur!=null&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.b+"18"}}><span style={{fontSize:10}}>💤</span><span style={{fontSize:10,color:C.b,fontWeight:700}}>{wellness.sleepDur}h</span></div>}
                </div>}
                {wellness.sleepInterrupt===true&&<div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:C.o+"12",border:"1px solid "+C.o+"30",fontSize:11,color:C.o}}>⚠ Réveil nocturne{wellness.sleepInterruptNote?" — "+wellness.sleepInterruptNote:""}</div>}
                {wellness.poids&&<div style={{marginTop:8,display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:C.s2}}><span style={{fontSize:10}}>⚖️</span><span style={{fontSize:11,fontWeight:700,color:C.tx}}>{wellness.poids} kg</span><span style={{fontSize:9,color:C.tx3}}>ce matin</span></div>}
                {wellness.domsZones?.length>0&&<div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:C.o+"10",border:"1px solid "+C.o+"30"}}><div style={{fontSize:9,fontWeight:600,color:C.o,textTransform:"uppercase",marginBottom:4}}>Zones DOMS</div><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{wellness.domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:C.o+"20",color:C.o}}>{z.label}</span>:null;})}</div></div>}
                {wellness.injComment&&<div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:C.r+"10",border:"1px solid "+C.r+"30",fontSize:11,color:C.r}}>🩺 {wellness.injComment}</div>}
              </>):<div style={{textAlign:"center",color:C.tx3,fontSize:12,padding:"20px 0"}}>Aucune donnée de forme aujourd'hui</div>}
            </div>
            {/* Historique score */}
            <div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Score de santé</div>
                <div style={{display:"flex",gap:3}}>{[{k:"week",l:"7j"},{k:"month",l:"30j"},{k:"year",l:"12m"}].map(t=>(<button key={t.k} onClick={()=>setWellnessPeriod(t.k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:wellnessPeriod===t.k?C.acS:"transparent",color:wellnessPeriod===t.k?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>))}</div>
              </div>
              {(()=>{const wData=getWellnessChartData(wellnessHistory,wellnessPeriod);const has=wData.some(d=>d.score!==null);return has?(<><div style={{display:"flex",gap:10,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:3,borderRadius:2,background:C.g}}/><span style={{fontSize:9,color:C.tx3}}>Forme /100</span></div><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:C.b,opacity:0.5}}/><span style={{fontSize:9,color:C.tx3}}>Sommeil (h)</span></div></div><ResponsiveContainer width="100%" height={130}><ComposedChart data={wData} margin={{top:4,right:4,bottom:0,left:-28}}><XAxis dataKey="label" tick={{fontSize:9,fill:C.tx3}} tickLine={false} axisLine={false}/><YAxis yAxisId="score" domain={[0,100]} hide/><YAxis yAxisId="sleep" orientation="right" domain={[0,12]} hide/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const sc=payload.find(p=>p.dataKey==='score');const sl=payload.find(p=>p.dataKey==='sleep');return(<div style={{background:C.s1,border:"1px solid "+C.brdL,borderRadius:8,padding:"6px 10px",fontSize:10}}><div style={{color:C.tx3,marginBottom:4}}>{label}</div>{sc?.value!=null&&<div style={{color:getReco(sc.value).c,fontWeight:700}}>Forme : {sc.value}</div>}{sl?.value!=null&&<div style={{color:C.b}}>Sommeil : {sl.value}h</div>}</div>);}}/><Bar yAxisId="sleep" dataKey="sleep" fill={C.b} opacity={0.3} radius={[3,3,0,0]} maxBarSize={20}/><Line yAxisId="score" dataKey="score" stroke={C.g} strokeWidth={2} dot={(props)=>{if(props.value==null)return<g/>;const rc=getReco(props.value);return<circle cx={props.cx} cy={props.cy} r={3.5} fill={rc.c} stroke={C.bg} strokeWidth={1}/>;}} connectNulls={false}/></ComposedChart></ResponsiveContainer></>):(<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"20px 0"}}>Aucune donnée wellness</div>);})()}
            </div>
            {/* Tunnel sommeil */}
            <div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
              <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Tunnel de sommeil — 14 jours</div>
              <div style={{display:"flex",gap:10,marginBottom:10}}>{[{c:C.g,l:"≥ 7.5h"},{c:C.o,l:"6.5–7.5h"},{c:C.r,l:"< 6.5h"}].map(({c,l})=><div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:c,opacity:0.7}}/><span style={{fontSize:9,color:C.tx3}}>{l}</span></div>)}</div>
              <SleepTunnel wellnessHistory={wellnessHistory} C={C}/>
            </div>
          </div>)}
          {drawerZoom==="goals"&&(<div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
              <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12}}>Séances — Bloc en cours</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:10}}><span style={{fontSize:36,fontWeight:900,color:C.g,letterSpacing:"-1px"}}>{totalDone}</span><span style={{fontSize:16,color:C.tx3}}>/ {totalTarget}</span></div>
              <div style={{height:6,background:C.s2,borderRadius:3,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:Math.min((totalDone/totalTarget)*100,100)+"%",background:C.g,borderRadius:3}}/></div>
              <div style={{fontSize:11,color:C.tx3}}>{Math.max(0,totalTarget-totalDone)} séance(s) restante(s)</div>
            </div>
            {(()=>{
              const lastEntry=Object.keys(weightLog).length>0?Object.entries(weightLog).sort((a,b)=>a[0]>b[0]?-1:1)[0][1]:null;
              const todayW=weightLog[todayKey()]||lastEntry||bodyWeight.current||null;
              const start=bodyWeight.current||null;
              const tgt=nutritionStrategy?.target_weight||bodyWeight.target||null;
              if(!tgt)return null;
              const isGain=start&&tgt?tgt>=start:true;
              const delta=tgt&&todayW?+(tgt-todayW).toFixed(1):null;
              const pct=start&&tgt&&start!==tgt&&todayW?Math.min(100,Math.max(0,isGain?((todayW-start)/(tgt-start))*100:((start-todayW)/(start-tgt))*100)):0;
              const reached=delta!==null&&Math.abs(delta)<0.3;
              const wC=reached?C.g:C.ac;
              return(<div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Objectif poids</div>
                  {start&&tgt&&<span style={{fontSize:10,fontWeight:700,color:isGain?C.g:C.b,padding:"2px 8px",borderRadius:5,background:(isGain?C.g:C.b)+"18"}}>{isGain?"▲ Prise":"▼ Sèche"}</span>}
                </div>
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:10}}>
                  <span style={{fontSize:36,fontWeight:900,color:wC,letterSpacing:"-1px"}}>{todayW||"--"}</span>
                  <span style={{fontSize:16,color:C.tx3}}>/ {tgt} kg</span>
                </div>
                <div style={{height:6,background:C.s2,borderRadius:3,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:pct+"%",background:wC,borderRadius:3,transition:"width 0.4s"}}/></div>
                <div style={{fontSize:11,color:reached?C.g:C.tx3,fontWeight:reached?600:400}}>{reached?"Objectif atteint !":delta!==null?(Math.abs(delta)+" kg restants"):"—"}</div>
              </div>);
            })()}
            {nutritionStrategy&&<div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>
              <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Stratégie nutritionnelle</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:800,color:nutritionStrategy.strategy==="seche"?C.r:nutritionStrategy.strategy==="prise_de_masse"?C.g:C.b}}>{nutritionStrategy.strategy==="seche"?"Sèche":nutritionStrategy.strategy==="prise_de_masse"?"Prise de masse":"Maintenance"}</span>
              </div>
              {nutritionStrategy.surplus_deficit_min!=null&&<div style={{fontSize:11,color:C.tx2}}>Fourchette : {nutritionStrategy.surplus_deficit_min}% à {nutritionStrategy.surplus_deficit_max}%</div>}
            </div>}
          </div>)}
          {drawerZoom==="health"&&(<div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd}}>{(()=>{const wData=getWellnessChartData(wellnessHistory,wellnessPeriod);const hasSomeData=wData.some(d=>d.score!==null);return(<><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:13,fontWeight:700}}>Score de santé</div><div style={{display:"flex",gap:3}}>{[{k:"week",l:"7j"},{k:"month",l:"30j"},{k:"year",l:"12m"}].map(t=>(<button key={t.k} onClick={()=>setWellnessPeriod(t.k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:wellnessPeriod===t.k?C.acS:"transparent",color:wellnessPeriod===t.k?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>))}</div></div>{hasSomeData?<ResponsiveContainer width="100%" height={200}><ComposedChart data={wData} margin={{top:4,right:4,bottom:0,left:-28}}><XAxis dataKey="label" tick={{fontSize:9,fill:C.tx3}} tickLine={false} axisLine={false}/><YAxis yAxisId="score" domain={[0,100]} hide/><YAxis yAxisId="sleep" orientation="right" domain={[0,12]} hide/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const sc=payload.find(p=>p.dataKey==='score');const sl=payload.find(p=>p.dataKey==='sleep');return(<div style={{background:C.s1,border:"1px solid "+C.brdL,borderRadius:8,padding:"6px 10px",fontSize:10}}><div style={{color:C.tx3,marginBottom:4}}>{label}</div>{sc?.value!=null&&<div style={{color:getReco(sc.value).c,fontWeight:700}}>Forme : {sc.value}</div>}{sl?.value!=null&&<div style={{color:C.b}}>Sommeil : {sl.value}h</div>}</div>);}}/><Bar yAxisId="sleep" dataKey="sleep" fill={C.b} opacity={0.3} radius={[3,3,0,0]} maxBarSize={20}/><Line yAxisId="score" dataKey="score" stroke={C.g} strokeWidth={2} dot={(props)=>{if(props.value==null)return<g/>;const rc=getReco(props.value);return<circle cx={props.cx} cy={props.cy} r={3.5} fill={rc.c} stroke={C.bg} strokeWidth={1}/>;}} connectNulls={false}/></ComposedChart></ResponsiveContainer>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"30px 0"}}>Aucune donnée wellness</div>}</>);})()}</div>)}
        </div>
      </div>)}
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(360px,92vw)",zIndex:102,background:C.bg,overflowY:"auto",display:"flex",flexDirection:"column",boxShadow:"-4px 0 32px rgba(0,0,0,0.6)",borderLeft:"1px solid "+C.brd}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd,position:"sticky",top:0,background:C.bg,zIndex:2}}>
          <div style={{fontSize:15,fontWeight:700}}>Mon profil</div>
          <button onClick={()=>setDrawerOpen(false)} style={{width:28,height:28,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"16px",flex:1,display:"flex",flexDirection:"column",gap:12}}>
          {/* Profile card */}
          <div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brd,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:C.acS,border:"2px solid "+C.ac+"40",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:C.ac}}>
                {athleteProfile?([athleteProfile.first_name,athleteProfile.last_name].filter(Boolean).join(" ")||athleteProfile.full_name||"?").split(" ").filter(n=>n).map(n=>n[0]).join("").toUpperCase().slice(0,2):"?"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.tx}}>{athleteProfile?([athleteProfile.first_name,athleteProfile.last_name].filter(Boolean).join(" ")||athleteProfile.full_name||"Athlète"):"Athlète"}</div>
                {athleteProfile?.gender&&<div style={{fontSize:11,color:C.tx3}}>{athleteProfile.gender==="male"?"Homme":athleteProfile.gender==="female"?"Femme":""}</div>}
              </div>
            </div>
            {athleteProfile&&(<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:C.brd,borderTop:"1px solid "+C.brd}}>
                {[{l:"Âge",v:athleteProfile.age?athleteProfile.age+" ans":null},{l:"Taille",v:athleteProfile.height_cm?athleteProfile.height_cm+" cm":null},{l:"MB",v:athleteProfile.base_metabolism?Math.round(athleteProfile.base_metabolism).toLocaleString("fr-FR")+" kcal":null}].map(s=>(<div key={s.l} style={{background:C.s2,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:10,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{s.l}</div><div style={{fontSize:13,fontWeight:700,color:s.v?C.tx:C.tx3}}>{s.v||"—"}</div></div>))}
              </div>
              {(athleteProfile.weight_kg||athleteProfile.body_fat_pct)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:C.brd,borderTop:"1px solid "+C.brd}}>
                {[{l:"Poids réf.",v:athleteProfile.weight_kg?athleteProfile.weight_kg+" kg":null},{l:"Masse grasse",v:athleteProfile.body_fat_pct?athleteProfile.body_fat_pct+" %":null}].map(s=>(<div key={s.l} style={{background:C.s2,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:10,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{s.l}</div><div style={{fontSize:13,fontWeight:700,color:s.v?C.tx:C.tx3}}>{s.v||"—"}</div></div>))}
              </div>}
            </>)}
            {!athleteProfile&&<div style={{padding:"12px 16px",fontSize:12,color:C.tx3,textAlign:"center"}}>Profil non renseigné</div>}
          </div>
          {/* Données sportives */}
          <div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brd,overflow:"hidden"}}>
            <button onClick={()=>setDrawerSportOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Données sportives</div>
              <span style={{fontSize:12,color:C.tx3,display:"inline-block",transition:"transform 0.2s",transform:drawerSportOpen?"rotate(180deg)":"none"}}>∨</span>
            </button>
            {drawerSportOpen&&<div style={{borderTop:"1px solid "+C.brd,padding:"0 0 8px"}}><PerformanceProfile athleteId={athleteId} viewOnly={viewOnly} C={C}/></div>}
          </div>
          {/* Poids de corps */}
          <button onClick={()=>setDrawerZoom("weight")} style={{width:"100%",background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.brd,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Poids de corps</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:800,color:C.ac}}>{(()=>{const e=Object.entries(weightLog).sort((a,b)=>b[0]>a[0]?1:-1)[0];return weightLog[todayKey()]||e?.[1]||bodyWeight.current||"—";})()}<span style={{fontSize:10,fontWeight:400,color:C.tx3}}> kg</span></span><span style={{fontSize:11,color:C.tx3}}>→</span></div>
            </div>
            {Object.keys(weightLog).length>0?<WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy}/>:<div style={{fontSize:11,color:C.tx3,textAlign:"center",padding:"8px 0"}}>Aucune mesure</div>}
          </button>
          {/* Forme du jour */}
          <button onClick={()=>setDrawerZoom("wellness")} style={{width:"100%",background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+(wellness?wReco.c+30:C.brd),textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:wellness?10:0}}>
              <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Forme du jour</div>
              {wellness&&<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{position:"relative",width:36,height:36}}><svg viewBox="0 0 32 32" style={{width:36,height:36,transform:"rotate(-90deg)"}}><circle cx="16" cy="16" r="12" fill="none" stroke={C.s2} strokeWidth="3"/><circle cx="16" cy="16" r="12" fill="none" stroke={wReco.c} strokeWidth="3" strokeDasharray={String(2*Math.PI*12)} strokeDashoffset={String(2*Math.PI*12*(1-wScore/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:wReco.c}}>{wScore}</div></div><span style={{fontSize:11,color:C.tx3}}>→</span></div>}
            </div>
            {wellness?<><div style={{fontSize:12,fontWeight:600,color:wReco.c}}>{wReco.label}</div>
            {(wellness.coucher||wellness.reveil||wellness.sleepDur)&&<div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
              {wellness.coucher&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.s2}}><span style={{fontSize:10}}>🌙</span><span style={{fontSize:10,color:C.tx2,fontWeight:600}}>{String(wellness.coucher.h).padStart(2,"0")}:{String(wellness.coucher.m).padStart(2,"0")}</span></div>}
              {wellness.reveil&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.s2}}><span style={{fontSize:10}}>☀️</span><span style={{fontSize:10,color:C.tx2,fontWeight:600}}>{String(wellness.reveil.h).padStart(2,"0")}:{String(wellness.reveil.m).padStart(2,"0")}</span></div>}
              {wellness.sleepDur&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,background:C.b+"18"}}><span style={{fontSize:10}}>💤</span><span style={{fontSize:10,color:C.b,fontWeight:700}}>{wellness.sleepDur}h</span></div>}
            </div>}</>:<div style={{fontSize:11,color:C.tx3}}>Aucun bilan aujourd'hui</div>}
          </button>
          {/* Score de santé */}
          <button onClick={()=>setDrawerZoom("health")} style={{width:"100%",background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.brd,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Score de santé</div>
              <span style={{fontSize:11,color:C.tx3}}>→</span>
            </div>
            {(()=>{const wData=getWellnessChartData(wellnessHistory,wellnessPeriod);const hasSomeData=wData.some(d=>d.score!==null);return hasSomeData?<ResponsiveContainer width="100%" height={72}><ComposedChart data={wData} margin={{top:2,right:2,bottom:0,left:-28}}><YAxis yAxisId="score" domain={[0,100]} hide/><YAxis yAxisId="sleep" orientation="right" domain={[0,12]} hide/><Bar yAxisId="sleep" dataKey="sleep" fill={C.b} opacity={0.3} radius={[2,2,0,0]} maxBarSize={10}/><Line yAxisId="score" dataKey="score" stroke={C.g} strokeWidth={1.5} dot={false} connectNulls={false}/></ComposedChart></ResponsiveContainer>:<div style={{fontSize:11,color:C.tx3,textAlign:"center",padding:"8px 0"}}>Aucune donnée</div>;})()}
          </button>
          {/* 1RM Record */}
          <div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brd,overflow:"hidden"}}>
            <button onClick={()=>setDrawerPrOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>1RM Record</div>
              <span style={{fontSize:12,color:C.tx3,display:"inline-block",transition:"transform 0.2s",transform:drawerPrOpen?"rotate(180deg)":"none"}}>∨</span>
            </button>
            {drawerPrOpen&&(<div style={{borderTop:"1px solid "+C.brd,padding:"12px 16px"}}>
              {(()=>{
                const seen=new Set();
                const progExNames=Object.values(exos||{}).flat().map(ex=>ex.name||'').filter(n=>{if(!n||seen.has(n.toLowerCase()))return false;seen.add(n.toLowerCase());return true;}).sort();
                const filtered=prSearch?progExNames.filter(n=>n.toLowerCase().includes(prSearch.toLowerCase())):progExNames;
                const getActual1rm=(exName,w)=>{const exIds=Object.values(exos||{}).flat().filter(ex=>(ex.name||'').toLowerCase()===exName.toLowerCase()).map(ex=>ex.id);let best=null;exIds.forEach(id=>{(sets[id+"_"+w]||[]).filter(r=>r.done&&r.kg>0).forEach(r=>{const est=e1rm(r.kg,r.reps||1);if(!best||est>best)best=est;});});return best;};
                const actual1rmByWeek=prExName?Array.from({length:tw},(_,i)=>({w:i+1,week:"S"+(i+1),val:getActual1rm(prExName,i+1)})):[];
                const bestActual=actual1rmByWeek.reduce((mx,d)=>d.val&&d.val>mx.val?d:mx,{val:0,w:null});
                const showDropdown=prSearch&&filtered.length>0&&!progExNames.find(n=>n.toLowerCase()===prSearch.toLowerCase());
                return(<>
                  <div style={{position:"relative",marginBottom:10}}>
                    <input value={prSearch} onChange={e=>{setPrSearch(e.target.value);setPrExName(null);}} placeholder={progExNames.length?"Rechercher un exercice...":"Aucun exercice"} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                    {showDropdown&&(<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.s1,border:"1px solid "+C.brdL,borderRadius:8,zIndex:50,maxHeight:140,overflowY:"auto",marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                      {filtered.slice(0,6).map(n=>(<div key={n} onClick={()=>{setPrExName(n);setPrSearch(n);}} style={{padding:"8px 12px",fontSize:12,cursor:"pointer",color:C.tx,borderBottom:"1px solid "+C.brd}}>{n}</div>))}
                    </div>)}
                  </div>
                  {prExName?(
                    <>
                      <div style={{display:"flex",gap:5,marginBottom:10}}>
                        {[{k:"est",l:"1RM Estimé"},{k:"evo",l:"Évolution"}].map(t=>(<button key={t.k} onClick={()=>setPrTab(t.k)} style={{padding:"4px 12px",borderRadius:7,border:"none",background:prTab===t.k?C.acS:C.s2,color:prTab===t.k?C.ac:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>))}
                      </div>
                      {prTab==="est"&&<div style={{textAlign:"center"}}><div style={{fontSize:44,fontWeight:900,color:C.ac,letterSpacing:"-2px",lineHeight:1}}>{bestActual.val||"--"}</div><div style={{fontSize:10,color:C.tx3,marginTop:3}}>kg estimé 1RM</div>{bestActual.w&&<div style={{marginTop:6,fontSize:10,color:C.tx3,padding:"2px 8px",borderRadius:5,background:C.s2,display:"inline-block"}}>Meilleure perf. S{bestActual.w}</div>}</div>}
                      {prTab==="evo"&&(actual1rmByWeek.some(d=>d.val)?<MiniChart data={actual1rmByWeek} color={C.ac} h={70}/>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"16px 0"}}>Aucune série effectuée</div>)}
                    </>
                  ):(
                    <div style={{fontSize:11,color:C.tx3,textAlign:"center",padding:"10px 0"}}>{progExNames.length?"Recherche et sélectionne un exercice":"Aucun exercice dans la programmation"}</div>
                  )}
                </>);
              })()}
            </div>)}
          </div>
          {/* Blessures */}
          {activeInjuries.length>0&&(<div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.r+"30",overflow:"hidden"}}>
            <button onClick={()=>setDrawerInjOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:6,height:6,borderRadius:"50%",background:C.r}}/><div style={{fontSize:12,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px"}}>Blessures actives ({activeInjuries.length})</div></div>
              <span style={{fontSize:12,color:C.tx3,display:"inline-block",transition:"transform 0.2s",transform:drawerInjOpen?"rotate(180deg)":"none"}}>∨</span>
            </button>
            {drawerInjOpen&&(<div style={{borderTop:"1px solid "+C.r+"30",padding:"8px 16px"}}>
              {activeInjuries.map(inj=>{const sc=stC(inj.status);const zn=ALL_BZ.filter(z=>inj.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non précisée";return(<div key={inj.id} style={{padding:"8px 10px",borderRadius:8,background:C.s2,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:12,fontWeight:600,color:C.tx}}>{zn}</div><div style={{fontSize:10,color:C.tx3}}>Intensité {inj.intensity}/10</div></div><span style={{fontSize:10,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:5,background:sc+"15"}}>{inj.status}</span></div>);})}
            </div>)}
          </div>)}
          {/* Retour du coach */}
          {(()=>{
            const weeks=Object.keys(coachFeedbacks).map(Number).filter(Boolean).sort((a,b)=>b-a);
            const latestWeek=weeks[0];
            const latestFb=latestWeek?coachFeedbacks[latestWeek]:null;
            if(!latestFb?.note)return null;
            return(<div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.coach+"40",overflow:"hidden"}}>
              <button onClick={()=>{setTab("coachfeedback");setDrawerOpen(false);}} style={{width:"100%",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13}}>💬</span>
                    <span style={{fontSize:11,fontWeight:700,color:C.coach}}>Retour du coach</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,color:C.tx3}}>S{latestWeek}</span>
                    <span style={{fontSize:11,color:C.coach}}>›</span>
                  </div>
                </div>
                <div style={{fontSize:11,color:C.tx2,lineHeight:1.55,fontStyle:"italic",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>"{latestFb.note}"</div>
              </button>
            </div>);
          })()}
          {/* Objectifs */}
          <button onClick={()=>{setDrawerZoom("goals");}} style={{width:"100%",background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.brd,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Objectifs</div>
            <span style={{fontSize:11,color:C.tx3}}>→</span>
          </button>
          {/* Déconnexion */}
          <div style={{marginTop:"auto",paddingTop:8}}>
            <button onClick={()=>{setShowLogoutConfirm(true);}} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"1px solid "+C.r+"30",background:C.rS,color:C.r,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span>⏻</span><span>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </>)}
    {showLogoutConfirm&&(<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowLogoutConfirm(false)}>
      <div style={{background:C.s1,borderRadius:16,padding:24,maxWidth:320,width:"100%",border:"1px solid "+C.brd}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:15,fontWeight:700,color:C.tx,marginBottom:8}}>Se déconnecter ?</div>
        <div style={{fontSize:13,color:C.tx3,marginBottom:20}}>Êtes-vous sûr de vouloir vous déconnecter ?</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowLogoutConfirm(false)} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href="/login";}} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",background:C.r,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Déconnecter</button>
        </div>
      </div>
    </div>)}
    {showWellness&&(<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg,overflowY:"auto"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd}}><div style={{fontSize:14,fontWeight:700}}>Wellness du jour</div><button onClick={()=>setShowWellness(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>x</button></div><WellnessFlow existing={wellness} onSave={saveWellness} sleepTarget={goals.sleepTarget} onAddInjury={addInjury} weightLog={weightLog}/></div>)}
    {showAppFeedback&&(()=>{
      let fbRating=null,fbText="",fbSending=false;
      const AppFbForm=()=>{
        const[rating,setRating]=React.useState(null);
        const[text,setText]=React.useState("");
        const[sending,setSending]=React.useState(false);
        const[done,setDone]=React.useState(false);
        const submit=async()=>{
          if(!rating||sending)return;
          setSending(true);
          const entry={id:"fb_"+Date.now(),date:new Date().toISOString(),rating,text:text.trim()};
          const newList=[...appFeedbacks,entry];
          await supabase.from('app_data').upsert({athlete_id:athleteId,key:'app:user_feedback',value:{entries:newList},updated_at:new Date().toISOString()},{onConflict:'athlete_id,key'});
          setAppFeedbacks(newList);
          setSending(false);setDone(true);
          setTimeout(()=>setShowAppFeedback(false),1500);
        };
        if(done)return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,padding:32}}><div style={{fontSize:40}}>🙏</div><div style={{fontSize:18,fontWeight:800,color:C.g}}>Merci !</div><div style={{fontSize:13,color:C.tx2}}>Ton avis nous aide à améliorer l'app.</div></div>);
        return(<div style={{padding:"24px 20px",display:"flex",flexDirection:"column",gap:20}}>
          <div><div style={{fontSize:22,fontWeight:900,letterSpacing:"-0.5px",marginBottom:6}}>Donne ton avis</div><div style={{fontSize:13,color:C.tx2}}>Ton retour nous aide à améliorer l'expérience. Ça prend 30 secondes.</div></div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Note globale</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setRating(n)} style={{fontSize:32,background:"none",border:"none",cursor:"pointer",opacity:rating&&n<=rating?1:0.3,transform:rating===n?"scale(1.2)":"scale(1)",transition:"all 0.15s",padding:"4px 6px"}}>⭐</button>)}
            </div>
            <div style={{textAlign:"center",fontSize:12,color:C.tx3,marginTop:6}}>{rating===1?"À améliorer":rating===2?"Moyen":rating===3?"Correct":rating===4?"Bien":"Excellent !"}</div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Commentaire (optionnel)</div>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Ce que tu aimes, ce qui manque, un bug rencontré..." rows={4} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid "+C.brdL,background:C.s1,color:C.tx,fontSize:13,fontFamily:"inherit",resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.6}}/>
          </div>
          <button onClick={submit} disabled={!rating||sending} style={{padding:"14px 0",borderRadius:12,border:"none",background:rating?C.ac:"#333",color:rating?"#fff":C.tx3,fontSize:14,fontWeight:700,cursor:rating?"pointer":"default",fontFamily:"inherit",opacity:sending?0.7:1}}>
            {sending?"Envoi…":"Envoyer mon avis"}
          </button>
        </div>);
      };
      return(<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid "+C.brd,flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:700}}>Avis sur l'app</div>
          <button onClick={()=>setShowAppFeedback(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>×</button>
        </div>
        <AppFbForm/>
      </div>);
    })()}
    {milestoneNotif&&(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:250,background:C.s1,border:"1px solid "+C.g+"50",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}><div><div style={{fontSize:13,fontWeight:700,color:C.g}}>Nouveau palier valide !</div><div style={{fontSize:11,color:C.tx2}}>Poids mis a jour : {milestoneNotif} kg</div></div></div>)}
    {autoProgNotif&&(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:251,background:C.s1,border:"1px solid "+C.coach+"50",borderRadius:14,padding:"10px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}><span style={{fontSize:18}}>↗</span><div><div style={{fontSize:13,fontWeight:700,color:C.coach}}>Surcharge progressive mise à jour</div><div style={{fontSize:11,color:C.tx2}}>{autoProgNotif}</div></div></div>)}
    {weekJustCompleted&&(<div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{fontSize:26,fontWeight:800,color:C.g}}>Semaine {weekJustCompleted} validee !</div><div style={{fontSize:14,color:C.tx2}}>{weekJustCompleted<tw?"En route pour S"+(weekJustCompleted+1):"Bloc termine !"}</div><div style={{display:"flex",gap:6,marginTop:8}}>{[...Array(tw)].map((_,i)=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<weekJustCompleted?C.g:C.s2}}/>)}</div></div>)}
    {showBilan&&(<div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,overflowY:"auto"}}><div style={{padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}><div style={{fontSize:28,fontWeight:800,textAlign:"center"}}>Bloc termine !</div><div style={{fontSize:14,color:C.tx2}}>{totalDone} seances realisees</div><div style={{display:"flex",gap:12,width:"100%"}}>{getBig3(exos).map(({name,label,c})=>{const pr=prs[name];return(<div key={label} style={{flex:1,background:C.s1,borderRadius:14,padding:"14px 10px",textAlign:"center",border:"1px solid "+c+"30"}}><div style={{fontSize:11,color:C.tx3,marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:c}}>{pr?.est||"--"}</div><div style={{fontSize:9,color:C.tx3}}>kg est.</div></div>);})}</div><div style={{width:"100%",background:C.s1,borderRadius:14,padding:16,border:"1px solid "+C.brd}}><CombinedStatsChart data={combinedData}/></div><button onClick={()=>{setShowBilan(false);setShowNewBlock(true);}} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",background:C.coach,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button><button onClick={()=>setShowBilan(false)} style={{background:"none",border:"none",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Fermer</button></div></div>)}
    {showNewBlock&&<NewBlockModal onStart={archiveAndNewBlock} onClose={()=>setShowNewBlock(false)} onResume={()=>setShowNewBlock(false)} hasCurrentData={sessions.length>0&&Object.values(exos).flat().length>0} blockHistory={blockHistory} onDelete={idx=>setBlockHistory(blockHistory.filter((_,i)=>i!==idx))}/>}
    {showBlockHistory&&<BlockHistoryViewer blockHistory={blockHistory} onClose={()=>setShowBlockHistory(false)} onDelete={idx=>setBlockHistory(blockHistory.filter((_,i)=>i!==idx))}/>}
    {showTierModal&&<TierConfigModal blockConfig={blockConfig} setBlockConfig={setBlockConfig} onClose={()=>setShowTierModal(false)}/>}
    {mode==="coach"&&coachTab==="prog"&&sessions.length>0&&<AIChatBar exos={exos} sessions={sessions} chatHistory={chatHistory} setChatHistory={setChatHistory} onApply={applyAIEdit} onOpenChange={setAiChatOpen} C={C}/>}
    {mode==="athlete"&&(timerActive||timerFinished)&&(<div style={{position:"fixed",bottom:64,left:"50%",transform:"translateX(-50%)",zIndex:150,background:timerFinished?"rgba(34,201,147,0.15)":C.s1,border:"1px solid "+(timerFinished?C.g:timerActive&&timerLeft<=10?C.r:C.ac)+"70",borderRadius:50,padding:"9px 18px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 24px rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}>
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
          {viewOnly&&mode==="athlete"&&<div style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:6,background:C.coachS,color:C.coach,border:"1px solid "+C.coach+"40"}}>Observation</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {canToggleMode&&<div style={{display:"flex",background:C.s1,borderRadius:8,padding:2,border:"1px solid "+C.brdL}}>{[{k:"athlete",l:"Athlete"},{k:"coach",l:"Coach"}].map(({k,l})=>(<button key={k} onClick={()=>switchMode(k)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:mode===k?(k==="coach"?C.coach:C.ac):"transparent",color:mode===k?"#fff":C.tx3,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{l}</button>))}</div>}
          {mode==="athlete"&&<button onClick={()=>setDrawerOpen(true)} title="Mon profil" style={{width:30,height:30,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>☰</button>}
          {userName&&!myProfile?.is_admin&&<div style={{fontSize:11,color:C.tx3,fontWeight:500,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userName}</div>}
        </div>
      </div>
      <div style={{display:"flex",marginTop:4,maxWidth:mode==="coach"?1400:"none",margin:mode==="coach"?"0 auto":"unset",paddingLeft:mode==="coach"?40:0}}>{activeTabs.map(t=><button key={t.k} onClick={()=>setActiveTab(t.k)} style={tabS(t.k)}>{t.l}</button>)}</div>
    </div>

    {mode==="coach"&&(<div style={{padding:"20px 40px "+(aiChatOpen?"calc(60vh + 40px)":"60px"),maxWidth:1400,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:C.coachS,border:"1px solid "+C.coach+"30",marginBottom:20}}><div style={{fontSize:13,fontWeight:700,color:C.coach}}>Mode Coach</div><div style={{fontSize:11,color:C.tx3}}>- Planification</div></div>
      {coachTab==="prog"&&(<>
        {/* Paramètres de bloc au-dessus des sous-onglets */}
        <div style={{background:C.s1,borderRadius:14,padding:"12px 16px",border:"1px solid "+C.b+"30",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:C.b,textTransform:"uppercase",letterSpacing:"0.5px"}}>Bloc d'entraînement</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setShowNewBlock(true)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+C.coach+"40",background:C.coachS,color:C.coach,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Nouveau bloc</button>
              <button onClick={()=>setShowBlockHistory(true)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+C.brdL,background:"transparent",color:C.tx3,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",position:"relative"}}>Historique{blockHistory.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:C.ac,color:"#fff",fontSize:8,fontWeight:800,width:13,height:13,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{blockHistory.length}</span>}</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={blockConfig?.blockName||""} onChange={e=>setBlockConfig(c=>({...c,blockName:e.target.value}))} placeholder="Nom du bloc..." style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid "+C.brdL,background:C.s2,color:C.tx,fontSize:13,fontWeight:600,fontFamily:"inherit"}}/>
          </div>
          {/* Dates + durée */}
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:C.tx3,flexShrink:0}}>Début</span>
              <input type="date" value={blockConfig?.startDate||""} onChange={e=>setBlockConfig(c=>({...c,startDate:e.target.value||null}))} style={{padding:"6px 8px",borderRadius:8,border:"1px solid "+(blockConfig?.startDate?C.brdL:C.o+"60"),background:C.s2,color:blockConfig?.startDate?C.tx:C.o,fontSize:12,fontFamily:"inherit"}}/>
            </div>
            {blockConfig?.startDate&&(()=>{const end=new Date(new Date(blockConfig.startDate).getTime()+tw*7*86400000);const fmtDate=d=>d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});return(<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:C.s2}}><span style={{fontSize:10,color:C.tx3}}>Fin</span><span style={{fontSize:11,fontWeight:700,color:C.b}}>{fmtDate(end)}</span></div>);})()}
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:C.s2,border:"1px solid "+C.brd}}>
              <span style={{fontSize:10,color:C.tx3}}>Durée</span>
              <button onClick={()=>setBlockConfig(c=>({...c,totalWeeks:Math.max(3,c.totalWeeks-1)}))} style={{width:22,height:22,borderRadius:5,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:14,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>-</button>
              <span style={{fontSize:13,fontWeight:800,color:C.b,minWidth:36,textAlign:"center"}}>{tw}sem</span>
              <button onClick={()=>setBlockConfig(c=>({...c,totalWeeks:Math.min(16,c.totalWeeks+1)}))} style={{width:22,height:22,borderRadius:5,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:14,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>+</button>
            </div>
            {blockConfig?.startDate&&(()=>{const days=Math.floor((Date.now()-new Date(blockConfig.startDate).getTime())/86400000);const wk=Math.min(Math.max(1,Math.floor(days/7)+1),tw);return<span style={{fontSize:10,color:C.g,padding:"5px 8px",borderRadius:7,background:C.gS,fontWeight:600}}>S{wk} · J{days+1}</span>;})()}
          </div>
          {/* Deload : sélection par semaine */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:C.tx3,flexShrink:0}}>Deload :</span>
            {weeksArr.map(w=>{const isDL=dw===w;return(<button key={w} onClick={()=>setBlockConfig(c=>({...c,deloadWeek:c.deloadWeek===w?0:w}))} style={{padding:"4px 9px",borderRadius:6,border:"1px solid "+(isDL?C.b+"60":C.brdL),background:isDL?C.bS:"transparent",color:isDL?C.b:C.tx3,fontSize:10,fontWeight:isDL?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>S{w}</button>);})}
            {dw>0&&<button onClick={()=>setBlockConfig(c=>({...c,deloadWeek:0}))} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
          </div>
        </div>
        {/* Calendrier mensuel */}
        <MonthCalendar sessions={sessions} completedSessions={completedSessions} blockConfig={blockConfig} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} exos={exos} sets={sets} energySessions={energySessions} energyWeekPlan={energyWeekPlan} energyDayPlan={energyDayPlan} allMethods={allMethods} wellnessHistory={wellnessHistory} nutritionLog={nutritionLog} sessionLogs={sessionLogs} currentWeek={currentWeek} C={C}/>
        {/* Sous-onglets prog */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid "+C.brd,marginBottom:16}}>
          {[{k:"muscu",l:"Musculation"},{k:"energie",l:"Énergétique"},{k:"specifique",l:"Spécifique"}].map(t=>(
            <button key={t.k} onClick={()=>{setProgSubTab(t.k);setEnergyEditorKey(null);}} style={{padding:"9px 18px",border:"none",borderBottom:"2px solid "+(progSubTab===t.k?C.coach:"transparent"),background:"transparent",color:progSubTab===t.k?C.coach:C.tx3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px",flexShrink:0}}>{t.l}</button>
          ))}
        </div>
        {progSubTab==="muscu"&&(<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700}}>Musculation{blockConfig?.blockName&&<span style={{fontSize:11,color:C.b,fontWeight:600,marginLeft:8}}>{blockConfig.blockName} · {tw} sem.</span>}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setShowTierModal(true)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.o+"40",background:C.o+"12",color:C.o,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>⚙ Surcharge</button>
            </div>
          </div>
          {sessions.length===0?(<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:4}}>Aucun bloc actif</div><div style={{fontSize:12,color:C.tx3,marginBottom:16}}>Crée un nouveau bloc pour commencer à planifier.</div><button onClick={()=>setShowNewBlock(true)} style={{padding:"12px 24px",borderRadius:12,border:"none",background:C.coach,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Créer un bloc</button></div>):<CoachProgramEditor exos={exos} setExos={setExos} sessions={sessions} setSessions={setSessions} athleteNotes={athleteNotes} allMethods={allMethods} customMethods={customMethods} setCustomMethods={setCustomMethods} blockConfig={blockConfig} exMeta={exMeta} setExMeta={setExMeta} currentWeek={currentWeek} sets={sets} completedSessions={completedSessions} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule}/>}
          {sessions.length>0&&<div style={{marginTop:16,paddingTop:14,borderTop:"1px solid "+C.brd}}>
            <button onClick={()=>setShowExoParams(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:"1px solid "+C.brdL,background:showExoParams?C.acS:"transparent",color:showExoParams?C.ac:C.tx2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:showExoParams?12:0}}>
              ⚙ Paramètres exercices{showExoParams?" ∧":" ∨"}
            </button>
            {showExoParams&&<CoachExoParams exMeta={exMeta} setExMeta={setExMeta} exos={exos} setExos={setExos} blockConfig={blockConfig}/>}
          </div>}
        </>)}
        {progSubTab==="energie"&&(<CoachEnergyProgram athleteId={athleteId} energyEditorKey={energyEditorKey} setEnergyEditorKey={setEnergyEditorKey} energySessions={energySessions} setEnergySessions={setEnergySessions} energySessionsLoaded={energySessionsLoaded} setEnergySessionsLoaded={setEnergySessionsLoaded} C={C} blockConfig={blockConfig} currentWeek={currentWeek} weekPlan={energyWeekPlan} setWeekPlan={setEnergyWeekPlan} dayPlan={energyDayPlan} setDayPlan={setEnergyDayPlan}/>)}
        {progSubTab==="specifique"&&(<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:40,marginBottom:12}}>🎯</div><div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:4}}>Séances Spécifiques</div><div style={{fontSize:12,color:C.tx3}}>Planification des séances spécifiques à venir prochainement.</div></div>)}
      </>)}
      {coachTab==="banque"&&(<>
        {/* Sous-onglets banque */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid "+C.brd,marginBottom:16}}>
          {[{k:"muscu",l:"Musculation"},{k:"energie",l:"Énergétique"}].map(t=>(
            <button key={t.k} onClick={()=>setBanqueSubTab(t.k)} style={{padding:"9px 18px",border:"none",borderBottom:"2px solid "+(banqueSubTab===t.k?C.coach:"transparent"),background:"transparent",color:banqueSubTab===t.k?C.coach:C.tx3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px"}}>{t.l}</button>
          ))}
        </div>
        {banqueSubTab==="muscu"&&<><ExerciseBank coachId={athleteId} onAddToExos={handleBankAdd}/>{bankAddMsg&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:250,background:C.g,color:"#fff",borderRadius:12,padding:"10px 20px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{bankAddMsg}</div>}</>}
        {banqueSubTab==="energie"&&<EnergyExerciseBank coachId={athleteId} C={C}/>}
      </>)}
      {bankAddEx&&sessions.length>1&&(<div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setBankAddEx(null)}><div style={{width:"100%",maxWidth:640,background:C.s1,borderRadius:"16px 16px 0 0",padding:24}} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:6}}>Ajouter à quelle séance ?</div><div style={{fontSize:12,color:C.tx3,marginBottom:16}}>{bankAddEx.name}</div>{sessions.map(s=>(<button key={s.id} onClick={()=>{const newEx={id:"g_"+Date.now(),name:bankAddEx.name,bloc:bankAddEx.bloc||"ESTH",target:bankAddEx.target||"Pecs",exType:bankAddEx.ex_type||"muscu",exercise_id:bankAddEx.id,weeks:{1:{kg:0,sets:3,repsRange:"10",rir:2}}};setExos(prev=>({...prev,[s.id]:[...(prev[s.id]||[]),newEx]}));setBankAddEx(null);setCoachTab("prog");}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid "+C.brdL,background:C.s2,marginBottom:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}><div style={{width:32,height:32,borderRadius:8,background:C.acS,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.ac}}>{s.short||s.name.charAt(0)}</div><div style={{fontSize:13,fontWeight:600,color:C.tx}}>{s.name}</div></button>))}<button onClick={()=>setBankAddEx(null)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:"transparent",color:C.tx3,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>Annuler</button></div></div>)}
      {coachTab==="stats"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Suivi athlete</div>
        <div style={{fontSize:12,color:C.tx2,marginBottom:12}}>{sessions.length>0?(blockConfig?.blockName||"Programme")+" · S"+currentWeek+"/"+tw:"Aucun bloc actif"}</div>

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
          {Object.keys(weightLog).length>0?<WeightChart log={weightLog} milestones={weightMilestones} target={bodyWeight.target} nutritionStrategy={nutritionStrategy}/>:<div style={{textAlign:"center",color:C.tx3,fontSize:11,padding:"14px 0"}}>Aucune mesure</div>}
        </div>

        {/* Séries par muscle */}
        <MuscleVolumeCard exos={exos} exMeta={exMeta} sets={sets} sessions={sessions} weeksArr={weeksArr} tw={tw}/>

        {/* Blessures */}
        {injuries.length>0?(<div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.r+"30"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.r,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Blessures ({activeInjuries.length} active{activeInjuries.length>1?"s":""})</div>
          {injuries.map(inj=>{const sc=stC(inj.status);const zn=ALL_BZ.filter(z=>inj.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee";return(<div key={inj.id} style={{padding:"8px 12px",borderRadius:8,background:C.s2,border:"1px solid "+sc+"30",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:12,fontWeight:600,color:C.tx}}>{zn}</div><div style={{fontSize:10,color:C.tx3}}>{inj.type||"Type non precise"} - Intensite {inj.intensity}/10</div></div><span style={{fontSize:10,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:5,background:sc+"15"}}>{inj.status}</span></div>);})}
        </div>):(<div style={{background:C.s1,borderRadius:14,padding:"14px",border:"1px solid "+C.g+"30",textAlign:"center"}}><span style={{fontSize:12,color:C.g,fontWeight:600}}>Aucune blessure</span></div>)}
      {/* Comptes rendus de séances */}
      {Object.keys(sessionLogs).filter(k=>sessionLogs[k]?.note||sessionLogs[k]?.forme).length>0&&(()=>{
        const logs=Object.entries(sessionLogs).filter(([,l])=>l?.note||l?.forme).sort((a,b)=>(b[1].date||"")>(a[1].date||"")?1:-1).slice(0,10);
        return(<div style={{background:C.s1,borderRadius:14,padding:14,border:"1px solid "+C.brd,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Comptes rendus de séances</div>
          {logs.map(([key,log])=>{
            const parts=key.split("_");const wkNum=parts[parts.length-1];const sessId=parts.slice(0,-1).join("_");
            const sess=sessions.find(s=>s.id===sessId);
            return(<div key={key} style={{padding:"8px 10px",borderRadius:8,background:C.s2,marginBottom:6,border:"1px solid "+C.brd}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:log.note?4:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.ac}}>{sess?.name||sessId}</span>
                  <span style={{fontSize:9,color:C.tx3,padding:"1px 6px",borderRadius:4,background:C.acS}}>S{wkNum}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {log.forme&&<span style={{fontSize:10,fontWeight:600,color:log.forme>=4?C.g:log.forme>=3?C.o:C.r}}>Forme {log.forme}/5</span>}
                  {log.duration&&<span style={{fontSize:10,color:C.tx3}}>{fmtTime(log.duration)}</span>}
                  {log.date&&<span style={{fontSize:9,color:C.tx3}}>{new Date(log.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}</span>}
                </div>
              </div>
              {log.note&&<div style={{fontSize:11,color:C.tx2,lineHeight:1.5,fontStyle:"italic"}}>"{log.note}"</div>}
            </div>);
          })}
        </div>);
      })()}
      </>)}
      {coachTab==="data"&&(<><div style={{padding:"16px 16px 0"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Profil athlète</div>
        <div style={{fontSize:12,color:C.tx2,marginBottom:12}}>Informations personnelles</div>
        <div style={{padding:'12px 14px',borderRadius:12,background:C.s1,border:`1px solid ${C.brd}`,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div><div style={{fontSize:13,fontWeight:700,color:C.tx}}>Tracker d'habitudes</div><div style={{fontSize:11,color:habitToggleErr?C.r:C.tx3,marginTop:2}}>{habitToggleErr||"Activer le suivi d'habitudes pour cet athlète"}</div></div>
          <button disabled={habitToggling} onClick={async()=>{setHabitToggling(true);setHabitToggleErr('');const ne=!habitEnabled;setHabitEnabled(ne);const{error}=await supabase.from('profiles').update({habit_tracker_enabled:ne}).eq('id',athleteId);if(error){setHabitEnabled(!ne);setHabitToggleErr('Erreur : migration SQL non appliquée ?');console.error('habit toggle:',error);}setHabitToggling(false);}} style={{width:46,height:26,borderRadius:13,background:habitEnabled?C.g:C.s2,border:`2px solid ${habitEnabled?C.g:C.brdL}`,cursor:habitToggling?'default':'pointer',position:'relative',transition:'all 0.2s',flexShrink:0,outline:'none',opacity:habitToggling?0.6:1}}>
            <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:habitEnabled?24:2,transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
          </button>
        </div>
        {athleteProfile?(
          <div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brd,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid "+C.brd}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:C.coach+"25",border:"2px solid "+C.coach+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:C.coach,flexShrink:0}}>
                {([athleteProfile.first_name,athleteProfile.last_name].filter(Boolean).join(" ")||athleteProfile.full_name||"?").split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.tx}}>{[athleteProfile.first_name,athleteProfile.last_name].filter(Boolean).join(" ")||athleteProfile.full_name}</div>
                <div style={{fontSize:11,color:C.tx3}}>{athleteProfile.gender==="male"?"Homme":athleteProfile.gender==="female"?"Femme":"Genre non renseigné"}</div>
              </div>
              {onEditProfile&&<button onClick={onEditProfile} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+C.coach+"50",background:C.coachS,color:C.coach,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✎ Modifier</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:C.brd}}>
              {[{l:"Âge",v:athleteProfile.age?athleteProfile.age+" ans":null},{l:"Taille",v:athleteProfile.height_cm?athleteProfile.height_cm+" cm":null},{l:"MB",v:athleteProfile.base_metabolism?athleteProfile.base_metabolism.toLocaleString("fr-FR")+" kcal":null}].map(s=>(
                <div key={s.l} style={{background:C.s2,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{s.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:s.v?C.tx:C.tx3}}>{s.v||"—"}</div>
                </div>
              ))}
            </div>
            {athleteProfile.weight_kg||athleteProfile.body_fat_pct?(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:C.brd,borderTop:"1px solid "+C.brd}}>
                {[{l:"Poids réf.",v:athleteProfile.weight_kg?athleteProfile.weight_kg+" kg":null},{l:"Masse grasse",v:athleteProfile.body_fat_pct?athleteProfile.body_fat_pct+" %":null}].map(s=>(
                  <div key={s.l} style={{background:C.s2,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{s.l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:s.v?C.tx:C.tx3}}>{s.v||"—"}</div>
                  </div>
                ))}
              </div>
            ):null}
          </div>
        ):(
          <div style={{background:C.s1,borderRadius:14,padding:"16px",border:"1px solid "+C.brd,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,color:C.tx3}}>Profil non renseigné</div>
            {onEditProfile&&<button onClick={onEditProfile} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+C.coach+"50",background:C.coachS,color:C.coach,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✎ Créer le profil</button>}
          </div>
        )}
        {/* ── Stratégie alimentaire ── */}
        <div style={{fontSize:16,fontWeight:700,marginBottom:4,marginTop:4}}>Stratégie alimentaire</div>
        <div style={{fontSize:12,color:C.tx2,marginBottom:12}}>Plan nutritionnel défini</div>
        {nutritionStrategy?(()=>{
          const ns=nutritionStrategy;
          const SC={maintenance:C.b,seche:C.r,prise_de_masse:C.g};
          const SL={maintenance:"Maintenance",seche:"Sèche",prise_de_masse:"Prise de masse"};
          const sc=SC[ns.strategy]||C.ac;
          const sl=SL[ns.strategy]||ns.strategy;
          const theorKcal=((ns.macros_glucides||0)*4)+((ns.macros_lipides||0)*9)+((ns.macros_proteines||0)*4);
          const NAP_L={1.2:"Sédentaire",1.375:"Légère",1.55:"Modérée",1.725:"Intense",1.9:"Très intense"};
          return(<div style={{background:C.s1,borderRadius:14,border:"1px solid "+C.brd,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+C.brd}}>
              <span style={{fontSize:13,fontWeight:700,color:sc}}>{sl}</span>
              {ns.target_weight&&<span style={{fontSize:12,color:C.tx3}}>Cible : <span style={{color:C.ac,fontWeight:700}}>{ns.target_weight} kg</span></span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:C.brd}}>
              <div style={{background:C.s2,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>Calories cibles</div>
                <div style={{fontSize:16,fontWeight:800,color:C.o}}>{ns.total_calories_coach?ns.total_calories_coach.toLocaleString("fr-FR")+"  kcal":"—"}</div>
                {ns.nap&&<div style={{fontSize:10,color:C.tx3,marginTop:2}}>NAP {NAP_L[ns.nap]||ns.nap} (×{ns.nap})</div>}
              </div>
              <div style={{background:C.s2,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>
                  {ns.strategy==="seche"?"Déficit cible":ns.strategy==="prise_de_masse"?"Surplus cible":"Tolérance"}
                </div>
                {ns.surplus_deficit_min!=null&&ns.surplus_deficit_max!=null?(
                  <div style={{fontSize:16,fontWeight:800,color:sc}}>
                    {ns.strategy==="seche"?Math.abs(ns.surplus_deficit_min)+"%":ns.strategy==="prise_de_masse"?"+"+ns.surplus_deficit_max+"%":"±"+ns.surplus_deficit_max+"%"}
                  </div>
                ):<div style={{fontSize:13,color:C.tx3}}>—</div>}
              </div>
            </div>
            {(ns.macros_glucides||ns.macros_lipides||ns.macros_proteines||ns.macros_glucides_pct||ns.macros_lipides_pct||ns.macros_proteines_pct)&&(
              <div style={{padding:"10px 16px",borderTop:"1px solid "+C.brd}}>
                <div style={{fontSize:9,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Macros cibles</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {[{label:"Glucides",pct:ns.macros_glucides_pct,g:ns.macros_glucides,color:C.b},{label:"Lipides",pct:ns.macros_lipides_pct,g:ns.macros_lipides,color:C.o},{label:"Protéines",pct:ns.macros_proteines_pct,g:ns.macros_proteines,color:C.g}].map(m=>(
                    <div key={m.label} style={{background:C.s2,borderRadius:8,padding:"8px",textAlign:"center",border:"1px solid "+m.color+"20"}}>
                      <div style={{fontSize:9,color:m.color,fontWeight:700,marginBottom:3}}>{m.label}</div>
                      {m.pct!=null&&<div style={{fontSize:18,fontWeight:900,color:m.color,lineHeight:1}}>{m.pct}<span style={{fontSize:10}}>%</span></div>}
                      {m.g!=null&&<div style={{fontSize:12,fontWeight:600,color:C.tx2,marginTop:1}}>{m.g} g</div>}
                      {m.pct==null&&m.g==null&&<div style={{fontSize:12,color:C.tx3}}>—</div>}
                    </div>
                  ))}
                </div>
                {theorKcal>0&&<div style={{marginTop:8,fontSize:11,color:C.tx3,textAlign:"right"}}>Total macros : <span style={{fontWeight:700,color:C.tx}}>{theorKcal} kcal</span></div>}
              </div>
            )}
            <div style={{padding:"8px 16px",borderTop:"1px solid "+C.brd,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:C.tx3}}>{
                (ns.calorie_mode||"nap")==="active"?"Mode : BMR + calories actives (athlète)":
                (ns.calorie_mode||"nap")==="hybrid"?"Mode : Hybride (NAP ou actives)":
                "Mode : BMR × NAP (calories fixes)"
              }</span>
              {onEditProfile&&<button onClick={onEditProfile} style={{padding:"4px 12px",borderRadius:7,border:"1px solid "+C.coach+"50",background:C.coachS,color:C.coach,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Modifier</button>}
            </div>
          </div>);
        })():(
          <div style={{background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.brd,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,color:C.tx3}}>Aucune stratégie définie</div>
            {onEditProfile&&<button onClick={onEditProfile} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+C.coach+"50",background:C.coachS,color:C.coach,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Définir</button>}
          </div>
        )}
        {/* Performances sportives de l'athlète */}
        <div style={{marginBottom:20}}>
          <PerformanceProfile athleteId={athleteId} viewOnly={false} isCoach={true} C={C}/>
        </div>
        {/* Notifications de validation des performances */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Validations de performances</div>
          <CoachPerfNotification coachId={athleteId} C={C}/>
        </div>
        {/* Gestion du bloc */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Gestion du bloc</div>
          <div style={{fontSize:12,color:C.tx2,marginBottom:12}}>Annulation de séances et historique</div>
          <CoachConfig completedSessions={completedSessions} uncompleteSession={uncompleteSession} sessions={sessions} weeksArr={weeksArr} onNewBlock={()=>setShowNewBlock(true)} onShowHistory={()=>setShowBlockHistory(true)} blockHistoryCount={blockHistory.length}/>
        </div>
        {/* Avis sur l'app */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Avis sur l'app</div>
          <div style={{fontSize:12,color:C.tx2,marginBottom:12}}>Retours de cet athlète sur l'application</div>
          {appFeedbacks.length===0?(<div style={{background:C.s1,borderRadius:12,padding:"14px 16px",border:"1px solid "+C.brd,fontSize:12,color:C.tx3}}>Aucun avis envoyé pour l'instant</div>):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...appFeedbacks].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(fb=>{
                const sc=fb.rating>=4?C.g:fb.rating>=3?C.o:C.r;
                return(<div key={fb.id} style={{background:C.s1,borderRadius:12,padding:"12px 14px",border:"1px solid "+C.brd}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:fb.text?8:0}}>
                    <div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:14,opacity:n<=fb.rating?1:0.2}}>⭐</span>)}</div>
                    <span style={{fontSize:10,color:C.tx3}}>{new Date(fb.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>
                  </div>
                  {fb.text&&<div style={{fontSize:12,color:C.tx2,lineHeight:1.55,fontStyle:"italic"}}>"{fb.text}"</div>}
                </div>);
              })}
            </div>
          )}
        </div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Gestion des données</div>
        <div style={{fontSize:12,color:C.tx2,marginBottom:16}}>Supprimer sélectivement des données</div>
      </div>
      <DataManager
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
      /></>)}
      {coachTab==="test"&&<TestSessionView athleteId={athleteId} viewOnly={viewOnly} C={C} testSubTab={testSubTab} setTestSubTab={setTestSubTab} isCoach={true}/>}
      {coachTab==="retours"&&<CoachWeeklyFeedback athleteId={athleteId} sessions={sessions} completedSessions={completedSessions} energySessions={energySessions} currentWeek={currentWeek} blockConfig={blockConfig} exos={exos} sets={sets} wellnessHistory={wellnessHistory} C={C}/>}
    </div>)}

    {mode==="athlete"&&tab!=="log"&&(()=>{const lsA=(()=>{try{const d=JSON.parse(localStorage.getItem('mpp:sess_start')||'null');if(d?.sid&&d?.wk){const s=sessions.find(x=>x.id===d.sid);return s?{...d,name:s.name}:null;}return null;}catch{return null;}})();const lsF=(()=>{try{const d=JSON.parse(localStorage.getItem('mpp:free_start')||'null');if(d?.id){const f=(freeSessions||[]).find(x=>x.id===d.id);return f&&!f.completed?{...d,name:f.name}:null;}return null;}catch{return null;}})();if(!lsA&&!lsF)return null;const active=lsA||lsF;return(<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:300,maxWidth:360,width:"calc(100% - 32px)"}}>
      <button onClick={()=>setTab("log")} style={{width:"100%",padding:"12px 16px",borderRadius:16,border:"none",background:C.ac,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:10,justifyContent:"center",boxShadow:"0 4px 24px rgba(123,111,255,0.45)"}}>
        <span style={{fontSize:16}}>▶</span><span>Reprendre — {active.name}</span>
      </button>
    </div>);})()}
    {mode==="athlete"&&(<>
      {tab==="dash"&&(<div style={{padding:"16px 16px 40px"}}>
        <div style={{marginBottom:18}}><div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}>Bonjour</div>{sessions.length>0?<div style={{fontSize:12,color:C.tx2,marginTop:2}}>{blockConfig?.blockName||"Programme"} · S{currentWeek}/{tw}{isDeload(currentWeek)?" (Deload)":""}</div>:<div style={{fontSize:12,color:C.tx3,marginTop:2}}>Aucun bloc actif</div>}</div>
        {activeInjuries.length>0&&(<button onClick={()=>setTab("stats")} style={{width:"100%",background:C.rS,borderRadius:14,padding:"10px 14px",border:"1.5px solid "+C.r+"50",marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",background:C.r,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:C.r}}>{activeInjuries.length} blessure(s) en cours</div><div style={{fontSize:10,color:C.r+"90"}}>{activeInjuries.map(i=>ALL_BZ.filter(z=>i.zones.includes(z.id)).map(z=>z.label).join(", ")||"Zone non precisee").join(" | ")}</div></div><span style={{fontSize:12,color:C.r}}>&gt;</span></button>)}
        <button onClick={()=>{if(!viewOnly)setShowWellness(true);}} style={{width:"100%",background:C.s1,borderRadius:16,padding:"14px 16px",border:"1.5px solid "+wReco.c+"35",marginBottom:12,cursor:viewOnly?"default":"pointer",fontFamily:"inherit",textAlign:"left",display:"block"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Wellness du jour</div>{!viewOnly&&<div style={{fontSize:10,color:C.ac,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.ac+"40",fontWeight:600}}>{wellness?"Modifier":"Remplir"} &gt;</div>}</div>
          {wellness?(<div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{position:"relative",width:64,height:64,flexShrink:0}}><svg viewBox="0 0 64 64" style={{width:64,height:64,transform:"rotate(-90deg)"}}><circle cx="32" cy="32" r="26" fill="none" stroke={C.s2} strokeWidth="5"/><circle cx="32" cy="32" r="26" fill="none" stroke={wReco.c} strokeWidth="5" strokeDasharray={String(2*Math.PI*26)} strokeDashoffset={String(2*Math.PI*26*(1-wScore/100))} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:wReco.c}}>{wScore}</div></div>
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:wReco.c,marginBottom:4}}>{wReco.label}</div><div style={{fontSize:11,color:C.tx2}}>{wReco.desc}</div>
              <div style={{display:"flex",gap:8,marginTop:8}}>{WELL_ITEMS.map(it=>{const v=wellness[it.k];const vc=it.inv?(v>=4?C.r:v<=2?C.g:C.o):(v>=4?C.g:v<=2?C.r:C.o);return(<div key={it.k} style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:vc}}>{v}</div><div style={{fontSize:8,color:C.tx3}}>{it.k.slice(0,4)}</div></div>);})}{wellness.sleepDur&&<div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.b}}>{wellness.sleepDur}h</div><div style={{fontSize:8,color:C.tx3}}>som.</div></div>}{wellness.poids&&<div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.ac}}>{wellness.poids}</div><div style={{fontSize:8,color:C.tx3}}>kg</div></div>}</div>
              {wellness.domsZones?.length>0&&<div style={{display:"flex",gap:3,marginTop:6,flexWrap:"wrap"}}>{wellness.domsZones.map(id=>{const z=ALL_BZ.find(z=>z.id===id);return z?<span key={id} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.o+"20",color:C.o}}>{z.label}</span>:null;})}</div>}
            </div>
          </div>):<div style={{fontSize:12,color:C.tx3,textAlign:"center",padding:"10px 0"}}>Appuyez pour remplir le bilan</div>}
        </button>
        <WeekCalendar sessions={sessions} completedSessions={completedSessions} currentWeek={currentWeek} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} C={C} wellnessHistory={wellnessHistory} weightLog={weightLog} sessionLogs={sessionLogs} nutritionLog={nutritionLog} exos={exos} energySessions={energySessions} energyWeekPlan={energyWeekPlan} energyDayPlan={energyDayPlan}/>
        {nutritionStrategy&&(()=>{const todayISO=new Date().toISOString().slice(0,10);const todayNL=nutritionLog[todayISO]||null;const strat=nutritionStrategy;const consumed=todayNL?.total_calories_consumed||null;const bmrV=athleteProfile?.base_metabolism||0;const targetCal=strat.can_track_calories?(bmrV+(todayNL?.active_calories||0)):strat.total_calories_coach||null;const stratC=strat.strategy==="seche"?C.r:strat.strategy==="prise_de_masse"?C.g:C.b;const stratL=strat.strategy==="seche"?"Sèche":strat.strategy==="prise_de_masse"?"Prise":"Maintenance";
          const surplusPct=(consumed&&targetCal&&targetCal>0)?((consumed-targetCal)/targetCal)*100:null;
          const inRange=surplusPct!==null&&strat.surplus_deficit_min!=null&&strat.surplus_deficit_max!=null&&surplusPct>=strat.surplus_deficit_min&&surplusPct<=strat.surplus_deficit_max;
          const feedbackC=surplusPct===null?null:inRange?C.g:C.o;
          const feedbackMsg=surplusPct===null?null:inRange?"✅ Dans la fourchette aujourd'hui":"⚠️ "+(surplusPct>0?"+":"")+surplusPct.toFixed(1)+"% — objectif "+strat.surplus_deficit_min+"% à "+strat.surplus_deficit_max+"%";
          return(<div style={{background:C.s1,borderRadius:14,padding:"11px 16px",border:"1px solid "+(feedbackC?feedbackC+"40":C.brd),marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:consumed?8:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontSize:11,fontWeight:600,color:C.tx3,textTransform:"uppercase",letterSpacing:"0.5px"}}>Alimentation</div>
                <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,background:stratC+"18",color:stratC}}>{stratL}</span>
              </div>
              <button onClick={()=>setTab("alim")} style={{fontSize:10,color:C.ac,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Détail →</button>
            </div>
            {!consumed?(<div style={{fontSize:11,color:C.tx3}}>Aucune saisie aujourd'hui</div>):(
              <>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:feedbackMsg?8:0}}>
                  <div><span style={{fontSize:20,fontWeight:800,color:feedbackC||stratC}}>{consumed}</span>{targetCal&&<span style={{fontSize:10,color:C.tx3}}> / {targetCal} kcal</span>}</div>
                  <div style={{display:"flex",gap:10,marginLeft:"auto"}}>{[{l:"G",v:todayNL?.glucides_consumed,c:C.b},{l:"L",v:todayNL?.lipides_consumed,c:C.o},{l:"P",v:todayNL?.proteines_consumed,c:C.g}].map(macro=>(<div key={macro.l} style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:macro.c}}>{macro.v??"—"}</div><div style={{fontSize:9,color:C.tx3}}>{macro.l} (g)</div></div>))}</div>
                </div>
                {feedbackMsg&&<div style={{fontSize:11,fontWeight:600,color:feedbackC,padding:"5px 10px",borderRadius:7,background:feedbackC+"12"}}>{feedbackMsg}</div>}
              </>
            )}
          </div>);})()}
        <div style={{marginBottom:12}}>
        {(()=>{
          const todayDow=(new Date().getDay()+6)%7;
          const doneNow=completedSessions[currentWeek]||[];
          const todaySessions=sessions.filter(s=>s.day_of_week===todayDow&&(exos[s.id]||[]).length>0);
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
        {habitEnabled&&<HabitDashboard habits={habits} setHabits={setHabits} habitLogs={habitLogs} onToggle={toggleHabitLog} viewOnly={viewOnly} athleteId={athleteId}/>}
      </div>)}

      {tab==="log"&&(<>
        {/* Sous-onglets Séance */}
        <div style={{display:"flex",borderBottom:"1px solid "+C.brd,background:C.bg,paddingLeft:16,paddingRight:16,gap:0}}>
          {[{k:"muscu",l:"Musculation"},{k:"energie",l:"Énergétique"},{k:"specifique",l:"Spécifique"}].map(t=>(
            <button key={t.k} onClick={()=>setLogSubTab(t.k)} style={{padding:"10px 14px",border:"none",borderBottom:"2px solid "+(logSubTab===t.k?C.ac:"transparent"),background:"transparent",color:logSubTab===t.k?C.ac:C.tx3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.3px",flexShrink:0}}>{t.l}</button>
          ))}
        </div>
        {logSubTab==="muscu"&&<LogView exos={exos} sets={sets} updSets={updSets} completedSessions={completedSessions} completeSession={completeSession} uncompleteSession={uncompleteSession} goals={goals} weeklyTarget={weeklyTarget} currentWeek={currentWeek} allMethods={allMethods} athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes} sessions={sessions} blockConfig={blockConfig} initialSess={initialLogSess} timerLeft={timerLeft} timerDur={timerDur} timerActive={timerActive} timerFinished={timerFinished} onTimerSetDur={timerSetDur} onTimerStart={timerStart} onTimerStop={timerStop} viewOnly={viewOnly} sessionLogs={sessionLogs} setSessionLogs={setSessionLogs} freeSessions={freeSessions} setFreeSessions={setFreeSessions} onAddExercise={(sessId,ex)=>setExos(prev=>({...prev,[sessId]:[...(prev[sessId]||[]),ex]}))} weekSchedule={weekSchedule}/>}
        {logSubTab==="energie"&&<EnergySessionLog athleteId={athleteId} viewOnly={viewOnly} C={C}/>}
        {logSubTab==="specifique"&&(<div style={{padding:"40px 20px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>⚡</div><div style={{fontSize:15,fontWeight:700,color:C.tx,marginBottom:6}}>Séances Spécifiques</div><div style={{fontSize:13,color:C.tx3}}>Cette fonctionnalité sera disponible prochainement.</div></div>)}
      </>)}


      {tab==="alim"&&<NutritionView athleteId={athleteId} bmr={athleteProfile?.base_metabolism||null} nutritionStrategy={nutritionStrategy} onLogSaved={(date,log)=>{const updated={...nutritionLog,[date]:log};setNutritionLogState(updated);save("asp:nutrition_log",updated).catch(()=>{});}} viewOnly={viewOnly}/>}

      {tab==="test"&&<TestSessionView athleteId={athleteId} viewOnly={viewOnly} C={C} testSubTab={testSubTab} setTestSubTab={setTestSubTab}/>}

      {tab==="retours"&&<RetoursView/>}

      {tab==="coachfeedback"&&(<div style={{padding:"16px 16px 40px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setTab("dash")} style={{width:32,height:32,borderRadius:8,border:"1px solid "+C.brdL,background:"transparent",color:C.tx2,fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
          <div style={{fontSize:16,fontWeight:700}}>Retours du coach</div>
        </div>
        {(()=>{
          const weeks=Object.keys(coachFeedbacks).map(Number).filter(Boolean).sort((a,b)=>b-a);
          if(weeks.length===0)return(<div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:32,marginBottom:12}}>💬</div><div style={{fontSize:14,color:C.tx3}}>Aucun retour du coach pour l'instant.</div></div>);
          return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
            {weeks.map(wk=>{
              const fb=coachFeedbacks[wk];
              if(!fb?.note)return null;
              return(<div key={wk} style={{background:C.s1,borderRadius:14,padding:"14px 16px",border:"1px solid "+C.coach+"30"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.coach,textTransform:"uppercase",letterSpacing:"0.5px"}}>Semaine {wk}</div>
                  {fb.date&&<div style={{fontSize:10,color:C.tx3}}>{new Date(fb.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}</div>}
                </div>
                <div style={{fontSize:13,color:C.tx,lineHeight:1.6,fontStyle:"italic"}}>"{fb.note}"</div>
                {fb.rating&&<div style={{marginTop:8,display:"flex",gap:2}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:14,opacity:n<=fb.rating?1:0.2}}>⭐</span>)}</div>}
              </div>);
            })}
          </div>);
        })()}
      </div>)}

    </>)}

  </div>);
}