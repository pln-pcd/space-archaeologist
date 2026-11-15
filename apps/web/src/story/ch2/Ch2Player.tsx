import { stampThunk } from "../../odyssey/fx/juice";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SCENES, useCh2, startScene, next, beat, line, voice, type MarsScene } from "../ch2-mars";
import { useInput } from "../../input/store";
import { useStore, explorerName } from "../../store";
import { useJudge } from "../../judge/judge";
import { swirlCover, swirlReveal } from "../../fx/Swirl";
import { play } from "../../audio/sfx";
import { ambience } from "../../audio/ambience";
import { motion } from "../../anim/kit";
import { SceneVideo } from "../ch1/scenes";
import CheckIn from "../../odyssey/screens/CheckIn";
import { HandsOn } from "../ch1/CameraCheck";
import SceneLaunch from "../ch1/SceneLaunch";
import { StampOpportunity } from "../../ui/stamps";
import { useIntent, useIntentScope } from "../../input/bus";
import { Home, Star } from "lucide-react";
import HandTraining from "../../odyssey/hands/HandTraining";
import { useTheme } from "../../audio/themes";
import { useWarpReady } from "../../odyssey/fx/Warp";
import { MarsLaunchWorld } from "./models";
import "../ch1/ch1.css";
import "./mars-ending.css";
const Film=lazy(()=>import("./Scenes").then(m=>({default:m.MarsSequence})));
const SolKeeper=lazy(()=>import("./SolKeeper"));
const StoryFilm=lazy(()=>import("../odyssey/StoryFilm"));
const MarsStoryWorld=lazy(()=>import("../odyssey/MarsStory").then(m=>({default:m.MarsStoryWorld})));
import { CH2_STORY } from "../odyssey/storyline";
// v7.2: hands stay on once the explorer turns them on (Hand Training); nothing to reset here
const resetHands=()=>{};

