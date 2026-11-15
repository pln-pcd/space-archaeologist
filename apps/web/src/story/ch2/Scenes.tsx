import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { beat, line, voice } from "../ch2-mars";
import { Caption, Controls, useSequence, type Clock, type Step } from "../ch1/ui";
import { Stage, newCam, type CamCtl, StillStars } from "../ch1/stage";
import { Flame } from "../ch1/props";
import { Body } from "../../odyssey/scene/bodies";
import { Airbags, MarsGround, Parachute, Rover } from "./models";
import { motion } from "../../anim/kit";
import { play } from "../../audio/sfx";

const LABEL: Record<string,string> = { cruise:"Cruise to Mars", heat:"Heat shield first", chute:"Parachute", drop:"Drop the heat shield", rope:"Lower on a rope", bags:"Airbags", rockets:"Rockets", cut:"Cut the rope!", hole:"A hole-in-one!", deflate:"Airbags pull back", petals:"Opening like a flower", unfold:"Unfolding", roll:"First wheel tracks" };
const clamp=(k:number)=>Math.max(0,Math.min(1,k));
type C=React.MutableRefObject<Clock>;
type Cam=React.MutableRefObject<CamCtl>;
export function MarsSequence({ part, onDone }: { part:"C"|"D"|"E"; onDone:()=>void }) {
  const steps=useMemo<Step[]>(()=>beat(part).lines.filter(l=>l.shot).map(l=>({id:l.shot!,line:l.id,min:part==="E"?9: l.shot==="cruise"?10: l.shot==="cut"?8:6})),[part]);
  const seq=useSequence(steps,onDone,true,voice.say);
  const cam=useRef(newCam({pos:[9,5.2,13],look:[0,1.3,0],fov:45}));
  useEffect(()=> { void voice.load(); },[]);
  useEffect(()=> {
    if(!import.meta.env.DEV)return;
    const api={seek:(i:number,t=0)=>{seq.seek(i,t);seq.clock.current.paused=true;},clock:seq.clock};
    (window as unknown as {__marsScene:unknown}).__marsScene=api;
    return()=>{ delete (window as unknown as {__marsScene?:unknown}).__marsScene; };
  },[seq.seek]);
  const shot=steps[seq.index]?.id??"crater";
  useEffect(()=>{if(shot==='roll')play('roverMotor',.8,.15);},[shot]);
  return <div className={`ch1-scene mars-film part-${part}`} data-shot={shot}>
    <Stage look="mars" cam={cam} sky={shot==="cruise"?"#1c2939":"#d7b58d"}><MarsTableau part={part} clock={seq.clock} steps={steps} cam={cam} /></Stage>
    {part!=="E" && <div className="mars-step paper-card" role="status">{LABEL[shot]}</div>}
    {shot==="hole" && <div className="mars-date paper-card">{line("m-date").text}</div>}
    <Caption id={seq.step?.line} resolve={voice.caption} />
    <Controls paused={seq.paused} onToggle={seq.toggle} onReplay={seq.replay} onSkip={seq.skip} />
    {part==="E" && <StoryOverlay shot={shot} t={seq.clock.current.t} />}
  </div>;
}

