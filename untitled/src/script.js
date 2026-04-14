let scene, camera, renderer, controls, earth, stars, starGeo;
let imagesData = [];
let orbitingItems = [];
let isWarping = false;
let focusedItem = null;
let pointerDownX = 0; 
let pointerDownY = 0;

// متغيرات زوار الباركود
let sharedPlanet = 'earth';
let sharedStartPhrase = '';
let sharedTexts = [];

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // إذا كان الزائر قادماً من رابط أو باركود
    if(urlParams.has('view')) {
        document.getElementById('ui-container').style.display = 'none';
        sharedPlanet = urlParams.get('planet') || 'earth';
        sharedStartPhrase = urlParams.get('start') || '';
        const rawText = urlParams.get('text') || '';
        sharedTexts = rawText.split('|').filter(s => s.trim() !== "");
        
        document.getElementById('space-audio').src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";
        setupSpace(sharedTexts, [], sharedPlanet);
        startWarpEffect(sharedStartPhrase);
    } else {
        initBuilderUI();
    }
});

function initBuilderUI() {
    // تحديث أزرار الملفات
    const imgInput = document.getElementById('userImages');
    if(imgInput) {
        imgInput.addEventListener('change', function(e) {
            const count = e.target.files.length;
            const label = document.getElementById('file-count');
            label.innerText = count > 0 ? `✅ ${count} صور` : "📸 رفع الصور";
            label.style.borderColor = count > 0 ? "#ff69b4" : "rgba(255,105,180,0.6)";
            label.style.color = count > 0 ? "#ff69b4" : "white";
        });
    }

    const musicInput = document.getElementById('userMusic');
    if(musicInput) {
        musicInput.addEventListener('change', function(e) {
            const label = document.getElementById('music-count');
            if(e.target.files.length > 0) {
                label.innerText = `✅ تم اختيار المقطع`;
                label.style.borderColor = "#00d2ff"; label.style.color = "#00d2ff";
            } else {
                label.innerText = "🎵 موسيقى مخصصة";
                label.style.borderColor = "rgba(255,105,180,0.6)"; label.style.color = "white";
            }
        });
    }

    // زر الباركود
    document.getElementById('qrBtn').addEventListener('click', () => {
        const qrContainer = document.getElementById('qrcode-container');
        qrContainer.innerHTML = ""; 
        
        let baseUrl = window.location.origin + window.location.pathname;
        if(baseUrl.includes("null") || baseUrl.includes("file://")) {
            baseUrl = "https://your-galaxy.netlify.app/"; // رابط افتراضي للاختبار
        }

        const planet = document.getElementById('planetChoice') ? document.getElementById('planetChoice').value : sharedPlanet;
        const start = document.getElementById('startPhrase') ? document.getElementById('startPhrase').value : sharedStartPhrase;
        let textStr = document.getElementById('userText') ? document.getElementById('userText').value.replace(/\n/g, '|') : sharedTexts.join('|');

        const shareUrl = `${baseUrl}?view=true&planet=${planet}&start=${encodeURIComponent(start)}&text=${encodeURIComponent(textStr)}`;
        document.getElementById('shareUrlInput').value = shareUrl;

        try {
            const qrCode = new QRCodeStyling({
                width: 200, height: 200, type: "svg", data: shareUrl,
                image: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff1493'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/%3E%3C/svg%3E",
                dotsOptions: { type: "rounded", gradient: { type: "linear", rotation: Math.PI / 4, colorStops: [{ offset: 0, color: "#ff69b4" }, { offset: 1, color: "#9400d3" }] } },
                backgroundOptions: { color: "#ffffff" },
                imageOptions: { crossOrigin: "anonymous", margin: 8 },
                cornersSquareOptions: { type: "extra-rounded", color: "#9400d3" },
                cornersDotOptions: { type: "dot", color: "#ff1493" }
            });
            qrCode.append(qrContainer);
        } catch (error) {
            qrContainer.innerHTML = "<p style='color:red;'>حدث خطأ، استخدم الرابط.</p>";
        }
        document.getElementById('qr-modal').style.display = 'flex';
    });

    // زر الانطلاق
    document.getElementById('startBtn').addEventListener('click', async () => {
        const textInput = document.getElementById('userText').value;
        const sentences = textInput.split('\n').filter(s => s.trim() !== "");
        const files = document.getElementById('userImages').files;
        const musicFile = document.getElementById('userMusic').files[0];
        const planetType = document.getElementById('planetChoice').value;
        const startPhrase = document.getElementById('startPhrase').value;

        if (sentences.length === 0 && files.length === 0 && startPhrase === "") {
            alert("الرجاء كتابة رسالة أو رفع صورة للبدء!");
            return;
        }

        const audioEl = document.getElementById('space-audio');
        if (musicFile) audioEl.src = URL.createObjectURL(musicFile);
        else audioEl.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

        imagesData = [];
        for(let f of files) {
            const data = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(f); });
            imagesData.push(data);
        }

        document.getElementById('ui-container').style.opacity = '0';
        document.getElementById('warp-overlay').style.display = 'block';
        
        setTimeout(() => {
            document.getElementById('ui-container').style.display = 'none';
            setupSpace(sentences, imagesData, planetType);
            startWarpEffect(startPhrase);
        }, 1000);
    });

    document.getElementById('music-toggle').addEventListener('click', () => {
        const audio = document.getElementById('space-audio');
        if (audio.paused) audio.play(); else audio.pause();
    });
}

