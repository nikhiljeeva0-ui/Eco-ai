/* ═══════════════════════════════════
   API CONFIGURATION
   ═══════════════════════════════════ */
var API_BASE_URL = 'http://127.0.0.1:8000';  // Change to your Render URL for production
// var API_BASE_URL = 'https://your-backend.onrender.com';

/* ═══════════════════════════════════
   AUTH FUNCTIONS (global scope)
   ═══════════════════════════════════ */
var authIsLoginMode = true;

function toggleAuthMode() {
    authIsLoginMode = !authIsLoginMode;
    document.getElementById('authTitle').textContent = authIsLoginMode ? 'Sign In' : 'Create Account';
    document.getElementById('authSubtitle').textContent = authIsLoginMode
        ? 'Access your climate intelligence dashboard'
        : 'Join the EcoSphere Neural platform';
    document.getElementById('authSubmit').textContent = authIsLoginMode ? 'Sign In' : 'Register';
    document.getElementById('authToggleText').textContent = authIsLoginMode
        ? "Don't have an account?"
        : 'Already have an account?';
    document.getElementById('authToggleLink').textContent = authIsLoginMode ? 'Register' : 'Sign In';
    document.getElementById('authError').textContent = '';
}

function logoutUser() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    updateAuthUI();
}

function updateAuthUI() {
    var token = localStorage.getItem('access_token');
    var email = localStorage.getItem('user_email');
    var userBar = document.getElementById('userBar');
    var heroBtn = document.getElementById('heroAuthBtn');
    if (token && email) {
        userBar.style.display = 'flex';
        document.getElementById('userEmail').textContent = email;
        if (heroBtn) heroBtn.textContent = 'Launch Intelligence System';
    } else {
        userBar.style.display = 'none';
        if (heroBtn) heroBtn.textContent = 'Sign In to Launch';
    }
}

