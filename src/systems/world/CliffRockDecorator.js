export class CliffRockDecorator {
 constructor(THREE,{world,scene,environment}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.environment=environment;
  this.root=new THREE.Group();
  this.root.name='KayKitCliffRockDressing';
  this.seed=18437;
  this.rockSources=[];
  this.materials=[
   new THREE.MeshStandardMaterial({color:0x697572,roughness:.94,metalness:0,flatShading:true}),
   new THREE.MeshStandardMaterial({color:0x737e7a,roughness:.95,metalness:0,flatShading:true}),
   new THREE.MeshStandardMaterial({color:0x5f6b68,roughness:.96,metalness:0,flatShading:true}),
   new THREE.MeshStandardMaterial({color:0x848d87,roughness:.94,metalness:0,flatShading:true})
  ];
 }

 rand(n){
  const x=Math.sin(n*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 async initialize(){
  this.scene.add(this.root);
  try{
   await this.environment.loadKayKit();
   this.prepareRockSources();
   this.populate();
  }catch(err){
   console.error('[KayKit cliff rock dressing]',err);
  }
 }

 prepareRockSources(){
  const T=this.T;
  const sources=this.environment.prototypes?.rock||[];
  this.rockSources=sources.map((source,index)=>{
   const box=new T.Box3().setFromObject(source);
   const size=new T.Vector3();
   const center=new T.Vector3();
   box.getSize(size);
   box.getCenter(center);
   return {
    source,
    index,
    center,
    size,
    maxSize:Math.max(.001,size.x,size.y,size.z),
    height:Math.max(.001,size.y)
   };
  }).filter(entry=>Number.isFinite(entry.maxSize)&&entry.maxSize>.001);
 }

 chooseSource(seed,previousIndex=-1){
  if(!this.rockSources.length)return null;
  let index=Math.floor(this.rand(seed)*this.rockSources.length)%this.rockSources.length;
  if(this.rockSources.length>1&&index===previousIndex){
   index=(index+1+Math.floor(this.rand(seed+71)*(this.rockSources.length-1)))%this.rockSources.length;
  }
  return this.rockSources[index];
 }

 createRock(seed,targetSize,shape='face',previousIndex=-1){
  const source=this.chooseSource(seed,previousIndex);
  if(!source)return null;

  const wrapper=new this.T.Group();
  const rock=source.source.clone(true);
  rock.position.set(-source.center.x,-source.center.y,-source.center.z);
  wrapper.add(rock);

  const baseScale=targetSize/source.maxSize;
  let sx=.92+this.rand(seed+2)*.34;
  let sy=.82+this.rand(seed+3)*.28;
  let sz=.88+this.rand(seed+4)*.32;
  if(shape==='rim'){
   sx*=1.08;sy*=.72;sz*=1.06;
  }else if(shape==='base'){
   sx*=1.10;sy*=.76;sz*=1.08;
  }else{
   sy*=1.04;
  }
  wrapper.scale.set(baseScale*sx,baseScale*sy,baseScale*sz);

  const material=this.materials[Math.floor(this.rand(seed+5)*this.materials.length)%this.materials.length];
  rock.traverse(child=>{
   if(!child.isMesh)return;
   child.material=material;
   child.castShadow=false;
   child.receiveShadow=true;
  });

  wrapper.userData.cliffRockSource=source.index;
  wrapper.userData.cliffRockShape=shape;
  return wrapper;
 }

 placeFaceRock(frame,rowFraction,seed,targetSize,previousIndex){
  const rock=this.createRock(seed,targetSize,'face',previousIndex);
  if(!rock)return previousIndex;

  const lateral=(this.rand(seed+8)-.5)*.72;
  const projection=.18+this.rand(seed+9)*.32;
  rock.position.set(
   frame.x+frame.tangentX*lateral+frame.outwardX*projection,
   frame.topY-frame.drop*rowFraction+(this.rand(seed+10)-.5)*.28,
   frame.z+frame.tangentZ*lateral+frame.outwardZ*projection
  );
  rock.rotation.y=frame.tangentYaw+(this.rand(seed+11)-.5)*1.15;
  rock.rotation.x=(this.rand(seed+12)-.5)*.24;
  rock.rotation.z=(this.rand(seed+13)-.5)*.26;
  this.root.add(rock);
  return rock.userData.cliffRockSource;
 }

 placeRimRock(frame,seed,targetSize,previousIndex){
  const rock=this.createRock(seed,targetSize,'rim',previousIndex);
  if(!rock)return previousIndex;
  const tangentOffset=(this.rand(seed+20)-.5)*.95;
  const inward=-.20-this.rand(seed+21)*.24;
  rock.position.set(
   frame.x+frame.tangentX*tangentOffset+frame.outwardX*inward,
   frame.topY+targetSize*.08,
   frame.z+frame.tangentZ*tangentOffset+frame.outwardZ*inward
  );
  rock.rotation.y=frame.tangentYaw+(this.rand(seed+22)-.5)*1.45;
  rock.rotation.x=(this.rand(seed+23)-.5)*.13;
  rock.rotation.z=(this.rand(seed+24)-.5)*.13;
  this.root.add(rock);
  return rock.userData.cliffRockSource;
 }

 placeBaseRock(frame,seed,targetSize,previousIndex){
  const rock=this.createRock(seed,targetSize,'base',previousIndex);
  if(!rock)return previousIndex;

  const outward=1.05+this.rand(seed+30)*1.65;
  const tangent=(this.rand(seed+31)-.5)*2.25;
  const x=frame.x+frame.outwardX*outward+frame.tangentX*tangent;
  const z=frame.z+frame.outwardZ*outward+frame.tangentZ*tangent;
  const ground=this.world.heightAt(x,z);
  rock.position.set(x,ground+targetSize*.20,z);
  rock.rotation.y=this.rand(seed+32)*Math.PI*2;
  rock.rotation.x=(this.rand(seed+33)-.5)*.16;
  rock.rotation.z=(this.rand(seed+34)-.5)*.16;
  this.root.add(rock);
  return rock.userData.cliffRockSource;
 }

 populateSpan(formation,span,formationIndex,spanIndex){
  const terrain=this.world.terrain;
  const u0=span[0]+.55;
  const u1=span[1]-.55;
  if(u1<=u0)return;

  let u=u0;
  let column=0;
  let previous=-1;
  while(u<u1){
   const seed=formationIndex*17000+spanIndex*3100+column*173+29;
   const frame=terrain.cliffDecorationFrameFor(formation,u);
   if(frame&&frame.drop>1.15&&frame.rampMask<.30){
    const baseTarget=Math.max(1.65,Math.min(3.65,1.25+frame.drop*.44));
    const rows=frame.drop>4.2?[.18,.48,.78]:frame.drop>2.7?[.24,.66]:[.48];
    for(let r=0;r<rows.length;r++){
     const target=baseTarget*(.88+this.rand(seed+r*41)*.24);
     previous=this.placeFaceRock(frame,rows[r],seed+r*41,target,previous);
    }

    if(column%3===0&&this.rand(seed+90)>.28){
     const rimSize=Math.max(1.10,baseTarget*(.48+this.rand(seed+91)*.18));
     previous=this.placeRimRock(frame,seed+91,rimSize,previous);
    }

    if(column%2===0&&this.rand(seed+120)>.20){
     const baseSize=.75+this.rand(seed+121)*1.05;
     previous=this.placeBaseRock(frame,seed+121,baseSize,previous);
    }
   }

   const spacing=2.05+this.rand(seed+150)*1.35;
   u+=spacing;
   column++;
  }
 }

 populate(){
  this.root.clear();
  if(!this.rockSources.length)return 0;
  const terrain=this.world.terrain;
  const strips=terrain.getCliffDecorationStrips?.()||[];
  const before=this.root.children.length;
  strips.forEach(({formation,index,spans})=>{
   spans.forEach((span,spanIndex)=>this.populateSpan(formation,span,index,spanIndex));
  });
  return this.root.children.length-before;
 }
}
