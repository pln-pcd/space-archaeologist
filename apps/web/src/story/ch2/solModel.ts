/** Screen-independent, no-fail Sol Keeper simulation. No image or landmark data enters here. */
export const SOL_TUNING = { cols: 28, rows: 5, dustPerSecond: .013, dustyPerSecond: .022, grabRadius: .064, helpRadius: .105, devilHold: .5, spawnSeconds: 3.2, celebrationSeconds: 10 };
export type Pebble = { id: number; x: number; y: number; held: boolean };
export type SolState = { elapsed: number; sols: number; power: number; dust: number[]; blueberries: number; events: number; pebbles: Pebble[]; devil: { x: number; y: number; caught: boolean; hold: number } | null; lastSpawn: number; lastDevil: number; id: number; resting: boolean; winAt: number | null; help: boolean };
export const PANEL = { x: .16, y: .22, w: .68, h: .29 };
export function solState(): SolState { return { elapsed:0,sols:0,power:82,dust:Array(140).fill(.18),blueberries:0,events:0,pebbles:[],devil:null,lastSpawn:17,lastDevil:25,id:0,resting:false,winAt:null,help:false }; }
export function clean(s:SolState,x:number,y:number,r=.09,strength=.45) {
  let changed=false;
  for(let i=0;i<s.dust.length;i++) {
    const cx=PANEL.x+(i%28+.5)/28*PANEL.w, cy=PANEL.y+(Math.floor(i/28)+.5)/5*PANEL.h;
    if(Math.hypot((cx-x), (cy-y)*.65)<r){ s.dust[i]=Math.max(0,s.dust[i]-strength);changed=true; }
  }
  if(changed) { power(s); if(s.power>1)s.resting=false; }
  return changed;
}
function power(s:SolState){s.power=Math.max(0,100*(1-s.dust.reduce((a,b)=>a+b,0)/s.dust.length));}
export function tickSol(s:SolState,dt:number) {
  s.elapsed+=dt;
  if(s.winAt!==null)return;
  s.help=s.elapsed>25&&s.blueberries<Math.floor((s.elapsed-20)/17);
  const rate=(s.elapsed>=75?SOL_TUNING.dustyPerSecond:SOL_TUNING.dustPerSecond)*(s.help?.65:1);
  for(let i=0;i<s.dust.length;i++)s.dust[i]=Math.min(1,s.dust[i]+rate*dt);
  power(s);s.resting=s.power<.1;
  if(!s.resting)s.sols=Math.min(90,s.sols+dt);
  if(s.sols>=90){s.winAt=s.elapsed;return;}
  if(s.elapsed>=20&&s.elapsed-s.lastSpawn>(s.blueberries>8?2.6:SOL_TUNING.spawnSeconds)){
    s.lastSpawn=s.elapsed;s.id++;s.pebbles.push({id:s.id,x:.88,y:.66+(s.id%3)*.045,held:false});
  }
  for(const p of s.pebbles)if(!p.held)p.x-=dt*.016;
  s.pebbles=s.pebbles.filter(p=>p.x>.08||p.held).slice(-12);
  if(s.elapsed>=45&&!s.devil&&s.elapsed-s.lastDevil>=20){s.lastDevil=s.elapsed;s.devil={x:.91,y:.58,caught:false,hold:0};}
}
export function grabPebble(s:SolState,x:number,y:number){
  const r=s.help?SOL_TUNING.helpRadius:SOL_TUNING.grabRadius;
  const p=s.pebbles.find(p=>!p.held&&Math.hypot(p.x-x,(p.y-y)*.65)<r);
  if(p)p.held=true;return p??null;
}
export function dropPebble(s:SolState,id:number,x:number,y:number,leftHanded=false){
  const p=s.pebbles.find(p=>p.id===id);if(!p)return false;p.held=false;
  const inBox=y>.75&&x>(leftHanded?.73:.03)&&x<(leftHanded?.97:.27);
  if(!inBox)return false;s.pebbles=s.pebbles.filter(p=>p!==p);s.blueberries++;return true;
}
export const solStars=(s:Pick<SolState,'sols'|'blueberries'|'events'>)=>s.sols<90?0:1+(s.blueberries>=8?1:0)+(s.blueberries>=8&&s.events>=1?1:0);
