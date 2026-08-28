export class ContextActionIconSystem{
 constructor({interaction,actionButton=null,disassemblyButton=null,dropButton=null,carryPlaceButton=null}){
  this.interaction=interaction;
  this.actionButton=actionButton||document.getElementById('action-button');
  this.disassemblyButton=disassemblyButton||document.getElementById('disassembly-mode-button');
  this.dropButton=dropButton||document.getElementById('build-drawer-place');
  this.carryPlaceButton=carryPlaceButton||document.getElementById('carry-place-button');
  this.originalUpdateButton=null;
  this.styleElement=null;
  this.lastActionIcon=null;
 }

 initialize(){
  if(!this.interaction)return;
  this.injectStyles();
  this.decorateDisassemblyButton();
  this.decorateDropButton();
  this.decorateCarryPlaceButton();
  this.wrapInteractionButtonUpdate();
  this.interaction.updateButton?.();
 }

 dispose(){
  if(this.originalUpdateButton&&this.interaction){
   this.interaction.updateButton=this.originalUpdateButton;
  }
  this.styleElement?.remove();
 }

 injectStyles(){
  if(document.getElementById('context-action-icon-style'))return;
  const style=document.createElement('style');
  style.id='context-action-icon-style';
  style.textContent=`
   #action-button::before{content:none!important;display:none!important}
   #action-button{overflow:hidden}
   #action-button .context-action-icon{width:34px;height:34px;display:grid;place-items:center;pointer-events:none;color:currentColor}
   #action-button .context-action-icon svg{width:100%;height:100%;display:block;overflow:visible}

   #carry-place-button{font-size:0!important;letter-spacing:0!important}
   #carry-place-button .context-place-icon{width:31px;height:31px;display:grid;place-items:center;pointer-events:none;color:currentColor}
   #carry-place-button .context-place-icon svg{width:100%;height:100%;display:block;overflow:visible}

   #build-drawer-place .place-arrow{display:none!important}
   #build-drawer-place .context-drop-icon{width:25px;height:25px;display:grid;place-items:center;pointer-events:none;color:currentColor}
   #build-drawer-place .context-drop-icon svg{width:100%;height:100%;display:block;overflow:visible}

   #disassembly-mode-button{right:0!important;top:64px!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;border:3px solid #3a2b21!important;border-right:0!important;border-radius:14px 0 0 14px!important;background:#314632e8!important;color:#f4ead8!important;padding:0!important;display:grid!important;place-items:center!important;gap:0!important;box-shadow:0 3px 10px #0005!important}
   #disassembly-mode-button .disassembly-label{display:none!important}
   #disassembly-mode-button .disassembly-icon{display:none!important}
   #disassembly-mode-button .context-tool-icon{width:29px;height:29px;display:grid;place-items:center;pointer-events:none}
   #disassembly-mode-button .context-tool-icon svg{width:100%;height:100%;display:block;overflow:visible}
   #disassembly-mode-button.active{background:#a75d43!important;color:#fff5e7!important;border-color:#5a2f24!important;box-shadow:0 0 0 2px #d7a06466,0 3px 10px #0005!important}

   @media(max-width:760px){
    #disassembly-mode-button{top:58px!important;width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;border-width:3px!important}
    #disassembly-mode-button .context-tool-icon{width:26px;height:26px}
    #action-button .context-action-icon{width:31px;height:31px}
    #carry-place-button .context-place-icon{width:29px;height:29px}
    #build-drawer-place .context-drop-icon{width:23px;height:23px}
   }
  `;
  document.head.appendChild(style);
  this.styleElement=style;
 }

 wrapInteractionButtonUpdate(){
  if(this.originalUpdateButton||!this.interaction?.updateButton)return;
  const original=this.interaction.updateButton.bind(this.interaction);
  this.originalUpdateButton=original;
  this.interaction.updateButton=(...args)=>{
   const result=original(...args);
   this.syncActionButton();
   this.decorateDropButton();
   this.decorateCarryPlaceButton();
   return result;
  };
 }

 decorateDisassemblyButton(){
  const button=this.disassemblyButton||document.getElementById('disassembly-mode-button');
  if(!button)return;
  this.disassemblyButton=button;
  button.innerHTML=`<span class="context-tool-icon" aria-hidden="true">${this.iconSvg('demolition')}</span>`;
  button.title='';
 }

 decorateDropButton(){
  const button=this.dropButton||document.getElementById('build-drawer-place');
  if(!button)return;
  this.dropButton=button;

  let icon=button.querySelector('.context-drop-icon');
  if(!icon){
   icon=document.createElement('span');
   icon.className='context-drop-icon';
   icon.setAttribute('aria-hidden','true');
   icon.innerHTML=this.iconSvg('openHand');
   const label=button.querySelector('.build-drawer-label');
   if(label)button.insertBefore(icon,label);
   else button.prepend(icon);
  }
  button.querySelector('.place-arrow')?.remove();
 }

 decorateCarryPlaceButton(){
  const button=this.carryPlaceButton||document.getElementById('carry-place-button');
  if(!button)return;
  this.carryPlaceButton=button;
  if(button.querySelector('.context-place-icon'))return;
  button.innerHTML=`<span class="context-place-icon" aria-hidden="true">${this.iconSvg('openHand')}</span>`;
  button.title='';
 }

 syncActionButton(){
  const button=this.actionButton;
  if(!button)return;

  const current=this.interaction?.current||null;
  const visual=this.visualFor(current);
  if(!visual){
   button.innerHTML='';
   button.removeAttribute('data-action-icon');
   button.setAttribute('aria-label','Interact');
   this.lastActionIcon=null;
   return;
  }

  button.setAttribute('data-action-icon',visual.icon);
  button.setAttribute('aria-label',visual.label);
  button.title='';

  if(this.lastActionIcon===visual.icon&&button.querySelector('.context-action-icon'))return;
  button.innerHTML=`<span class="context-action-icon" aria-hidden="true">${this.iconSvg(visual.icon)}</span>`;
  this.lastActionIcon=visual.icon;
 }

 visualFor(current){
  if(!current)return null;
  const label=current.label||'Interact';

  if(current.type==='pickup'||current.type==='haul-add')return {icon:'closedHand',label};
  if(current.type==='haul-drop')return {icon:'openHand',label};
  if(current.type==='dismantle')return {icon:'demolition',label};
  if(current.type==='harvest'){
   const kind=current.target?.profile?.kind;
   if(kind==='tree')return {icon:'axe',label};
   if(kind==='rock')return {icon:'hammer',label};
   return {icon:'closedHand',label};
  }
  if(current.type==='reaction')return {icon:'fire',label};
  if(current.type==='place'||current.type==='place-log')return {icon:'openHand',label};
  if(current.type==='busy')return {icon:'busy',label};
  return {icon:'openHand',label};
 }

 iconSvg(type){
  if(type==='axe')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
     <path d="M34 24L14 54" fill="none"/>
     <path d="M31 20l8-10c7 1 13 5 17 11l-14 12z" fill="currentColor"/>
     <path d="M29 23l8 7" fill="none"/>
    </g>
   </svg>`;

  if(type==='demolition')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
     <path d="M34 12l9-7 14 14-8 9z" fill="currentColor" stroke-width="4.5"/>
     <path d="M43 24L20 47" stroke-width="6"/>
     <path d="M15 52l7-7" stroke-width="6"/>
     <path d="M14 37l-8-4M12 45H4M18 31l-4-7" stroke-width="3.8"/>
     <path d="M31 47h18l-4 8H27z" fill="currentColor" stroke-width="3.5"/>
    </g>
   </svg>`;

  if(type==='hammer')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
     <path d="M28 17l9-8 16 16-9 9z" fill="currentColor"/>
     <path d="M37 29L15 52" fill="none"/>
     <path d="M10 54l8-8" fill="none"/>
    </g>
   </svg>`;

  if(type==='fire')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M34 6c3 12-8 16-4 27 2-6 7-9 11-13 10 11 12 20 8 29-4 8-11 11-18 11S17 57 14 49c-4-10 1-20 9-28 0 8 3 11 5 13-1-12 4-18 6-28z" fill="currentColor"/>
   </svg>`;

  if(type==='busy')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <g fill="currentColor"><circle cx="16" cy="32" r="5"/><circle cx="32" cy="32" r="5"/><circle cx="48" cy="32" r="5"/></g>
   </svg>`;

  if(type==='closedHand')return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M17 28c-3-5 4-9 7-5l2 3v-9c0-5 7-5 7 0v8h2v-9c0-5 7-5 7 0v10h2v-7c0-5 7-5 7 0v17c0 15-8 23-20 23-9 0-15-5-18-13l-4-10c-2-5 5-8 8-4l4 5-4-9z" fill="currentColor"/>
    <path d="M22 31h24c4 0 7 3 7 7v3H25c-6 0-9-7-3-10z" fill="currentColor"/>
   </svg>`;

  return `
   <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M18 31V18c0-4 6-4 6 0v10h2V14c0-4 6-4 6 0v14h2V16c0-4 6-4 6 0v13h2v-8c0-4 6-4 6 0v18c0 12-8 19-19 19-8 0-13-4-17-10L7 40c-2-3 2-7 5-5l6 5V31z" fill="currentColor"/>
   </svg>`;
 }
}
