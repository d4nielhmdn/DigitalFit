// Function to get user profile from localStorage
function getUserProfile(username) {
    const profile = localStorage.getItem('userProfile_' + username);
    return profile ? JSON.parse(profile) : {};
}

// Function to save user profile to localStorage
function saveUserProfile(username, profile) {
    localStorage.setItem('userProfile_' + username, JSON.stringify(profile));
}

// Function to get registered users from localStorage
function getRegisteredUsers() {
    const users = localStorage.getItem('registeredUsers');
    return users ? JSON.parse(users) : [];
}

// Function to save registered users to localStorage
function saveRegisteredUsers(users) {
    localStorage.setItem('registeredUsers', JSON.stringify(users));
}

// Registration form handler
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value;
            const role = document.getElementById('regRole').value;

            const users = getRegisteredUsers();
            // Check if username already exists
            const existingUser = users.find(user => user.username === username);
            if (existingUser) {
                alert('Username already exists. Please choose a different one.');
                return;
            }

            // Add new user
            users.push({ username, role });
            saveRegisteredUsers(users);

            alert('Registration successful! You can now login.');
            window.location.href = 'login.html';
        });
    }

    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const role = document.getElementById('role').value;

            const users = getRegisteredUsers();
            const user = users.find(u => u.username === username && u.role === role);

            if (!user) {
                alert('Invalid username or role. Please register first or check your details.');
                return;
            }

            // Mock login: store role and username in localStorage
            localStorage.setItem('userRole', role);
            localStorage.setItem('username', username);

            // Redirect to dashboard based on role
            switch (role) {
                case 'user':
                    window.location.href = 'dashboard-user.html';
                    break;
                case 'coach':
                    window.location.href = 'dashboard-coach.html';
                    break;
                case 'adviser':
                    window.location.href = 'dashboard-adviser.html';
                    break;
                case 'admin':
                    window.location.href = 'dashboard-admin.html';
                    break;
                default:
                    alert('Please select a role.');
            }
        });
    }

    // Function to update progress display
function updateProgressDisplay(username) {
    const profile = getUserProfile(username);
    const progressInfo = document.getElementById('progressInfo');
    if (progressInfo) {
        if (profile.weight && profile.goal) {
            const goalText = {
                'lose_weight': 'Lose Weight',
                'gain_muscle': 'Gain Muscle',
                'maintain': 'Maintain',
                'improve_fitness': 'Improve Fitness'
            }[profile.goal] || profile.goal;
            progressInfo.textContent = `Current Weight: ${profile.weight}kg, Goal: ${goalText}`;
        } else {
            progressInfo.textContent = 'Update your profile to see progress info.';
        }
    }
}

// Profile form handler (for user dashboard)
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        const username = localStorage.getItem('username');
        if (username) {
            // Load existing profile
            const profile = getUserProfile(username);
            document.getElementById('age').value = profile.age || '';
            document.getElementById('gender').value = profile.gender || '';
            document.getElementById('weight').value = profile.weight || '';
            document.getElementById('height').value = profile.height || '';
            document.getElementById('goal').value = profile.goal || '';

            // Update progress display
            updateProgressDisplay(username);
        }

        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = localStorage.getItem('username');
            if (!username) {
                alert('Please login first.');
                return;
            }

            const profile = {
                age: document.getElementById('age').value,
                gender: document.getElementById('gender').value,
                weight: document.getElementById('weight').value,
                height: document.getElementById('height').value,
                goal: document.getElementById('goal').value
            };

            saveUserProfile(username, profile);
            alert('Profile saved successfully!');

            // Update progress display
            updateProgressDisplay(username);
        });
    }

    // Display username on dashboard if logged in
    const username = localStorage.getItem('username');
    if (username) {
        const welcomeMsg = document.querySelector('.content h2');
        if (welcomeMsg) {
            welcomeMsg.textContent = `Welcome, ${username}!`;
        }
    }
});