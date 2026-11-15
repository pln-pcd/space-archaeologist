import { useEffect, useRef, useState } from "react";
import { useIntent, useIntentScope } from "../../input/bus";
import { useCameraBackdrop, useInput } from "../../input/store";
import { LiveCamera } from "../ch1/CameraCheck";
import { play } from "../../audio/sfx";
import { makeRumble } from "../ch1/stage";
import { voice, line, type SolResult } from "../ch2-mars";
import { SOL_TUNING, PANEL, clean, dropPebble, grabPebble, solState, solStars, tickSol, type SolState } from "./solModel";

export default function SolKeeper({camera,onDone}:{camera:boolean;onDone:(r:SolResult)=>void}) {
  useCameraBackdrop(camera);
  const sim=useRef(solState()), canvas=useRef<HTMLCanvasElement>(null), done=useRef(false);
  const cursor=useRef({x:.5,y:.5,visible:false}), held=useRef<number|null>(null), pressed=useRef(false);
  const pointerPrev=useRef({x:0,y:0}), handPrev=useRef<Record<string,{x:number;y:number;t:number}>>({});
  const [view,setView]=useState({sol:0,power:82,berries:0,rest:false,win:false,suns:0,tag:""});
  const [paused,setPaused]=useState(false), pause=useRef(false), tag=useRef({text:"",until:0}), lastSound=useRef(0);
  const left=useInput(s=>s.leftHanded), camStatus=useInput(s=>s.camera);
  const [cameraLost,setCameraLost]=useState(false);
  const dims=useRef({w:innerWidth,h:innerHeight});
  const particles=useRef<{x:number;y:number;vx:number;life:number}[]>([]);
  const hum=useRef(makeRumble()),humTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{clearTimeout(humTimer.current);hum.current.stop();},[]);
  useIntentScope(["pointer","pinch","grab","wave"],{keyboardCursor:true},"sol-keeper");
  const announce=(text:string)=>{tag.current={text,until:sim.current.elapsed+5};};
  const xy=(x:number,y:number)=>({x:x/dims.current.w,y:y/dims.current.h});
  const wipe=(x:number,y:number,dx:number,dy:number)=>{
    if(pause.current||sim.current.winAt!==null)return;
    const speed=Math.hypot(dx,dy);
    if(clean(sim.current,x,y,.075+Math.min(.07,speed),.12+Math.min(.5,speed*4))){
      hum.current.set(sim.current.power*.0015);clearTimeout(humTimer.current);humTimer.current=setTimeout(()=>hum.current.stop(),500);
      if(particles.current.length<(innerWidth<900?30:80))for(let i=0;i<4;i++)particles.current.push({x,y,vx:dx*5+(i-2)*.03,life:1});
      if(sim.current.elapsed-lastSound.current>.4){play("whoosh",.9,.12);lastSound.current=sim.current.elapsed;}
    }
  };
  const startGrab=(x:number,y:number)=>{ if(pause.current)return;pressed.current=true;const p=grabPebble(sim.current,x,y);held.current=p?.id??null; };
  const release=(x:number,y:number)=>{
    pressed.current=false;
    if(held.current!==null&&dropPebble(sim.current,held.current,x,y,left)){
      play("dataSparkle",1+sim.current.blueberries%7*.1,.35);
      if([1,5].includes(sim.current.blueberries))announce(line("m-hematite").text);
    }
    held.current=null;
    if(sim.current.devil?.caught)sim.current.devil.caught=false;
  };
  const move=(x:number,y:number,drag:boolean)=>{
    cursor.current={x,y,visible:true};
    const s=sim.current;
    if(pause.current)return;
    const prev=pointerPrev.current;
    if(drag&&held.current===null)wipe(x,y,x-prev.x,y-prev.y);
    const p=s.pebbles.find(p=>p.id===held.current);if(p){p.x=x;p.y=y;}
    if(s.devil?.caught){s.devil.x=x;s.devil.y=y;}
    pointerPrev.current={x,y};
  };
  useIntent("pinchStart",e=>{const p=xy(e.x,e.y);startGrab(p.x,p.y);});
  useIntent("grab",e=>{if(held.current===null){const p=xy(e.x,e.y);startGrab(p.x,p.y);}});
  useIntent("pointer",e=>{const p=xy(e.x,e.y);move(p.x,p.y,pressed.current);cursor.current.visible=e.visible;});
  useIntent("pinchEnd",e=>{const p=xy(e.x,e.y);release(p.x,p.y);});
  useIntent("release",e=>{const p=xy(e.x,e.y);release(p.x,p.y);});
  useIntent("handMotion",e=>{
    const p=xy(e.x,e.y),prev=handPrev.current[e.hand];
    if(e.open&&prev&&e.t-prev.t<300)wipe(p.x,p.y,p.x-prev.x,p.y-prev.y);
    handPrev.current[e.hand]={...p,t:e.t};
    if(e.pointing) {
      move(p.x,p.y,false);
      const d=sim.current.devil;
      if(d&&!d.caught){if(Math.hypot(d.x-p.x,(d.y-p.y)*.65)<.11){d.hold+=prev?Math.min(.1,(e.t-prev.t)/1000):0;if(d.hold>=SOL_TUNING.devilHold)d.caught=true;}else d.hold=0;}
    }else if(sim.current.devil&&!sim.current.devil.caught)sim.current.devil.hold=0;
  });
  useEffect(()=>{if(camera&&camStatus!=="on"&&!new URLSearchParams(location.search).has("inject")){setCameraLost(true);}},[camera,camStatus]);
  useEffect(()=>{
    let raf=0,last=performance.now(),lastUi=0;
    const loop=(now:number)=>{
      const dt=Math.min(.05,(now-last)/1000);last=now;const s=sim.current;
      if(!pause.current&&!document.hidden){
        tickSol(s,dt);
        const d=s.devil;
        if(d){
          if(!d.caught&&pressed.current&&held.current===null&&Math.hypot(d.x-cursor.current.x,(d.y-cursor.current.y)*.65)<.11){d.hold+=dt;if(d.hold>=.5)d.caught=true;}
          else if(!d.caught&&!camera)d.hold=0;
          if(d.caught&&d.x>PANEL.x&&d.x<PANEL.x+PANEL.w&&d.y>PANEL.y&&d.y<PANEL.y+PANEL.h){s.dust.fill(0);s.power=100;s.resting=false;s.events++;s.blueberries++;s.devil=null;announce("Cleaning event! "+line("m-clean").text);play("chime",1,.4);}
        }
        for(const p of particles.current){p.life-=dt*2;p.x+=p.vx*dt;p.y+=dt*.025;}
        particles.current=particles.current.filter(p=>p.life>0);
        if(s.winAt!==null&&s.elapsed-s.winAt>=SOL_TUNING.celebrationSeconds&&!done.current){done.current=true;onDone({sols:90,blueberries:s.blueberries,events:s.events,stars:solStars(s)});return;}
      }
      if(now-lastUi>100){lastUi=now;setView({sol:Math.floor(s.sols),power:Math.round(s.power),berries:s.blueberries,rest:s.resting,win:s.winAt!==null,suns:s.winAt===null?0:Math.min(60,Math.floor((s.elapsed-s.winAt)*6)),tag:s.elapsed<tag.current.until?tag.current.text:""});}
      draw(canvas.current,s,cursor.current,left,particles.current);
      raf=requestAnimationFrame(loop);
    };
    const resize=()=>{dims.current={w:innerWidth,h:innerHeight};if(canvas.current){canvas.current.width=innerWidth;canvas.current.height=innerHeight;}};
    resize();window.addEventListener("resize",resize);raf=requestAnimationFrame(loop);
    if(import.meta.env.DEV)(window as unknown as {__sol:unknown}).__sol={sim,seek:(seconds:number)=>{const s=solState();for(let t=0;t<seconds;t+=.05){tickSol(s,.05);if(s.resting)s.dust.fill(.1);}sim.current=s;},rest:()=>{sim.current.winAt=null;sim.current.sols=40;sim.current.dust.fill(1);sim.current.power=0;sim.current.resting=true;}};
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);delete (window as unknown as {__sol?:unknown}).__sol;};
  },[left,onDone]);
  useEffect(()=>{if(!view.rest&&!view.win)return;const v=voice.say(view.win?"m-longer":"m-rest");return()=>v.stop();},[view.rest,view.win]);
  return <div className={`ch1-scene sol-keeper ${camera&&!cameraLost?"camera":"camera-off"}`} data-resting={view.rest}>
    {camera&&!cameraLost&&<LiveCamera />}
    <canvas ref={canvas} className="sol-canvas" aria-label="Wipe the panel. Drag grey pebbles into the Science Box." />
    <div className="sol-power paper-card"><span>Power {view.power}%</span><meter value={view.power} max={100} /></div>
    <div className="sol-sols paper-card">Sol {view.sol} / 90</div>
    {!camera&&<span className="sol-camera paper-card">Imagine · be the Martian wind</span>}
    {cameraLost&&<div className="sol-camera paper-card">Camera unavailable. Keep playing with mouse or touch.</div>}
    <div className={`sol-box paper-card ${left?"left-handed":""}`}><strong>Science Box</strong><span>{view.berries} pebbles</span></div>
    <div className="sol-guide paper-card" role="status">{view.win?"You made it to sol 90!":view.rest?line("m-rest").text:view.tag|| (view.sol<20?line("m-wipe").text:view.sol<45?line("m-grab").text:line("m-point").text)}</div>
    {view.win&&<div className="sol-celebration paper-card"><p>{line("m-longer").text}</p><div aria-label="60 suns">{Array.from({length:60},(_,i)=><span key={i} style={{opacity:i<view.suns?1:.15}}>☀</span>)}</div></div>}
    <button className="sol-pause chunky" onClick={()=>{pause.current=!paused;setPaused(!paused);}}>{paused?"Play":"Pause"}</button>
  </div>;
}

