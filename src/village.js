export const VILLAGE_CONFIG=Object.freeze({centerX:900,centerY:600,width:720,height:500,spawn:{x:900,y:760}});
export const VILLAGE_BUILDINGS=Object.freeze([
{id:'hall',name:'Village Hall',x:900,y:420,drawWidth:300,drawHeight:250,bodyWidth:170,bodyHeight:70},
{id:'home-west',name:'West Cottage',x:650,y:570,drawWidth:245,drawHeight:205,bodyWidth:145,bodyHeight:60},
{id:'home-east',name:'East Cottage',x:1150,y:570,drawWidth:245,drawHeight:205,bodyWidth:145,bodyHeight:60},
{id:'workshop',name:'Workshop',x:720,y:800,drawWidth:245,drawHeight:205,bodyWidth:145,bodyHeight:60},
{id:'storehouse',name:'Storehouse',x:1080,y:800,drawWidth:245,drawHeight:205,bodyWidth:145,bodyHeight:60}
]);
function blocker(scene,group,x,y,w,h){const b=scene.add.rectangle(x,y,w,h,0,0);scene.physics.add.existing(b,true);group.add(b);}
function path(scene,x,y,w,h,rot=0){const p=scene.add.image(x,y,'vp1-path');p.setDisplaySize(w,h);p.setRotation(rot);p.setDepth(-460);return p;}
function vegetation(scene,x,y,w=120,h=85,depth=y){const v=scene.add.image(x,y,'vp1-vegetation');v.setDisplaySize(w,h);v.setOrigin(.5,.8);v.setDepth(depth);return v;}
function cottage(scene,b,flip=false){const s=scene.add.image(b.x,b.y,'vp1-cottage');s.setDisplaySize(b.drawWidth,b.drawHeight);s.setOrigin(.5,.86);s.setDepth(b.y+1);s.setFlipX(flip);return s;}
function fence(scene,x,y,w,depth){scene.add.rectangle(x,y-7,w,6,0x744b2f).setDepth(depth);scene.add.rectangle(x,y+8,w,6,0x5f3e29).setDepth(depth);const n=Math.max(3,Math.round(w/44));for(let i=0;i<=n;i++){const px=x-w/2+w/n*i,p=scene.add.rectangle(px,y,9,34,0x865a39).setDepth(depth+.1);p.setStrokeStyle(1,0x4d3425,1);}}
function props(scene){fence(scene,610,420,190,426);fence(scene,1190,420,190,426);fence(scene,600,900,180,905);fence(scene,1200,900,180,905);[[775,525,105,70],[1025,525,105,70],[800,690,120,82],[1000,690,120,82],[620,735,100,68],[1180,735,100,68],[820,875,115,78],[980,875,115,78]].forEach(([x,y,w,h])=>vegetation(scene,x,y,w,h,y+2));const bench=scene.add.rectangle(1015,690,66,9,0x795034).setDepth(703);bench.setStrokeStyle(2,0x4d3222,1);scene.add.rectangle(995,704,6,27,0x4d3222).setDepth(704);scene.add.rectangle(1035,704,6,27,0x4d3222).setDepth(704);}
export function createVillage(scene){const blockers=scene.physics.add.staticGroup();path(scene,900,620,720,150,0);path(scene,900,650,155,700,Math.PI/2);path(scene,770,700,270,100,0);path(scene,1030,700,270,100,0);scene.add.ellipse(900,620,245,170,0x4c7f3d,.18).setDepth(-455);const well=scene.add.image(900,615,'vp1-well');well.setDisplaySize(145,145);well.setOrigin(.5,.82);well.setDepth(635);blocker(scene,blockers,900,630,68,38);VILLAGE_BUILDINGS.forEach((b,i)=>{cottage(scene,b,i%2===0);blocker(scene,blockers,b.x,b.y+b.drawHeight*.22,b.bodyWidth,b.bodyHeight);});props(scene);return{blockers};}
