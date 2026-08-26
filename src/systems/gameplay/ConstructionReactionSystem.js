export class ConstructionReactionSystem{
 constructor(THREE,{world,scene,player,materials}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.materials=materials;
  this.root=new THREE.Group();
  this.root.name='ConstructionReactions';
  this.sites=[];
  this.scanTimer=0;
  this.scanInterval=.22;
  this.nextSiteId=1;
  this.flameMaterial=new THREE.MeshBasicMaterial({color:0xff9b3d,transparent:true,opacity:.92});
  this.flameCoreMaterial=new THREE.MeshBasicMaterial({color:0xffd96a,transparent:true,opacity:.90});
  this.flameGeometry=new THREE.ConeGeometry(.18,.62,6);
  this.coreGeometry=new THREE.ConeGeometry(.11,.42,6);
 }

 initialize(){
  this.scene.add(this.root);
  this.world.constructionReactions=this;
 }

 siteKey(type,x,z){
  return `${type}:${Math.round(x*2)}:${Math.round(z*2)}`;
 }

 nearbyPlaced(type,x,z,range){
  const r2=range*range;
  return this.materials.placedItems(type).filter(item=>{
   const dx=item.object.position.x-x;
   const dz=item.object.position.z-z;
   return dx*dx+dz*dz<=r2;
  });
 }

 radialStats(items,cx,cz){
  if(!items.length)return {mean:0,std:Infinity};
  const radii=items.map(item=>Math.hypot(item.object.position.x-cx,item.object.position.z-cz));
  const mean=radii.reduce((a,b)=>a+b,0)/radii.length;
  const variance=radii.reduce((sum,r)=>sum+(r-mean)*(r-mean),0)/radii.length;
  return {mean,std:Math.sqrt(variance)};
 }

 recognizeFromStone(seedStone){
  const sx=seedStone.object.position.x;
  const sz=seedStone.object.position.z;
  const stones=this.nearbyPlaced('stone',sx,sz,2.35);
  if(stones.length<6)return null;

  const cx=stones.reduce((s,item)=>s+item.object.position.x,0)/stones.length;
  const cz=stones.reduce((s,item)=>s+item.object.position.z,0)/stones.length;
  const near=this.nearbyPlaced('stone',cx,cz,1.35);
  if(near.length<6)return null;

  const ys=near.map(item=>item.object.position.y);
  const verticalRange=Math.max(...ys)-Math.min(...ys);
  const stats=this.radialStats(near,cx,cz);
  const logs=this.nearbyPlaced('log',cx,cz,.72);

  // A furnace is not a prefab. It emerges from enough stones being stacked into
  // a compact shell with fuel physically placed inside it.
  if(near.length>=10&&verticalRange>.42&&stats.mean<.92&&logs.length>=1){
   return {type:'furnace',x:cx,z:cz,stones:near,logs};
  }

  // A campfire emerges from a low stone ring with logs physically laid in its
  // centre. The radial tolerance is intentionally generous for touch placement.
  if(verticalRange<.48
   &&near.length>=6
   &&stats.mean>=.45
   &&stats.mean<=1.10
   &&stats.std<=.30
   &&logs.length>=2){
   return {type:'campfire',x:cx,z:cz,stones:near,logs};
  }
  return null;
 }

 recognizeSites(){
  const candidates=[];
  const seen=new Set();
  for(const stone of this.materials.placedItems('stone')){
   const candidate=this.recognizeFromStone(stone);
   if(!candidate)continue;
   const key=this.siteKey(candidate.type,candidate.x,candidate.z);
   if(seen.has(key))continue;
   seen.add(key);
   candidates.push({...candidate,key});
  }

  for(const candidate of candidates){
   let site=this.sites.find(existing=>existing.key===candidate.key);
   if(!site){
    site={
     id:this.nextSiteId++,
     key:candidate.key,
     type:candidate.type,
     x:candidate.x,
     z:candidate.z,
     stones:candidate.stones,
     logs:candidate.logs,
     lit:false,
     flame:null
    };
    this.sites.push(site);
   }else{
    site.x=candidate.x;
    site.z=candidate.z;
    site.stones=candidate.stones;
    site.logs=candidate.logs;
   }
  }
 }

 createFlame(site){
  const T=this.T;
  const group=new T.Group();
  group.name=site.type==='furnace'?'FurnaceFire':'CampfireFlame';
  const flame=new T.Mesh(this.flameGeometry,this.flameMaterial);
  const core=new T.Mesh(this.coreGeometry,this.flameCoreMaterial);
  flame.position.y=.31;
  core.position.y=.22;
  group.add(flame,core);
  const y=this.world?.heightAt?.(site.x,site.z)??0;
  group.position.set(site.x,y+.22,site.z);
  group.userData.phase=site.id*.73;
  this.root.add(group);
  site.flame=group;
 }

 light(site){
  if(!site||site.lit)return false;
  site.lit=true;
  this.createFlame(site);
  return true;
 }

 findInteraction(range=2.5){
  if(!this.player)return null;
  const px=this.player.position.x,pz=this.player.position.z;
  let best=null,bestDistance=Infinity;
  for(const site of this.sites){
   if(site.lit)continue;
   const d=Math.hypot(site.x-px,site.z-pz);
   if(d<=range&&d<bestDistance){best=site;bestDistance=d;}
  }
  if(!best)return null;
  return {
   site:best,
   label:best.type==='furnace'?'LIGHT FURNACE':'LIGHT FIRE'
  };
 }

 update(dt){
  this.scanTimer-=dt;
  if(this.scanTimer<=0){
   this.scanTimer=this.scanInterval;
   this.recognizeSites();
  }

  const time=performance.now()*.001;
  for(const site of this.sites){
   const flame=site.flame;
   if(!flame)continue;
   const phase=flame.userData.phase||0;
   const flicker=1+Math.sin(time*9+phase)*.08+Math.sin(time*14+phase*.7)*.04;
   flame.scale.set(flicker,1/flicker*.98+0.04,flicker);
   flame.rotation.y=Math.sin(time*3.7+phase)*.12;
  }
 }
}
