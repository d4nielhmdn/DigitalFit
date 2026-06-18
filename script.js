// ============================================
// DATA MANAGEMENT FUNCTIONS
// ============================================

// Get user profile from localStorage
function getUserProfile(username) {
    const profile = localStorage.getItem('userProfile_' + username);
    return profile ? JSON.parse(profile) : {};
}

// Save user profile to localStorage
function saveUserProfile(username, profile) {
    localStorage.setItem('userProfile_' + username, JSON.stringify(profile));
}

// Get registered users from localStorage
function getRegisteredUsers() {
    const users = localStorage.getItem('registeredUsers');
    return users ? JSON.parse(users) : [];
}

// Save registered users to localStorage
function saveRegisteredUsers(users) {
    localStorage.setItem('registeredUsers', JSON.stringify(users));
}

// ============================================
// WORKOUT PLAN FUNCTIONS
// ============================================

// Get workout plan for a user
function getWorkoutPlan(username) {
    const plan = localStorage.getItem('workoutPlan_' + username);
    return plan ? JSON.parse(plan) : null;
}

// Save workout plan for a user
function saveWorkoutPlan(username, plan) {
    localStorage.setItem('workoutPlan_' + username, JSON.stringify(plan));
}

// Generate default workout plan based on user's goal
function generateWorkoutPlan(profile) {
    const goal = profile.goal || 'maintain';
    const plans = {
        'lose_weight': {
            title: 'Weight Loss Plan',
            exercises: [
                { day: 'Monday', exercises: ['Cardio (30min)', 'Full Body Strength'] },
                { day: 'Wednesday', exercises: ['HIIT (20min)', 'Core Workout'] },
                { day: 'Friday', exercises: ['Cardio (30min)', 'Full Body Strength'] }
            ],
            description: 'Focus on calorie burning and fat loss.'
        },
        'gain_muscle': {
            title: 'Muscle Gain Plan',
            exercises: [
                { day: 'Monday', exercises: ['Chest & Triceps', 'Shoulders'] },
                { day: 'Wednesday', exercises: ['Back & Biceps', 'Legs'] },
                { day: 'Friday', exercises: ['Full Body Compound'] }
            ],
            description: 'Focus on progressive overload and protein intake.'
        },
        'improve_fitness': {
            title: 'Fitness Improvement Plan',
            exercises: [
                { day: 'Monday', exercises: ['Cardio (20min)', 'Strength Training'] },
                { day: 'Wednesday', exercises: ['Yoga/Stretching', 'Core Workout'] },
                { day: 'Friday', exercises: ['Cardio (30min)', 'Strength Training'] }
            ],
            description: 'Balanced approach to overall fitness.'
        },
        'maintain': {
            title: 'Maintenance Plan',
            exercises: [
                { day: 'Monday', exercises: ['Full Body Workout'] },
                { day: 'Wednesday', exercises: ['Cardio (20min)'] },
                { day: 'Friday', exercises: ['Full Body Workout'] }
            ],
            description: 'Maintain current fitness level.'
        }
    };
    return plans[goal] || plans['maintain'];
}

// ============================================
// DIET PLAN FUNCTIONS
// ============================================

// Get diet plan for a user
function getDietPlan(username) {
    const plan = localStorage.getItem('dietPlan_' + username);
    return plan ? JSON.parse(plan) : null;
}

// Save diet plan for a user
function saveDietPlan(username, plan) {
    localStorage.setItem('dietPlan_' + username, JSON.stringify(plan));
}

