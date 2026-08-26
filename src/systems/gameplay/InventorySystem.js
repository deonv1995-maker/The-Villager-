import {RESOURCE_CATALOG} from './ResourceCatalog.js?v=563';

export class InventorySystem{
 constructor({hudRoot=null}={}){
  this.counts=new Map();
  this.listeners=new Set();
  this.hudRoot=hudRoot;
  for(const id of Object.keys(RESOURCE_CATALOG))this.counts.set(id,0);
  this.renderHud();
 }

 amount(id){return this.counts.get(id)||0;}

 add(id,amount){
  if(!RESOURCE_CATALOG[id]||!Number.isFinite(amount)||amount===0)return false;
  this.counts.set(id,Math.max(0,this.amount(id)+Math.floor(amount)));
  this.changed();
  return true;
 }

 canAfford(cost={}){
  for(const [id,amount] of Object.entries(cost)){
   if(this.amount(id)<amount)return false;
  }
  return true;
 }

 spend(cost={}){
  if(!this.canAfford(cost))return false;
  for(const [id,amount] of Object.entries(cost)){
   this.counts.set(id,Math.max(0,this.amount(id)-amount));
  }
  this.changed();
  return true;
 }

 snapshot(){
  const result={};
  for(const [id,amount] of this.counts)result[id]=amount;
  return result;
 }

 subscribe(listener){
  if(typeof listener!=='function')return()=>{};
  this.listeners.add(listener);
  listener(this.snapshot());
  return()=>this.listeners.delete(listener);
 }

 changed(){
  this.renderHud();
  const snapshot=this.snapshot();
  for(const listener of this.listeners)listener(snapshot);
 }

 renderHud(){
  if(!this.hudRoot)return;
  this.hudRoot.textContent=Object.values(RESOURCE_CATALOG)
   .map(resource=>`${resource.shortLabel} ${this.amount(resource.id)}`)
   .join('  ·  ');
 }

 formatCost(cost={}){
  return Object.entries(cost).map(([id,amount])=>{
   const resource=RESOURCE_CATALOG[id];
   return `${amount} ${resource?.shortLabel||id.toUpperCase()}`;
  }).join(' · ');
 }
}
