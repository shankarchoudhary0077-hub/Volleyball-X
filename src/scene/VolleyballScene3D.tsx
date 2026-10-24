import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BALL_RADIUS,
  CameraPreset,
  COURT_HALF_X,
  COURT_HALF_Z,
  getNationByCode,
  NET_HEIGHT,
  PlayerSimState,
  SimMatchState,
  TeamSide,
} from '../shared/volleyballRules';

import { BALL_SKIN_CATALOG } from '../data/gameData';
import type { BallSkinId } from '../types/game';

interface VolleyballScene3DProps {
  simStateRef: React.MutableRefObject<SimMatchState>;
  cameraPreset: CameraPreset;
  perspectiveSide: TeamSide;
  ballSkin?: BallSkinId;
  onTickFrame?: (dt: number, elapsedSec: number) => void;
}

// Module-scope pre-allocated math objects (Zero GC in render loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalLook = new THREE.Vector3();
const _camCurrLook = new THREE.Vector3(0, 1.4, 0);
const _dummyMatrixObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();

interface AthleteRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoMesh: THREE.Mesh;
  shortsMesh: THREE.Mesh;
  headbandMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  shadowMesh: THREE.Mesh;
  loadedNation: string;
}

function createProceduralSandTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#E2BA78';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle organic wind-raked sand ripples and warm mineral speckles
  for (let y = 0; y < 512; y += 4) {
    const wave = Math.sin((y / 512) * Math.PI * 16) * 6;
    ctx.fillStyle = wave > 0 ? 'rgba(255,244,214,0.12)' : 'rgba(166,120,58,0.10)';
    ctx.fillRect(0, y, 512, 2);
  }
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,235,0.18)' : 'rgba(138,96,42,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createProceduralVolleyballTexture(
  maxAnisotropy: number,
  skinId: BallSkinId = 'classic',
): THREE.CanvasTexture {
  const skin = BALL_SKIN_CATALOG[skinId] || BALL_SKIN_CATALOG.classic;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = skin.baseHex;
  ctx.fillRect(0, 0, 512, 256);

  // Primary curved swirl bands
  ctx.fillStyle = skin.bandPrimaryHex;
  ctx.beginPath();
  ctx.moveTo(0, 42);
  ctx.bezierCurveTo(140, 10, 360, 110, 512, 56);
  ctx.lineTo(512, 118);
  ctx.bezierCurveTo(360, 170, 140, 72, 0, 104);
  ctx.closePath();
  ctx.fill();

  // Secondary championship bands
  ctx.fillStyle = skin.bandSecondaryHex;
  ctx.beginPath();
  ctx.moveTo(0, 152);
  ctx.bezierCurveTo(160, 198, 340, 122, 512, 162);
  ctx.lineTo(512, 218);
  ctx.bezierCurveTo(340, 180, 160, 252, 0, 208);
  ctx.closePath();
  ctx.fill();

  // Panel seam lines
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  for (let x = 64; x < 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createNetMeshTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 5;
  const step = 32;
  for (let i = 0; i <= 256; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
  grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.24)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createJerseyTexture(
  nationCode: string,
  jerseyNum: string,
  primaryHex: string,
  accentHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal international sash & trim
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 256, 20);
  ctx.fillRect(0, 234, 256, 22);

  // Contrast outline text for both front & back of cylinder UV
  const textFill = primaryHex === '#F8FAFC' || primaryHex === '#EAB308' ? '#0F172A' : '#F8FAFC';
  ctx.fillStyle = textFill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Front & Back UV halves (x = 64 and x = 192)
  [64, 192].forEach((cx) => {
    ctx.font = 'bold 30px "Outfit", sans-serif';
    ctx.fillText(nationCode, cx, 86);
    ctx.font = 'bold 64px "JetBrains Mono", monospace';
    ctx.fillText(jerseyNum, cx, 152);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildCompositeAthleteRig(
  nationCode: string,
  shadowTex: THREE.CanvasTexture,
  maxAnisotropy: number,
): AthleteRig {
  const nation = getNationByCode(nationCode);
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({
    color: nation.skinTone,
    roughness: 0.72,
    metalness: 0.04,
  });

  const jerseyTex = createJerseyTexture(
    nation.code,
    nation.jerseyNumber,
    nation.primaryColor,
    nation.accentColor,
    maxAnisotropy,
  );
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.44,
    metalness: 0.08,
  });

  const shortsMat = new THREE.MeshStandardMaterial({
    color: nation.secondaryColor,
    roughness: 0.82,
    metalness: 0.05,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: nation.accentColor,
    roughness: 0.35,
    metalness: 0.22,
  });

  const padMat = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.45,
    metalness: 0.1,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: '#18181B',
    roughness: 0.88,
    metalness: 0.02,
  });

  // 1 & 2: Left and Right Articulated Legs + Knee Pads + Court Shoes
  const createLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.78, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.32, 6, 12), skinMat);
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;
    legPivot.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.11, 0.13, 12), padMat);
    kneePad.position.set(0, -0.39, 0.01);
    legPivot.add(kneePad);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.28, 6, 12), skinMat);
    calf.position.set(0, -0.55, 0);
    calf.castShadow = true;
    legPivot.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), accentMat);
    shoe.position.set(0, -0.72, 0.05);
    shoe.castShadow = true;
    legPivot.add(shoe);

    return legPivot;
  };

  const leftLegPivot = createLeg(-0.16);
  const rightLegPivot = createLeg(0.16);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  // 3: Athletic Shorts
  const shortsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.34, 16), shortsMat);
  shortsMesh.position.set(0, 0.85, 0);
  shortsMesh.castShadow = true;
  bodyPivot.add(shortsMesh);

  // 4: Sculpted Jersey Torso
  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.26, 0.62, 20), jerseyMat);
  torsoMesh.position.set(0, 1.28, 0);
  torsoMesh.castShadow = true;
  bodyPivot.add(torsoMesh);

  // 5 & 6: Articulated Left & Right Arms + Wristbands
  const createArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.52, 0);

    const shoulderSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), jerseyMat);
    armPivot.add(shoulderSleeve);

    const armLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.48, 6, 10), skinMat);
    armLimb.position.set(0, -0.28, 0.08);
    armLimb.rotation.x = -0.3;
    armLimb.castShadow = true;
    armPivot.add(armLimb);

    const wristband = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.1, 12), padMat);
    wristband.position.set(0, -0.46, 0.14);
    wristband.rotation.x = -0.3;
    armPivot.add(wristband);

    return armPivot;
  };

  const leftArmPivot = createArm(-0.37);
  const rightArmPivot = createArm(0.37);
  bodyPivot.add(leftArmPivot, rightArmPivot);

  // 7, 8, 9: Head + Hair Crown + National Accent Headband
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 16), skinMat);
  head.position.set(0, 1.82, 0);
  head.castShadow = true;
  bodyPivot.add(head);

  const headbandMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.065, 18), accentMat);
  headbandMesh.position.set(0, 1.87, 0);
  bodyPivot.add(headbandMesh);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.218, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.position.set(0, 1.85, -0.02);
  bodyPivot.add(hair);

  // 10: Grounded Soft Contact Shadow Disc (y = 0.022, zero Z-fighting)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, 0.022, 0);
  root.add(shadowMesh);

  return {
    root,
    bodyPivot,
    torsoMesh,
    shortsMesh,
    headbandMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    shadowMesh,
    loadedNation: nationCode,
  };
}