function setupSpace(sentences, images, planetType) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.8; controls.enablePan = false; 

    // النجوم الرومانسية الملونة
    starGeo = new THREE.BufferGeometry();
    let starCoords = []; let starColors = []; const color = new THREE.Color();
    for(let i=0; i<6000; i++) {
        starCoords.push((Math.random()-0.5)*1000, (Math.random()-0.5)*1000, (Math.random()-0.5)*1000);
        color.setHSL(Math.random() * 0.2 + 0.7, 1.0, Math.random() * 0.5 + 0.5);
        starColors.push(color.r, color.g, color.b);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starCoords), 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(starColors), 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.8, vertexColors: true, transparent: true, opacity: 0.8 }));
    scene.add(stars);

    const loader = new THREE.TextureLoader();
    let planetTex = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'; 
    if(planetType === 'mars') planetTex = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';
    else if(planetType === 'moon') planetTex = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg';

    earth = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 64), new THREE.MeshPhongMaterial({ map: loader.load(planetTex) }));
    scene.add(earth);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(5.2, 64, 64), new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.15, side: THREE.BackSide })));
    scene.add(new THREE.AmbientLight(0xffccff, 0.8));
    
    const pointLight = new THREE.PointLight(0xff1493, 1, 100);
    pointLight.position.set(10, 10, 10); scene.add(pointLight);

    const allData = [...sentences.map(s => ({t:'txt', v:s})), ...images.map(i => ({t:'img', v:i}))];
    
    allData.forEach((data) => {
        let mesh;
        if(data.t === 'txt') {
            const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256; const ctx = canvas.getContext('2d');
            ctx.direction = 'rtl'; ctx.font = 'bold 60px Tajawal'; ctx.fillStyle = 'white'; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 20;
            ctx.fillText(data.v, 512, 128);
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), transparent: true}));
        } else {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({map: loader.load(data.v), transparent: true}));
        }

        const r = 12 + Math.random() * 15; const p = Math.random() * Math.PI * 2; const t = Math.acos(2 * Math.random() - 1);
        mesh.position.set(r*Math.sin(t)*Math.cos(p), r*Math.sin(t)*Math.sin(p), r*Math.cos(t));
        mesh.userData = { isMemory: true }; scene.add(mesh);
        orbitingItems.push({mesh, angle: Math.random()*10, speed: 0.002 + Math.random()*0.005});
    });

    camera.position.z = 100; 
    
    // إصلاح مشاكل اللمس (منع التداخل مع الأزرار)
    window.addEventListener('pointerdown', (e) => { 
        pointerDownX = e.clientX; 
        pointerDownY = e.clientY; 
    }, false);
    
    window.addEventListener('pointerup', onDocumentPointerUp, false);
    window.addEventListener('resize', onWindowResize, false);
    
    animate();
}

function startWarpEffect(phrase) {
    isWarping = true;
    new TWEEN.Tween(camera.position).to({ z: 30 }, 2500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            isWarping = false;
            document.getElementById('warp-overlay').style.display = 'none';
            document.getElementById('instruction-hint').style.display = 'block';
            document.getElementById('floating-controls').style.display = 'flex';
            controls.autoRotate = true;

            if (phrase && phrase.trim() !== "") {
                const welcomeOverlay = document.getElementById('welcome-overlay');
                document.getElementById('welcome-text').innerText = phrase;
                welcomeOverlay.style.opacity = '1';
                setTimeout(() => { welcomeOverlay.style.opacity = '0'; }, 4000);
            }
        }).start();
}

function onDocumentPointerUp(event) {
    // حماية: إذا كان اللمس على واجهة مستخدم (زر أو نافذة) تجاهل أمر الـ 3D
    if (isWarping || event.target.closest('.floating-controls') || event.target.closest('#qr-modal')) return; 
    
    const distance = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
    if (distance > 10) return; // تم احتسابه كسحب (Drag) وليس نقرة (Click)

    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1; 
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster(); 
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0 && intersects[0].object.userData.isMemory) {
        const target = intersects[0].object; focusedItem = target;
        controls.autoRotate = false; controls.enabled = false; 
        
        const targetPos = target.position.clone().normalize().multiplyScalar(target.position.length() - 5);
        new TWEEN.Tween(camera.position).to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1000)
            .easing(TWEEN.Easing.Cubic.Out).onComplete(() => { controls.enabled = true; }).start();
    } else {
        controls.enabled = false;
        new TWEEN.Tween(camera.position).to({ x: 0, y: 0, z: 30 }, 1000).onComplete(() => { controls.enabled = true; controls.autoRotate = true; focusedItem = null; }).start();
    }
}

function onWindowResize() {
    if(camera && renderer) { 
        camera.aspect = window.innerWidth / window.innerHeight; 
        camera.updateProjectionMatrix(); 
        renderer.setSize(window.innerWidth, window.innerHeight); 
    }
}

function animate(time) {
    requestAnimationFrame(animate); 
    TWEEN.update(time);
    if(controls && controls.enabled) controls.update(); 

    if(isWarping && stars) { 
        stars.rotation.z += 0.2; stars.scale.set(1, 1, 3); 
    } else if(stars) { 
        stars.rotation.y += 0.0005; stars.scale.set(1, 1, 1); 
    }

    if(earth) earth.rotation.y += 0.001;

    orbitingItems.forEach(item => {
        if (focusedItem !== item.mesh) { 
            item.angle += item.speed; 
            item.mesh.position.y += Math.sin(item.angle) * 0.02; 
        }
        item.mesh.lookAt(camera.position); 
    });

    if(renderer) renderer.render(scene, camera);
}

// دالة النسخ
window.copyShareLink = function() {
    const copyText = document.getElementById("shareUrlInput");
    copyText.select(); 
    copyText.setSelectionRange(0, 99999);
    document.execCommand("copy");
    alert("✅ تم نسخ الرابط!");
};
