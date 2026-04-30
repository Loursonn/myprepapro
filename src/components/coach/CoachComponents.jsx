import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { C } from "@/lib/theme";
import { DEF_TIER_CONFIG } from "@/lib/exercises";
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
  // Utilise s.id (UUID Supabase) comme clé principale du plan — plus stable que session_key
  const toggleSessionInWeek=(w,sid)=>{const cur=weekPlan[w]||[];const next=cur.includes(sid)?cur.filter(k=>k!==sid):[...cur,sid];const plan={...weekPlan,[w]:next};setWeekPlan(plan);saveWeekPlan(plan);};
  const setSessionDay=(w,sid,day)=>{const wDays={...(dayPlan[w]||{}),[sid]:day===null?undefined:day};const plan={...dayPlan,[w]:wDays};setDayPlan(plan);saveDayPlan(plan);};

  const handleCreate=async()=>{
    if(!newLabel.trim())return;
    const key="energy_"+Date.now();
    const{data,error}=await supabase.from("energy_session_config").insert({athlete_id:athleteId,session_key:key,session_label:newLabel.trim(),appareil_types:[],custom_appareils:[],blocks:[],created_by:athleteId}).select("id,session_key,session_label").single();
    if(!error&&data){setEnergySessionsLoaded(false);setEnergyEditorKey({key:data.session_key,label:data.session_label});}
    setCreating(false);setNewLabel("");
  };
  const handleDelete=async(s,e)=>{
    e.stopPropagation();
    if(!window.confirm("Supprimer cette séance énergétique ?"))return;
    const sid=s.id||s.session_key;
    await supabase.from("energy_session_config").delete().eq("athlete_id",athleteId).eq("session_key",s.session_key);
    // Nettoie le plan par UUID ET session_key pour rétrocompat
    const newPlan={};Object.entries(weekPlan).forEach(([w,keys])=>{newPlan[w]=keys.filter(k=>k!==sid&&k!==s.session_key);});setWeekPlan(newPlan);saveWeekPlan(newPlan);
    const newDayPlan={};Object.entries(dayPlan).forEach(([w,d])=>{const nd={...d};delete nd[sid];delete nd[s.session_key];newDayPlan[w]=nd;});setDayPlan(newDayPlan);saveDayPlan(newDayPlan);
    setEnergySessionsLoaded(false);
  };
  if(energyEditorKey){
    return(<EnergySessionEditor athleteId={athleteId} sessionKey={energyEditorKey.key} sessionLabel={energyEditorKey.label} onClose={()=>{setEnergyEditorKey(null);setEnergySessionsLoaded(false);}} C={C}/>);
  }

  const weekKeys=weekPlan[selWeek]||[];
  // Cherche par s.id (UUID) en priorité, puis fallback sur session_key pour rétrocompat
  const weekSessions=weekKeys.map(k=>energySessions.find(s=>s.id===k||s.session_key===k)).filter(Boolean);

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
            {weekSessions.map(s=>{const sid=s.id||s.session_key;const appareilStr=(s.appareil_types||[]).join(", ")||"";return(<div key={sid} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:C.s2,border:"1px solid "+C.coach+"30"}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.coach+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⚡</div>
              <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setEnergyEditorKey({key:s.session_key,label:s.session_label||s.session_key})}>
                <div style={{fontSize:12,fontWeight:700,color:C.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.session_label||s.session_key}</div>
                {appareilStr&&<div style={{fontSize:9,color:C.tx3}}>{appareilStr}</div>}
              </div>
              <button onClick={()=>toggleSessionInWeek(selWeek,sid)} title="Retirer de cette semaine" style={{width:22,height:22,borderRadius:5,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
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
          const sid=s.id||s.session_key;
          const usedInWeeks=weeksArr.filter(w=>(weekPlan[w]||[]).some(k=>k===sid||k===s.session_key));
          return(<div key={sid} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid "+C.brdL,background:C.s1,marginBottom:8}}>
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
            <button onClick={e=>handleDelete(s,e)} style={{padding:"4px 8px",borderRadius:7,border:"1px solid "+C.r+"40",background:"transparent",color:C.r,fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Suppr.</button>
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
        {energySessions.map(s=>{const sid=s.id||s.session_key;const assigned=(weekPlan[selWeek]||[]).some(k=>k===sid||k===s.session_key);const sessDay=dayPlan[selWeek]?.[sid]??dayPlan[selWeek]?.[s.session_key]??null;const DAY_S=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];return(<div key={sid} style={{marginBottom:8,borderRadius:10,border:"1px solid "+(assigned?C.coach+"60":C.brdL),background:assigned?C.coach+"12":C.s2,overflow:"hidden"}}>
          <div onClick={()=>toggleSessionInWeek(selWeek,sid)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(assigned?C.coach:C.tx3),background:assigned?C.coach:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,flexShrink:0}}>{assigned?"✓":""}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:assigned?C.coach:C.tx}}>{s.session_label||s.session_key}</div>
              {(s.appareil_types||[]).length>0&&<div style={{fontSize:10,color:C.tx3}}>{(s.appareil_types||[]).join(", ")}</div>}
            </div>
          </div>
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
      {energyDone.map(s=><div key={s.id||s.session_key} style={{background:C.s1,borderRadius:12,border:"1px solid "+C.coach+"40",padding:"11px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
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


export { NewBlockModal, CoachEnergyProgram, CoachConfig, TierConfigModal, CoachWeeklyFeedback };