function updateAthleteRigMaterials(rig: AthleteRig, nationCode: string, maxAnisotropy: number): void {
  if (rig.loadedNation === nationCode) return;
  rig.loadedNation = nationCode;
  const nation = getNationByCode(nationCode);

  const oldMat = rig.torsoMesh.material as THREE.MeshStandardMaterial;
  oldMat.map?.dispose();
  oldMat.map = createJerseyTexture(
    nation.code,
    nation.jerseyNumber,
    nation.primaryColor,
    nation.accentColor,
    maxAnisotropy,
  );
  oldMat.needsUpdate = true;

  (rig.shortsMesh.material as THREE.MeshStandardMaterial).color.set(nation.secondaryColor);
  (rig.headbandMesh.material as THREE.MeshStandardMaterial).color.set(nation.accentColor);
}

function animateAthletePose(rig: AthleteRig, p: PlayerSimState, elapsedSec: number): void {
  rig.root.position.set(p.x, 0, p.z);
  rig.bodyPivot.position.y = p.y;
  rig.bodyPivot.rotation.y = p.facingYaw;

  // Scale contact shadow based on jump altitude
  const altitudeFactor = Math.max(0.42, 1 - p.y * 0.16);
  rig.shadowMesh.scale.setScalar(altitudeFactor);
  (rig.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.68 * altitudeFactor;

  const horizontalSpeed = Math.hypot(p.vx, p.vz);

  if (p.diveTimer > 0) {
    // Horizontal diving save lunge pose!
    rig.bodyPivot.rotation.x = 1.18;
    rig.bodyPivot.position.y = Math.max(0.28, p.y + 0.25);
    rig.leftArmPivot.rotation.x = -2.45;
    rig.rightArmPivot.rotation.x = -2.45;
    rig.leftLegPivot.rotation.x = 0.35;
    rig.rightLegPivot.rotation.x = 0.35;
  } else if (p.y > 0.12) {
    // Airborne Spike / Block elevation pose!
    rig.bodyPivot.rotation.x = 0.08;
    const swingAngle = p.swingTimer > 0 ? -0.9 : -2.65;
    rig.rightArmPivot.rotation.x = swingAngle;
    rig.leftArmPivot.rotation.x = -2.45;
    rig.leftLegPivot.rotation.x = 0.32;
    rig.rightLegPivot.rotation.x = -0.18;
  } else {
    // Grounded athletic stance / running stride
    rig.bodyPivot.rotation.x = horizontalSpeed > 0.5 ? 0.12 : 0.04;
    if (p.swingTimer > 0) {
      // Forearm bump / overhead set follow-through
      rig.leftArmPivot.rotation.x = -1.45;
      rig.rightArmPivot.rotation.x = -1.45;
    } else if (horizontalSpeed > 0.45) {
      const stride = Math.sin(elapsedSec * 13.5) * 0.62;
      rig.leftLegPivot.rotation.x = stride;
      rig.rightLegPivot.rotation.x = -stride;
      rig.leftArmPivot.rotation.x = -0.45 - stride * 0.5;
      rig.rightArmPivot.rotation.x = -0.45 + stride * 0.5;
    } else {
      const breath = Math.sin(elapsedSec * 3.2) * 0.05;
      rig.leftLegPivot.rotation.x = 0;
      rig.rightLegPivot.rotation.x = 0;
      rig.leftArmPivot.rotation.x = -0.55 + breath;
      rig.rightArmPivot.rotation.x = -0.55 + breath;
    }
  }
}

export const VolleyballScene3D: React.FC<VolleyballScene3DProps> = ({
  simStateRef,
  cameraPreset,
  perspectiveSide,
  ballSkin = 'classic',
  onTickFrame,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const perspectiveSideRef = useRef<TeamSide>(perspectiveSide);
  const ballSkinRef = useRef<BallSkinId>(ballSkin);
  const onTickRef = useRef(onTickFrame);
  const [contextLost, setContextLost] = useState(false);

  cameraPresetRef.current = cameraPreset;
  perspectiveSideRef.current = perspectiveSide;
  ballSkinRef.current = ballSkin;
  onTickRef.current = onTickFrame;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL per Three.js skill directive
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Horizon Fog & Mandatory Studio RoomEnvironment PMREM
    const scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color('#132238');
    scene.background = skyHorizonColor;
    scene.fog = new THREE.FogExp2('#132238', 0.0115);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.2,
      180,
    );
    camera.position.set(0, 9.8, 17.5);
    camera.lookAt(0, 1.4, 0);

    // 3. Balanced Warm/Cool 3-Point Coastal Sunset Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#7DD3FC', '#C29B61', 0.72);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keySunLight = new THREE.DirectionalLight('#FFE4B5', 2.15);
    keySunLight.position.set(-14, 21, 12);
    keySunLight.castShadow = !isSoftwareGl;
    keySunLight.shadow.mapSize.set(1024, 1024);
    const d = 14;
    keySunLight.shadow.camera.left = -d;
    keySunLight.shadow.camera.right = d;
    keySunLight.shadow.camera.top = d;
    keySunLight.shadow.camera.bottom = -d;
    keySunLight.shadow.camera.near = 2;
    keySunLight.shadow.camera.far = 52;
    keySunLight.shadow.bias = -0.0005;
    keySunLight.shadow.normalBias = 0.02;
    scene.add(keySunLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.85);
    rimLight.position.set(14, 12, -16);
    scene.add(rimLight);

    // 4. Natural Outdoor Beach Terrain, Ocean Horizon & Stadium Perimeter
    const sandTex = createProceduralSandTexture(maxAnisotropy);
    const sandMat = new THREE.MeshStandardMaterial({
      map: sandTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const sandFloor = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), sandMat);
    sandFloor.rotation.x = -Math.PI / 2;
    sandFloor.receiveShadow = true;
    scene.add(sandFloor);

    // Coastal Twilight Ocean Plane beyond the north boardwalk (Z < -17)
    const oceanMat = new THREE.MeshStandardMaterial({
      color: '#0C4A6E',
      roughness: 0.2,
      metalness: 0.72,
    });
    const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(220, 90), oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0, -0.08, -62);
    scene.add(oceanMesh);

    // Court Boundary Tapes (18m x 9m, elevated by y = 0.018 + polygonOffset)
    const tapeMat = new THREE.MeshStandardMaterial({
      color: '#1D4ED8',
      roughness: 0.55,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const centerLineMat = new THREE.MeshStandardMaterial({
      color: '#F8FAFC',
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const courtLinesGroup = new THREE.Group();
    const tapeW = 0.11;
    const northTape = new THREE.Mesh(new THREE.PlaneGeometry(COURT_HALF_X * 2 + tapeW, tapeW), tapeMat);
    northTape.rotation.x = -Math.PI / 2;
    northTape.position.set(0, 0.018, -COURT_HALF_Z);

    const southTape = northTape.clone();
    southTape.position.set(0, 0.018, COURT_HALF_Z);

    const westTape = new THREE.Mesh(new THREE.PlaneGeometry(tapeW, COURT_HALF_Z * 2 + tapeW), tapeMat);
    westTape.rotation.x = -Math.PI / 2;
    westTape.position.set(-COURT_HALF_X, 0.018, 0);

    const eastTape = westTape.clone();
    eastTape.position.set(COURT_HALF_X, 0.018, 0);

    const centerTape = new THREE.Mesh(new THREE.PlaneGeometry(0.08, COURT_HALF_Z * 2), centerLineMat);
    centerTape.rotation.x = -Math.PI / 2;
    centerTape.position.set(0, 0.019, 0);

    courtLinesGroup.add(northTape, southTape, westTape, eastTape, centerTape);
    scene.add(courtLinesGroup);

    // 5. Composite 8-Part Championship Net & Referee Stand Assembly
    const netAssembly = new THREE.Group();
    const postMetalMat = new THREE.MeshStandardMaterial({
      color: '#CBD5E1',
      metalness: 0.85,
      roughness: 0.22,
    });
    const postPadMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.65,
      metalness: 0.1,
    });

    [-COURT_HALF_Z - 0.65, COURT_HALF_Z + 0.65].forEach((zPos) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, NET_HEIGHT + 0.3, 16), postMetalMat);
      post.position.set(0, (NET_HEIGHT + 0.3) / 2, zPos);
      post.castShadow = true;
      netAssembly.add(post);

      const postPad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 14), postPadMat);
      postPad.position.set(0, 0.75, zPos);
      netAssembly.add(postPad);
    });

    // Woven Net Mesh + Top Canvas Tape + Sideline Antennas
    const netTex = createNetMeshTexture(maxAnisotropy);
    const netMeshMat = new THREE.MeshStandardMaterial({
      map: netTex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.75,
    });
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(COURT_HALF_Z * 2 + 1.0, 1.05), netMeshMat);
    netPlane.position.set(0, NET_HEIGHT - 0.54, 0);
    netPlane.rotation.y = Math.PI / 2;
    netAssembly.add(netPlane);

    const topTapeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.09, COURT_HALF_Z * 2 + 1.15),
      new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.42 }),
    );
    topTapeMesh.position.set(0, NET_HEIGHT, 0);
    topTapeMesh.castShadow = true;
    netAssembly.add(topTapeMesh);

    const bottomCordMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, COURT_HALF_Z * 2 + 1.15),
      new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.45 }),
    );
    bottomCordMesh.position.set(0, NET_HEIGHT - 1.06, 0);
    netAssembly.add(bottomCordMesh);

    const antennaMat = new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.35 });
    [-COURT_HALF_Z, COURT_HALF_Z].forEach((zAnt) => {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.65, 8), antennaMat);
      antenna.position.set(0, NET_HEIGHT - 0.15, zAnt);
      netAssembly.add(antenna);
    });

    // Referee Stand on North Post
    const refStand = new THREE.Group();
    refStand.position.set(0, 0, -COURT_HALF_Z - 1.35);
    const standPlatform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.45, 0.9), postPadMat);
    standPlatform.position.set(0, 0.725, 0);
    standPlatform.castShadow = true;
    const standRail = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.55, 0.08), postMetalMat);
    standRail.position.set(0, 1.72, 0.42);
    refStand.add(standPlatform, standRail);
    netAssembly.add(refStand);

    scene.add(netAssembly);

    // 6. Stadium Bleachers, Floodlights & Instanced Coastal Palms/Rocks (> 24 instances)
    const stadiumGroup = new THREE.Group();
    const concreteMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.85, metalness: 0.1 });
    const trimBoardMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.55, metalness: 0.2 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: '#FEF3C7',
      emissive: '#F59E0B',
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    // Low perimeter court boards (leaving plenty of sand run-off)
    [-9.2, 9.2].forEach((zSide) => {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(23, 0.65, 0.28), trimBoardMat);
      barrier.position.set(0, 0.325, zSide);
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      stadiumGroup.add(barrier);
    });

    // North & East/West Grandstand Tiers
    [0, 1, 2].forEach((tier) => {
      const stepBench = new THREE.Mesh(new THREE.BoxGeometry(25, 0.65, 1.15), concreteMat);
      stepBench.position.set(0, 0.325 + tier * 0.65, -11.4 - tier * 1.18);
      stepBench.receiveShadow = true;
      stadiumGroup.add(stepBench);
    });

    // 4 Stadium Floodlight Towers
    [
      [-13.5, -11.5],
      [13.5, -11.5],
      [-13.5, 10.5],
      [13.5, 10.5],
    ].forEach(([lx, lz]) => {
      const tower = new THREE.Group();
      tower.position.set(lx, 0, lz);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 12.5, 10), postMetalMat);
      mast.position.y = 6.25;
      const headBox = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 0.45), trimBoardMat);
      headBox.position.set(0, 12.6, 0);
      headBox.lookAt(0, 0, 0);
      const lampPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.65), lampGlowMat);
      lampPanel.position.set(0, 12.55, lz < 0 ? 0.25 : -0.25);
      if (lz > 0) lampPanel.rotation.y = Math.PI;
      tower.add(mast, headBox, lampPanel);
      stadiumGroup.add(tower);
    });
    scene.add(stadiumGroup);

    // Instanced Coastal Rocks & Palm Trees (28 rocks + 12 palms -> InstancedMesh with ±15% scale & tint)
    const rockCount = 28;
    const rockGeo = new THREE.DodecahedronGeometry(0.95, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.88, metalness: 0.06 });
    const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const radius = 19.5 + (i % 5) * 3.4;
      const rx = Math.cos(angle) * radius * 1.25;
      const rz = Math.sin(angle) * radius * 0.88 - 2;
      const scale = 0.85 + ((i * 37) % 31) / 100; // ±15% variation
      _dummyMatrixObj.position.set(rx, scale * 0.35, rz);
      _dummyMatrixObj.rotation.set(i * 0.4, i * 0.9, 0);
      _dummyMatrixObj.scale.set(scale * 1.3, scale * 0.72, scale);
      _dummyMatrixObj.updateMatrix();
      rockInstanced.setMatrixAt(i, _dummyMatrixObj.matrix);
      _tmpColor.setHSL(0.58, 0.12, 0.26 + (i % 4) * 0.04);
      rockInstanced.setColorAt(i, _tmpColor);
    }
    rockInstanced.instanceMatrix.needsUpdate = true;
    if (rockInstanced.instanceColor) rockInstanced.instanceColor.needsUpdate = true;
    rockInstanced.computeBoundingSphere();
    scene.add(rockInstanced);

    // 7. Athletes, 18-Panel Volleyball, Target Ring & Surge Trail InstancedMesh
    const shadowTex = createSoftShadowTexture();
    const initialState = simStateRef.current;

    const leftRig = buildCompositeAthleteRig(initialState.leftPlayer.nationCode, shadowTex, maxAnisotropy);
    const rightRig = buildCompositeAthleteRig(initialState.rightPlayer.nationCode, shadowTex, maxAnisotropy);
    scene.add(leftRig.root, rightRig.root);

    let loadedBallSkin: BallSkinId = ballSkinRef.current;
    let ballTex = createProceduralVolleyballTexture(maxAnisotropy, loadedBallSkin);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.36,
      metalness: 0.06,
    });
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 22), ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.65,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    ballShadowMesh.rotation.x = -Math.PI / 2;
    ballShadowMesh.position.y = 0.023;
    scene.add(ballShadowMesh);

    // Predicted Ball Landing Ring on Sand (vital for 3D depth judgement!)
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const targetRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.54, 32), targetRingMat);
    targetRingMesh.rotation.x = -Math.PI / 2;
    targetRingMesh.position.y = 0.026;
    scene.add(targetRingMesh);

    // Instanced Surge Trail Spheres (22 reusable orbs, zero runtime allocations)
    const TRAIL_COUNT = 22;
    const trailPositions = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3(0, -10, 0));
    const trailGeo = new THREE.SphereGeometry(BALL_RADIUS * 0.72, 10, 8);
    const trailMat = new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const trailInstanced = new THREE.InstancedMesh(trailGeo, trailMat, TRAIL_COUNT);
    trailInstanced.frustumCulled = false;
    scene.add(trailInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 8. Continuous Game Loop with Software-WebGL fenceSync Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;
    let trailSampleAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;

      onTickRef.current?.(dt, elapsed);

      const st = simStateRef.current;

      // Sync national kit textures if changed
      updateAthleteRigMaterials(leftRig, st.leftPlayer.nationCode, maxAnisotropy);
      updateAthleteRigMaterials(rightRig, st.rightPlayer.nationCode, maxAnisotropy);

      // Animate both athletes
      animateAthletePose(leftRig, st.leftPlayer, elapsed);
      animateAthletePose(rightRig, st.rightPlayer, elapsed);

      // Update Volleyball transform & spin
      ballMesh.position.set(st.ball.x, st.ball.y, st.ball.z);
      ballMesh.rotation.z += st.ball.spinZ * dt;
      ballMesh.rotation.x += st.ball.vz * 0.35 * dt;

      // Update ball ground shadow
      ballShadowMesh.position.set(st.ball.x, 0.023, st.ball.z);
      const bScale = Math.max(0.35, 1 - st.ball.y * 0.11);
      ballShadowMesh.scale.setScalar(bScale);

      // Update Landing Target Indicator during active rally
      if (st.phase === 'rally') {
        targetRingMesh.visible = true;
        targetRingMesh.position.set(st.ball.landingX, 0.026, st.ball.landingZ);
        const pulseScale = 0.92 + Math.sin(elapsed * 9) * 0.1;
        targetRingMesh.scale.setScalar(pulseScale);

        const mySide = perspectiveSideRef.current;
        const landingOnMySide = mySide === 'left' ? st.ball.landingX < 0 : st.ball.landingX > 0;
        targetRingMat.color.set(landingOnMySide ? '#F59E0B' : '#10B981');
      } else {
        targetRingMesh.visible = false;
      }

      // Update Instanced Ball Trail
      trailSampleAccum += dt;
      if (trailSampleAccum >= 0.018) {
        trailSampleAccum = 0;
        for (let i = TRAIL_COUNT - 1; i > 0; i--) {
          trailPositions[i].copy(trailPositions[i - 1]);
        }
        if (st.phase === 'rally') {
          trailPositions[0].set(st.ball.x, st.ball.y, st.ball.z);
        } else {
          trailPositions[0].set(0, -10, 0);
        }
      }

      // Sync 3D Volleyball reward skin dynamically if changed
      if (loadedBallSkin !== ballSkinRef.current) {
        loadedBallSkin = ballSkinRef.current;
        ballTex.dispose();
        ballTex = createProceduralVolleyballTexture(maxAnisotropy, loadedBallSkin);
        ballMat.map = ballTex;
        ballMat.needsUpdate = true;
      }

      const activeSkinConfig = BALL_SKIN_CATALOG[loadedBallSkin] || BALL_SKIN_CATALOG.classic;
      trailMat.color.set(
        st.ball.isSurgeShot
          ? activeSkinConfig.trailHex
          : loadedBallSkin === 'classic'
            ? '#E2E8F0'
            : activeSkinConfig.trailHex,
      );
      trailMat.opacity = st.ball.isSurgeShot ? 0.62 : loadedBallSkin === 'classic' ? 0.22 : 0.36;

      for (let i = 0; i < TRAIL_COUNT; i++) {
        const tp = trailPositions[i];
        const ratio = 1 - i / TRAIL_COUNT;
        _dummyMatrixObj.position.copy(tp);
        _dummyMatrixObj.scale.setScalar(tp.y < 0 ? 0.001 : ratio * (st.ball.isSurgeShot ? 1.15 : 0.65));
        _dummyMatrixObj.updateMatrix();
        trailInstanced.setMatrixAt(i, _dummyMatrixObj.matrix);
      }
      trailInstanced.instanceMatrix.needsUpdate = true;

      // Smooth Camera Preset Choreography via THREE.MathUtils.damp
      const preset = cameraPresetRef.current;
      const side = perspectiveSideRef.current;
      const followX = st.ball.x * 0.22;
      const followZ = st.ball.z * 0.18;

      if (preset === 'broadcast') {
        _camGoalPos.set(followX, 9.2, 16.6);
        _camGoalLook.set(followX * 0.6, 1.45, followZ * 0.4);
      } else if (preset === 'pro_behind') {
        const myP = side === 'left' ? st.leftPlayer : st.rightPlayer;
        const camSign = side === 'left' ? -1 : 1;
        _camGoalPos.set(camSign * 14.8, 6.2, myP.z * 0.45);
        _camGoalLook.set(-camSign * 2.2, 1.65, st.ball.z * 0.35);
      } else {
        // Sky tactical overview
        _camGoalPos.set(0, 17.5, 11.2);
        _camGoalLook.set(0, 0.8, 0);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 5.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 5.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 5.5, dt);

      _camCurrLook.x = THREE.MathUtils.damp(_camCurrLook.x, _camGoalLook.x, 6.5, dt);
      _camCurrLook.y = THREE.MathUtils.damp(_camCurrLook.y, _camGoalLook.y, 6.5, dt);
      _camCurrLook.z = THREE.MathUtils.damp(_camCurrLook.z, _camGoalLook.z, 6.5, dt);
      camera.lookAt(_camCurrLook);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
      sandTex.dispose();
      ballTex.dispose();
      netTex.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [simStateRef]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center">
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold">Restoring 3D Arena Renderer</h3>
            <p className="text-sm text-slate-400">
              Graphics context was interrupted and is reconnecting automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