function MarsTableau({part,clock,steps,cam}:{part:string;clock:C;steps:Step[];cam:Cam}) {
  const capsule=useRef<THREE.Group>(null), chute=useRef<THREE.Group>(null), heat=useRef<THREE.Group>(null), tether=useRef<THREE.Group>(null);
  const bags=useRef<THREE.Group>(null), rover=useRef<THREE.Group>(null), lander=useRef<THREE.Group>(null), cruise=useRef<THREE.Group>(null);
  const ground=useRef<THREE.Group>(null), petals=useRef<(THREE.Group|null)[]>([]), fire=useRef(0);
  const mast=useRef<THREE.Group>(null), earth=useRef<THREE.Group>(null), mars=useRef<THREE.Group>(null);
  const storyGroup=useRef<THREE.Group>(null), crumbs=useRef<THREE.Group>(null), shore=useRef<THREE.Group>(null);
  const panelDust=useRef<THREE.MeshBasicMaterial>(null), newer=useRef<THREE.Group>(null), screens=useRef<THREE.Group>(null);
  const deploy=useRef(1),pan=useRef(0),wind=useRef<THREE.Group>(null);
  const cameraCtl=cam.current;
  useFrame(()=>{
    const c=clock.current, shot=steps[c.i]?.id, t=c.t, k=clamp(t/5), slow=motion.reduced?0:clamp(t/9);
    const landing=part==="C", opening=part==="D", story=part==="E";
    const inSpace=landing&&shot==="cruise";
    if(cruise.current)cruise.current.visible=inSpace;
    if(ground.current)ground.current.visible=!inSpace;
    if(earth.current)earth.current.scale.setScalar(1-clamp(t/10)*.75);
    if(mars.current)mars.current.scale.setScalar(.4+clamp(t/10)*.6);
    if(capsule.current){capsule.current.visible=landing&&!inSpace&&shot!=="hole";capsule.current.position.set(0,shot==="cut"? 1.5+Math.abs(Math.sin(t*1.6))*Math.max(0,3-t*.4):8,0);if(shot==="cut")capsule.current.position.x=motion.reduced?0:-5+Math.min(5,t*.65);}
    const n=steps.findIndex(s=>s.id===shot);
    if(chute.current)chute.current.visible=landing&&n>=2&&n<=6;
    if(heat.current){heat.current.visible=landing&&n<=3&&n>=1;heat.current.position.y=shot==="drop"?-k*5:0;}
    if(tether.current){tether.current.visible=landing&&n>=4&&n<=6;tether.current.scale.y=shot==="rope"?.2+.8*k:1;}
    if(bags.current){bags.current.visible=(landing&&n>=5)||(opening&&shot==="deflate");bags.current.scale.setScalar(opening?1-k*.75:shot==="bags"?.25+.75*k:1);}
    fire.current=shot==="rockets"?.45:0;
    if(lander.current)lander.current.visible=opening||(landing&&shot==="hole");
    petals.current.forEach(p=>{if(p)p.rotation.z=(opening&&shot==="petals"?1-k:opening&&["unfold","roll"].includes(shot)?0:1)*1.32;});
    if(rover.current){rover.current.visible=opening||story;rover.current.position.set(opening&&shot==="roll"?k*3.7:story&&["drive","marathon"].includes(shot)?slow*2:0,opening?.3*(shot==="roll"?1-k:1):0,0);if(story&&shot==="stuck")rover.current.position.y=-.16;}
    deploy.current=opening?(shot==="unfold"?k:shot==="roll"?1:0):1;
    pan.current=shot==="roll"?-.25+slow*.5:0;
    if(storyGroup.current)storyGroup.current.visible=story;
    if(crumbs.current)crumbs.current.visible=story&&["berries","water","shore"].includes(shot);
    if(shore.current){shore.current.visible=shot==="shore"||shot==="water";shore.current.position.x=motion.reduced?0:Math.sin(t*.4)*.2;}
    if(panelDust.current)panelDust.current.opacity=shot==="dust"?k*.8:shot==="wind"?(1-k)*.8:0;
    if(newer.current)newer.current.visible=shot==="perseverance";
    if(screens.current)screens.current.visible=shot==="signals";
    if(wind.current){wind.current.visible=shot==="wind"||shot==="storm";wind.current.children.forEach((p,i)=>{p.position.x=motion.reduced?i*.3-3:-4+(t*.7+i*.37)%8;});}
    let pos:[number,number,number]=[9-slow,5.2,13-slow],look:[number,number,number]=[0,1.3,0];
    if(inSpace){pos=[0,4,22];look=[0,0,0];}
    else if(landing&&shot!=="hole"){pos=[16,14,29];look=[0,11,0];if(shot==="cut"){pos=[13,6,21];look=[3,2,0];}}
    else if(story&&["berries","water"].includes(shot)){pos=[4,2.8,5];look=[2,.4,1.8];}
    else if(story&&shot==="endeavour"){pos=[5,7,19];look=[0,2,-12];}
    else if(story&&shot==="perseverance"){pos=[9,4,16];look=[4,1,-4];}
    else if(story&&shot==="signals"){pos=[7,5,12];look=[1,2,0];}
    cameraCtl.from={pos,look,fov:45};cameraCtl.to=cameraCtl.from;cameraCtl.k=1;
  });
  const storm=steps[clock.current.i]?.id==="storm"||steps[clock.current.i]?.id==="quiet";
  const shot=steps[clock.current.i]?.id;
  return <>
    <group ref={cruise}><fog attach="fog" args={["#253343",300,1000]} /><StillStars count={500} /><group ref={earth} position={[-8,0,0]}><Body kind="earth" radius={4} spin={0.05} tilt={0.41} /></group><group ref={mars} position={[8,0,-3]}><Body kind="mars" radius={4} spin={0.03} tilt={0.44} /></group><CruiseShip /></group>
    <group ref={ground}>{shot==="signals"?<><mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[200,200]}/><meshLambertMaterial color="#a6b1ab"/></mesh><mesh position={[0,2,-2]}><boxGeometry args={[12,5,.3]}/><meshLambertMaterial color="#bfc6b8"/></mesh></>:<MarsGround storm={storm} />}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,.009,0]}><ringGeometry args={[4.8,5.8,52]} /><meshLambertMaterial color="#c9ab88" /></mesh>
      <group ref={capsule} position={[0,8,0]}>
        <mesh><sphereGeometry args={[1.25,20,10,0,Math.PI*2,0,Math.PI/2]} /><meshLambertMaterial color="#c3bcae" /></mesh>
        <group ref={heat}><mesh rotation={[Math.PI,0,0]}><coneGeometry args={[1.5,.35,24]} /><meshLambertMaterial color={steps[clock.current.i]?.id==="heat"?"#b87944":"#877662"} /></mesh></group>
        <group ref={bags}><Airbags /></group>
      </group>
      <group ref={chute} position={[0,19,0]}><Parachute /></group>
      <group ref={tether} position={[0,11,0]}><mesh><cylinderGeometry args={[.025,.025,6,6]} /><meshBasicMaterial color="#5d564e" /></mesh><group position={[0,3,0]}><Flame amount={fire} length={1.8} radius={.35} /></group></group>
      <group ref={lander} position={[0,.16,0]}>
        <mesh><cylinderGeometry args={[1.5,1.7,.25,3]} /><meshLambertMaterial color="#bba581" /></mesh>
        {[0,1,2].map(i=><group key={i} rotation={[0,i*Math.PI*2/3,0]}><group ref={el=>{petals.current[i]=el;}} position={[1.05,.1,0]}><mesh position={[.65,.03,0]} rotation={[-Math.PI/2,0,Math.PI/2]}><circleGeometry args={[1.3,3]} /><meshLambertMaterial color="#d0bd98" side={THREE.DoubleSide}/></mesh></group></group>)}
      </group>
      <group ref={rover}><Rover deploy={deploy} pan={pan}/><mesh position={[0,.9,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[3.2,1.5]} /><meshBasicMaterial ref={panelDust} color="#b38262" transparent opacity={0} /></mesh></group>
      <group ref={storyGroup}>
        <group ref={crumbs}>{Array.from({length:30},(_,i)=><mesh key={i} position={[1.5+Math.sin(i*12)*1.2,.08+Math.cos(i)*.015,2+Math.cos(i*7)*1]} scale={[1,.8,1]}><sphereGeometry args={[.07+(i%3)*.015,10,8]} /><meshLambertMaterial color="#747574" /></mesh>)}</group>
        <group ref={shore} position={[0,.025,0]}>{[3,5,7].map(r=><mesh key={r} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[r,r+.12,56,1,0,Math.PI]} /><meshBasicMaterial color="#8ba4a3" transparent opacity={.5} /></mesh>)}</group>
        <group ref={newer} position={[7,0,-6]} scale={1.3}><Rover newer /></group>
        <group ref={screens} position={[1,0,0]}>{[-2,0,2].map(x=><group key={x} position={[x,1.7,1]}><mesh><boxGeometry args={[1.6,1.2,.18]} /><meshLambertMaterial color="#4f5b63" /></mesh><mesh position={[0,0,.1]}><planeGeometry args={[1.35,.94]} /><meshBasicMaterial color="#8aab9c" /></mesh></group>)}</group>
        {(shot==="stuck"||shot==="free")&&<mesh position={[0,-.04,.3]} rotation={[-Math.PI/2,0,.3]} scale={[1.5,.7,1]}><torusGeometry args={[1.1,.3,10,32]}/><meshLambertMaterial color="#c8a079"/></mesh>}
        {shot==="endeavour"&&<mesh position={[0,.14,-24]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[16,20,64]}/><meshLambertMaterial color="#997255"/></mesh>}
        {shot==="water"&&<mesh position={[2,.35,2]}><boxGeometry args={[2,.6,.6]}/><meshLambertMaterial color="#b9a28b" transparent opacity={.45}/></mesh>}
        <group ref={wind}>{Array.from({length:20},(_,i)=><mesh key={i} position={[0,.9+(i%5)*.18,(i%4)*.7-1]}><sphereGeometry args={[.025,5,4]}/><meshBasicMaterial color="#c6a07c"/></mesh>)}</group>
      </group>
      {/* A pair of wheel-track rows, six stamps per metre, only behind the real rover. */}
      {Array.from({length:20},(_,i)=>[-1,1].map(s=><mesh key={`${i}-${s}`} position={[-1-i*.19,.015,s*.85]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.08,.23]} /><meshBasicMaterial color="#916d55" transparent opacity={.6} /></mesh>))}
    </group>
  </>;
}

