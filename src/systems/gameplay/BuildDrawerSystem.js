export class BuildDrawerSystem{
 constructor({buildingModes,materials,interaction,legacyModeButton=null}){
  this.buildingModes=buildingModes;
  this.materials=materials;
  this.interaction=interaction;
  this.legacyModeButton=legacyModeButton;

  this.root=null;
  this.panel=null;
  this.toggleButton=null;
  this.placeButton=null;
  this.modeButtons=new Map();
  this.expanded=false;
  this.wasCarrying=false;
  this.lastMaterialType=null;
  this.styleElement=null;

  this.modes=[
   {id:'raw',label:'RAW',icon:'raw'},
   {id:'floor',label:'FLOOR',icon:'floor'},
   {id:'frame',label:'FRAME',icon:'frame'},
   {id:'wall',label:'WALL',icon:'wall'},
   {id:'angle',label:'ANGLE',icon:'angle'},
   {id:'roof',label:'ROOF',icon:'roof'}
  ];
 }

 initialize(){
  this.injectStyles();
  this.createDrawer();
  if(this.legacyModeButton){
   this.legacyModeButton.classList.add('legacy-build-selector-hidden');
   this.legacyModeButton.setAttribute('aria-hidden','true');
  }
  document.body.classList.add('build-drawer-ui');
  this.update(true);
 }

 dispose(){
  this.root?.remove();
  this.styleElement?.remove();
  document.body.classList.remove('build-drawer-ui','build-material-in-hand');
  if(this.legacyModeButton){
   this.legacyModeButton.classList.remove('legacy-build-selector-hidden');
   this.legacyModeButton.removeAttribute('aria-hidden');
  }
 }

 injectStyles(){
  const style=document.createElement('style');
  style.id='build-drawer-style';
  style.textContent=`
   .legacy-build-selector-hidden{display:none!important}

   /* Build UI is a temporary bottom dock. It never shares the action-button row. */
   #build-drawer{position:fixed;inset:0;z-index:48;pointer-events:none;font-family:system-ui,sans-serif}
   #build-drawer-toggle{
    position:absolute;right:0;top:10px;width:46px;height:46px;
    border:3px solid #3a2b21;border-right:0;border-radius:13px 0 0 13px;
    background:#203d28e8;color:#f5e9cf;display:grid;place-items:center;
    touch-action:none;box-shadow:0 3px 10px #0005;font-weight:900;
    pointer-events:none;opacity:0;transform:translateX(8px) scale(.96);
    transition:opacity .14s ease,transform .14s ease;
   }
   #build-drawer.has-material #build-drawer-toggle{pointer-events:auto;opacity:1;transform:translateX(0) scale(1)}
   #build-drawer-toggle:active{transform:translateY(1px) scale(.94)}
   #build-drawer-toggle .drawer-glyph{width:24px;height:20px;position:relative;display:block}
   #build-drawer-toggle .drawer-glyph:before{
    content:'';position:absolute;left:3px;top:2px;width:17px;height:4px;border-radius:4px;
    background:#d2ae69;box-shadow:-3px 7px 0 #d2ae69,2px 14px 0 #d2ae69;
    transform:rotate(-5deg)
   }

   #build-drawer-panel{
    position:absolute;left:50%;bottom:142px;
    display:flex;align-items:center;justify-content:center;gap:4px;
    max-width:calc(100vw - 18px);padding:5px 7px;
    overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;
    border:2px solid #3a2b21;border-radius:13px;background:#17251df0;
    box-shadow:0 5px 16px #0006;white-space:nowrap;
    opacity:0;visibility:hidden;pointer-events:none;
    transform:translate(-50%,12px) scale(.96);
    transition:opacity .14s ease,transform .16s ease,visibility 0s linear .16s;
   }
   #build-drawer-panel::-webkit-scrollbar{display:none}
   #build-drawer.expanded #build-drawer-panel{
    opacity:1;visibility:visible;pointer-events:auto;
    transform:translate(-50%,0) scale(1);transition-delay:0s;
   }
   #build-drawer:not(.has-material) #build-drawer-panel{opacity:0!important;visibility:hidden!important;pointer-events:none!important}

   .build-drawer-option{
    flex:0 0 42px;width:42px;height:46px;border:2px solid #66523a;border-radius:9px;
    background:#2e4433;color:#f2e6cf;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:1px;padding:2px;touch-action:none;
    box-shadow:inset 0 1px 0 #ffffff18,inset 0 -2px 0 #14231988;
    transition:transform .07s ease,filter .1s ease,background .1s ease;
   }
   .build-drawer-option:active{transform:translateY(1px) scale(.94)}
   .build-drawer-option.selected{
    background:linear-gradient(180deg,#b4cd89,#819f64);border-color:#4c3927;color:#2d241a;
    box-shadow:0 2px 0 #5e452d,inset 0 1px 0 #f5ffd466,inset 0 -2px 0 #536b414d;
   }
   .build-drawer-option:disabled{opacity:.43;filter:saturate(.55)}
   .build-drawer-label{font-size:7px;line-height:8px;font-weight:900;letter-spacing:.15px}

   .build-mini{width:27px;height:23px;position:relative;display:block}
   .build-mini:before,.build-mini:after{content:'';position:absolute;background:#a76d3f;border:1px solid #4c3322;border-radius:5px;box-sizing:border-box}
   .build-mini.raw:before{left:2px;right:2px;top:9px;height:6px}
   .build-mini.floor:before{left:2px;right:2px;top:5px;height:5px;box-shadow:0 8px 0 #a76d3f,0 8px 0 1px #4c3322}
   .build-mini.frame:before{width:6px;top:1px;bottom:1px;left:10px}
   .build-mini.frame:after{height:5px;left:2px;right:2px;bottom:1px}
   .build-mini.wall:before{left:2px;right:2px;top:2px;height:5px;box-shadow:0 7px 0 #a76d3f,0 7px 0 1px #4c3322,0 14px 0 #a76d3f,0 14px 0 1px #4c3322}
   .build-mini.angle:before{width:6px;height:27px;left:10px;top:-2px;transform:rotate(45deg);transform-origin:center}
   .build-mini.roof:before{width:5px;height:20px;left:7px;top:3px;transform:rotate(46deg);transform-origin:center}
   .build-mini.roof:after{width:5px;height:20px;right:7px;top:3px;transform:rotate(-46deg);transform-origin:center}

   #build-drawer-place{flex-basis:46px;width:46px;background:linear-gradient(180deg,#ba765b,#8f4e3d);color:#fff3df;border-color:#5a3329}
   #build-drawer-place.busy{background:#786d5d}

   /* While carrying, the generic action button is hidden unless hauling exposes
      a genuinely different action such as ADD 2ND LOG. */
   body.build-material-in-hand #action-button{display:none!important}

   @media(max-width:620px){
    #build-drawer-toggle{top:8px;width:42px;height:42px}
    #build-drawer-panel{bottom:136px;gap:3px;padding:4px 6px;max-width:calc(100vw - 12px)}
    .build-drawer-option{flex-basis:40px;width:40px;height:44px}
    #build-drawer-place{flex-basis:44px;width:44px}
    .build-mini{transform:scale(.9)}
   }

   @media(max-width:380px){
    #build-drawer-panel{gap:2px;padding-left:4px;padding-right:4px}
    .build-drawer-option{flex-basis:38px;width:38px}
    #build-drawer-place{flex-basis:41px;width:41px}
    .build-drawer-label{font-size:6.5px}
   }

   @media(orientation:landscape) and (max-height:620px){
    #build-drawer-panel{bottom:14px;left:43%;max-width:calc(100vw - 230px)}
   }
  `;
  document.head.appendChild(style);
  this.styleElement=style;
 }

 createDrawer(){
  const root=document.createElement('div');
  root.id='build-drawer';
  root.dataset.gameUi='true';

  const toggle=document.createElement('button');
  toggle.id='build-drawer-toggle';
  toggle.type='button';
  toggle.dataset.gameUi='true';
  toggle.setAttribute('aria-label','Open build palette');
  toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML='<span class="drawer-glyph" aria-hidden="true"></span>';
  toggle.addEventListener('pointerdown',e=>{
   e.preventDefault();
   e.stopPropagation();
   if(!this.materials?.carried)return;
   this.setExpanded(!this.expanded);
  },{passive:false});

  const panel=document.createElement('div');
  panel.id='build-drawer-panel';
  panel.dataset.gameUi='true';
  panel.setAttribute('aria-hidden','true');

  for(const mode of this.modes){
   const button=document.createElement('button');
   button.type='button';
   button.className='build-drawer-option';
   button.dataset.mode=mode.id;
   button.dataset.gameUi='true';
   button.title=mode.label;
   button.setAttribute('aria-label',`Build ${mode.label.toLowerCase()}`);
   button.innerHTML=`<span class="build-mini ${mode.icon}" aria-hidden="true"></span><span class="build-drawer-label">${mode.label}</span>`;
   button.addEventListener('pointerdown',e=>{
    e.preventDefault();
    e.stopPropagation();
    this.selectMode(mode.id);
   },{passive:false});
   panel.appendChild(button);
   this.modeButtons.set(mode.id,button);
  }

  const drop=document.createElement('button');
  drop.id='build-drawer-place';
  drop.type='button';
  drop.className='build-drawer-option';
  drop.dataset.gameUi='true';
  drop.setAttribute('aria-label','Drop carried material');
  drop.innerHTML='<span class="place-arrow" aria-hidden="true">↓</span><span class="build-drawer-label">DROP</span>';
  drop.addEventListener('pointerdown',e=>{
   e.preventDefault();
   e.stopPropagation();
   if(drop.disabled)return;
   this.interaction?.dropHeldMaterial?.();
  },{passive:false});
  panel.appendChild(drop);

  root.append(toggle,panel);
  document.body.appendChild(root);

  this.root=root;
  this.panel=panel;
  this.toggleButton=toggle;
  this.placeButton=drop;
 }

 setExpanded(expanded){
  this.expanded=!!expanded&&!!this.materials?.carried;
  this.root?.classList.toggle('expanded',this.expanded);
  this.panel?.setAttribute('aria-hidden',this.expanded?'false':'true');
  this.toggleButton?.setAttribute('aria-expanded',this.expanded?'true':'false');
  this.toggleButton?.setAttribute('aria-label',this.expanded?'Close build palette':'Open build palette');
 }

 selectMode(mode){
  const index=this.buildingModes?.modes?.indexOf(mode)??-1;
  if(index<0||this.interaction?.isPlacementLocked?.())return false;
  if(this.buildingModes.modeIndex===index)return true;

  this.buildingModes.modeIndex=index;
  this.buildingModes.destroyPreview?.();
  this.buildingModes.updateButton?.();
  this.buildingModes.showFeedback?.(`Build: ${this.buildingModes.modeLabel(mode)}`);
  this.updateModeSelection();
  return true;
 }

 updateModeSelection(){
  const active=this.buildingModes?.mode;
  for(const [mode,button] of this.modeButtons){
   const selected=mode===active;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',selected?'true':'false');
  }
 }

 update(force=false){
  if(!this.root)return;
  const carried=this.materials?.carried||null;
  const carrying=!!carried;
  const type=carried?.type||null;

  // Do not explode the palette open every time a material is picked up. The
  // build toggle remains available, but normal movement/action space stays clean.
  if(!carrying&&this.wasCarrying)this.setExpanded(false);

  this.root.classList.toggle('has-material',carrying);
  document.body.classList.toggle('build-material-in-hand',carrying);
  if(this.toggleButton)this.toggleButton.disabled=!carrying;

  const logInHand=type==='log';
  const grassInHand=type==='grass';
  if(grassInHand&&this.buildingModes?.mode!=='roof')this.selectMode('roof');

  for(const [mode,button] of this.modeButtons){
   const allowed=logInHand||(grassInHand&&mode==='roof');
   button.style.display=allowed?'flex':'none';
  }

  const busy=!!this.interaction?.pending
   ||this.materials?.isCarryAnimating?.('pickup')
   ||this.materials?.isCarryAnimating?.('place')
   ||this.materials?.isCarryAnimating?.('recover');
  const locked=busy||this.interaction?.isPlacementLocked?.();

  for(const [mode,button] of this.modeButtons){
   const allowed=logInHand||(grassInHand&&mode==='roof');
   button.disabled=!allowed||locked;
  }
  if(this.placeButton){
   this.placeButton.disabled=!carrying||locked;
   this.placeButton.classList.toggle('busy',locked);
   const label=this.placeButton.querySelector('.build-drawer-label');
   if(label)label.textContent=locked?'WAIT':'DROP';
   this.placeButton.setAttribute('aria-label',`Drop ${type||'material'}`);
  }

  this.updateModeSelection();
  this.wasCarrying=carrying;
  this.lastMaterialType=type;
 }
}
