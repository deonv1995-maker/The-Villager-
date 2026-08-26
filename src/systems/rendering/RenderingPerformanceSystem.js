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
  this.shadowHalfSize=27;
  this.shadowCasterRefreshInterval=.28;
  this.shadowCasterRefreshTimer=0;
  this.lastCasterSignature='';
  this.frameIndex=0;
  this.shadowUpdateStride=2;

  // Adaptive resolution is intentionally conservative. It only changes after a
  // multi-second sample so normal animation spikes do not resize the backbuffer.
  this.devicePixelRatio=Math.max(1,window.devicePixelRatio||1);
  this.maxPixelRatio=Math.min(this.devicePixelRatio,1.30);
  this.minPixelRatio=Math.min(1,this.maxPixelRatio);
  this.pixelRatio=this.maxPixelRatio;
  this.performanceTimer=0;
  this.performanceFrames=0;
  this.performanceElapsed=0;
  this.qualityChanges=0;
 }

 initialize(){
  this.configureRenderer();
  this.configureSun();
  this.scene.add(this.sunTarget);
  this.updateShadowAnchor(true);
  this.syncShadowCasters(true);
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
  shadow.mapSize.set(1024,1024);
  shadow.camera.near=.5;
  shadow.camera.far=105;
  shadow.camera.left=-this.shadowHalfSize;
  shadow.camera.right=this.shadowHalfSize;
  shadow.camera.top=this.shadowHalfSize;
  shadow.camera.bottom=-this.shadowHalfSize;
  shadow.camera.updateProjectionMatrix();
  shadow.bias=-.00035;
  shadow.normalBias=.035;
  shadow.radius=1.45;
  this.sun.target=this.sunTarget;
 }

 setCastShadow(object,enabled){
  if(!object)return;
  if(object.userData?.performanceShadowCaster===enabled)return;
  object.userData.performanceShadowCaster=enabled;
  object.traverse?.(child=>{
   if(!child.isMesh)return;
   child.castShadow=enabled;
   // Receiving a single directional shadow is much cheaper than casting one and
   // prevents nearby rocks/trees from looking detached from the terrain.
   child.receiveShadow=true;
  });
 }

 configurePlayerShadow(){
  this.player?.traverse?.(object=>{
   if(!object.isMesh)return;
   object.castShadow=true;
   object.receiveShadow=true;
  });
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
   if(type==='tree'||type==='bareTree')radius=31;
   else if(type==='rock')radius=25;
   else if(type==='bush')radius=18;
   // Fine/large grass never casts a shadow map silhouette. The ground still
   // receives tree, rock, cliff and character shadows underneath it.
   const enabled=radius>0&&this.casterDistanceSquared(object)<=radius*radius;
   this.setCastShadow(object,enabled);
  }
 }

 syncCliffCasters(){
  const root=this.world?.cliffRocks?.root;
  if(!root)return;
  const radius=31;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setCastShadow(object,enabled);
  }
 }

 syncFeatureCasters(){
  const root=this.world?.features?.root;
  if(!root)return;
  const radius=22;
  for(const object of root.children){
   const enabled=this.casterDistanceSquared(object)<=radius*radius;
   this.setCastShadow(object,enabled);
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
  if(!force&&signature===this.lastCasterSignature&&this.shadowCasterRefreshTimer<this.shadowCasterRefreshInterval)return;
  this.lastCasterSignature=signature;
  this.shadowCasterRefreshTimer=0;
  this.configurePlayerShadow();
  this.syncEnvironmentCasters();
  this.syncCliffCasters();
  this.syncFeatureCasters();
  this.renderer.shadowMap.needsUpdate=true;
 }

 updateShadowAnchor(force=false){
  if(!this.player||!this.sun)return;
  const px=this.player.position.x;
  const py=this.player.position.y;
  const pz=this.player.position.z;
  const dx=px-this.sunTarget.position.x;
  const dz=pz-this.sunTarget.position.z;
  if(!force&&dx*dx+dz*dz<1.4*1.4)return;

  // Move both light and target together so the sun direction never changes while
  // the high-resolution shadow window follows the playable area around Ranger.
  this.sunTarget.position.set(px,py+1.0,pz);
  this.sun.position.set(
   px+this.sunOffset.x,
   py+this.sunOffset.y,
   pz+this.sunOffset.z
  );
  this.sun.target.updateMatrixWorld?.();
  this.renderer.shadowMap.needsUpdate=true;
 }

 applyPixelRatio(next){
  next=Math.max(this.minPixelRatio,Math.min(this.maxPixelRatio,next));
  next=Math.round(next*20)/20;
  if(Math.abs(next-this.pixelRatio)<.025)return;
  this.pixelRatio=next;
  this.renderer.setPixelRatio(this.pixelRatio);
  this.renderer.setSize(innerWidth,innerHeight,false);
  this.renderer.shadowMap.needsUpdate=true;
  this.qualityChanges++;
 }

 updateAdaptiveQuality(dt){
  this.performanceTimer+=dt;
  this.performanceElapsed+=dt;
  this.performanceFrames++;
  if(this.performanceTimer<2.5)return;

  const averageMs=this.performanceFrames>0
   ?this.performanceElapsed/this.performanceFrames*1000
   :16.7;

  // Prioritise a stable mobile frame rate. First reduce fill-rate pressure, then
  // reduce shadow refresh frequency if the device is still struggling.
  if(averageMs>22.5){
   if(this.pixelRatio>this.minPixelRatio+.02)this.applyPixelRatio(this.pixelRatio-.10);
   else this.shadowUpdateStride=3;
  }else if(averageMs<17.2){
   if(this.shadowUpdateStride>2)this.shadowUpdateStride=2;
   else if(this.pixelRatio<this.maxPixelRatio-.02&&this.qualityChanges<5){
    this.applyPixelRatio(this.pixelRatio+.05);
   }
  }

  this.performanceTimer=0;
  this.performanceElapsed=0;
  this.performanceFrames=0;
 }

 update(dt){
  this.frameIndex++;
  this.shadowCasterRefreshTimer+=dt;
  this.updateShadowAnchor(false);
  this.syncShadowCasters(false);
  this.updateAdaptiveQuality(dt);

  // Animated character shadows do not need a full shadow-map render every frame
  // on a phone. Updating at half rate is visually smooth while roughly halving
  // dynamic shadow-map work; slower devices can automatically drop to one-third.
  if(this.frameIndex%this.shadowUpdateStride===0){
   this.renderer.shadowMap.needsUpdate=true;
  }
 }
}
