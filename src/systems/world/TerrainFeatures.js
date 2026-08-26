export class TerrainFeatures {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.root=new THREE.Group();
  this.root.name='ProceduralTerrainDetails';
  this.seed=9413;
  this.materials={
   boulder:new THREE.MeshStandardMaterial({color:0x747f7a,roughness:.96,metalness:0,flatShading:true}),
   cliffSeal:new THREE.MeshStandardMaterial({
    color:0x66716d,
    roughness:.98,
    metalness:0,
    flatShading:true,
    side:THREE.DoubleSide,
    depthWrite:true
   })
  };
 }

 rand(i){
  const x=Math.sin(i*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 buildCliffBackstopSpan(u0,u1){
  const T=this.T;
  const terrain=this.world.terrain;
  const extension=3.15;
  const start=u0-extension;
  const end=u1+extension;
  const segments=Math.max(28,Math.round((end-start)/.52));
  const positions=[];
  const indices=[];

  const smooth=(a,b,x)=>{
   if(a===b)return x>=b?1:0;
   const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
   return t*t*(3-2*t);
  };

  for(let i=0;i<=segments;i++){
   const u=start+(end-start)*(i/segments);
   let taper=1;
   if(u<u0)taper=smooth(start,u0,u);
   else if(u>u1)taper=1-smooth(u1,end,u);

   const edgeV=terrain.cliffEdgeV(u);
   const sealWorld=terrain.cliffFormationWorld(u,edgeV-.16);
   const highWorld=terrain.cliffFormationWorld(u,edgeV+1.22);
   const lowWorld=terrain.cliffFormationWorld(u,edgeV-2.05);

   const naturalY=this.world.heightAt(sealWorld.x,sealWorld.z)-.035;
   const highY=this.world.heightAt(highWorld.x,highWorld.z)-.085;
   const lowY=this.world.heightAt(lowWorld.x,lowWorld.z)-.11;

   let topY=naturalY+(highY-naturalY)*taper;
   let bottomY=naturalY+(lowY-naturalY)*taper;
   if(topY<bottomY){const temp=topY;topY=bottomY;bottomY=temp;}
   if(topY-bottomY<.06)bottomY=topY-.06;

   positions.push(sealWorld.x,topY,sealWorld.z);
   positions.push(sealWorld.x,bottomY,sealWorld.z);
  }

  for(let i=0;i<segments;i++){
   const a=i*2;
   const b=a+1;
   const c=a+2;
   const d=a+3;
   if(i%2===0)indices.push(a,c,d,a,d,b);
   else indices.push(a,c,b,c,d,b);
  }

  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mesh=new T.Mesh(geo,this.materials.cliffSeal);
  mesh.name='CliffHiddenBackstop';
  mesh.receiveShadow=true;
  mesh.castShadow=false;
  this.root.add(mesh);
 }

 buildCliffBackstops(){
  const terrain=this.world.terrain;
  for(const [u0,u1] of terrain.cliffWallSpans()){
   this.buildCliffBackstopSpan(u0,u1);
  }
 }

 buildBaseBoulders(){
  const T=this.T;
  const terrain=this.world.terrain;
  const spans=terrain.cliffWallSpans();
  const geo=new T.IcosahedronGeometry(1,0);

  let index=0;
  for(const [u0,u1] of spans){
   const count=Math.max(5,Math.round((u1-u0)/3.0));
   for(let i=0;i<count;i++){
    const seed=500+index*17;
    index++;
    if(this.rand(seed)>.68)continue;

    const u=u0+(u1-u0)*((i+.28+this.rand(seed+1)*.44)/count);
    const edgeV=terrain.cliffEdgeV(u);
    const v=edgeV-(1.8+this.rand(seed+2)*2.8);
    const p=terrain.cliffFormationWorld(u,v);
    const y=this.world.heightAt(p.x,p.z)-.05;

    const rock=new T.Mesh(geo,this.materials.boulder);
    const s=.42+this.rand(seed+3)*.86;
    rock.position.set(p.x,y,p.z);
    rock.rotation.set(this.rand(seed+4)*.28,this.rand(seed+5)*Math.PI*2,this.rand(seed+6)*.24);
    rock.scale.set(
     s*(.78+this.rand(seed+7)*.55),
     s*(.58+this.rand(seed+8)*.62),
     s*(.82+this.rand(seed+9)*.50)
    );
    rock.castShadow=true;
    rock.receiveShadow=true;
    this.root.add(rock);

    if(this.rand(seed+10)>.72){
     const small=new T.Mesh(geo,this.materials.boulder);
     const ss=s*(.28+this.rand(seed+11)*.28);
     small.position.set(
      p.x+(this.rand(seed+12)-.5)*2.2,
      this.world.heightAt(p.x+(this.rand(seed+12)-.5)*2.2,p.z+(this.rand(seed+13)-.5)*2.2)-.03,
      p.z+(this.rand(seed+13)-.5)*2.2
     );
     small.rotation.y=this.rand(seed+14)*Math.PI*2;
     small.scale.set(ss*1.2,ss*.8,ss);
     small.castShadow=true;
     small.receiveShadow=true;
     this.root.add(small);
    }
   }
  }
 }

 initialize(){
  this.scene.add(this.root);
  // The visible cliff still comes from IslandTerrain. These backstops sit just
  // behind that face and taper into the untouched ground beyond each endpoint.
  // They are intentionally hidden under normal viewing conditions and exist to
  // guarantee that no ocean/sky can ever show through a residual seam.
  this.buildCliffBackstops();
  this.buildBaseBoulders();
 }
}
