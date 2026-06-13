// ================================================================
//  A.R.I.A. Client Logic v10
//
//  FIX 1: Spline loaded via iframe in HTML — no JS needed for it
//  FIX 2: TTS completely rebuilt — robust voice loading + pre-warm
//  FIX 3: Wake word uses SINGLE continuous recogniser — instant response
//  FIX 4: Location fixed — proper headers + robust geocoding
// ================================================================
'use strict';

// ── CSRF ──────────────────────────────────────────────────────────
function getCsrf() {
    var el = document.querySelector('input[name="__RequestVerificationToken"]');
    return el ? el.value : '';
}

// ── DOM refs ──────────────────────────────────────────────────────
var loader = document.getElementById('loader');
var permBar = document.getElementById('perm-bar');
var btnCam = document.getElementById('btn-cam');
var btnLoc = document.getElementById('btn-loc');
var btnSkip = document.getElementById('btn-skip');
var camIndicator = document.getElementById('cam-indicator');
var locIndicator = document.getElementById('loc-indicator');
var wakeIndicator = document.getElementById('wake-indicator');
var wcam = document.getElementById('wcam');
var headHalo = document.getElementById('head-halo');
var mouthGlow = document.getElementById('mouth-glow');
var rippleCont = document.getElementById('ripple-container');
var statusPill = document.getElementById('status-pill');
var statusText = document.getElementById('status-text');
var messagesEl = document.getElementById('messages');
var textInput = document.getElementById('textInput');
var sendBtn = document.getElementById('sendBtn');
var micBtn = document.getElementById('micBtn');
var recordBtn = document.getElementById('recordBtn');
var recStatus = document.getElementById('record-status');
var recStop = document.getElementById('rec-stop');
var recTranscribe = document.getElementById('rec-transcribe');
var recTimer = document.getElementById('rec-timer');
var voiceSelect = document.getElementById('voiceSelect');
var splineIframe = document.getElementById('spline-iframe');
var fbCanvas = document.getElementById('fallback-canvas');
var siriOverlay = document.getElementById('siri-overlay');
var siriArcEl = document.getElementById('siri-arc');

var convHistory = [];
var MAX_HIST = 12;

// ================================================================
//  IFRAME LOAD HANDLING
//  Spline iframe loads automatically via src in HTML.
//  Hide loader after iframe loads (or after 8s timeout).
// ================================================================
var iframeLoaded = false;

splineIframe.addEventListener('load', function () {
    iframeLoaded = true;
    setTimeout(function () { loader.classList.add('hidden'); }, 300);
});

// Fallback: hide loader after 8 seconds regardless
setTimeout(function () {
    loader.classList.add('hidden');
    if (!iframeLoaded) {
        // Iframe may have failed — try Three.js fallback
        checkSplineFallback();
    }
}, 8000);

function checkSplineFallback() {
    // If iframe has no content (e.g. blocked by network), show Three.js
    try {
        if (splineIframe.contentDocument &&
            (!splineIframe.contentDocument.body ||
                splineIframe.contentDocument.body.innerHTML.trim() === '')) {
            showThreeFallback();
        }
    } catch (e) {
        // cross-origin access blocked = iframe loaded (that's fine)
    }
}

// ================================================================
//  THREE.JS FALLBACK (only if Spline iframe fails)
// ================================================================
var threeBuilt = false;

function showThreeFallback() {
    if (threeBuilt || typeof THREE === 'undefined') return;
    threeBuilt = true;
    splineIframe.style.display = 'none';
    fbCanvas.style.display = 'block';
    buildThreeRobot();
}

