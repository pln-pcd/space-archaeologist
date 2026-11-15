import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rampMaterial } from "../../fx/ramp";
import { SkySphere, StillStars, type CamCtl } from "../ch1/stage";
import { Flame, Puffs, Earth } from "../ch1/props";
import type { Sim } from "../ch1/SceneLaunch";

const M = (c: string) => rampMaterial(c, { flat: true });
export function Rover({ unfold = 1, dusty = 0, newer = false, deploy, pan }: { unfold?: number; dusty?: number; newer?: boolean; deploy?:MutableRefObject<number>; pan?:MutableRefObject<number> }) {
  const mat = useMemo(() => ({ foil: M("#c5ac7d"), metal: M("#a9a59a"), panel: M("#596b80"), dust: M("#a97756"), rubber: M("#45474a"), dark: M("#343d47") }), []);
  const wings=useRef<(THREE.Group|null)[]>([]), mast=useRef<THREE.Group>(null);
  useFrame(()=>{const k=deploy?.current??unfold;wings.current.forEach((g,i)=>{if(g)g.rotation.z=(i===0?-1:1)*(1-k)*1.25;});if(mast.current){mast.current.rotation.z=(1-k)*1.35;mast.current.rotation.y=pan?.current??0;}});
  return <group>
    <mesh position={[0,.62,0]} material={mat.foil} castShadow><boxGeometry args={[1.25,.35,1.35]} /></mesh>
    {!newer && [-1,1].map((s,i) => <group key={s} ref={g=>{wings.current[i]=g;}} position={[s*.65,.84,0]} rotation={[0,0,s*(1-unfold)*1.25]}>
      <mesh position={[s*.52,0,0]} material={mat.metal} castShadow><boxGeometry args={[1.08,.06,1.6]} /></mesh>
      {Array.from({length:20},(_,i) => <mesh key={i} position={[s*(.1+(i%4)*.25),.039,-.63+Math.floor(i/4)*.31]} material={mat.panel}><boxGeometry args={[.22,.016,.28]} /></mesh>)}
      {dusty > 0 && <mesh position={[s*.52,.058,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.02,1.52]} /><meshBasicMaterial color="#a97756" transparent opacity={dusty*.8} /></mesh>}
    </group>)}
    <group ref={mast} position={[.35,.84,-.32]} rotation={[0,0,(1-unfold)*1.35]}>
      <mesh position={[0,.52,0]} material={mat.metal} castShadow><cylinderGeometry args={[.045,.055,1.04,8]} /></mesh>
      <mesh position={[0,1.05,0]} material={mat.metal} castShadow><boxGeometry args={[.5,.18,.22]} /></mesh>
      {/* Camera instruments, not a face: a single dark camera bank and offset cylindrical sensor. */}
      <mesh position={[0,1.05,.12]} material={mat.dark}><boxGeometry args={[.34,.1,.02]} /></mesh>
      <mesh position={[.29,1.05,0]} rotation={[Math.PI/2,0,0]} material={mat.dark}><cylinderGeometry args={[.055,.055,.17,8]} /></mesh>
    </group>
    {[-1,1].map(s => <group key={s}>
      <mesh position={[s*.75,.4,0]} rotation={[Math.PI/2,0,.18*s]} material={mat.metal}><cylinderGeometry args={[.035,.035,1.8,6]} /></mesh>
      {[-.72,0,.72].map((z,i) => <group key={z} position={[s*.86,.29,z]}>
        <mesh rotation={[0,0,Math.PI/2]} material={mat.rubber} castShadow><cylinderGeometry args={[.29,.29,.21,16]} /></mesh>
        <mesh position={[s*.112,0,0]} rotation={[0,0,Math.PI/2]} material={mat.metal}><cylinderGeometry args={[.16,.16,.025,10]} /></mesh>
      </group>)}
    </group>)}
    <mesh position={[-.36,1.02,.34]} material={mat.metal}><cylinderGeometry args={[.22,.22,.08,18]} /></mesh>
    {newer && <mesh position={[0,1,-.85]} material={mat.metal} rotation={[.25,0,0]}><boxGeometry args={[.6,.65,.6]} /></mesh>}
  </group>;
}

