// scripts/home.js
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

const userSearchInput = document.getElementById('user-search');
const userList = document.getElementById('user-list');
const logoutBtn = document.getElementById('logout-btn');
const currentUsernameSpan = document.getElementById('current-username');

let currentUser;

// Check if user is logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        currentUsernameSpan.textContent = user.displayName || 'User'; // Display username
    } else {
        // If not logged in, redirect to login page
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

// Search for users
userSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    userList.innerHTML = ''; // Clear previous results

    if (searchTerm.length > 2) {
        // Search users in the database
        database.ref('users').once('value', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                const userId = childSnapshot.key;

                if (userId !== currentUser.uid && user.username.toLowerCase().includes(searchTerm)) {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${user.username}</span>
                        <button class="follow-btn" data-user-id="${userId}">Follow</button>
                    `;
                    userList.appendChild(li);
                }
            });
        });
    }
});

// Handle follow button clicks
userList.addEventListener('click', (e) => {
    if (e.target.classList.contains('follow-btn')) {
        const targetUserId = e.target.dataset.userId;

        // Save a follow request to the database
        database.ref(`followRequests/${targetUserId}/${currentUser.uid}`).set({
            senderUsername: currentUser.displayName,
            timestamp: new Date().toISOString(),
            status: 'pending'
        }).then(() => {
            alert('Follow request sent!');
            e.target.disabled = true;
            e.target.textContent = 'Requested';
        }).catch((error) => {
            console.error('Error sending request:', error);
        });
    }
});
