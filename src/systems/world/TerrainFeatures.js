export class TerrainFeatures {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.root=new THREE.Group();
  this.root.name='ProceduralTerrainFeatures';
  this.seed=9413;
  this.materials={
   rock:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:true}),
   boulder:new THREE.MeshStandardMaterial({color:0x747f7a,roughness:.96,metalness:0,flatShading:true})
  };
 }

 rand(i){
  const x=Math.sin(i*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 rockColor(seed,topBand=false){
  const T=this.T;
  if(topBand){
   const dirt=[0x71644e,0x796c52,0x685f50];
   return new T.Color(dirt[Math.floor(this.rand(seed)*dirt.length)%dirt.length]);
  }
  const rocks=[0x66716d,0x717c78,0x7b8580,0x5f6a67,0x858e88];
  return new T.Color(rocks[Math.floor(this.rand(seed)*rocks.length)%rocks.length]);
 }

 triangle(positions,colors,a,b,c,color){
  for(const p of [a,b,c])positions.push(p.x,p.y,p.z);
  for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
 }

 buildWallSpan(u0,u1,segments,seedOffset){
  const T=this.T;
  const terrain=this.world.terrain;
  const positions=[];
  const colors=[];
  const rows=[];

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const edgeV=terrain.cliffEdgeV(u);
   const highLocal={u,v:edgeV+1.35};
   const lowLocal={u,v:edgeV-1.35};
   const highWorld=terrain.cliffFormationWorld(highLocal.u,highLocal.v);
   const lowWorld=terrain.cliffFormationWorld(lowLocal.u,lowLocal.v);
   const topY=this.world.heightAt(highWorld.x,highWorld.z)-.08;
   const bottomY=this.world.heightAt(lowWorld.x,lowWorld.z)-.05;
   const drop=Math.max(1.2,topY-bottomY);

   const sample=[];
   const rowFractions=[0,.31,.66,1];
   for(let r=0;r<4;r++){
    const localSeed=seedOffset+i*31+r*7;
    const jitterU=r===0?0:(this.rand(localSeed)-.5)*.42;
    let outward=0;
    if(r===0)outward=-.06;
    else if(r===1)outward=-(.34+this.rand(localSeed+2)*.42);
    else if(r===2)outward=-(.28+this.rand(localSeed+3)*.62);
    else outward=-(.08+this.rand(localSeed+4)*.28);

    const pLocalU=u+jitterU;
    const pLocalV=terrain.cliffEdgeV(pLocalU)+outward;
    const w=terrain.cliffFormationWorld(pLocalU,pLocalV);
    let y=topY-drop*rowFractions[r];
    if(r===1)y-=drop*(this.rand(localSeed+5)-.5)*.10;
    if(r===2)y-=drop*(this.rand(localSeed+6)-.5)*.12;
    if(r===3)y=bottomY+.02;
    sample.push(new T.Vector3(w.x,y,w.z));
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<3;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    const topBand=r===0;
    const colorA=this.rockColor(seedOffset+i*43+r*11,topBand);
    const colorB=this.rockColor(seedOffset+i*43+r*11+5,topBand);
    if((i+r)%2===0){
     this.triangle(positions,colors,a,b,c,colorA);
     this.triangle(positions,colors,a,c,d,colorB);
    }else{
     this.triangle(positions,colors,a,b,d,colorA);
     this.triangle(positions,colors,b,c,d,colorB);
    }
   }
  }

  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,this.materials.rock);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.name='ProceduralCliffWall';
  this.root.add(mesh);
 }

 buildCliffWall(){
  const spans=this.world.terrain.cliffWallSpans();
  spans.forEach((span,index)=>{
   const length=Math.max(1,span[1]-span[0]);
   const segments=Math.max(8,Math.round(length/1.35));
   this.buildWallSpan(span[0],span[1],segments,200+index*1000);
  });
 }

 buildBaseBoulders(){
  const T=this.T;
  const terrain=this.world.terrain;
  const spans=terrain.cliffWallSpans();
  const geo=new T.IcosahedronGeometry(1,0);

  let index=0;
  for(const [u0,u1] of spans){
   const count=Math.max(4,Math.round((u1-u0)/3.4));
   for(let i=0;i<count;i++){
    const seed=500+index*17;
    index++;
    if(this.rand(seed)>.72)continue;
    const u=u0+(u1-u0)*((i+.35+this.rand(seed+1)*.3)/count);
    const edgeV=terrain.cliffEdgeV(u);
    const v=edgeV-(1.7+this.rand(seed+2)*2.4);
    const p=terrain.cliffFormationWorld(u,v);
    const y=this.world.heightAt(p.x,p.z)-.05;
    const rock=new T.Mesh(geo,this.materials.boulder);
    const s=.45+this.rand(seed+3)*.78;
    rock.position.set(p.x,y,p.z);
    rock.rotation.set(this.rand(seed+4)*.25,this.rand(seed+5)*Math.PI*2,this.rand(seed+6)*.22);
    rock.scale.set(s*(.85+this.rand(seed+7)*.45),s*(.65+this.rand(seed+8)*.55),s*(.9+this.rand(seed+9)*.4));
    rock.castShadow=true;
    rock.receiveShadow=true;
    this.root.add(rock);
   }
  }
 }

 initialize(){
  this.scene.add(this.root);
  this.buildCliffWall();
  this.buildBaseBoulders();
 }
}
