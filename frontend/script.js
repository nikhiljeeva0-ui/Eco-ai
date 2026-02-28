/* ═══════════════════════════════════
   API CONFIGURATION
   ═══════════════════════════════════ */
var API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://ecosphere-neural-api.onrender.com';

/* ═══════════════════════════════════
   FEATURE FLAGS (Pilot Mode)
   ═══════════════════════════════════ */
var FEATURES = {
    pdfReports: true,
    aiCopilot: true,
    analytics: true,
    profilePage: true,
    historyPage: true
};

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

function showAuth(mode) {
    if (mode === 'register') {
        authIsLoginMode = false;
        toggleAuthMode();
        authIsLoginMode = false;
    } else {
        authIsLoginMode = true;
        toggleAuthMode();
        authIsLoginMode = true;
    }
    document.getElementById('authOverlay').style.display = 'flex';
}

function logoutUser() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    updateAppState();
}

function getToken() {
    return localStorage.getItem('access_token');
}

function authFetch(url, options) {
    options = options || {};
    var token = getToken();
    if (!token) {
        logoutUser();
        return Promise.reject(new Error('No token'));
    }
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, options).then(function (res) {
        if (res.status === 401) {
            logoutUser();
            throw new Error('Session expired. Please sign in again.');
        }
        return res;
    });
}

/* ═══════════════════════════════════
   SPA ROUTING & STATE
   ═══════════════════════════════════ */
var currentPage = 'dashboard';
var lastAnalysisId = null;
var previousAnalysisData = null;
var historyData = [];
var historySortField = 'timestamp';
var historySortAsc = false;

function updateAppState() {
    var token = getToken();
    var email = localStorage.getItem('user_email');
    var landingPage = document.getElementById('landingPage');
    var mainContainer = document.getElementById('mainContainer');
    var introScreen = document.getElementById('introScreen');

    if (token && email) {
        // Logged in — show app, hide landing
        landingPage.style.display = 'none';
        mainContainer.style.display = 'flex';
        mainContainer.style.opacity = '1';
        document.getElementById('navUserEmail').textContent = email;
        navigateTo(currentPage);
    } else {
        // Not logged in — show landing, hide app
        if (introScreen.style.display !== 'none') return; // intro still running
        landingPage.style.display = 'block';
        mainContainer.style.display = 'none';
    }
}

function navigateTo(page) {
    currentPage = page;
    var pages = document.querySelectorAll('.page');
    pages.forEach(function (p) { p.style.display = 'none'; });

    var links = document.querySelectorAll('.nav-link[data-page]');
    links.forEach(function (l) { l.classList.remove('active'); });

    var target = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (target) {
        target.style.display = 'block';
        target.style.animation = 'none';
        target.offsetHeight;
        target.style.animation = 'fadeIn .4s ease';
    }

    var activeLink = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');

    // Close mobile menu
    var navLinks = document.getElementById('navLinks');
    if (navLinks) navLinks.classList.remove('open');

    // Load page data
    if (page === 'history') loadHistory();
    if (page === 'profile') loadProfile();
}

function toggleMobileMenu() {
    var navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('open');
}

/* ═══════════════════════════════════
   REPORT DOWNLOAD
   ═══════════════════════════════════ */
function downloadReport(analysisId) {
    var id = analysisId || lastAnalysisId;
    if (!id) return;
    authFetch(API_BASE_URL + '/generate-report/' + id)
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to generate report');
            return response.blob();
        })
        .then(function (blob) {
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'EcoSphere_Report_' + id + '.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(function (err) { console.error('Report error:', err); });
}

/* ═══════════════════════════════════
   HISTORY PAGE
   ═══════════════════════════════════ */
function loadHistory() {
    var loading = document.getElementById('historyLoading');
    var tableWrap = document.getElementById('historyTableWrap');
    var empty = document.getElementById('historyEmpty');
    loading.style.display = 'flex';
    empty.style.display = 'none';

    authFetch(API_BASE_URL + '/analysis-history')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            historyData = data;
            renderHistory();
            loading.style.display = 'none';
        })
        .catch(function (err) {
            loading.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = 'Error loading history: ' + err.message;
        });
}

function sortHistory(field) {
    if (historySortField === field) {
        historySortAsc = !historySortAsc;
    } else {
        historySortField = field;
        historySortAsc = true;
    }
    renderHistory();
}

