import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const DEFAULT_ANIMATION_ALIASES=Object.freeze({idle:['idle','stand','standing','breathing'],walk:['walk','walking','locomotion'],harvest:['chop','chopping','harvest','harvesting','axe','attack']});
function findClip(clips,aliases){const normalized=clips.map(clip=>({clip,name:clip.name.trim().toLowerCase()}));for(const alias of aliases){const exact=normalized.find(e=>e.name===alias);if(exact)return exact.clip;}for(const alias of aliases){const partial=normalized.find(e=>e.name.includes(alias));if(partial)return partial.clip;}return null;}
function setShadowFlags(root){root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(object.material)object.material.needsUpdate=true;});}
function normalizeModel(model,targetHeight){model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(!Number.isFinite(size.y)||size.y<=.001)throw new Error('Loaded character has invalid bounds.');model.scale.multiplyScalar(targetHeight/size.y);model.updateMatrixWorld(true);const scaledBounds=new THREE.Box3().setFromObject(model);model.position.y-=scaledBounds.min.y;model.updateMatrixWorld(true);}
function byName(root,name){let found=null;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;}
function byNames(root,names){for(const name of names){const o=byName(root,name);if(o)return o;}return null;}
function makeMaterial(color,roughness=.88){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});}
function addFallbackHead(model){const headBone=byName(model,'Head');if(!headBone)return false;let hasHeadMesh=false;model.traverse(o=>{if(o.isMesh&&/head|face|hair/i.test(o.name))hasHeadMesh=true;});if(hasHeadMesh)return false;const skin=makeMaterial(0xc98762),hair=makeMaterial(0x36251d),dark=makeMaterial(0x251a16);const g=new THREE.Group();g.name='TemporaryHeadVisual';g.position.set(0,.105,.005);headBone.add(g);const face=new THREE.Mesh(new THREE.DodecahedronGeometry(.115,1),skin);face.scale.set(.9,1.08,.86);face.castShadow=true;g.add(face);const nose=new THREE.Mesh(new THREE.ConeGeometry(.032,.075,5),skin);nose.position.set(0,-.005,.108);nose.rotation.x=Math.PI/2;g.add(nose);const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.122,7,4,0,Math.PI*2,0,Math.PI*.55),hair);hairCap.position.y=.045;hairCap.castShadow=true;g.add(hairCap);const beard=new THREE.Mesh(new THREE.ConeGeometry(.105,.14,7),dark);beard.position.set(0,-.105,.035);beard.rotation.x=Math.PI;beard.scale.z=.82;beard.castShadow=true;g.add(beard);return true;}
function mesh(geometry,material,parent,position=[0,0,0],rotation=[0,0,0]){const o=new THREE.Mesh(geometry,material);o.position.set(...position);o.rotation.set(...rotation);o.castShadow=true;parent.add(o);return o;}

function createTools(model){
 const hand=byNames(model,['hand_r','Hand_R','RightHand','hand.R']);if(!hand)return null;
 const socket=new THREE.Group();socket.name='HarvestToolSocket';socket.position.set(.008,-.006,.018);socket.rotation.set(.02,0,-.08);hand.add(socket);
 const wood=makeMaterial(0x6b4226),metal=makeMaterial(0x747a7c,.48);
 const axeGrip=new THREE.Group();axeGrip.name='AxeGrip';axeGrip.position.set(-.012,.006,.006);axeGrip.rotation.set(.12,Math.PI,-.28);socket.add(axeGrip);
 const axe=new THREE.Group();axeGrip.add(axe);mesh(new THREE.CylinderGeometry(.018,.022,.54,6),wood,axe,[0,.08,0]);mesh(new THREE.BoxGeometry(.24,.11,.05),metal,axe,[.072,.33,0],[0,0,-.10]);
 const pickGrip=new THREE.Group();pickGrip.name='PickaxeGrip';pickGrip.position.set(-.004,.012,.004);pickGrip.rotation.set(.04,-.02,-.15);socket.add(pickGrip);
 const pickaxe=new THREE.Group();pickGrip.add(pickaxe);mesh(new THREE.CylinderGeometry(.018,.022,.58,6),wood,pickaxe,[0,.10,0]);const pickHead=new THREE.Group();pickHead.position.set(0,.38,0);pickaxe.add(pickHead);mesh(new THREE.BoxGeometry(.26,.07,.055),metal,pickHead);mesh(new THREE.ConeGeometry(.042,.20,5),metal,pickHead,[-.20,0,0],[0,0,-Math.PI/2]);mesh(new THREE.ConeGeometry(.042,.20,5),metal,pickHead,[.20,0,0],[0,0,Math.PI/2]);
 axe.visible=false;pickaxe.visible=false;return{socket,axeGrip,pickGrip,axe,pickaxe};
}

