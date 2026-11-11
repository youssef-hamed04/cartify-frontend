const root = document.querySelector('.smartbox');

if (root) {
  let started = false;
  let visible = false;
  let scenePlayer;
  const section = root.closest('.return-home');
  const sync = () => scenePlayer?.setVisible(visible && !document.hidden);

  async function start() {
    if (started) return;
    started = true;
    try {
      // Dynamic imports keep both the download and GPU work off the initial page load.
      const [THREE, { OrbitControls }, { RoundedBoxGeometry }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/geometries/RoundedBoxGeometry.js')
      ]);
      scenePlayer = createJourney(THREE, OrbitControls, RoundedBoxGeometry);
      sync();
    } catch (error) {
      console.warn('SmartBox preview unavailable; keeping the original image.', error);
    }
  }

  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    const preload = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        preload.disconnect();
        start();
      }
    }, { rootMargin: '200px' });
    preload.observe(section);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    visibility.observe(root);
  } else {
    visible = true;
    start();
  }
}

function createJourney(THREE, OrbitControls, RoundedBoxGeometry) {
  const viewport = root.querySelector('.smartbox-viewport');
  const fallback = root.querySelector('.smartbox-fallback');
  const player = root.querySelector('.smartbox-player');
  const caption = root.querySelector('.smartbox-caption');
  const progress = root.querySelector('progress');
  const toggle = root.querySelector('.smartbox-toggle');
  const buttons = [...root.querySelectorAll('[data-step]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Rotatable Smart Return Box. Use arrow keys to rotate, or drag sideways.');
  canvas.setAttribute('aria-describedby', 'smartbox-caption');
  canvas.tabIndex = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ecedff');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30);
  camera.position.set(2.2, 1.9, 3.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.75, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.25;
  controls.maxDistance = 5;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.autoRotate = false;
  // OrbitControls assigns touch-action:none; native vertical scrolling must win here.
  canvas.style.touchAction = 'pan-y';
  scene.add(new THREE.HemisphereLight('#ffffff', '#7281a8', 2.6));
  const keyLight = new THREE.DirectionalLight('#fff8ee', 3.5);
  keyLight.position.set(-3, 5, 4);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight('#9eb9ff', 2.8);
  rim.position.set(3, 3, -2);
  scene.add(rim);

  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.48, metalness: 0.08, ...extra
  });
  const shell = material('#f3f5fb');
  const navy = material('#02067e');
  const inner = material('#b6c2d7');
  function box(parent, size, position, surface = shell, radius = 0.025) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, radius), surface);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  function texture(width, height, draw) {
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const context = source.getContext('2d');
    draw(context, width, height);
    const map = new THREE.CanvasTexture(source);
    map.colorSpace = THREE.SRGBColorSpace;
    return { source, context, map };
  }
  function label(parent, text, size, position, color = '#02067e', background = '#f3f5fb') {
    const art = texture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.font = 'bold 48px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2, w - 16);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({ map: art.map }));
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  const cabinet = new THREE.Group();
  scene.add(cabinet);
  // Separate walls leave a real cavity, rather than hiding the interior in a solid cube.
  box(cabinet, [1, 0.09, 0.8], [0, 0.125, 0]);
  box(cabinet, [0.07, 1.3, 0.8], [-0.465, 0.8, 0]);
  box(cabinet, [0.07, 1.3, 0.8], [0.465, 0.8, 0]);
  box(cabinet, [0.88, 1.3, 0.055], [0, 0.8, -0.37], inner);
  // Four narrow rails form the band and fixed rim, leaving the top completely open.
  for (const z of [-0.37, 0.37]) {
    box(cabinet, [1, 0.055, 0.06], [0, 1.405, z], navy, 0.012);
    box(cabinet, [1, 0.025, 0.06], [0, 1.445, z], shell, 0.008);
  }
  for (const x of [-0.465, 0.465]) {
    box(cabinet, [0.07, 0.055, 0.68], [x, 1.405, 0], navy, 0.012);
    box(cabinet, [0.07, 0.025, 0.68], [x, 1.445, 0], shell, 0.008);
  }
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.49, -0.4);
  cabinet.add(lidPivot);
  const lidMaterial = material('#f3f5fb', { transparent: true });
  box(lidPivot, [1, 0.06, 0.8], [0, 0, 0.4], lidMaterial);
  box(lidPivot, [0.42, 0.035, 0.045], [0, -0.008, 0.81], navy, 0.01);
  for (const x of [-0.32, 0.32]) {
    box(cabinet, [0.13, 0.04, 0.065], [x, 1.475, -0.4], inner, 0.01);
  }
  box(cabinet, [0.24, 1.23, 0.09], [0.345, 0.79, 0.37]);
  for (const x of [-0.37, 0.37]) {
    for (const z of [-0.28, 0.28]) box(cabinet, [0.12, 0.08, 0.12], [x, 0.04, z], navy);
  }
  label(cabinet, 'Cartify', [0.22, 0.065], [0.335, 1.29, 0.421]);
  const maintenancePanel = material('#f1f3fa');
  // Spans the whole gap to the keypad column so the cavity never shows through
  box(cabinet, [0.655, 1.21, 0.055], [-0.1, 0.79, 0.425], maintenancePanel);
  label(cabinet, 'SmartBox', [0.39, 0.10], [-0.105, 1.12, 0.454]);
  label(cabinet, 'MAINTENANCE', [0.31, 0.045], [-0.105, 0.29, 0.454], '#8a94b8', '#f1f3fa');
  const lock = new THREE.Mesh(new THREE.CircleGeometry(0.017, 20), material('#111c45'));
  lock.position.set(0.14, 0.81, 0.454);
  cabinet.add(lock);
  for (const y of [0.36, 1.2]) box(cabinet, [0.035, 0.13, 0.07], [-0.43, y, 0.43], inner, 0.012);
  box(cabinet, [0.58, 0.045, 0.57], [-0.105, 0.205, -0.005], material('#8292b3', { metalness: 0.65 }));
  // The back-wall camera and its flash point toward the scale, independent of the lid.
  const cameraModule = new THREE.Group();
  cameraModule.position.set(-0.1, 1.32, -0.31);
  cameraModule.lookAt(-0.105, 0.205, -0.005);
  cabinet.add(cameraModule);
  box(cameraModule, [0.12, 0.1, 0.055], [0, 0, 0], navy, 0.01);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.022, 16), material('#111c45'));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.038);
  cameraModule.add(lens);
  const insideLight = new THREE.PointLight('#22c55e', 0, 1.6);
  insideLight.position.set(-0.1, 1.36, 0);
  cabinet.add(insideLight);
  const flash = new THREE.PointLight('#ffffff', 0, 2);
  flash.position.set(0.04, 0, 0.06);
  cameraModule.add(flash);

  box(cabinet, [0.205, 0.18, 0.025], [0.34, 1.12, 0.425], navy, 0.012);
  const screen = texture(512, 256, () => {});
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.145),
    new THREE.MeshBasicMaterial({ map: screen.map }));
  screenMesh.position.set(0.34, 1.12, 0.441);
  cabinet.add(screenMesh);
  let lastScreen = '';
  function setScreen(title, value, green = false) {
    const signature = `${title}:${value}:${green}`;
    if (lastScreen === signature) return;
    lastScreen = signature;
    const ctx = screen.context;
    ctx.fillStyle = '#101c3c';
    ctx.fillRect(0, 0, 512, 256);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9eb9ff';
    ctx.font = '32px sans-serif';
    ctx.fillText(title, 256, 65);
    ctx.fillStyle = green ? '#22c55e' : '#ffffff';
    ctx.font = 'bold 62px sans-serif';
    ctx.fillText(value, 256, 165);
    screen.map.needsUpdate = true;
  }
  const keys = [];
  [...'123456789*0#'].forEach((digit, i) => {
    const x = 0.275 + (i % 3) * 0.065;
    const y = 0.94 - Math.floor(i / 3) * 0.07;
    const key = box(cabinet, [0.052, 0.052, 0.022], [x, y, 0.432], material('#d7def3'), 0.009);
    label(cabinet, digit, [0.035, 0.026], [x, y, 0.444], '#02067e', '#d7def3');
    keys.push({ digit, key });
  });
  const parcel = new THREE.Group();
  cabinet.add(parcel);
  box(parcel, [0.36, 0.28, 0.32], [0, 0, 0], material('#5c61ff'));
  box(parcel, [0.07, 0.282, 0.322], [0, 0, 0], material('#9eb9ff'), 0.008);
  label(parcel, 'return', [0.14, 0.05], [0.09, 0, 0.162]);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.5),
    new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  scan.rotation.x = -Math.PI / 2;
  scan.position.set(-0.1, 0.6, 0);
  cabinet.add(scan);
  const badgeArt = texture(128, 128, (ctx) => {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(64, 64, 59, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(35, 64);
    ctx.lineTo(55, 84);
    ctx.lineTo(94, 44);
    ctx.stroke();
  });
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeArt.map, depthTest: false }));
  scene.add(badge);
  const shadowArt = texture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, '#101c3c70');
    gradient.addColorStop(1, '#101c3c00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1),
    new THREE.MeshBasicMaterial({ map: shadowArt.map, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.005;
  scene.add(shadow);

  const particleSprite = texture(32, 32, (ctx) => {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, '#ffffffff');
    gradient.addColorStop(0.3, '#ffffffb0');
    gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  });
  const particles = new THREE.Group();
  scene.add(particles);
  // Seed once: replaying a step reproduces the same trajectories without frame-time randomness.
  let particleSeed = 7762248;
  function random() {
    particleSeed = (Math.imul(particleSeed, 1664525) + 1013904223) >>> 0;
    return particleSeed / 4294967296;
  }
  function points(count, size, palette, opacity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    const colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const swatches = palette.map((color) => new THREE.Color(color));
    for (let i = 0; i < count; i++) {
      const color = swatches[i % swatches.length];
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    geometry.setAttribute('position', positions);
    geometry.setAttribute('color', colors);
    const surface = new THREE.PointsMaterial({
      size, map: particleSprite.map, vertexColors: true, transparent: true,
      opacity, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false
    });
    const cloud = new THREE.Points(geometry, surface);
    // These small dynamic clouds move beyond their initial all-zero geometry bounds.
    cloud.frustumCulled = false;
    particles.add(cloud);
    return { cloud, positions, colors, surface };
  }
  const motes = points(120, 0.018, ['#9eb9ff', '#5c61ff'], 0.18);
  const puff = points(40, 0.045, ['#ecedff', '#d7dbea'], 0.65);
  const sparkles = points(60, 0.025, ['#22c55e'], 0.8);
  // Bigger and denser than the other clouds: it has to read clearly on the light background
  const burst = points(180, 0.055, [
    '#22c55e', '#5c61ff', '#22c55e', '#02067e', '#5c61ff', '#9eb9ff', '#22c55e'
  ], 1);
  const moteSeeds = Array.from({ length: 120 }, () => ({
    angle: random() * Math.PI * 2, radius: 0.8 + random() * 0.6,
    height: random() * 2.4, speed: 0.035 + random() * 0.035
  }));
  const puffSeeds = Array.from({ length: 40 }, (_, i) => ({
    angle: i / 40 * Math.PI * 2 + random() * 0.08, spread: 0.02 + random() * 0.03
  }));
  const sparkleSeeds = Array.from({ length: 60 }, () => ({
    x: -0.1 + (random() - 0.5) * 0.53, z: (random() - 0.5) * 0.48,
    phase: random() * Math.PI * 2, frequency: 18 + random() * 12
  }));
  const burstSeeds = Array.from({ length: 180 }, () => {
    const angle = random() * Math.PI * 2;
    // Wide and fairly low arcs keep the burst inside the frame of the step-5 camera
    const speed = 0.35 + random() * 0.6;
    return { x: Math.cos(angle) * speed, y: 0.7 + random() * 0.8, z: Math.sin(angle) * speed };
  });
  const sparkleGreen = new THREE.Color('#22c55e');
  sparkles.colors.setUsage(THREE.DynamicDrawUsage);
  let driftTime = 0;
  let backgroundField = null;

  function updateParticles(t, delta) {
    particles.visible = !motion.matches;
    if (motion.matches) return;
    driftTime += delta; // ambient drift keeps going while paused; only the journey stops
    moteSeeds.forEach((seed, i) => {
      const angle = seed.angle + driftTime * 0.025;
      motes.positions.setXYZ(i, Math.cos(angle) * seed.radius,
        (seed.height + driftTime * seed.speed) % 2.4, Math.sin(angle) * seed.radius);
    });
    motes.positions.needsUpdate = true;

    // Contact is at 82% of the drop; finish the puff before this step ends (~0.38 s).
    const puffAge = (t - 0.82) * steps[2].duration;
    puff.cloud.visible = step === 2 && puffAge >= 0 && puffAge < 0.38;
    if (puff.cloud.visible) {
      const life = puffAge / 0.38;
      puffSeeds.forEach((seed, i) => {
        const radius = 0.22 + seed.spread * (1 - Math.pow(1 - life, 2));
        puff.positions.setXYZ(i, -0.1 + Math.cos(seed.angle) * radius,
          0.235 + Math.sin(life * Math.PI) * 0.018, Math.sin(seed.angle) * radius);
      });
      puff.surface.opacity = 0.65 * Math.pow(1 - life, 2);
      puff.positions.needsUpdate = true;
    }

    sparkles.cloud.visible = step === 3 && scan.visible;
    if (sparkles.cloud.visible) {
      sparkleSeeds.forEach((seed, i) => {
        const flicker = 0.35 + 0.65 * Math.pow(Math.sin(t * steps[3].duration * seed.frequency + seed.phase), 2);
        sparkles.positions.setXYZ(i, seed.x, scan.position.y + 0.003, seed.z);
        sparkles.colors.setXYZ(i, sparkleGreen.r * flicker, sparkleGreen.g * flicker, sparkleGreen.b * flicker);
      });
      sparkles.positions.needsUpdate = true;
      sparkles.colors.needsUpdate = true;
    }

    const burstAge = t * steps[4].duration;
    burst.cloud.visible = step === 4 && burstAge < 1.6;
    if (burst.cloud.visible) {
      burstSeeds.forEach((velocity, i) => {
        burst.positions.setXYZ(i, -0.1 + velocity.x * burstAge,
          1.56 + velocity.y * burstAge - 0.5 * 2.4 * burstAge * burstAge,
          velocity.z * burstAge);
      });
      burst.surface.opacity = Math.pow(1 - burstAge / 1.6, 1.2);
      burst.positions.needsUpdate = true;
    }
  }

  const steps = [
    { duration: 2.5, eye: [0.95, 1.42, 1.8], target: [0.22, 1.02, 0.25], caption: 'Enter your Locker ID, then your four-digit unlock code.' },
    { duration: 1.8, eye: [1.1, 2.8, 2.1], target: [0, 1.05, 0], caption: 'Your code unlocks the lid. The green light means the box is ready.' },
    { duration: 2.2, eye: [0.35, 3.2, 0.75], target: [-0.1, 1.05, 0], caption: 'Drop your item in from the top, onto the weighing plate.' },
    { duration: 2.5, eye: [0.55, 3.05, 1.15], target: [-0.1, 0.75, 0], caption: 'The lid closes; the scale weighs your item and the camera takes a photo.' },
    { duration: 2, eye: [2.2, 1.9, 3.6], target: [0, 0.85, 0], caption: 'The AI check verifies your item. Your return is ready.' }
  ];
  let step = 0;
  let elapsed = motion.matches ? steps[0].duration : 0;
  let playing = !motion.matches;
  let animating = playing;
  let cameraTween = !motion.matches;
  let active = false;
  let failed = false;
  let ready = false;
  let raf = 0;
  let lastTime = 0;
  const startEye = camera.position.clone();
  const startTarget = controls.target.clone();
  const endEye = new THREE.Vector3();
  const endTarget = new THREE.Vector3();
  const ease = (t) => t * t * (3 - 2 * t);
  const clamp = THREE.MathUtils.clamp;

  function updateUI() {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === step));
      if (i === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    caption.textContent = steps[step].caption;
    toggle.textContent = playing ? 'Pause' : 'Play';
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? 'Pause return journey' : 'Play return journey');
    toggle.disabled = motion.matches;
    if (motion.matches) {
      toggle.textContent = 'Manual';
      toggle.setAttribute('aria-label', 'Reduced motion enabled; select a step to explore');
    }
  }

  function selectStep(index) {
    step = index;
    elapsed = motion.matches ? steps[step].duration : 0;
    animating = !motion.matches;
    cameraTween = !motion.matches && !interacting;
    startEye.copy(camera.position);
    startTarget.copy(controls.target);
    updateUI();
  }

  // Every state is derived from (step, progress), so arbitrary jumps need no prior playback.
  function pose(t) {
    const e = ease(t);
    const open = step === 1 ? e : step === 2 ? 1 : step === 3 ? 1 - ease(clamp(t / 0.35, 0, 1)) : 0;
    lidPivot.rotation.x = -open * Math.PI * 105 / 180;
    insideLight.intensity = step === 1 || step === 2 ? 0.8 * open : 0;
    parcel.visible = step >= 2;
    parcel.position.set(-0.1, 0.367, 0);
    if (step === 2) {
      const drop = clamp(t / 0.82, 0, 1);
      parcel.position.y += (1.95 - 0.367) * Math.pow(1 - drop, 3);
      const settle = clamp((t - 0.82) / 0.18, 0, 1);
      parcel.position.y += Math.sin(settle * Math.PI) * 0.018;
    }
    // Only the closed lid becomes a cutaway; the maintenance panel stays opaque.
    const scanning = step === 3 && t > 0.4 && t < 0.92;
    lidMaterial.opacity = scanning ? 0.22 : 1;
    lidMaterial.depthWrite = !scanning;
    scan.visible = scanning;
    scan.position.y = 0.85 - clamp((t - 0.4) / 0.52, 0, 1) * 0.59;
    flash.intensity = !motion.matches && step === 3 ? Math.max(0, 1 - Math.abs(t - 0.72) / 0.035) * 7 : 0;
    badge.visible = step === 4;
    badge.position.set(0, 1.72 + 0.12 * e, 0);
    badge.scale.setScalar(0.32 * ease(clamp(t * 3, 0, 1)));
    const digits = '7762248';
    const typed = Math.min(7, Math.floor(t * 8));
    keys.forEach(({ digit, key }) => {
      const lit = step === 0 && typed < 7 && digit === digits[typed] && (t * 8) % 1 < 0.7;
      key.material.emissive.set(lit ? '#5c61ff' : '#000000');
      key.material.emissiveIntensity = lit ? 1.5 : 0;
    });
    if (step === 0) setScreen(typed <= 3 ? 'LOCKER ID' : 'UNLOCK CODE', typed <= 3 ? digits.slice(0, typed) || '___' : digits.slice(3, typed));
    else if (step === 1 || step === 2) setScreen('READY', 'OPEN', true);
    else if (step === 3) setScreen('WEIGH & PHOTO', t < 0.45 ? 'WAIT' : '4520 g');
    else setScreen('RETURN CHECK', 'VERIFIED', true);
    progress.value = t;
  }

  let interacting = false;
  controls.addEventListener('start', () => { interacting = true; cameraTween = false; });
  controls.addEventListener('end', () => { interacting = false; });
  function rotate(horizontal, vertical = 0) {
    cameraTween = false;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= horizontal;
    spherical.phi = clamp(spherical.phi + vertical, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  }
  // Touch bypasses OrbitControls' pointer capture; the browser retains vertical pan gestures.
  let touch = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    event.stopImmediatePropagation();
    if (!touch) touch = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: null };
  }, true);
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') return;
    event.stopImmediatePropagation();
    if (!touch || event.pointerId !== touch.id) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    if (touch.horizontal === null && Math.hypot(dx, dy) > 8) {
      touch.horizontal = Math.abs(dx) > Math.abs(dy);
      if (touch.horizontal) canvas.setPointerCapture(event.pointerId);
    }
    if (touch.horizontal) {
      interacting = true;
      rotate(dx * 0.009);
      touch.x = event.clientX;
      touch.y = event.clientY;
    }
  }, true);
  for (const name of ['pointerup', 'pointercancel']) {
    canvas.addEventListener(name, (event) => {
      if (event.pointerType !== 'touch') return;
      event.stopImmediatePropagation();
      if (touch?.id === event.pointerId) { touch = null; interacting = false; }
    }, true);
  }
  canvas.addEventListener('keydown', (event) => {
    const directions = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
    if (!directions[event.key]) return;
    event.preventDefault();
    rotate(...directions[event.key]);
  });
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    playing = false;
    selectStep(index);
  }));
  toggle.addEventListener('click', () => {
    if (motion.matches) return;
    playing = !playing;
    animating = playing;
    if (playing && elapsed >= steps[step].duration) selectStep((step + 1) % steps.length);
    updateUI();
  });
  motion.addEventListener('change', () => {
    playing = false;
    animating = false;
    cameraTween = false;
    elapsed = steps[step].duration;
    particles.visible = false;
    backgroundField?.dispose();
    backgroundField = null;
    updateUI();
  });

  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(viewport.clientWidth || width || 1, viewport.clientHeight || height || 1, false);
    camera.aspect = (viewport.clientWidth || 1) / (viewport.clientHeight || 1);
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  }
  function fail(error) {
    failed = true;
    stop();
    resizeObserver.disconnect();
    backgroundField?.dispose();
    backgroundField = null;
    particles.children.forEach((cloud) => {
      cloud.geometry.dispose();
      cloud.material.dispose();
    });
    particleSprite.map.dispose();
    controls.dispose();
    renderer.dispose();
    canvas.remove();
    root.classList.remove('is-ready');
    fallback.hidden = false;
    player.hidden = true;
    root.querySelector('.smartbox-hint').hidden = true;
    root.querySelector('.smartbox-scan').hidden = true;
    console.warn('SmartBox preview unavailable; showing original image.', error);
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fail('WebGL context lost');
  });
  function frame(time) {
    raf = 0;
    if (!active || failed) return;
    try {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      if (animating) {
        elapsed = Math.min(elapsed + delta, steps[step].duration);
        if (elapsed >= steps[step].duration) {
          if (playing) selectStep((step + 1) % steps.length);
          else animating = false;
        }
      }
      const t = clamp(elapsed / steps[step].duration, 0, 1);
      pose(t);
      updateParticles(t, delta);
      if (cameraTween && !motion.matches) {
        const amount = ease(clamp(t / 0.75, 0, 1));
        camera.position.lerpVectors(startEye, endEye.fromArray(steps[step].eye), amount);
        controls.target.lerpVectors(startTarget, endTarget.fromArray(steps[step].target), amount);
      }
      controls.update();
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        root.classList.add('is-ready');
        fallback.hidden = true;
        player.hidden = false;
        root.querySelector('.smartbox-hint').hidden = false;
        root.querySelector('.smartbox-scan').hidden = false;
        resize();
      }
      // The decorative field only exists after a successful 3D frame, and shares this RAF.
      if (!motion.matches) {
        backgroundField ??= createBackgroundField(root.closest('.return-home'));
        backgroundField?.draw(delta);
      }
      raf = requestAnimationFrame(frame);
    } catch (error) {
      fail(error);
    }
  }
  try {
    viewport.append(canvas);
    resize();
    updateUI();
  } catch (error) {
    fail(error);
    throw error;
  }
  return {
    setVisible(value) {
      active = value;
      if (!active) stop();
      else if (!raf && !failed) raf = requestAnimationFrame(frame);
    }
  };
}

