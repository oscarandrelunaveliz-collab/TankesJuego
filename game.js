// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAw1fQNySKX7PLEV8l5fS0lYcdsY3R4u2Q",
    authDomain: "cybertank-c8f76.firebaseapp.com",
    databaseURL: "https://cybertank-c8f76-default-rtdb.firebaseio.com",
    projectId: "cybertank-c8f76",
    storageBucket: "cybertank-c8f76.firebasestorage.app",
    messagingSenderId: "683667760631",
    appId: "1:683667760631:web:2b822a073d93c4c6917af2",
    measurementId: "G-SP8QSXFTPR"
};
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Estado general de la partida
let juegoTerminado = false;
let mensajeGanador = "";

// --- CONFIGURACIÓN JUGADOR 1 ---
const p1 = {
    x: 80,
    y: 80,
    radio: 18,
    angulo: 0,
    velocidadBase: 1.8,     
    velocidadActual: 1.8,   
    velRotacion: 0.025,     
    direccionGiro: 1,       
    color: '#00ffcc',       
    colorSecundario: '#005544',
    balas: [],
    potenciadores: { velocidad: 0, escudo: 0, rafaga: 0 },
    vidas: 3 
};

// --- CONFIGURACIÓN JUGADOR 2 ---
const p2 = {
    x: 720,
    y: 520,
    radio: 18,
    angulo: Math.PI, 
    velocidadBase: 1.8,     
    velocidadActual: 1.8,   
    velRotacion: 0.025,     
    direccionGiro: 1,       
    color: '#ff00ff',       
    colorSecundario: '#550055',
    balas: [],
    potenciadores: { velocidad: 0, escudo: 0, rafaga: 0 },
    vidas: 3 
};

// --- PAREDES INDESTRUCTIBLES ---
const paredesIndestructibles = [
    { x: 375, y: 120, ancho: 50, alto: 100 }, 
    { x: 375, y: 380, ancho: 50, alto: 100 }, 
    { x: 180, y: 270, ancho: 100, alto: 60 },  
    { x: 520, y: 270, ancho: 100, alto: 60 }   
];

// --- CAJAS MOSTRADAS/MOVIBLES ---
const cajas = [];
const maxCajas = 12; 
const friccion = 0.85; 
let tiempoSiguienteCaja = 500; 

function verificarColisionRectangulos(r1, r2) {
    return r1.x < r2.x + r2.ancho && r1.x + r1.ancho > r2.x &&
           r1.y < r2.y + r2.alto && r1.y + r1.alto > r2.y;
}

function colisionCirculoRectangulo(cx, cy, radio, rx, ry, rAncho, rAlto) {
    let cercanoX = Math.max(rx, Math.min(cx, rx + rAncho));
    let cercanoY = Math.max(ry, Math.min(cy, ry + rAlto));
    let dx = cx - cercanoX;
    let dy = cy - cercanoY;
    return {
        colision: Math.sqrt(dx * dx + dy * dy) < radio,
        cx: cercanoX, cy: cercanoY
    };
}

function crearUnaCaja() {
    let nuevaCaja;
    let posicionValida = false;
    let intentos = 0;
    
    while (!posicionValida && intentos < 50) {
        intentos++;
        nuevaCaja = {
            x: Math.random() * (canvas.width - 240) + 120,
            y: Math.random() * (canvas.height - 240) + 120,
            ancho: 42,
            alto: 42,
            vx: 0, vy: 0  
        };
        
        posicionValida = true;
        for (let pared of paredesIndestructibles) {
            if (verificarColisionRectangulos(nuevaCaja, pared)) {
                posicionValida = false;
                break;
            }
        }
    }
    cajas.push(nuevaCaja);
}

// Generación inicial segura
for (let i = 0; i < 6; i++) { crearUnaCaja(); }

// --- SISTEMA DE POTENCIADORES ---
const tiposPotenciadores = [
    { tipo: 'velocidad', color: '#00ffff', nombre: 'VELOCITY' },
    { tipo: 'escudo', color: '#ffff00', nombre: 'SHIELD' },
    { tipo: 'rafaga', color: '#ff00ff', nombre: 'BURST' }
];
const potenciadoresEnMapa = []; 
let tiempoSiguientePowerUp = 300; 

function spawnPotenciador() {
    const plantilla = tiposPotenciadores[Math.floor(Math.random() * tiposPotenciadores.length)];
    potenciadoresEnMapa.push({
        x: Math.random() * (canvas.width - 180) + 90,
        y: Math.random() * (canvas.height - 180) + 90,
        ancho: 20, alto: 20,
        tipo: plantilla.tipo, color: plantilla.color, nombre: plantilla.nombre
    });
}