function renderHistory() {
    var body = document.getElementById('historyBody');
    var empty = document.getElementById('historyEmpty');
    body.innerHTML = '';

    if (!historyData || historyData.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    var sorted = historyData.slice().sort(function (a, b) {
        var va = a[historySortField], vb = b[historySortField];
        if (historySortField === 'timestamp') { va = new Date(va); vb = new Date(vb); }
        if (va < vb) return historySortAsc ? -1 : 1;
        if (va > vb) return historySortAsc ? 1 : -1;
        return 0;
    });

    sorted.forEach(function (item) {
        var tr = document.createElement('tr');
        tr.onclick = function () { showDetail(item); };
        var date = new Date(item.timestamp);
        var dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        tr.innerHTML =
            '<td>' + dateStr + '</td>' +
            '<td>' + item.total_energy.toFixed(1) + '</td>' +
            '<td>' + item.total_carbon.toFixed(1) + '</td>' +
            '<td>' + item.prediction_next_month.toFixed(1) + '</td>' +
            '<td>' + (item.model_accuracy * 100).toFixed(1) + '%</td>' +
            '<td><button class="history-dl-btn" onclick="event.stopPropagation(); downloadReport(' + item.id + ')">📄 PDF</button></td>';
        body.appendChild(tr);
    });
}

function showDetail(item) {
    var overlay = document.getElementById('detailOverlay');
    var content = document.getElementById('detailContent');
    var date = new Date(item.timestamp);
    var score = Math.max(0, Math.min(100, Math.round(100 - (item.total_carbon / 200))));
    var level = item.total_carbon < 5000 ? 'Low' : item.total_carbon < 15000 ? 'Moderate' : 'High';

    content.innerHTML =
        '<div class="detail-row"><span class="detail-row__label">Date</span><span class="detail-row__value">' + date.toLocaleString() + '</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Total Energy</span><span class="detail-row__value">' + item.total_energy.toFixed(2) + ' kWh</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Carbon Emission</span><span class="detail-row__value">' + item.total_carbon.toFixed(2) + ' kg CO₂</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Prediction</span><span class="detail-row__value">' + item.prediction_next_month.toFixed(2) + ' kWh</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Model Accuracy</span><span class="detail-row__value">' + (item.model_accuracy * 100).toFixed(1) + '%</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Sustainability Score</span><span class="detail-row__value">' + score + ' / 100</span></div>' +
        '<div class="detail-row"><span class="detail-row__label">Emission Level</span><span class="detail-row__value">' + level + '</span></div>' +
        '<div style="margin-top:20px;text-align:center"><button class="btn btn--primary" onclick="downloadReport(' + item.id + ')">📄 Download Report</button></div>';
    overlay.style.display = 'flex';
}

function closeDetail(e) {
    if (e.target === document.getElementById('detailOverlay')) {
        document.getElementById('detailOverlay').style.display = 'none';
    }
}

/* ═══════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════ */
function loadProfile() {
    authFetch(API_BASE_URL + '/profile')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            document.getElementById('profileEmail').textContent = data.email;
            var d = new Date(data.created_at);
            document.getElementById('profileCreated').textContent = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            document.getElementById('profileAnalyses').textContent = data.analysis_count;
        })
        .catch(function () { });
}

