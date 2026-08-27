export class RenderingPerformanceSystem{
 constructor(THREE,{renderer,scene,camera,world,player,sun}){
  this.T=THREE;
  this.renderer=renderer;
  this.scene=scene;
  this.camera=camera;
  this.world=world;
  this.player=player;
  this.sun=sun;

  this.isMobile=!!(
   globalThis.matchMedia?.('(pointer: coarse)')?.matches
   ||Math.min(globalThis.innerWidth||9999,globalThis.innerHeight||9999)<900
  );

  this.sunTarget=new THREE.Object3D();
  this.sunTarget.name='PerformanceShadowTarget';

  this.sunOffset=new THREE.Vector3(-28,44,24);
  this.shadowHalfSize=this.isMobile?26:28;
  this.shadowAnchorStep=this.isMobile?8.0:6.0;
  this.shadowCasterMoveThreshold=this.isMobile?8.0:6.0;
  this.lastCasterSignature='';
  this.lastCasterX=Infinity;
  this.lastCasterZ=Infinity;
  this.lastAnchorX=Infinity;
  this.lastAnchorZ=Infinity;
  this.shadowMaintenanceTimer=0;
  this.shadowMaintenanceInterval=this.isMobile?.14:.08;

  // The Ranger uses a cheap contact shadow instead of entering the directional
  // shadow map every frame. This keeps animated character cost independent from
  // the large static-world shadow map.
  this.contactShadow=null;
  this.contactShadowTexture=null;
  this.presentationReceiversConfigured=false;
  this.staticMaterialsConfigured=false;
  this.lambertCache=new WeakMap();

  // Mobile defaults to native CSS-pixel density at most. High-DPI phones often
  // have enough physical pixels to make 1.2x rendering disproportionately costly
  // without a visible gameplay benefit at arm's length.
  this.devicePixelRatio=Math.max(1,window.devicePixelRatio||1);
  this.maxPixelRatio=Math.min(this.devicePixelRatio,this.isMobile?1.00:1.20);
  this.minPixelRatio=Math.min(this.isMobile?.72:.90,this.maxPixelRatio);
  this.pixelRatio=this.maxPixelRatio;
  this.performanceTimer=0;
  this.performanceFrames=0;
  this.performanceElapsed=0;
  this.qualityCooldown=0;
  this.fastWindows=0;
 }

 initialize(){
  this.configureRenderer();
  this.configureSun();
  this.scene.add(this.sunTarget);
  this.createContactShadow();
  this.configurePlayerShadow();
  this.updateShadowAnchor(true);
  this.syncShadowCasters(true);
  this.configurePresentationReceivers();
  this.configureStaticMaterials();

  const environment=this.world?.environment;
  if(environment?.loadKayKit){
   environment.loadKayKit().then(()=>{
    this.configureStaticMaterials(true);
    this.syncShadowCasters(true);
    this.configurePresentationReceivers();
   }).catch(()=>{});
  }
  const cliffInit=this.world?.cliffRocks?.initializePromise;
  cliffInit?.then?.(()=>{
   this.configureStaticMaterials(true);
   this.syncShadowCasters(true);
  }).catch?.(()=>{});

  this.renderer.shadowMap.needsUpdate=true;
 }

 configureRenderer(){
  const T=this.T;
  this.renderer.setPixelRatio(this.pixelRatio);
  this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=T.PCFShadowMap;
  this.renderer.shadowMap.autoUpdate=false;
  this.renderer.shadowMap.needsUpdate=true;
 }

 configureSun(){
  const shadow=this.sun.shadow;
  this.sun.castShadow=true;
  const mapSize=this.isMobile?768:1024;
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
  shadow.radius=this.isMobile?1.15:1.35;
  this.sun.target=this.sunTarget;
 }

 createContactShadowTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=64;
  canvas.height=64;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const gradient=ctx.createRadialGradient(32,32,4,32,32,31);
  gradient.addColorStop(0,'rgba(0,0,0,0.72)');
  gradient.addColorStop(.48,'rgba(0,0,0,0.42)');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,64,64);
  const texture=new this.T.CanvasTexture(canvas);
  texture.generateMipmaps=false;
  texture.minFilter=this.T.LinearFilter;
  texture.magFilter=this.T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
 }

 createContactShadow(){
  const T=this.T;
  this.contactShadowTexture=this.createContactShadowTexture();
  const material=new T.MeshBasicMaterial({
   color:0x11140f,
   map:this.contactShadowTexture,
   transparent:true,
   opacity:.34,
   depthWrite:false,
   toneMapped:false,
   side:T.DoubleSide,
   polygonOffset:true,
   polygonOffsetFactor:-1,
   polygonOffsetUnits:-2
  });
  const geometry=new T.PlaneGeometry(1.65,1.10,1,1);
  geometry.rotateX(-Math.PI/2);
  const mesh=new T.Mesh(geometry,material);
  mesh.name='RangerContactShadow';
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  mesh.renderOrder=4;
  this.scene.add(mesh);
  this.contactShadow=mesh;
  this.updateContactShadow();
 }

 matteLambertFrom(material){
  if(!material?.isMeshStandardMaterial)return material;
  let cached=this.lambertCache.get(material);
  if(cached)return cached;

  const T=this.T;
  cached=new T.MeshLambertMaterial({
   color:material.color?.clone?.()||new T.Color(0xffffff),
   map:material.map||null,
   side:material.side,
   transparent:material.transparent,
   opacity:material.opacity,
   alphaTest:material.alphaTest,
   depthWrite:material.depthWrite,
   depthTest:material.depthTest,
   vertexColors:material.vertexColors,
   fog:material.fog
  });
  cached.name=`${material.name||'matte'}_MobileLambert`;
  this.lambertCache.set(material,cached);
  return cached;
 }

 optimizeMatteRoot(root){
  if(!root)return false;
  let changed=false;
  root.traverse?.(object=>{
   if(!object.isMesh)return;
   const materials=Array.isArray(object.material)?object.material:[object.material];
   let objectChanged=false;
   const optimized=materials.map(material=>{
    if(!material?.isMeshStandardMaterial)return material;
    if((material.metalness??0)>.08)return material;
    if((material.roughness??1)<.70)return material;
    const next=this.matteLambertFrom(material);
    if(next!==material){changed=true;objectChanged=true;}
    return next;
   });
   if(objectChanged)object.material=Array.isArray(object.material)?optimized:optimized[0];
  });
  return changed;
 }

 configureStaticMaterials(force=false){
  if(this.staticMaterialsConfigured&&!force)return;
  // KayKit forest/cliff assets are deliberately matte low-poly objects. Lambert
  // gives almost the same appearance here while removing unnecessary PBR work.
  this.optimizeMatteRoot(this.world?.environment?.root);
  this.optimizeMatteRoot(this.world?.cliffRocks?.root);
  this.optimizeMatteRoot(this.world?.features?.root);
  this.staticMaterialsConfigured=true;
 }

 setShadowState(object,{cast=false,receive=true}={}){
  if(!object)return;
  const key=`${cast?1:0}:${receive?1:0}`;
  if(object.userData?.performanceShadowState===key)return;
  object.userData.performanceShadowState=key;
  object.traverse?.(child=>{
   if(!child.isMesh)return;
   child.castShadow=cast;
   child.receiveShadow=receive;
  });
 }

 configurePlayerShadow(){
  this.player?.traverse?.(object=>{
   if(!object.isMesh)return;
   object.castShadow=false;
   object.receiveShadow=true;
  });
 }

 configurePresentationReceivers(){
  const fine=this.scene.getObjectByName?.('FineGrassFieldInstances');
  if(fine){
   fine.castShadow=false;
   fine.receiveShadow=false;
   if(!fine.userData.performanceMatteMaterial){
    const current=fine.material;
    if(current?.isMeshStandardMaterial)fine.material=this.matteLambertFrom(current);
    fine.userData.performanceMatteMaterial=true;
   }
   this.presentationReceiversConfigured=true;
  }
 }

 casterDistanceSquared(object){
  if(!object)return Infinity;
  const dx=(object.position?.x??0)-this.player.position.x;
  const dz=(object.position?.z??0)-this.player.position.z;
  return dx*dx+dz*dz;
 }

 syncEnvironmentCasters(){
  const root=this.world?.environment?.root;
  if(!root)return;
  for(const object of root.children){
   const type=object.userData?.environmentType;
   let radius=0;
   if(type==='tree'||type==='bareTree')radius=this.isMobile?29:32;
   else if(type==='rock')radius=this.isMobile?23:26;
   else if(type==='bush')radius=this.isMobile?15:18;

   if(type==='grass'){
    this.setShadowState(object,{cast:false,receive:false});
    continue;
   }

   const enabled=radius>0&&this.casterDistanceSquared(object)<=radius*radius;
   this.setShadowState(object,{cast:enabled,receive:true});
  }
 }

 syncCliffCasters(){
  const root=this.world?.cliffRocks?.root;
  if(!root)return;
  const radius=this.isMobile?29:32;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setShadowState(object,{cast:enabled,receive:true});
  }
 }

 syncFeatureCasters(){
  const root=this.world?.features?.root;
  if(!root)return;
  const radius=this.isMobile?20:23;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setShadowState(object,{cast:enabled,receive:true});
  }
 }

 casterSignature(){
  // Player child count is intentionally excluded. Picking up/placing a carried
  // prop changes that count, but the Ranger never casts into this shadow map.
  return [
   this.world?.environment?.root?.children?.length||0,
   this.world?.cliffRocks?.root?.children?.length||0,
   this.world?.features?.root?.children?.length||0
  ].join(':');
 }

 syncShadowCasters(force=false){
  const signature=this.casterSignature();
  const px=this.player?.position?.x??0;
  const pz=this.player?.position?.z??0;
  const dx=px-this.lastCasterX;
  const dz=pz-this.lastCasterZ;
  const moved=dx*dx+dz*dz>=this.shadowCasterMoveThreshold*this.shadowCasterMoveThreshold;

  if(!force&&signature===this.lastCasterSignature&&!moved)return false;

  this.lastCasterSignature=signature;
  this.lastCasterX=px;
  this.lastCasterZ=pz;
  this.configurePlayerShadow();
  this.syncEnvironmentCasters();
  this.syncCliffCasters();
  this.syncFeatureCasters();
  this.renderer.shadowMap.needsUpdate=true;
  return true;
 }

 updateShadowAnchor(force=false){
  if(!this.player||!this.sun)return false;
  const px=this.player.position.x;
  const pz=this.player.position.z;
  const dx=px-this.lastAnchorX;
  const dz=pz-this.lastAnchorZ;
  if(!force&&dx*dx+dz*dz<this.shadowAnchorStep*this.shadowAnchorStep)return false;

  const anchorX=Math.round(px/this.shadowAnchorStep)*this.shadowAnchorStep;
  const anchorZ=Math.round(pz/this.shadowAnchorStep)*this.shadowAnchorStep;
  const anchorY=this.world?.heightAt?.(anchorX,anchorZ)??this.player.position.y;

  this.lastAnchorX=anchorX;
  this.lastAnchorZ=anchorZ;
  this.sunTarget.position.set(anchorX,anchorY+1.0,anchorZ);
  this.sun.position.set(
   anchorX+this.sunOffset.x,
   anchorY+this.sunOffset.y,
   anchorZ+this.sunOffset.z
  );
  this.sun.target.updateMatrixWorld?.();
  this.renderer.shadowMap.needsUpdate=true;
  return true;
 }

 contactSupportHeight(){
  const x=this.player.position.x;
  const z=this.player.position.z;
  const footY=this.player.position.y;
  if(this.world?.landingSurfaceHeightAt){
   return this.world.landingSurfaceHeightAt(x,z,footY,false);
  }
  return this.world?.surfaceHeightAt?.(x,z)
   ??this.world?.heightAt?.(x,z)
   ??0;
 }

 updateContactShadow(){
  if(!this.contactShadow||!this.player)return;
  const supportY=this.contactSupportHeight();
  const height=Math.max(0,this.player.position.y-supportY);
  const strength=Math.max(0,Math.min(1,1-height/3.6));
  const scale=1+Math.min(.28,height*.065);

  this.contactShadow.position.set(
   this.player.position.x,
   supportY+.035,
   this.player.position.z
  );
  this.contactShadow.scale.set(scale,scale,1);
  this.contactShadow.material.opacity=.34*strength;
  this.contactShadow.visible=strength>.025;
 }

 applyPixelRatio(next){
  next=Math.max(this.minPixelRatio,Math.min(this.maxPixelRatio,next));
  next=Math.round(next*20)/20;
  if(Math.abs(next-this.pixelRatio)<.025)return false;
  this.pixelRatio=next;
  this.renderer.setPixelRatio(this.pixelRatio);
  this.renderer.setSize(innerWidth,innerHeight,false);
  this.qualityCooldown=this.isMobile?5:6;
  return true;
 }

 updateAdaptiveQuality(dt){
  this.qualityCooldown=Math.max(0,this.qualityCooldown-dt);
  this.performanceTimer+=dt;
  this.performanceElapsed+=dt;
  this.performanceFrames++;
  if(this.performanceTimer<3.5)return;

  const averageMs=this.performanceFrames>0
   ?this.performanceElapsed/this.performanceFrames*1000
   :16.7;

  if(this.qualityCooldown<=0){
   const slowThreshold=this.isMobile?20.5:23.5;
   const fastThreshold=this.isMobile?15.3:17.0;
   if(averageMs>slowThreshold){
    this.fastWindows=0;
    this.applyPixelRatio(this.pixelRatio-.10);
   }else if(averageMs<fastThreshold){
    this.fastWindows++;
    const windows=this.isMobile?4:3;
    if(this.fastWindows>=windows){
     this.applyPixelRatio(this.pixelRatio+.05);
     this.fastWindows=0;
    }
   }else{
    this.fastWindows=0;
   }
  }

  this.performanceTimer=0;
  this.performanceElapsed=0;
  this.performanceFrames=0;
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
