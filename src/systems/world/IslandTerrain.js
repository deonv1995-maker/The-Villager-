export class IslandTerrain{
 constructor(THREE){
  this.T=THREE;
  this.radius=135;
  this.seaLevel=-2;
  this.seabedLevel=-5.2;
 }
 heightAt(x,z){
  const d=Math.hypot(x*.92,z*1.08)/this.radius;
  if(d>=1)return this.seabedLevel;
  const coast=Math.max(0,1-d*d);
  const broad=Math.sin(x*.028)*1.15+Math.cos(z*.025)*1.0+Math.sin((x+z)*.018)*.75;
  const detail=Math.sin((x-z)*.065)*.28+Math.cos((x+z)*.052)*.22;
  const centerRise=Math.pow(Math.max(0,1-d/.78),2)*9.5;
  const edgeDrop=Math.pow(Math.max(0,(d-.82)/.18),1.4)*2.2;
  return Math.max(-.55,(1.05+broad+detail+centerRise-edgeDrop)*coast);
 }
 slopeAt(x,z){
  const e=1.0,h=this.heightAt(x,z);
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
  const grass=new T.Color(0x7fb64e);
  const grassDark=new T.Color(0x6da246);
  const grassLight=new T.Color(0x8cc65b);
  const soil=new T.Color(0x7a6b4b);
  const stone=new T.Color(0x7d8681);
  const seabed=new T.Color(0x64745e);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const d=Math.hypot(x*.92,z*1.08)/this.radius;
   const s=this.slopeAt(x,z);
   let c;
   if(d>=1)c=seabed;
   else if(d>.955)c=soil;
   else if(s>.52)c=stone;
   else if(y>7)c=grassLight;
   else if(y<1.25)c=grassDark;
   else c=grass;
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  return new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,flatShading:true});
 }
 create(){
  const T=this.T,root=new T.Group();root.name='IslandWorld';
  const size=this.radius*2.08;
  const geo=new T.PlaneGeometry(size,size,144,144);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,this.heightAt(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();
  const land=new T.Mesh(geo,this.createLandMaterial(geo));
  land.name='NaturalIslandLand';land.receiveShadow=true;root.add(land);
  const oceanGeo=new T.PlaneGeometry(700,700,1,1);oceanGeo.rotateX(-Math.PI/2);
  const oceanMaterial=new T.MeshPhongMaterial({
   color:0x43b7d5,
   shininess:55,
   specular:0x9fe7ef,
   depthWrite:true,
   polygonOffset:true,
   polygonOffsetFactor:-1,
   polygonOffsetUnits:-1
  });
  const ocean=new T.Mesh(oceanGeo,oceanMaterial);
  ocean.name='OceanSurface';
  ocean.position.y=this.seaLevel;
  root.add(ocean);
  return root;
 }
}
