export const RESOURCE_CATALOG=Object.freeze({
 wood:Object.freeze({id:'wood',label:'Wood',shortLabel:'WOOD'}),
 stone:Object.freeze({id:'stone',label:'Stone',shortLabel:'STONE'})
});

// Harvest balance lives here so tools, perks and future resource tiers can scale
// one authoritative profile instead of embedding yields in interaction code.
export const HARVEST_PROFILES=Object.freeze({
 tree:Object.freeze({
  environmentType:'tree',
  label:'Tree',
  actionLabel:'CHOP',
  resourceId:'wood',
  durability:4,
  yieldPerHit:1,
  depletionBonus:4
 }),
 bareTree:Object.freeze({
  environmentType:'bareTree',
  label:'Dead Tree',
  actionLabel:'CHOP',
  resourceId:'wood',
  durability:3,
  yieldPerHit:1,
  depletionBonus:3
 }),
 rock:Object.freeze({
  environmentType:'rock',
  label:'Rock',
  actionLabel:'MINE',
  resourceId:'stone',
  durability:5,
  yieldPerHit:1,
  depletionBonus:5
 })
});

export const harvestProfileForEnvironmentType=type=>HARVEST_PROFILES[type]||null;
export const resourceDefinition=id=>RESOURCE_CATALOG[id]||null;
