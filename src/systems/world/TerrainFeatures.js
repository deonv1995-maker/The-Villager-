export class TerrainFeatures {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.root=new THREE.Group();
  this.root.name='ProceduralTerrainDetails';
  this.seed=9413;
  this.materials={
   boulder:new THREE.MeshStandardMaterial({color:0x747f7a,roughness:.96,metalness:0,flatShading:true})
  };
 }

 rand(i){
  const x=Math.sin(i*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 buildBaseBoulders(){
  const T=this.T;
  const terrain=this.world.terrain;
  const formations=terrain.getCliffFormations?.()||[terrain.cliffFormation];
  const geo=new T.IcosahedronGeometry(1,0);

  let index=0;
  formations.forEach((formation,formationIndex)=>{
   const spans=terrain.cliffWallSpansFor?.(formation)||terrain.cliffWallSpans();

   for(const [u0,u1] of spans){
    const count=Math.max(5,Math.round((u1-u0)/3.0));
    for(let i=0;i<count;i++){
     const seed=500+formationIndex*4000+index*17;
     index++;
     if(this.rand(seed)>.68)continue;

     const u=u0+(u1-u0)*((i+.28+this.rand(seed+1)*.44)/count);
     const edgeV=terrain.cliffEdgeVFor?.(formation,u)??terrain.cliffEdgeV(u);
     const v=edgeV-(1.8+this.rand(seed+2)*2.8);
     const p=terrain.cliffFormationWorldFor?.(formation,u,v)??terrain.cliffFormationWorld(u,v);
     const y=this.world.heightAt(p.x,p.z)-.05;

     const rock=new T.Mesh(geo,this.materials.boulder);
     const s=.42+this.rand(seed+3)*.86;
     rock.position.set(p.x,y,p.z);
     rock.rotation.set(this.rand(seed+4)*.28,this.rand(seed+5)*Math.PI*2,this.rand(seed+6)*.24);
     rock.scale.set(
      s*(.78+this.rand(seed+7)*.55),
      s*(.58+this.rand(seed+8)*.62),
      s*(.82+this.rand(seed+9)*.50)
     );
     rock.castShadow=true;
     rock.receiveShadow=true;
     this.root.add(rock);

     if(this.rand(seed+10)>.72){
      const small=new T.Mesh(geo,this.materials.boulder);
      const ss=s*(.28+this.rand(seed+11)*.28);
      const ox=(this.rand(seed+12)-.5)*2.2;
      const oz=(this.rand(seed+13)-.5)*2.2;
      small.position.set(
       p.x+ox,
       this.world.heightAt(p.x+ox,p.z+oz)-.03,
       p.z+oz
      );
      small.rotation.y=this.rand(seed+14)*Math.PI*2;
      small.scale.set(ss*1.2,ss*.8,ss);
      small.castShadow=true;
      small.receiveShadow=true;
      this.root.add(small);
     }
    }
   }
  });
 }

 initialize(){
  this.scene.add(this.root);
  this.buildBaseBoulders();
 }
}
