import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

export class KayKitPlayerVisual{
  constructor(THREE,{modelUrl,movementUrl,generalUrl,targetHeight=2.7}){
    this.T=THREE;this.modelUrl=modelUrl;this.movementUrl=movementUrl;this.generalUrl=generalUrl;this.targetHeight=targetHeight;
    this.root=new THREE.Group();this.root.name='KayKitRangerVisual';this.mixer=null;this.actions=new Map();this.active=null;this.loaded=false;
  }
  async load(){
    const loader=new GLTFLoader();
    const [character,movement,general]=await Promise.all([loader.loadAsync(this.modelUrl),loader.loadAsync(this.movementUrl),loader.loadAsync(this.generalUrl)]);
    const model=character.scene;
    model.updateMatrixWorld(true);
    const box=new this.T.Box3().setFromObject(model),size=new this.T.Vector3();box.getSize(size);
    if(size.y>0){const scale=this.targetHeight/size.y;model.scale.setScalar(scale);model.updateMatrixWorld(true);const scaled=new this.T.Box3().setFromObject(model);model.position.y-=scaled.min.y;}
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.root.add(model);this.mixer=new this.T.AnimationMixer(model);
    for(const clip of [...general.animations,...movement.animations])this.actions.set(clip.name,this.mixer.clipAction(clip));
    this.loaded=true;this.play('Idle_A',0);return this;
  }
  play(name,fade=.18){const next=this.actions.get(name);if(!next||next===this.active)return;if(this.active)this.active.fadeOut(fade);next.reset().fadeIn(fade).play();this.active=next;}
  update(dt,moving){if(!this.loaded)return;this.play(moving?'Walking_A':'Idle_A');this.mixer.update(dt);}
}
