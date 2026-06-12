import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

/**
 * 真實感夜行列車場景：
 * - 實體 PBR 火車（金屬車身、發光玻璃帶、車頭燈、鋼軌與枕木、霧氣景深）
 * - 粒子負責敘事特效：載入時由星雲飛聚、「凝固」成實體列車；
 *   頁面往下捲動時列車再解體成水平光速粒子流，回捲即重組。
 */

export interface TrainSceneHandle {
  setScroll(v: number): void;
  setPointer(x: number, y: number): void;
  destroy(): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const BODY_W = 0.86;
const BODY_Y0 = 0.34;
const BODY_H = 1.12; // 車體高（0.34 → 1.46）

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  s.moveTo(x + r, 0);
  s.lineTo(x + w - r, 0);
  s.quadraticCurveTo(x + w, 0, x + w, r);
  s.lineTo(x + w, h - r);
  s.quadraticCurveTo(x + w, h, x + w - r, h);
  s.lineTo(x + r, h);
  s.quadraticCurveTo(x, h, x, h - r);
  s.lineTo(x, r);
  s.quadraticCurveTo(x, 0, x + r, 0);
  return s;
}

interface BuildResult {
  train: THREE.Group;
  env: THREE.Group;
  fadeMats: THREE.Material[];
  headlight: THREE.PointLight;
  sampleTargets: Array<{ mesh: THREE.Mesh; count: number; color: THREE.Color; size: [number, number] }>;
}

function buildWorld(accent: THREE.Color, accent2: THREE.Color): BuildResult {
  const train = new THREE.Group();
  const env = new THREE.Group();
  const fadeMats: THREE.Material[] = [];
  const sampleTargets: BuildResult['sampleTargets'] = [];

  const reg = (m: THREE.Material, maxOpacity = 1) => {
    m.transparent = true;
    m.userData.maxOpacity = maxOpacity;
    fadeMats.push(m);
    return m;
  };

  const bodyMat = reg(new THREE.MeshStandardMaterial({ color: 0x222e40, metalness: 0.85, roughness: 0.32 }));
  const darkMat = reg(new THREE.MeshStandardMaterial({ color: 0x10151f, metalness: 0.6, roughness: 0.6 }));
  const glassMat = reg(new THREE.MeshStandardMaterial({
    color: 0x0a0c10, metalness: 0.2, roughness: 0.15,
    emissive: 0xffab52, emissiveIntensity: 1.25,
  }));
  const stripeMat = reg(new THREE.MeshStandardMaterial({
    color: 0x06080d, metalness: 0.4, roughness: 0.4,
    emissive: accent, emissiveIntensity: 2.0,
  }));
  const lampMat = reg(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 3.2 }));
  const tailMat = reg(new THREE.MeshStandardMaterial({ color: 0x180608, emissive: 0xff2e3e, emissiveIntensity: 2.2 }));

  // 車廂：尾 / 中 / 頭（車頭朝 +x）
  const cars: Array<{ x0: number; len: number; nose?: boolean }> = [
    { x0: -5.1, len: 3.1 },
    { x0: -1.78, len: 3.1 },
    { x0: 1.54, len: 2.6, nose: true },
  ];

  const shape = roundedRectShape(BODY_W, BODY_H, 0.2);

  for (const car of cars) {
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: car.len, bevelEnabled: false, curveSegments: 10 });
    bodyGeo.rotateY(Math.PI / 2); // 擠出方向轉為 +x
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(car.x0, BODY_Y0, 0);
    train.add(body);
    sampleTargets.push({ mesh: body, count: 760, color: accent.clone().multiplyScalar(0.75), size: [0.9, 1.6] });

    // 連續玻璃帶（夜車亮窗）
    const band = new THREE.Mesh(new THREE.BoxGeometry(car.len - 0.5, 0.32, BODY_W + 0.03), glassMat);
    band.position.set(car.x0 + (car.len - 0.5) / 2 + 0.25, 1.07, 0);
    train.add(band);
    sampleTargets.push({ mesh: band, count: 240, color: new THREE.Color('#ffc97e'), size: [1.0, 1.8] });

    // 品牌光帶（裙板霓虹線）
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(car.len - 0.16, 0.05, BODY_W + 0.03), stripeMat);
    stripe.position.set(car.x0 + car.len / 2, 0.5, 0);
    train.add(stripe);
    sampleTargets.push({ mesh: stripe, count: 130, color: accent.clone(), size: [0.9, 1.5] });

    // 轉向架 + 車輪
    for (const cx of [car.x0 + 0.6, car.x0 + car.len - 0.6]) {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.66), darkMat);
      bogie.position.set(cx, 0.26, 0);
      train.add(bogie);
      for (const wx of [cx - 0.26, cx + 0.26]) {
        for (const wz of [-0.36, 0.36]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 22), darkMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(wx, 0.23, wz);
          train.add(wheel);
        }
      }
      sampleTargets.push({ mesh: bogie, count: 60, color: accent2.clone().multiplyScalar(0.8), size: [0.8, 1.3] });
    }
  }

  // 車廂連結
  for (const jx of [-1.89, 1.43]) {
    const joint = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.5), darkMat);
    joint.position.set(jx, 0.75, 0);
    train.add(joint);
  }

  // 流線車鼻：拉長半球
  const noseCar = cars[2];
  const noseX = noseCar.x0 + noseCar.len;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.56, 36, 24), bodyMat);
  nose.scale.set(2.1, 1.0, BODY_W / (0.56 * 2) * 1.02);
  nose.position.set(noseX, BODY_Y0 + BODY_H / 2, 0);
  train.add(nose);
  sampleTargets.push({ mesh: nose, count: 320, color: accent.clone().multiplyScalar(0.85), size: [0.9, 1.6] });

  // 擋風玻璃（鼻面上的黑玻璃斜帶）
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.575, 28, 18, -Math.PI / 3, Math.PI / 1.5, Math.PI * 0.22, Math.PI * 0.2), glassMat);
  shield.scale.copy(nose.scale);
  shield.position.copy(nose.position);
  shield.rotation.z = -0.12;
  train.add(shield);

  // 頭燈（左右）與尾燈
  for (const lz of [-0.24, 0.24]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), lampMat);
    lamp.position.set(noseX + 1.02, 0.62, lz);
    train.add(lamp);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), tailMat);
    tail.position.set(-5.12, 0.7, lz);
    train.add(tail);
  }
  const headlight = new THREE.PointLight(0xffe9c4, 6, 7, 1.6);
  headlight.position.set(noseX + 1.3, 0.62, 0);
  train.add(headlight);

  // 集電弓
  const pantoMat = darkMat;
  for (const [x1, y1, x2, y2] of [[-0.7, 1.46, -0.12, 2.02], [0.5, 1.46, -0.12, 2.02]] as const) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.035), pantoMat);
    arm.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
    arm.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    train.add(arm);
  }
  const pantoTop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.55), pantoMat);
  pantoTop.position.set(-0.12, 2.03, 0);
  train.add(pantoTop);

  // ── 環境（不隨粒子解體）：地面、鋼軌、枕木 ──
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x05070d, metalness: 0.12, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(46, 14), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  env.add(ground);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x9fb4cc, metalness: 1.0, roughness: 0.28 });
  for (const rz of [-0.36, 0.36]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.05, 0.05), railMat);
    rail.position.set(0, 0.02, rz);
    env.add(rail);
  }
  const sleeperGeo = new THREE.BoxGeometry(0.16, 0.035, 1.05);
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x141a26, metalness: 0.2, roughness: 0.85 });
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, 60);
  const im = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    im.setPosition(-19.5 + i * 0.66, -0.02, 0);
    sleepers.setMatrixAt(i, im);
  }
  env.add(sleepers);

  return { train, env, fadeMats, headlight, sampleTargets };
}

