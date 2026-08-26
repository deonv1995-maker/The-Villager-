export class MobileControls{
  constructor({leftRoot,leftKnob,rightRoot,rightKnob,jumpRoot}){
    this.left={root:leftRoot,knob:leftKnob,pointerId:null,x:0,y:0};
    this.right={root:rightRoot,knob:rightKnob,pointerId:null,x:0,y:0};
    this.jumpRoot=jumpRoot||null;
    this.jumpQueued=false;
    this.jumpHeld=false;
    this.bound=[];
    this.install();
  }

  install(){
    this.bindStick(this.left);
    this.bindStick(this.right);
    this.bindJump();
    this.bindKeyboard();
  }

  bindStick(stick){
    const root=stick.root;
    if(!root)return;
    root.style.touchAction='none';

    const onDown=e=>{
      if(stick.pointerId!==null)return;
      stick.pointerId=e.pointerId;
      root.setPointerCapture?.(e.pointerId);
      this.updateStick(stick,e.clientX,e.clientY);
      e.preventDefault();
    };
    const onMove=e=>{
      if(e.pointerId!==stick.pointerId)return;
      this.updateStick(stick,e.clientX,e.clientY);
      e.preventDefault();
    };
    const onEnd=e=>{
      if(e.pointerId!==stick.pointerId)return;
      stick.pointerId=null;
      stick.x=0;stick.y=0;
      if(stick.knob)stick.knob.style.transform='translate(-50%,-50%)';
      e.preventDefault();
    };

    root.addEventListener('pointerdown',onDown,{passive:false});
    window.addEventListener('pointermove',onMove,{passive:false});
    window.addEventListener('pointerup',onEnd,{passive:false});
    window.addEventListener('pointercancel',onEnd,{passive:false});
    this.bound.push([root,'pointerdown',onDown],[window,'pointermove',onMove],[window,'pointerup',onEnd],[window,'pointercancel',onEnd]);
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
    };
    const onEnd=e=>{
      this.jumpHeld=false;
      root.classList.remove('pressed');
      e.preventDefault();
    };

    root.addEventListener('pointerdown',onDown,{passive:false});
    root.addEventListener('pointerup',onEnd,{passive:false});
    root.addEventListener('pointercancel',onEnd,{passive:false});
    this.bound.push([root,'pointerdown',onDown],[root,'pointerup',onEnd],[root,'pointercancel',onEnd]);
  }

  bindKeyboard(){
    const onKeyDown=e=>{
      if(e.code!=='Space')return;
      if(!e.repeat)this.jumpQueued=true;
      this.jumpHeld=true;
      e.preventDefault();
    };
    const onKeyUp=e=>{
      if(e.code!=='Space')return;
      this.jumpHeld=false;
      e.preventDefault();
    };
    window.addEventListener('keydown',onKeyDown,{passive:false});
    window.addEventListener('keyup',onKeyUp,{passive:false});
    this.bound.push([window,'keydown',onKeyDown],[window,'keyup',onKeyUp]);
  }

  updateStick(stick,clientX,clientY){
    const r=stick.root.getBoundingClientRect();
    const cx=r.left+r.width*.5,cy=r.top+r.height*.5,max=r.width*.32;
    let dx=clientX-cx,dy=clientY-cy;
    const len=Math.hypot(dx,dy);
    if(len>max&&len>0){dx=dx/len*max;dy=dy/len*max;}
    stick.x=dx/max;
    stick.y=dy/max;
    if(stick.knob)stick.knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
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
    this.jumpQueued=false;
    this.jumpHeld=false;
  }
}
