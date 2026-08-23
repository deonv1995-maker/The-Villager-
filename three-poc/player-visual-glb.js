import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const DEFAULT_ANIMATION_ALIASES=Object.freeze({idle:['idle','stand','standing','breathing'],walk:['walk','walking','locomotion'],harvest:['chop','chopping','harvest','harvesting','axe','attack']});
function findClip(clips,aliases){const normalized=clips.map(clip=>({clip,name:clip.name.trim().toLowerCase()}));for(const alias of aliases){const exact=normalized.find(e=>e.name===alias);if(exact)return exact.clip;}for(const alias of aliases){const partial=normalized.find(e=>e.name.includes(alias));if(partial)return partial.clip;}return null;}
function setShadowFlags(root){root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;if(object.material)object.material.needsUpdate=true;});}
function normalizeModel(model,targetHeight){model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();bounds.getSize(size);if(!Number.isFinite(size.y)||size.y<=.001)throw new Error('Loaded character has invalid bounds.');model.scale.multiplyScalar(targetHeight/size.y);model.updateMatrixWorld(true);const scaledBounds=new THREE.Box3().setFromObject(model);model.position.y-=scaledBounds.min.y;model.updateMatrixWorld(true);}
function byName(root,name){let found=null;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;}
function makeMaterial(color,roughness=.88){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});}
function addFallbackHead(model){
  const headBone=byName(model,'Head');if(!headBone)return false;
  let hasHeadMesh=false;model.traverse(o=>{if(o.isMesh&&/head|face|hair/i.test(o.name))hasHeadMesh=true;});if(hasHeadMesh)return false;
  const skin=makeMaterial(0xc98762),hair=makeMaterial(0x36251d),dark=makeMaterial(0x251a16);
  const g=new THREE.Group();g.name='TemporaryHeadVisual';g.position.set(0,.105,.005);headBone.add(g);
  const face=new THREE.Mesh(new THREE.DodecahedronGeometry(.115,1),skin);face.scale.set(.9,1.08,.86);face.castShadow=true;g.add(face);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.032,.075,5),skin);nose.position.set(0,-.005,.108);nose.rotation.x=Math.PI/2;g.add(nose);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.122,7,4,0,Math.PI*2,0,Math.PI*.55),hair);hairCap.position.y=.045;hairCap.castShadow=true;g.add(hairCap);
  const beard=new THREE.Mesh(new THREE.ConeGeometry(.105,.14,7),dark);beard.position.set(0,-.105,.035);beard.rotation.x=Math.PI;beard.scale.z=.82;beard.castShadow=true;g.add(beard);
  return true;
}
export class GlbPlayerVisual{
  constructor({playerRoot,fallbackObjects,modelUrl,targetHeight=3.25,localGroundOffset=-.53,animationAliases=DEFAULT_ANIMATION_ALIASES}){
    this.playerRoot=playerRoot;this.fallbackObjects=fallbackObjects;this.modelUrl=modelUrl;this.targetHeight=targetHeight;this.animationAliases=animationAliases;
    this.container=new THREE.Group();this.container.name='ExternalPlayerVisual';this.container.position.y=localGroundOffset;this.container.visible=false;this.playerRoot.add(this.container);
    this.mixer=null;this.actions=new Map();this.activeAction=null;this.loaded=false;this.failed=false;this.lastPosition=new THREE.Vector3();this.playerRoot.getWorldPosition(this.lastPosition);this.velocitySample=new THREE.Vector3();
  }
  async load(){
    const loader=new GLTFLoader();
    try{
      const gltf=await loader.loadAsync(this.modelUrl),model=gltf.scene||gltf.scenes?.[0];if(!model)throw new Error('Character asset contains no scene.');
      setShadowFlags(model);addFallbackHead(model);normalizeModel(model,this.targetHeight);this.container.add(model);
      if(gltf.animations?.length){this.mixer=new THREE.AnimationMixer(model);for(const[state,aliases]of Object.entries(this.animationAliases)){const clip=findClip(gltf.animations,aliases);if(!clip)continue;const action=this.mixer.clipAction(clip);action.enabled=true;action.setEffectiveWeight(1);this.actions.set(state,action);}}
      this.container.visible=true;this.loaded=true;this.playState('idle',0);return true;
    }catch(error){this.failed=true;console.warn('[The Villager] external character unavailable; procedural fallback remains active.',error);return false;}
  }
  playState(state,fadeSeconds=.16){if(!this.loaded||!this.mixer)return;const next=this.actions.get(state)||this.actions.get('idle');if(!next||next===this.activeAction)return;if(this.activeAction)this.activeAction.fadeOut(fadeSeconds);next.reset().fadeIn(fadeSeconds).play();this.activeAction=next;}
  update(dt,{harvesting=false}={}){if(!this.loaded||!this.mixer)return;const now=new THREE.Vector3();this.playerRoot.getWorldPosition(now);this.velocitySample.copy(now).sub(this.lastPosition);const speed=dt>0?this.velocitySample.length()/dt:0;this.lastPosition.copy(now);const state=harvesting?'harvest':speed>.08?'walk':'idle';this.playState(state);this.mixer.update(dt);}
}
export const PLAYER_GLB_CONTRACT=Object.freeze({preferredPath:'./assets/characters/villager-male.gltf',targetHeight:3.25,required:[],preferredAnimations:['Idle','Walk','Chop'],notes:'Self-contained glTF/GLB. Until production clips are added, models without animation stay in their neutral bind pose.'});