function buildThreeRobot() {
    var wrap = fbCanvas.parentElement;
    var W = wrap.clientWidth, H = wrap.clientHeight;
    var renderer = new THREE.WebGLRenderer({ canvas: fbCanvas, antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);

    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
    var camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0.5, 6.5); camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var kL = new THREE.DirectionalLight(0xffffff, 2.2); kL.position.set(3, 6, 5); scene.add(kL);
    var fL = new THREE.DirectionalLight(0xaaccff, 1.0); fL.position.set(-4, 2, 3); scene.add(fL);
    var ptL = new THREE.PointLight(0x88bbff, 4.5, 22); ptL.position.set(0, 3, 4); scene.add(ptL);

    function mkM(col, em, eI, m, r) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(col), emissive: new THREE.Color(em || col), emissiveIntensity: eI || 0, metalness: m || 0.45, roughness: r || 0.35 }); }
    var W2 = mkM(0xeeeeee, 0x444444, 0.10, 0.50, 0.28), GY = mkM(0xbbbbcc, 0x222233, 0.05, 0.55, 0.35), DK = mkM(0x1a1a2a, 0x000011, 0, 0.80, 0.30), BL = mkM(0x4aacff, 0x4aacff, 3.0, 0, 0.30), WG = mkM(0xffffff, 0xffffff, 5.0, 0, 0.35), RD = mkM(0xff4455, 0xff2233, 4.0, 0, 0.35);

    var robot = new THREE.Group(); scene.add(robot);
    var headG = new THREE.Group(); headG.position.set(0, 1.55, 0); robot.add(headG);
    headG.add(new THREE.Mesh(new THREE.BoxGeometry(1.80, 1.60, 1.60), W2));
    var cap = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 1.45), GY); cap.position.set(0, 0.91, 0); headG.add(cap);
    var visor = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.92, 0.11), DK); visor.position.set(0, 0.06, 0.80); headG.add(visor);
    [-0.89, 0.89].forEach(function (x) { var a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.22, 0.08), BL.clone()); a.position.set(x, 0, 0.79); headG.add(a); });
    function mkEye(xp) { var g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), mkM(0x003355, 0x4aacff, 0.45, 0, 0.5))); var ir = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.038, 8, 32), mkM(0x00aaee, 0x4aacff, 1.5, 0, 0.4)); ir.position.z = 0.10; g.add(ir); var pu = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 14), WG); pu.position.z = 0.18; g.add(pu); g.position.set(xp, 0.12, 0.82); return g; }
    var lEye = mkEye(-0.37), rEye = mkEye(0.37); headG.add(lEye, rEye);
    var mG = new THREE.Group(); mG.position.set(0, -0.30, 0.82); headG.add(mG);
    var leds = []; for (var li = 0; li < 8; li++) { var lm = BL.clone(); var led = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.125, 0.065), lm); led.position.x = (li - 3.5) * 0.120; mG.add(led); leds.push(led); }
    function mkEar(s) { var g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.95, 0.90), GY)); var st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.11), BL.clone()); st.position.set(s * 0.08, 0, 0.42); g.add(st); g.position.set(s * 1.08, 0, 0); return g; }
    headG.add(mkEar(-1), mkEar(1));
    var antT = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), RD); antT.position.set(0.38, 1.60, 0); headG.add(antT);
    var antR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.60, 10), GY); antR.position.set(0.38, 1.27, 0); headG.add(antR);
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.40, 0.38, 14), GY); neck.position.set(0, -0.98, 0); headG.add(neck);
    var bodyG = new THREE.Group(); bodyG.position.set(0, -1.3, 0); robot.add(bodyG);
    bodyG.add(new THREE.Mesh(new THREE.BoxGeometry(2.28, 2.12, 1.38), W2));
    var ch = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.92, 0.12), DK); ch.position.set(0, 0.30, 0.71); bodyG.add(ch);
    for (var vi = 0; vi < 5; vi++) { var vt = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.055, 0.09), BL.clone()); vt.position.set(0, -0.18 - vi * 0.118, 0.71); bodyG.add(vt); }
    [-1.18, 1.18].forEach(function (x) { var sh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 1.16), GY); sh.position.set(x, 0.88, 0); bodyG.add(sh); });
    function mkArm() { var g = new THREE.Group(); var ua = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.48, 0.54), W2); ua.position.y = -0.74; g.add(ua); var el = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.33, 0.58), GY); el.position.y = -1.48; g.add(el); var fa = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.06, 0.46), W2); fa.position.y = -2.14; g.add(fa); var wr = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 8, 24), BL.clone()); wr.rotation.x = Math.PI / 2; wr.position.y = -2.70; g.add(wr); var hd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), GY); hd.position.y = -2.84; g.add(hd); return g; }
    var lA = mkArm(); lA.position.set(-1.17, 0.62, 0); bodyG.add(lA); var rA = mkArm(); rA.position.set(1.17, 0.62, 0); bodyG.add(rA);
    var hR = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 10, 36), BL.clone()); hR.rotation.x = Math.PI / 2; hR.position.y = -1.30; bodyG.add(hR);
    var sv = []; for (var si = 0; si < 700; si++) { sv.push((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 60 - 8); }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x88bbff, size: 0.07, transparent: true, opacity: 0.65 })));

    var mTgt = { x: 0, y: 0 }, mCur = { x: 0, y: 0 };
    window.addEventListener('mousemove', function (e) { mTgt.x = (e.clientX / window.innerWidth) * 2 - 1; mTgt.y = -(e.clientY / window.innerHeight) * 2 + 1; });
    window._ariaLeds = leds; window._ariaHeadG = headG; window._ariaLEye = lEye; window._ariaREye = rEye; window._ariaMG = mG; window._ariaAntT = antT; window._ariaLA = lA; window._ariaRA = rA; window._ariaMCur = mCur; window._ariaMTgt = mTgt;

    var bC = 3 + Math.random() * 2.5, bP = 0, t = 0, lTs = 0;
    function tick(ts) {
        requestAnimationFrame(tick); var dt = Math.min((ts - lTs) / 1000, 0.05); lTs = ts; t += dt;
        mCur.x += (mTgt.x - mCur.x) * 0.07; mCur.y += (mTgt.y - mCur.y) * 0.07;
        robot.position.y = Math.sin(t * 0.85) * 0.12;
        var hs = 1 + Math.sin(t * 2.2) * 0.06; hR.scale.set(hs, 1, hs);
        antT.material.emissiveIntensity = 1.2 + Math.sin(t * 4.5) * 1.2;
        ptL.position.x = Math.sin(t * 0.42) * 4; ptL.position.z = Math.cos(t * 0.42) * 4 + 2;
        headG.rotation.y += (mCur.x * 0.46 - headG.rotation.y) * 0.06; headG.rotation.x += (-mCur.y * 0.22 - headG.rotation.x) * 0.06;
        var spk = (ariaState === 'speaking'); lA.rotation.z = -0.08 + (spk ? Math.sin(t * 2.2) * 0.16 : Math.sin(t * 0.5) * 0.04); rA.rotation.z = 0.08 - (spk ? Math.sin(t * 2.2) * 0.16 : Math.sin(t * 0.5) * 0.04);
        bC -= dt; if (bC <= 0 && bP === 0) { bP = 0.001; bC = 3 + Math.random() * 3; }
        if (bP > 0) { bP += dt; var bt = bP / 0.14; var ey = bt < 0.5 ? (1 - bt * 2) : ((bt - 0.5) * 2); lEye.scale.y = rEye.scale.y = Math.max(0.05, ey); if (bP >= 0.14) { bP = 0; lEye.scale.y = rEye.scale.y = 1; } }
        renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
    window.addEventListener('resize', function () { var w = wrap.clientWidth, h = wrap.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); });
}

