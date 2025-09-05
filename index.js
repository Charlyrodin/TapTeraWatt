// ===== TAP TERAWATT CON FIREBASE =====
let gameState = {
    currentUser: null,
    playerTaps: 0,
    dailyTaps: 0,
    dailyLimit: 100000,
    referralTaps: 0,
    autoTaps: 0,
    referrals: [],
    generators: [],
    globalTaps: 0,
    activePlayers: 1
};

const GAME_CONFIG = {
    TAP_VALUE: 1,
    REFERRAL_BONUS: 0.1,
    DAILY_LIMIT: 100000
};

// ===== REGISTRO CON FIREBASE =====
async function register() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const referralCode = document.getElementById('referralCode').value.trim();

    if (!username || !email) {
        alert('Por favor completa todos los campos obligatorios');
        return;
    }

    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '⚡ CONECTANDO...';
    button.disabled = true;

    try {
        // Verificar si username existe
        const usernameQuery = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!usernameQuery.empty) {
            alert('Este nombre de usuario ya está en uso');
            return;
        }

        // Crear usuario en Firebase Auth
        const tempPassword = Math.random().toString(36).substring(2, 15);
        const userCredential = await auth.createUserWithEmailAndPassword(email, tempPassword);
        const user = userCredential.user;

        // Generar código de referido único
        const myReferralCode = await generateUniqueReferralCode(username);

        // Guardar en Firestore
        const userData = {
            uid: user.uid,
            username: username,
            email: email,
            referralCode: myReferralCode,
            referredBy: referralCode || null,
            taps: 0,
            dailyTaps: 0,
            referralTaps: 0,
            autoTaps: 0,
            generators: [],
            joinDate: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(user.uid).set(userData);

        // Procesar referido
        if (referralCode) {
            await processReferralReal(referralCode, user.uid, username);
        }

        // Actualizar stats globales
        await updateGlobalStats('newUser');

        gameState.currentUser = userData;
        setupRealTimeSync(user.uid);
        showGameScreen();
        
        alert(`¡Bienvenido ${username}! Tu código: ${myReferralCode}`);

    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function generateUniqueReferralCode(username) {
    let attempts = 0;
    let code;
    
    do {
        const prefix = username.toUpperCase().substring(0, 3);
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = prefix + suffix;
        attempts++;
        
        const query = await db.collection('users')
            .where('referralCode', '==', code)
            .get();
            
        if (query.empty) break;
        
    } while (attempts < 10);
    
    return code;
}

async function processReferralReal(referralCode, newUserId, newUsername) {
    try {
        const referrerQuery = await db.collection('users')
            .where('referralCode', '==', referralCode)
            .get();

        if (!referrerQuery.empty) {
            const referrerDoc = referrerQuery.docs[0];
            const referrerId = referrerDoc.id;

            await db.collection('referrals').add({
                referrerId: referrerId,
                referredId: newUserId,
                referredUsername: newUsername,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                totalTaps: 0
            });

            await db.collection('users').doc(referrerId).update({
                referralTaps: firebase.firestore.FieldValue.increment(1000)
            });

            console.log('✅ Referido procesado');
        }
    } catch (error) {
        console.error('Error procesando referido:', error);
    }
}

// ===== TIEMPO REAL =====
function setupRealTimeSync(userId) {
    // Sync usuario
    db.collection('users').doc(userId)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                gameState.playerTaps = userData.taps || 0;
                gameState.dailyTaps = userData.dailyTaps || 0;
                gameState.referralTaps = userData.referralTaps || 0;
                updateUI();
            }
        });

    // Sync global
    db.collection('globalStats').doc('main')
        .onSnapshot((doc) => {
            if (doc.exists) {
                const globalData = doc.data();
                gameState.globalTaps = globalData.totalTaps || 0;
                document.getElementById('globalTaps').textContent = gameState.globalTaps.toLocaleString();
                document.getElementById('activePlayers').textContent = globalData.activePlayers || 1;
            }
        });
}

