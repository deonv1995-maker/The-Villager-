export class KenneyFantasyUiThemeSystem{
 constructor({assetUrl='./assets/ui/kenney/fantasy-border.svg'}={}){
  this.assetUrl=assetUrl;
  this.styleElement=null;
 }

 initialize(){
  if(this.styleElement||document.getElementById('kenney-fantasy-ui-theme'))return;

  const style=document.createElement('style');
  style.id='kenney-fantasy-ui-theme';
  style.textContent=`
   body.kenney-fantasy-ui{
    --villager-panel-bg:#17251de8;
    --villager-panel-bg-strong:#17251df2;
    --villager-panel-gold:#d2ae69;
   }

   body.kenney-fantasy-ui #status,
   body.kenney-fantasy-ui #material-hud,
   body.kenney-fantasy-ui #gameplay-feedback{
    box-sizing:border-box!important;
    border:6px solid transparent!important;
    border-image-source:url('${this.assetUrl}');
    border-image-slice:12;
    border-image-repeat:stretch;
    border-radius:0!important;
    background:var(--villager-panel-bg-strong)!important;
    box-shadow:0 3px 10px #0006!important;
   }

   body.kenney-fantasy-ui #status{padding:3px 7px!important}
   body.kenney-fantasy-ui #material-hud{padding:3px 7px!important}
   body.kenney-fantasy-ui #gameplay-feedback{padding:5px 10px!important}

   body.kenney-fantasy-ui #build-drawer-panel{
    box-sizing:border-box!important;
    border:6px solid transparent!important;
    border-image-source:url('${this.assetUrl}')!important;
    border-image-slice:12!important;
    border-image-repeat:stretch!important;
    border-radius:0!important;
    background:var(--villager-panel-bg)!important;
    box-shadow:0 3px 12px #0006!important;
   }

   /* Public utility for future inventory, crafting, dialogue and quest windows. */
   body.kenney-fantasy-ui .villager-fantasy-panel{
    box-sizing:border-box;
    border:8px solid transparent;
    border-image-source:url('${this.assetUrl}');
    border-image-slice:12;
    border-image-repeat:stretch;
    background:var(--villager-panel-bg-strong);
    box-shadow:0 4px 16px #0007;
   }

   @media(max-width:620px){
    body.kenney-fantasy-ui #status,
    body.kenney-fantasy-ui #material-hud{border-width:5px!important}
    body.kenney-fantasy-ui #build-drawer-panel{border-width:5px!important}
   }
  `;

  document.head.appendChild(style);
  document.body.classList.add('kenney-fantasy-ui');
  this.styleElement=style;
 }

 dispose(){
  document.body.classList.remove('kenney-fantasy-ui');
  this.styleElement?.remove();
  this.styleElement=null;
 }
}