// ================================================================
//  PERMISSIONS
// ================================================================
btnCam.addEventListener('click', function () { btnCam.disabled = true; btnCam.textContent = 'Requesting...'; enableCamera(); });
btnLoc.addEventListener('click', function () { btnLoc.disabled = true; btnLoc.textContent = 'Requesting...'; enableLocation(); });
btnSkip.addEventListener('click', function () { permBar.classList.add('hidden'); });

// ================================================================
//  LOCATION — FIX 3 (proper Nominatim headers, toggle)
// ================================================================
var userCity = null, locEnabled = false;

locIndicator.addEventListener('click', function () {
    if (locEnabled) {
        locEnabled = false; userCity = null;
        locIndicator.className = 'indicator off';
        locIndicator.querySelector('span').textContent = 'OFF';
    } else {
        enableLocation();
    }
});

function enableLocation() {
    if (!navigator.geolocation) { setLocLabel(false, 'N/A'); return; }
    navigator.geolocation.getCurrentPosition(
        function (pos) {
            locEnabled = true;
            setLocLabel(true, 'LOCATING...');
            fetch(
                'https://nominatim.openstreetmap.org/reverse' +
                '?lat=' + pos.coords.latitude.toFixed(6) +
                '&lon=' + pos.coords.longitude.toFixed(6) +
                '&format=json&zoom=10&addressdetails=1',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                }
            )
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var a = d.address || {};
                    userCity = a.city || a.town || a.suburb || a.village || a.county || a.state || null;
                    setLocLabel(true, userCity ? userCity.toUpperCase() : 'LOCATED');
                    permBar.classList.add('hidden');
                })
                .catch(function () {
                    setLocLabel(true, 'LOCATED');
                    permBar.classList.add('hidden');
                });
        },
        function (err) { setLocLabel(false, 'DENIED'); console.warn('Location:', err.message); },
        { timeout: 10000, enableHighAccuracy: false }
    );
}

function setLocLabel(on, label) {
    locIndicator.className = 'indicator ' + (on ? 'on' : 'off');
    locIndicator.querySelector('span').textContent = label;
}

var LOC_RE = /weather|temperature|forecast|rain|wind|hot|cold|where am i|my city|nearby|near me|local|location|directions/i;

function buildPrompt(text) {
    if (locEnabled && userCity && LOC_RE.test(text))
        return text + ' [context: user is in ' + userCity + ']';
    return text;
}

// ================================================================
//  CAMERA + FACE TRACKING
// ================================================================
var camStream = null, faceTimer = null, faceDetector = null, camEnabled = false;
var lastFX = 0.5, lastFY = 0.38;

camIndicator.addEventListener('click', function () {
    if (camEnabled) disableCamera(); else enableCamera();
});

async function enableCamera() {
    try {
        camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }
        });
        wcam.srcObject = camStream;
        camEnabled = true;
        camIndicator.className = 'indicator on';
        camIndicator.querySelector('span').textContent = 'CAM';
        if ('FaceDetector' in window) {
            try { faceDetector = new FaceDetector({ maxDetectedFaces: 1, fastMode: true }); camIndicator.querySelector('span').textContent = 'FACE'; }
            catch (e) { faceDetector = null; }
        }
        wcam.onloadeddata = function () { if (!faceTimer) startFaceTracking(); };
        setTimeout(function () { if (!faceTimer) startFaceTracking(); }, 1500);
        permBar.classList.add('hidden');
    } catch (e) {
        camEnabled = false;
        camIndicator.className = 'indicator off';
        camIndicator.querySelector('span').textContent = 'DENIED';
    }
}

function disableCamera() {
    camEnabled = false;
    if (faceTimer) { clearInterval(faceTimer); faceTimer = null; }
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    wcam.srcObject = null;
    camIndicator.className = 'indicator off';
    camIndicator.querySelector('span').textContent = 'OFF';
}

function startFaceTracking() {
    if (faceTimer) clearInterval(faceTimer);
    faceTimer = setInterval(faceTrackTick, 100);
}

async function faceTrackTick() {
    if (!camEnabled || !wcam || wcam.readyState < 2) return;
    var vw = wcam.videoWidth, vh = wcam.videoHeight;
    if (!vw || !vh) return;

    var fx = lastFX, fy = lastFY;
    if (faceDetector) {
        try {
            var faces = await faceDetector.detect(wcam);
            if (faces.length > 0) {
                var bb = faces[0].boundingBox;
                fx = 1.0 - ((bb.x + bb.width * 0.5) / vw);
                fy = (bb.y + bb.height * 0.4) / vh;
                lastFX = fx; lastFY = fy;
            }
        } catch (e) { }
    }

    // Update Three.js fallback robot mouse target
    if (window._ariaMTgt) {
        window._ariaMTgt.x = fx * 2 - 1;
        window._ariaMTgt.y = -(fy * 2 - 1);
    }

    // For the Spline iframe, dispatch pointer events on the document
    // Spline's runtime listens to document-level pointer events globally
    var iRect = splineIframe.getBoundingClientRect();
    if (iRect.width > 0 && iRect.height > 0) {
        var cx = Math.round(iRect.left + fx * iRect.width);
        var cy = Math.round(iRect.top + fy * iRect.height);
        var opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window, pointerType: 'mouse', isPrimary: true };
        document.dispatchEvent(new PointerEvent('pointermove', opts));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }));
    }
}

// ================================================================
//  STATE MACHINE
// ================================================================
var ariaState = 'idle', lipRAF = null, lipPhase = 0, rippleInt = null;