export default function Ch2Player({ startIndex=0,onClose }: {startIndex?:number;onClose:(done?:boolean)=>void}) {
  const {scene,camera,result}=useCh2();
  const handMode=useInput(s=>s.mode==="gloves");
  const judge=useJudge(s=>s.on), transitioning=useRef(false);
  useWarpReady();
  // films and the NASA video bring their own sound; the mini-game gets the bouncy game song
  useTheme(scene==="C_CRUISE_AND_LANDING"||scene==="D_ROLL_OFF"||scene==="E_STORY"||scene==="A_VIDEO"?null:scene==="G_MINIGAME"?"game":"explore");
  useEffect(()=>{useCh2.getState().go(startScene(startIndex));void voice.load();ambience.set("mars");return()=>{resetHands();ambience.set(null);};},[]);
  const go=useCallback(async(s:MarsScene,done=false)=>{
    if(transitioning.current)return;transitioning.current=true;
    if(s!=="G_MINIGAME"&&s!=="G_CAMERA_CHECK")resetHands();
    await swirlCover(motion.reduced?.25:.55);
    if(s==="BACK_TO_SHIP"){onClose(done);void swirlReveal(motion.reduced?.3:.8);return;}
    useCh2.getState().go(s);transitioning.current=false;await swirlReveal(motion.reduced?.3:.8);
  },[onClose]);
  const advance=useCallback(()=>void go(next(useCh2.getState().scene)),[go]);
  useEffect(()=>{if(scene!=="G_MINIGAME"&&scene!=="G_CAMERA_CHECK")resetHands();document.body.classList.toggle("ch1-own-camera",scene.startsWith("G_"));return()=>document.body.classList.remove("ch1-own-camera");},[scene]);
  const finish=()=>{const st=useStore.getState();st.complete("opportunity","stamp");st.score("opportunity",result?.stars??1);st.page("opportunity",0);void go("BACK_TO_SHIP",true);};
  return <div className="chapter ch1-player ch2-player mars-ending" data-scene={scene}>
    {scene.startsWith("G_")&&(camera||handMode)&&<HandsOn />}
    <div className="g-hud-tl"><button type="button" className="g-icon-btn" onClick={()=>void go("BACK_TO_SHIP")} aria-label="Back to the ship"><Home size={26} strokeWidth={2.6}/><span>Ship</span></button></div>
    <header className="ch1-hud ch2-hud-v72">
      {!scene.startsWith("G_")&&<div className="ch2-chip g-chip"><small>Chapter 2 · Opportunity</small><strong>{scene==="A_VIDEO"?"The plan for Mars":scene==="B_LAUNCH"?"A night launch":scene==="C_CRUISE_AND_LANDING"?"A soft landing":scene==="D_ROLL_OFF"?"Opening like a flower":scene==="E_STORY"?"One more hill":scene==="F_CHECKIN"?"Talk with Nova":"Your Mars mission"}</strong></div>}
      {judge&&<details className="mars-judge paper-card"><summary>Scenes</summary>{SCENES.slice(0,10).map((s,i)=><button className="chunky" key={s} onClick={()=>void go(s)}>{i<7?"ABCDEFG"[i]:s==="G_MINIGAME"?"Play":s==="RESULTS"?"Results":"Stamp"}</button>)}</details>}
    </header>
    <Suspense fallback={<div className="ch1-loading">Turning the page…</div>}>
      {scene==="A_VIDEO"&&<SceneVideo video={beat("A").video!} title="NASA's plan · June 2003" turn="m-turn" speak={voice.say} resolve={voice.caption} muted onDone={advance}/>}
      {scene==="B_LAUNCH"&&<SceneLaunch onDone={advance} mars={{World:MarsLaunchWorld,resolve:line,speak:voice.say}} />}
      {scene==="C_CRUISE_AND_LANDING"&&<Film part="C" onDone={advance} />}
      {scene==="D_ROLL_OFF"&&<Film part="D" onDone={advance} />}
      {scene==="E_STORY"&&<StoryFilm story={CH2_STORY} World={MarsStoryWorld} voiceDir="ch2" resolve={line} onDone={advance} />}
      {scene==="F_CHECKIN"&&<CheckIn mission="opportunity" backdrop="/media/ch2/story-last.jpg" onPlay={advance} onStory={()=>void go("E_STORY")} />}
      {scene==="G_CAMERA_CHECK"&&<HandTraining onClose={()=>{const on=useInput.getState().mode==="gloves";useCh2.getState().set({camera:on});advance();}} />}
      {scene==="G_MINIGAME"&&<SolKeeper camera={camera} onDone={r=>{useCh2.getState().set({result:r,camera:false});resetHands();void go("RESULTS");}} />}
      {scene==="RESULTS"&&<div className="mars-center"><div className="g-panel mars-results v72"><h2>Well done, {explorerName(useStore.getState().profile)}!</h2><p className="mars-stars" aria-label={`${result?.stars??1} of 3 stars`}>{[0,1,2].map(i=><Star key={i} size={46} strokeWidth={2.4} fill={i<(result?.stars??1)?"#FFD23F":"#ECE8FF"} color="#241D48"/>)}</p><p>{result?.sols??0} sols · {result?.blueberries??0} blueberries · {result?.events??0} cleaning events</p><span className="od-badge true">True story</span><p>{line("m-longer").text}</p><div className="mars-buttons"><button type="button" className="g-btn" onClick={()=>void go("G_MINIGAME")}>Play again</button><button type="button" className="g-btn primary big" onClick={()=>void go("STAMP")}>Stamp my passport</button></div></div></div>}
      {scene==="STAMP"&&<MarsStamp onDone={finish} />}
    </Suspense>
  </div>;
}
function MarsStamp({onDone}:{onDone:()=>void}){
  const [stamped,setStamped]=useState(false), timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const stamp=()=>{if(stamped)return;setStamped(true);play("stampSlam",1,.5);stampThunk();timer.current=setTimeout(onDone,1200);};
  useIntentScope(["thumbsUp","fistStamp"],{},"mars-stamp");useIntent("thumbsUp",stamp);useIntent("fistStamp",stamp);useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div className="mars-center"><div className="g-panel mars-results v72"><h2>Stamp your passport</h2><button className={`ch1-stamp-pad ${stamped?"stamped":""}`} onClick={stamp} aria-label="Stamp the passport">{stamped?<StampOpportunity size={160}/>:"Tap, click or press Enter"}</button></div></div>;
}