// --- TECLADO ---
let p1Presionado = false;
let p2Presionado = false;

window.addEventListener('keydown', e => {
    if (juegoTerminado) {
        if (e.key === 'r' || e.key === 'R') reiniciarJuego();
        return;
    }
    if (e.key === ' ' || e.code === 'Space') { if (!p1Presionado) { p1Presionado = true; disparar(p1); } }
    if (e.key === 'Enter') { if (!p2Presionado) { p2Presionado = true; disparar(p2); } }
});

window.addEventListener('keyup', e => {
    if (e.key === ' ' || e.code === 'Space') { p1Presionado = false; p1.direccionGiro *= -1; }
    if (e.key === 'Enter') { p2Presionado = false; p2.direccionGiro *= -1; }
});

function disparoNormal(jugador, ang) {
    jugador.balas.push({
        x: jugador.x + Math.cos(ang) * jugador.radio,
        y: jugador.y + Math.sin(ang) * jugador.radio,
        vx: Math.cos(ang) * 6, 
        vy: Math.sin(ang) * 6,
        radio: 3
    });
}

function disparar(jugador) {
    if (jugador.potenciadores.rafaga > 0) {
        const angulos = [jugador.angulo - 0.2, jugador.angulo, jugador.angulo + 0.2];
        angulos.forEach(ang => disparoNormal(jugador, ang));
    } else {
        disparoNormal(jugador, jugador.angulo);
    }
}

// --- FÍSICAS ---
function procesarFisicasTanque(jugador) {
    for (let pared of paredesIndestructibles) {
        let resultado = colisionCirculoRectangulo(jugador.x, jugador.y, jugador.radio, pared.x, pared.y, pared.ancho, pared.alto);
        if (resultado.colision) {
            let anguloChoque = Math.atan2(resultado.cy - jugador.y, resultado.cx - jugador.x);
            let dx = jugador.x - resultado.cx;
            let dy = jugador.y - resultado.cy;
            let distancia = Math.sqrt(dx * dx + dy * dy);
            jugador.x -= Math.cos(anguloChoque) * (jugador.radio - distancia);
            jugador.y -= Math.sin(anguloChoque) * (jugador.radio - distancia);
        }
    }

    let estaEmpujando = false;
    for (let i = cajas.length - 1; i >= 0; i--) {
        let caja = cajas[i];
        let resultado = colisionCirculoRectangulo(jugador.x, jugador.y, jugador.radio, caja.x, caja.y, caja.ancho, caja.alto);

        if (resultado.colision) {
            if (jugador.potenciadores.escudo > 0) {
                cajas.splice(i, 1); 
                continue;
            }
            estaEmpujando = true; 
            let anguloChoque = Math.atan2(resultado.cy - jugador.y, resultado.cx - jugador.x);
            let dx = jugador.x - resultado.cx;
            let dy = jugador.y - resultado.cy;
            let distancia = Math.sqrt(dx * dx + dy * dy);

            caja.vx += Math.cos(anguloChoque) * jugador.velocidadActual * 0.5;
            caja.vy += Math.sin(anguloChoque) * jugador.velocidadActual * 0.5;
            jugador.x -= Math.cos(anguloChoque) * (jugador.radio - distancia);
            jugador.y -= Math.sin(anguloChoque) * (jugador.radio - distancia);
        }
    }

    let modVelocidad = jugador.velocidadBase;
    if (jugador.potenciadores.velocidad > 0) modVelocidad *= 1.8; 
    jugador.velocidadActual = estaEmpujando ? modVelocidad * 0.45 : modVelocidad;
}

function resolverChoqueEntreTanques() {
    let dx = p2.x - p1.x; let dy = p2.y - p1.y;
    let distancia = Math.sqrt(dx * dx + dy * dy);
    let sumaRadios = p1.radio + p2.radio;

    if (distancia < sumaRadios) {
        let angulo = Math.atan2(dy, dx);
        let overlap = sumaRadios - distancia;
        p1.x -= Math.cos(angulo) * (overlap / 2); p1.y -= Math.sin(angulo) * (overlap / 2);
        p2.x += Math.cos(angulo) * (overlap / 2); p2.y += Math.sin(angulo) * (overlap / 2);
    }
}