// Generate default diet plan based on user's goal
function generateDietPlan(profile) {
    const goal = profile.goal || 'maintain';
    const plans = {
        'lose_weight': {
            title: 'Calorie Deficit Diet',
            meals: [
                { meal: 'Breakfast', items: ['Oatmeal with berries', 'Green tea'] },
                { meal: 'Lunch', items: ['Grilled chicken salad', 'Quinoa'] },
                { meal: 'Dinner', items: ['Fish with vegetables', 'Brown rice'] },
                { meal: 'Snacks', items: ['Nuts', 'Protein shake'] }
            ],
            calories: '1800-2000 kcal',
            description: 'Focus on high protein and fiber.'
        },
        'gain_muscle': {
            title: 'High Protein Diet',
            meals: [
                { meal: 'Breakfast', items: ['Eggs with whole grain toast', 'Protein shake'] },
                { meal: 'Lunch', items: ['Chicken breast with rice', 'Vegetables'] },
                { meal: 'Dinner', items: ['Lean beef with potatoes', 'Greens'] },
                { meal: 'Snacks', items: ['Greek yogurt', 'Nuts'] }
            ],
            calories: '2800-3000 kcal',
            description: 'High protein and complex carbohydrates.'
        },
        'improve_fitness': {
            title: 'Balanced Nutrition Plan',
            meals: [
                { meal: 'Breakfast', items: ['Whole grain cereal', 'Fruits'] },
                { meal: 'Lunch', items: ['Turkey sandwich', 'Vegetable soup'] },
                { meal: 'Dinner', items: ['Salmon with vegetables', 'Sweet potato'] },
                { meal: 'Snacks', items: ['Fruits', 'Nuts'] }
            ],
            calories: '2200-2400 kcal',
            description: 'Balanced macronutrients for energy.'
        },
        'maintain': {
            title: 'Maintenance Diet',
            meals: [
                { meal: 'Breakfast', items: ['Oatmeal', 'Fruits'] },
                { meal: 'Lunch', items: ['Grilled chicken', 'Vegetables'] },
                { meal: 'Dinner', items: ['Fish', 'Rice', 'Vegetables'] },
                { meal: 'Snacks', items: ['Nuts', 'Yogurt'] }
            ],
            calories: '2000-2200 kcal',
            description: 'Balanced diet to maintain weight.'
        }
    };
    return plans[goal] || plans['maintain'];
}

// ============================================
// BOOKING FUNCTIONS
// ============================================

// Seed coaches and advisors data
function getAvailableAdvisors() {
    const advisors = localStorage.getItem('advisors');
    if (advisors) {
        return JSON.parse(advisors);
    }
    // Default seed data
    const defaultAdvisors = [
        { id: 1, name: 'John Doe', type: 'coach', specialization: 'Strength Training', availableSlots: ['2026-06-20 09:00', '2026-06-20 10:00', '2026-06-21 14:00'] },
        { id: 2, name: 'Jane Smith', type: 'coach', specialization: 'Cardio & HIIT', availableSlots: ['2026-06-20 11:00', '2026-06-21 09:00', '2026-06-21 15:00'] },
        { id: 3, name: 'Dr. Sarah Lee', type: 'advisor', specialization: 'Nutrition & Wellness', availableSlots: ['2026-06-20 13:00', '2026-06-21 10:00', '2026-06-22 09:00'] },
        { id: 4, name: 'Mike Johnson', type: 'coach', specialization: 'Yoga & Flexibility', availableSlots: ['2026-06-20 08:00', '2026-06-21 08:00', '2026-06-22 10:00'] },
        { id: 5, name: 'Dr. Emily Chen', type: 'advisor', specialization: 'Mental Health & Stress', availableSlots: ['2026-06-20 15:00', '2026-06-21 13:00', '2026-06-22 14:00'] }
    ];
    localStorage.setItem('advisors', JSON.stringify(defaultAdvisors));
    return defaultAdvisors;
}

// Get bookings for a user
function getUserBookings(username) {
    const bookings = localStorage.getItem('bookings_' + username);
    return bookings ? JSON.parse(bookings) : [];
}

// Save booking for a user
function saveUserBooking(username, booking) {
    const bookings = getUserBookings(username);
    booking.id = Date.now();
    booking.status = 'confirmed';
    bookings.push(booking);
    localStorage.setItem('bookings_' + username, JSON.stringify(bookings));
}

// Cancel a booking
function cancelUserBooking(username, bookingId) {
    let bookings = getUserBookings(username);
    bookings = bookings.filter(b => b.id !== bookingId);
    localStorage.setItem('bookings_' + username, JSON.stringify(bookings));
}

// ============================================
// MEMBERSHIP FUNCTIONS
// ============================================

// Get user membership
function getMembership(username) {
    const membership = localStorage.getItem('membership_' + username);
    return membership ? JSON.parse(membership) : null;
}

