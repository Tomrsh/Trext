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
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const hangupBtn = document.getElementById('hangup-btn');
const urlParams = new URLSearchParams(window.location.search);
const callType = urlParams.get('type');
const friendId = urlParams.get('friendId');
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let peerConnection;
let localStream;
let callRef;
let currentUser;
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        startCall();
    } else {
        window.close();
    }
});
async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
    });
    localVideo.srcObject = localStream;
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
    callRef = database.ref('activeCalls').push();
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child('ice-candidates').push(event.candidate);
        }
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await callRef.set({
        callerId: currentUser.uid,
        calleeId: friendId,
        offer: offer,
        type: callType
    });
    database.ref(`activeCalls/${callRef.key}`).on('value', async (snapshot) => {
        const data = snapshot.val();
        if (data && data.answer && !peerConnection.currentRemoteDescription) {
            const answer = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(answer);
        }
    });
    database.ref(`activeCalls/${callRef.key}/ice-candidates`).on('child_added', (snapshot) => {
        if (snapshot.val()) {
            const candidate = new RTCIceCandidate(snapshot.val());
            peerConnection.addIceCandidate(candidate);
        }
    });
}
hangupBtn.addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (callRef) callRef.remove();
    window.close();
});