// CORREGIDO: Lógica de impacto limpia y sin variables indefinidas
function verificarImpactoBalas(jugador, enemigo, esEnemigoP2) {
    for (let i = jugador.balas.length - 1; i >= 0; i--) {
        let b = jugador.balas[i];
        b.x += b.vx; b.y += b.vy;

        // Choque con Paredes
        for (let pared of paredesIndestructibles) {
            if (colisionCirculoRectangulo(b.x, b.y, b.radio, pared.x, pared.y, pared.ancho, pared.alto).colision) {
                jugador.balas.splice(i, 1);
                break;
            }
        }
        if (!jugador.balas[i]) continue;

        // Choque con Cajas
        let golpeoCaja = false;
        for (let caja of cajas) {
            if (colisionCirculoRectangulo(b.x, b.y, b.radio, caja.x, caja.y, caja.ancho, caja.alto).colision) {
                jugador.balas.splice(i, 1);
                golpeoCaja = true;
                break;
            }
        }
        if (golpeoCaja) continue;

        // Choque con Enemigo
        let distEnemigo = Math.sqrt((b.x - enemigo.x)**2 + (b.y - enemigo.y)**2);
        if (distEnemigo < b.radio + enemigo.radio) {
            jugador.balas.splice(i, 1);
            
            if (enemigo.potenciadores.escudo > 0) {
                enemigo.potenciadores.escudo = 0;
            } else {
                enemigo.vidas--;
                enemigo.potenciadores = { velocidad: 0, escudo: 0, rafaga: 0 };
                
                if (enemigo.vidas <= 0) {
                    juegoTerminado = true;
                    mensajeGanador = esEnemigoP2 ? "¡GANÓ EL JUGADOR 1!" : "¡GANÓ EL JUGADOR 2!";
                } else {
                    // Respawn coordinado según quién sea el enemigo
                    if (esEnemigoP2) {
                        enemigo.x = 720; enemigo.y = 520; enemigo.angulo = Math.PI;
                    } else {
                        enemigo.x = 80; enemigo.y = 80; enemigo.angulo = 0;
                    }
                }
            }
            continue;
        }

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            jugador.balas.splice(i, 1);
        }
    }
}

function actualizarFiltroPowerUps(jugador) {
    if (jugador.potenciadores.velocidad > 0) jugador.potenciadores.velocidad--;
    if (jugador.potenciadores.escudo > 0) jugador.potenciadores.escudo--;
    if (jugador.potenciadores.rafaga > 0) jugador.potenciadores.rafaga--;

    for (let i = potenciadoresEnMapa.length - 1; i >= 0; i--) {
        let pw = potenciadoresEnMapa[i];
        if (colisionCirculoRectangulo(jugador.x, jugador.y, jugador.radio, pw.x, pw.y, pw.ancho, pw.alto).colision) {
            jugador.potenciadores[pw.tipo] = 720; 
            potenciadoresEnMapa.splice(i, 1);
        }
    }
}

function reiniciarJuego() {
    p1.vidas = 3; p1.x = 80; p1.y = 80; p1.angulo = 0; p1.balas = [];
    p2.vidas = 3; p2.x = 720; p2.y = 520; p2.angulo = Math.PI; p2.balas = [];
    cajas.length = 0;
    for (let i = 0; i < 6; i++) { crearUnaCaja(); }
    potenciadoresEnMapa.length = 0;
    juegoTerminado = false;
}

