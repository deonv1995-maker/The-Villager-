import { RegionalIslandTerrain } from './RegionalIslandTerrain.js?v=541';

// Visual/geological refinement layer for the regional cliff system.
//
// RegionalIslandTerrain owns geography and formation composition. This layer
// only changes how the authored regional cliffs erode, break and blend into
// their grassy shoulders. The primary tested cliff remains untouched.
export class NaturalCliffTerrain extends RegionalIslandTerrain {
 constructor(THREE){
  super(THREE);

  const tuning={
   westernHighlandCliff:{
    naturalShoulder:true,shoulderWidth:5.4,shoulderPhase:3.2,organicScale:.70,
    naturalBreaks:[
     {center:-12.1,width:2.3,strength:.83,open:true},
     {center:2.4,width:3.0,strength:.48,open:false},
     {center:11.1,width:2.0,strength:.74,open:true}
    ]
   },
   easternShelfCliff:{
    naturalShoulder:true,shoulderWidth:4.8,shoulderPhase:-4.6,organicScale:.58,
    naturalBreaks:[
     {center:-8.8,width:2.1,strength:.78,open:true},
     {center:0.7,width:2.6,strength:.42,open:false},
     {center:11.2,width:1.8,strength:.70,open:true}
    ]
   },
   northernRidgeCliff:{
    naturalShoulder:true,shoulderWidth:5.8,shoulderPhase:8.7,organicScale:.52,
    naturalBreaks:[
     {center:-14.2,width:2.0,strength:.74,open:true},
     {center:-1.8,width:2.8,strength:.52,open:false},
     {center:7.8,width:2.2,strength:.82,open:true},
     {center:14.3,width:1.7,strength:.62,open:false}
    ]
   }
  };

  for(const formation of this.cliffFormations){
   const patch=tuning[formation.id];
   if(patch)Object.assign(formation,patch);
  }
 }

 cliffBreakFactor(u){
  const f=this.cliffFormation;
  const breaks=f.naturalBreaks||[];
  if(!breaks.length)return 1;

  let factor=1;
  for(const br of breaks){
   const width=Math.max(.1,br.width||1);
   const d=Math.abs(u-br.center)/width;
   if(d>=1)continue;
   const influence=1-this.smoothstep(0,1,d);
   factor*=1-Math.max(0,Math.min(.92,br.strength||0))*influence;
  }
  return Math.max(.16,Math.min(1,factor));
 }

 cliffBreakFactorFor(formation,u){
  return this.withCliffFormation(formation,()=>this.cliffBreakFactor(u));
 }

 cliffDropAt(u){
  const base=super.cliffDropAt(u);
  const f=this.cliffFormation;
  if(!f.naturalBreaks?.length)return base;

  // Long-wave height variation keeps adjacent exposed sections from sharing
  // the same top/bottom rhythm while the erosion mask creates true low points.
  const phase=f.shoulderPhase||0;
  const longWave=1
   +Math.sin((u+phase)*.095)*.050
   +Math.cos((u-phase*.42)*.163)*.035;
  return base*Math.max(.86,longWave)*this.cliffBreakFactor(u);
 }

 cliffEdgeV(u){
  const base=super.cliffEdgeV(u);
  const f=this.cliffFormation;
  if(!f.naturalShoulder)return base;

  // Only broad, low-frequency displacement is added here. Fine rock detail is
  // left to the cliff mesh itself so the silhouette does not become saw-toothed.
  const phase=f.shoulderPhase||0;
  const scale=f.organicScale??.6;
  const broad=Math.sin((u+phase)*.072)*.62+Math.cos((u-phase*.35)*.128)*.34;
  const bay=-.55*Math.exp(-Math.pow((u-phase*.18)/4.3,2));
  const nose=.42*Math.exp(-Math.pow((u+phase*.31)/3.7,2));
  return base+(broad+bay+nose)*scale;
 }

 subtractOpenBreaks(span,formation){
  let spans=[span];
  const breaks=(formation.naturalBreaks||[]).filter(br=>br.open);

  for(const br of breaks){
   const half=Math.max(.55,(br.width||1)*.52);
   const cutA=br.center-half;
   const cutB=br.center+half;
   const next=[];

   for(const [a,b] of spans){
    if(cutB<=a||cutA>=b){next.push([a,b]);continue;}
    if(cutA-a>1.35)next.push([a,Math.max(a,cutA)]);
    if(b-cutB>1.35)next.push([Math.min(b,cutB),b]);
   }
   spans=next;
  }
  return spans;
 }

