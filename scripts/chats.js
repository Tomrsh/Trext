/* ================= Firebase Init ================= */
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
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

/* ================= UI Elements ================= */
const friendsList = document.getElementById('friends-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');
const callRingtone = document.getElementById('call-ringtone');

let currentUser;
let currentChatFriendId = null;
let currentChatFriendName = null;
let chatRefListener = null;
let callTimeoutTimer = null;

/* ================= Auth ================= */
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loadFriendsList();
        listenForIncomingCalls();
    } else {
        window.location.href = 'index.html';
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});

/* ================= Friends ================= */
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

/* ================= Calling ================= */
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

/** Caller side: create ringing entry + open call window */
function initiateCall(calleeId, type) {
    const callData = {
        callerId: currentUser.uid,
        callerName: currentUser.displayName || 'Unknown',
        type,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'ringing'
    };

    const callRef = database.ref(`calls/${calleeId}`).push();
    const callKey = callRef.key;

    callRef.set(callData).then(() => {
        // Open call window immediately so offer generate ho sake
        const url = `call.html?friendId=${calleeId}&type=${type}`;
        window.open(url, '_blank', 'noopener,noreferrer');

        // Play local ring until callee accepts
        callRingtone.play();
        callTimeoutTimer = setTimeout(() => {
            callRingtone.pause();
            callRingtone.currentTime = 0;
            database.ref(`calls/${calleeId}/${callKey}`).remove();
            alert('Call timed out.');
        }, 30000);

        // Stop ringing once active call established
        const composite = `${currentUser.uid}_${calleeId}`;
        database.ref('activeCalls')
            .orderByChild('composite')
            .equalTo(composite)
            .limitToFirst(1)
            .on('child_added', () => {
                if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
                callRingtone.pause();
                callRingtone.currentTime = 0;
            });
    });
}

/** Callee side: listen for incoming ringing */
function listenForIncomingCalls() {
    const callsRef = database.ref(`calls/${currentUser.uid}`);
    callsRef.on('child_added', (snapshot) => {
        const call = snapshot.val();
        if (!call) return;

        if (call.status === 'ringing') {
            const callerName = call.callerName || 'Unknown User';
            const callType = call.type === 'video' ? 'Video Call' : 'Voice Call';

            const accept = confirm(`${callerName} is calling you. Accept ${callType}?`);
            const callId = snapshot.key;

            if (accept) {
                const url = `call.html?callId=${callId}&callerId=${call.callerId}&type=${call.type}`;
                window.open(url, '_blank', 'noopener,noreferrer');
            }

            // Remove ringing entry (accept or decline both)
            database.ref(`calls/${currentUser.uid}/${callId}`).remove();
        }
    });
}

/* ================= Messaging ================= */
function loadChatHistory(friendId) {
    if (chatRefListener) {
        chatRefListener.off();
    }
    const chatRoomId = getChatRoomId(currentUser.uid, friendId);
    const chatRef = database.ref(`chat_rooms/${chatRoomId}`);
    chatRefListener = chatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

function getChatRoomId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}-${userId2}` : `${userId2}-${userId1}`;
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (message.senderId === currentUser.uid) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
    }

    if (message.type === 'text') {
        messageDiv.textContent = message.content;
    } else if (message.type === 'image') {
        messageDiv.innerHTML = `<a href="${message.content}" target="_blank"><img src="${message.content}" alt="Shared Image" style="max-width: 200px;"></a>`;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const messageText = messageInput.value.trim();
    if (messageText !== '' && currentChatFriendId) {
        sendMessage(messageText, 'text');
        messageInput.value = '';
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && currentChatFriendId) {
        uploadFile(file);
    }
});

function sendMessage(content, type) {
    const chatRoomId = getChatRoomId(currentUser.uid, currentChatFriendId);
    const newMessageRef = database.ref(`chat_rooms/${chatRoomId}`).push();
    newMessageRef.set({
        senderId: currentUser.uid,
        content,
        type,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function uploadFile(file) {
    const storageRef = storage.ref(`shared_files/${currentUser.uid}/${file.name}`);
    const uploadTask = storageRef.put(file);

    uploadTask.on('state_changed', null,
        (error) => console.error('File upload failed:', error),
        () => {
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                sendMessage(downloadURL, 'image');
            });
        }
    );
}