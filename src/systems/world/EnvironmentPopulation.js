export class EnvironmentPopulation {
 constructor(THREE,{world,scene}) {
  this.T=THREE; this.world=world; this.scene=scene;
  this.root=new THREE.Group(); this.root.name='EnvironmentPopulation'; this.seed=7319;
  this.materials=this.createMaterials();
 }
 createMaterials(){
  const T=this.T,mat=(color)=>new T.MeshStandardMaterial({color,roughness:.88,metalness:0,flatShading:true});
  return {
   bark:mat(0x70462f), barkDark:mat(0x533426),
   pineDark:mat(0x245a39), pineMid:mat(0x347447), pineLight:mat(0x4c8a50),
   rockDark:mat(0x626a67), rockMid:mat(0x7c8580), rockLight:mat(0x9aa09a),
   leafDark:mat(0x356c3e), leafMid:mat(0x4f8747), leafLight:mat(0x6a9d50),
   grass:mat(0x5f984a), flower:mat(0xd7b66a)
  };
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 slopeAt(x,z){const e=.8,h=this.world.heightAt(x,z);return Math.max(Math.abs(this.world.heightAt(x+e,z)-h),Math.abs(this.world.heightAt(x,z+e)-h))/e;}
 mesh(geometry,material){const m=new this.T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;return m;}
 tree(){
  const T=this.T,g=new T.Group();
  const trunk=this.mesh(new T.CylinderGeometry(.27,.38,2.65,7),this.materials.bark); trunk.position.y=1.325;
  trunk.rotation.z=(this.rand(g.id*.37)-.5)*.035;
  const lower=this.mesh(new T.ConeGeometry(1.5,2.35,8),this.materials.pineDark); lower.position.y=3.0;
  const middle=this.mesh(new T.ConeGeometry(1.22,2.25,8),this.materials.pineMid); middle.position.y=4.0;
  const top=this.mesh(new T.ConeGeometry(.86,1.9,8),this.materials.pineLight); top.position.y=4.9;
  g.add(trunk,lower,middle,top); return g;
 }
 rock(){
  const T=this.T,g=new T.Group();
  const main=this.mesh(new T.DodecahedronGeometry(.72,0),this.materials.rockMid); main.scale.set(1.35,.72,1.05); main.position.y=.48; main.rotation.set(.08,.35,-.06);
  const face=this.mesh(new T.DodecahedronGeometry(.43,0),this.materials.rockLight); face.scale.set(1.15,.42,.82); face.position.set(-.2,.67,.08); face.rotation.set(-.1,-.35,.12);
  const base=this.mesh(new T.DodecahedronGeometry(.38,0),this.materials.rockDark); base.scale.set(1.2,.35,.9); base.position.set(.5,.22,-.12);
  g.add(main,face,base); return g;
 }
 bush(){
  const T=this.T,g=new T.Group();
  const parts=[[-.38,.35,0,.48,this.materials.leafDark],[.28,.4,.05,.55,this.materials.leafMid],[0,.62,-.08,.5,this.materials.leafLight]];
  for(const [x,y,z,s,mat] of parts){const m=this.mesh(new T.DodecahedronGeometry(s,0),mat);m.scale.y=.78;m.position.set(x,y,z);m.rotation.y=(x+1.2)*1.7;g.add(m);}
  return g;
 }
 grassClump(){
  const T=this.T,g=new T.Group();
  for(let i=0;i<5;i++){const blade=this.mesh(new T.ConeGeometry(.08,.65,5),this.materials.grass);const a=i/5*Math.PI*2;blade.position.set(Math.cos(a)*.18,.3,Math.sin(a)*.18);blade.rotation.z=(i%2?1:-1)*.16;g.add(blade);}
  return g;
 }
 initialize(){
  this.scene.add(this.root);let placed=0;
  for(let i=0;i<920;i++){
   const a=this.rand(i*4)*Math.PI*2,r=13+Math.sqrt(this.rand(i*4+1))*116,x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.12||s>.78||Math.hypot(x,z)<12)continue;
   const forestBias=Math.max(0,1-r/125),roll=this.rand(i*4+2);let o;
   if(roll<(.46+.17*forestBias)&&s<.48)o=this.tree();
   else if(roll<.70)o=this.rock();
   else if(roll<.88)o=this.bush();
   else o=this.grassClump();
   const scale=.78+this.rand(i*4+3)*.88;o.scale.multiplyScalar(scale);o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);this.root.add(o);placed++;
  }
  return placed;
 }
}
