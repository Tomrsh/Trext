// scripts/calls.js
const firebaseConfig = {
    apiKey: "AIzaSyBAyx04GN-5MsBSztE2TQ4zViMs81iCFI8",
    authDomain: "trext-91b51.firebaseapp.com",
    databaseURL: "https://trext-91b51-default-rtdb.firebaseio.com",
    projectId: "trext-91b51",
    storageBucket: "trext-91b51.firebasestorage.app",
    messagingSenderId: "396150208973",
    appId: "1:396150208973:web:1e6ca3f5ce9fed7a5cec84",
    measurementId: "G-VVVKCLZYEE"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();

const callHistoryList = document.getElementById('call-history-list');
const logoutBtn = document.getElementById('logout-btn');

let currentUser;

// User authentication check
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        listenForCallHistory();
    } else {
        window.location.href = 'index.html';
    }
});

// Logout functionality
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout failed:', error);
    });
});

// Listen for the call history for the current user
function listenForCallHistory() {
    const callsRef = database.ref(`calls/${currentUser.uid}`);
    
    // 'child_added' listener is more efficient for chat/call logs
    callsRef.on('child_added', (snapshot) => {
        const call = snapshot.val();
        displayCallEntry(call);
    });
}

// Display a single call entry
function displayCallEntry(call) {
    const li = document.createElement('li');
    li.classList.add('call-entry');

    // Get the other user's username
    database.ref(`users/${call.participantId}`).once('value', (snapshot) => {
        const participant = snapshot.val();
        
        let status = '';
        if (call.callerId === currentUser.uid) {
            // Current user is the caller
            status = 'Outgoing';
        } else {
            // Current user is the receiver
            status = 'Incoming';
        }

        const formattedDate = new Date(call.timestamp).toLocaleString();
        
        li.innerHTML = `
            <span>${participant.username}</span>
            <span class="call-type">${call.type}</span>
            <span class="call-status">${status}</span>
            <span class="call-date">${formattedDate}</span>
        `;
        
        // Add the new call entry to the beginning of the list
        if (callHistoryList.firstChild) {
            callHistoryList.insertBefore(li, callHistoryList.firstChild);
        } else {
            callHistoryList.appendChild(li);
        }
    });
}
