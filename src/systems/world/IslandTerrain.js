export class IslandTerrain{
 constructor(THREE){
  this.T=THREE;
  this.radius=135;
  this.seaLevel=-2;
  this.seabedLevel=-5.2;
 }
 angularDistance(a,b){
  let d=a-b;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return d;
 }
 islandMetric(x,z){
  const sx=x+5,sz=z-3;
  const a=Math.atan2(sz,sx);
  const r=Math.hypot(sx*.9,sz*1.05);
  const baseShape=
   1+
   .11*Math.sin(a*3+.55)+
   .065*Math.sin(a*5-1.15)+
   .045*Math.cos(a*7+.8);
  const peninsula=.18*Math.exp(-Math.pow(this.angularDistance(a,-.42)/.34,2));
  const shoulder=.08*Math.exp(-Math.pow(this.angularDistance(a,1.05)/.5,2));
  const bay=.16*Math.exp(-Math.pow(this.angularDistance(a,2.38)/.3,2));
  const localRadius=this.radius*Math.max(.72,baseShape+peninsula+shoulder-bay);
  return r/localRadius;
 }
 gaussian(x,z,cx,cz,sx,sz,height){
  const dx=(x-cx)/sx,dz=(z-cz)/sz;
  return height*Math.exp(-(dx*dx+dz*dz));
 }
 rotatedGaussian(x,z,cx,cz,angle,longRadius,shortRadius,height){
  const dx=x-cx,dz=z-cz,c=Math.cos(angle),s=Math.sin(angle);
  const u=(dx*c+dz*s)/longRadius;
  const v=(-dx*s+dz*c)/shortRadius;
  return height*Math.exp(-(u*u+v*v));
 }
 rawHeightAt(x,z){
  const d=this.islandMetric(x,z);
  if(d>=1)return this.seabedLevel;

  const broad=
   Math.sin(x*.024+z*.008)*.75+
   Math.cos(z*.027-x*.006)*.65+
   Math.sin((x-z)*.043)*.28;

  let h=1.45+broad;

  // Large authored regions: each has a distinct gameplay identity.
  h+=this.gaussian(x,z,-42,30,34,29,10.8);          // off-centre highland
  h+=this.rotatedGaussian(x,z,35,-20,-.58,55,15,5.2); // long diagonal ridge
  h+=this.gaussian(x,z,48,38,31,24,4.6);            // broad plateau / future settlement region
  h+=this.gaussian(x,z,-8,-42,35,28,-3.7);          // forest basin
  h+=this.gaussian(x,z,62,-58,38,24,-1.3);          // low coastal plain

  // A sharper angled shelf/drop that does not radiate from the island centre.
  const angle=-.72,c=Math.cos(angle),s=Math.sin(angle);
  const dx=x+48,dz=z+12;
  const u=dx*c+dz*s,v=-dx*s+dz*c;
  h+=2.35*Math.tanh(v/7)*Math.exp(-Math.pow(u/38,2))*Math.exp(-Math.pow(v/34,2));

  // Keep the spawn region readable without flattening the rest of the island.
  const spawnBlend=Math.exp(-(x*x+z*z)/(22*22));
  h=h*(1-spawnBlend*.28)+(2.8+broad*.18)*(spawnBlend*.28);

  const coast=Math.max(0,1-d);
  const coastEase=Math.min(1,coast/.16);
  const eased=coastEase*coastEase*(3-2*coastEase);
  const interior=h;
  const shore=-.35+interior*.12;
  return Math.max(-.6,shore*(1-eased)+interior*eased);
 }
 heightAt(x,z){return this.rawHeightAt(x,z);}
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
  const stoneDark=new T.Color(0x69736f);
  const seabed=new T.Color(0x64745e);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const d=this.islandMetric(x,z),s=this.slopeAt(x,z);
   let c;
   if(d>=1)c=seabed;
   else if(d>.955)c=soil;
   else if(s>.78)c=stoneDark;
   else if(s>.43)c=stone;
   else if(y>7.5)c=grassLight;
   else if(y<1.1)c=grassDark;
   else c=grass;
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  return new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,flatShading:true});
 }
 create(){
  const T=this.T,root=new T.Group();root.name='IslandWorld';
  const size=this.radius*2.42;
  const geo=new T.PlaneGeometry(size,size,160,160);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,this.heightAt(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();
  const land=new T.Mesh(geo,this.createLandMaterial(geo));
  land.name='AsymmetricIslandLand';land.receiveShadow=true;root.add(land);

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
  ocean.name='OceanSurface';ocean.position.y=this.seaLevel;root.add(ocean);
  return root;
 }
}