function makeQuaternion(rest,x=0,y=0,z=0){const offset=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));return rest.clone().multiply(offset);}
function addQuatTrack(tracks,bone,times,poses){if(!bone)return;const rest=bone.quaternion.clone();const values=[];for(const p of poses){const q=makeQuaternion(rest,p[0]||0,p[1]||0,p[2]||0);values.push(q.x,q.y,q.z,q.w);}tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,values));}

function buildFallbackClips(model){
 const b=n=>byName(model,n),uaL=b('upperarm_l'),uaR=b('upperarm_r'),laL=b('lowerarm_l'),laR=b('lowerarm_r'),thL=b('thigh_l'),thR=b('thigh_r'),caL=b('calf_l'),caR=b('calf_r'),sp1=b('spine_01'),sp2=b('spine_02'),head=b('Head');
 const clips=[];
 {const t=[0,1,2],tracks=[];addQuatTrack(tracks,uaL,t,[[0,0,-1.48],[.015,0,-1.49],[0,0,-1.48]]);addQuatTrack(tracks,uaR,t,[[0,0,1.48],[-.015,0,1.49],[0,0,1.48]]);addQuatTrack(tracks,laL,t,[[0,-.10,0],[0,-.12,0],[0,-.10,0]]);addQuatTrack(tracks,laR,t,[[0,.10,0],[0,.12,0],[0,.10,0]]);addQuatTrack(tracks,sp1,t,[[0,0,0],[.015,0,0],[0,0,0]]);addQuatTrack(tracks,sp2,t,[[0,0,0],[-.010,0,0],[0,0,0]]);clips.push(new THREE.AnimationClip('Idle',2,tracks));}
 // WALK — articulated gait with clear knee/elbow flexion, opposing limbs and subtle torso counter-rotation.
 {const t=[0,.125,.25,.375,.5,.625,.75,.875,1],tracks=[];
  const legL=[.62,.36,0,-.42,-.62,-.36,0,.42,.62],legR=legL.map(v=>-v),armL=legL.map(v=>-v*.72),armR=armL.map(v=>-v);
  addQuatTrack(tracks,thL,t,legL.map(v=>[v,0,0]));addQuatTrack(tracks,thR,t,legR.map(v=>[v,0,0]));
  addQuatTrack(tracks,caL,t,[[.10,0,0],[.20,0,0],[.46,0,0],[.70,0,0],[.34,0,0],[.12,0,0],[.08,0,0],[.10,0,0],[.10,0,0]]);
  addQuatTrack(tracks,caR,t,[[.34,0,0],[.12,0,0],[.08,0,0],[.10,0,0],[.10,0,0],[.20,0,0],[.46,0,0],[.70,0,0],[.34,0,0]]);
  addQuatTrack(tracks,uaL,t,armL.map(v=>[v*.10,v,-1.40]));addQuatTrack(tracks,uaR,t,armR.map(v=>[v*.10,v,1.40]));
  addQuatTrack(tracks,laL,t,[[0,-.42,0],[0,-.50,0],[0,-.58,0],[0,-.48,0],[0,-.32,0],[0,-.28,0],[0,-.34,0],[0,-.40,0],[0,-.42,0]]);
  addQuatTrack(tracks,laR,t,[[0,.32,0],[0,.28,0],[0,.34,0],[0,.40,0],[0,.42,0],[0,.50,0],[0,.58,0],[0,.48,0],[0,.32,0]]);
  addQuatTrack(tracks,sp1,t,[[.035,.09,.018],[.045,.055,.010],[.05,0,0],[.045,-.055,-.010],[.035,-.09,-.018],[.045,-.055,-.010],[.05,0,0],[.045,.055,.010],[.035,.09,.018]]);
  addQuatTrack(tracks,sp2,t,[[0,-.055,-.012],[0,-.03,-.006],[0,0,0],[0,.03,.006],[0,.055,.012],[0,.03,.006],[0,0,0],[0,-.03,-.006],[0,-.055,-.012]]);
  addQuatTrack(tracks,head,t,[[0,.025,0],[0,.015,0],[0,0,0],[0,-.015,0],[0,-.025,0],[0,-.015,0],[0,0,0],[0,.015,0],[0,.025,0]]);
  clips.push(new THREE.AnimationClip('Walk',1,tracks));}

 // TREE — planted feet, side chop. Wind back across the right side, rotate the torso,
 // sweep horizontally through the trunk, then follow through and recover.
 {const t=[0,.16,.34,.46,.58,.78,1.04],tracks=[];
  addQuatTrack(tracks,uaL,t,[[0,0,-1.46],[0,-.04,-1.43],[0,-.08,-1.40],[0,-.02,-1.42],[0,.04,-1.45],[0,.02,-1.46],[0,0,-1.46]]);
  addQuatTrack(tracks,laL,t,[[0,-.10,0],[0,-.12,0],[0,-.14,0],[0,-.12,0],[0,-.10,0],[0,-.10,0],[0,-.10,0]]);
  addQuatTrack(tracks,uaR,t,[[.02,.08,1.34],[.04,-.18,1.22],[.05,-.46,1.06],[.06,-.60,.98],[.04,.44,1.08],[.02,.20,1.24],[.02,.08,1.34]]);
  addQuatTrack(tracks,laR,t,[[0,.18,0],[0,.34,0],[0,.58,0],[0,.72,0],[0,.46,0],[0,.28,0],[0,.18,0]]);
  addQuatTrack(tracks,sp1,t,[[0,0,0],[0,-.10,0],[0,-.22,0],[0,-.28,0],[0,.20,0],[0,.08,0],[0,0,0]]);
  addQuatTrack(tracks,sp2,t,[[0,0,0],[0,-.06,0],[0,-.13,0],[0,-.17,0],[0,.12,0],[0,.05,0],[0,0,0]]);
  addQuatTrack(tracks,head,t,[[0,0,0],[0,.05,0],[0,.10,0],[0,.12,0],[0,-.07,0],[0,-.02,0],[0,0,0]]);
  clips.push(new THREE.AnimationClip('HarvestWood',1.04,tracks));}

 // ROCK — planted feet, overhead pickaxe. Raise both shoulders, load above the head,
 // snap downward through the rock, then absorb the recoil and reset.
 {const t=[0,.18,.38,.52,.62,.84,1.16],tracks=[];
  addQuatTrack(tracks,uaL,t,[[0,0,-1.44],[-.22,0,-1.28],[-.52,0,-1.05],[-.72,0,-.88],[.36,0,-1.20],[.12,0,-1.36],[0,0,-1.44]]);
  addQuatTrack(tracks,laL,t,[[0,-.10,0],[0,-.26,0],[0,-.48,0],[0,-.62,0],[0,-.34,0],[0,-.18,0],[0,-.10,0]]);
  addQuatTrack(tracks,uaR,t,[[.02,.08,1.34],[-.28,.04,1.18],[-.64,0,.92],[-.92,0,.72],[.68,.02,1.02],[.28,.05,1.22],[.02,.08,1.34]]);
  addQuatTrack(tracks,laR,t,[[0,.18,0],[0,.52,0],[0,.92,0],[0,1.16,0],[0,.58,0],[0,.30,0],[0,.18,0]]);
  addQuatTrack(tracks,sp1,t,[[0,0,0],[-.04,0,0],[-.10,0,0],[-.14,0,0],[.24,0,0],[.08,0,0],[0,0,0]]);
  addQuatTrack(tracks,sp2,t,[[0,0,0],[-.02,0,0],[-.06,0,0],[-.09,0,0],[.14,0,0],[.04,0,0],[0,0,0]]);
  addQuatTrack(tracks,head,t,[[0,0,0],[-.02,0,0],[-.04,0,0],[-.05,0,0],[.08,0,0],[.02,0,0],[0,0,0]]);
  clips.push(new THREE.AnimationClip('HarvestStone',1.16,tracks));}
 return clips;
}

