// Construction costs and placement rules stay centralised here so future tiers,
// upgrades and boss-era structures can extend the catalogue without duplicating
// build balance inside placement/rendering code.
export const BUILDING_CATALOG=Object.freeze({
 wood_floor:Object.freeze({
  id:'wood_floor',
  label:'Wood Floor',
  shortLabel:'FLOOR',
  renderer:'wood_floor',
  cost:Object.freeze({wood:6}),
  footprintRadius:1.55,
  placementDistance:3.2,
  maxGroundDelta:.48
 }),
 campfire:Object.freeze({
  id:'campfire',
  label:'Campfire',
  shortLabel:'FIRE',
  renderer:'campfire',
  cost:Object.freeze({wood:2,stone:6}),
  footprintRadius:.92,
  placementDistance:2.8,
  maxGroundDelta:.38
 })
});

export const buildingDefinition=id=>BUILDING_CATALOG[id]||null;
