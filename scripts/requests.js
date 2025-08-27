// scripts/requests.js
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

const followRequestsList = document.getElementById('follow-requests-list');
const logoutBtn = document.getElementById('logout-btn');

let currentUser;

// Check user login status
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        listenForFollowRequests();
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

// Listen for follow requests for the current user
function listenForFollowRequests() {
    const requestsRef = database.ref(`followRequests/${currentUser.uid}`);
    
    // Use 'value' listener to get real-time updates
    requestsRef.on('value', (snapshot) => {
        followRequestsList.innerHTML = ''; // Clear previous requests
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const senderId = childSnapshot.key;
                const request = childSnapshot.val();

                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${request.senderUsername} wants to follow you.</span>
                    <button class="accept-btn" data-sender-id="${senderId}">Accept</button>
                    <button class="delete-btn" data-sender-id="${senderId}">Delete</button>
                `;
                followRequestsList.appendChild(li);
            });
        } else {
            followRequestsList.innerHTML = '<li>No new follow requests.</li>';
        }
    });
}

// Handle accept and delete button clicks
followRequestsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('accept-btn')) {
        const senderId = e.target.dataset.senderId;
        acceptRequest(senderId);
    } else if (e.target.classList.contains('delete-btn')) {
        const senderId = e.target.dataset.senderId;
        deleteRequest(senderId);
    }
});

function acceptRequest(senderId) {
    // 1. Add both users to each other's friends/followers list
    const updates = {};
    updates[`friends/${currentUser.uid}/${senderId}`] = true;
    updates[`friends/${senderId}/${currentUser.uid}`] = true;
    
    // 2. Delete the request from the database
    updates[`followRequests/${currentUser.uid}/${senderId}`] = null;

    database.ref().update(updates)
        .then(() => {
            console.log('Request accepted and friends added!');
        })
        .catch((error) => {
            console.error('Error accepting request:', error);
        });
}

function deleteRequest(senderId) {
    database.ref(`followRequests/${currentUser.uid}/${senderId}`).remove()
        .then(() => {
            console.log('Request deleted!');
        })
        .catch((error) => {
            console.error('Error deleting request:', error);
        });
}