function draw(canvas:HTMLCanvasElement|null,s:SolState,cursor:{x:number;y:number;visible:boolean},left:boolean,particles:{x:number;y:number;life:number}[]){
  const c=canvas?.getContext("2d");if(!canvas||!c)return;const w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.save();c.shadowColor="rgba(41,36,30,.28)";c.shadowBlur=5;c.shadowOffsetY=4;
  const px=PANEL.x*w,py=PANEL.y*h,pw=PANEL.w*w,ph=PANEL.h*h;
  c.fillStyle="#b3b3a3";c.strokeStyle="#3a3d42";c.lineWidth=3;c.beginPath();c.roundRect(px-8,py-8,pw+16,ph+16,12);c.fill();c.stroke();c.shadowBlur=0;c.shadowOffsetY=0;
  for(let i=0;i<s.dust.length;i++){
    const x=px+i%28/28*pw,y=py+Math.floor(i/28)/5*ph;
    c.fillStyle=s.resting?"#7c7d7a":i%5===0?"#687a8c":"#52657a";c.fillRect(x+1,y+1,pw/28-2,ph/5-2);
    c.fillStyle=`rgba(172,116,78,${s.dust[i]})`;c.fillRect(x+1,y+1,pw/28-2,ph/5-2);
    c.fillStyle=`rgba(214,169,125,${s.dust[i]*.8})`;for(let j=0;j<3;j++)c.fillRect(x+(i*7+j*17)%Math.max(1,pw/28),y+(i*3+j*11)%Math.max(1,ph/5),2,2);
  }
  for(const p of s.pebbles){c.fillStyle=p.held?"#8e918b":"#777a78";c.strokeStyle="#464c4c";c.lineWidth=3;c.beginPath();c.ellipse(p.x*w,p.y*h,Math.max(17,w*.018),Math.max(16,h*.028),p.id,0,Math.PI*2);c.fill();c.stroke();}
  if(s.devil){const d=s.devil;c.strokeStyle=d.caught?"#626f5b":"#ae8261";c.lineWidth=6;c.lineCap="round";for(let i=0;i<5;i++){c.beginPath();c.ellipse(d.x*w,d.y*h-i*10,10+i*6,5,0,.2,Math.PI*1.8);c.stroke();}c.strokeStyle="#51674e";c.lineWidth=4;c.beginPath();c.arc(d.x*w,d.y*h-22,46,-Math.PI/2,-Math.PI/2+Math.PI*2*d.hold/.5);c.stroke();}
  for(const p of particles){c.globalAlpha=Math.max(0,p.life);c.fillStyle="#bb8c65";c.fillRect(p.x*w,p.y*h,4,4);}c.globalAlpha=1;
  if(cursor.visible){c.beginPath();c.arc(cursor.x*w,cursor.y*h,20,0,Math.PI*2);c.fillStyle=s.pebbles.some(p=>p.held)?"rgba(143,166,135,.6)":"rgba(255,248,236,.1)";c.fill();c.strokeStyle="#fff8ec";c.lineWidth=3;c.stroke();}
  c.restore();
}
