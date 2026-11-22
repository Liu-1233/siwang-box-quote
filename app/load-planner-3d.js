import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const COLORS = [0x1687a7, 0x2f6fc1, 0xd58b2a, 0x7458b5, 0x43a06b, 0xc45656];
let active = null;

function disposeActive() {
  if (!active) return;
  active.dead = true;
  if (active.playTimer) clearInterval(active.playTimer);
  if (active.resize) active.resize.disconnect();
  if (active.controls) active.controls.dispose();
  if (active.renderer) active.renderer.dispose();
  active = null;
}

function cameraPreset(kind) {
  if (!active) return;
  const { camera, controls, result } = active;
  const c = result.container;
  const center = new THREE.Vector3(c.length / 2, c.height / 2, c.width / 2);
  controls.target.copy(center);
  if (kind === 'top') camera.position.set(c.length / 2, Math.max(c.length, c.width) * 1.15, c.width / 2 + 0.01);
  else if (kind === 'door') camera.position.set(c.length + c.width * 1.5, c.height * 0.85, c.width / 2);
  else camera.position.set(c.length * 1.02, c.height * 1.15, c.width * 1.45);
  camera.near = 1; camera.far = c.length * 8; camera.updateProjectionMatrix();
  controls.update();
}

function selectPlacement(index) {
  if (!active) return;
  active.selected = index;
  const p = active.result.placements[index];
  const label = document.getElementById('lp3dSelected');
  if (label) label.innerHTML = p
    ? `已选：<b>${escapeHtml(p.name)}</b> · 箱号 ${p.serial} · 坐标 (${p.x}, ${p.y}, ${p.z}) cm · ${p.weight} kg`
    : '点击箱体可查看坐标和重量';
  active.meshes.forEach(mesh => {
    const originals = mesh.userData.originalColors;
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, originals[i]);
    const local = mesh.userData.placementIndexes.indexOf(index);
    if (local >= 0) mesh.setColorAt(local, new THREE.Color(0xffcc35));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  if (window.LoadPlanner) window.LoadPlanner.view.selected = index;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
}

function updatePlaybackUi() {
  if (!active) return;
  const total=active.result.placements.length, revealed=active.revealed;
  const slider=document.getElementById('lp3dProgress'), text=document.getElementById('lp3dProgressText');
  const button=document.getElementById('lp3dPlayBtn'), badge=document.getElementById('lp3dBadge');
  if(slider){slider.max=String(total);slider.value=String(revealed);}
  if(text)text.textContent=`${revealed} / ${total} 箱`;
  if(button)button.textContent=active.playTimer?'Ⅱ 暂停':'▶ 播放摆放';
  if(badge){
    const drawn=active.shown.filter(index=>index<revealed).length;
    badge.textContent=revealed<total?`已摆放 ${revealed} / ${total} 箱`:(total>active.shown.length?`显示 ${active.shown.length} / ${total} 箱`:`全部 ${total} 箱`);
    badge.title=total>active.shown.length?`为保证流畅，三维场景抽样显示 ${active.shown.length} 箱；计算结果仍为 ${total} 箱。`:'';
  }
}

function pausePlayback() {
  if(!active)return;
  if(active.playTimer){clearInterval(active.playTimer);active.playTimer=null;}
  updatePlaybackUi();
}

function applyReveal(rawCount) {
  if(!active)return;
  const total=active.result.placements.length;
  const count=Math.max(0,Math.min(total,Math.round(Number(rawCount)||0)));
  active.revealed=count;
  active.meshes.forEach(mesh=>{
    const indexes=mesh.userData.placementIndexes, matrices=mesh.userData.baseMatrices;
    for(let local=0;local<mesh.count;local++)mesh.setMatrixAt(local,indexes[local]<count?matrices[local]:active.hiddenMatrix);
    mesh.instanceMatrix.needsUpdate=true;
  });
  updatePlaybackUi();
}

function play() {
  if(!active||!active.result.placements.length)return;
  pausePlayback();
  const total=active.result.placements.length;
  if(active.revealed>=total)applyReveal(0);
  const step=Math.max(1,Math.ceil(total/120));
  active.playTimer=setInterval(()=>{
    if(!active)return;
    const next=Math.min(total,active.revealed+step);
    applyReveal(next);
    if(next>=total)pausePlayback();
  },180);
  updatePlaybackUi();
}

function togglePlay(){if(!active)return;active.playTimer?pausePlayback():play();}
function seek(value){pausePlayback();applyReveal(value);}
function next(){pausePlayback();applyReveal((active&&active.revealed||0)+1);}
function previous(){pausePlayback();applyReveal((active&&active.revealed||0)-1);}

function mount(result) {
  const host = document.getElementById('loadPlanner3d');
  if (!host || !result || !result.container) return false;
  disposeActive();
  host.innerHTML = '';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f8fb);
  scene.fog = new THREE.Fog(0xf4f8fb, result.container.length * 1.8, result.container.length * 4.5);
  const camera = new THREE.PerspectiveCamera(42, 2, 1, result.container.length * 8);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' }); }
  catch (error) {
    if (window.LoadPlanner && window.LoadPlanner.showLegacy3D) window.LoadPlanner.showLegacy3D((error && error.message) || 'WebGL 不可用');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); if(window.LoadPlanner&&window.LoadPlanner.showLegacy3D)window.LoadPlanner.showLegacy3D('三维上下文已中断'); }, {once:true});
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
  controls.minDistance = 80; controls.maxDistance = result.container.length * 3.5;
  const c = result.container;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6e8191, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(c.length * 0.45, c.height * 1.8, c.width * 1.2); sun.castShadow = true; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(c.length * 1.35, c.width * 2.1), new THREE.MeshStandardMaterial({color:0xe5edf2,roughness:1}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(c.length/2,-1,c.width/2); floor.receiveShadow=true; scene.add(floor);
  const grid = new THREE.GridHelper(Math.max(c.length, c.width) * 1.3, 24, 0x8ea5b5, 0xc9d7df);
  grid.position.set(c.length/2,0,c.width/2); scene.add(grid);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(c.length,c.height,c.width)),new THREE.LineBasicMaterial({color:0x335b73,transparent:true,opacity:0.82}));
  frame.position.set(c.length/2,c.height/2,c.width/2); scene.add(frame);

  const maxDraw = 1600, step = Math.max(1, Math.ceil(result.placements.length / maxDraw));
  const shown = [];
  for (let i=0;i<result.placements.length;i+=step) shown.push(i);
  const groups = new Map();
  shown.forEach(index => { const p=result.placements[index], key=[p.length,p.height,p.width,index%COLORS.length].join('|'); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(index); });
  const unit = new THREE.BoxGeometry(1,1,1), meshes=[];
  groups.forEach(indexes => {
    const first=result.placements[indexes[0]], color=COLORS[indexes[0]%COLORS.length];
    const material=new THREE.MeshStandardMaterial({color,roughness:0.68,metalness:0.04});
    const mesh=new THREE.InstancedMesh(unit,material,indexes.length); mesh.castShadow=true; mesh.receiveShadow=true;
    /* 回放会把未显示箱体缩放为零，禁止以空箱体包围球裁剪整组货物。 */
    mesh.frustumCulled=false;
    const matrix=new THREE.Matrix4(), originals=[], baseMatrices=[];
    indexes.forEach((placementIndex,local) => { const p=result.placements[placementIndex]; matrix.compose(new THREE.Vector3(p.x+p.length/2,p.z+p.height/2,p.y+p.width/2),new THREE.Quaternion(),new THREE.Vector3(Math.max(.4,p.length-.7),Math.max(.4,p.height-.7),Math.max(.4,p.width-.7))); mesh.setMatrixAt(local,matrix); baseMatrices.push(matrix.clone()); const col=new THREE.Color(COLORS[placementIndex%COLORS.length]); mesh.setColorAt(local,col); originals.push(col.clone()); });
    mesh.userData.placementIndexes=indexes; mesh.userData.originalColors=originals; mesh.userData.baseMatrices=baseMatrices; scene.add(mesh); meshes.push(mesh);
  });

  const hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  active={host,scene,camera,renderer,controls,result,meshes,shown,hiddenMatrix,revealed:result.placements.length,playTimer:null,selected:-1,dead:false,resize:null};
  cameraPreset('iso');
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
  renderer.domElement.addEventListener('pointerup', event => {
    if (!active || active.renderer !== renderer) return;
    const rect=renderer.domElement.getBoundingClientRect(); pointer.x=((event.clientX-rect.left)/rect.width)*2-1; pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera); const hit=raycaster.intersectObjects(meshes,false)[0];
    if(hit&&hit.instanceId!=null)selectPlacement(hit.object.userData.placementIndexes[hit.instanceId]);
  });
  const resize=()=>{if(!active||active.renderer!==renderer)return;const w=Math.max(320,host.clientWidth),h=Math.max(330,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  active.resize=new ResizeObserver(resize); active.resize.observe(host); resize();
  const animate=()=>{if(!active||active.dead||active.renderer!==renderer||!renderer.domElement.isConnected)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);}; animate();
  updatePlaybackUi();
  return true;
}

window.LoadPlanner3D = { mount, dispose:disposeActive, setView:cameraPreset, select:selectPlacement, play, pause:pausePlayback, togglePlay, seek, next, previous, version:'three-r186-playback-v1' };
