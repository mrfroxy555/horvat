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

// Inicializálás
let db;
let analytics;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    try { analytics = getAnalytics(app); } catch (e) { }
} catch (error) { console.error("Firebase error", error); }

const loginSection = document.getElementById('login-section');
const votingSection = document.getElementById('voting-section');
const resultsSection = document.getElementById('results-section');
const usernameInput = document.getElementById('username');
const startBtn = document.getElementById('start-btn');
const weekGrid = document.getElementById('week-grid');
const submitVotesBtn = document.getElementById('submit-votes');
const matrixHeader = document.getElementById('matrix-header');
const matrixBody = document.getElementById('matrix-body');
const bestDateCard = document.getElementById('best-date-card');
const nameDisplay = document.getElementById('name-display');

let currentUser = localStorage.getItem('croatia_user') || '';
let userVotes = JSON.parse(localStorage.getItem('croatia_votes')) || {};
let hasVoted = localStorage.getItem('croatia_has_voted') === 'true';

const weeks = [
    "június 15 - 19.", "június 22 - 26.", "június 29 - július 03.",
    "július 06 - 10.", "július 13 - 17.", "július 20 - 24.", "július 27 - 31.",
    "augusztus 03 - 07.", "augusztus 10 - 14.", "augusztus 17 - 21.",
    "augusztus 24 - 28.", "augusztus 31 - szeptember 04."
];

if (currentUser) { showVoting(); }
if (db) setupRealtimeUpdates();

startBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('croatia_user', name);
        showVoting();
    }
});

function showVoting() {
    loginSection.classList.add('hidden');
    votingSection.style.display = 'block';
    nameDisplay.innerText = `Szia, ${currentUser}! Jelöld be, melyik hetek lennének jók neked:`;
    renderWeeks();
    if (hasVoted) resultsSection.style.display = 'block';
}

function renderWeeks() {
    weekGrid.innerHTML = '';
    weeks.forEach(week => {
        const item = document.createElement('div');
        item.className = 'week-item';
        const currentVote = userVotes[week] || null;
        item.innerHTML = `
            <div class="week-info"><span class="week-dates">${week}</span></div>
            <div class="vote-btns">
                <button class="vote-btn yes ${currentVote === 'yes' ? 'active' : ''}" data-week="${week}" data-vote="yes">✅</button>
                <button class="vote-btn no ${currentVote === 'no' ? 'active' : ''}" data-week="${week}" data-vote="no">❌</button>
            </div>`;
        weekGrid.appendChild(item);
    });

    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = (e) => {
            const b = e.target.closest('button');
            const w = b.dataset.week;
            const v = b.dataset.vote;
            userVotes[w] = (userVotes[w] === v) ? null : v;
            localStorage.setItem('croatia_votes', JSON.stringify(userVotes));
            renderWeeks();
        };
    });
}

submitVotesBtn.onclick = async () => {
    if (Object.keys(userVotes).length === 0) return alert('Szavazz!');
    submitVotesBtn.disabled = true;
    try {
        const promises = Object.keys(userVotes).filter(w => userVotes[w]).map(week => {
            return addDoc(collection(db, "votes"), {
                name: currentUser, week: week, vote: userVotes[week], timestamp: new Date()
            });
        });
        await Promise.all(promises);
        hasVoted = true;
        localStorage.setItem('croatia_has_voted', 'true');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { alert('Hiba! Firestore Rules?'); }
    submitVotesBtn.disabled = false;
};

function setupRealtimeUpdates() {
    onSnapshot(query(collection(db, "votes"), orderBy("timestamp", "desc")), (snapshot) => {
        const votes = [];
        snapshot.forEach(doc => votes.push(doc.data()));
        renderMatrix(votes);
    });
}

function renderMatrix(allVotesFromServer) {
    if (!hasVoted || !matrixBody) return;

    // 1. Adatok előkészítése: matrix[hét][név] = szavazat
    const participants = [...new Set(allVotesFromServer.map(v => v.name))];
    const data = {};
    weeks.forEach(w => data[w] = {});
    allVotesFromServer.forEach(v => data[v.week][v.name] = v.vote);

    // 2. Fejléc (Nevek)
    matrixHeader.innerHTML = '<th>Időpont</th>' + participants.map(p => `<th>${p}</th>`).join('');

    // 3. Sorok (Hetek)
    matrixBody.innerHTML = '';
    const weekStats = [];

    weeks.forEach(week => {
        const row = document.createElement('tr');
        let yesCount = 0;
        let cells = `<td>${week}</td>`;

        participants.forEach(p => {
            const v = data[week][p];
            if (v === 'yes') yesCount++;
            cells += `<td class="vote-cell ${v || ''}">${v === 'yes' ? '✅' : (v === 'no' ? '❌' : '-')}</td>`;
        });

        row.innerHTML = cells;
        matrixBody.appendChild(row);
        weekStats.push({ week, yesCount });
    });

    // 4. Legjobb időpont elemzés
    const maxYes = Math.max(...weekStats.map(s => s.yesCount));
    const winners = weekStats.filter(s => s.yesCount === maxYes && maxYes > 0);

    if (winners.length > 0) {
        bestDateCard.classList.remove('hidden');
        bestDateCard.innerHTML = `
            <h3>👑 Legjobb időpontok (${maxYes} szavazat)</h3>
            <p>${winners.map(w => w.week).join('<br>')}</p>
        `;
    }
}
