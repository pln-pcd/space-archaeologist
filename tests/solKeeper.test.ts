import { describe, expect, it } from "vitest";
import { clean, dropPebble, grabPebble, solState, solStars, tickSol } from "../apps/web/src/story/ch2/solModel";

describe("Sol Keeper's no-fail mission",()=>{
  it("rests without advancing sols, then resumes when the child clears dust",()=>{
    const s=solState();s.dust.fill(1);tickSol(s,1);expect(s.resting).toBe(true);expect(s.sols).toBe(0);
    clean(s,.5,.36,1,1);tickSol(s,1);expect(s.resting).toBe(false);expect(s.sols).toBe(1);
  });
  it("only counts science when a grabbed pebble is dropped in the correct box",()=>{
    const s=solState();s.pebbles.push({id:1,x:.5,y:.7,held:false});expect(grabPebble(s,.5,.7)?.id).toBe(1);
    expect(dropPebble(s,1,.6,.8)).toBe(false);expect(s.blueberries).toBe(0);
    expect(dropPebble(s,1,.15,.84)).toBe(true);expect(s.blueberries).toBe(1);expect(s.pebbles).toHaveLength(0);
  });
  it("mirrors the science box for left-handed play",()=>{
    const s=solState();s.pebbles.push({id:1,x:.8,y:.8,held:true});
    expect(dropPebble(s,1,.15,.84,true)).toBe(false);expect(dropPebble(s,1,.85,.84,true)).toBe(true);
  });
  it("introduces science after 20 seconds and dust devils after 45",()=>{
    const s=solState();for(let t=0;t<19;t++)tickSol(s,1);expect(s.pebbles).toHaveLength(0);expect(s.devil).toBeNull();
    tickSol(s,2);expect(s.pebbles.length).toBeGreaterThan(0);for(let t=0;t<25;t++)tickSol(s,1);expect(s.devil).not.toBeNull();
  });
  it("ends the mission at 90 sols and preserves results during celebration",()=>{
    const s=solState();s.sols=89.5;tickSol(s,1);expect(s.sols).toBe(90);expect(s.winAt).not.toBeNull();
    const dust=[...s.dust];tickSol(s,5);expect(s.sols).toBe(90);expect(s.dust).toEqual(dust);
  });
  it("awards the third star only after all three goals are met",()=>{
    expect(solStars({sols:89,blueberries:10,events:2})).toBe(0);
    expect(solStars({sols:90,blueberries:7,events:1})).toBe(1);
    expect(solStars({sols:90,blueberries:8,events:0})).toBe(2);
    expect(solStars({sols:90,blueberries:8,events:1})).toBe(3);
  });
});