function StoryOverlay({shot}:{shot:string;t:number}) {
  if(shot==="berries")return <svg className="mars-line-overlay" viewBox="0 0 1000 600" aria-hidden="true"><circle cx="590" cy="335" r="80" /><path d="M650 395l62 65" /></svg>;
  if(shot==="drive"||shot==="marathon")return <div className="mars-overlay paper-card">{shot==="marathon"?"A marathon on another world":"Crater after crater"}<svg viewBox="0 0 220 32" aria-hidden="true"><path d="M2 24Q55 0 100 20T218 8" fill="none" stroke="#596c61" strokeWidth="3" strokeDasharray="4 8" /></svg></div>;
  if(shot==="dust"||shot==="wind"||shot==="storm")return <div className="mars-overlay paper-card">Solar power <span>{shot==="wind"?"↗":"↘"}</span></div>;
  return null;
}


/** the cruise ship in space: a white aeroshell capsule, a blue solar-cell cruise stage and a tiny antenna */
function CruiseShip() {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (g.current && !motion.reduced) g.current.rotation.x = st.clock.elapsedTime * 0.4;
  });
  return (
    <group ref={g} rotation={[0, 0, Math.PI / 2]} scale={0.7}>
      <mesh position={[0, 0.25, 0]}>
        <coneGeometry args={[0.7, 0.55, 24]} />
        <meshToonMaterial color="#F1EDE6" />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.12, 24]} />
        <meshToonMaterial color="#C88A52" />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.1, 24]} />
        <meshToonMaterial color="#4F6BC2" />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshToonMaterial color="#C9C3D6" />
      </mesh>
    </group>
  );
}
