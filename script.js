import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// --- Firebase Konfiguráció ---
const firebaseConfig = {
    apiKey: "AIzaSyAzu7yjw-ZyiDo5ISLgvbpmnvlvpPXYwxQ",
    authDomain: "horvat-8054c.firebaseapp.com",
    projectId: "horvat-8054c",
    storageBucket: "horvat-8054c.firebasestorage.app",
    messagingSenderId: "904607004891",
    appId: "1:904607004891:web:d3d1bc2fac32216db7f4fe",
    measurementId: "G-D52EBQRGJG"
};

// Inicializálás biztonsági hálóval
let db;
let analytics;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    // Az Analytics néha blokkolva van (pl. AdBlock), ezért try-catch-be tesszük
    try {
        analytics = getAnalytics(app);
    } catch (e) {
        console.warn("Analytics nem érhető el, de az oldal működik.");
    }
} catch (error) {
    console.error("Firebase hiba:", error);
    alert("Hiba a Firebase betöltésekor! Kérlek frissítsd az oldalt.");
}

// Elemek lekérése
const loginSection = document.getElementById('login-section');
const votingSection = document.getElementById('voting-section');
const resultsSection = document.getElementById('results-section');
const usernameInput = document.getElementById('username');
const startBtn = document.getElementById('start-btn');
const weekGrid = document.getElementById('week-grid');
const submitVotesBtn = document.getElementById('submit-votes');
const resultsBody = document.getElementById('results-body');
const nameDisplay = document.getElementById('name-display');

let currentUser = localStorage.getItem('croatia_user') || '';
let userVotes = JSON.parse(localStorage.getItem('croatia_votes')) || {};
let hasVoted = localStorage.getItem('croatia_has_voted') === 'true';

const weeks = [
    "június 15 - 19.",
    "június 22 - 26.",
    "június 29 - július 03.",
    "július 06 - 10.",
    "július 13 - 17.",
    "július 20 - 24.",
    "július 27 - 31.",
    "augusztus 03 - 07.",
    "augusztus 10 - 14.",
    "augusztus 17 - 21.",
    "augusztus 24 - 28.",
    "augusztus 31 - szeptember 04."
];

// Ha már be van lépve, mutassuk a szavazást
if (currentUser) {
    setTimeout(showVoting, 100);
}

// Valós idejű figyelés elindítása
if (db) setupRealtimeUpdates();

// Belépés gomb
startBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('croatia_user', name);
        showVoting();
    } else {
        alert('Kérlek, írd be a neved!');
    }
});

function showVoting() {
    if (!loginSection || !votingSection) return;
    loginSection.classList.add('hidden');
    votingSection.style.display = 'block';

    if (nameDisplay) {
        nameDisplay.innerText = `Szia, ${currentUser}! Jelöld be, melyik hetek lennének jók neked:`;
    }
    renderWeeks();

    if (hasVoted && resultsSection) {
        resultsSection.style.display = 'block';
    }
}

function renderWeeks() {
    if (!weekGrid) return;
    weekGrid.innerHTML = '';
    weeks.forEach((week) => {
        const item = document.createElement('div');
        item.className = 'week-item';
        const currentVote = userVotes[week] || null;

        item.innerHTML = `
            <div class="week-info">
                <span class="week-dates">${week}</span>
                <span class="week-label">Hétfő - Péntek</span>
            </div>
            <div class="vote-btns">
                <button class="vote-btn yes ${currentVote === 'yes' ? 'active' : ''}" data-week="${week}" data-vote="yes">✅</button>
                <button class="vote-btn no ${currentVote === 'no' ? 'active' : ''}" data-week="${week}" data-vote="no">❌</button>
            </div>
        `;
        weekGrid.appendChild(item);
    });

    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnElem = e.target.closest('button');
            const week = btnElem.dataset.week;
            const vote = btnElem.dataset.vote;
            if (userVotes[week] === vote) {
                delete userVotes[week];
            } else {
                userVotes[week] = vote;
            }
            localStorage.setItem('croatia_votes', JSON.stringify(userVotes));
            renderWeeks();
        });
    });
}

submitVotesBtn.addEventListener('click', async () => {
    if (Object.keys(userVotes).length === 0) {
        alert('Legalább egy időpontra szavazz!');
        return;
    }

    submitVotesBtn.disabled = true;
    submitVotesBtn.innerText = 'Küldés...';

    try {
        const promises = Object.keys(userVotes).map(week => {
            return addDoc(collection(db, "votes"), {
                name: currentUser,
                week: week,
                vote: userVotes[week],
                timestamp: new Date()
            });
        });

        await Promise.all(promises);

        hasVoted = true;
        localStorage.setItem('croatia_has_voted', 'true');
        alert('Szavazat elmentve!');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        console.error("Hiba: ", e);
        alert('Hiba történt. Ellenőrizd a Firestore Rules-t (legyen Test Mode)!');
    } finally {
        submitVotesBtn.disabled = false;
        submitVotesBtn.innerText = 'Szavazatok beküldése';
    }
});

function setupRealtimeUpdates() {
    try {
        const q = query(collection(db, "votes"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            const votesList = [];
            snapshot.forEach((doc) => {
                votesList.push(doc.data());
            });
            renderResults(votesList);
        });
    } catch (e) {
        console.error("Snapshot hiba:", e);
    }
}

function renderResults(votes) {
    if (!hasVoted || !resultsBody) return;
    resultsBody.innerHTML = '';
    votes.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.week}</td>
            <td><strong>${item.name}</strong></td>
            <td><span class="tag ${item.vote}">${item.vote === 'yes' ? 'JÓ' : 'NEM JÓ'}</span></td>
        `;
        resultsBody.appendChild(row);
    });
}
