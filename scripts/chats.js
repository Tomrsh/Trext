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
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');

let currentUser;
let currentChatFriendId = null;
let currentChatFriendName = null;

// User authentication check
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loadFriendsList();
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

// Load the list of friends for the current user
function loadFriendsList() {
    const friendsRef = database.ref(`friends/${currentUser.uid}`);
    friendsRef.on('value', (snapshot) => {
        friendsList.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const friendId = childSnapshot.key;
                
                // Get friend's username from 'users' node
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

// Handle friend selection to start a chat
friendsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('friend-item')) {
        currentChatFriendId = e.target.dataset.friendId;
        currentChatFriendName = e.target.textContent;
        chatHeader.innerHTML = `<span>${currentChatFriendName}</span><button id="call-btn">Call</button><button id="video-call-btn">Video Call</button>`;
        messagesContainer.innerHTML = ''; // Clear previous messages
        loadChatHistory(currentChatFriendId);
    }
});

// Load chat history
function loadChatHistory(friendId) {
    const chatRoomId = getChatRoomId(currentUser.uid, friendId);
    const chatRef = database.ref(`chat_rooms/${chatRoomId}`);

    chatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

// Get a unique chat room ID for two users
function getChatRoomId(userId1, userId2) {
    // Sort IDs to create a unique and consistent chat room ID
    return userId1 < userId2 ? `${userId1}-${userId2}` : `${userId2}-${userId1}`;
}

// Display a single message in the UI
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    // Determine if the message is sent by the current user
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
    // You can add more file types here (e.g., audio, video)

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto-scroll to the bottom
}

// Handle sending a message
sendBtn.addEventListener('click', () => {
    const messageText = messageInput.value.trim();
    if (messageText !== '' && currentChatFriendId) {
        sendMessage(messageText, 'text');
        messageInput.value = '';
    }
});

// Handle file sharing
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && currentChatFriendId) {
        uploadFile(file);
    }
});

// Main function to send a message
function sendMessage(content, type) {
    const chatRoomId = getChatRoomId(currentUser.uid, currentChatFriendId);
    const newMessageRef = database.ref(`chat_rooms/${chatRoomId}`).push();

    newMessageRef.set({
        senderId: currentUser.uid,
        content: content,
        type: type,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch((error) => {
        console.error('Error sending message:', error);
    });
}

// Upload a file to Firebase Storage
function uploadFile(file) {
    const storageRef = storage.ref(`shared_files/${currentUser.uid}/${file.name}`);
    const uploadTask = storageRef.put(file);

    uploadTask.on('state_changed', 
        (snapshot) => {
            // Can be used to show upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        }, 
        (error) => {
            console.error('File upload failed:', error);
        }, 
        () => {
            // On successful upload, get the download URL
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                sendMessage(downloadURL, 'image'); // Send the URL as a message
            });
        }
    );
}