function setState(s) {
    ariaState = s;
    statusPill.className = s;
    statusText.textContent = { idle: 'ONLINE', thinking: 'PROCESSING', speaking: 'SPEAKING', listening: 'LISTENING' }[s] || 'ONLINE';
    if (s === 'speaking') {
        headHalo.style.opacity = '1'; mouthGlow.style.opacity = '1';
        startRipples(); startLipSync();
    } else {
        if (s !== 'thinking') { headHalo.style.opacity = '0'; mouthGlow.style.opacity = '0'; stopRipples(); if (s !== 'listening') stopLipSync(); }
    }
}

function startRipples() { stopRipples(); spawnRipple(); rippleInt = setInterval(spawnRipple, 820); }
function spawnRipple() { var r = document.createElement('div'); r.className = 'ripple-ring'; rippleCont.appendChild(r); setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 2000); }
function stopRipples() { clearInterval(rippleInt); rippleInt = null; rippleCont.innerHTML = ''; }

function startLipSync() {
    stopLipSync();
    function tick() {
        lipPhase += 0.062;
        var w = Math.sin(lipPhase * 7.1) * 0.40 + Math.sin(lipPhase * 13.9) * 0.26 + Math.sin(lipPhase * 3.2) * 0.34;
        var open = Math.max(0, w);
        headHalo.style.transform = 'translateX(-50%) scale(' + (0.9 + open * 0.28).toFixed(3) + ')';
        headHalo.style.opacity = (0.22 + open * 0.78).toFixed(3);
        mouthGlow.style.transform = 'translateX(-50%) scaleX(' + (1 + open * 2.2).toFixed(3) + ')';
        mouthGlow.style.opacity = (0.55 + open * 0.45).toFixed(3);
        if (window._ariaLeds) {
            window._ariaLeds.forEach(function (led, i) { var v = Math.sin(lipPhase * 8 + i * 0.7) * 0.5 + 0.5; led.scale.y += (1 + open * v * 3.5 - led.scale.y) * 0.28; led.material.emissiveIntensity = 0.8 + open * v * 2.2; });
            if (window._ariaMG) window._ariaMG.scale.y += (1 + open * 1.8 - window._ariaMG.scale.y) * 0.18;
        }
        lipRAF = requestAnimationFrame(tick);
    }
    tick();
}
function stopLipSync() {
    if (lipRAF) cancelAnimationFrame(lipRAF); lipRAF = null; lipPhase = 0;
    headHalo.style.transform = 'translateX(-50%) scale(1)'; headHalo.style.opacity = '0';
    mouthGlow.style.transform = 'translateX(-50%) scaleX(1)'; mouthGlow.style.opacity = '0';
    if (window._ariaLeds) { window._ariaLeds.forEach(function (l) { l.scale.y += (1 - l.scale.y) * 0.12; l.material.emissiveIntensity += (1.6 - l.material.emissiveIntensity) * 0.10; }); if (window._ariaMG) window._ariaMG.scale.y += (1 - window._ariaMG.scale.y) * 0.12; }
}

// ================================================================
//  FIX 2 — TTS REBUILT (robust voice loading, pre-warm, fallback)
//
//  Root cause of "ARIA doesn't talk back":
//  1. Voices not loaded → fixed with polling + retry
//  2. Chrome autoplay blocked → fixed with pre-warm on first gesture
//  3. Queue issues → simplified to direct speak with sentence splitting
// ================================================================
var voices = [];
var ttsQueue = [];
var ttsSpeaking = false;
var ttsReady = false;

// Load voices with polling — Chrome loads them async and sometimes
// onvoiceschanged never fires, so we poll every 200ms until they appear
function loadVoicesWithRetry() {
    var v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) {
        voices = Array.from(v);
        ttsReady = true;
        updateVoiceSelect();
    } else {
        setTimeout(loadVoicesWithRetry, 200);
    }
}

function updateVoiceSelect() {
    voiceSelect.innerHTML = '';
    voices.forEach(function (vx, i) {
        var opt = document.createElement('option');
        opt.value = i; opt.textContent = vx.name + ' (' + vx.lang + ')';
        // Prefer Google US English — most natural for TTS
        if (vx.name === 'Google US English') opt.selected = true;
        else if (!opt.selected && vx.name.toLowerCase().indexOf('google') !== -1 && vx.lang.startsWith('en')) opt.selected = true;
        voiceSelect.appendChild(opt);
    });
}

window.speechSynthesis.onvoiceschanged = function () { loadVoicesWithRetry(); };
loadVoicesWithRetry();

// Pre-warm TTS engine on first user gesture — eliminates Chrome's cold-start delay
var ttsWarmed = false;
function warmTTS() {
    if (ttsWarmed) return;
    ttsWarmed = true;
    try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance('');
        u.volume = 0; u.rate = 99;
        window.speechSynthesis.speak(u);
    } catch (e) { }
}
// Attach to multiple events to ensure warm happens
['click', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, warmTTS, { passive: true });
});

function getBestVoice() {
    if (!voices.length) {
        var v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) { voices = Array.from(v); updateVoiceSelect(); }
    }
    var vi = parseInt(voiceSelect.value, 10);
    if (voices[vi]) return voices[vi];
    // Fallback: find any English voice
    var eng = voices.find(function (v) { return v.lang.startsWith('en'); });
    return eng || null;
}

function speakNow(text, onDone) {
    text = (text || '').trim();
    if (!text) { if (onDone) onDone(); return; }
    ttsQueue.push({ text: text, cb: onDone || null });
    if (!ttsSpeaking) drainTTS();
}