// ===== TAP CON FIREBASE =====
async function tap() {
    if (!gameState.currentUser) return;

    if (gameState.dailyTaps >= gameState.dailyLimit) {
        alert('¡Límite diario alcanzado!');
        return;
    }

    const userId = gameState.currentUser.uid;

    try {
        await db.collection('users').doc(userId).update({
            taps: firebase.firestore.FieldValue.increment(1),
            dailyTaps: firebase.firestore.FieldValue.increment(1),
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });

        await updateGlobalStats('tap', 1);

        addTapAnimation();
        createEnergyParticle();

    } catch (error) {
        console.error('Error tap:', error);
    }
}

async function updateGlobalStats(action, value = 1) {
    const globalRef = db.collection('globalStats').doc('main');
    
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(globalRef);
            
            if (!doc.exists) {
                transaction.set(globalRef, {
                    totalTaps: action === 'tap' ? value : 0,
                    activePlayers: Math.floor(Math.random() * 50) + 10,
                    totalUsers: action === 'newUser' ? 1 : 0,
                    lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const data = doc.data();
                const updates = {
                    activePlayers: Math.floor(Math.random() * 50) + 10,
                    lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (action === 'tap') {
                    updates.totalTaps = (data.totalTaps || 0) + value;
                } else if (action === 'newUser') {
                    updates.totalUsers = (data.totalUsers || 0) + 1;
                }

                transaction.update(globalRef, updates);
            }
        });
    } catch (error) {
        console.error('Error stats:', error);
    }
}

// ===== FUNCIONES UI (mantener las existentes) =====
function showGameScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    updateUI();
    initializeReferralCode();
}

function updateUI() {
    document.getElementById('playerTaps').textContent = gameState.playerTaps.toLocaleString();
    document.getElementById('dailyLimit').textContent = (gameState.dailyLimit - gameState.dailyTaps).toLocaleString();
    document.getElementById('referralTaps').textContent = gameState.referralTaps.toLocaleString();
    document.getElementById('autoTaps').textContent = gameState.autoTaps.toLocaleString();
}

function addTapAnimation() {
    const button = document.getElementById('tapButton');
    button.classList.add('tap-animation');
    setTimeout(() => button.classList.remove('tap-animation'), 300);
}

function createEnergyParticle() {
    const particle = document.createElement('div');
    particle.className = 'energy-particle';
    particle.textContent = '+1 mW';
    
    const button = document.getElementById('tapButton');
    const rect = button.getBoundingClientRect();
    
    particle.style.left = (rect.left + rect.width/2 - 20) + 'px';
    particle.style.top = (rect.top + rect.height/2) + 'px';
    
    document.body.appendChild(particle);
    
    setTimeout(() => {
        if (document.body.contains(particle)) {
            document.body.removeChild(particle);
        }
    }, 1200);
}

function initializeReferralCode() {
    if (gameState.currentUser && gameState.currentUser.referralCode) {
        document.getElementById('myReferralCode').value = gameState.currentUser.referralCode;
    }
}

// ===== SISTEMA DE REFERIDOS =====
function generateAffiliateLink() {
    if (!gameState.currentUser) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}?ref=${gameState.currentUser.referralCode}`;
    
    prompt('Tu link de afiliado:', link);
}

function detectReferralFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        document.getElementById('referralCode').value = refCode;
    }
}

// ===== MODALES (mantener funciones existentes) =====
function showLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
}

function hideLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

function showShop() {
    document.getElementById('shopModal').classList.remove('hidden');
}

function hideShop() {
    document.getElementById('shopModal').classList.add('hidden');
}

function showReferrals() {
    document.getElementById('referralsModal').classList.remove('hidden');
}

function hideReferrals() {
    document.getElementById('referralsModal').classList.add('hidden');
}

function copyReferralCode() {
    const codeInput = document.getElementById('myReferralCode');
    codeInput.select();
    document.execCommand('copy');
    alert('¡Código copiado!');
}

function buyGenerator(type) {
    alert('Demo: Sistema de pagos no implementado aún');
}

// ===== INICIALIZACIÓN =====
function initializeGame() {
    console.log('🎮 Inicializando con Firebase...');
    
    detectReferralFromURL();
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                gameState.currentUser = userDoc.data();
                setupRealTimeSync(user.uid);
                showGameScreen();
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeGame);