export class MobileControls{
  constructor({leftRoot,leftKnob,rightRoot,rightKnob,jumpRoot,sprintRoot}){
    this.left={root:leftRoot,knob:leftKnob,pointerId:null,x:0,y:0,anchorX:0,anchorY:0};
    this.right={root:rightRoot,knob:rightKnob,pointerId:null,x:0,y:0,anchorX:0,anchorY:0};
    this.jumpRoot=jumpRoot||null;
    this.sprintRoot=sprintRoot||null;
    this.jumpQueued=false;
    this.jumpHeld=false;
    this.sprintHeld=false;
    this.bound=[];
    this.install();
  }

  install(){
    this.bindScreenZones();
    this.bindJump();
    this.bindSprint();
    this.bindKeyboard();
  }

  isUiTarget(target){
    if(this.jumpRoot&&(target===this.jumpRoot||this.jumpRoot.contains?.(target)))return true;
    if(this.sprintRoot&&(target===this.sprintRoot||this.sprintRoot.contains?.(target)))return true;
    return !!target?.closest?.('[data-game-ui]');
  }

  bindScreenZones(){
    const onDown=e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      if(this.isUiTarget(e.target))return;

      const stick=e.clientX<window.innerWidth*.5?this.left:this.right;
      if(stick.pointerId!==null)return;

      stick.pointerId=e.pointerId;
      stick.anchorX=e.clientX;
      stick.anchorY=e.clientY;
      stick.x=0;
      stick.y=0;
      this.showStick(stick);
      this.updateStick(stick,e.clientX,e.clientY);
      e.preventDefault();
    };

    const onMove=e=>{
      const stick=e.pointerId===this.left.pointerId?this.left:(e.pointerId===this.right.pointerId?this.right:null);
      if(!stick)return;
      this.updateStick(stick,e.clientX,e.clientY);
      e.preventDefault();
    };

    const onEnd=e=>{
      if(e.pointerId===this.left.pointerId)this.endStick(this.left);
      if(e.pointerId===this.right.pointerId)this.endStick(this.right);
    };

    window.addEventListener('pointerdown',onDown,{passive:false});
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onEnd,{passive:false});
    window.addEventListener('pointercancel',onEnd,{passive:false});
    this.bound.push(
      [window,'pointerdown',onDown],
      [window,'pointermove',onMove],
      [window,'pointerup',onEnd],
      [window,'pointercancel',onEnd]
    );
  }

  showStick(stick){
    if(!stick.root)return;
    stick.root.style.left=`${stick.anchorX}px`;
    stick.root.style.top=`${stick.anchorY}px`;
    stick.root.classList.add('active');
    if(stick.knob)stick.knob.style.transform='translate(-50%,-50%)';
  }

  endStick(stick){
    stick.pointerId=null;
    stick.x=0;
    stick.y=0;
    if(stick.knob)stick.knob.style.transform='translate(-50%,-50%)';
    stick.root?.classList.remove('active');
  }

  updateStick(stick,clientX,clientY){
    const visualSize=stick.root?.getBoundingClientRect?.().width||124;
    const max=Math.max(38,visualSize*.36);
    let dx=clientX-stick.anchorX;
    let dy=clientY-stick.anchorY;
    const len=Math.hypot(dx,dy);
    if(len>max&&len>0){dx=dx/len*max;dy=dy/len*max;}
    stick.x=dx/max;
    stick.y=dy/max;
    if(stick.knob)stick.knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }

  bindJump(){
    const root=this.jumpRoot;
    if(!root)return;
    root.style.touchAction='none';

    const onDown=e=>{
      this.jumpQueued=true;
      this.jumpHeld=true;
      root.classList.add('pressed');
      root.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };
    const onEnd=e=>{
      this.jumpHeld=false;
      root.classList.remove('pressed');
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('pointerdown',onDown,{passive:false});
    root.addEventListener('pointerup',onEnd,{passive:false});
    root.addEventListener('pointercancel',onEnd,{passive:false});
    this.bound.push([root,'pointerdown',onDown],[root,'pointerup',onEnd],[root,'pointercancel',onEnd]);
  }

  bindSprint(){
    const root=this.sprintRoot;
    if(!root)return;
    root.style.touchAction='none';

    const onDown=e=>{
      this.sprintHeld=true;
      root.classList.add('pressed');
      root.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };
    const onEnd=e=>{
      this.sprintHeld=false;
      root.classList.remove('pressed');
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('pointerdown',onDown,{passive:false});
    root.addEventListener('pointerup',onEnd,{passive:false});
    root.addEventListener('pointercancel',onEnd,{passive:false});
    root.addEventListener('lostpointercapture',onEnd,{passive:false});
    this.bound.push(
      [root,'pointerdown',onDown],
      [root,'pointerup',onEnd],
      [root,'pointercancel',onEnd],
      [root,'lostpointercapture',onEnd]
    );
  }

  bindKeyboard(){
    const onKeyDown=e=>{
      if(e.code==='Space'){
        if(!e.repeat)this.jumpQueued=true;
        this.jumpHeld=true;
        e.preventDefault();
        return;
      }
      if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
        this.sprintHeld=true;
        e.preventDefault();
      }
    };
    const onKeyUp=e=>{
      if(e.code==='Space'){
        this.jumpHeld=false;
        e.preventDefault();
        return;
      }
      if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
        this.sprintHeld=false;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown',onKeyDown,{passive:false});
    window.addEventListener('keyup',onKeyUp,{passive:false});
    this.bound.push([window,'keydown',onKeyDown],[window,'keyup',onKeyUp]);
  }

  consumeJump(){
    const queued=this.jumpQueued;
    this.jumpQueued=false;
    return queued;
  }

  get move(){return {x:this.left.x,y:this.left.y};}
  get look(){return {x:this.right.x,y:this.right.y};}

  dispose(){
    for(const [target,type,handler] of this.bound)target.removeEventListener(type,handler);
    this.bound.length=0;
    this.endStick(this.left);
    this.endStick(this.right);
    this.jumpQueued=false;
    this.jumpHeld=false;
    this.sprintHeld=false;
  }
}
