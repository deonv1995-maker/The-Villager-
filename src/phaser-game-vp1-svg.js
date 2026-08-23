const release=window.__THE_VILLAGER_RELEASE__;
const Phaser=window.Phaser;
if(!release?.assets||!Phaser)throw new Error('Visual Pack 1 staging boot failed.');
function urlFor(key){const p=release.assets[key];if(!p)throw new Error(`Missing staging asset ${key}`);const u=new URL(`../${p}`,import.meta.url);u.searchParams.set('r',release.releaseId);return u.href;}
function mod(path){const u=new URL(path,import.meta.url);u.searchParams.set('r',release.releaseId);return import(u.href);}
const [{GAME_CONFIG},{VirtualJoystick},{VILLAGE_CONFIG,createVillage},{createWorldArt}]=await Promise.all([mod('./config.js'),mod('./input.js'),mod('./village.js'),mod('./environment-art.js')]);
const root=document.getElementById('phaser-root');
const joystick=new VirtualJoystick(document.getElementById('joystick'),document.getElementById('joystick-knob'));
const keys=new Set();window.addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
class VisualPackScene extends Phaser.Scene{
 constructor(){super('visual-pack-1');this.failed=[];}
 preload(){
  this.load.svg('tree',urlFor('tree'));
  this.load.svg('rock',urlFor('rock'));
  this.load.image('grass',urlFor('grass'));
  this.load.svg('vp1-cottage',urlFor('vp1Cottage'));
  this.load.svg('vp1-well',urlFor('vp1Well'));
  this.load.svg('vp1-path',urlFor('vp1Path'));
  this.load.svg('vp1-vegetation',urlFor('vp1Vegetation'));
  this.load.spritesheet('player',urlFor('playerSheet'),{frameWidth:release.playerAtlas.frameWidth,frameHeight:release.playerAtlas.frameHeight});
  this.load.on('loaderror',f=>this.failed.push(f?.key||'unknown'));
 }
 create(){
  window.__THE_VILLAGER_SCENE__=this;
  if(this.failed.length){console.error('VP1 SVG load failure',this.failed);this.cameras.main.setBackgroundColor('#321d1d');return;}
  this.cameras.main.setBackgroundColor('#315f2f');this.cameras.main.setBounds(0,0,GAME_CONFIG.world.width,GAME_CONFIG.world.height);this.physics.world.setBounds(0,0,GAME_CONFIG.world.width,GAME_CONFIG.world.height);
  createWorldArt(this,GAME_CONFIG);this.village=createVillage(this);
  [[560,300,'tree',166,230],[1240,300,'tree',166,230],[500,920,'tree',166,230],[1300,920,'tree',166,230],[430,650,'rock',126,96],[1370,650,'rock',126,96]].forEach(([x,y,k,w,h])=>this.add.image(x,y,k).setDisplaySize(w,h).setOrigin(.5,k==='tree'?.92:.86).setDepth(y));
  this.player=this.physics.add.sprite(VILLAGE_CONFIG.spawn.x,VILLAGE_CONFIG.spawn.y,'player',0).setDisplaySize(release.playerAtlas.drawWidth,release.playerAtlas.drawHeight).setOrigin(.5,.82).setCollideWorldBounds(true);
  this.player.body.setSize(Math.max(18,Math.round(release.playerAtlas.drawWidth*.28)),Math.max(20,Math.round(release.playerAtlas.drawHeight*.25)),true);this.physics.add.collider(this.player,this.village.blockers);
  if(release.playerAtlas.columns>1)this.anims.create({key:'walk',frames:this.anims.generateFrameNumbers('player',{start:0,end:release.playerAtlas.columns-1}),frameRate:release.playerAtlas.walkFps||8,repeat:-1});
  this.cameras.main.startFollow(this.player,true,GAME_CONFIG.camera.followLerp,GAME_CONFIG.camera.followLerp);this.cameras.main.setZoom(GAME_CONFIG.camera.zoom);this.cameras.main.setRoundPixels(true);
 }
 update(){if(!this.player)return;let x=joystick.vector.x,y=joystick.vector.y;if(keys.has('a')||keys.has('arrowleft'))x-=1;if(keys.has('d')||keys.has('arrowright'))x+=1;if(keys.has('w')||keys.has('arrowup'))y-=1;if(keys.has('s')||keys.has('arrowdown'))y+=1;const n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}if(Math.hypot(x,y)>.05){this.player.setVelocity(x*GAME_CONFIG.player.speed,y*GAME_CONFIG.player.speed);this.player.setFlipX(x<-.08);if(this.anims.exists('walk'))this.player.play('walk',true);}else{this.player.setVelocity(0,0);if(this.player.anims?.isPlaying)this.player.stop();this.player.setFrame(0);}this.player.setDepth(this.player.y+1);}
}
new Phaser.Game({type:Phaser.AUTO,parent:root,width:window.innerWidth,height:window.innerHeight,backgroundColor:'#315f2f',transparent:false,antialias:false,pixelArt:true,roundPixels:true,physics:{default:'arcade',arcade:{gravity:{x:0,y:0},debug:false}},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,width:window.innerWidth,height:window.innerHeight},scene:VisualPackScene});