export function MarsGround({ storm = false }: { storm?: boolean }) {
  const ground = useMemo(() => M("#ae7e5d"), []);
  const rock = useMemo(() => M("#9a7863"), []);
  return <>
    <SkySphere top={storm ? "#7b7168" : "#c3a17b"} bottom={storm ? "#b09b83" : "#e2c5a0"} />
    <fog attach="fog" args={[storm ? "#a28e78" : "#d9b993",20,100]} />
    <mesh rotation={[-Math.PI/2,0,0]} material={ground} receiveShadow><circleGeometry args={[180,64]} /></mesh>
    {Array.from({length:48},(_,i) => <mesh key={i} position={[Math.sin(i*9.3)*(5+i*.6),.06,Math.cos(i*5.7)*(7+i*.5)]} scale={[.3+(i%3)*.25,.12+(i%4)*.06,.28+(i%5)*.1]} material={rock} receiveShadow><dodecahedronGeometry args={[1,0]} /></mesh>)}
    {Array.from({length:7},(_,i) => <mesh key={i} position={[-40+i*13,-1,-35-Math.sin(i)*6]} scale={[12,3,5]} material={rock}><sphereGeometry args={[1,20,8,0,Math.PI*2,0,Math.PI/2]} /></mesh>)}
  </>;
}

export function DeltaII({ phase, t }: { phase: string; t: number }) {
  const m = useMemo(() => ({ blue:M("#729baf"), white:M("#e0ddd0"), dark:M("#525861") }), []);
  const main = useRef(0), solid = useRef(0), upper = useRef(0);
  useFrame(() => { main.current = ["ignite","push","climb"].includes(phase) ? 1 : 0; solid.current=phase === "stage" ? 1 : main.current; upper.current = phase === "space" ? .65 : 0; });
  return <group>
    <mesh position={[0,6.2,0]} material={m.blue} castShadow><cylinderGeometry args={[.63,.63,9.8,20]} /></mesh>
    <mesh position={[0,11.4,0]} material={m.white} castShadow><cylinderGeometry args={[.72,.63,1.7,20]} /></mesh>
    <mesh position={[0,12.8,0]} material={m.white}><coneGeometry args={[.72,1.2,20]} /></mesh>
    <mesh position={[0,.9,0]} material={m.dark}><cylinderGeometry args={[.22,.44,.8,14]} /></mesh>
    <group position={[0,.55,0]}><Flame amount={phase === "space" ? upper : main} length={4} radius={.43} /></group>
    {Array.from({length:9},(_,i) => {
      const a=i*Math.PI*2/9;
      const groundLit=i%3!==0;
      const detached=phase === "stage" && groundLit;
      const fall=detached ? Math.min(8,t*t*.3) : 0;
      return <group key={i} position={[Math.sin(a)*(.97+fall*.16),3.4-fall,Math.cos(a)*(.97+fall*.16)]} rotation={[Math.cos(a)*fall*.06,0,-Math.sin(a)*fall*.06]} visible={phase!=="space"}>
        <mesh material={m.white} castShadow><cylinderGeometry args={[.22,.22,5.5,10]} /></mesh>
        <mesh position={[0,2.95,0]} material={m.white}><coneGeometry args={[.22,.4,10]} /></mesh>
        <group position={[0,-2.8,0]}>{((groundLit && phase!=="stage") || (!groundLit && phase==="stage")) && <Flame amount={solid} length={2} radius={.2} />}</group>
      </group>;
    })}
  </group>;
}

