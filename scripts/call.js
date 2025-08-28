// scripts/call.js
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
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let peerConnection;
let localStream;
let callRef;
let currentUser;
const urlParams = new URLSearchParams(window.location.search);
const incomingCallId = urlParams.get('callId');
const outgoingFriendId = urlParams.get('friendId');
const callType = urlParams.get('type');
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        if (incomingCallId) {
            await startReceiverCall();
        } else if (outgoingFriendId) {
            await startCallerCall();
        }
    } else {
        window.close();
    }
});
async function startCallerCall() {
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
    let iceCandidates = [];
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            iceCandidates.push(event.candidate);
        }
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    // Wait for ICE candidates to be gathered
    await new Promise(resolve => {
        if (peerConnection.iceGatheringState === 'complete') {
            resolve();
        } else {
            peerConnection.onicegatheringstatechange = () => {
                if (peerConnection.iceGatheringState === 'complete') {
                    resolve();
                }
            };
        }
    });
    await callRef.set({
        callerId: currentUser.uid,
        calleeId: outgoingFriendId,
        offer: offer,
        type: callType,
        callerCandidates: iceCandidates
    });
    callRef.child('answer').on('value', async (snapshot) => {
        const answer = snapshot.val();
        if (answer && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });
    callRef.child('calleeCandidates').on('value', (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
            candidates.forEach(candidate => {
                if (candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });
        }
    });
}
async function startReceiverCall() {
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
    callRef = database.ref(`activeCalls/${incomingCallId}`);
    let iceCandidates = [];
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            iceCandidates.push(event.candidate);
        }
    };
    const callData = (await callRef.once('value')).val();
    if (callData) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await new Promise(resolve => {
            if (peerConnection.iceGatheringState === 'complete') {
                resolve();
            } else {
                peerConnection.onicegatheringstatechange = () => {
                    if (peerConnection.iceGatheringState === 'complete') {
                        resolve();
                    }
                };
            }
        });
        await callRef.update({
            answer: answer,
            calleeCandidates: iceCandidates
        });
        const callerCandidates = callData.callerCandidates;
        if (callerCandidates) {
            callerCandidates.forEach(candidate => {
                if (candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });
        }
    }
}
hangupBtn.addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (callRef) callRef.remove();
    window.close();
});