export class GlbPlayerVisual{
 constructor({playerRoot,fallbackObjects,modelUrl,targetHeight=3.25,localGroundOffset=-.53,animationAliases=DEFAULT_ANIMATION_ALIASES}){this.playerRoot=playerRoot;this.fallbackObjects=fallbackObjects;this.modelUrl=modelUrl;this.targetHeight=targetHeight;this.animationAliases=animationAliases;this.container=new THREE.Group();this.container.name='ExternalPlayerVisual';this.container.position.y=localGroundOffset;this.container.visible=false;this.playerRoot.add(this.container);this.mixer=null;this.actions=new Map();this.activeAction=null;this.tools=null;this.usingFallbackClips=false;this.loaded=false;this.failed=false;this.lastPosition=new THREE.Vector3();this.playerRoot.getWorldPosition(this.lastPosition);this.velocitySample=new THREE.Vector3();}
 async load(){const loader=new GLTFLoader();try{const gltf=await loader.loadAsync(this.modelUrl),model=gltf.scene||gltf.scenes?.[0];if(!model)throw new Error('Character asset contains no scene.');setShadowFlags(model);addFallbackHead(model);normalizeModel(model,this.targetHeight);this.container.add(model);this.tools=createTools(model);this.usingFallbackClips=!gltf.animations?.length;const sourceClips=this.usingFallbackClips?buildFallbackClips(model):gltf.animations;this.mixer=new THREE.AnimationMixer(model);if(this.usingFallbackClips){for(const clip of sourceClips){const action=this.mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);action.setLoop(THREE.LoopRepeat,Infinity);this.actions.set(clip.name,action);}}else{for(const[state,aliases]of Object.entries(this.animationAliases)){const clip=findClip(sourceClips,aliases);if(!clip)continue;const action=this.mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);action.setLoop(THREE.LoopRepeat,Infinity);this.actions.set(state,action);}}this.container.visible=true;this.loaded=true;this.playState('idle',0);return true;}catch(error){this.failed=true;console.warn('[The Villager] external character unavailable; procedural fallback remains active.',error);return false;}}
 actionFor(state,resourceType){if(this.usingFallbackClips){if(state==='idle')return this.actions.get('Idle');if(state==='walk')return this.actions.get('Walk');if(state==='harvest')return this.actions.get(resourceType==='stone'?'HarvestStone':'HarvestWood');return this.actions.get('Idle');}return this.actions.get(state)||this.actions.get('idle');}
 playState(state,fadeSeconds=.10,resourceType=null){if(!this.loaded||!this.mixer)return;const next=this.actionFor(state,resourceType);if(!next||next===this.activeAction)return;if(this.activeAction)this.activeAction.fadeOut(fadeSeconds);next.reset().fadeIn(fadeSeconds).play();this.activeAction=next;}
 setHarvestTool(type,active){if(!this.tools)return;this.tools.axe.visible=active&&type==='wood';this.tools.pickaxe.visible=active&&type==='stone';}
 update(dt,{harvesting=false,resourceType=null}={}){if(!this.loaded||!this.mixer)return;const now=new THREE.Vector3();this.playerRoot.getWorldPosition(now);this.velocitySample.copy(now).sub(this.lastPosition);const speed=dt>0?this.velocitySample.length()/dt:0;this.lastPosition.copy(now);this.setHarvestTool(resourceType,harvesting);this.playState(harvesting?'harvest':speed>.08?'walk':'idle',.10,resourceType);this.mixer.update(dt);}
}
export const PLAYER_GLB_CONTRACT=Object.freeze({preferredPath:'./assets/characters/villager-male.gltf',targetHeight:3.25,required:[],preferredAnimations:['Idle','Walk','Chop'],notes:'Production clips are preferred automatically. Tree harvest uses a planted side chop; rock harvest uses a planted overhead strike.'});