function drainTTS() {
    if (!ttsQueue.length) {
        ttsSpeaking = false;
        if (ariaState === 'speaking') setState('idle');
        return;
    }
    ttsSpeaking = true;
    if (ariaState !== 'speaking') setState('speaking');

    var item = ttsQueue.shift();

    // Cancel anything playing before we speak
    window.speechSynthesis.cancel();

    // Small delay after cancel — Chrome needs this
    setTimeout(function () {
        var u = new SpeechSynthesisUtterance(item.text);
        var voice = getBestVoice();
        if (voice) u.voice = voice;
        u.rate = 1.05;
        u.pitch = 1.0;
        u.volume = 1.0;

        u.onstart = function () { if (ariaState !== 'speaking') setState('speaking'); };
        u.onend = function () { if (item.cb) item.cb(); drainTTS(); };
        u.onerror = function (e) {
            console.warn('TTS error:', e.error);
            if (item.cb) item.cb();
            drainTTS();
        };

        try {
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn('speechSynthesis.speak failed:', e);
            if (item.cb) item.cb();
            drainTTS();
        }
    }, 60);
}

function stopTTS() {
    ttsQueue = []; ttsSpeaking = false;
    try { window.speechSynthesis.cancel(); } catch (e) { }
}

// ================================================================
//  CHAT
// ================================================================
function addMsg(who, text) {
    var row = document.createElement('div'); row.className = 'msg-row ' + who;
    if (who !== 'system') {
        var av = document.createElement('div'); av.className = 'msg-avatar';
        av.textContent = (who === 'aria') ? 'AR' : 'ME'; row.appendChild(av);
    }
    var bub = document.createElement('div'); bub.className = 'msg-bubble';
    bub.textContent = text; row.appendChild(bub);
    messagesEl.appendChild(row); messagesEl.scrollTop = messagesEl.scrollHeight;
    return bub;
}

function addTyping() {
    var row = document.createElement('div'); row.className = 'msg-row aria'; row.id = 'typing-row';
    var av = document.createElement('div'); av.className = 'msg-avatar'; av.textContent = 'AR';
    var bub = document.createElement('div'); bub.className = 'msg-bubble';
    bub.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    row.appendChild(av); row.appendChild(bub); messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
function rmTyping() { var r = document.getElementById('typing-row'); if (r && r.parentNode) r.parentNode.removeChild(r); }

// ================================================================
//  SEND MESSAGE — streaming SSE
// ================================================================
async function sendMessage(override) {
    var raw = (override || textInput.value).trim();
    if (!raw || ariaState !== 'idle') return;

    warmTTS(); // ensure TTS warm before we need it
    stopTTS(); textInput.value = ''; sendBtn.disabled = true; setState('thinking');

    var welcome = document.querySelector('.msg-welcome');
    if (welcome && welcome.parentNode) welcome.parentNode.removeChild(welcome);
    addMsg('user', raw); addTyping();

    var prompt = buildPrompt(raw);
    var hist = convHistory.slice(-MAX_HIST).map(function (t) { return { user: t.User, assistant: t.Assistant }; });

    var ariaBubble = null, fullText = '', sentBuf = '';

    try {
        var res = await fetch('/Robot/AskStream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': getCsrf() },
            body: JSON.stringify({ text: prompt, history: hist })
        });
        if (!res.ok) { var ed = await res.json().catch(function () { return {}; }); throw new Error(ed.error || 'Server error ' + res.status); }
        if (!res.body) throw new Error('Streaming not supported in this browser');

        rmTyping();
        var reader = res.body.getReader(), dec = new TextDecoder(), rawBuf = '';

        outer: while (true) {
            var chunk = await reader.read(); if (chunk.done) break;
            rawBuf += dec.decode(chunk.value, { stream: true });
            var lines = rawBuf.split('\n'); rawBuf = lines.pop() || '';
            for (var li = 0; li < lines.length; li++) {
                var line = lines[li].trim(); if (!line.startsWith('data: ')) continue;
                var data = line.slice(6); if (data === '[DONE]') { reader.cancel(); break outer; }
                var parsed; try { parsed = JSON.parse(data); } catch (e) { continue; }
                if (parsed.error) throw new Error(parsed.error);
                var tok = parsed.token; if (!tok) continue;

                fullText += tok; sentBuf += tok;
                if (!ariaBubble) ariaBubble = addMsg('aria', '');
                ariaBubble.textContent = fullText;
                messagesEl.scrollTop = messagesEl.scrollHeight;

                // Speak sentences as they complete — no waiting for full response
                var m = sentBuf.match(/^([\s\S]+?[.!?]['"）\)]?)(\s+|$)/);
                if (m && m[1].trim().length > 3) { speakNow(m[1]); sentBuf = sentBuf.slice(m[0].length); }
            }
        }

        // Speak any remaining fragment
        if (sentBuf.trim().length > 2) speakNow(sentBuf.trim());
        if (fullText) { convHistory.push({ User: raw, Assistant: fullText }); if (convHistory.length > MAX_HIST * 2) convHistory.shift(); }
        if (!ttsQueue.length && !ttsSpeaking) setState('idle');

    } catch (err) {
        rmTyping();
        var em = '\u26A0 ' + err.message;
        if (!ariaBubble) addMsg('aria', em); else ariaBubble.textContent = em;
        setState('idle');
    } finally { sendBtn.disabled = false; }
}

textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMessage(); });
sendBtn.addEventListener('click', function () { sendMessage(); });

