export class RenderingPerformanceSystem{
 constructor(THREE,{renderer,scene,camera,world,player,sun}){
  this.T=THREE;
  this.renderer=renderer;
  this.scene=scene;
  this.camera=camera;
  this.world=world;
  this.player=player;
  this.sun=sun;
  this.isMobile=!!(globalThis.matchMedia?.('(pointer: coarse)')?.matches||Math.min(innerWidth,innerHeight)<900);

  this.sunTarget=new THREE.Object3D();
  this.sunTarget.name='PerformanceShadowTarget';
  this.sunOffset=new THREE.Vector3(-28,44,24);
  this.shadowHalfSize=this.isMobile?27:28;
  this.shadowAnchorStep=this.isMobile?8:6;
  this.shadowCasterMoveThreshold=this.isMobile?8:6;
  this.lastCasterSignature='';
  this.lastCasterX=Infinity;
  this.lastCasterZ=Infinity;
  this.lastAnchorX=Infinity;
  this.lastAnchorZ=Infinity;
  this.shadowMaintenanceTimer=0;
  this.shadowMaintenanceInterval=this.isMobile ? .14 : .08;

  this.contactShadow=null;
  this.contactShadowTexture=null;
  this.presentationReceiversConfigured=false;
  this.staticMaterialsConfigured=false;
  this.lambertCache=new WeakMap();

  this.devicePixelRatio=Math.max(1,window.devicePixelRatio||1);
  this.pixelRatio=Math.min(this.devicePixelRatio,this.isMobile?1.15:1.20);
  this.minPixelRatio=Math.min(.90,this.pixelRatio);
  this.performanceTimer=0;
  this.performanceFrames=0;
  this.performanceElapsed=0;
  this.qualityCooldown=0;
  this.fastWindows=0;
 }

 initialize(){
  this.renderer.setPixelRatio(this.pixelRatio);
  this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=this.T.PCFShadowMap;
  this.renderer.shadowMap.autoUpdate=false;
  this.configureSun();
  this.scene.add(this.sunTarget);
  this.createContactShadow();
  this.configurePlayerShadow();
  this.updateShadowAnchor(true);
  this.syncShadowCasters(true);
  this.configurePresentationReceivers();
  this.configureStaticMaterials();

  const environment=this.world?.environment;
  environment?.loadKayKit?.().then(()=>{
   this.configureStaticMaterials(true);
   this.syncShadowCasters(true);
   this.configurePresentationReceivers();
  }).catch(()=>{});
  this.world?.cliffRocks?.initializePromise?.then?.(()=>{
   this.configureStaticMaterials(true);
   this.syncShadowCasters(true);
  }).catch?.(()=>{});
  this.renderer.shadowMap.needsUpdate=true;
 }

 configureSun(){
  const shadow=this.sun.shadow;
  this.sun.castShadow=true;
  const mapSize=this.isMobile?896:1024;
  shadow.mapSize.set(mapSize,mapSize);
  shadow.camera.near=.5;
  shadow.camera.far=108;
  shadow.camera.left=-this.shadowHalfSize;
  shadow.camera.right=this.shadowHalfSize;
  shadow.camera.top=this.shadowHalfSize;
  shadow.camera.bottom=-this.shadowHalfSize;
  shadow.camera.updateProjectionMatrix();
  shadow.bias=-.00032;
  shadow.normalBias=.040;
  shadow.radius=this.isMobile?1.20:1.35;
  this.sun.target=this.sunTarget;
 }

 createContactShadow(){
  const T=this.T;
  const canvas=document.createElement('canvas');
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');
  if(ctx){
   const gradient=ctx.createRadialGradient(32,32,4,32,32,31);
   gradient.addColorStop(0,'rgba(0,0,0,.72)');
   gradient.addColorStop(.48,'rgba(0,0,0,.42)');
   gradient.addColorStop(1,'rgba(0,0,0,0)');
   ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
   this.contactShadowTexture=new T.CanvasTexture(canvas);
   this.contactShadowTexture.generateMipmaps=false;
   this.contactShadowTexture.minFilter=T.LinearFilter;
   this.contactShadowTexture.magFilter=T.LinearFilter;
  }
  const material=new T.MeshBasicMaterial({
   color:0x11140f,map:this.contactShadowTexture,transparent:true,opacity:.34,
   depthWrite:false,toneMapped:false,side:T.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2
  });
  const geometry=new T.PlaneGeometry(1.65,1.10,1,1);
  geometry.rotateX(-Math.PI/2);
  const mesh=new T.Mesh(geometry,material);
  mesh.name='RangerContactShadow';
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.renderOrder=4;
  this.scene.add(mesh);
  this.contactShadow=mesh;
  this.updateContactShadow();
 }