const VERT = /* glsl */ `
attribute vec3 aScatter;
attribute vec3 aStreak;
attribute float aDelay;
attribute float aPhase;
attribute float aStreaker;
attribute vec3 aColor;
attribute float aSize;
uniform float uAssemble;
uniform float uScroll;
uniform float uSolid;
uniform float uTime;
uniform float uMotion;
uniform float uPR;
varying vec3 vColor;
varying float vAlpha;

float ease(float t) { return t * t * (3.0 - 2.0 * t); }

void main() {
  float p = ease(clamp((uAssemble * 1.35 - aDelay) / 0.45, 0.0, 1.0));
  vec3 pos = mix(aScatter, position, p);
  pos += uMotion * 0.014 * p * (1.0 - uSolid) * vec3(
    sin(uTime * 1.3 + aPhase),
    cos(uTime * 1.7 + aPhase * 1.31),
    sin(uTime * 1.1 + aPhase * 2.17));

  // 捲動時火車保持實體，僅少量「光」粒子沿車身流動
  float s = ease(clamp(uScroll, 0.0, 1.0)) * aStreaker;
  vec3 streak = aStreak;
  streak.x = mod(streak.x - uTime * 2.6 * uMotion + 25.5, 17.0) - 8.5;
  pos = mix(pos, streak, s);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * uPR * (110.0 / -mv.z) * mix(1.0, 1.5, s);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  // 列車凝固成實體後，貼附粒子退為微光；流動光粒子捲動時亮起
  float dim = mix(1.0, 0.06, uSolid);
  vAlpha = mix(0.25, 0.9, p) * mix(dim, 0.75, s);
}
`;

const FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export function createTrainScene(canvas: HTMLCanvasElement, accentHex: string, accent2Hex: string): TrainSceneHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.035);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(0, 1.9, 11);

  const accent = new THREE.Color(accentHex);
  const accent2 = new THREE.Color(accent2Hex);
  const { train, env, fadeMats, headlight, sampleTargets } = buildWorld(accent, accent2);

  const group = new THREE.Group();
  group.add(train, env);
  scene.add(group);

  // 燈光：冷色月光 + 主題色輪廓光
  scene.add(new THREE.HemisphereLight(0x33446a, 0x05070d, 0.8));
  const key = new THREE.DirectionalLight(0xcfe2ff, 1.4);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 2.0);
  rim.position.set(-6, 3, -6);
  scene.add(rim);

  // ── 由實體表面取樣粒子目標 ──
  group.updateMatrixWorld(true);
  const targets: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const v = new THREE.Vector3();
  for (const st of sampleTargets) {
    const sampler = new MeshSurfaceSampler(st.mesh).build();
    for (let i = 0; i < st.count; i++) {
      sampler.sample(v);
      v.applyMatrix4(st.mesh.matrixWorld);
      targets.push(v.x, v.y, v.z);
      const c = st.color.clone().multiplyScalar(rand(0.7, 1.1));
      colors.push(c.r, c.g, c.b);
      sizes.push(rand(st.size[0], st.size[1]));
    }
  }

  const n = sizes.length;
  const scatter = new Float32Array(n * 3);
  const streak = new Float32Array(n * 3);
  const delays = new Float32Array(n);
  const phases = new Float32Array(n);
  const streakers = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    streakers[i] = Math.random() < 0.16 ? 1 : 0; // 僅少數粒子在捲動時化作流光
    const tx = targets[i * 3], ty = targets[i * 3 + 1], tz = targets[i * 3 + 2];
    // 四散起點：以列車為中心的球殼星雲
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(rand(-1, 1));
    const r = rand(3.5, 8.5);
    scatter[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    scatter[i * 3 + 1] = 1.1 + Math.cos(ph) * r * 0.7;
    scatter[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    // 流線終點：保留高度帶的水平光速線
    streak[i * 3] = rand(-8.5, 8.5);
    streak[i * 3 + 1] = ty + rand(-0.08, 0.08);
    streak[i * 3 + 2] = tz + rand(-0.2, 0.2);
    // 由車頭向車尾掃描組裝
    delays[i] = (5.5 - tx) / 14 * 0.55 + rand(0, 0.3);
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targets), 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aStreak', new THREE.BufferAttribute(streak, 3));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aStreaker', new THREE.BufferAttribute(streakers, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(sizes), 1));

  const pMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uAssemble: { value: reduced ? 1 : 0 },
      uScroll: { value: 0 },
      uSolid: { value: reduced ? 1 : 0 },
      uTime: { value: 0 },
      uMotion: { value: reduced ? 0 : 1 },
      uPR: { value: pr },
    },
  });
  group.add(new THREE.Points(geo, pMat));

  let scroll = 0;
  let pointerX = 0, pointerY = 0;
  let smX = 0, smY = 0;

  // 微側 3/4 視角，車頭朝向觀者右前方
  const baseRot = () => (camera.aspect < 0.9 ? -0.46 : -0.34);

  const fit = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // 依視口寬度縮放整列火車，手機直式也完整入鏡
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const projected = 11.6 * Math.cos(baseRot());
    group.scale.setScalar(Math.min(1, (halfW * 2 * 0.96) / projected));
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  const t0 = performance.now();

  renderer.setAnimationLoop(() => {
    const t = (performance.now() - t0) / 1000;
    pMat.uniforms.uTime.value = t;
    const assemble = reduced ? 1 : Math.min(1, Math.max(0, (t - 0.25) / 2.4));
    pMat.uniforms.uAssemble.value = assemble;
    pMat.uniforms.uScroll.value = scroll;

    // 粒子 → 實體的「凝固」交接；捲動時火車保持實體，僅流光掠過
    const solid = clamp01((assemble - 0.72) / 0.28);
    pMat.uniforms.uSolid.value = solid;
    train.visible = solid > 0.02;
    for (const m of fadeMats) m.opacity = solid * (m.userData.maxOpacity as number);
    headlight.intensity = 6 * solid;

    smX += (pointerX - smX) * 0.06;
    smY += (pointerY - smY) * 0.06;
    group.rotation.y = baseRot() + Math.sin(t * 0.13) * 0.025 + scroll * 0.12 + smX * 0.1;
    group.rotation.x = smY * 0.05;
    group.position.x = -scroll * 0.5;
    // 列車置於畫面上半部（下半部由玻璃面板與品牌字覆蓋）
    camera.lookAt(0, -2.3 + scroll * 0.9, 0);
    renderer.render(scene, camera);
  });

  return {
    setScroll(v2) { scroll = clamp01(v2); },
    setPointer(x, y) { pointerX = x; pointerY = y; },
    destroy() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      geo.dispose();
      pMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      scene.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