// ================================================================
//  FIX 3 — WAKE WORD ("say ARIA"), CROSS-PLATFORM
//
//  Desktop Chrome/Edge: continuous recognition starts automatically
//  and restarts itself, so "ARIA" can be said at any time.
//
//  Mobile (Android Chrome / iOS Safari): browsers refuse to start
//  SpeechRecognition without a user gesture, and iOS Safari does not
//  implement SpeechRecognition at all. So:
//    - On mobile, tapping the WAKE indicator "arms" the recogniser
//      (the required user gesture). Once armed, it keeps restarting
//      itself just like desktop, so saying "ARIA" after that works.
//    - If SpeechRecognition is unsupported (iOS Safari), WAKE is
//      disabled with a clear label and the user is told to use the
//      manual mic button instead — which still requires a tap, so
//      it always works on iOS.
// ================================================================
var HAS_SR = ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
var SR_CLASS = HAS_SR ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var IS_MOBILE = IS_IOS || /Android/i.test(navigator.userAgent);

var GREETING = 'Hi sir, how may I assist you?';
var recPhase = 'wake';  // 'wake' | 'query' | 'manual' | 'off'
var queryText = '';
var queryHasSpeech = false;
var wakeTriggered = false;
var mainRec = null;
var silRAF = null, silStart = 0;
var recRunning = false;
var wakeArmed = false;     // becomes true once recogniser has successfully started at least once
var fatalRecError = false; // true if SR is unusable (e.g. 'not-allowed' / 'service-not-allowed')
var restartTimer = null;

// Siri arc canvas
var arcCtx = siriArcEl ? siriArcEl.getContext('2d') : null;
function drawArc(f) {
    if (!arcCtx) return;
    arcCtx.clearRect(0, 0, 64, 64);
    arcCtx.beginPath(); arcCtx.arc(32, 32, 26, 0, Math.PI * 2);
    arcCtx.strokeStyle = 'rgba(74,172,255,0.20)'; arcCtx.lineWidth = 4; arcCtx.stroke();
    if (f > 0) {
        arcCtx.beginPath(); arcCtx.arc(32, 32, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        arcCtx.strokeStyle = '#4aacff'; arcCtx.lineWidth = 4; arcCtx.stroke();
    }
}

function setWakeLabel(state, label) {
    // state: 'on' | 'off' | 'na'
    wakeIndicator.className = 'indicator ' + (state === 'on' ? 'on' : 'off');
    var span = wakeIndicator.querySelector('span');
    if (span) span.textContent = label;
}

// Main result/end/error handlers are defined as named functions so they
// can be re-attached after manual-mode temporarily overrides them.
function wakeQueryHandler(e) {
    var latest = '';
    for (var i = 0; i < e.results.length; i++) {
        latest += e.results[i][0].transcript;
    }
    latest = latest.trim();

    if (recPhase === 'wake') {
        // Detect "aria" anywhere in interim/final results — respond IMMEDIATELY
        if (latest.toLowerCase().indexOf('aria') !== -1 && !wakeTriggered && ariaState === 'idle') {
            wakeTriggered = true;
            onWakeDetected();
        }
    } else if (recPhase === 'query') {
        // Remove the wake word from the query if it's at the start
        var filtered = latest.replace(/^aria\s*/i, '').trim();
        queryText = filtered;
        if (queryText.length > 2) {
            queryHasSpeech = true;
            silStart = Date.now(); // reset silence timer
            siriOverlay.classList.add('voice-active');
        }
    }
    // manual phase handled separately
}

function wakeEndHandler() {
    recRunning = false;
    if (recPhase === 'wake' || recPhase === 'query') {
        // Auto-restart — keep it continuous
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(function () {
            if (recPhase !== 'off' && recPhase !== 'manual' && !fatalRecError) startMainRec();
        }, 300);
    }
}

function wakeErrorHandler(e) {
    recRunning = false;

    if (e.error === 'aborted') return;

    if (e.error === 'no-speech') {
        if (recPhase === 'query' && queryHasSpeech) { finaliseQuery(); return; }
        // In wake phase, "no-speech" is normal — just restart quietly
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(function () {
            if (recPhase !== 'off' && recPhase !== 'manual' && !fatalRecError) startMainRec();
        }, 250);
        return;
    }

    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Mic permission denied / blocked — stop trying, surface clearly
        fatalRecError = true;
        recPhase = 'off';
        setWakeLabel('off', 'NO MIC');
        if (ariaState === 'idle') {
            addMsg('system', '\u26A0 Microphone access blocked — wake word and voice input are unavailable. Allow microphone access for this site and reload.');
        }
        return;
    }

    if (e.error === 'audio-capture') {
        fatalRecError = true;
        recPhase = 'off';
        setWakeLabel('off', 'NO MIC');
        if (ariaState === 'idle') {
            addMsg('system', '\u26A0 No microphone detected.');
        }
        return;
    }

    if (e.error === 'network') {
        // Common on flaky mobile connections — back off longer
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(function () {
            if (recPhase !== 'off' && recPhase !== 'manual' && !fatalRecError) startMainRec();
        }, 1500);
        return;
    }

    // Unknown error — retry with backoff
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function () {
        if (recPhase !== 'off' && recPhase !== 'manual' && !fatalRecError) startMainRec();
    }, 800);
}

function initMainRec() {
    if (!HAS_SR) return;
    mainRec = new SR_CLASS();
    mainRec.continuous = true;
    mainRec.interimResults = true;
    mainRec.lang = 'en-US';
    mainRec.maxAlternatives = 1;

    mainRec.onresult = wakeQueryHandler;
    mainRec.onend = wakeEndHandler;
    mainRec.onerror = wakeErrorHandler;

    mainRec.onstart = function () {
        recRunning = true;
        wakeArmed = true;
        fatalRecError = false;
        if (recPhase === 'wake') setWakeLabel('on', 'WAKE');
    };
}