 matteLambertFrom(material){
  if(!material?.isMeshStandardMaterial)return material;
  let cached=this.lambertCache.get(material);
  if(cached)return cached;
  cached=new this.T.MeshLambertMaterial({
   color:material.color?.clone?.()||new this.T.Color(0xffffff),
   map:material.map||null,side:material.side,transparent:material.transparent,
   opacity:material.opacity,alphaTest:material.alphaTest,depthWrite:material.depthWrite,
   depthTest:material.depthTest,vertexColors:material.vertexColors,fog:material.fog
  });
  this.lambertCache.set(material,cached);
  return cached;
 }

 optimizeMatteRoot(root){
  root?.traverse?.(object=>{
   if(!object.isMesh)return;
   const source=Array.isArray(object.material)?object.material:[object.material];
   let changed=false;
   const optimized=source.map(material=>{
    if(!material?.isMeshStandardMaterial)return material;
    if((material.metalness??0)>.08||(material.roughness??1)<.70)return material;
    changed=true;
    return this.matteLambertFrom(material);
   });
   if(changed)object.material=Array.isArray(object.material)?optimized:optimized[0];
  });
 }

 configureStaticMaterials(force=false){
  if(this.staticMaterialsConfigured&&!force)return;
  this.optimizeMatteRoot(this.world?.environment?.root);
  this.optimizeMatteRoot(this.world?.cliffRocks?.root);
  this.optimizeMatteRoot(this.world?.features?.root);
  this.staticMaterialsConfigured=true;
 }

 configurePlayerShadow(){
  this.player?.traverse?.(object=>{
   if(object.isMesh){object.castShadow=false;object.receiveShadow=true;}
  });
 }

 configurePresentationReceivers(){
  const fine=this.scene.getObjectByName?.('FineGrassFieldInstances');
  if(!fine)return;
  fine.castShadow=false;fine.receiveShadow=false;
  if(!fine.userData.performanceMatteMaterial){
   if(fine.material?.isMeshStandardMaterial)fine.material=this.matteLambertFrom(fine.material);
   fine.userData.performanceMatteMaterial=true;
  }
  this.presentationReceiversConfigured=true;
 }

 setShadowState(object,cast,receive=true){
  if(!object)return;
  const key=`${cast?1:0}:${receive?1:0}`;
  if(object.userData?.performanceShadowState===key)return;
  object.userData.performanceShadowState=key;
  object.traverse?.(child=>{
   if(child.isMesh){child.castShadow=cast;child.receiveShadow=receive;}
  });
 }

 casterDistanceSquared(object){
  const dx=(object?.position?.x??0)-this.player.position.x;
  const dz=(object?.position?.z??0)-this.player.position.z;
  return dx*dx+dz*dz;
 }

 syncEnvironmentCasters(){
  const root=this.world?.environment?.root;
  if(!root)return;
  for(const object of root.children){
   const type=object.userData?.environmentType;
   if(type==='grass'){this.setShadowState(object,false,false);continue;}
   let radius=0;
   if(type==='tree'||type==='bareTree')radius=this.isMobile?30:32;
   else if(type==='rock')radius=this.isMobile?24:26;
   else if(type==='bush')radius=this.isMobile?16:18;
   this.setShadowState(object,radius>0&&this.casterDistanceSquared(object)<=radius*radius,true);
  }
 }

 syncGroupCasters(root,radius){
  if(!root)return;
  for(const object of root.children)this.setShadowState(object,this.casterDistanceSquared(object)<=radius*radius,true);
 }

 casterSignature(){
  return [
   this.world?.environment?.root?.children?.length||0,
   this.world?.cliffRocks?.root?.children?.length||0,
   this.world?.features?.root?.children?.length||0
  ].join(':');
 }

