// scripts/chats.js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    databaseURL: "YOUR_DATABASE_URL",
    storageBucket: "YOUR_STORAGE_BUCKET_URL"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();
const friendsList = document.getElementById('friends-list');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');
let currentUser;
let currentChatFriendId = null;
let currentChatFriendName = null;
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loadFriendsList();
        listenForIncomingCalls(); // <-- Naya function
    } else {
        window.location.href = 'index.html';
    }
});
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});
function loadFriendsList() {
    const friendsRef = database.ref(`friends/${currentUser.uid}`);
    friendsRef.on('value', (snapshot) => {
        friendsList.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const friendId = childSnapshot.key;
                database.ref(`users/${friendId}`).once('value', (userSnapshot) => {
                    const friend = userSnapshot.val();
                    const li = document.createElement('li');
                    li.classList.add('friend-item');
                    li.textContent = friend.username;
                    li.dataset.friendId = friendId;
                    friendsList.appendChild(li);
                });
            });
        } else {
            friendsList.innerHTML = '<li>No friends found.</li>';
        }
    });
}
friendsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('friend-item')) {
        currentChatFriendId = e.target.dataset.friendId;
        currentChatFriendName = e.target.textContent;
        document.getElementById('chat-friend-name').textContent = currentChatFriendName;
        document.getElementById('call-btn').style.display = 'inline-block';
        document.getElementById('video-call-btn').style.display = 'inline-block';
        messagesContainer.innerHTML = '';
        loadChatHistory(currentChatFriendId);
    }
});
document.getElementById('call-btn').addEventListener('click', () => {
    if (currentChatFriendId) {
        initiateCall(currentChatFriendId, 'voice');
    }
});
document.getElementById('video-call-btn').addEventListener('click', () => {
    if (currentChatFriendId) {
        initiateCall(currentChatFriendId, 'video');
    }
});
function initiateCall(calleeId, type) {
    const callData = {
        callerId: currentUser.uid,
        callerName: currentUser.displayName,
        type: type,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'ringing'
    };
    const callRef = database.ref(`calls/${calleeId}`).push();
    callRef.set(callData)
        .then(() => {
            alert(`Calling ${currentChatFriendName}...`);
            setTimeout(() => {
                database.ref(`calls/${calleeId}/${callRef.key}`).remove();
                alert('Call timed out.');
            }, 15000); // 15-second timeout
        });
}
function listenForIncomingCalls() {
    const callsRef = database.ref(`calls/${currentUser.uid}`);
    callsRef.on('child_added', (snapshot) => {
        const call = snapshot.val();
        if (call.status === 'ringing') {
            const callerName = call.callerName || 'Unknown User';
            const callType = call.type === 'video' ? 'Video Call' : 'Voice Call';
            if (confirm(`${callerName} is calling you. Do you want to receive the ${callType}?`)) {
                // If user accepts, open the call page with appropriate parameters
                window.open(`call.html?callId=${snapshot.key}&callerId=${call.callerId}&type=${call.type}`, '_blank');
                // Remove the call from the database after a small delay
                database.ref(`calls/${currentUser.uid}/${snapshot.key}`).remove();
            } else {
                // User dismissed the call, remove it from the database
                database.ref(`calls/${currentUser.uid}/${snapshot.key}`).remove();
            }
        }
    });
}
// Other functions for chat, file sharing remain the same
// ... (Your existing code for getChatRoomId, displayMessage, sendMessage, uploadFile) ...