function startMainRec() {
    if (!mainRec || recRunning || fatalRecError) return;
    try {
        mainRec.start();
        recRunning = true; // also set here in case onstart is delayed
    } catch (e) {
        recRunning = false;
        // InvalidStateError can happen if start() is called while already starting —
        // just let the next onend/timer cycle retry.
    }
}

function stopMainRec() {
    recRunning = false;
    try { if (mainRec) mainRec.stop(); } catch (e) { }
}

function onWakeDetected() {
    if (ariaState !== 'idle') { wakeTriggered = false; return; }

    // Immediately speak greeting — no stopping recognition needed
    setState('speaking');
    addMsg('aria', GREETING);

    speakNow(GREETING, function () {
        // Greeting finished — switch to query mode
        recPhase = 'query';
        queryText = '';
        queryHasSpeech = false;
        wakeTriggered = false;
        silStart = Date.now();
        showSiri();
        setState('listening');
        setWakeLabel('off', 'LISTEN');
        startSilenceCountdown();
    });
}

function startSilenceCountdown() {
    if (silRAF) cancelAnimationFrame(silRAF);
    silStart = Date.now();

    function tick() {
        if (recPhase !== 'query') return;
        var elapsed = (Date.now() - silStart) / 1000;
        drawArc(queryHasSpeech ? Math.min(elapsed / 3, 1) : 0);

        if (queryHasSpeech && elapsed >= 3.0) {
            finaliseQuery(); return;
        }
        if (!queryHasSpeech && elapsed >= 8.0) {
            finaliseQuery(); return; // timeout with no speech
        }
        silRAF = requestAnimationFrame(tick);
    }
    silRAF = requestAnimationFrame(tick);
}

function finaliseQuery() {
    if (silRAF) cancelAnimationFrame(silRAF);
    hideSiri();
    var spoken = queryText.trim();
    queryText = ''; queryHasSpeech = false;

    // Switch back to wake mode
    recPhase = 'wake';
    wakeTriggered = false;
    setState('idle');
    setWakeLabel('on', 'WAKE');

    if (spoken.length > 2) {
        sendMessage(spoken);
    } else {
        addMsg('system', '[ No speech detected — say "ARIA" to try again ]');
    }
}

function showSiri() { siriOverlay.classList.add('active'); drawArc(0); }
function hideSiri() { siriOverlay.classList.remove('active', 'voice-active'); }

siriOverlay.addEventListener('click', function () {
    if (silRAF) cancelAnimationFrame(silRAF);
    hideSiri();
    queryText = ''; queryHasSpeech = false;
    recPhase = 'wake'; wakeTriggered = false;
    setState('idle');
    setWakeLabel(fatalRecError ? 'off' : 'on', fatalRecError ? 'NO MIC' : 'WAKE');
});

// ── Wake indicator click — arms/disarms the recogniser ──────────────
// On desktop this just toggles; on mobile this is REQUIRED to satisfy
// the browser's user-gesture requirement before mic access is granted.
wakeIndicator.addEventListener('click', function () {
    if (!HAS_SR) {
        addMsg('system', IS_IOS
            ? '\u26A0 Voice wake word isn\u2019t supported on iOS Safari. Tap the microphone button to speak instead.'
            : '\u26A0 Voice input requires Chrome or Edge.');
        return;
    }

    if (fatalRecError) {
        // Retry — user may have just granted mic permission
        fatalRecError = false;
        recPhase = 'wake';
        setWakeLabel('on', 'WAKE');
        startMainRec();
        return;
    }

    if (recPhase === 'manual' || recPhase === 'query') return; // ignore while busy

    if (recPhase === 'off') {
        recPhase = 'wake';
        wakeTriggered = false;
        setWakeLabel('on', 'WAKE');
        startMainRec();
    } else {
        // Currently on — turn off
        recPhase = 'off';
        wakeTriggered = false;
        setWakeLabel('off', 'OFF');
        stopMainRec();
    }
});

// Start the single recogniser after page settles
if (HAS_SR) {
    initMainRec();
    setTimeout(function () {
        recPhase = 'wake';
        if (IS_MOBILE) {
            // Don't auto-start on mobile: starting SpeechRecognition without a
            // direct user gesture throws/silently fails on Android and is
            // unsupported on iOS. Prompt the user to tap WAKE to enable it.
            setWakeLabel('off', 'TAP TO ARM');
        } else {
            setWakeLabel('on', 'WAKE');
            startMainRec();
        }
    }, 1200);
} else {
    setWakeLabel('off', 'N/A');
    micBtn.title = IS_IOS ? 'Tap to speak (voice wake word unsupported on iOS)' : 'Voice input requires Chrome or Edge';
}

