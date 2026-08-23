import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const DEFAULT_ANIMATION_ALIASES=Object.freeze({idle:['idle','stand','standing','breathing'],walk:['walk','walking','locomotion'],harvest:['chop','chopping','harvest','harvesting','axe','attack']});
function findClip(clips,aliases){const normalized=clips.map(clip=>({clip,name:clip.name.trim().toLowerCase()}));for(const alias of aliases){const exact=normalized.find(e=>e.name===alias);if(exact)return exact.clip;}for(const alias of aliases){const partial=normalized.find(e=>e.name.includes(alias));if(partial)return partial.clip;}return null;}
function setShadowFlags(root){root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(object.material)object.material.needsUpdate=true;});}
function normalizeModel(model,targetHeight){model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(!Number.isFinite(size.y)||size.y<=.001)throw new Error('Loaded character has invalid bounds.');model.scale.multiplyScalar(targetHeight/size.y);model.updateMatrixWorld(true);const scaledBounds=new THREE.Box3().setFromObject(model);model.position.y-=scaledBounds.min.y;model.updateMatrixWorld(true);}
function byName(root,name){let found=null;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;}
function makeMaterial(color,roughness=.88){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});}
function addFallbackHead(model){
  const headBone=byName(model,'Head'); if(!headBone)return false;
  let hasHeadMesh=false;model.traverse(o=>{if(o.isMesh&&/head|face|hair/i.test(o.name))hasHeadMesh=true;});if(hasHeadMesh)return false;
  const skin=makeMaterial(0xc98762),hair=makeMaterial(0x36251d),dark=makeMaterial(0x251a16);
  const g=new THREE.Group();g.name='TemporaryHeadVisual';g.position.set(0,.105,.005);headBone.add(g);
  const face=new THREE.Mesh(new THREE.DodecahedronGeometry(.115,1),skin);face.scale.set(.9,1.08,.86);face.castShadow=true;g.add(face);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.032,.075,5),skin);nose.position.set(0,-.005,.108);nose.rotation.x=Math.PI/2;g.add(nose);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.122,7,4,0,Math.PI*2,0,Math.PI*.55),hair);hairCap.position.y=.045;hairCap.castShadow=true;g.add(hairCap);
  const beard=new THREE.Mesh(new THREE.ConeGeometry(.105,.14,7),dark);beard.position.set(0,-.105,.035);beard.rotation.x=Math.PI;beard.scale.z=.82;beard.castShadow=true;g.add(beard);
  return true;
}
function createBonePose(model){
  const names=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r','spine_01','spine_02'];
  const bones={};for(const n of names){const b=byName(model,n);if(b)bones[n]={bone:b,rest:b.quaternion.clone()};}
  const q=new THREE.Quaternion(),e=new THREE.Euler();
  const apply=(name,x=0,y=0,z=0,blend=.18)=>{const entry=bones[name];if(!entry)return;e.set(x,y,z,'XYZ');q.setFromEuler(e);const target=entry.rest.clone().multiply(q);entry.bone.quaternion.slerp(target,blend);};
  return function pose(dt,state,time){
    const b=Math.min(1,dt*12);
    const moving=state==='walk',harvesting=state==='harvest';
    let swing=moving?Math.sin(time*8)*.42:0;
    // Lower arms from bind T-pose into a natural relaxed stance.
    apply('upperarm_l',moving?-swing*.35:0,0,1.22,b);apply('upperarm_r',moving?swing*.35:0,0,-1.22,b);
    apply('lowerarm_l',0,0,-.12,b);apply('lowerarm_r',0,0,.12,b);
    apply('thigh_l',moving?swing:0,0,0,b);apply('thigh_r',moving?-swing:0,0,0,b);
    apply('calf_l',moving?Math.max(0,-swing)*.32:0,0,0,b);apply('calf_r',moving?Math.max(0,swing)*.32:0,0,0,b);
    apply('spine_01',harvesting?.08:0,0,moving?Math.sin(time*8)*.03:0,b);apply('spine_02',harvesting?.08:0,0,0,b);
    if(harvesting){const chop=Math.sin(time*10);apply('upperarm_r',-.9+chop*.6,0,-.62,b);apply('lowerarm_r',-.55+chop*.35,0,.18,b);}
  };
}
export class GlbPlayerVisual{
 constructor({playerRoot,fallbackObjects,modelUrl,targetHeight=3.25,localGroundOffset=-.53,animationAliases=DEFAULT_ANIMATION_ALIASES}){this.playerRoot=playerRoot;this.fallbackObjects=fallbackObjects;this.modelUrl=modelUrl;this.targetHeight=targetHeight;this.animationAliases=animationAliases;this.container=new THREE.Group();this.container.name='ExternalPlayerVisual';this.container.position.y=localGroundOffset;this.playerRoot.add(this.container);this.mixer=null;this.actions=new Map();this.activeAction=null;this.loaded=false;this.failed=false;this.lastPosition=new THREE.Vector3();this.playerRoot.getWorldPosition(this.lastPosition);this.velocitySample=new THREE.Vector3();this.poseBones=null;this.elapsed=0;}
 async load(){const loader=new GLTFLoader();try{const gltf=await loader.loadAsync(this.modelUrl),model=gltf.scene||gltf.scenes?.[0];if(!model)throw new Error('Character asset contains no scene.');setShadowFlags(model);addFallbackHead(model);normalizeModel(model,this.targetHeight);this.container.add(model);if(gltf.animations?.length){this.mixer=new THREE.AnimationMixer(model);for(const[state,aliases]of Object.entries(this.animationAliases)){const clip=findClip(gltf.animations,aliases);if(!clip)continue;const action=this.mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);this.actions.set(state,action);}}if(!this.actions.size)this.poseBones=createBonePose(model);for(const object of this.fallbackObjects)object.visible=false;this.loaded=true;this.playState('idle',0);return true;}catch(error){this.failed=true;console.warn('[The Villager] external character unavailable; procedural fallback remains active.',error);return false;}}
 playState(state,fadeSeconds=.16){if(!this.loaded||!this.mixer)return;const next=this.actions.get(state)||this.actions.get('idle');if(!next||next===this.activeAction)return;if(this.activeAction)this.activeAction.fadeOut(fadeSeconds);next.reset().fadeIn(fadeSeconds).play();this.activeAction=next;}
 update(dt,{harvesting=false}={}){if(!this.loaded)return;this.elapsed+=dt;const now=new THREE.Vector3();this.playerRoot.getWorldPosition(now);this.velocitySample.copy(now).sub(this.lastPosition);const speed=dt>0?this.velocitySample.length()/dt:0;this.lastPosition.copy(now);const state=harvesting?'harvest':speed>.08?'walk':'idle';if(this.mixer)this.playState(state);else this.poseBones?.(dt,state,this.elapsed);this.mixer?.update(dt);}
}
export const PLAYER_GLB_CONTRACT=Object.freeze({preferredPath:'./assets/characters/villager-male.gltf',targetHeight:3.25,required:[],preferredAnimations:['Idle','Walk','Chop'],notes:'Self-contained glTF/GLB. Missing head/animations receive temporary presentation fallbacks until production assets are added.'});