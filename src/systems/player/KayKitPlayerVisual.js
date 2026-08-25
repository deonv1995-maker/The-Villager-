import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

export class KayKitPlayerVisual{
  constructor(THREE,{modelUrl,movementUrl,generalUrl,targetHeight=2.7,facingYaw=Math.PI}){
    this.T=THREE;this.modelUrl=modelUrl;this.movementUrl=movementUrl;this.generalUrl=generalUrl;this.targetHeight=targetHeight;this.facingYaw=facingYaw;
    this.root=new THREE.Group();this.root.name='KayKitRangerVisual';this.mixer=null;this.actions=new Map();this.active=null;this.loaded=false;
  }
  async load(){
    const loader=new GLTFLoader();
    const [character,movement,general]=await Promise.all([
      loader.loadAsync(this.modelUrl),loader.loadAsync(this.movementUrl),loader.loadAsync(this.generalUrl)
    ]);
    const model=character.scene;
    model.rotation.y=this.facingYaw;
    model.updateMatrixWorld(true);
    const box=new this.T.Box3().setFromObject(model),size=new this.T.Vector3();box.getSize(size);
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('KayKit Ranger has invalid bounds');
    const scale=this.targetHeight/size.y;model.scale.setScalar(scale);model.updateMatrixWorld(true);
    const scaled=new this.T.Box3().setFromObject(model);model.position.y-=scaled.min.y;
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.root.add(model);this.mixer=new this.T.AnimationMixer(model);
    for(const clip of [...general.animations,...movement.animations]){
      if(!this.actions.has(clip.name))this.actions.set(clip.name,this.mixer.clipAction(clip));
    }
    this.loaded=true;this.play(this.actions.has('Idle_A')?'Idle_A':'Idle',0);return this;
  }
  play(name,fade=.16,timeScale=1){
    const next=this.actions.get(name);if(!next||next===this.active){if(next)next.setEffectiveTimeScale(timeScale);return;}
    if(this.active)this.active.fadeOut(fade);
    next.reset().setEffectiveTimeScale(timeScale).fadeIn(fade).play();this.active=next;
  }
  update(dt,moveAmount=0){
    if(!this.loaded)return;
    if(moveAmount<.06)this.play(this.actions.has('Idle_A')?'Idle_A':'Idle');
    else if(moveAmount>.72&&this.actions.has('Running_A'))this.play('Running_A',.14,.88+moveAmount*.18);
    else this.play(this.actions.has('Walking_A')?'Walking_A':'Walking',.16,.65+moveAmount*.45);
    this.mixer.update(dt);
  }
}
