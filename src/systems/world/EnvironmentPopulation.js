export class EnvironmentPopulation{
 constructor(THREE,{world,scene}){this.T=THREE;this.world=world;this.scene=scene;this.root=new THREE.Group();this.root.name='EnvironmentPopulation';this.seed=7319;}
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 slopeAt(x,z){const e=.8,h=this.world.heightAt(x,z);return Math.max(Math.abs(this.world.heightAt(x+e,z)-h),Math.abs(this.world.heightAt(x,z+e)-h))/e;}
 tree(){const T=this.T,g=new T.Group();const trunk=new T.Mesh(new T.CylinderGeometry(.22,.3,2.5,6),new T.MeshLambertMaterial({color:0x7b5233,flatShading:true}));trunk.position.y=1.25;const crown=new T.Mesh(new T.ConeGeometry(1.25,3.4,7),new T.MeshLambertMaterial({color:0x3f7f43,flatShading:true}));crown.position.y=3.65;g.add(trunk,crown);return g;}
 rock(){const T=this.T,m=new T.Mesh(new T.DodecahedronGeometry(.75,0),new T.MeshLambertMaterial({color:0x858a82,flatShading:true}));m.scale.set(1.3,.75,1);m.position.y=.45;return m;}
 bush(){const T=this.T,m=new T.Mesh(new T.DodecahedronGeometry(.55,0),new T.MeshLambertMaterial({color:0x57964b,flatShading:true}));m.scale.set(1.25,.7,1);m.position.y=.35;return m;}
 initialize(){
  this.scene.add(this.root);let placed=0;
  for(let i=0;i<360;i++){
   const a=this.rand(i*4)*Math.PI*2,r=12+Math.sqrt(this.rand(i*4+1))*70,x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.15||s>.72||Math.hypot(x,z)<11)continue;
   const roll=this.rand(i*4+2);let o;if(roll<.38&&s<.42)o=this.tree();else if(roll<.66)o=this.rock();else o=this.bush();
   const scale=.72+this.rand(i*4+3)*.75;o.scale.multiplyScalar(scale);o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);this.root.add(o);placed++;
  }
  return placed;
 }
}
