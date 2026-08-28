import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const srcRoot=path.join(root,'src');
const errors=[];
const bareImports=new Set();

function walk(dir){
 const out=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...walk(full));
  else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);
 }
 return out;
}

function cleanSpecifier(value){
 return value.split('#')[0].split('?')[0];
}

for(const file of walk(srcRoot)){
 const source=fs.readFileSync(file,'utf8');
 const imports=[
  ...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
  ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)
 ];
 for(const match of imports){
  const spec=match[1];
  if(spec.startsWith('./')||spec.startsWith('../')){
   const target=path.resolve(path.dirname(file),cleanSpecifier(spec));
   if(!fs.existsSync(target))errors.push(`${path.relative(root,file)} -> missing ${spec}`);
  }else if(!/^https?:\/\//.test(spec)){
   bareImports.add(spec);
  }
 }
}

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

const usesThreeBare=[...bareImports].some(spec=>spec==='three'||spec.startsWith('three/addons/'));
if(usesThreeBare){
 if(!index.includes('es-module-shims@1.10.0')){
  errors.push('index.html must load pinned es-module-shims when bare Three.js imports are present');
 }
 if(!index.includes('"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"')){
  errors.push('index.html is missing the pinned Three.js import-map entry');
 }
 if(!index.includes('"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"')){
  errors.push('index.html is missing the pinned Three.js addons import-map entry');
 }
}

if(/pathname\.endsWith\(\s*['"]\/src\/main\.js['"]\s*\)/.test(sw)){
 errors.push('sw.js must not rewrite versioned main.js requests; this can mix incompatible module graphs');
}

if(!index.includes('LOAD ERROR')){
 errors.push('index.html must keep the visible startup error diagnostic');
}

if(errors.length){
 console.error('\nModule smoke check failed:\n');
 for(const error of errors)console.error(` - ${error}`);
 process.exit(1);
}

console.log(`Module smoke check passed. ${bareImports.size} bare import(s), all local imports resolved.`);