export function MarsLaunchWorld({ sim }: { sim: MutableRefObject<Sim>; cam: MutableRefObject<CamCtl> }) {
  const rocket = useRef<THREE.Group>(null), smoke = useRef(0);
  const [initial] = useMemo(() => [M("#333e45")], []);
  // Phase changes are read by the visual frame without rerendering the entire launch controller.
  const phase = useRef("count"), [sync] = useMemo(() => [{ phase:"count", t:0 }], []);
  const flames = useRef(0);
  useFrame(() => { const s=sim.current; if(rocket.current) rocket.current.position.y=s.y; smoke.current=s.smoke; phase.current=s.phase; sync.phase=s.phase; sync.t=s.tPhase; flames.current=s.flame; });
  return <>
    <fog attach="fog" args={["#182431",90,300]} />
    <SkySphere top="#172333" bottom="#3b4651" /><StillStars count={350} />
    <ambientLight intensity={.4} color="#b7c5d1" />
    <directionalLight position={[-4,8,12]} intensity={1.4} color="#e5d5ae" />
    <mesh rotation={[-Math.PI/2,0,0]} material={initial} receiveShadow><planeGeometry args={[500,500]} /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,-85]}><planeGeometry args={[500,80]} /><meshBasicMaterial color="#253e51" /></mesh>
    <mesh position={[-3.4,7,0]}><boxGeometry args={[1.8,14,1.8]} /><meshLambertMaterial color="#6c7275" wireframe /></mesh>
    {[2,5,8,11].map(y => <mesh key={y} position={[-2.2,y,0]}><boxGeometry args={[2,.12,1.2]} /><meshLambertMaterial color="#8c938d" /></mesh>)}
    <group ref={rocket}><DeltaLive sim={sim} /></group>
    <Puffs amount={smoke} count={18} spread={7} rise={2.5} color="#c7c1b5" opacity={.6} size={4} />
    <pointLight position={[0,1.5,0]} color="#dec5a1" intensity={sim.current.flame*8} distance={28} />
  </>;
}
function DeltaLive({ sim }: { sim: MutableRefObject<Sim> }) {
  const g=useRef<THREE.Group>(null), first=useRef<THREE.Group>(null), last=useRef<THREE.Group>(null);
  const firstFire=useRef(0), lastFire=useRef(0);
  useFrame(() => {
    const s=sim.current, stage=s.phase==="stage", space=s.phase==="space";
    firstFire.current=space||stage ? 0:s.flame;
    lastFire.current=stage||space ? .8:0;
    if(first.current) {first.current.visible=!space; first.current.position.y=stage ? -s.tPhase*s.tPhase : 0;}
    if(g.current) g.current.visible=!space;
    if(last.current) last.current.visible=space;
  });
  return <>
    <group ref={g}><mesh position={[0,6.2,0]} material={M("#729baf")} castShadow><cylinderGeometry args={[.63,.63,9.8,20]} /></mesh>
    <mesh position={[0,11.4,0]} material={M("#e0ddd0")} castShadow><cylinderGeometry args={[.72,.63,1.7,20]} /></mesh>
    <mesh position={[0,12.8,0]} material={M("#e0ddd0")}><coneGeometry args={[.72,1.2,20]} /></mesh></group>
    <group ref={last} position={[0,10,0]}><mesh material={M("#e0ddd0")}><cylinderGeometry args={[.63,.63,2.7,20]} /></mesh><group position={[0,-1.5,0]}><Flame amount={lastFire} length={3} radius={.4} /></group></group>
    <group position={[0,1.2,0]}><Flame amount={firstFire} length={4} radius={.45} /></group>
    {Array.from({length:9},(_,i) => <Booster key={i} i={i} sim={sim} />)}
  </>;
}
function Booster({i,sim}:{i:number;sim:MutableRefObject<Sim>}) {
  const g=useRef<THREE.Group>(null), fire=useRef(0), a=i*Math.PI*2/9, groundLit=i%3!==0;
  useFrame(() => { const s=sim.current, stage=s.phase==="stage", space=s.phase==="space", fall=stage&&groundLit ? s.tPhase*s.tPhase*.5:0;
    if(g.current){ g.current.visible=!space; g.current.position.set(Math.sin(a)*(.97+fall*.2),3.5-fall,Math.cos(a)*(.97+fall*.2)); g.current.rotation.z=-Math.sin(a)*fall*.05; }
    fire.current=stage ? groundLit?0:.8 : groundLit?s.flame:0;
  });
  return <group ref={g}><mesh material={M("#d5d4cb")} castShadow><cylinderGeometry args={[.22,.22,5.5,10]} /></mesh><mesh position={[0,2.95,0]} material={M("#d5d4cb")}><coneGeometry args={[.22,.4,10]} /></mesh><group position={[0,-2.8,0]}><Flame amount={fire} length={2.4} radius={.2} /></group></group>;
}

export function Airbags({ size = 1 }: {size?: number}) {
  return <group scale={size}>{Array.from({length:6},(_,i) => { const a=i*Math.PI/3; return <mesh key={i} position={[Math.sin(a)*.8, i%2*.3,Math.cos(a)*.8]} castShadow><sphereGeometry args={[.85,16,12]} /><meshLambertMaterial color="#d0c4aa" flatShading /></mesh>; })}</group>;
}
export function Parachute() {
  return <group><mesh rotation={[Math.PI,0,0]}><sphereGeometry args={[3,24,12,0,Math.PI*2,0,Math.PI/2]} /><meshLambertMaterial color="#e3d8c5" side={THREE.DoubleSide} /></mesh>
    {Array.from({length:8},(_,i) => { const a=i*Math.PI/4; const p=new THREE.Vector3(Math.sin(a)*3,0,Math.cos(a)*3), q=new THREE.Vector3(0,-5,0), d=q.clone().sub(p);return <mesh key={i} position={p.clone().add(q).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize())}><cylinderGeometry args={[.018,.018,d.length(),4]} /><meshBasicMaterial color="#665f55" /></mesh>;})}
  </group>;
}
