export class RenderingPerformanceSystem{
 constructor(THREE,{renderer,scene,camera,world,player,sun}){
  this.T=THREE;
  this.renderer=renderer;
  this.scene=scene;
  this.camera=camera;
  this.world=world;
  this.player=player;
  this.sun=sun;

  this.sunTarget=new THREE.Object3D();
  this.sunTarget.name='PerformanceShadowTarget';

  this.sunOffset=new THREE.Vector3(-28,44,24);
  this.shadowHalfSize=28;
  this.shadowAnchorStep=6.0;
  this.shadowCasterMoveThreshold=6.0;
  this.lastCasterSignature='';
  this.lastCasterX=Infinity;
  this.lastCasterZ=Infinity;
  this.lastAnchorX=Infinity;
  this.lastAnchorZ=Infinity;

  // The Ranger uses a cheap contact shadow instead of entering the directional
  // shadow map every frame. This removes the alternating heavy/light render
  // frames that caused visible vibration on mobile while moving.
  this.contactShadow=null;
  this.contactShadowTexture=null;
  this.presentationReceiversConfigured=false;

  // Conservative adaptive resolution. Changes are deliberately infrequent so
  // the backbuffer is never resized repeatedly while the player is moving.
  this.devicePixelRatio=Math.max(1,window.devicePixelRatio||1);
  this.maxPixelRatio=Math.min(this.devicePixelRatio,1.20);
  this.minPixelRatio=Math.min(.90,this.maxPixelRatio);
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

  // Environment assets populate asynchronously. Refresh exactly once when they
  // become available rather than polling/traversing the whole forest constantly.
  const environment=this.world?.environment;
  if(environment?.loadKayKit){
   environment.loadKayKit().then(()=>{
    this.syncShadowCasters(true);
    this.configurePresentationReceivers();
   }).catch(()=>{});
  }
  const cliffInit=this.world?.cliffRocks?.initializePromise;
  cliffInit?.then?.(()=>this.syncShadowCasters(true)).catch?.(()=>{});

  this.renderer.shadowMap.needsUpdate=true;
 }

 configureRenderer(){
  const T=this.T;
  this.renderer.setPixelRatio(this.pixelRatio);
  this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=T.PCFShadowMap;

  // World geometry is static, so render the directional shadow map only when
  // its player-centred window or caster set actually changes.
  this.renderer.shadowMap.autoUpdate=false;
  this.renderer.shadowMap.needsUpdate=true;
 }

 configureSun(){
  const shadow=this.sun.shadow;
  this.sun.castShadow=true;
  shadow.mapSize.set(1024,1024);
  shadow.camera.near=.5;
  shadow.camera.far=108;
  shadow.camera.left=-this.shadowHalfSize;
  shadow.camera.right=this.shadowHalfSize;
  shadow.camera.top=this.shadowHalfSize;
  shadow.camera.bottom=-this.shadowHalfSize;
  shadow.camera.updateProjectionMatrix();
  shadow.bias=-.00032;
  shadow.normalBias=.040;
  shadow.radius=1.35;
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
  // Animated skinned meshes no longer invalidate the 1024px world shadow map.
  // The Ranger still receives world shadows, while the contact decal supplies a
  // smooth real-time grounding shadow under his feet.
  this.player?.traverse?.(object=>{
   if(!object.isMesh)return;
   object.castShadow=false;
   object.receiveShadow=true;
  });
 }

 configurePresentationReceivers(){
  // Dense instanced grass already has lighting variation and would otherwise
  // pay a shadow lookup for every blade fragment. Let the ground beneath it show
  // tree/rock shadows instead.
  const fine=this.scene.getObjectByName?.('FineGrassFieldInstances');
  if(fine){
   fine.castShadow=false;
   fine.receiveShadow=false;
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
   if(type==='tree'||type==='bareTree')radius=32;
   else if(type==='rock')radius=26;
   else if(type==='bush')radius=18;

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
  const radius=32;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setShadowState(object,{cast:enabled,receive:true});
  }
 }

 syncFeatureCasters(){
  const root=this.world?.features?.root;
  if(!root)return;
  const radius=23;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setShadowState(object,{cast:enabled,receive:true});
  }
 }

 casterSignature(){
  return [
   this.world?.environment?.root?.children?.length||0,
   this.world?.cliffRocks?.root?.children?.length||0,
   this.world?.features?.root?.children?.length||0,
   this.player?.children?.length||0
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

  // Snap the shadow window to a coarse world grid. Static tree/rock shadows then
  // stay perfectly still between updates instead of swimming across the ground
  // with every tiny player movement.
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
  this.qualityCooldown=6;
  return true;
 }

 updateAdaptiveQuality(dt){
  this.qualityCooldown=Math.max(0,this.qualityCooldown-dt);
  this.performanceTimer+=dt;
  this.performanceElapsed+=dt;
  this.performanceFrames++;
  if(this.performanceTimer<4.0)return;

  const averageMs=this.performanceFrames>0
   ?this.performanceElapsed/this.performanceFrames*1000
   :16.7;

  if(this.qualityCooldown<=0){
   if(averageMs>23.5){
    this.fastWindows=0;
    this.applyPixelRatio(this.pixelRatio-.10);
   }else if(averageMs<17.0){
    this.fastWindows++;
    if(this.fastWindows>=3){
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
  this.updateShadowAnchor(false);
  this.syncShadowCasters(false);
  if(!this.presentationReceiversConfigured)this.configurePresentationReceivers();
  this.updateAdaptiveQuality(dt);

  // No periodic shadow refresh here. Static world shadows only rerender when the
  // shadow window or nearby caster set changes, eliminating the frame-to-frame
  // GPU cost oscillation that made the Ranger appear to vibrate while running.
 }
}