function createBackgroundField(section) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  canvas.className = 'smartbox-background-field';
  canvas.setAttribute('aria-hidden', 'true');
  const dots = Array.from({ length: 60 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4,
    radius: 0.6 + Math.random() * 0.7
  }));
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  function resize() {
    width = Math.max(1, section.clientWidth);
    height = Math.max(1, section.clientHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  section.classList.add('has-smartbox-field');
  section.prepend(canvas);
  resize();
  observer.observe(section);
  return {
    draw(delta) {
      if (pixelRatio !== Math.min(window.devicePixelRatio || 1, 2)) resize();
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#9eb9ff';
      context.strokeStyle = '#9eb9ff';
      for (const dot of dots) {
        dot.x = (dot.x + dot.vx * delta / width + 1) % 1;
        dot.y = (dot.y + dot.vy * delta / height + 1) % 1;
      }
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const x = dot.x * width;
        const y = dot.y * height;
        context.globalAlpha = 0.22;
        context.beginPath();
        context.arc(x, y, dot.radius, 0, Math.PI * 2);
        context.fill();
        for (let j = i + 1; j < dots.length; j++) {
          const other = dots[j];
          const distance = Math.hypot(x - other.x * width, y - other.y * height);
          if (distance >= 110) continue;
          context.globalAlpha = 0.09 * (1 - distance / 110);
          context.lineWidth = 0.6;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(other.x * width, other.y * height);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    },
    dispose() {
      observer.disconnect();
      canvas.remove();
      section.classList.remove('has-smartbox-field');
    }
  };
}
