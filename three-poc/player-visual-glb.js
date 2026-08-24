import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const DEFAULT_ANIMATION_ALIASES=Object.freeze({idle:['idle','stand','standing','breathing'],walk:['walk','walking','locomotion'],harvest:['chop','chopping','harvest','harvesting','axe','attack']});
function findClip(clips,aliases){const normalized=clips.map(clip=>({clip,name:clip.name.trim().toLowerCase()}));for(const alias of aliases){const exact=normalized.find(e=>e.name===alias);if(exact)return exact.clip;}for(const alias of aliases){const partial=normalized.find(e=>e.name.includes(alias));if(partial)return partial.clip;}return null;}
function setShadowFlags(root){root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(object.material)object.material.needsUpdate=true;});}
function normalizeModel(model,targetHeight){model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(!Number.isFinite(size.y)||size.y<=.001)throw new Error('Loaded character has invalid bounds.');model.scale.multiplyScalar(targetHeight/size.y);model.updateMatrixWorld(true);const scaledBounds=new THREE.Box3().setFromObject(model);model.position.y-=scaledBounds.min.y;model.updateMatrixWorld(true);}
function byName(root,name){let found=null;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;}
function makeMaterial(color,roughness=.88){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});}
function addFallbackHead(model){const headBone=byName(model,'Head');if(!headBone)return false;let hasHeadMesh=false;model.traverse(o=>{if(o.isMesh&&/head|face|hair/i.test(o.name))hasHeadMesh=true;});if(hasHeadMesh)return false;const skin=makeMaterial(0xc98762),hair=makeMaterial(0x36251d),dark=makeMaterial(0x251a16);const g=new THREE.Group();g.name='TemporaryHeadVisual';g.position.set(0,.105,.005);headBone.add(g);const face=new THREE.Mesh(new THREE.DodecahedronGeometry(.115,1),skin);face.scale.set(.9,1.08,.86);face.castShadow=true;g.add(face);const nose=new THREE.Mesh(new THREE.ConeGeometry(.032,.075,5),skin);nose.position.set(0,-.005,.108);nose.rotation.x=Math.PI/2;g.add(nose);const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.122,7,4,0,Math.PI*2,0,Math.PI*.55),hair);hairCap.position.y=.045;hairCap.castShadow=true;g.add(hairCap);const beard=new THREE.Mesh(new THREE.ConeGeometry(.105,.14,7),dark);beard.position.set(0,-.105,.035);beard.rotation.x=Math.PI;beard.scale.z=.82;beard.castShadow=true;g.add(beard);return true;}
function makeQuaternion(rest,x=0,y=0,z=0){const offset=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));return rest.clone().multiply(offset);}
function addQuatTrack(tracks,bone,times,poses){if(!bone)return;const rest=bone.quaternion.clone();const values=[];for(const p of poses){const q=makeQuaternion(rest,p[0]||0,p[1]||0,p[2]||0);values.push(q.x,q.y,q.z,q.w);}tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,values));}
function buildFallbackClips(model){
  const b=n=>byName(model,n),uaL=b('upperarm_l'),uaR=b('upperarm_r'),laL=b('lowerarm_l'),laR=b('lowerarm_r'),thL=b('thigh_l'),thR=b('thigh_r'),caL=b('calf_l'),caR=b('calf_r'),sp1=b('spine_01'),sp2=b('spine_02');
  const clips=[];
  {
    const t=[0,1,2],tracks=[];
    addQuatTrack(tracks,uaL,t,[[0,0,-1.48],[.015,0,-1.49],[0,0,-1.48]]);addQuatTrack(tracks,uaR,t,[[0,0,1.48],[-.015,0,1.49],[0,0,1.48]]);
    addQuatTrack(tracks,laL,t,[[0,-.10,0],[0,-.12,0],[0,-.10,0]]);addQuatTrack(tracks,laR,t,[[0,.10,0],[0,.12,0],[0,.10,0]]);
    addQuatTrack(tracks,sp1,t,[[0,0,0],[.015,0,0],[0,0,0]]);addQuatTrack(tracks,sp2,t,[[0,0,0],[-.010,0,0],[0,0,0]]);
    clips.push(new THREE.AnimationClip('Idle',2,tracks));
  }
  {
    const t=[0,.25,.5,.75,1],tracks=[];
    const legL=[.72,0,-.72,0,.72],legR=legL.map(v=>-v);
    // True alternating gait: each arm has its own opposite-phase forward/back curve.
    // Left arm opposes the left leg; right arm opposes the right leg.
    const armL=[-.66,0,.66,0,-.66];
    const armR=[.66,0,-.66,0,.66];
    addQuatTrack(tracks,uaL,t,armL.map(v=>[0,v,-1.43]));
    addQuatTrack(tracks,uaR,t,armR.map(v=>[0,v,1.43]));
    // Elbows also vary independently so the arms do not read like mirrored rods.
    addQuatTrack(tracks,laL,t,[[0,-.18,0],[0,-.10,0],[0,-.24,0],[0,-.12,0],[0,-.18,0]]);
    addQuatTrack(tracks,laR,t,[[0,.24,0],[0,.12,0],[0,.18,0],[0,.10,0],[0,.24,0]]);
    addQuatTrack(tracks,thL,t,legL.map(v=>[v*.70,0,0]));addQuatTrack(tracks,thR,t,legR.map(v=>[v*.70,0,0]));
    addQuatTrack(tracks,caL,t,[[0,0,0],[.18,0,0],[.30,0,0],[0,0,0],[0,0,0]]);addQuatTrack(tracks,caR,t,[[.30,0,0],[0,0,0],[0,0,0],[.18,0,0],[.30,0,0]]);
    addQuatTrack(tracks,sp1,t,[[.025,.08,0],[.02,.02,0],[.025,-.08,0],[.02,-.02,0],[.025,.08,0]]);
    addQuatTrack(tracks,sp2,t,[[0,-.045,0],[0,-.01,0],[0,.045,0],[0,.01,0],[0,-.045,0]]);
    clips.push(new THREE.AnimationClip('Walk',1,tracks));
  }
  {
    const t=[0,.26,.54,.82,1.10],tracks=[];
    addQuatTrack(tracks,uaL,t,[[.12,0,-1.34],[.56,0,-1.18],[.92,0,-1.00],[.40,0,-1.20],[.12,0,-1.34]]);
    addQuatTrack(tracks,uaR,t,[[.12,0,1.34],[.56,0,1.18],[.92,0,1.00],[.40,0,1.20],[.12,0,1.34]]);
    addQuatTrack(tracks,laL,t,[[0,-.18,0],[0,-.52,0],[0,-.92,0],[0,-.40,0],[0,-.18,0]]);
    addQuatTrack(tracks,laR,t,[[0,.18,0],[0,.52,0],[0,.92,0],[0,.40,0],[0,.18,0]]);
    addQuatTrack(tracks,sp1,t,[[.02,0,0],[.06,0,0],[.16,0,0],[.07,0,0],[.02,0,0]]);addQuatTrack(tracks,sp2,t,[[.01,0,0],[.04,0,0],[.10,0,0],[.04,0,0],[.01,0,0]]);
    clips.push(new THREE.AnimationClip('Harvest',1.10,tracks));
  }
  return clips;
}
export class GlbPlayerVisual{
  constructor({playerRoot,fallbackObjects,modelUrl,targetHeight=3.25,localGroundOffset=-.53,animationAliases=DEFAULT_ANIMATION_ALIASES}){this.playerRoot=playerRoot;this.fallbackObjects=fallbackObjects;this.modelUrl=modelUrl;this.targetHeight=targetHeight;this.animationAliases=animationAliases;this.container=new THREE.Group();this.container.name='ExternalPlayerVisual';this.container.position.y=localGroundOffset;this.container.visible=false;this.playerRoot.add(this.container);this.mixer=null;this.actions=new Map();this.activeAction=null;this.loaded=false;this.failed=false;this.lastPosition=new THREE.Vector3();this.playerRoot.getWorldPosition(this.lastPosition);this.velocitySample=new THREE.Vector3();}
  async load(){const loader=new GLTFLoader();try{const gltf=await loader.loadAsync(this.modelUrl),model=gltf.scene||gltf.scenes?.[0];if(!model)throw new Error('Character asset contains no scene.');setShadowFlags(model);addFallbackHead(model);normalizeModel(model,this.targetHeight);this.container.add(model);const sourceClips=gltf.animations?.length?gltf.animations:buildFallbackClips(model);this.mixer=new THREE.AnimationMixer(model);for(const[state,aliases]of Object.entries(this.animationAliases)){let clip=findClip(sourceClips,aliases);if(!clip&&state==='harvest')clip=findClip(sourceClips,['harvest']);if(!clip)continue;const action=this.mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);action.setLoop(THREE.LoopRepeat,Infinity);this.actions.set(state,action);}this.container.visible=true;this.loaded=true;this.playState('idle',0);return true;}catch(error){this.failed=true;console.warn('[The Villager] external character unavailable; procedural fallback remains active.',error);return false;}}
  playState(state,fadeSeconds=.16){if(!this.loaded||!this.mixer)return;const next=this.actions.get(state)||this.actions.get('idle');if(!next||next===this.activeAction)return;if(this.activeAction)this.activeAction.fadeOut(fadeSeconds);next.reset().fadeIn(fadeSeconds).play();this.activeAction=next;}
  update(dt,{harvesting=false}={}){if(!this.loaded||!this.mixer)return;const now=new THREE.Vector3();this.playerRoot.getWorldPosition(now);this.velocitySample.copy(now).sub(this.lastPosition);const speed=dt>0?this.velocitySample.length()/dt:0;this.lastPosition.copy(now);const state=harvesting?'harvest':speed>.08?'walk':'idle';this.playState(state);this.mixer.update(dt);}
}
export const PLAYER_GLB_CONTRACT=Object.freeze({preferredPath:'./assets/characters/villager-male.gltf',targetHeight:3.25,required:[],preferredAnimations:['Idle','Walk','Chop'],notes:'Production clips are preferred automatically. Current fallback clips are rig-specific and temporary.'});