/** ======== Firebase Init ======== */
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

/** ======== UI ======== */
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const hangupBtn = document.getElementById('hangup-btn');
const muteMicBtn = document.getElementById('mute-mic-btn');
const muteCamBtn = document.getElementById('mute-cam-btn');

/** ======== WebRTC ======== */
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let peerConnection;
let localStream;
let callRef;               // Firebase activeCalls/<id>
let currentUser;
let isMicMuted = false;
let isCamOff = false;

/** ======== URL Params ======== */
const urlParams = new URLSearchParams(window.location.search);
const incomingCallId = urlParams.get('callId');   // present on receiver side
const outgoingFriendId = urlParams.get('friendId'); // present on caller side
const callType = urlParams.get('type') || 'voice';  // 'video' | 'voice'

/** ======== Auth & Start ======== */
auth.onAuthStateChanged(async (user) => {
    if (!user) return window.close();
    currentUser = user;

    try {
        if (incomingCallId) {
            await startReceiverCall();
        } else if (outgoingFriendId) {
            await startCallerCall();
        } else {
            alert('Missing call parameters.');
            window.close();
        }
    } catch (err) {
        console.error(err);
        alert('Call failed to start. Check permissions and internet.');
        cleanupAndClose();
    }
});

/** ======== Caller Flow ======== */
async function startCallerCall() {
    // 1) Media
    localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
    });
    localVideo.srcObject = localStream;

    // 2) Peer
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // 3) Active call entry
    callRef = database.ref('activeCalls').push();
    const composite = `${currentUser.uid}_${outgoingFriendId}`; // used by receiver to find this call

    // 4) ICE: push as they arrive
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child('callerCandidates').push(event.candidate.toJSON());
        }
    };

    // 5) SDP Offer
    const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
    await peerConnection.setLocalDescription(offer);

    // 6) Save offer & meta
    await callRef.set({
        callerId: currentUser.uid,
        calleeId: outgoingFriendId,
        composite,              // searchable
        type: callType,
        offer
    });

    // 7) Listen for answer
    callRef.child('answer').on('value', async (snap) => {
        const answer = snap.val();
        if (answer && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    // 8) Listen for callee ICE candidates
    callRef.child('calleeCandidates').on('child_added', (snap) => {
        const candidate = snap.val();
        if (candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

/** ======== Receiver Flow ======== */
async function startReceiverCall() {
    // 1) Parse who is calling us
    const callerId = urlParams.get('callerId');
    if (!callerId) throw new Error('Missing callerId for incoming call.');

    // 2) Media
    localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
    });
    localVideo.srcObject = localStream;

    // 3) Peer
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // 4) Find caller's active call via composite key
    const composite = `${callerId}_${currentUser.uid}`;
    const snap = await database.ref('activeCalls')
        .orderByChild('composite')
        .equalTo(composite)
        .limitToFirst(1)
        .once('value');

    if (!snap.exists()) throw new Error('Active call not found. Caller may have hung up.');

    const [activeId, callData] = Object.entries(snap.val())[0];
    callRef = database.ref(`activeCalls/${activeId}`);

    // 5) ICE (receiver -> push)
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            callRef.child('calleeCandidates').push(event.candidate.toJSON());
        }
    };

    // 6) Apply remote offer
    if (!callData.offer) throw new Error('Offer missing in active call.');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));

    // 7) Create & save answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await callRef.child('answer').set(answer);

    // 8) Listen for caller ICE candidates (post-connect)
    callRef.child('callerCandidates').on('child_added', (snapChild) => {
        const candidate = snapChild.val();
        if (candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

/** ======== Controls ======== */
hangupBtn.addEventListener('click', cleanupAndClose);

muteMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMicMuted = !isMicMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
    muteMicBtn.textContent = isMicMuted ? 'Unmute' : 'Mute';
});

muteCamBtn.addEventListener('click', () => {
    if (!localStream) return;
    isCamOff = !isCamOff;
    localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
    muteCamBtn.textContent = isCamOff ? 'On Cam' : 'Off Cam';
});

/** ======== Cleanup ======== */
function cleanupAndClose() {
    try {
        if (peerConnection) {
            peerConnection.onicecandidate = null;
            peerConnection.ontrack = null;
            peerConnection.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
        if (callRef) {
            callRef.remove(); // remove activeCalls/<id>
        }
    } catch (e) {
        console.warn('Cleanup error:', e);
    } finally {
        window.close();
    }
}

window.addEventListener('beforeunload', cleanupAndClose);
