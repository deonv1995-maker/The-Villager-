export function removePrefabBuildings({world}){
  if(!world)return {removed:0};
  const remove=[];
  world.traverse(o=>{
    if(o===world)return;
    if(o.name==='VillageCottage046'||o.name?.startsWith('VillageCottageGablePanel'))remove.push(o);
  });
  // The original cottage group has no stable name, so remove the legacy group at its known spawn.
  for(const o of world.children){
    if(o?.isGroup&&Math.abs(o.position.x)<.15&&Math.abs(o.position.z+7.4)<.15)remove.push(o);
  }
  const unique=[...new Set(remove)];
  for(const o of unique){
    o.parent?.remove(o);
    o.traverse?.(child=>{child.geometry?.dispose?.();});
  }
  return {removed:unique.length};
}
