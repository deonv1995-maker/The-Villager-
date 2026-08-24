export function installHarvestUiCoordinator(){
 const harvest=document.getElementById('harvest'),hint=document.getElementById('hint');
 if(!harvest||!hint)return null;
 if(globalThis.__villagerHarvestUi)return globalThis.__villagerHarvestUi;
 const nativeAdd=DOMTokenList.prototype.add,nativeRemove=DOMTokenList.prototype.remove;
 let owner=null,bypass=0;
 const guarded=new Set([harvest.classList,hint.classList]);
 DOMTokenList.prototype.add=function(...tokens){
  if(owner&&guarded.has(this)&&tokens.includes('hidden')&&!bypass)return;
  return nativeAdd.apply(this,tokens);
 };
 DOMTokenList.prototype.remove=function(...tokens){
  if(owner&&guarded.has(this)&&tokens.includes('hidden')&&!bypass)return;
  return nativeRemove.apply(this,tokens);
 };
 function direct(fn){bypass++;try{return fn();}finally{bypass--;}}
 const api={
  acquire(id){owner=id;},
  release(id){if(owner===id)owner=null;},
  isOwner(id){return owner===id;},
  showHarvest(){direct(()=>nativeRemove.call(harvest.classList,'hidden'));},
  hideHarvest(){direct(()=>nativeAdd.call(harvest.classList,'hidden'));},
  showHint(){direct(()=>nativeRemove.call(hint.classList,'hidden'));},
  hideHint(){direct(()=>nativeAdd.call(hint.classList,'hidden'));},
  get owner(){return owner;}
 };
 globalThis.__villagerHarvestUi=api;
 return api;
}