// Save user membership
function saveMembership(username, plan) {
    const membership = {
        plan: plan,
        startDate: new Date().toISOString(),
        status: 'active'
    };
    localStorage.setItem('membership_' + username, JSON.stringify(membership));
}

// ============================================
// PROGRESS FUNCTIONS
// ============================================

// Get workout completion stats
function getProgressStats(username) {
    const bookings = getUserBookings(username);
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    
    // Generate streak based on completed bookings
    const streak = Math.min(completedBookings, 30); // Simplified streak logic
    
    // Calculate goal progress based on profile
    const profile = getUserProfile(username);
    let goalProgress = 0;
    if (profile.goal) {
        // Simplified progress calculation
        goalProgress = Math.min(Math.round((completedBookings / 10) * 100), 100);
    }
    
    return {
        workoutCount: completedBookings,
        streak: streak,
        goalProgress: goalProgress
    };
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update workout plan display
function displayWorkoutPlan(username) {
    const container = document.getElementById('workoutPlan');
    if (!container) return;
    
    const plan = getWorkoutPlan(username);
    if (plan) {
        let html = `<h4>${plan.title}</h4><p>${plan.description}</p>`;
        plan.exercises.forEach(day => {
            html += `<div class="plan-day"><strong>${day.day}:</strong> ${day.exercises.join(', ')}</div>`;
        });
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p>No workout plan assigned. Please update your profile to generate a plan.</p>';
    }
}

// Update diet plan display
function displayDietPlan(username) {
    const container = document.getElementById('dietPlan');
    if (!container) return;
    
    const plan = getDietPlan(username);
    if (plan) {
        let html = `<h4>${plan.title}</h4><p>${plan.description}</p><p><strong>Calories:</strong> ${plan.calories}</p>`;
        plan.meals.forEach(meal => {
            html += `<div class="plan-meal"><strong>${meal.meal}:</strong> ${meal.items.join(', ')}</div>`;
        });
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p>No diet plan assigned. Please update your profile to generate a plan.</p>';
    }
}

// Update progress display
function updateProgressDisplay(username) {
    const container = document.getElementById('progressStats');
    if (!container) return;
    
    const stats = getProgressStats(username);
    document.getElementById('workoutCount').textContent = stats.workoutCount;
    document.getElementById('streakCount').textContent = stats.streak + ' days';
    document.getElementById('goalProgress').textContent = stats.goalProgress + '%';
}

// Update profile form
function loadProfileForm(username) {
    const profile = getUserProfile(username);
    if (document.getElementById('fullname')) {
        document.getElementById('fullname').value = profile.fullname || '';
    }
    if (document.getElementById('age')) {
        document.getElementById('age').value = profile.age || '';
    }
    if (document.getElementById('gender')) {
        document.getElementById('gender').value = profile.gender || '';
    }
    if (document.getElementById('weight')) {
        document.getElementById('weight').value = profile.weight || '';
    }
    if (document.getElementById('height')) {
        document.getElementById('height').value = profile.height || '';
    }
    if (document.getElementById('goal')) {
        document.getElementById('goal').value = profile.goal || '';
    }
}

// Update upcoming sessions display
function displayUpcomingSessions(username) {
    const container = document.getElementById('upcomingSessions');
    if (!container) return;
    
    const bookings = getUserBookings(username);
    const upcoming = bookings.filter(b => new Date(b.date) > new Date());
    
    if (upcoming.length === 0) {
        container.innerHTML = '<p>No upcoming sessions.</p>';
        return;
    }
    
    let html = '<ul>';
    upcoming.forEach(b => {
        html += `<li>${b.date} - ${b.advisorName} (${b.type})</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// Update membership display
function displayMembership(username) {
    const container = document.getElementById('currentMembership');
    if (!container) return;
    
    const membership = getMembership(username);
    if (membership && membership.status === 'active') {
        container.innerHTML = `<p><strong>Active Plan:</strong> ${membership.plan}</p><p>Started: ${new Date(membership.startDate).toLocaleDateString()}</p>`;
    } else {
        container.innerHTML = '<p>No active membership. Subscribe below!</p>';
    }
}

// ============================================
// BOOKING UI FLOW FUNCTIONS
// ============================================

let selectedAdvisor = null;
let selectedSlot = null;
let currentStep = 1;

function resetBookingFlow() {
    currentStep = 1;
    selectedAdvisor = null;
    selectedSlot = null;
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step4').style.display = 'none';
    document.getElementById('bookingStatus').textContent = '';
    document.getElementById('bookingStatus').className = 'status-message';
    document.getElementById('advisorSelect').innerHTML = '<option value="">-- Select --</option>';
    document.getElementById('slotSelect').innerHTML = '<option value="">-- Select --</option>';
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const username = localStorage.getItem('username');
    
    // ========================================
    // REGISTRATION
    // ========================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const role = document.getElementById('regRole').value;

            if (!username || !role) {
                alert('Please fill in all fields.');
                return;
            }

            const users = getRegisteredUsers();
            const existingUser = users.find(user => user.username === username);
            if (existingUser) {
                alert('Username already exists. Please choose a different one.');
                return;
            }

            // Add new user with pending approval status (admin approval flow)
            users.push({ 
                username, 
                role, 
                status: 'pending', 
                registeredAt: new Date().toISOString() 
            });
            saveRegisteredUsers(users);

            // Simulate admin approval notification
            alert('Registration submitted! Waiting for admin approval. You will be notified once approved.');
            
            // For demo purposes, auto-approve after 2 seconds
            setTimeout(() => {
                const updatedUsers = getRegisteredUsers();
                const userIndex = updatedUsers.findIndex(u => u.username === username);
                if (userIndex !== -1) {
                    updatedUsers[userIndex].status = 'approved';
                    saveRegisteredUsers(updatedUsers);
                    alert('Account approved! You can now login.');
                }
            }, 2000);
            
            window.location.href = 'login.html';
        });
    }

    // ========================================
    // LOGIN
    // ========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const role = document.getElementById('role').value;

            const users = getRegisteredUsers();
            const user = users.find(u => u.username === username && u.role === role);

            if (!user) {
                alert('Invalid username or role. Please register first or check your details.');
                return;
            }

            // Check if account is approved
            if (user.status === 'pending') {
                alert('Your account is pending approval. Please wait for admin approval.');
                return;
            }
            
            if (user.status === 'rejected') {
                alert('Your account was rejected. Please contact support.');
                return;
            }

            // Store session
            localStorage.setItem('userRole', role);
            localStorage.setItem('username', username);

            // Redirect based on role
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

    // ========================================
    // LOGOUT
    // ========================================
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('username');
            localStorage.removeItem('userRole');
            window.location.href = 'login.html';
        });
    }

    // ========================================
    // DASHBOARD NAVIGATION
    // ========================================
    const menuLinks = document.querySelectorAll('.menu a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            
            // Hide all sections
            document.querySelectorAll('.section').forEach(s => {
                s.style.display = 'none';
                s.classList.remove('active');
            });
            
            // Show selected section
            const target = document.getElementById(section);
            if (target) {
                target.style.display = 'block';
                target.classList.add('active');
            }
            
            // Update active menu
            menuLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Refresh data when switching to certain sections
            if (section === 'workouts' && username) {
                displayWorkoutPlan(username);
            }
            if (section === 'diet' && username) {
                displayDietPlan(username);
            }
            if (section === 'progress' && username) {
                updateProgressDisplay(username);
            }
            if (section === 'bookings' && username) {
                displayUpcomingSessions(username);
                resetBookingFlow();
            }
            if (section === 'membership' && username) {
                displayMembership(username);
            }
            if (section === 'profile' && username) {
                loadProfileForm(username);
            }
        });
    });

    // ========================================
    // PROFILE FORM
    // ========================================
    const profileForm = document.getElementById('profileForm');
    if (profileForm && username) {
        loadProfileForm(username);
        
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!username) {
                alert('Please login first.');
                return;
            }

            const profile = {
                fullname: document.getElementById('fullname') ? document.getElementById('fullname').value : '',
                age: document.getElementById('age').value,
                gender: document.getElementById('gender').value,
                weight: document.getElementById('weight').value,
                height: document.getElementById('height').value,
                goal: document.getElementById('goal').value
            };

            saveUserProfile(username, profile);
            
            // Generate workout and diet plans based on profile
            const workoutPlan = generateWorkoutPlan(profile);
            const dietPlan = generateDietPlan(profile);
            saveWorkoutPlan(username, workoutPlan);
            saveDietPlan(username, dietPlan);
            
            const statusDiv = document.getElementById('profileStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Profile saved successfully! Workout and diet plans generated.';
                statusDiv.className = 'status-message success';
            } else {
                alert('Profile saved successfully! Workout and diet plans generated.');
            }
            
            // Update displays
            displayWorkoutPlan(username);
            displayDietPlan(username);
            updateProgressDisplay(username);
        });
    }

    // ========================================
    // REFRESH WORKOUT PLAN
    // ========================================
    const refreshWorkoutBtn = document.getElementById('refreshWorkoutBtn');
    if (refreshWorkoutBtn && username) {
        refreshWorkoutBtn.addEventListener('click', function() {
            const profile = getUserProfile(username);
            const plan = generateWorkoutPlan(profile);
            saveWorkoutPlan(username, plan);
            displayWorkoutPlan(username);
            const statusDiv = document.getElementById('profileStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Workout plan refreshed!';
                statusDiv.className = 'status-message success';
            }
        });
    }

    // ========================================
    // REFRESH DIET PLAN
    // ========================================
    const refreshDietBtn = document.getElementById('refreshDietBtn');
    if (refreshDietBtn && username) {
        refreshDietBtn.addEventListener('click', function() {
            const profile = getUserProfile(username);
            const plan = generateDietPlan(profile);
            saveDietPlan(username, plan);
            displayDietPlan(username);
            const statusDiv = document.getElementById('profileStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Diet plan refreshed!';
                statusDiv.className = 'status-message success';
            }
        });
    }

    // ========================================
    // BOOKING FLOW
    // ========================================
    // Step 1: Fetch advisors
    const fetchAdvisorsBtn = document.getElementById('fetchAdvisorsBtn');
    if (fetchAdvisorsBtn) {
        fetchAdvisorsBtn.addEventListener('click', function() {
            const type = document.getElementById('advisorType').value;
            if (!type) {
                alert('Please select an advisor type.');
                return;
            }
            
            const advisors = getAvailableAdvisors();
            const filtered = advisors.filter(a => a.type === type);
            
            const select = document.getElementById('advisorSelect');
            select.innerHTML = '<option value="">-- Select --</option>';
            filtered.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = `${a.name} - ${a.specialization}`;
                select.appendChild(option);
            });
            
            document.getElementById('step2').style.display = 'block';
            document.getElementById('step1').style.display = 'block';
            document.getElementById('step3').style.display = 'none';
            document.getElementById('step4').style.display = 'none';
            currentStep = 2;
        });
    }

    // Step 2: Fetch slots
    const fetchSlotsBtn = document.getElementById('fetchSlotsBtn');
    if (fetchSlotsBtn) {
        fetchSlotsBtn.addEventListener('click', function() {
            const advisorId = document.getElementById('advisorSelect').value;
            if (!advisorId) {
                alert('Please select an advisor.');
                return;
            }
            
            const advisors = getAvailableAdvisors();
            const advisor = advisors.find(a => a.id == advisorId);
            if (!advisor) {
                alert('Advisor not found.');
                return;
            }
            
            selectedAdvisor = advisor;
            
            const select = document.getElementById('slotSelect');
            select.innerHTML = '<option value="">-- Select --</option>';
            advisor.availableSlots.forEach(slot => {
                const option = document.createElement('option');
                option.value = slot;
                option.textContent = slot;
                select.appendChild(option);
            });
            
            document.getElementById('step3').style.display = 'block';
            document.getElementById('step2').style.display = 'block';
            document.getElementById('step4').style.display = 'none';
            currentStep = 3;
        });
    }

    // Step 3: Confirm booking
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', function() {
            const slot = document.getElementById('slotSelect').value;
            if (!slot) {
                alert('Please select a time slot.');
                return;
            }
            
            selectedSlot = slot;
            
            document.getElementById('step4').style.display = 'block';
            document.getElementById('bookingConfirmation').textContent = 
                `Confirm booking with ${selectedAdvisor.name} on ${selectedSlot}?`;
            document.getElementById('bookingStatus').textContent = '';
            document.getElementById('bookingStatus').className = 'status-message';
        });
    }

    // Step 4: Yes - Confirm
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    if (confirmYesBtn && username) {
        confirmYesBtn.addEventListener('click', function() {
            if (!selectedAdvisor || !selectedSlot) {
                alert('No booking selected.');
                return;
            }
            
            const booking = {
                advisorId: selectedAdvisor.id,
                advisorName: selectedAdvisor.name,
                type: selectedAdvisor.type,
                date: selectedSlot,
                bookedAt: new Date().toISOString()
            };
            
            saveUserBooking(username, booking);
            
            document.getElementById('bookingStatus').textContent = 
                `✅ Booking confirmed with ${selectedAdvisor.name} on ${selectedSlot}!`;
            document.getElementById('bookingStatus').className = 'status-message success';
            document.getElementById('bookingActions').style.display = 'none';
            
            displayUpcomingSessions(username);
            updateProgressDisplay(username);
            
            // Reset after 3 seconds
            setTimeout(() => {
                resetBookingFlow();
                document.getElementById('bookingActions').style.display = 'block';
            }, 3000);
        });
    }

    // Step 4: No - Cancel
    const confirmNoBtn = document.getElementById('confirmNoBtn');
    if (confirmNoBtn) {
        confirmNoBtn.addEventListener('click', function() {
            document.getElementById('bookingStatus').textContent = '❌ Booking cancelled.';
            document.getElementById('bookingStatus').className = 'status-message error';
            document.getElementById('bookingActions').style.display = 'none';
            
            setTimeout(() => {
                resetBookingFlow();
                document.getElementById('bookingActions').style.display = 'block';
            }, 2000);
        });
    }

    // ========================================
    // MEMBERSHIP SUBSCRIPTION
    // ========================================
    const subscribeBtns = document.querySelectorAll('.subscribeBtn');
    subscribeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const plan = this.dataset.plan;
            const planNames = {
                'basic': 'Basic - $29/month',
                'premium': 'Premium - $49/month',
                'pro': 'Pro - $79/month'
            };
            
            const modal = document.getElementById('paymentModal');
            if (modal) {
                document.getElementById('planSummary').textContent = `You are about to subscribe to: ${planNames[plan]}`;
                modal.style.display = 'block';
                
                // Store selected plan for payment
                modal.dataset.selectedPlan = plan;
            }
        });
    });

    // Proceed Payment
    const proceedPaymentBtn = document.getElementById('proceedPaymentBtn');
    if (proceedPaymentBtn && username) {
        proceedPaymentBtn.addEventListener('click', function() {
            const modal = document.getElementById('paymentModal');
            const plan = modal.dataset.selectedPlan;
            
            // Simulate payment validation
            const paymentStatus = document.getElementById('paymentStatus');
            paymentStatus.textContent = 'Processing payment...';
            paymentStatus.className = 'status-message';
            
            setTimeout(() => {
                // Simulate successful payment
                saveMembership(username, plan);
                paymentStatus.textContent = '✅ Payment successful! Membership activated.';
                paymentStatus.className = 'status-message success';
                displayMembership(username);
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    paymentStatus.textContent = '';
                    paymentStatus.className = 'status-message';
                }, 2000);
            }, 1500);
        });
    }

    // Cancel Payment
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', function() {
            document.getElementById('paymentModal').style.display = 'none';
            document.getElementById('paymentStatus').textContent = '';
            document.getElementById('paymentStatus').className = 'status-message';
        });
    }

    // ========================================
    // INITIAL LOAD - DISPLAY DATA
    // ========================================
    if (username) {
        // Display welcome message
        const welcomeMsg = document.querySelector('.content h2');
        if (welcomeMsg) {
            welcomeMsg.textContent = `Welcome, ${username}!`;
        }

        // Load initial data for visible sections
        displayWorkoutPlan(username);
        displayDietPlan(username);
        updateProgressDisplay(username);
        displayUpcomingSessions(username);
        displayMembership(username);
        loadProfileForm(username);

        // Show workout section by default
        const workoutSection = document.getElementById('workouts');
        if (workoutSection) {
            workoutSection.style.display = 'block';
            workoutSection.classList.add('active');
        }
    }
});