// ── Manual mic button ─────────────────────────────────────────────
micBtn.addEventListener('click', function () {
    warmTTS();

    if (!HAS_SR) {
        addMsg('system', '\u26A0 Voice input requires Chrome, Edge, or another browser with SpeechRecognition support.');
        return;
    }

    if (recPhase === 'manual') {
        // Stop manual — go back to wake (or off, if SR never armed on mobile)
        recPhase = IS_MOBILE && !wakeArmed ? 'off' : 'wake';
        micBtn.classList.remove('active-mic'); micBtn.innerHTML = '&#127908;';
        mainRec.onresult = wakeQueryHandler;
        mainRec.onend = wakeEndHandler;
        mainRec.onerror = wakeErrorHandler;
        if (recPhase === 'wake') { setWakeLabel('on', 'WAKE'); }
        else { setWakeLabel('off', 'TAP TO ARM'); stopMainRec(); }
    } else {
        // Switch to manual mode
        if (recPhase === 'query') return; // ignore while ARIA is actively listening for a query
        recPhase = 'manual';
        micBtn.classList.add('active-mic'); micBtn.innerHTML = '&#9632;';
        setWakeLabel('off', 'MANUAL');

        mainRec.onresult = function (e) {
            var final_t = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) final_t += e.results[i][0].transcript;
            }
            if (final_t.trim()) {
                textInput.value = final_t.trim();
                recPhase = (IS_MOBILE && !wakeArmed) ? 'off' : 'wake';
                micBtn.classList.remove('active-mic'); micBtn.innerHTML = '&#127908;';
                mainRec.onresult = wakeQueryHandler;
                mainRec.onend = wakeEndHandler;
                mainRec.onerror = wakeErrorHandler;
                setWakeLabel(recPhase === 'wake' ? 'on' : 'off', recPhase === 'wake' ? 'WAKE' : 'TAP TO ARM');
                sendMessage();
            }
        };
        mainRec.onend = function () {
            recRunning = false;
            if (recPhase === 'manual') {
                recPhase = (IS_MOBILE && !wakeArmed) ? 'off' : 'wake';
                micBtn.classList.remove('active-mic'); micBtn.innerHTML = '&#127908;';
                mainRec.onresult = wakeQueryHandler;
                mainRec.onend = wakeEndHandler;
                mainRec.onerror = wakeErrorHandler;
                setWakeLabel(recPhase === 'wake' ? 'on' : 'off', recPhase === 'wake' ? 'WAKE' : 'TAP TO ARM');
                if (recPhase === 'wake') setTimeout(startMainRec, 300);
            }
        };
        mainRec.onerror = function (e) {
            recRunning = false;
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                fatalRecError = true;
                recPhase = 'off';
                micBtn.classList.remove('active-mic'); micBtn.innerHTML = '&#127908;';
                setWakeLabel('off', 'NO MIC');
                addMsg('system', '\u26A0 Microphone access blocked — allow microphone access for this site and reload.');
                return;
            }
            // For other errors, just exit manual mode back to wake/off
            if (recPhase === 'manual') {
                recPhase = (IS_MOBILE && !wakeArmed) ? 'off' : 'wake';
                micBtn.classList.remove('active-mic'); micBtn.innerHTML = '&#127908;';
                mainRec.onresult = wakeQueryHandler;
                mainRec.onend = wakeEndHandler;
                mainRec.onerror = wakeErrorHandler;
                setWakeLabel(recPhase === 'wake' ? 'on' : 'off', recPhase === 'wake' ? 'WAKE' : 'TAP TO ARM');
            }
        };
        startMainRec();
    }
});

// ================================================================
//  LECTURE RECORDER + TRANSCRIPTION
// ================================================================
var mediaRec = null, recChunks = [], recInterval = null, recSecs = 0;
function bestMime() { var t = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']; for (var i = 0; i < t.length; i++) { try { if (MediaRecorder.isTypeSupported(t[i])) return t[i]; } catch (e) { } } return ''; }
function fmtTime(s) { return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }

recordBtn.addEventListener('click', async function () {
    if (mediaRec && mediaRec.state === 'recording') return;
    try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        var mime = bestMime(); recChunks = []; recSecs = 0; recTimer.textContent = '0:00';
        mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        mediaRec.ondataavailable = function (e) { if (e.data && e.data.size > 0) recChunks.push(e.data); };
        mediaRec.start(500);
        recInterval = setInterval(function () { recSecs++; recTimer.textContent = fmtTime(recSecs); }, 1000);
        recStatus.classList.remove('hidden'); recordBtn.classList.add('recording');
        addMsg('system', '[ Recording started ]');
    } catch (e) { addMsg('system', '\u26A0 Microphone access denied.'); }
});

recStop.addEventListener('click', function () { stopRec(false); });
recTranscribe.addEventListener('click', function () { stopRec(true); });

function stopRec(doT) {
    if (!mediaRec || mediaRec.state !== 'recording') return;
    clearInterval(recInterval); recStatus.classList.add('hidden'); recordBtn.classList.remove('recording');
    mediaRec.onstop = function () {
        var actualMime = mediaRec.mimeType || 'audio/webm';
        var ext = actualMime.indexOf('ogg') !== -1 ? 'ogg' : actualMime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
        var blob = new Blob(recChunks, { type: actualMime });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'ARIA-Recording-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.' + ext;
        document.body.appendChild(a);

        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            window.open(url, '_blank');
        } else {
            a.click();
        }
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        addMsg('system', '[ Saved: ' + fmtTime(recSecs) + ' ' + ext.toUpperCase() + ' ]');
        if (doT) { addMsg('system', '[ Transcribing with Whisper... ]'); transcribeBlob(blob); }
        mediaRec.stream.getTracks().forEach(function (t) { t.stop(); }); recChunks = [];
    };
    mediaRec.stop();
}

async function transcribeBlob(blob) {
    try {
        var form = new FormData(); form.append('audio', blob, 'recording.webm');
        var res = await fetch('/Robot/Transcribe', { method: 'POST', headers: { 'RequestVerificationToken': getCsrf() }, body: form });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Transcription failed ' + res.status);
        addMsg('system', '[ Transcript ]'); addMsg('aria', data.transcript);
        var ta = document.createElement('a');
        ta.href = URL.createObjectURL(new Blob([data.transcript], { type: 'text/plain' }));
        ta.download = 'ARIA-Transcript-' + new Date().toISOString().slice(0, 10) + '.txt';
        document.body.appendChild(ta);

        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            window.open(ta.href, '_blank');
        } else {
            ta.click();
        }

        document.body.removeChild(ta);
    } catch (err) { addMsg('system', '\u26A0 Transcription error: ' + err.message); }
}