(function () {
    /* ═══════════════════════════════════
       INTRO SYSTEM
       ═══════════════════════════════════ */
    var introScreen = document.getElementById('introScreen');
    var skipBtn = document.getElementById('skipBtn');
    var introDot = document.getElementById('introDot');
    var introGlow = document.getElementById('introGlow');
    var introRipple = document.getElementById('introRipple');
    var introCanvas = document.getElementById('introCanvas');
    var introMain = document.getElementById('introMain');
    var introSub = document.getElementById('introSub');
    var introFinal = document.getElementById('introFinal');
    var introStatus = document.getElementById('introStatus');
    var enterBtn = document.getElementById('enterBtn');

    var introCtx = introCanvas.getContext('2d');
    var introAborted = false;

    function resizeIntroCanvas() {
        introCanvas.width = window.innerWidth;
        introCanvas.height = window.innerHeight;
    }
    resizeIntroCanvas();
    window.addEventListener('resize', resizeIntroCanvas);

    // Intro neural drawing state
    var introNodes = [];
    var introLines = [];
    var introNodeProgress = 0;
    var introLineProgress = 0;
    var introPhase2Active = false;
    var introPhase3Active = false;
    var cx, cy;

    function initIntroNodes() {
        cx = window.innerWidth / 2;
        cy = window.innerHeight / 2;
        introNodes = [];
        introLines = [];

        for (var i = 0; i < 60; i++) {
            var angle = Math.random() * Math.PI * 2;
            var dist = 40 + Math.random() * 200;
            introNodes.push({
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                r: 1.5 + Math.random() * 2,
                phase: Math.random() * Math.PI * 2,
                opacity: 0
            });
        }

        for (var j = 0; j < introNodes.length; j++) {
            var nearest = -1;
            var nearDist = Infinity;
            for (var k = 0; k < introNodes.length; k++) {
                if (k === j) continue;
                var d = Math.hypot(introNodes[j].x - introNodes[k].x, introNodes[j].y - introNodes[k].y);
                if (d < nearDist && d < 160) { nearDist = d; nearest = k; }
            }
            if (nearest >= 0) {
                introLines.push({ a: j, b: nearest, progress: 0, opacity: 0 });
            }
        }
    }
    initIntroNodes();

    function drawIntroNeural(t) {
        introCtx.clearRect(0, 0, introCanvas.width, introCanvas.height);

        for (var i = 0; i < introLines.length; i++) {
            var line = introLines[i];
            if (line.opacity <= 0) continue;
            var a = introNodes[line.a];
            var b = introNodes[line.b];

            if (introPhase3Active) {
                var offAx = (cx - a.x) * line.progress;
                var offAy = (cy - a.y) * line.progress;
                var offBx = (cx - b.x) * line.progress;
                var offBy = (cy - b.y) * line.progress;
                introCtx.beginPath();
                introCtx.moveTo(a.x + offAx, a.y + offAy);
                introCtx.lineTo(b.x + offBx, b.y + offBy);
            } else {
                introCtx.beginPath();
                introCtx.moveTo(a.x, a.y);
                var dx = b.x - a.x;
                var dy = b.y - a.y;
                introCtx.lineTo(a.x + dx * line.progress, a.y + dy * line.progress);
            }
            introCtx.strokeStyle = 'rgba(34, 211, 238, ' + (line.opacity * 0.35) + ')';
            introCtx.lineWidth = 1;
            introCtx.stroke();
        }

        for (var j = 0; j < introNodes.length; j++) {
            var n = introNodes[j];
            if (n.opacity <= 0) continue;
            var pulse = 0.6 + 0.4 * Math.sin(t * 2 + n.phase);

            var nx = n.x;
            var ny = n.y;
            if (introPhase3Active) {
                nx = n.x + (cx - n.x) * introLineProgress;
                ny = n.y + (cy - n.y) * introLineProgress;
            }

            introCtx.beginPath();
            introCtx.arc(nx, ny, n.r * pulse, 0, Math.PI * 2);
            introCtx.fillStyle = 'rgba(0, 255, 178, ' + (n.opacity * pulse) + ')';
            introCtx.fill();
            introCtx.beginPath();
            introCtx.arc(nx, ny, n.r * pulse * 2.5, 0, Math.PI * 2);
            introCtx.fillStyle = 'rgba(0, 255, 178, ' + (n.opacity * pulse * 0.15) + ')';
            introCtx.fill();
        }
    }

    var introAnimId;
    var introStartTime = performance.now();

    function introAnimLoop() {
        if (introAborted) return;
        var t = (performance.now() - introStartTime) / 1000;
        if (introPhase2Active || introPhase3Active) {
            drawIntroNeural(t);
        }
        introAnimId = requestAnimationFrame(introAnimLoop);
    }
    introAnimLoop();

    // Master timeline
    var tl = gsap.timeline({ onComplete: function () { } });

    // Show skip button
    tl.to(skipBtn, { opacity: 1, duration: 0.5 }, 0.3);

    // ── PHASE 1: System Initialization ──
    tl.to(introDot, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.3);
    tl.to(introGlow, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0.5);

    tl.call(function () {
        introMain.textContent = 'Initializing Climate Intelligence…';
        introMain.classList.add('glitch');
    }, [], 0.8);
    tl.to(introMain, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.8);
    tl.to(introSub, { opacity: 0, duration: 0 }, 0.8);

    tl.call(function () {
        introSub.textContent = 'Loading core neural subsystems';
    }, [], 1.2);
    tl.to(introSub, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.2);

    // Dot pulse
    tl.to(introDot, {
        boxShadow: '0 0 40px #00FFB2, 0 0 100px rgba(0,255,178,0.4)',
        scale: 1.3,
        duration: 0.8,
        repeat: 2,
        yoyo: true,
        ease: 'sine.inOut'
    }, 1);

    // ── PHASE 2: Neural Activation ──
    tl.to(introMain, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 3);
    tl.to(introSub, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3);

    tl.call(function () {
        introMain.textContent = 'Activating Neural Sustainability Engine…';
        introMain.classList.remove('glitch');
        introPhase2Active = true;
    }, [], 3.4);
    tl.to(introMain, { opacity: 1, duration: 0.6 }, 3.5);

    tl.call(function () {
        introSub.textContent = 'Establishing neural pathways';
    }, [], 3.7);
    tl.to(introSub, { opacity: 0.7, duration: 0.5 }, 3.7);

    tl.to(introCanvas, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 3.4);

    // Animate nodes appearing
    tl.to({}, {
        duration: 1.8,
        onUpdate: function () {
            var p = this.progress();
            var count = Math.floor(p * introNodes.length);
            for (var i = 0; i < count; i++) {
                introNodes[i].opacity = Math.min(1, introNodes[i].opacity + 0.1);
            }
            for (var j = 0; j < introLines.length; j++) {
                var lp = Math.max(0, (p - j / introLines.length) * 2);
                introLines[j].progress = Math.min(1, lp);
                introLines[j].opacity = Math.min(1, lp);
            }
        }
    }, 3.5);

    // Ripple
    tl.to(introRipple, { opacity: 0.4, scale: 1, duration: 0.3 }, 4.2);
    tl.to(introRipple, {
        scale: 8,
        opacity: 0,
        duration: 1.5,
        ease: 'power2.out'
    }, 4.3);

    tl.to(introGlow, {
        scale: 1.5,
        opacity: 0.6,
        duration: 1,
        ease: 'power2.out'
    }, 4.5);

    // ── PHASE 3: Earth Formation ──
    tl.to(introMain, { opacity: 0, duration: 0.4 }, 5.8);
    tl.to(introSub, { opacity: 0, duration: 0.3 }, 5.8);

    tl.call(function () {
        introMain.textContent = 'Synchronizing Global Environmental Data…';
        introPhase3Active = true;
    }, [], 6.2);
    tl.to(introMain, { opacity: 1, duration: 0.5 }, 6.3);

    tl.call(function () {
        introSub.textContent = 'Mapping sustainability networks';
    }, [], 6.5);
    tl.to(introSub, { opacity: 0.7, duration: 0.4 }, 6.5);

    // Nodes compress toward center
    tl.to({ val: 0 }, {
        val: 1,
        duration: 2,
        ease: 'power2.inOut',
        onUpdate: function () {
            introLineProgress = this.targets()[0].val;
            for (var i = 0; i < introLines.length; i++) {
                introLines[i].progress = this.targets()[0].val;
            }
        }
    }, 6.2);

    // Grow glow
    tl.to(introGlow, {
        scale: 2.5,
        opacity: 0.4,
        duration: 1.5,
        ease: 'power2.inOut'
    }, 6.5);

    // Dot grows
    tl.to(introDot, {
        scale: 3,
        boxShadow: '0 0 60px #00FFB2, 0 0 140px rgba(0,255,178,0.5)',
        duration: 1.5,
        ease: 'power2.inOut'
    }, 6.5);

    // ── PHASE 4: System Online ──
    tl.to(introMain, { opacity: 0, duration: 0.4 }, 8.4);
    tl.to(introSub, { opacity: 0, duration: 0.3 }, 8.4);
    tl.to(introCanvas, { opacity: 0, duration: 0.8, ease: 'power2.in' }, 8.2);
    tl.to(introDot, { opacity: 0, duration: 0.6 }, 8.4);

    // Final title
    tl.to(introFinal, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 8.8);
    tl.to(introStatus, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 9.2);
    tl.to(enterBtn, {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: 'back.out(1.5)'
    }, 9.6);

    // Glow breathing in final state
    tl.to(introGlow, {
        scale: 2,
        opacity: 0.25,
        duration: 1,
        ease: 'power2.inOut'
    }, 8.8);

    // Enter button pulse
    tl.to(enterBtn, {
        boxShadow: '0 0 36px rgba(0,255,178,0.5)',
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    }, 10.2);

    // ── Transition to dashboard ──
    function transitionToDashboard() {
        introAborted = true;
        if (introAnimId) cancelAnimationFrame(introAnimId);
        tl.kill();

        var exitTl = gsap.timeline({
            onComplete: function () {
                introScreen.style.display = 'none';
            }
        });

        exitTl.to(introScreen, {
            opacity: 0,
            duration: 1.2,
            ease: 'power2.inOut'
        }, 0);

        exitTl.call(function () {
            earthCanvas.classList.add('visible');
        }, [], 0.2);

        exitTl.to(mainContainer, {
            opacity: 1,
            duration: 0.8,
            ease: 'power2.out'
        }, 0.6);

        exitTl.to(heroSection, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power2.out'
        }, 0.9);

        var cards = document.querySelectorAll('.card');
        cards.forEach(function (card, i) {
            exitTl.to(card, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power2.out'
            }, 1.1 + i * 0.12);
        });
    }

    enterBtn.addEventListener('click', transitionToDashboard);
    skipBtn.addEventListener('click', transitionToDashboard);

    var earthCanvas = document.getElementById('earthCanvas');
    var mainContainer = document.getElementById('mainContainer');
    var heroSection = document.getElementById('heroSection');

    /* ═══════════════════════════════════
       3D EARTH + NEURAL (from Step 4)
       ═══════════════════════════════════ */
    var renderer = new THREE.WebGLRenderer({ canvas: earthCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.12);

    var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 4.5;

    var earthGroup = new THREE.Group();
    scene.add(earthGroup);

    var RADIUS = 1.5;
    var NODE_COUNT = 140;

    function createEarthTexture() {
        var size = 512;
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var ctx = c.getContext('2d');

        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, size, size);

        var continents = [
            { x: 260, y: 120, rx: 40, ry: 55 }, { x: 280, y: 200, rx: 25, ry: 30 }, { x: 310, y: 300, rx: 18, ry: 40 },
            { x: 120, y: 140, rx: 60, ry: 40 }, { x: 100, y: 200, rx: 30, ry: 30 }, { x: 80, y: 310, rx: 15, ry: 20 },
            { x: 350, y: 160, rx: 35, ry: 50 }, { x: 380, y: 250, rx: 20, ry: 25 }, { x: 430, y: 340, rx: 30, ry: 35 },
            { x: 450, y: 280, rx: 18, ry: 22 }, { x: 200, y: 250, rx: 12, ry: 18 }, { x: 160, y: 380, rx: 45, ry: 30 }
        ];

        continents.forEach(function (cont) {
            ctx.save();
            ctx.translate(cont.x, cont.y);
            ctx.scale(1, cont.ry / cont.rx);
            ctx.beginPath();
            ctx.arc(0, 0, cont.rx, 0, Math.PI * 2);
            ctx.restore();
            var grad = ctx.createRadialGradient(cont.x, cont.y, 0, cont.x, cont.y, cont.rx * 1.2);
            grad.addColorStop(0, 'rgba(16,185,129,0.25)');
            grad.addColorStop(0.6, 'rgba(0,255,178,0.10)');
            grad.addColorStop(1, 'rgba(0,255,178,0)');
            ctx.fillStyle = grad;
            ctx.fill();
        });

        ctx.strokeStyle = 'rgba(0,255,178,0.12)';
        ctx.lineWidth = 1;
        continents.forEach(function (cont) {
            ctx.beginPath();
            ctx.ellipse(cont.x, cont.y, cont.rx * 0.85, cont.ry * 0.85, 0, 0, Math.PI * 2);
            ctx.stroke();
        });

        for (var i = 0; i < 6; i++) {
            var y = size * (i + 1) / 7;
            ctx.strokeStyle = 'rgba(34,211,238,0.035)';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }
        for (var j = 0; j < 12; j++) {
            var x = size * (j + 1) / 13;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }

        return new THREE.CanvasTexture(c);
    }

    var earthTexture = createEarthTexture();

    var earthGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
    var earthMat = new THREE.MeshBasicMaterial({ map: earthTexture, transparent: true, opacity: 0.9 });
    var earth = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earth);

    var wireGeo = new THREE.SphereGeometry(RADIUS * 1.002, 28, 28);
    var wireMat = new THREE.MeshBasicMaterial({ color: 0x22D3EE, wireframe: true, transparent: true, opacity: 0.04 });
    earthGroup.add(new THREE.Mesh(wireGeo, wireMat));

    var atmosGeo = new THREE.SphereGeometry(RADIUS * 1.12, 48, 48);
    var atmosMat = new THREE.MeshBasicMaterial({ color: 0x00FFB2, transparent: true, opacity: 0.045, side: THREE.BackSide });
    earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    var atmosMat2 = new THREE.MeshBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.02, side: THREE.BackSide });
    earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.25, 48, 48), atmosMat2));

    var nodePositions = [];
    var nodeMeshes = [];
    var nodeGeo = new THREE.SphereGeometry(0.025, 8, 8);

    for (var i = 0; i < NODE_COUNT; i++) {
        var phi = Math.acos(2 * Math.random() - 1);
        var theta = 2 * Math.PI * Math.random();
        var r = RADIUS * 1.02 + Math.random() * 0.04;
        var x = r * Math.sin(phi) * Math.cos(theta);
        var y = r * Math.sin(phi) * Math.sin(theta);
        var z = r * Math.cos(phi);
        var mat = new THREE.MeshBasicMaterial({ color: 0x00FFB2, transparent: true, opacity: 0.7 });
        var node = new THREE.Mesh(nodeGeo, mat);
        node.position.set(x, y, z);
        node.userData.phase = Math.random() * Math.PI * 2;
        node.userData.baseOp = 0.4 + Math.random() * 0.5;
        earthGroup.add(node);
        nodePositions.push(new THREE.Vector3(x, y, z));
        nodeMeshes.push(node);
    }

    var lineMat = new THREE.LineBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.2 });
    var earthLines = [];
    var maxDist = RADIUS * 0.8;
    var targetLines = Math.floor(NODE_COUNT * 1.2);
    var added = 0;

    for (var attempts = 0; attempts < targetLines * 6 && added < targetLines; attempts++) {
        var a = Math.floor(Math.random() * NODE_COUNT);
        var b = Math.floor(Math.random() * NODE_COUNT);
        if (a === b) continue;
        var dist = nodePositions[a].distanceTo(nodePositions[b]);
        if (dist < maxDist) {
            var midPoint = new THREE.Vector3().addVectors(nodePositions[a], nodePositions[b]).multiplyScalar(0.5);
            midPoint.multiplyScalar((RADIUS * 1.04) / midPoint.length());
            var curve = new THREE.QuadraticBezierCurve3(nodePositions[a], midPoint, nodePositions[b]);
            var lMat = lineMat.clone();
            lMat.opacity = 0.08 + Math.random() * 0.14;
            var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)), lMat);
            line.userData.phase = Math.random() * Math.PI * 2;
            line.userData.baseOp = lMat.opacity;
            earthGroup.add(line);
            earthLines.push(line);
            added++;
        }
    }

    var dustCount = 80;
    var dustGeo = new THREE.BufferGeometry();
    var dustPos = new Float32Array(dustCount * 3);
    for (var d = 0; d < dustCount; d++) {
        dustPos[d * 3] = (Math.random() - 0.5) * 8;
        dustPos[d * 3 + 1] = (Math.random() - 0.5) * 8;
        dustPos[d * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustParticles = new THREE.Points(dustGeo, new THREE.PointsMaterial({
        color: 0x00FFB2, size: 0.015, transparent: true, opacity: 0.3, sizeAttenuation: true
    }));
    scene.add(dustParticles);

    var mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    var glowIntensity = 1.0;
    var energySlider = document.getElementById('energySlider');
    var renewSlider = document.getElementById('renewSlider');
    var energyVal = document.getElementById('energyVal');
    var renewVal = document.getElementById('renewVal');
    var simCarbon = document.getElementById('simCarbon');
    var simScore = document.getElementById('simScore');

    // Stores real backend data; sliders use these as base values
    var lastBackendData = null;
    var baseCarbon = 78;   // default until backend responds
    var baseScore = 82;    // default until backend responds

    function updateSim() {
        var e = parseInt(energySlider.value);
        var r = parseInt(renewSlider.value);
        energyVal.textContent = e;
        renewVal.textContent = r;
        simCarbon.textContent = Math.max(0, Math.round(baseCarbon - (baseCarbon * e / 100) - (baseCarbon * r / 200))) + ' kg';
        simScore.textContent = Math.min(100, Math.round(baseScore + (e * 0.2) + (r * 0.15)));
        glowIntensity = 1.0 + (e + r) * 0.004;
    }
    energySlider.addEventListener('input', updateSim);
    renewSlider.addEventListener('input', updateSim);
    updateSim();

    /* ═══════════════════════════════════
       BACKEND API INTEGRATION
       ═══════════════════════════════════ */

    function updateEarthGlow(carbon) {
        if (carbon > 20000) {
            glowIntensity = 2;
        } else if (carbon > 10000) {
            glowIntensity = 1.5;
        } else {
            glowIntensity = 1;
        }
    }

    function updateDashboard(data) {
        lastBackendData = data;

        // Carbon card
        var carbonEl = document.getElementById('carbonValue');
        carbonEl.innerHTML = data.total_carbon.toFixed(2) + '<span class="unit">kg CO\u2082</span>';
        var trendEl = document.getElementById('carbonTrend');
        trendEl.textContent = 'Total energy: ' + data.total_energy.toFixed(0) + ' kWh';
        trendEl.className = 'trend';

        // Energy forecast card
        var forecastEl = document.getElementById('energyForecastValue');
        forecastEl.textContent = 'Predicted next month: ' + data.prediction_next_month.toFixed(2) + ' kWh (accuracy ' + (data.model_accuracy * 100).toFixed(0) + '%)';

        // Sustainability score
        var score = 100 - (data.total_carbon / 200);
        if (score < 0) score = 0;
        if (score > 100) score = 100;
        document.getElementById('sustainabilityScore').textContent = Math.round(score);
        var labelEl = document.getElementById('scoreLabel');
        if (score >= 70) {
            labelEl.textContent = 'Efficient Energy Usage';
        } else if (score >= 40) {
            labelEl.textContent = 'Moderate — Room for Improvement';
        } else {
            labelEl.textContent = 'High Emissions — Action Needed';
        }

        // Update simulation base values
        baseCarbon = data.total_carbon;
        baseScore = Math.round(score);
        energySlider.value = 20;
        renewSlider.value = 30;
        updateSim();

        // Earth glow
        updateEarthGlow(data.total_carbon);

        // AI Copilot insight
        aiSendMessage(
            'Energy analysis complete. Predicted next month usage is ' +
            data.prediction_next_month.toFixed(0) +
            ' kWh with model accuracy of ' +
            (data.model_accuracy * 100).toFixed(0) + '%.'
        );
    }

    // File upload handler
    var energyFileInput = document.getElementById('energyFile');
    var loadingEl = document.getElementById('loading');
    var uploadStatus = document.getElementById('uploadStatus');

    energyFileInput.addEventListener('change', async function () {
        var file = this.files[0];
        if (!file) return;

        var token = localStorage.getItem('access_token');
        if (!token) {
            document.getElementById('authOverlay').style.display = 'flex';
            uploadStatus.textContent = 'Please sign in to upload data.';
            uploadStatus.className = 'upload-hint error';
            this.value = '';
            return;
        }

        var formData = new FormData();
        formData.append('file', file);

        loadingEl.style.display = 'flex';
        uploadStatus.textContent = 'Uploading ' + file.name + '…';
        uploadStatus.className = 'upload-hint';

        try {
            var response = await fetch(API_BASE_URL + '/analyze-energy', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_email');
                updateAuthUI();
                document.getElementById('authOverlay').style.display = 'flex';
                throw new Error('Session expired. Please sign in again.');
            }

            if (!response.ok) {
                var errBody = await response.json().catch(function () { return {}; });
                throw new Error(errBody.detail || 'Backend error (status ' + response.status + ')');
            }

            var data = await response.json();
            updateDashboard(data);

            uploadStatus.textContent = '✓ Analysis complete — ' + file.name;
            uploadStatus.className = 'upload-hint success';

        } catch (error) {
            console.error('Backend error:', error);
            uploadStatus.textContent = '✗ ' + error.message;
            uploadStatus.className = 'upload-hint error';
            aiSendMessage('⚠ ' + error.message);
        }

        loadingEl.style.display = 'none';
        this.value = '';
    });

    /* ═══════════════════════════════════
       AI CLIMATE COPILOT LOGIC
       ═══════════════════════════════════ */
    var aiCopilot = document.getElementById('aiCopilot');
    var aiMessages = document.getElementById('aiMessages');
    var aiStatusEl = document.getElementById('aiStatus');
    var aiDebounceTimer = null;
    var aiIsTyping = false;
    var aiMessageQueue = [];
    var prevScore = null;
    var prevCarbon = null;
    var aiMaxMessages = 12;

    function aiSendMessage(text) {
        if (aiIsTyping) {
            aiMessageQueue.push(text);
            return;
        }
        aiIsTyping = true;
        aiStatusEl.textContent = 'Analyzing…';

        // Show typing indicator
        var typingEl = document.createElement('div');
        typingEl.className = 'ai-message ai-message--typing';
        typingEl.innerHTML = '<div class="ai-typing-dots"><span></span><span></span><span></span></div> AI is analyzing…';
        aiMessages.appendChild(typingEl);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        setTimeout(function () {
            // Remove typing indicator
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

            // Create message bubble
            var msgEl = document.createElement('div');
            msgEl.className = 'ai-message';
            var cursorSpan = document.createElement('span');
            cursorSpan.className = 'ai-cursor';
            msgEl.appendChild(cursorSpan);
            aiMessages.appendChild(msgEl);
            aiMessages.scrollTop = aiMessages.scrollHeight;

            // Typewriter effect
            var charIdx = 0;
            var speed = 22 + Math.random() * 12;
            var typeInterval = setInterval(function () {
                if (charIdx < text.length) {
                    msgEl.insertBefore(document.createTextNode(text[charIdx]), cursorSpan);
                    charIdx++;
                    aiMessages.scrollTop = aiMessages.scrollHeight;
                } else {
                    clearInterval(typeInterval);
                    if (cursorSpan.parentNode) cursorSpan.parentNode.removeChild(cursorSpan);
                    aiStatusEl.textContent = 'Online';
                    aiIsTyping = false;

                    // Trim old messages
                    while (aiMessages.children.length > aiMaxMessages) {
                        aiMessages.removeChild(aiMessages.firstChild);
                    }

                    // Process queue
                    if (aiMessageQueue.length > 0) {
                        var next = aiMessageQueue.shift();
                        setTimeout(function () { aiSendMessage(next); }, 300);
                    }
                }
            }, speed);
        }, 800);
    }

    function aiAnalyzeSliders() {
        var e = parseInt(energySlider.value);
        var r = parseInt(renewSlider.value);
        var score = parseInt(simScore.textContent);
        var carbonText = simCarbon.textContent;
        var carbonVal = parseInt(carbonText);

        var messages = [];

        // Energy reduction analysis
        if (e < 10) {
            messages.push('Energy optimization minimal. Consider reducing peak loads for better carbon offset.');
        } else if (e <= 25) {
            messages.push('Moderate energy improvement detected. Carbon emissions decreasing steadily.');
        } else if (e <= 45) {
            messages.push('Strong sustainability optimization. Significant carbon reduction achieved.');
        } else {
            messages.push('Maximum energy efficiency engaged. System approaching optimal environmental performance.');
        }

        // Renewable offset analysis
        if (r > 50) {
            messages.push('Renewable integration at high capacity — sustainability index improving rapidly.');
        } else if (r > 25) {
            messages.push('Renewable offset contributing to emissions reduction. Consider increasing to 50%+.');
        }

        // Score-based reactions
        if (prevScore !== null && score > prevScore) {
            messages.push('Sustainability performance improving steadily. Current score: ' + score + '/100.');
        }

        // Carbon trend
        if (prevCarbon !== null && carbonVal > prevCarbon) {
            messages.push('⚠ Carbon trend increasing. Review energy usage patterns to reverse trajectory.');
        }

        prevScore = score;
        prevCarbon = carbonVal;

        // Send the most relevant message (avoid spam)
        if (messages.length > 0) {
            aiSendMessage(messages[0]);
            if (messages.length > 1) {
                aiMessageQueue.push(messages[1]);
            }
        }
    }

    // Debounced slider listener for AI
    function aiDebouncedAnalyze() {
        clearTimeout(aiDebounceTimer);
        aiDebounceTimer = setTimeout(aiAnalyzeSliders, 500);
    }

    energySlider.addEventListener('input', aiDebouncedAnalyze);
    renewSlider.addEventListener('input', aiDebouncedAnalyze);

    // Show copilot after dashboard transition
    var aiShowObserver = new MutationObserver(function () {
        if (introScreen.style.display === 'none' || introScreen.classList.contains('hidden')) {
            setTimeout(function () {
                aiCopilot.classList.add('visible');
                aiStatusEl.textContent = 'Online';
                // Initial greeting
                setTimeout(function () {
                    aiSendMessage('Climate Intelligence Engine active. Upload an energy CSV to begin real-time analysis.');
                    setTimeout(function () {
                        aiSendMessage('Use the upload button above to connect your energy data to the AI prediction engine.');
                    }, 3200);
                }, 600);
            }, 1800);
            aiShowObserver.disconnect();
        }
    });
    aiShowObserver.observe(introScreen, { attributes: true, attributeFilter: ['style', 'class'] });

    var clock = new THREE.Clock();
    var baseRotY = 0;

    function animate() {
        requestAnimationFrame(animate);
        var t = clock.getElapsedTime();

        baseRotY += 0.0015;
        earthGroup.rotation.y = baseRotY + mouseX * 0.12;
        earthGroup.rotation.x = Math.sin(t * 0.15) * 0.05 + mouseY * 0.08;

        var breathe = 0.5 + 0.5 * Math.sin(t * 0.6);
        atmosMat.opacity = (0.03 + breathe * 0.04) * glowIntensity;
        atmosMat2.opacity = (0.015 + breathe * 0.015) * glowIntensity;

        for (var i = 0; i < nodeMeshes.length; i++) {
            var n = nodeMeshes[i];
            var pulse = 0.5 + 0.5 * Math.sin(t * 1.0 + n.userData.phase);
            n.material.opacity = n.userData.baseOp * (0.5 + pulse * 0.5) * glowIntensity;
        }

        for (var j = 0; j < earthLines.length; j++) {
            var l = earthLines[j];
            var lp = 0.5 + 0.5 * Math.sin(t * 0.5 + l.userData.phase);
            l.material.opacity = l.userData.baseOp * (0.4 + lp * 0.6) * glowIntensity;
        }

        var dP = dustParticles.geometry.attributes.position.array;
        for (var k = 0; k < dustCount; k++) {
            dP[k * 3 + 1] += Math.sin(t * 0.3 + k) * 0.0004;
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;
        dustParticles.rotation.y = t * 0.02;

        renderer.render(scene, camera);
    }
    animate();

    /* ═══════════════════════════════════
       AUTH MODAL LOGIC
       ═══════════════════════════════════ */
    var authOverlay = document.getElementById('authOverlay');
    var authForm = document.getElementById('authForm');
    var authError = document.getElementById('authError');
    var authSubmitBtn = document.getElementById('authSubmit');
    var heroAuthBtn = document.getElementById('heroAuthBtn');

    // Hero button: show auth modal if not logged in
    if (heroAuthBtn) {
        heroAuthBtn.addEventListener('click', function () {
            var token = localStorage.getItem('access_token');
            if (!token) {
                authOverlay.style.display = 'flex';
            }
        });
    }

    // Auth form submit
    authForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('authEmail').value.trim();
        var password = document.getElementById('authPassword').value;
        authError.textContent = '';
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = authIsLoginMode ? 'Signing in…' : 'Registering…';

        var endpoint = authIsLoginMode ? '/login' : '/register';

        try {
            var response = await fetch(API_BASE_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });

            var data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Request failed');
            }

            if (authIsLoginMode) {
                // Login success — store token
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('user_email', email);
                authOverlay.style.display = 'none';
                updateAuthUI();
                aiSendMessage('Welcome back, ' + email.split('@')[0] + '! Upload an energy CSV to begin analysis.');
            } else {
                // Registration success — switch to login
                authError.style.color = '#00ffb2';
                authError.textContent = '✓ Account created! Please sign in.';
                authIsLoginMode = true;
                toggleAuthMode();
                authError.style.color = '#00ffb2';
                authError.textContent = '✓ Account created! Please sign in.';
            }

        } catch (error) {
            authError.style.color = '#f87171';
            authError.textContent = error.message;
        }

        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authIsLoginMode ? 'Sign In' : 'Register';
    });

    // Check auth status on load
    updateAuthUI();
    if (localStorage.getItem('access_token')) {
        aiSendMessage('Session restored. Ready for analysis.');
    }

})();
