// scripts/auth.js
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

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const showLoginLink = document.getElementById('show-login');
const showSignupLink = document.getElementById('show-signup');

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.style.display = 'block';
    signupFormContainer.style.display = 'none';
});

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.style.display = 'none';
    signupFormContainer.style.display = 'block';
});

// Handle user sign up
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;
    const username = signupForm['signup-username'].value;

    auth.createUserWithEmailAndPassword(email, password)
        .then((cred) => {
            // Set the user's display name and then save to database
            return cred.user.updateProfile({ displayName: username })
                .then(() => {
                    return database.ref('users/' + cred.user.uid).set({
                        username: username,
                        email: email,
                        status: 'online'
                    });
                });
        })
        .then(() => {
            window.location.href = 'home.html';
        })
        .catch((err) => {
            alert(err.message);
        });
});

// Handle user login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    auth.signInWithEmailAndPassword(email, password)
        .then((cred) => {
            window.location.href = 'home.html';
        })
        .catch((err) => {
            alert(err.message);
        });
});
