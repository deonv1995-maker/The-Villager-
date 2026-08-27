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
   #build-drawer{position:fixed;top:10px;right:0;z-index:48;display:flex;flex-direction:row-reverse;align-items:center;gap:6px;pointer-events:auto;font-family:system-ui,sans-serif}
   #build-drawer-toggle{width:46px;height:46px;border:3px solid #3a2b21;border-right:0;border-radius:14px 0 0 14px;background:#203d28e8;color:#f5e9cf;display:grid;place-items:center;touch-action:none;box-shadow:0 3px 10px #0005;font-weight:900}
   #build-drawer-toggle:active{transform:scale(.94)}
   #build-drawer-toggle .drawer-glyph{width:22px;height:18px;position:relative}
   #build-drawer-toggle .drawer-glyph:before,#build-drawer-toggle .drawer-glyph:after{content:'';position:absolute;left:2px;right:2px;height:4px;border-radius:5px;background:#d2ae69;box-shadow:0 6px 0 #d2ae69,0 12px 0 #d2ae69}
   #build-drawer-panel{height:54px;display:flex;align-items:center;justify-content:flex-end;gap:5px;padding:4px 0 4px 7px;border:2px solid #3a2b21;border-radius:14px;background:#17251de8;box-shadow:0 3px 12px #0005;overflow:hidden;max-width:0;opacity:0;transform:translateX(14px) scaleX(.92);transform-origin:right center;transition:max-width .2s ease,opacity .14s ease,transform .2s ease,padding-right .2s ease;pointer-events:none;white-space:nowrap}
   #build-drawer.expanded #build-drawer-panel{max-width:min(84vw,540px);opacity:1;transform:translateX(0) scaleX(1);padding-right:6px;pointer-events:auto}
   #build-drawer:not(.has-material) #build-drawer-panel{max-width:0!important;opacity:0!important;pointer-events:none!important;padding-right:0!important}
   .build-drawer-option{width:48px;height:46px;border:2px solid #705a3e;border-radius:10px;background:#314632e8;color:#f4ead8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;touch-action:none;box-shadow:inset 0 0 8px #ffffff10}
   .build-drawer-option:active{transform:scale(.93)}
   .build-drawer-option.selected{background:#8eaa70;border-color:#e4c985;color:#261f18;box-shadow:inset 0 0 10px #ffffff45,0 0 0 1px #2e241b}
   .build-drawer-option:disabled{opacity:.42;filter:saturate(.6)}
   .build-drawer-label{font-size:8px;line-height:9px;font-weight:900;letter-spacing:.2px}
   .build-mini{width:30px;height:25px;position:relative;display:block}
   .build-mini:before,.build-mini:after{content:'';position:absolute;background:#9a6338;border:1px solid #4c3322;border-radius:6px;box-sizing:border-box}
   .build-mini.raw:before{left:2px;right:2px;top:10px;height:7px}
   .build-mini.floor:before{left:2px;right:2px;top:6px;height:6px;box-shadow:0 9px 0 #9a6338,0 9px 0 1px #4c3322}
   .build-mini.frame:before{width:7px;top:1px;bottom:1px;left:12px}
   .build-mini.frame:after{height:6px;left:3px;right:3px;bottom:1px}
   .build-mini.wall:before{left:3px;right:3px;top:3px;height:5px;box-shadow:0 7px 0 #9a6338,0 7px 0 1px #4c3322,0 14px 0 #9a6338,0 14px 0 1px #4c3322}
   .build-mini.angle:before{width:7px;height:30px;left:12px;top:-2px;transform:rotate(45deg);transform-origin:center}
   .build-mini.roof:before{width:6px;height:22px;left:8px;top:4px;transform:rotate(46deg);transform-origin:center}
   .build-mini.roof:after{width:6px;height:22px;right:8px;top:4px;transform:rotate(-46deg);transform-origin:center}
   #build-drawer-place{width:58px;background:#d2ae69;color:#33261c;border-color:#3a2b21}
   #build-drawer-place .place-arrow{font-size:20px;line-height:18px;font-weight:1000;margin-top:-2px}
   #build-drawer-place.busy{background:#8a7c62}
   body.build-material-in-hand #action-button{display:none!important}
   @media(max-width:760px){
    #build-drawer{top:8px}
    #build-drawer-toggle{width:42px;height:42px}
    #build-drawer-panel{height:49px;gap:3px}
    .build-drawer-option{width:43px;height:42px}
    #build-drawer-place{width:52px}
    .build-mini{transform:scale(.88)}
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
  toggle.setAttribute('aria-label','Open build drawer');
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

  const place=document.createElement('button');
  place.id='build-drawer-place';
  place.type='button';
  place.className='build-drawer-option';
  place.dataset.gameUi='true';
  place.setAttribute('aria-label','Place material');
  place.innerHTML='<span class="place-arrow" aria-hidden="true">↓</span><span class="build-drawer-label">PLACE</span>';
  place.addEventListener('pointerdown',e=>{
   e.preventDefault();
   e.stopPropagation();
   if(place.disabled)return;
   this.interaction?.perform?.();
  },{passive:false});
  panel.appendChild(place);

  root.append(toggle,panel);
  document.body.appendChild(root);

  this.root=root;
  this.panel=panel;
  this.toggleButton=toggle;
  this.placeButton=place;
 }

 setExpanded(expanded){
  this.expanded=!!expanded&&!!this.materials?.carried;
  this.root?.classList.toggle('expanded',this.expanded);
  this.toggleButton?.setAttribute('aria-expanded',this.expanded?'true':'false');
  this.toggleButton?.setAttribute('aria-label',this.expanded?'Close build drawer':'Open build drawer');
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

  if(carrying&&!this.wasCarrying)this.setExpanded(true);
  if(!carrying&&this.wasCarrying)this.setExpanded(false);

  this.root.classList.toggle('has-material',carrying);
  document.body.classList.toggle('build-material-in-hand',carrying);

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
   if(label)label.textContent=locked?'WAIT':'PLACE';
   this.placeButton.setAttribute('aria-label',
    (logInHand||grassInHand)?(this.buildingModes?.actionLabel?.()||'Place material'):`Place ${type||'material'}`
   );
  }

  this.updateModeSelection();
  this.wasCarrying=carrying;
  this.lastMaterialType=type;
 }
}