 syncShadowCasters(force=false){
  const signature=this.casterSignature();
  const px=this.player?.position?.x??0,pz=this.player?.position?.z??0;
  const dx=px-this.lastCasterX,dz=pz-this.lastCasterZ;
  const moved=dx*dx+dz*dz>=this.shadowCasterMoveThreshold*this.shadowCasterMoveThreshold;
  if(!force&&signature===this.lastCasterSignature&&!moved)return false;

  this.lastCasterSignature=signature;
  this.lastCasterX=px;this.lastCasterZ=pz;
  this.configurePlayerShadow();
  this.syncEnvironmentCasters();
  this.syncGroupCasters(this.world?.cliffRocks?.root,this.isMobile?30:32);
  this.syncGroupCasters(this.world?.features?.root,this.isMobile?21:23);
  this.renderer.shadowMap.needsUpdate=true;
  return true;
 }

 updateShadowAnchor(force=false){
  const px=this.player.position.x,pz=this.player.position.z;
  const dx=px-this.lastAnchorX,dz=pz-this.lastAnchorZ;
  if(!force&&dx*dx+dz*dz<this.shadowAnchorStep*this.shadowAnchorStep)return false;
  const x=Math.round(px/this.shadowAnchorStep)*this.shadowAnchorStep;
  const z=Math.round(pz/this.shadowAnchorStep)*this.shadowAnchorStep;
  const y=this.world?.heightAt?.(x,z)??this.player.position.y;
  this.lastAnchorX=x;this.lastAnchorZ=z;
  this.sunTarget.position.set(x,y+1,z);
  this.sun.position.set(x+this.sunOffset.x,y+this.sunOffset.y,z+this.sunOffset.z);
  this.sun.target.updateMatrixWorld?.();
  this.renderer.shadowMap.needsUpdate=true;
  return true;
 }

 updateContactShadow(){
  if(!this.contactShadow||!this.player)return;
  const x=this.player.position.x,z=this.player.position.z,footY=this.player.position.y;
  const supportY=this.world?.landingSurfaceHeightAt?.(x,z,footY,false)
   ??this.world?.surfaceHeightAt?.(x,z)
   ??this.world?.heightAt?.(x,z)
   ??0;
  const height=Math.max(0,footY-supportY);
  const strength=Math.max(0,Math.min(1,1-height/3.6));
  const scale=1+Math.min(.28,height*.065);
  this.contactShadow.position.set(x,supportY+.035,z);
  this.contactShadow.scale.set(scale,scale,1);
  this.contactShadow.material.opacity=.34*strength;
  this.contactShadow.visible=strength>.025;
 }

 updateAdaptiveQuality(dt){
  if(this.isMobile)return;
  this.qualityCooldown=Math.max(0,this.qualityCooldown-dt);
  this.performanceTimer+=dt;
  this.performanceElapsed+=dt;
  this.performanceFrames++;
  if(this.performanceTimer<4)return;
  const averageMs=this.performanceElapsed/Math.max(1,this.performanceFrames)*1000;
  if(this.qualityCooldown<=0){
   let next=this.pixelRatio;
   if(averageMs>23.5){this.fastWindows=0;next-=.10;}
   else if(averageMs<17){
    this.fastWindows++;
    if(this.fastWindows>=3){next+=.05;this.fastWindows=0;}
   }else this.fastWindows=0;
   next=Math.max(this.minPixelRatio,Math.min(1.20,next));
   next=Math.round(next*20)/20;
   if(Math.abs(next-this.pixelRatio)>=.025){
    this.pixelRatio=next;
    this.renderer.setPixelRatio(next);
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.qualityCooldown=6;
   }
  }
  this.performanceTimer=0;this.performanceElapsed=0;this.performanceFrames=0;
 }

 update(dt){
  this.updateContactShadow();
  this.shadowMaintenanceTimer-=dt;
  if(this.shadowMaintenanceTimer<=0){
   this.shadowMaintenanceTimer=this.shadowMaintenanceInterval;
   this.updateShadowAnchor(false);
   this.syncShadowCasters(false);
   if(!this.presentationReceiversConfigured)this.configurePresentationReceivers();
  }
  this.updateAdaptiveQuality(dt);
 }
}