 naturalWallSpansFor(formation){
  const baseSpans=super.cliffWallSpansFor(formation);
  if(!formation.naturalBreaks?.some(br=>br.open))return baseSpans;
  return baseSpans.flatMap(span=>this.subtractOpenBreaks(span,formation));
 }

 cliffWallSpansFor(formation){
  return this.naturalWallSpansFor(formation);
 }

 appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments){
  const f=this.cliffFormation;
  if(!f.naturalShoulder){
   super.appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.08,.20,.38,.58,.79,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const width=(f.shoulderWidth||5.2)*(
    .90+Math.sin((u+phase)*.115)*.08+Math.cos((u-phase)*.071)*.05
   );
   const edgeV=this.cliffEdgeV(u);
   const lip=this.cliffLipPoint(u);
   const anchorOffset=Math.min(1.25,width*.28);
   const anchorWorld=this.cliffFormationWorld(u,edgeV+anchorOffset);
   const anchorY=this.heightAt(anchorWorld.x,anchorWorld.z);
   const sample=[];

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=lip.y+.018;
     sample.push({p:new this.T.Vector3(lip.x,y,lip.z),color:this.grassSurfaceColorAt(y)});
     continue;
    }

    const seed=17000+i*97+r*31+Math.round(phase*19);
    const sampleU=u+(this.hash(seed)-.5)*.20*frac;
    const localEdge=this.cliffEdgeV(sampleU);
    const offset=.015+(width-.015)*frac;
    const w=this.cliffFormationWorld(sampleU,localEdge+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(width*.18,width*.88,offset);
    const shoulderY=anchorY*(1-blend)+terrainY*blend;
    const micro=(this.hash(seed+7)-.5)*.055*(1-blend);
    const y=shoulderY+micro+.018*(1-blend);
    sample.push({p:new this.T.Vector3(w.x,y,w.z),color:this.grassSurfaceColorAt(y)});
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
  if(!f.naturalShoulder){
   super.appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.15,.34,.58,.80,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const apronWidth=3.5*(.88+Math.cos((u+phase)*.14)*.10+Math.sin(u*.081)*.05);
   const edgeV=this.cliffEdgeV(u);
   const base=this.cliffBasePoint(u);
   const sample=[];

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=base.y+.008;
     sample.push({p:new this.T.Vector3(base.x,y,base.z),color:this.grassSurfaceColorAt(y)});
     continue;
    }

    const seed=22000+i*83+r*29+Math.round(phase*17);
    const sampleU=u+(this.hash(seed)-.5)*.24*frac;
    const localEdge=this.cliffEdgeV(sampleU);
    const offset=-.34-(apronWidth-.34)*frac;
    const w=this.cliffFormationWorld(sampleU,localEdge+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(.45,apronWidth*.92,Math.abs(offset));
    const y=base.y*(1-blend)+terrainY*blend+(this.hash(seed+4)-.5)*.035*(1-blend);
    sample.push({p:new this.T.Vector3(w.x,y,w.z),color:this.grassSurfaceColorAt(y)});
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

 buildCliffDetailGeometry(formation,index){
  return this.withCliffFormation(formation,()=>{
   const T=this.T;
   const positions=[];
   const colors=[];
   const indices=[];
   const spans=this.naturalWallSpansFor(formation);

   spans.forEach((span,spanIndex)=>{
    const length=Math.max(1,span[1]-span[0]);
    const segments=Math.max(10,Math.round(length/.82));
    const seed=31000+index*11000+spanIndex*3700;
    this.appendCliffSpan(positions,colors,indices,span[0],span[1],segments,seed);
    this.appendCliffTopCapSpan(positions,colors,indices,span[0],span[1],segments);
    this.appendCliffBaseApronSpan(positions,colors,indices,span[0],span[1],segments);
    this.appendCliffEndClosure(positions,colors,indices,span[0],-1,seed+1500);
    this.appendCliffEndClosure(positions,colors,indices,span[1],1,seed+2100);
   });

   const geo=new T.BufferGeometry();
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   geo.setIndex(indices);
   geo.computeVertexNormals();
   geo.computeBoundingSphere();
   return geo;
  });
 }
}
