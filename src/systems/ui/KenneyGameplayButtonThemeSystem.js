export class KenneyGameplayButtonThemeSystem{
 constructor({
  goldRound='./assets/ui/kenney/button_round_gold.svg',
  mossRound='./assets/ui/kenney/button_round_moss.svg',
  darkSquare='./assets/ui/kenney/button_square_dark.svg',
  rustSquare='./assets/ui/kenney/button_square_rust.svg'
 }={}){
  this.goldRound=goldRound;
  this.mossRound=mossRound;
  this.darkSquare=darkSquare;
  this.rustSquare=rustSquare;
  this.styleElement=null;
 }

 initialize(){
  if(this.styleElement||document.getElementById('kenney-gameplay-button-theme'))return;

  const style=document.createElement('style');
  style.id='kenney-gameplay-button-theme';
  style.textContent=`
   body.kenney-gameplay-buttons #jump-button,
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button,
   body.kenney-gameplay-buttons #sprint-button,
   body.kenney-gameplay-buttons #build-drawer-toggle,
   body.kenney-gameplay-buttons #disassembly-mode-button{
    border:0!important;
    box-shadow:none!important;
    background-color:transparent!important;
    background-repeat:no-repeat!important;
    background-position:center!important;
    background-size:100% 100%!important;
    overflow:visible!important;
   }

   body.kenney-gameplay-buttons #jump-button,
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button{
    background-image:url('${this.goldRound}')!important;
    color:#35291d!important;
   }

   body.kenney-gameplay-buttons #sprint-button{
    background-image:url('${this.mossRound}')!important;
    color:#26331f!important;
   }

   body.kenney-gameplay-buttons #build-drawer-toggle,
   body.kenney-gameplay-buttons #disassembly-mode-button{
    background-image:url('${this.darkSquare}')!important;
    color:#f2dfb1!important;
    border-radius:0!important;
   }

   body.kenney-gameplay-buttons #disassembly-mode-button.active{
    background-image:url('${this.rustSquare}')!important;
    color:#fff2df!important;
   }

   body.kenney-gameplay-buttons #jump-button:active,
   body.kenney-gameplay-buttons #action-button:active,
   body.kenney-gameplay-buttons #carry-place-button:active,
   body.kenney-gameplay-buttons #sprint-button:active,
   body.kenney-gameplay-buttons #build-drawer-toggle:active,
   body.kenney-gameplay-buttons #disassembly-mode-button:active{
    transform:translateY(2px) scale(.96)!important;
    filter:brightness(1.08)!important;
   }

   body.kenney-gameplay-buttons #jump-button:disabled,
   body.kenney-gameplay-buttons #action-button:disabled,
   body.kenney-gameplay-buttons #carry-place-button:disabled,
   body.kenney-gameplay-buttons #sprint-button:disabled,
   body.kenney-gameplay-buttons #build-drawer-toggle:disabled,
   body.kenney-gameplay-buttons #disassembly-mode-button:disabled{
    opacity:.48!important;
    filter:saturate(.55)!important;
   }

   body.kenney-gameplay-buttons #build-drawer-toggle .drawer-glyph:before,
   body.kenney-gameplay-buttons #build-drawer-toggle .drawer-glyph:after{
    background:#e3c477!important;
    box-shadow:0 6px 0 #e3c477,0 12px 0 #e3c477!important;
   }

   body.kenney-gameplay-buttons #jump-button .jump-icon{width:36px!important;height:36px!important}
   body.kenney-gameplay-buttons #action-button .context-action-icon{width:32px!important;height:32px!important}
   body.kenney-gameplay-buttons #sprint-button::before{font-size:27px!important;font-weight:1000!important}

   @media(max-width:620px){
    body.kenney-gameplay-buttons #jump-button .jump-icon{width:34px!important;height:34px!important}
    body.kenney-gameplay-buttons #action-button .context-action-icon{width:30px!important;height:30px!important}
    body.kenney-gameplay-buttons #sprint-button::before{font-size:25px!important}
   }
  `;

  document.head.appendChild(style);
  document.body.classList.add('kenney-gameplay-buttons');
  this.styleElement=style;
 }

 dispose(){
  document.body.classList.remove('kenney-gameplay-buttons');
  this.styleElement?.remove();
  this.styleElement=null;
 }
}
