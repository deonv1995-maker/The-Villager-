export class IslandTerrain{
 constructor(THREE){
  this.T=THREE;
  this.radius=135;
  this.seaLevel=-2;
  this.terraceHeight=2.4;
 }
 rawHeightAt(x,z){
  const d=Math.hypot(x*.92,z*1.08)/this.radius;
  if(d>=1)return this.seaLevel;
  const coast=Math.max(0,1-d*d);
  const hills=Math.sin(x*.04)*1.35+Math.cos(z*.036)*1.15+Math.sin((x+z)*.028)*.95;
  const mountain=Math.pow(Math.max(0,1-d/.72),2)*15;
  return Math.max(-.5,(1.1+hills+mountain)*coast);
 }
 heightAt(x,z){
  const raw=this.rawHeightAt(x,z);
  if(raw<=-.45)return raw;
  const tier=Math.floor(raw/this.terraceHeight);
  const base=tier*this.terraceHeight;
  const within=raw-base;
  const softened=Math.min(within,.48)+Math.max(0,within-1.92)*.28;
  return base+softened;
 }
 slopeAt(x,z){
  const e=.9,h=this.heightAt(x,z);
  return Math.max(
   Math.abs(this.heightAt(x+e,z)-h),
   Math.abs(this.heightAt(x-e,z)-h),
   Math.abs(this.heightAt(x,z+e)-h),
   Math.abs(this.heightAt(x,z-e)-h)
  )/e;
 }
 createLandMaterial(geometry){
  const T=this.T,p=geometry.attributes.position;
  const colors=new Float32Array(p.count*3);
  const grassLow=new T.Color(0x78b84f);
  const grassHigh=new T.Color(0x8bc85a);
  const grassDark=new T.Color(0x5f9843);
  const rock=new T.Color(0x879087);
  const rockDark=new T.Color(0x6f7972);
  const sand=new T.Color(0xb8b06f);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const d=Math.hypot(x*.92,z*1.08)/this.radius;
   const s=this.slopeAt(x,z);
   let c;
   if(d>.94)c=s>.35?rockDark:sand;
   else if(s>.72)c=rockDark;
   else if(s>.38)c=rock;
   else if(y>7)c=grassHigh;
   else if(y<1)c=grassDark;
   else c=grassLow;
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  return new T.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0,flatShading:true});
 }
 createEdgeRocks(root){
  const T=this.T;
  const mat=new T.MeshStandardMaterial({color:0x7b8580,roughness:.94,metalness:0,flatShading:true});
  const group=new T.Group();group.name='CoastalRockShelf';
  const segments=64;
  for(let i=0;i<segments;i++){
   const a=i/segments*Math.PI*2;
   const wobble=1+.035*Math.sin(i*2.37)+.025*Math.cos(i*.91);
   const r=this.radius*(.965*wobble);
   const x=Math.cos(a)*r/.92,z=Math.sin(a)*r/1.08;
   const y=this.heightAt(x,z)-.65;
   const rock=new T.Mesh(new T.DodecahedronGeometry(1.2,0),mat);
   const wide=1.8+((i*17)%7)*.11;
   rock.scale.set(wide,.72,1.25+((i*13)%5)*.08);
   rock.rotation.set((i%3)*.08,a+.35,(i%5)*.035);
   rock.position.set(x,y,z);
   rock.castShadow=true;rock.receiveShadow=true;
   group.add(rock);
  }
  root.add(group);
 }
 create(){
  const T=this.T,root=new T.Group();root.name='IslandWorld';
  const size=this.radius*2.08;
  const geo=new T.PlaneGeometry(size,size,144,144);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,this.heightAt(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();
  const land=new T.Mesh(geo,this.createLandMaterial(geo));
  land.name='TerracedIslandLand';land.receiveShadow=true;root.add(land);
  this.createEdgeRocks(root);
  const oceanGeo=new T.PlaneGeometry(700,700,1,1);oceanGeo.rotateX(-Math.PI/2);
  const ocean=new T.Mesh(oceanGeo,new T.MeshPhongMaterial({color:0x43b7d5,shininess:55,specular:0x9fe7ef}));
  ocean.position.y=this.seaLevel;root.add(ocean);
  return root;
 }
}