// --- ACTUALIZACIÓN PRINCIPAL ---
function actualizar() {
    if (juegoTerminado) return;

    actualizarFiltroPowerUps(p1);
    actualizarFiltroPowerUps(p2);

    tiempoSiguienteCaja--;
    if (tiempoSiguienteCaja <= 0) {
        if (cajas.length < maxCajas) crearUnaCaja();
        tiempoSiguienteCaja = 500 + Math.random() * 200; 
    }

    tiempoSiguientePowerUp--;
    if (tiempoSiguientePowerUp <= 0) {
        spawnPotenciador();
        tiempoSiguientePowerUp = 400 + Math.random() * 200; 
    }

    if (p1Presionado) {
        p1.x += Math.cos(p1.angulo) * p1.velocidadActual; p1.y += Math.sin(p1.angulo) * p1.velocidadActual;
        if (p1.potenciadores.rafaga > 0 && Math.random() < 0.08) disparar(p1);
    } else { p1.angulo += p1.velRotacion * p1.direccionGiro; }

    if (p2Presionado) {
        p2.x += Math.cos(p2.angulo) * p2.velocidadActual; p2.y += Math.sin(p2.angulo) * p2.velocidadActual;
        if (p2.potenciadores.rafaga > 0 && Math.random() < 0.08) disparar(p2);
    } else { p2.angulo += p2.velRotacion * p2.direccionGiro; }

    [p1, p2].forEach(p => {
        if (p.x < p.radio) p.x = p.radio; if (p.x > canvas.width - p.radio) p.x = canvas.width - p.radio;
        if (p.y < p.radio) p.y = p.radio; if (p.y > canvas.height - p.radio) p.y = canvas.height - p.radio;
    });

    procesarFisicasTanque(p1);
    procesarFisicasTanque(p2);
    resolverChoqueEntreTanques();

    cajas.forEach(caja => {
        caja.x += caja.vx; caja.y += caja.vy;
        caja.vx *= friccion; caja.vy *= friccion;

        for (let pared of paredesIndestructibles) {
            if (verificarColisionRectangulos(caja, pared)) {
                let overlapX = Math.min(caja.x + caja.ancho, pared.x + pared.ancho) - Math.max(caja.x, pared.x);
                let overlapY = Math.min(caja.y + caja.alto, pared.y + pared.alto) - Math.max(caja.y, pared.y);
                if (overlapX < overlapY) {
                    caja.x += (caja.x < pared.x) ? -overlapX : overlapX;
                    caja.vx *= -0.4;
                } else {
                    caja.y += (caja.y < pared.y) ? -overlapY : overlapY;
                    caja.vy *= -0.4;
                }
            }
        }

        if (caja.x < 0) { caja.x = 0; caja.vx *= -0.3; }
        if (caja.x > canvas.width - caja.ancho) { caja.x = canvas.width - caja.ancho; caja.vx *= -0.3; }
        if (caja.y < 0) { caja.y = 0; caja.vy *= -0.3; }
        if (caja.y > canvas.height - caja.alto) { caja.y = canvas.height - caja.alto; caja.vy *= -0.3; }
    });

    for (let i = 0; i < cajas.length; i++) {
        for (let j = i + 1; j < cajas.length; j++) {
            let c1 = cajas[i]; let c2 = cajas[j];
            if (verificarColisionRectangulos(c1, c2)) {
                let overlapX = Math.min(c1.x + c1.ancho, c2.x + c2.ancho) - Math.max(c1.x, c2.x);
                let overlapY = Math.min(c1.y + c1.alto, c2.y + c2.alto) - Math.max(c1.y, c2.y);
                if (overlapX < overlapY) {
                    if (c1.x < c2.x) { c1.x -= overlapX / 2; c2.x += overlapX / 2; }
                    else { c1.x += overlapX / 2; c2.x -= overlapX / 2; }
                    let tempVx = c1.vx; c1.vx = c2.vx * 0.6; c2.vx = tempVx * 0.6;
                } else {
                    if (c1.y < c2.y) { c1.y -= overlapY / 2; c2.y += overlapY / 2; }
                    else { c1.y += overlapY / 2; c2.y -= overlapY / 2; }
                    let tempVy = c1.vy; c1.vy = c2.vy * 0.6; c2.vy = tempVy * 0.6;
                }
            }
        }
    }

    verificarImpactoBalas(p1, p2, true);  // esEnemigoP2 = true
    verificarImpactoBalas(p2, p1, false); // esEnemigoP2 = false
}

// --- RENDERIZADO ---
function dibujarTanque(jugador) {
    ctx.save();
    ctx.translate(jugador.x, jugador.y); ctx.rotate(jugador.angulo);

    if (jugador.potenciadores.escudo > 0) {
        ctx.shadowBlur = 15; ctx.shadowColor = '#ffff00';
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, jugador.radio + 8, 0, Math.PI * 2); ctx.stroke();
    }

    let colorTanque = jugador.color;
    if (jugador.potenciadores.velocidad > 0) colorTanque = '#00ffff';
    if (jugador.potenciadores.rafaga > 0) colorTanque = '#ff00ff';

    ctx.shadowBlur = 10; ctx.shadowColor = colorTanque;
    ctx.fillStyle = jugador.colorSecundario;
    ctx.fillRect(-20, -18, 40, 5); ctx.fillRect(-20, 13, 40, 5);
    ctx.fillStyle = colorTanque; ctx.fillRect(-15, -13, 30, 26);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -3, 25, 6);
    ctx.restore();
}

