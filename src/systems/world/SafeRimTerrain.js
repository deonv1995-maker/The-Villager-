import { NaturalCliffTerrain } from './NaturalCliffTerrain.js?v=544';

// Final visual safety layer for regional cliffs.
// Keeps the proven terrain/cliff architecture intact, but prevents narrow
// shoulders, folded cap strips and sharp closure wedges from producing the
// broken-looking triangular spikes seen in 0.5.44.
export class SafeRimTerrain extends NaturalCliffTerrain {
 constructor(THREE){
  super(THREE);

  for(const formation of this.cliffFormations){
   if(!formation.naturalShoulder)continue;
   formation.safeRim=true;
   formation.safeRimSamples=5;
   formation.safeRimStep=.48;
   formation.safeTopSlope=.42;
   formation.safeBaseSlope=.58;
  }
 }

 smoothPointAlongU(u, sampler, step=.48){
  const weights=[1,2,3,2,1];
  const T=this.T;
  const out=new T.Vector3();
  let total=0;
  for(let i=-2;i<=2;i++){
   const w=weights[i+2];
   const p=sampler.call(this,u+i*step);
   out.x+=p.x*w;
   out.y+=p.y*w;
   out.z+=p.z*w;
   total+=w;
  }
  out.multiplyScalar(1/total);
  return out;
 }

 cliffLipPoint(u){
  const f=this.cliffFormation;
  if(!f.safeRim)return super.cliffLipPoint(u);
  return this.smoothPointAlongU(u,super.cliffLipPoint,f.safeRimStep||.48);
 }

 cliffBasePoint(u){
  const f=this.cliffFormation;
  if(!f.safeRim)return super.cliffBasePoint(u);
  return this.smoothPointAlongU(u,super.cliffBasePoint,f.safeRimStep||.48);
 }

 clampRowHeight(previousPoint,candidateY,candidatePoint,maxSlope){
  if(!previousPoint)return candidateY;
  const dx=candidatePoint.x-previousPoint.x;
  const dz=candidatePoint.z-previousPoint.z;
  const horizontal=Math.max(.001,Math.hypot(dx,dz));
  const maxDelta=horizontal*maxSlope;
  return Math.max(previousPoint.y-maxDelta,Math.min(previousPoint.y+maxDelta,candidateY));
 }

 appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments){
  const f=this.cliffFormation;
  if(!f.safeRim){
   super.appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.065,.15,.27,.42,.59,.78,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const width=Math.max(5.4,(f.shoulderWidth||6.0)*(
    .97+Math.sin((u+phase)*.075)*.025+Math.cos((u-phase)*.052)*.018
   ));
   const edgeV=this.cliffEdgeV(u);
   const lip=this.cliffLipPoint(u);
   const sample=[];
   let previous=null;

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=lip.y+.018;
     const p=new this.T.Vector3(lip.x,y,lip.z);
     sample.push({p,color:this.grassSurfaceColorAt(y)});
     previous=p;
     continue;
    }

    // Keep every row on the same u cross-section. Lateral row drift was the
    // main source of crossing quads and pointed shards on tight bends.
    const offset=.015+(width-.015)*frac;
    const w=this.cliffFormationWorld(u,edgeV+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(width*.12,width*.96,offset);
    const ease=blend*blend*(3-2*blend);
    let targetY=lip.y*(1-ease)+terrainY*ease;
    targetY+=Math.sin((u+phase)*.29+r*.56)*.008*(1-ease);

    const candidate=new this.T.Vector3(w.x,targetY,w.z);
    const y=this.clampRowHeight(previous,targetY,candidate,f.safeTopSlope||.42);
    candidate.y=y;
    sample.push({p:candidate,color:this.grassSurfaceColorAt(y)});
    previous=candidate;
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<fractions.length-1;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    if((i+r)%2===0){
     this.appendTriangle(positions,colors,indices,a.p,c.p,b.p,a.color,c.color,b.color);
     this.appendTriangle(positions,colors,indices,a.p,d.p,c.p,a.color,d.color,c.color);
    }else{
     this.appendTriangle(positions,colors,indices,a.p,d.p,b.p,a.color,d.color,b.color);
     this.appendTriangle(positions,colors,indices,b.p,d.p,c.p,b.color,d.color,c.color);
    }
   }
  }
 }

 appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments){
  const f=this.cliffFormation;
  if(!f.safeRim){
   super.appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.12,.27,.45,.64,.82,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const width=4.35*(.97+Math.cos((u+phase)*.082)*.025+Math.sin(u*.055)*.018);
   const edgeV=this.cliffEdgeV(u);
   const base=this.cliffBasePoint(u);
   const sample=[];
   let previous=null;

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=base.y+.008;
     const p=new this.T.Vector3(base.x,y,base.z);
     sample.push({p,color:this.grassSurfaceColorAt(y)});
     previous=p;
     continue;
    }

    const offset=-.34-(width-.34)*frac;
    const w=this.cliffFormationWorld(u,edgeV+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(.34,width*.97,Math.abs(offset));
    const ease=blend*blend*(3-2*blend);
    let targetY=base.y*(1-ease)+terrainY*ease;
    targetY+=Math.cos((u+phase)*.24+r*.49)*.008*(1-ease);

    const candidate=new this.T.Vector3(w.x,targetY,w.z);
    const y=this.clampRowHeight(previous,targetY,candidate,f.safeBaseSlope||.58);
    candidate.y=y;
    sample.push({p:candidate,color:this.grassSurfaceColorAt(y)});
    previous=candidate;
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<fractions.length-1;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    if((i+r)%2===0){
     this.appendTriangle(positions,colors,indices,a.p,b.p,c.p,a.color,b.color,c.color);
     this.appendTriangle(positions,colors,indices,a.p,c.p,d.p,a.color,c.color,d.color);
    }else{
     this.appendTriangle(positions,colors,indices,a.p,b.p,d.p,a.color,b.color,d.color);
     this.appendTriangle(positions,colors,indices,b.p,c.p,d.p,b.color,c.color,d.color);
    }
   }
  }
 }

 appendCliffEndClosure(positions,colors,indices,u,direction,seedOffset){
  const f=this.cliffFormation;
  if(f.safeRim){
   // Continuous terrain remains underneath every regional cliff, so a hard
   // closure wedge is unnecessary and is exactly what produced the remaining
   // spear-like triangles at some formation ends.
   return;
  }
  super.appendCliffEndClosure(positions,colors,indices,u,direction,seedOffset);
 }
}
