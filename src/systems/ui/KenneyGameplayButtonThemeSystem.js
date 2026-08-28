export class KenneyGameplayButtonThemeSystem{
 constructor(){
  this.styleElement=null;
 }

 initialize(){
  if(this.styleElement||document.getElementById('kenney-gameplay-button-theme'))return;

  const style=document.createElement('style');
  style.id='kenney-gameplay-button-theme';
  style.textContent=`
   body.kenney-gameplay-buttons{
    --control-ink:#34271d;
    --control-outline:#4d3828;
    --control-gold-top:#efd68e;
    --control-gold-bottom:#cda45c;
    --control-moss-top:#a8c982;
    --control-moss-bottom:#789d61;
    --control-dark-top:#405b45;
    --control-dark-bottom:#263b2d;
    --control-rust-top:#bd765a;
    --control-rust-bottom:#8e4e3d;
   }

   body.kenney-gameplay-buttons #jump-button,
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button,
   body.kenney-gameplay-buttons #sprint-button,
   body.kenney-gameplay-buttons #build-drawer-toggle,
   body.kenney-gameplay-buttons #disassembly-mode-button{
    appearance:none!important;
    -webkit-appearance:none!important;
    box-sizing:border-box!important;
    background-image:none!important;
    background-repeat:no-repeat!important;
    overflow:hidden!important;
    transition:transform .07s ease,box-shadow .07s ease,filter .12s ease,opacity .12s ease!important;
   }

   /* Primary lower-right action cluster. One visual language, three sizes. */
   body.kenney-gameplay-buttons #jump-button,
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button,
   body.kenney-gameplay-buttons #sprint-button{
    border:3px solid var(--control-outline)!important;
    border-radius:50%!important;
    color:var(--control-ink)!important;
    padding:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    box-shadow:
     0 4px 0 #5d452d,
     0 7px 13px #00000045,
     inset 0 2px 0 #fff6c55f,
     inset 0 -3px 0 #76542f4a!important;
   }

   body.kenney-gameplay-buttons #jump-button,
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button{
    background:linear-gradient(180deg,var(--control-gold-top),var(--control-gold-bottom))!important;
   }

   body.kenney-gameplay-buttons #sprint-button{
    background:linear-gradient(180deg,var(--control-moss-top),var(--control-moss-bottom))!important;
    color:#26351f!important;
    box-shadow:
     0 4px 0 #4f673e,
     0 7px 13px #00000040,
     inset 0 2px 0 #e9ffd05c,
     inset 0 -3px 0 #45623b48!important;
   }

   /* Explicit dimensions prevent older gameplay styles from stretching controls. */
   body.kenney-gameplay-buttons #jump-button{
    width:64px!important;height:64px!important;min-width:64px!important;min-height:64px!important;
    right:18px!important;bottom:18px!important;
   }
   body.kenney-gameplay-buttons #action-button,
   body.kenney-gameplay-buttons #carry-place-button{
    width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;
    bottom:22px!important;
   }
   body.kenney-gameplay-buttons #action-button{right:94px!important}
   body.kenney-gameplay-buttons #carry-place-button{right:94px!important;font-size:0!important;letter-spacing:0!important}
   body.kenney-gameplay-buttons #sprint-button{
    width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;
    right:27px!important;bottom:94px!important;
   }

   /* When one log is on the shoulder, PLACE and ADD 2ND LOG are both valid.
      Keep them as separate controls instead of letting the theme stack them on
      the same coordinates. The hauling interaction owns visibility; this theme
      only guarantees clear spacing and tap access. */
   body.kenney-gameplay-buttons.single-carry-place #action-button{
    right:164px!important;
    z-index:47!important;
   }
   body.kenney-gameplay-buttons.build-material-in-hand.haul-pickup-available #action-button{
    display:flex!important;
    opacity:1!important;
    pointer-events:auto!important;
   }

   /* Compact right-side tool rail. Flat, readable and consistent with the HUD. */
   body.kenney-gameplay-buttons #build-drawer-toggle,
   body.kenney-gameplay-buttons #disassembly-mode-button{
    right:0!important;
    width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;
    border:3px solid var(--control-outline)!important;
    border-right:0!important;
    border-radius:12px 0 0 12px!important;
    background:linear-gradient(180deg,var(--control-dark-top),var(--control-dark-bottom))!important;
    color:#efd58f!important;
    box-shadow:
     0 4px 9px #00000045,
     inset 0 1px 0 #dff2d72e,
     inset 0 -2px 0 #14231a66!important;
   }
   body.kenney-gameplay-buttons #build-drawer-toggle{top:10px!important}
   body.kenney-gameplay-buttons #disassembly-mode-button{top:64px!important}

   body.kenney-gameplay-buttons #disassembly-mode-button.active{
    background:linear-gradient(180deg,var(--control-rust-top),var(--control-rust-bottom))!important;
    color:#fff1d5!important;
    border-color:#62372b!important;
    box-shadow:
     0 0 0 2px #e1ad7066,
     0 4px 10px #00000050,
     inset 0 1px 0 #ffe3c044,
     inset 0 -2px 0 #5d2f2666!important;
   }

   body.kenney-gameplay-buttons #jump-button:active,
   body.kenney-gameplay-buttons #action-button:active,
   body.kenney-gameplay-buttons #carry-place-button:active,
   body.kenney-gameplay-buttons #sprint-button:active{
    transform:translateY(3px) scale(.98)!important;
    box-shadow:
     0 1px 0 #5d452d,
     0 3px 7px #00000038,
     inset 0 2px 0 #fff6c54d,
     inset 0 -2px 0 #76542f3d!important;
   }
   body.kenney-gameplay-buttons #build-drawer-toggle:active,
   body.kenney-gameplay-buttons #disassembly-mode-button:active{
    transform:translateY(1px) scale(.97)!important;
   }

   body.kenney-gameplay-buttons #jump-button:disabled,
   body.kenney-gameplay-buttons #action-button:disabled,
   body.kenney-gameplay-buttons #carry-place-button:disabled,
   body.kenney-gameplay-buttons #sprint-button:disabled,
   body.kenney-gameplay-buttons #build-drawer-toggle:disabled,
   body.kenney-gameplay-buttons #disassembly-mode-button:disabled{
    opacity:.72!important;
    filter:saturate(.65) brightness(.94)!important;
   }

   body.kenney-gameplay-buttons #build-drawer-toggle .drawer-glyph:before,
   body.kenney-gameplay-buttons #build-drawer-toggle .drawer-glyph:after{
    background:#e7c97c!important;
    box-shadow:0 6px 0 #e7c97c,0 12px 0 #e7c97c!important;
   }

   body.kenney-gameplay-buttons #jump-button .jump-icon{width:36px!important;height:36px!important}
   body.kenney-gameplay-buttons #action-button .context-action-icon,
   body.kenney-gameplay-buttons #carry-place-button .context-place-icon{width:31px!important;height:31px!important}
   body.kenney-gameplay-buttons #sprint-button::before{font-size:27px!important;font-weight:1000!important}

   @media(max-width:620px){
    body.kenney-gameplay-buttons #jump-button{
     width:60px!important;height:60px!important;min-width:60px!important;min-height:60px!important;
     right:16px!important;bottom:16px!important;
    }
    body.kenney-gameplay-buttons #action-button,
    body.kenney-gameplay-buttons #carry-place-button{
     width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;
     right:86px!important;bottom:20px!important;
    }
    body.kenney-gameplay-buttons.single-carry-place #action-button{
     right:150px!important;
    }
    body.kenney-gameplay-buttons #sprint-button{
     width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;
     right:24px!important;bottom:88px!important;
    }
    body.kenney-gameplay-buttons #build-drawer-toggle,
    body.kenney-gameplay-buttons #disassembly-mode-button{
     width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;
    }
    body.kenney-gameplay-buttons #build-drawer-toggle{top:8px!important}
    body.kenney-gameplay-buttons #disassembly-mode-button{top:58px!important}
    body.kenney-gameplay-buttons #jump-button .jump-icon{width:34px!important;height:34px!important}
    body.kenney-gameplay-buttons #action-button .context-action-icon,
    body.kenney-gameplay-buttons #carry-place-button .context-place-icon{width:29px!important;height:29px!important}
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