function dibujarHUD() {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`P1 VIDAS: ${'❤️'.repeat(p1.vidas)}`, 20, 30);
    
    ctx.textAlign = 'right';
    ctx.fillText(`P2 VIDAS: ${'❤️'.repeat(p2.vidas)}`, canvas.width - 20, 30);
}

function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo grid
    ctx.strokeStyle = '#12192c'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Paredes Indestructibles
    paredesIndestructibles.forEach(pared => {
        ctx.fillStyle = '#22324d'; 
        ctx.fillRect(pared.x, pared.y, pared.ancho, pared.alto);
        ctx.strokeStyle = '#00ffcc'; 
        ctx.lineWidth = 2;
        ctx.strokeRect(pared.x, pared.y, pared.ancho, pared.alto);
        ctx.fillStyle = '#111a2e';
        ctx.fillRect(pared.x + 5, pared.y + 5, pared.ancho - 10, pared.alto - 10);
    });

    // Cajas Normales
    cajas.forEach(caja => {
        ctx.fillStyle = '#162238'; ctx.fillRect(caja.x, caja.y, caja.ancho, caja.alto);
        ctx.strokeStyle = '#0055ff'; ctx.lineWidth = 2; ctx.strokeRect(caja.x, caja.y, caja.ancho, caja.alto);
        ctx.strokeStyle = '#1f355a'; ctx.beginPath();
        ctx.moveTo(caja.x + 5, caja.y + 5); ctx.lineTo(caja.x + caja.ancho - 5, caja.y + caja.alto - 5);
        ctx.stroke();
    });

    // Power-ups
    potenciadoresEnMapa.forEach(pw => {
        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = pw.color;
        ctx.fillStyle = '#0a101d'; ctx.fillRect(pw.x, pw.y, pw.ancho, pw.alto);
        ctx.strokeStyle = pw.color; ctx.lineWidth = 2; ctx.strokeRect(pw.x, pw.y, pw.ancho, pw.alto);
        ctx.fillStyle = pw.color; ctx.fillRect(pw.x + 5, pw.y + 5, 10, 10);
        ctx.fillStyle = '#ffffff'; ctx.font = '10px Share Tech Mono'; ctx.textAlign = 'center';
        ctx.fillText(pw.nombre, pw.x + 10, pw.y - 8);
        ctx.restore();
    });

    // Balas
    ctx.shadowColor = '#ffff00'; ctx.fillStyle = '#ffff00';
    [p1, p2].forEach(p => {
        p.balas.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.radio, 0, Math.PI * 2); ctx.fill(); });
    });

    // Tanques
    dibujarTanque(p1);
    dibujarTanque(p2);
    
    // Interfaz
    ctx.shadowBlur = 0;
    dibujarHUD();

    // Game Over
    if (juegoTerminado) {
        ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0055';
        ctx.font = '42px Share Tech Mono';
        ctx.textAlign = 'center';
        ctx.fillText(mensajeGanador, canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Share Tech Mono';
        ctx.fillText("PRESIONA 'R' PARA REINICIAR", canvas.width / 2, canvas.height / 2 + 30);
    }
}

function gameLoop() {
    actualizar();
    dibujar();
    requestAnimationFrame(gameLoop);
}

gameLoop();
// --- CONFIGURACIÓN DE BOTONES TÁCTILES PARA CELULAR ---

// Obtener los botones por su ID
const botonJ1 = document.getElementById('btnTouchP1');
const botonJ2 = document.getElementById('btnTouchP2');

// Verificar que los botones existan en tu HTML antes de asignarles funciones
if (botonJ1 && botonJ2) {

    // --- ACCIONES PARA EL JUGADOR 1 (BOTÓN CIAN) ---
    botonJ1.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Evita zoom o comportamientos raros del celular
        if (!juegoTerminado) {
            if (!p1Presionado) { p1Presionado = true; disparar(p1); }
        } else {
            reiniciarJuego(); // Si el juego terminó, sirve para reiniciar
        }
    });
    
    botonJ1.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!juegoTerminado) {
            p1Presionado = false; 
            p1.direccionGiro *= -1;
        }
    });


    // --- ACCIONES PARA EL JUGADOR 2 (BOTÓN MAGENTA) ---
    botonJ2.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!juegoTerminado) {
            if (!p2Presionado) { p2Presionado = true; disparar(p2); }
        } else {
            reiniciarJuego(); // Si el juego terminó, sirve para reiniciar
        }
    });
    
    botonJ2.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!juegoTerminado) {
            p2Presionado = false; 
            p2.direccionGiro *= -1;
        }
    });
}
