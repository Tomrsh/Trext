// scripts/chats.js
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
const storage = firebase.storage();
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
let callTimeoutTimer = null; // New variable to store the timer
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
    const callKey = callRef.key;
    callRef.set(callData)
        .then(() => {
            callRingtone.play();
            // Start the timer
            callTimeoutTimer = setTimeout(() => {
                callRingtone.pause();
                callRingtone.currentTime = 0;
                database.ref(`calls/${calleeId}/${callKey}`).remove();
                alert('Call timed out.');
            }, 10000);
            // Listen for receiver's response in `activeCalls` to cancel the timer
            database.ref('activeCalls').orderByChild('calleeId').equalTo(calleeId)
                .on('child_added', (snapshot) => {
                    const activeCall = snapshot.val();
                    if (activeCall.callerId === currentUser.uid) {
                        clearTimeout(callTimeoutTimer);
                        callRingtone.pause();
                        callRingtone.currentTime = 0;
                        // The `on` listener remains active, so a manual `off` is not strictly needed
                        // for this particular logic, but it's good practice.
                        // However, since `child_added` only fires once for new entries, it's fine.
                    }
                });
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
                const callId = snapshot.key;
                window.open(`call.html?callId=${callId}&callerId=${call.callerId}&type=${call.type}`, '_blank');
                database.ref(`calls/${currentUser.uid}/${callId}`).remove();
            } else {
                database.ref(`calls/${currentUser.uid}/${snapshot.key}`).remove();
            }
        }
    });
}
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
        content: content,
        type: type,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}
function uploadFile(file) {
    const storageRef = storage.ref(`shared_files/${currentUser.uid}/${file.name}`);
    const uploadTask = storageRef.put(file);
    uploadTask.on('state_changed', null,
        (error) => {
            console.error('File upload failed:', error);
        },
        () => {
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                sendMessage(downloadURL, 'image');
            });
        }
    );
}