/* ═══════════════════════════════════
   MAIN APP IIFE
   ═══════════════════════════════════ */
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

    var introNodes = [];
    var introLines = [];
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
            introNodes.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: 1.5 + Math.random() * 2, phase: Math.random() * Math.PI * 2, opacity: 0 });
        }
        for (var j = 0; j < introNodes.length; j++) {
            var nearest = -1, nearDist = Infinity;
            for (var k = 0; k < introNodes.length; k++) {
                if (k === j) continue;
                var d = Math.hypot(introNodes[j].x - introNodes[k].x, introNodes[j].y - introNodes[k].y);
                if (d < nearDist && d < 160) { nearDist = d; nearest = k; }
            }
            if (nearest >= 0) introLines.push({ a: j, b: nearest, progress: 0, opacity: 0 });
        }
    }
    initIntroNodes();

    function drawIntroNeural(t) {
        introCtx.clearRect(0, 0, introCanvas.width, introCanvas.height);
        for (var i = 0; i < introLines.length; i++) {
            var line = introLines[i];
            if (line.opacity <= 0) continue;
            var a = introNodes[line.a], b = introNodes[line.b];
            introCtx.beginPath();
            if (introPhase3Active) {
                introCtx.moveTo(a.x + (cx - a.x) * line.progress, a.y + (cy - a.y) * line.progress);
                introCtx.lineTo(b.x + (cx - b.x) * line.progress, b.y + (cy - b.y) * line.progress);
            } else {
                introCtx.moveTo(a.x, a.y);
                introCtx.lineTo(a.x + (b.x - a.x) * line.progress, a.y + (b.y - a.y) * line.progress);
            }
            introCtx.strokeStyle = 'rgba(34, 211, 238, ' + (line.opacity * 0.35) + ')';
            introCtx.lineWidth = 1;
            introCtx.stroke();
        }
        for (var j = 0; j < introNodes.length; j++) {
            var n = introNodes[j];
            if (n.opacity <= 0) continue;
            var pulse = 0.6 + 0.4 * Math.sin(t * 2 + n.phase);
            var nx = introPhase3Active ? n.x + (cx - n.x) * introLineProgress : n.x;
            var ny = introPhase3Active ? n.y + (cy - n.y) * introLineProgress : n.y;
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
        if (introPhase2Active || introPhase3Active) drawIntroNeural(t);
        introAnimId = requestAnimationFrame(introAnimLoop);
    }
    introAnimLoop();

    var tl = gsap.timeline({});
    tl.to(skipBtn, { opacity: 1, duration: 0.5 }, 0.3);
    tl.to(introDot, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.3);
    tl.to(introGlow, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0.5);
    tl.call(function () { introMain.textContent = 'Initializing Climate Intelligence…'; introMain.classList.add('glitch'); }, [], 0.8);
    tl.to(introMain, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.8);
    tl.to(introSub, { opacity: 0, duration: 0 }, 0.8);
    tl.call(function () { introSub.textContent = 'Loading core neural subsystems'; }, [], 1.2);
    tl.to(introSub, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.2);
    tl.to(introDot, { boxShadow: '0 0 40px #00FFB2, 0 0 100px rgba(0,255,178,0.4)', scale: 1.3, duration: 0.8, repeat: 2, yoyo: true, ease: 'sine.inOut' }, 1);
    tl.to(introMain, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 3);
    tl.to(introSub, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3);
    tl.call(function () { introMain.textContent = 'Activating Neural Sustainability Engine…'; introMain.classList.remove('glitch'); introPhase2Active = true; }, [], 3.4);
    tl.to(introMain, { opacity: 1, duration: 0.6 }, 3.5);
    tl.call(function () { introSub.textContent = 'Establishing neural pathways'; }, [], 3.7);
    tl.to(introSub, { opacity: 0.7, duration: 0.5 }, 3.7);
    tl.to(introCanvas, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 3.4);
    tl.to({}, { duration: 1.8, onUpdate: function () { var p = this.progress(); var count = Math.floor(p * introNodes.length); for (var i = 0; i < count; i++) introNodes[i].opacity = Math.min(1, introNodes[i].opacity + 0.1); for (var j = 0; j < introLines.length; j++) { var lp = Math.max(0, (p - j / introLines.length) * 2); introLines[j].progress = Math.min(1, lp); introLines[j].opacity = Math.min(1, lp); } } }, 3.5);
    tl.to(introRipple, { opacity: 0.4, scale: 1, duration: 0.3 }, 4.2);
    tl.to(introRipple, { scale: 8, opacity: 0, duration: 1.5, ease: 'power2.out' }, 4.3);
    tl.to(introGlow, { scale: 1.5, opacity: 0.6, duration: 1, ease: 'power2.out' }, 4.5);
    tl.to(introMain, { opacity: 0, duration: 0.4 }, 5.8);
    tl.to(introSub, { opacity: 0, duration: 0.3 }, 5.8);
    tl.call(function () { introMain.textContent = 'Synchronizing Global Environmental Data…'; introPhase3Active = true; }, [], 6.2);
    tl.to(introMain, { opacity: 1, duration: 0.5 }, 6.3);
    tl.call(function () { introSub.textContent = 'Mapping sustainability networks'; }, [], 6.5);
    tl.to(introSub, { opacity: 0.7, duration: 0.4 }, 6.5);
    tl.to({ val: 0 }, { val: 1, duration: 2, ease: 'power2.inOut', onUpdate: function () { introLineProgress = this.targets()[0].val; for (var i = 0; i < introLines.length; i++) introLines[i].progress = this.targets()[0].val; } }, 6.2);
    tl.to(introGlow, { scale: 2.5, opacity: 0.4, duration: 1.5, ease: 'power2.inOut' }, 6.5);
    tl.to(introDot, { scale: 3, boxShadow: '0 0 60px #00FFB2, 0 0 140px rgba(0,255,178,0.5)', duration: 1.5, ease: 'power2.inOut' }, 6.5);
    tl.to(introMain, { opacity: 0, duration: 0.4 }, 8.4);
    tl.to(introSub, { opacity: 0, duration: 0.3 }, 8.4);
    tl.to(introCanvas, { opacity: 0, duration: 0.8, ease: 'power2.in' }, 8.2);
    tl.to(introDot, { opacity: 0, duration: 0.6 }, 8.4);
    tl.to(introFinal, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 8.8);
    tl.to(introStatus, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 9.2);
    tl.to(enterBtn, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, 9.6);
    tl.to(introGlow, { scale: 2, opacity: 0.25, duration: 1, ease: 'power2.inOut' }, 8.8);
    tl.to(enterBtn, { boxShadow: '0 0 36px rgba(0,255,178,0.5)', duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 10.2);

    var earthCanvas = document.getElementById('earthCanvas');
    var mainContainer = document.getElementById('mainContainer');
    var heroSection = document.getElementById('heroSection');

    function transitionToDashboard() {
        introAborted = true;
        if (introAnimId) cancelAnimationFrame(introAnimId);
        tl.kill();
        var exitTl = gsap.timeline({ onComplete: function () { introScreen.style.display = 'none'; updateAppState(); } });
        exitTl.to(introScreen, { opacity: 0, duration: 1.2, ease: 'power2.inOut' }, 0);
        exitTl.call(function () { earthCanvas.classList.add('visible'); }, [], 0.2);
        exitTl.call(function () { mainContainer.style.display = 'flex'; }, [], 0.5);
        exitTl.to(mainContainer, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.6);
        exitTl.to(heroSection, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.9);
        var cards = document.querySelectorAll('.card');
        cards.forEach(function (card, i) { exitTl.to(card, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 1.1 + i * 0.12); });
    }

    enterBtn.addEventListener('click', transitionToDashboard);
    skipBtn.addEventListener('click', transitionToDashboard);

    /* ═══════════════════════════════════
       3D EARTH
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
    var RADIUS = 1.5, NODE_COUNT = 140;

    function createEarthTexture() {
        var size = 512, c = document.createElement('canvas');
        c.width = size; c.height = size;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, size, size);
        var continents = [
            { x: 260, y: 120, rx: 40, ry: 55 }, { x: 280, y: 200, rx: 25, ry: 30 }, { x: 310, y: 300, rx: 18, ry: 40 },
            { x: 120, y: 140, rx: 60, ry: 40 }, { x: 100, y: 200, rx: 30, ry: 30 }, { x: 80, y: 310, rx: 15, ry: 20 },
            { x: 350, y: 160, rx: 35, ry: 50 }, { x: 380, y: 250, rx: 20, ry: 25 }, { x: 430, y: 340, rx: 30, ry: 35 },
            { x: 450, y: 280, rx: 18, ry: 22 }, { x: 200, y: 250, rx: 12, ry: 18 }, { x: 160, y: 380, rx: 45, ry: 30 }
        ];
        continents.forEach(function (cont) {
            ctx.save(); ctx.translate(cont.x, cont.y); ctx.scale(1, cont.ry / cont.rx);
            ctx.beginPath(); ctx.arc(0, 0, cont.rx, 0, Math.PI * 2); ctx.restore();
            var grad = ctx.createRadialGradient(cont.x, cont.y, 0, cont.x, cont.y, cont.rx * 1.2);
            grad.addColorStop(0, 'rgba(16,185,129,0.25)'); grad.addColorStop(0.6, 'rgba(0,255,178,0.10)'); grad.addColorStop(1, 'rgba(0,255,178,0)');
            ctx.fillStyle = grad; ctx.fill();
        });
        ctx.strokeStyle = 'rgba(0,255,178,0.12)'; ctx.lineWidth = 1;
        continents.forEach(function (cont) { ctx.beginPath(); ctx.ellipse(cont.x, cont.y, cont.rx * 0.85, cont.ry * 0.85, 0, 0, Math.PI * 2); ctx.stroke(); });
        for (var i = 0; i < 6; i++) { var y = size * (i + 1) / 7; ctx.strokeStyle = 'rgba(34,211,238,0.035)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
        for (var j = 0; j < 12; j++) { var x = size * (j + 1) / 13; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
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

    var nodePositions = [], nodeMeshes = [];
    var nodeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    for (var ni = 0; ni < NODE_COUNT; ni++) {
        var phi = Math.acos(2 * Math.random() - 1), theta = 2 * Math.PI * Math.random();
        var r = RADIUS * 1.02 + Math.random() * 0.04;
        var nx = r * Math.sin(phi) * Math.cos(theta), ny = r * Math.sin(phi) * Math.sin(theta), nz = r * Math.cos(phi);
        var nmat = new THREE.MeshBasicMaterial({ color: 0x00FFB2, transparent: true, opacity: 0.7 });
        var node = new THREE.Mesh(nodeGeo, nmat);
        node.position.set(nx, ny, nz);
        node.userData.phase = Math.random() * Math.PI * 2;
        node.userData.baseOp = 0.4 + Math.random() * 0.5;
        earthGroup.add(node); nodePositions.push(new THREE.Vector3(nx, ny, nz)); nodeMeshes.push(node);
    }

    var lineMat = new THREE.LineBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.2 });
    var earthLines = [], maxDist = RADIUS * 0.8, targetLines = Math.floor(NODE_COUNT * 1.2), added = 0;
    for (var att = 0; att < targetLines * 6 && added < targetLines; att++) {
        var la = Math.floor(Math.random() * NODE_COUNT), lb = Math.floor(Math.random() * NODE_COUNT);
        if (la === lb) continue;
        var ldist = nodePositions[la].distanceTo(nodePositions[lb]);
        if (ldist < maxDist) {
            var midPoint = new THREE.Vector3().addVectors(nodePositions[la], nodePositions[lb]).multiplyScalar(0.5);
            midPoint.multiplyScalar((RADIUS * 1.04) / midPoint.length());
            var curve = new THREE.QuadraticBezierCurve3(nodePositions[la], midPoint, nodePositions[lb]);
            var lm = lineMat.clone(); lm.opacity = 0.08 + Math.random() * 0.14;
            var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)), lm);
            line.userData.phase = Math.random() * Math.PI * 2; line.userData.baseOp = lm.opacity;
            earthGroup.add(line); earthLines.push(line); added++;
        }
    }

    var dustCount = 80, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(dustCount * 3);
    for (var di = 0; di < dustCount; di++) { dustPos[di * 3] = (Math.random() - 0.5) * 8; dustPos[di * 3 + 1] = (Math.random() - 0.5) * 8; dustPos[di * 3 + 2] = (Math.random() - 0.5) * 6 - 1; }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustParticles = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x00FFB2, size: 0.015, transparent: true, opacity: 0.3, sizeAttenuation: true }));
    scene.add(dustParticles);

    var mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', function (e) { mouseX = (e.clientX / window.innerWidth - 0.5) * 2; mouseY = (e.clientY / window.innerHeight - 0.5) * 2; });
    window.addEventListener('resize', function () { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

    var glowIntensity = 1.0;
    var energySlider = document.getElementById('energySlider');
    var renewSlider = document.getElementById('renewSlider');
    var energyVal = document.getElementById('energyVal');
    var renewVal = document.getElementById('renewVal');
    var simCarbon = document.getElementById('simCarbon');
    var simScore = document.getElementById('simScore');
    var lastBackendData = null;
    var baseCarbon = 78, baseScore = 82;

    function updateSim() {
        var e = parseInt(energySlider.value), r = parseInt(renewSlider.value);
        energyVal.textContent = e; renewVal.textContent = r;
        simCarbon.textContent = Math.max(0, Math.round(baseCarbon - (baseCarbon * e / 100) - (baseCarbon * r / 200))) + ' kg';
        simScore.textContent = Math.min(100, Math.round(baseScore + (e * 0.2) + (r * 0.15)));
        glowIntensity = 1.0 + (e + r) * 0.004;
    }
    energySlider.addEventListener('input', updateSim);
    renewSlider.addEventListener('input', updateSim);
    updateSim();

    /* ═══════════════════════════════════
       SUSTAINABILITY SCORE COLORS
       ═══════════════════════════════════ */
    function updateScoreColor(score) {
        var el = document.getElementById('sustainabilityScore');
        var ind = document.getElementById('scoreIndicator');
        el.className = 'score-value';
        ind.className = 'score-indicator';
        if (score >= 70) { el.classList.add('score-green'); ind.classList.add('ind-green'); }
        else if (score >= 40) { el.classList.add('score-yellow'); ind.classList.add('ind-yellow'); }
        else { el.classList.add('score-red'); ind.classList.add('ind-red'); }
    }
    updateScoreColor(82);

    /* ═══════════════════════════════════
       ANALYTICS CHARTS
       ═══════════════════════════════════ */
    var energyTrendChartInstance = null;
    var carbonBarChartInstance = null;
    var predictionChartInstance = null;

    function updateCharts(histData) {
        if (!FEATURES.analytics || !histData || histData.length === 0) return;
        document.getElementById('analyticsSection').style.display = 'block';

        var sortedData = histData.slice().sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        var labels = sortedData.map(function (d) { var dt = new Date(d.timestamp); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });
        var energies = sortedData.map(function (d) { return d.total_energy; });
        var carbons = sortedData.map(function (d) { return d.total_carbon; });
        var predictions = sortedData.map(function (d) { return d.prediction_next_month; });

        var chartColors = { accent: '#00FFB2', cyan: '#22D3EE', grid: 'rgba(255,255,255,0.06)', text: '#94A3B8' };
        var chartDefaults = { responsive: true, plugins: { legend: { labels: { color: chartColors.text, font: { family: 'Inter', size: 11 } } } }, scales: { x: { ticks: { color: chartColors.text, font: { size: 10 } }, grid: { color: chartColors.grid } }, y: { ticks: { color: chartColors.text, font: { size: 10 } }, grid: { color: chartColors.grid } } } };

        if (energyTrendChartInstance) energyTrendChartInstance.destroy();
        energyTrendChartInstance = new Chart(document.getElementById('energyTrendChart'), {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Energy (kWh)', data: energies, borderColor: chartColors.accent, backgroundColor: 'rgba(0,255,178,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: chartColors.accent }] },
            options: chartDefaults
        });

        if (carbonBarChartInstance) carbonBarChartInstance.destroy();
        carbonBarChartInstance = new Chart(document.getElementById('carbonBarChart'), {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Carbon (kg CO₂)', data: carbons, backgroundColor: 'rgba(34,211,238,0.4)', borderColor: chartColors.cyan, borderWidth: 1, borderRadius: 4 }] },
            options: chartDefaults
        });

        if (predictionChartInstance) predictionChartInstance.destroy();
        predictionChartInstance = new Chart(document.getElementById('predictionChart'), {
            type: 'line',
            data: {
                labels: labels, datasets: [
                    { label: 'Actual (kWh)', data: energies, borderColor: chartColors.accent, tension: 0.3, pointRadius: 3, pointBackgroundColor: chartColors.accent },
                    { label: 'Predicted (kWh)', data: predictions, borderColor: chartColors.cyan, borderDash: [5, 5], tension: 0.3, pointRadius: 3, pointBackgroundColor: chartColors.cyan }
                ]
            },
            options: chartDefaults
        });
    }

    /* ═══════════════════════════════════
       BACKEND API — DASHBOARD UPDATE
       ═══════════════════════════════════ */
    function updateDashboard(data) {
        lastBackendData = data;
        if (data.id) lastAnalysisId = data.id;

        var carbonEl = document.getElementById('carbonValue');
        carbonEl.innerHTML = data.total_carbon.toFixed(2) + '<span class="unit">kg CO\u2082</span>';
        var trendEl = document.getElementById('carbonTrend');
        trendEl.textContent = 'Total energy: ' + data.total_energy.toFixed(0) + ' kWh';
        trendEl.className = 'trend';

        var badge = document.getElementById('emissionBadge');
        if (badge) {
            badge.style.display = 'inline-block';
            if (data.total_carbon < 5000) { badge.textContent = '✓ Low Emission'; badge.className = 'emission-badge low'; }
            else if (data.total_carbon < 15000) { badge.textContent = '⚠ Moderate Emission'; badge.className = 'emission-badge moderate'; }
            else { badge.textContent = '✖ High Emission'; badge.className = 'emission-badge high'; }
        }

        document.getElementById('energyForecastValue').textContent = 'Predicted next month: ' + data.prediction_next_month.toFixed(2) + ' kWh';

        var accDisplay = document.getElementById('accuracyDisplay');
        var accValue = document.getElementById('accuracyValue');
        if (accDisplay && accValue) { accDisplay.style.display = 'flex'; accValue.textContent = (data.model_accuracy * 100).toFixed(1) + '%'; }

        var score = Math.max(0, Math.min(100, Math.round(100 - (data.total_carbon / 200))));
        document.getElementById('sustainabilityScore').textContent = score;
        updateScoreColor(score);
        var labelEl = document.getElementById('scoreLabel');
        if (score >= 70) labelEl.textContent = 'Efficient Energy Usage';
        else if (score >= 40) labelEl.textContent = 'Moderate — Room for Improvement';
        else labelEl.textContent = 'High Emissions — Action Needed';

        baseCarbon = data.total_carbon; baseScore = score;
        energySlider.value = 20; renewSlider.value = 30; updateSim();
        updateEarthGlow(data.total_carbon);

        var dlBtn = document.getElementById('downloadReportBtn');
        if (dlBtn && data.id) dlBtn.style.display = 'inline-block';

        // Smart AI Copilot — contextual messages
        var msgs = [];
        msgs.push('Energy analysis complete. Predicted next month: ' + data.prediction_next_month.toFixed(0) + ' kWh (accuracy: ' + (data.model_accuracy * 100).toFixed(0) + '%).');

        if (previousAnalysisData) {
            var carbonDiff = ((data.total_carbon - previousAnalysisData.total_carbon) / previousAnalysisData.total_carbon * 100).toFixed(1);
            if (carbonDiff < 0) msgs.push('Carbon reduced by ' + Math.abs(carbonDiff) + '% compared to last upload. Great progress!');
            else if (carbonDiff > 0) msgs.push('Carbon increased by ' + carbonDiff + '% compared to last upload. Review energy patterns.');
        }

        if (data.total_carbon > 15000) msgs.push('High emission detected. Consider solar panel offset for peak months.');
        else if (data.total_carbon > 5000) msgs.push('Moderate emissions. Optimize HVAC schedules during peak hours.');
        else msgs.push('Emissions within optimal range. Excellent sustainability performance!');

        if (data.prediction_next_month > data.total_energy / 12) msgs.push('Rising energy trend predicted. Review mid-year consumption spikes.');

        previousAnalysisData = data;
        msgs.forEach(function (m, idx) { setTimeout(function () { aiSendMessage(m); }, idx * 2500); });

        // Load history for charts
        authFetch(API_BASE_URL + '/analysis-history')
            .then(function (res) { return res.json(); })
            .then(function (hData) { historyData = hData; updateCharts(hData); })
            .catch(function () { });
    }

    function updateEarthGlow(carbon) {
        if (carbon > 20000) glowIntensity = 2;
        else if (carbon > 10000) glowIntensity = 1.5;
        else glowIntensity = 1;
    }

    /* ═══════════════════════════════════
       FILE UPLOAD
       ═══════════════════════════════════ */
    var energyFileInput = document.getElementById('energyFile');
    var loadingEl = document.getElementById('loading');
    var uploadStatus = document.getElementById('uploadStatus');

    energyFileInput.addEventListener('change', async function () {
        var file = this.files[0];
        if (!file) return;
        var token = getToken();
        if (!token) { showAuth('login'); uploadStatus.textContent = 'Please sign in to upload data.'; uploadStatus.className = 'upload-hint error'; this.value = ''; return; }
        var formData = new FormData();
        formData.append('file', file);
        loadingEl.style.display = 'flex';
        uploadStatus.textContent = 'Uploading ' + file.name + '…';
        uploadStatus.className = 'upload-hint';
        try {
            var response = await authFetch(API_BASE_URL + '/analyze-energy', { method: 'POST', body: formData });
            if (!response.ok) { var errBody = await response.json().catch(function () { return {}; }); throw new Error(errBody.detail || errBody.error || 'Backend error'); }
            var data = await response.json();
            updateDashboard(data);
            uploadStatus.textContent = '✓ Analysis complete — ' + file.name;
            uploadStatus.className = 'upload-hint success';
        } catch (error) {
            uploadStatus.textContent = '✗ ' + error.message;
            uploadStatus.className = 'upload-hint error';
            aiSendMessage('⚠ ' + error.message);
        }
        loadingEl.style.display = 'none';
        this.value = '';
    });

    /* ═══════════════════════════════════
       AI CLIMATE COPILOT
       ═══════════════════════════════════ */
    var aiCopilot = document.getElementById('aiCopilot');
    var aiMessages = document.getElementById('aiMessages');
    var aiStatusEl = document.getElementById('aiStatus');
    var aiIsTyping = false;
    var aiMessageQueue = [];
    var prevScore = null, prevCarbon = null;
    var aiMaxMessages = 12;

    function aiSendMessage(text) {
        if (aiIsTyping) { aiMessageQueue.push(text); return; }
        aiIsTyping = true;
        aiStatusEl.textContent = 'Analyzing…';
        var typingEl = document.createElement('div');
        typingEl.className = 'ai-message ai-message--typing';
        typingEl.innerHTML = '<div class="ai-typing-dots"><span></span><span></span><span></span></div> AI is analyzing…';
        aiMessages.appendChild(typingEl);
        aiMessages.scrollTop = aiMessages.scrollHeight;
        setTimeout(function () {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            var msgEl = document.createElement('div');
            msgEl.className = 'ai-message';
            var cursorSpan = document.createElement('span');
            cursorSpan.className = 'ai-cursor';
            msgEl.appendChild(cursorSpan);
            aiMessages.appendChild(msgEl);
            aiMessages.scrollTop = aiMessages.scrollHeight;
            var charIdx = 0, speed = 22 + Math.random() * 12;
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
                    while (aiMessages.children.length > aiMaxMessages) aiMessages.removeChild(aiMessages.firstChild);
                    if (aiMessageQueue.length > 0) setTimeout(function () { aiSendMessage(aiMessageQueue.shift()); }, 300);
                }
            }, speed);
        }, 800);
    }

    function aiAnalyzeSliders() {
        var e = parseInt(energySlider.value), r = parseInt(renewSlider.value);
        var score = parseInt(simScore.textContent), carbonVal = parseInt(simCarbon.textContent);
        var messages = [];
        if (e < 10) messages.push('Energy optimization minimal. Consider reducing peak loads for better carbon offset.');
        else if (e <= 25) messages.push('Moderate energy improvement. Carbon emissions decreasing steadily.');
        else if (e <= 45) messages.push('Strong sustainability optimization. Significant carbon reduction achieved.');
        else messages.push('Maximum efficiency engaged. System approaching optimal performance.');
        if (r > 50) messages.push('Renewable integration at high capacity — sustainability improving rapidly.');
        else if (r > 25) messages.push('Renewable offset contributing to reduction. Consider increasing to 50%+.');
        if (prevScore !== null && score > prevScore) messages.push('Sustainability improving: ' + score + '/100.');
        if (prevCarbon !== null && carbonVal > prevCarbon) messages.push('⚠ Carbon trend increasing. Review energy usage patterns.');
        prevScore = score; prevCarbon = carbonVal;
        if (messages.length > 0) { aiSendMessage(messages[0]); if (messages.length > 1) aiMessageQueue.push(messages[1]); }
    }

    var aiDebounceTimer = null;
    energySlider.addEventListener('input', function () { clearTimeout(aiDebounceTimer); aiDebounceTimer = setTimeout(aiAnalyzeSliders, 500); });
    renewSlider.addEventListener('input', function () { clearTimeout(aiDebounceTimer); aiDebounceTimer = setTimeout(aiAnalyzeSliders, 500); });

    var aiShowObserver = new MutationObserver(function () {
        if (introScreen.style.display === 'none') {
            setTimeout(function () {
                aiCopilot.classList.add('visible');
                aiStatusEl.textContent = 'Online';
                setTimeout(function () { aiSendMessage('Climate Intelligence Engine active. Upload an energy CSV to begin analysis.'); }, 600);
            }, 1800);
            aiShowObserver.disconnect();
        }
    });
    aiShowObserver.observe(introScreen, { attributes: true, attributeFilter: ['style', 'class'] });

    /* ═══════════════════════════════════
       3D ANIMATION LOOP
       ═══════════════════════════════════ */
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
        for (var i = 0; i < nodeMeshes.length; i++) { var mn = nodeMeshes[i]; var p = 0.5 + 0.5 * Math.sin(t + mn.userData.phase); mn.material.opacity = mn.userData.baseOp * (0.5 + p * 0.5) * glowIntensity; }
        for (var j = 0; j < earthLines.length; j++) { var el = earthLines[j]; var lp = 0.5 + 0.5 * Math.sin(t * 0.5 + el.userData.phase); el.material.opacity = el.userData.baseOp * (0.4 + lp * 0.6) * glowIntensity; }
        var dP = dustParticles.geometry.attributes.position.array;
        for (var k = 0; k < dustCount; k++) dP[k * 3 + 1] += Math.sin(t * 0.3 + k) * 0.0004;
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

    authForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('authEmail').value.trim();
        var password = document.getElementById('authPassword').value;
        authError.textContent = '';
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = authIsLoginMode ? 'Signing in…' : 'Registering…';
        var endpoint = authIsLoginMode ? '/login' : '/register';
        try {
            var response = await fetch(API_BASE_URL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) });
            var data = await response.json();
            if (!response.ok) throw new Error(data.detail || data.error || 'Request failed');
            if (authIsLoginMode) {
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('user_email', email);
                authOverlay.style.display = 'none';
                updateAppState();
                aiSendMessage('Welcome back, ' + email.split('@')[0] + '! Upload a CSV to begin analysis.');
            } else {
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

    /* ═══════════════════════════════════
       CHANGE PASSWORD
       ═══════════════════════════════════ */
    var changePassForm = document.getElementById('changePasswordForm');
    var changePassMsg = document.getElementById('changePassMsg');
    var changePassBtn = document.getElementById('changePassBtn');

    changePassForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var oldPw = document.getElementById('oldPassword').value;
        var newPw = document.getElementById('newPassword').value;
        changePassBtn.disabled = true;
        changePassBtn.textContent = 'Updating…';
        changePassMsg.textContent = '';
        try {
            var res = await authFetch(API_BASE_URL + '/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPw, new_password: newPw })
            });
            var data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.error || 'Failed');
            changePassMsg.style.color = '#00ffb2';
            changePassMsg.textContent = '✓ ' + data.message;
            changePassForm.reset();
        } catch (err) {
            changePassMsg.style.color = '#f87171';
            changePassMsg.textContent = '✗ ' + err.message;
        }
        changePassBtn.disabled = false;
        changePassBtn.textContent = 'Update Password';
    });

    /* ═══════════════════════════════════
       INIT
       ═══════════════════════════════════ */
    updateAppState();
    if (getToken()) {
        aiSendMessage('Session restored. Ready for analysis.');
        // Pre-load history for charts
        authFetch(API_BASE_URL + '/analysis-history')
            .then(function (res) { return res.json(); })
            .then(function (data) { historyData = data; updateCharts(data); })
            .catch(function () { });
    }

})();
