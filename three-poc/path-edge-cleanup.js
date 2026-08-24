export function removePathEdgeSeams({world}){
  if(!world)return 0;
  let removed=0;
  world.traverse(object=>{
    if(!object?.isMesh||!object.material?.color)return;
    // pathEdge material from environment-visuals.js
    if(object.material.color.getHex()===0x8f6b43){
      object.visible=false;
      removed++;
    }
  });
  return removed;
}
