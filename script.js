/* ============================================================
   DigitalFit – client-side application logic
   ------------------------------------------------------------
   This is a front-end only prototype: there is no real server.
   Accounts, sessions, bookings, plans and "payments" are all
   stored in the browser's localStorage. This is fine for a demo
   of the use cases below, but it is NOT secure (passwords are
   stored in plain text) and is not meant for production use.
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     Storage keys & generic helpers
  ---------------------------------------------------------- */
  var KEYS = {
    USERS: 'df_users',
    SESSION: 'df_session',
    WORKOUTS: 'df_workoutPlans',
    REPORTS: 'df_healthReports',
    DIETS: 'df_dietPlans',
    PERFORMANCE: 'df_performance',
    BOOKINGS: 'df_bookings',
    PLANS: 'df_membershipPlans',
    PAYMENTS: 'df_payments'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DigitalFit: failed to read ' + key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('DigitalFit: failed to save ' + key, e);
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str === null || str === undefined ? '' : String(str);
    return div.innerHTML;
  }

  function page() {
    return document.body.getAttribute('data-page') || '';
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'status-message' + (type ? ' ' + type : '');
    el.style.display = text ? 'block' : 'none';
  }

  function formatMoney(n) {
    return '$' + Number(n || 0).toFixed(2);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ----------------------------------------------------------
     Seed data – runs once so the demo has something in it
  ---------------------------------------------------------- */
  function seed() {
    var users = read(KEYS.USERS, null);
    if (!users) {
      users = [
        { id: uid('u'), username: 'admin', password: 'admin123', role: 'admin', fullName: 'System Admin', createdAt: todayISO() },
        { id: uid('u'), username: 'coachjohn', password: 'coach123', role: 'coach', fullName: 'John Doe', createdAt: todayISO() },
        { id: uid('u'), username: 'coachjane', password: 'coach123', role: 'coach', fullName: 'Jane Smith', createdAt: todayISO() },
        { id: uid('u'), username: 'advisormary', password: 'advise123', role: 'adviser', fullName: 'Mary Lee', createdAt: todayISO() }
      ];
      write(KEYS.USERS, users);
    }

    var plans = read(KEYS.PLANS, null);
    if (!plans) {
      plans = [
        { id: uid('plan'), name: 'Basic', price: 29.99, period: 'month',
          features: ['Gym floor access', 'Locker room access', '1 group class / week'] },
        { id: uid('plan'), name: 'Premium', price: 49.99, period: 'month',
          features: ['Unlimited gym access', 'Unlimited group classes', '2 coach sessions / month'] },
        { id: uid('plan'), name: 'Elite', price: 79.99, period: 'month',
          features: ['Everything in Premium', 'Weekly coach session', 'Monthly health report', 'Custom diet plan'] }
      ];
      write(KEYS.PLANS, plans);
    }

    if (read(KEYS.WORKOUTS, null) === null) write(KEYS.WORKOUTS, {});
    if (read(KEYS.REPORTS, null) === null) write(KEYS.REPORTS, {});
    if (read(KEYS.DIETS, null) === null) write(KEYS.DIETS, {});
    if (read(KEYS.PERFORMANCE, null) === null) write(KEYS.PERFORMANCE, {});
    if (read(KEYS.BOOKINGS, null) === null) write(KEYS.BOOKINGS, []);
    if (read(KEYS.PAYMENTS, null) === null) write(KEYS.PAYMENTS, []);
  }

  /* ----------------------------------------------------------
     Users / auth
  ---------------------------------------------------------- */
  function getUsers() { return read(KEYS.USERS, []); }
  function saveUsers(list) { write(KEYS.USERS, list); }
  function findUser(username) {
    return getUsers().filter(function (u) {
      return u.username.toLowerCase() === String(username || '').toLowerCase();
    })[0] || null;
  }
  function getUsersByRole(role) {
    return getUsers().filter(function (u) { return u.role === role; });
  }

  function getSession() { return read(KEYS.SESSION, null); }
  function setSession(user) {
    write(KEYS.SESSION, { id: user.id, username: user.username, role: user.role, fullName: user.fullName });
  }
  function clearSession() { localStorage.removeItem(KEYS.SESSION); }

  var ROLE_DASHBOARD = {
    user: 'dashboard-user.html',
    coach: 'dashboard-coach.html',
    adviser: 'dashboard-adviser.html',
    admin: 'dashboard-admin.html'
  };
  var ROLE_LABEL = { user: 'Gym User', coach: 'Fitness Coach', adviser: 'Health Adviser', admin: 'Admin' };

  /* Redirects to login if the current session doesn't match the
     role required by this page. Returns the session (or null). */
  function requireRole(role) {
    var session = getSession();
    if (!session || session.role !== role) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  /* If someone is already logged in and lands on index/login/register,
     send them straight to their dashboard. */
  function redirectIfLoggedIn() {
    var session = getSession();
    if (session && ROLE_DASHBOARD[session.role]) {
      window.location.href = ROLE_DASHBOARD[session.role];
    }
  }

  /* ----------------------------------------------------------
     Shared header behaviour (user pill + logout) on every page
  ---------------------------------------------------------- */
  function initHeader() {
    var session = getSession();
    var infoEl = document.getElementById('headerUserInfo');
    if (infoEl) {
      if (session) {
        infoEl.textContent = (session.fullName || session.username) + ' · ' + ROLE_LABEL[session.role];
        infoEl.style.display = 'inline';
      } else {
        infoEl.style.display = 'none';
      }
    }
    var logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearSession();
        window.location.href = 'login.html';
      });
    }
  }

  /* ----------------------------------------------------------
     Section / tab navigation used inside each dashboard
  ---------------------------------------------------------- */
  function initSectionNav() {
    var menu = document.querySelector('.menu');
    if (!menu) return;
    var links = Array.prototype.slice.call(menu.querySelectorAll('a[data-section]'));
    if (!links.length) return;
    var sections = Array.prototype.slice.call(document.querySelectorAll('.section[id]'));

    function show(id) {
      sections.forEach(function (s) { s.classList.toggle('hidden', s.id !== id); });
      links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('data-section') === id); });
    }
    links.forEach(function (l) {
      l.addEventListener('click', function (e) {
        e.preventDefault();
        show(l.getAttribute('data-section'));
      });
    });
    var startId = (window.location.hash || '').replace('#', '');
    if (!startId || !links.some(function (l) { return l.getAttribute('data-section') === startId; })) {
      startId = links[0].getAttribute('data-section');
    }
    show(startId);
  }

  /* ----------------------------------------------------------
     Generic mock payment modal – used for membership & bookings
  ---------------------------------------------------------- */
  function closePaymentModal() {
    var existing = document.getElementById('paymentModal');
    if (existing) existing.remove();
  }

  function showPaymentModal(amount, description, onSuccess) {
    closePaymentModal();
    var modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.innerHTML =
      '<div>' +
        '<h3>Checkout</h3>' +
        '<p>' + escapeHtml(description) + '</p>' +
        '<p><strong>Amount due: ' + formatMoney(amount) + '</strong></p>' +
        '<div class="form-group"><label for="pmCard">Card number</label>' +
          '<input id="pmCard" maxlength="19" placeholder="4242 4242 4242 4242"></div>' +
        '<div class="form-group"><label for="pmExpiry">Expiry (MM/YY)</label>' +
          '<input id="pmExpiry" maxlength="5" placeholder="MM/YY"></div>' +
        '<div class="form-group"><label for="pmCvv">CVV</label>' +
          '<input id="pmCvv" maxlength="4" placeholder="123"></div>' +
        '<div id="paymentStatus" class="status-message" style="display:none;"></div>' +
        '<button id="pmPay" type="button" class="btn-success">Pay now</button>' +
        '<button id="pmCancel" type="button" class="btn-secondary">Cancel</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('pmCancel').addEventListener('click', closePaymentModal);
    document.getElementById('pmPay').addEventListener('click', function () {
      var card = document.getElementById('pmCard').value.replace(/\s+/g, '');
      var expiry = document.getElementById('pmExpiry').value.trim();
      var cvv = document.getElementById('pmCvv').value.trim();
      var statusEl = document.getElementById('paymentStatus');

      if (card.length < 12 || !/^\d{2}\/\d{2}$/.test(expiry) || cvv.length < 3) {
        showMessage(statusEl, 'Enter a valid (mock) card number, MM/YY expiry and CVV.', 'error');
        return;
      }
      showMessage(statusEl, 'Processing payment…', '');
      window.setTimeout(function () {
        var payments = read(KEYS.PAYMENTS, []);
        payments.push({ id: uid('pay'), amount: amount, description: description, date: new Date().toISOString() });
        write(KEYS.PAYMENTS, payments);
        showMessage(statusEl, 'Payment successful!', 'success');
        window.setTimeout(function () {
          closePaymentModal();
          onSuccess();
        }, 600);
      }, 700);
    });
  }

  /* ============================================================
     PUBLIC PAGES: index / login / register
  ============================================================ */
  function initHomePage() {
    if (page() !== 'home') return;
    redirectIfLoggedIn();
  }

  function initLoginPage() {
    if (page() !== 'login') return;
    redirectIfLoggedIn();
    var form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('username').value.trim();
      var password = document.getElementById('password').value;
      var role = document.getElementById('role').value;
      var msgEl = document.getElementById('loginMessage');

      var user = findUser(username);
      if (!user || user.password !== password || user.role !== role) {
        showMessage(msgEl, 'Invalid username, password or role.', 'error');
        return;
      }
      setSession(user);
      showMessage(msgEl, 'Login successful! Redirecting…', 'success');
      window.setTimeout(function () { window.location.href = ROLE_DASHBOARD[user.role]; }, 500);
    });
  }

  function initRegisterPage() {
    if (page() !== 'register') return;
    redirectIfLoggedIn();
    var form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('regUsername').value.trim();
      var password = document.getElementById('regPassword').value;
      var confirmPwd = document.getElementById('regConfirmPassword').value;
      var role = document.getElementById('regRole').value;
      var msgEl = document.getElementById('registerMessage');

      if (!username || !password || !role) {
        showMessage(msgEl, 'Please fill in all fields.', 'error'); return;
      }
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) {
        showMessage(msgEl, 'Username must be 3-20 characters (letters, numbers, _ or .).', 'error'); return;
      }
      if (password.length < 6) {
        showMessage(msgEl, 'Password must be at least 6 characters.', 'error'); return;
      }
      if (password !== confirmPwd) {
        showMessage(msgEl, 'Passwords do not match.', 'error'); return;
      }
      if (findUser(username)) {
        showMessage(msgEl, 'That username is already taken.', 'error'); return;
      }

      var users = getUsers();
      var newUser = { id: uid('u'), username: username, password: password, role: role, fullName: username, createdAt: todayISO() };
      if (role === 'user') {
        newUser.profile = { age: '', gender: '', weight: '', height: '', goal: '' };
        newUser.membership = { planId: null, planName: null, status: 'none', startDate: null };
      }
      users.push(newUser);
      saveUsers(users);

      showMessage(msgEl, 'Account created! Redirecting to login…', 'success');
      form.reset();
      window.setTimeout(function () { window.location.href = 'login.html'; }, 1000);
    });
  }

  /* ============================================================
     GYM USER DASHBOARD
     Use cases: Register for Membership, View Workout Plan,
     View Health Report, Book Fitness Coach / Health Adviser
  ============================================================ */
  function initDashboardUser() {
    if (page() !== 'dashboard-user') return;
    var session = requireRole('user');
    if (!session) return;
    initSectionNav();

    renderWelcome(session);
    renderWorkoutPlan(session);
    renderMembership(session);
    initBookingFlow(session);
    renderProgressAndReports(session);
    initProfileForm(session);
  }

  function getFreshUser(username) { return findUser(username); }

  function renderWelcome(session) {
    var el = document.getElementById('welcomeName');
    if (el) el.textContent = session.fullName || session.username;
  }

  /* ---- View Workout Plan ---- */
  function renderWorkoutPlan(session) {
    var box = document.getElementById('workoutPlanBox');
    if (!box) return;
    var plans = read(KEYS.WORKOUTS, {});
    var plan = plans[session.username];

    if (!plan) {
      box.innerHTML = '<p>You don\'t have a workout plan yet. Book a session with a coach and they\'ll build one for you.</p>';
      return;
    }
    var coach = findUser(plan.coachUsername);
    var html = '<p><strong>Plan:</strong> ' + escapeHtml(plan.title || 'My Workout Plan') +
      ' &nbsp;·&nbsp; <strong>Coach:</strong> ' + escapeHtml(coach ? (coach.fullName || coach.username) : plan.coachUsername) +
      ' &nbsp;·&nbsp; <em>updated ' + formatDate(plan.updatedAt) + '</em></p>';
    (plan.days || []).forEach(function (day) {
      html += '<div class="plan-day"><strong>' + escapeHtml(day.name) + '</strong><ul>';
      (day.exercises || []).forEach(function (ex) {
        html += '<li>' + escapeHtml(ex.name) + ' — ' + escapeHtml(ex.sets || '?') + ' sets x ' + escapeHtml(ex.reps || '?') + ' reps</li>';
      });
      if (!day.exercises || !day.exercises.length) html += '<li><em>No exercises listed for this day.</em></li>';
      html += '</ul></div>';
    });
    if (!plan.days || !plan.days.length) html += '<p><em>No training days added yet.</em></p>';
    box.innerHTML = html;
  }

  /* ---- Register for Membership ---- */
  function renderMembership(session) {
    var listBox = document.getElementById('membershipPlans');
    var statusBox = document.getElementById('membershipStatus');
    if (!listBox && !statusBox) return;

    var plans = read(KEYS.PLANS, []);
    var user = getFreshUser(session.username);
    var membership = user.membership || { status: 'none' };

    if (statusBox) {
      if (membership.status === 'active') {
        statusBox.innerHTML =
          '<div class="status-message success">Active plan: <strong>' + escapeHtml(membership.planName) +
          '</strong> · since ' + formatDate(membership.startDate) +
          '</div><button id="cancelMembershipBtn" type="button" class="btn-danger">Cancel membership</button>';
        var cancelBtn = document.getElementById('cancelMembershipBtn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function () {
            if (!window.confirm('Cancel your ' + membership.planName + ' membership?')) return;
            updateCurrentUser(session.username, function (u) {
              u.membership = { planId: null, planName: null, status: 'cancelled', startDate: null };
            });
            renderMembership(session);
          });
        }
      } else if (membership.status === 'cancelled') {
        statusBox.innerHTML = '<div class="status-message error">Your membership was cancelled. Choose a plan below to rejoin.</div>';
      } else {
        statusBox.innerHTML = '<div class="status-message">You don\'t have an active membership yet. Choose a plan below.</div>';
      }
    }

    if (listBox) {
      listBox.innerHTML = '';
      plans.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'plan-card';
        var isCurrent = membership.status === 'active' && membership.planId === p.id;
        card.innerHTML =
          '<h4>' + escapeHtml(p.name) + ' — ' + formatMoney(p.price) + ' / ' + escapeHtml(p.period) + '</h4>' +
          '<ul>' + (p.features || []).map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') + '</ul>' +
          '<button type="button" class="btn-primary" ' + (isCurrent ? 'disabled' : '') + '>' +
          (isCurrent ? 'Current plan' : 'Subscribe') + '</button>';
        var btn = card.querySelector('button');
        if (!isCurrent) {
          btn.addEventListener('click', function () {
            showPaymentModal(p.price, 'Subscribe to the ' + p.name + ' membership plan', function () {
              updateCurrentUser(session.username, function (u) {
                u.membership = { planId: p.id, planName: p.name, status: 'active', startDate: todayISO() };
              });
              renderMembership(session);
              renderProgressAndReports(session);
            });
          });
        }
        listBox.appendChild(card);
      });
    }
  }

  /* ---- Book Fitness Coach and Health Adviser ---- */
  var BOOKING_PRICE = { coach: 25, adviser: 40 };

  function initBookingFlow(session) {
    var typeSel = document.getElementById('bookingType');
    var providerSel = document.getElementById('bookingProvider');
    var form = document.getElementById('bookingForm');
    var listBox = document.getElementById('myBookings');
    if (!form) return;

    function fillProviders() {
      var role = typeSel.value;
      var people = getUsersByRole(role);
      providerSel.innerHTML = '<option value="">Select ' + (role === 'coach' ? 'a coach' : 'a health adviser') + '</option>' +
        people.map(function (p) { return '<option value="' + escapeHtml(p.username) + '">' + escapeHtml(p.fullName || p.username) + '</option>'; }).join('');
    }
    typeSel.addEventListener('change', fillProviders);
    fillProviders();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var type = typeSel.value;
      var providerUsername = providerSel.value;
      var date = document.getElementById('bookingDate').value;
      var time = document.getElementById('bookingTime').value;
      var msgEl = document.getElementById('bookingMessage');

      if (!type || !providerUsername || !date || !time) {
        showMessage(msgEl, 'Please complete all booking fields.', 'error');
        return;
      }
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(date) < today) {
        showMessage(msgEl, 'Please choose a date that is today or later.', 'error');
        return;
      }
      showMessage(msgEl, '', '');

      var provider = findUser(providerUsername);
      var price = BOOKING_PRICE[type];
      var label = (type === 'coach' ? 'Coach session' : 'Adviser consultation') + ' with ' + (provider.fullName || provider.username) +
        ' on ' + formatDate(date) + ' at ' + time;

      showPaymentModal(price, label, function () {
        var bookings = read(KEYS.BOOKINGS, []);
        bookings.push({
          id: uid('bk'), username: session.username, providerUsername: providerUsername, providerRole: type,
          date: date, time: time, status: 'confirmed', paymentStatus: 'paid', amount: price, createdAt: new Date().toISOString()
        });
        write(KEYS.BOOKINGS, bookings);
        showMessage(msgEl, 'Booking confirmed with ' + (provider.fullName || provider.username) + '!', 'success');
        form.reset();
        fillProviders();
        renderMyBookings(session, listBox);
      });
    });

    renderMyBookings(session, listBox);
  }

  function renderMyBookings(session, listBox) {
    if (!listBox) return;
    var bookings = read(KEYS.BOOKINGS, []).filter(function (b) { return b.username === session.username; });
    bookings.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? 1 : -1; });

    if (!bookings.length) {
      listBox.innerHTML = '<p><em>You have no bookings yet.</em></p>';
      return;
    }
    var html = '<table class="data-table"><thead><tr><th>Type</th><th>With</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>';
    bookings.forEach(function (b) {
      var provider = findUser(b.providerUsername);
      html += '<tr>' +
        '<td>' + (b.providerRole === 'coach' ? 'Coach session' : 'Adviser consultation') + '</td>' +
        '<td>' + escapeHtml(provider ? (provider.fullName || provider.username) : b.providerUsername) + '</td>' +
        '<td>' + formatDate(b.date) + '</td>' +
        '<td>' + escapeHtml(b.time) + '</td>' +
        '<td>' + escapeHtml(b.status) + '</td>' +
        '<td>' + (b.status === 'confirmed' ? '<button type="button" class="btn-danger" data-cancel="' + b.id + '">Cancel</button>' : '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    listBox.innerHTML = html;

    Array.prototype.slice.call(listBox.querySelectorAll('[data-cancel]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cancel');
        var all = read(KEYS.BOOKINGS, []);
        var b = all.filter(function (x) { return x.id === id; })[0];
        if (b) b.status = 'cancelled';
        write(KEYS.BOOKINGS, all);
        renderMyBookings(session, listBox);
      });
    });
  }

  /* ---- View Health Report + performance stats ---- */
  function renderProgressAndReports(session) {
    var statsBox = document.getElementById('progressStats');
    var reportBox = document.getElementById('healthReportBox');
    var dietBox = document.getElementById('dietPlanBox');
    if (!statsBox && !reportBox && !dietBox) return;

    var user = getFreshUser(session.username);
    var profile = user.profile || {};

    if (statsBox) {
      var bmi = '—';
      if (profile.weight && profile.height) {
        var h = profile.height / 100;
        bmi = (profile.weight / (h * h)).toFixed(1);
      }
      statsBox.innerHTML =
        statCard('Weight', profile.weight ? profile.weight + ' kg' : '—') +
        statCard('Height', profile.height ? profile.height + ' cm' : '—') +
        statCard('BMI', bmi) +
        statCard('Goal', profile.goal ? labelGoal(profile.goal) : '—') +
        statCard('Membership', user.membership && user.membership.status === 'active' ? user.membership.planName : 'None');
    }

    if (reportBox) {
      var reports = read(KEYS.REPORTS, {});
      var report = reports[session.username];
      if (!report) {
        reportBox.innerHTML = '<p><em>No health report yet. Book a session with a health adviser to get one.</em></p>';
      } else {
        var adviser = findUser(report.adviserUsername);
        reportBox.innerHTML =
          '<div class="plan-day"><p><strong>By:</strong> ' + escapeHtml(adviser ? (adviser.fullName || adviser.username) : report.adviserUsername) +
          ' &nbsp;·&nbsp; <em>' + formatDate(report.createdAt) + '</em></p>' +
          '<p><strong>BMI:</strong> ' + escapeHtml(report.bmi || '—') + ' &nbsp;·&nbsp; <strong>Blood pressure:</strong> ' + escapeHtml(report.bloodPressure || '—') + '</p>' +
          '<p><strong>Summary:</strong> ' + escapeHtml(report.summary || '—') + '</p>' +
          '<p><strong>Recommendations:</strong> ' + escapeHtml(report.recommendations || '—') + '</p></div>';
      }
    }

    if (dietBox) {
      var diets = read(KEYS.DIETS, {});
      var diet = diets[session.username];
      if (!diet) {
        dietBox.innerHTML = '<p><em>No diet plan yet.</em></p>';
      } else {
        dietBox.innerHTML =
          '<div class="plan-meal"><strong>Breakfast:</strong> ' + escapeHtml(diet.breakfast || '—') + '</div>' +
          '<div class="plan-meal"><strong>Lunch:</strong> ' + escapeHtml(diet.lunch || '—') + '</div>' +
          '<div class="plan-meal"><strong>Dinner:</strong> ' + escapeHtml(diet.dinner || '—') + '</div>' +
          '<div class="plan-meal"><strong>Snacks:</strong> ' + escapeHtml(diet.snacks || '—') + '</div>' +
          (diet.notes ? '<div class="plan-meal"><strong>Notes:</strong> ' + escapeHtml(diet.notes) + '</div>' : '');
      }
    }
  }

  function statCard(label, value) {
    return '<div class="stat-card"><h4>' + escapeHtml(label) + '</h4><p>' + escapeHtml(value) + '</p></div>';
  }

  function labelGoal(g) {
    var map = { lose_weight: 'Lose Weight', gain_muscle: 'Gain Muscle', maintain: 'Maintain', improve_fitness: 'Improve Fitness' };
    return map[g] || g;
  }

  /* ---- Profile ---- */
  function initProfileForm(session) {
    var form = document.getElementById('profileForm');
    if (!form) return;
    var user = getFreshUser(session.username);
    var profile = user.profile || {};

    var ageEl = document.getElementById('age'), genderEl = document.getElementById('gender'),
      weightEl = document.getElementById('weight'), heightEl = document.getElementById('height'), goalEl = document.getElementById('goal');
    if (ageEl) ageEl.value = profile.age || '';
    if (genderEl) genderEl.value = profile.gender || '';
    if (weightEl) weightEl.value = profile.weight || '';
    if (heightEl) heightEl.value = profile.height || '';
    if (goalEl) goalEl.value = profile.goal || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      updateCurrentUser(session.username, function (u) {
        u.profile = {
          age: ageEl.value, gender: genderEl.value, weight: weightEl.value, height: heightEl.value, goal: goalEl.value
        };
      });
      var msgEl = document.getElementById('profileMessage');
      showMessage(msgEl, 'Profile saved!', 'success');
      renderProgressAndReports(session);
    });
  }

  function updateCurrentUser(username, mutateFn) {
    var users = getUsers();
    var u = users.filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    mutateFn(u);
    saveUsers(users);
  }

  /* ============================================================
     FITNESS COACH DASHBOARD
     Use cases: Create Workout Plan, Update Performance Analytics
  ============================================================ */
  function initDashboardCoach() {
    if (page() !== 'dashboard-coach') return;
    var session = requireRole('coach');
    if (!session) return;
    initSectionNav();

    var nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    fillUserSelect('workoutUserSelect');
    fillUserSelect('performanceUserSelect');

    initWorkoutPlanEditor(session);
    initPerformanceEditor(session);
    renderCoachBookings(session);
  }

  function fillUserSelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var users = getUsersByRole('user');
    sel.innerHTML = '<option value="">Select a gym user</option>' +
      users.map(function (u) { return '<option value="' + escapeHtml(u.username) + '">' + escapeHtml(u.fullName || u.username) + '</option>'; }).join('');
  }

  var workoutDraft = { days: [] };

  function initWorkoutPlanEditor(session) {
    var sel = document.getElementById('workoutUserSelect');
    var addDayBtn = document.getElementById('addDayBtn');
    var saveBtn = document.getElementById('saveWorkoutBtn');
    var daysBox = document.getElementById('workoutDaysBox');
    var titleEl = document.getElementById('workoutTitle');
    var msgEl = document.getElementById('workoutMessage');
    if (!sel || !daysBox) return;

    sel.addEventListener('change', function () {
      showMessage(msgEl, '', '');
      var plans = read(KEYS.WORKOUTS, {});
      var existing = sel.value ? plans[sel.value] : null;
      workoutDraft = existing ? JSON.parse(JSON.stringify(existing)) : { title: '', days: [] };
      titleEl.value = workoutDraft.title || '';
      renderDays();
    });

    addDayBtn.addEventListener('click', function () {
      workoutDraft.days.push({ name: 'Day ' + (workoutDraft.days.length + 1), exercises: [] });
      renderDays();
    });

    function renderDays() {
      daysBox.innerHTML = '';
      workoutDraft.days.forEach(function (day, dIdx) {
        var dayEl = document.createElement('div');
        dayEl.className = 'plan-day';
        dayEl.innerHTML =
          '<div class="form-group"><label>Day name</label>' +
          '<input type="text" data-day-name="' + dIdx + '" value="' + escapeHtml(day.name) + '"></div>' +
          '<div data-ex-list="' + dIdx + '"></div>' +
          '<button type="button" class="btn-secondary" data-add-ex="' + dIdx + '">+ Add exercise</button>' +
          '<button type="button" class="btn-danger" data-del-day="' + dIdx + '">Remove day</button>';
        daysBox.appendChild(dayEl);
        renderExercises(dIdx);
      });

      Array.prototype.slice.call(daysBox.querySelectorAll('[data-day-name]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          workoutDraft.days[Number(inp.getAttribute('data-day-name'))].name = inp.value;
        });
      });
      Array.prototype.slice.call(daysBox.querySelectorAll('[data-add-ex]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-add-ex'));
          workoutDraft.days[idx].exercises.push({ name: '', sets: '3', reps: '10' });
          renderDays();
        });
      });
      Array.prototype.slice.call(daysBox.querySelectorAll('[data-del-day]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          workoutDraft.days.splice(Number(btn.getAttribute('data-del-day')), 1);
          renderDays();
        });
      });
    }

    function renderExercises(dIdx) {
      var box = daysBox.querySelector('[data-ex-list="' + dIdx + '"]');
      if (!box) return;
      box.innerHTML = (workoutDraft.days[dIdx].exercises || []).map(function (ex, eIdx) {
        return '<div class="form-group" style="display:flex; gap:.5rem; align-items:center;">' +
          '<input type="text" placeholder="Exercise" style="flex:2" data-ex-name="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.name) + '">' +
          '<input type="text" placeholder="Sets" style="flex:1" data-ex-sets="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.sets) + '">' +
          '<input type="text" placeholder="Reps" style="flex:1" data-ex-reps="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.reps) + '">' +
          '<button type="button" class="btn-danger" data-del-ex="' + dIdx + '-' + eIdx + '">×</button>' +
          '</div>';
      }).join('');

      Array.prototype.slice.call(box.querySelectorAll('[data-ex-name]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          var parts = inp.getAttribute('data-ex-name').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].name = inp.value;
        });
      });
      Array.prototype.slice.call(box.querySelectorAll('[data-ex-sets]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          var parts = inp.getAttribute('data-ex-sets').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].sets = inp.value;
        });
      });
      Array.prototype.slice.call(box.querySelectorAll('[data-ex-reps]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          var parts = inp.getAttribute('data-ex-reps').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].reps = inp.value;
        });
      });
      Array.prototype.slice.call(box.querySelectorAll('[data-del-ex]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var parts = btn.getAttribute('data-del-ex').split('-');
          workoutDraft.days[Number(parts[0])].exercises.splice(Number(parts[1]), 1);
          renderExercises(Number(parts[0]));
        });
      });
    }

    saveBtn.addEventListener('click', function () {
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      var plans = read(KEYS.WORKOUTS, {});
      plans[sel.value] = {
        title: titleEl.value || 'My Workout Plan',
        coachUsername: session.username,
        days: workoutDraft.days,
        updatedAt: new Date().toISOString(),
        createdAt: (plans[sel.value] && plans[sel.value].createdAt) || new Date().toISOString()
      };
      write(KEYS.WORKOUTS, plans);
      showMessage(msgEl, 'Workout plan saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
    });
  }

  function initPerformanceEditor(session) {
    var sel = document.getElementById('performanceUserSelect');
    var form = document.getElementById('performanceForm');
    var historyBox = document.getElementById('performanceHistory');
    if (!sel || !form) return;

    sel.addEventListener('change', function () { renderHistory(); });

    function renderHistory() {
      historyBox.innerHTML = '';
      if (!sel.value) { historyBox.innerHTML = '<p><em>Select a gym user to see their history.</em></p>'; return; }
      var data = read(KEYS.PERFORMANCE, {});
      var records = (data[sel.value] || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      if (!records.length) { historyBox.innerHTML = '<p><em>No performance records yet.</em></p>'; return; }
      var html = '<table class="data-table"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Body fat %</th><th>Notes</th></tr></thead><tbody>';
      records.forEach(function (r) {
        html += '<tr><td>' + formatDate(r.date) + '</td><td>' + escapeHtml(r.weight) + '</td><td>' + escapeHtml(r.bodyFat || '—') + '</td><td>' + escapeHtml(r.notes || '') + '</td></tr>';
      });
      html += '</tbody></table>';
      historyBox.innerHTML = html;
    }
    renderHistory();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msgEl = document.getElementById('performanceMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      var date = document.getElementById('perfDate').value || todayISO();
      var weight = document.getElementById('perfWeight').value;
      var bodyFat = document.getElementById('perfBodyFat').value;
      var notes = document.getElementById('perfNotes').value;
      if (!weight) { showMessage(msgEl, 'Weight is required.', 'error'); return; }

      var data = read(KEYS.PERFORMANCE, {});
      if (!data[sel.value]) data[sel.value] = [];
      data[sel.value].push({ date: date, weight: weight, bodyFat: bodyFat, notes: notes, coachUsername: session.username });
      write(KEYS.PERFORMANCE, data);

      showMessage(msgEl, 'Performance record added.', 'success');
      form.reset();
      renderHistory();
    });
  }

  function renderCoachBookings(session) {
    var box = document.getElementById('coachBookings');
    if (!box) return;
    var bookings = read(KEYS.BOOKINGS, []).filter(function (b) { return b.providerUsername === session.username; });
    bookings.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? 1 : -1; });
    if (!bookings.length) { box.innerHTML = '<p><em>No upcoming sessions booked yet.</em></p>'; return; }
    var html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>';
    bookings.forEach(function (b) {
      var u = findUser(b.username);
      html += '<tr><td>' + escapeHtml(u ? (u.fullName || u.username) : b.username) + '</td><td>' + formatDate(b.date) + '</td><td>' + escapeHtml(b.time) + '</td><td>' + escapeHtml(b.status) + '</td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  }

  /* ============================================================
     HEALTH ADVISER DASHBOARD
     Use cases: Generate Health Report, Create Diet Plan
  ============================================================ */
  function initDashboardAdviser() {
    if (page() !== 'dashboard-adviser') return;
    var session = requireRole('adviser');
    if (!session) return;
    initSectionNav();

    var nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    fillUserSelect('reportUserSelect');
    fillUserSelect('dietUserSelect');

    initHealthReportEditor(session);
    initDietPlanEditor(session);
    renderAdviserBookings(session);
  }

  function initHealthReportEditor(session) {
    var sel = document.getElementById('reportUserSelect');
    var form = document.getElementById('reportForm');
    if (!sel || !form) return;

    var bmiEl = document.getElementById('reportBmi'), bpEl = document.getElementById('reportBp'),
      summaryEl = document.getElementById('reportSummary'), recEl = document.getElementById('reportRecommendations');

    sel.addEventListener('change', function () {
      var reports = read(KEYS.REPORTS, {});
      var existing = sel.value ? reports[sel.value] : null;
      var user = sel.value ? findUser(sel.value) : null;

      if (existing) {
        bmiEl.value = existing.bmi || ''; bpEl.value = existing.bloodPressure || '';
        summaryEl.value = existing.summary || ''; recEl.value = existing.recommendations || '';
      } else {
        var autoBmi = '';
        if (user && user.profile && user.profile.weight && user.profile.height) {
          var h = user.profile.height / 100;
          autoBmi = (user.profile.weight / (h * h)).toFixed(1);
        }
        bmiEl.value = autoBmi; bpEl.value = ''; summaryEl.value = ''; recEl.value = '';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msgEl = document.getElementById('reportMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      var reports = read(KEYS.REPORTS, {});
      reports[sel.value] = {
        adviserUsername: session.username, bmi: bmiEl.value, bloodPressure: bpEl.value,
        summary: summaryEl.value, recommendations: recEl.value, createdAt: new Date().toISOString()
      };
      write(KEYS.REPORTS, reports);
      showMessage(msgEl, 'Health report saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
    });
  }

  function initDietPlanEditor(session) {
    var sel = document.getElementById('dietUserSelect');
    var form = document.getElementById('dietForm');
    if (!sel || !form) return;

    var bEl = document.getElementById('dietBreakfast'), lEl = document.getElementById('dietLunch'),
      dEl = document.getElementById('dietDinner'), sEl = document.getElementById('dietSnacks'), nEl = document.getElementById('dietNotes');

    sel.addEventListener('change', function () {
      var diets = read(KEYS.DIETS, {});
      var existing = sel.value ? diets[sel.value] : null;
      bEl.value = existing ? existing.breakfast || '' : '';
      lEl.value = existing ? existing.lunch || '' : '';
      dEl.value = existing ? existing.dinner || '' : '';
      sEl.value = existing ? existing.snacks || '' : '';
      nEl.value = existing ? existing.notes || '' : '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msgEl = document.getElementById('dietMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      var diets = read(KEYS.DIETS, {});
      diets[sel.value] = {
        adviserUsername: session.username, breakfast: bEl.value, lunch: lEl.value, dinner: dEl.value,
        snacks: sEl.value, notes: nEl.value, createdAt: new Date().toISOString()
      };
      write(KEYS.DIETS, diets);
      showMessage(msgEl, 'Diet plan saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
    });
  }

  function renderAdviserBookings(session) {
    var box = document.getElementById('adviserBookings');
    if (!box) return;
    var bookings = read(KEYS.BOOKINGS, []).filter(function (b) { return b.providerUsername === session.username; });
    bookings.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? 1 : -1; });
    if (!bookings.length) { box.innerHTML = '<p><em>No upcoming consultations booked yet.</em></p>'; return; }
    var html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>';
    bookings.forEach(function (b) {
      var u = findUser(b.username);
      html += '<tr><td>' + escapeHtml(u ? (u.fullName || u.username) : b.username) + '</td><td>' + formatDate(b.date) + '</td><td>' + escapeHtml(b.time) + '</td><td>' + escapeHtml(b.status) + '</td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  }

  /* ============================================================
     ADMIN DASHBOARD
     Use cases: View All Users, Manage Users, Manage Membership
  ============================================================ */
  function initDashboardAdmin() {
    if (page() !== 'dashboard-admin') return;
    var session = requireRole('admin');
    if (!session) return;
    initSectionNav();

    var nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    renderUserStats();
    renderAllUsersReadonly();
    renderUsersTable(session);
    initUserFilter(session);
    renderPlansAdmin();
    initAddPlanForm();
    renderSubscriptionsTable();
  }

  function renderUserStats() {
    var box = document.getElementById('adminStats');
    if (!box) return;
    var users = getUsers();
    var byRole = { user: 0, coach: 0, adviser: 0, admin: 0 };
    users.forEach(function (u) { if (byRole[u.role] !== undefined) byRole[u.role]++; });
    box.innerHTML =
      statCard('Total accounts', users.length) +
      statCard('Gym users', byRole.user) +
      statCard('Coaches', byRole.coach) +
      statCard('Health advisers', byRole.adviser) +
      statCard('Admins', byRole.admin);
  }

  /* ---- View All Users (read-only) ---- */
  function renderAllUsersReadonly() {
    var box = document.getElementById('allUsersBox');
    if (!box) return;
    var users = getUsers().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var html = '<table class="data-table"><thead><tr><th>Username</th><th>Role</th><th>Joined</th></tr></thead><tbody>';
    users.forEach(function (u) {
      html += '<tr><td>' + escapeHtml(u.fullName || u.username) + '</td><td>' + ROLE_LABEL[u.role] + '</td><td>' + formatDate(u.createdAt) + '</td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  }

  /* ---- View All Users + Manage Users ---- */
  function initUserFilter(session) {
    var filterSel = document.getElementById('userRoleFilter');
    if (!filterSel) return;
    filterSel.addEventListener('change', function () { renderUsersTable(session, filterSel.value); });
  }

  function renderUsersTable(session, roleFilter) {
    var box = document.getElementById('usersTableBox');
    if (!box) return;
    var users = getUsers().filter(function (u) { return !roleFilter || u.role === roleFilter; });

    var html = '<table class="data-table"><thead><tr><th>Username</th><th>Role</th><th>Joined</th><th>Membership</th><th>Actions</th></tr></thead><tbody>';
    users.forEach(function (u) {
      var membership = u.membership ? u.membership.status : '—';
      html += '<tr>' +
        '<td>' + escapeHtml(u.fullName || u.username) + '</td>' +
        '<td>' +
          '<select data-role-select="' + escapeHtml(u.username) + '">' +
            ['user', 'coach', 'adviser', 'admin'].map(function (r) {
              return '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>';
            }).join('') +
          '</select>' +
        '</td>' +
        '<td>' + formatDate(u.createdAt) + '</td>' +
        '<td>' + escapeHtml(membership) + '</td>' +
        '<td>' +
          '<button type="button" class="btn-secondary" data-reset-pw="' + escapeHtml(u.username) + '">Reset PW</button> ' +
          '<button type="button" class="btn-danger" data-delete-user="' + escapeHtml(u.username) + '"' + (u.username === session.username ? ' disabled title="You cannot delete your own account"' : '') + '>Delete</button>' +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;

    Array.prototype.slice.call(box.querySelectorAll('[data-role-select]')).forEach(function (sel) {
      sel.addEventListener('change', function () {
        var username = sel.getAttribute('data-role-select');
        var users = getUsers();
        var u = users.filter(function (x) { return x.username === username; })[0];
        if (!u) return;
        if (u.role === 'admin' && sel.value !== 'admin' && getUsersByRole('admin').length <= 1) {
          window.alert('You cannot remove the last remaining admin.');
          sel.value = 'admin';
          return;
        }
        u.role = sel.value;
        if (u.role === 'user' && !u.profile) { u.profile = { age: '', gender: '', weight: '', height: '', goal: '' }; u.membership = { planId: null, planName: null, status: 'none', startDate: null }; }
        saveUsers(users);
        renderUserStats();
        renderAllUsersReadonly();
        renderUsersTable(session, document.getElementById('userRoleFilter') ? document.getElementById('userRoleFilter').value : '');
        renderSubscriptionsTable();
      });
    });

    Array.prototype.slice.call(box.querySelectorAll('[data-reset-pw]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var username = btn.getAttribute('data-reset-pw');
        if (!window.confirm('Reset password for ' + username + ' to "changeme123"?')) return;
        var users = getUsers();
        var u = users.filter(function (x) { return x.username === username; })[0];
        if (u) { u.password = 'changeme123'; saveUsers(users); window.alert('Password reset to: changeme123'); }
      });
    });

    Array.prototype.slice.call(box.querySelectorAll('[data-delete-user]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var username = btn.getAttribute('data-delete-user');
        if (!window.confirm('Delete account "' + username + '"? This cannot be undone.')) return;
        var users = getUsers().filter(function (x) { return x.username !== username; });
        saveUsers(users);
        renderUserStats();
        renderAllUsersReadonly();
        renderUsersTable(session, document.getElementById('userRoleFilter') ? document.getElementById('userRoleFilter').value : '');
        renderSubscriptionsTable();
      });
    });
  }

  /* ---- Manage Membership: plans + subscriptions ---- */
  function renderPlansAdmin() {
    var box = document.getElementById('plansAdminBox');
    if (!box) return;
    var plans = read(KEYS.PLANS, []);
    box.innerHTML = '';
    plans.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML =
        '<div class="form-group"><label>Plan name</label><input type="text" data-plan-name="' + p.id + '" value="' + escapeHtml(p.name) + '"></div>' +
        '<div class="form-group"><label>Price (USD)</label><input type="number" min="0" step="0.01" data-plan-price="' + p.id + '" value="' + escapeHtml(p.price) + '"></div>' +
        '<div class="form-group"><label>Billing period</label>' +
          '<select data-plan-period="' + p.id + '">' +
            ['month', 'year'].map(function (per) { return '<option value="' + per + '"' + (per === p.period ? ' selected' : '') + '>' + per + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="form-group"><label>Features (one per line)</label><textarea rows="3" data-plan-features="' + p.id + '">' + escapeHtml((p.features || []).join('\n')) + '</textarea></div>' +
        '<button type="button" class="btn-success" data-save-plan="' + p.id + '">Save</button> ' +
        '<button type="button" class="btn-danger" data-delete-plan="' + p.id + '">Delete plan</button>';
      box.appendChild(card);
    });

    Array.prototype.slice.call(box.querySelectorAll('[data-save-plan]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-save-plan');
        var plans = read(KEYS.PLANS, []);
        var p = plans.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        p.name = box.querySelector('[data-plan-name="' + id + '"]').value;
        p.price = Number(box.querySelector('[data-plan-price="' + id + '"]').value) || 0;
        p.period = box.querySelector('[data-plan-period="' + id + '"]').value;
        p.features = box.querySelector('[data-plan-features="' + id + '"]').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        write(KEYS.PLANS, plans);

        var users = getUsers();
        users.forEach(function (u) { if (u.membership && u.membership.planId === id) u.membership.planName = p.name; });
        saveUsers(users);

        window.alert('Plan saved.');
        renderSubscriptionsTable();
      });
    });
    Array.prototype.slice.call(box.querySelectorAll('[data-delete-plan]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete-plan');
        if (!window.confirm('Delete this plan? Existing subscribers keep their plan name but it will no longer be offered.')) return;
        var plans = read(KEYS.PLANS, []).filter(function (x) { return x.id !== id; });
        write(KEYS.PLANS, plans);
        renderPlansAdmin();
      });
    });
  }

  function initAddPlanForm() {
    var form = document.getElementById('addPlanForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('newPlanName').value.trim();
      var price = Number(document.getElementById('newPlanPrice').value);
      var period = document.getElementById('newPlanPeriod').value;
      if (!name || !price) return;
      var plans = read(KEYS.PLANS, []);
      plans.push({ id: uid('plan'), name: name, price: price, period: period, features: [] });
      write(KEYS.PLANS, plans);
      form.reset();
      renderPlansAdmin();
    });
  }

  function renderSubscriptionsTable() {
    var box = document.getElementById('subscriptionsBox');
    if (!box) return;
    var users = getUsersByRole('user');
    var html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Plan</th><th>Status</th><th>Since</th><th>Action</th></tr></thead><tbody>';
    users.forEach(function (u) {
      var m = u.membership || { status: 'none' };
      html += '<tr>' +
        '<td>' + escapeHtml(u.fullName || u.username) + '</td>' +
        '<td>' + escapeHtml(m.planName || '—') + '</td>' +
        '<td>' + escapeHtml(m.status) + '</td>' +
        '<td>' + formatDate(m.startDate) + '</td>' +
        '<td>' + (m.status === 'active' ? '<button type="button" class="btn-danger" data-revoke="' + escapeHtml(u.username) + '">Revoke</button>' : '<em>—</em>') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;

    Array.prototype.slice.call(box.querySelectorAll('[data-revoke]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var username = btn.getAttribute('data-revoke');
        if (!window.confirm('Revoke membership for ' + username + '?')) return;
        updateCurrentUser(username, function (u) { u.membership = { planId: null, planName: null, status: 'cancelled', startDate: null }; });
        renderSubscriptionsTable();
        renderUsersTable(getSession());
      });
    });
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    seed();
    initHeader();
    initHomePage();
    initLoginPage();
    initRegisterPage();
    initDashboardUser();
    initDashboardCoach();
    initDashboardAdviser();
    initDashboardAdmin();
  });
})();
