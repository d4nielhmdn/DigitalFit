/* ============================================================
   DigitalFit – Client-side application logic (PHP Backend)
   Calls REST API endpoints under /api/
   ============================================================ */
(function () {
  'use strict';

  /* ── API helpers ─────────────────────────────────────── */
  const API = 'api/';

  async function api(method, endpoint, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(API + endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function apiUpload(endpoint, formData) {
    const res = await fetch(API + endpoint, { method: 'POST', body: formData, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  const SESSION_DURATION_MIN = 60;
  const MAX_DOC_BYTES = 2 * 1024 * 1024;

  /* ── Utility ─────────────────────────────────────────── */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str === null || str === undefined ? '' : String(str);
    return div.innerHTML;
  }
  function page() { return document.body.getAttribute('data-page') || ''; }
  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'status-message' + (type ? ' ' + type : '');
    el.style.display = text ? 'block' : 'none';
  }
  function formatMoney(n) { return 'RM ' + Number(n || 0).toFixed(2); }
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const ROLE_DASHBOARD = {
    user: 'dashboard-user.html', coach: 'dashboard-coach.html',
    adviser: 'dashboard-adviser.html', admin: 'dashboard-admin.html'
  };
  const ROLE_LABEL = { user: 'Gym User', coach: 'Fitness Coach', adviser: 'Health Adviser', admin: 'Admin' };

  /* ── Session state ───────────────────────────────────── */
  let currentSession = null;

  async function fetchSession() {
    try {
      const data = await api('GET', 'session.php');
      currentSession = data.user;
      return currentSession;
    } catch (e) {
      currentSession = null;
      return null;
    }
  }

  function getSession() { return currentSession; }

  async function requireRole(role) {
    const session = await fetchSession();
    if (!session || session.role !== role) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  async function redirectIfLoggedIn() {
    const session = await fetchSession();
    if (session && ROLE_DASHBOARD[session.role]) {
      window.location.href = ROLE_DASHBOARD[session.role];
    }
  }

  /* ── Header ──────────────────────────────────────────── */
  function initHeader() {
    const infoEl = document.getElementById('headerUserInfo');
    if (infoEl && currentSession) {
      infoEl.textContent = (currentSession.fullName || currentSession.username) + ' · ' + ROLE_LABEL[currentSession.role];
      infoEl.style.display = 'inline';
    }
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', async function (e) {
        e.preventDefault();
        await api('POST', 'logout.php');
        window.location.href = 'login.html';
      });
    }
  }

  /* ── Section nav ─────────────────────────────────────── */
  function initSectionNav() {
    const menu = document.querySelector('.menu');
    if (!menu) return;
    const links = Array.from(menu.querySelectorAll('a[data-section]'));
    if (!links.length) return;
    const sections = Array.from(document.querySelectorAll('.section[id]'));
    function show(id) {
      sections.forEach(s => s.classList.toggle('hidden', s.id !== id));
      links.forEach(l => l.classList.toggle('active', l.getAttribute('data-section') === id));
    }
    links.forEach(l => {
      l.addEventListener('click', function (e) {
        e.preventDefault();
        show(l.getAttribute('data-section'));
      });
    });
    let startId = (window.location.hash || '').replace('#', '');
    if (!startId || !links.some(l => l.getAttribute('data-section') === startId)) {
      startId = links[0].getAttribute('data-section');
    }
    show(startId);
  }

  function goToSection(sectionId) {
    const link = document.querySelector('a[data-section="' + sectionId + '"]');
    if (link) link.click();
  }

  /* ── Payment modal ───────────────────────────────────── */
  function closePaymentModal() {
    const existing = document.getElementById('paymentModal');
    if (existing) existing.remove();
  }

  function showPaymentModal(amount, description, onSuccess) {
    closePaymentModal();
    const modal = document.createElement('div');
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
      const card = document.getElementById('pmCard').value.replace(/\s+/g, '');
      const expiry = document.getElementById('pmExpiry').value.trim();
      const cvv = document.getElementById('pmCvv').value.trim();
      const statusEl = document.getElementById('paymentStatus');
      if (card.length < 12 || !/^\d{2}\/\d{2}$/.test(expiry) || cvv.length < 3) {
        showMessage(statusEl, 'Enter a valid (mock) card number, MM/YY expiry and CVV.', 'error');
        return;
      }
      showMessage(statusEl, 'Processing payment…', '');
      setTimeout(function () {
        showMessage(statusEl, 'Payment successful!', 'success');
        setTimeout(function () {
          closePaymentModal();
          onSuccess();
        }, 600);
      }, 700);
    });
  }

  /* ========================================================
     PUBLIC PAGES: index / login / register
  ======================================================== */
  function initHomePage() {
    if (page() !== 'home') return;
    redirectIfLoggedIn();
  }

  function initLoginPage() {
    if (page() !== 'login') return;
    redirectIfLoggedIn();
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('loginMessage');
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      try {
        const data = await api('POST', 'login.php', { username, password, role });
        currentSession = data.user;
        showMessage(msgEl, 'Login successful! Redirecting…', 'success');
        setTimeout(() => { window.location.href = data.redirect; }, 500);
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  function initRegisterPage() {
    if (page() !== 'register') return;
    redirectIfLoggedIn();
    const form = document.getElementById('registerForm');
    if (!form) return;

    const roleEl = document.getElementById('regRole');
    const docGroup = document.getElementById('regDocumentGroup');
    const docInput = document.getElementById('regDocument');

    function syncDocVisibility() {
      const needsDoc = roleEl.value === 'coach' || roleEl.value === 'adviser';
      if (docGroup) docGroup.classList.toggle('hidden', !needsDoc);
      if (docInput) {
        if (needsDoc) docInput.setAttribute('required', 'required');
        else docInput.removeAttribute('required');
      }
    }
    if (roleEl) { roleEl.addEventListener('change', syncDocVisibility); syncDocVisibility(); }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('registerMessage');
      const username = document.getElementById('regUsername').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirmPwd = document.getElementById('regConfirmPassword').value;
      const role = roleEl.value;

      if (!username || !password || !role) { showMessage(msgEl, 'Please fill in all fields.', 'error'); return; }
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) { showMessage(msgEl, 'Username must be 3-20 characters (letters, numbers, _ or .).', 'error'); return; }
      if (password.length < 6) { showMessage(msgEl, 'Password must be at least 6 characters.', 'error'); return; }
      if (password !== confirmPwd) { showMessage(msgEl, 'Passwords do not match.', 'error'); return; }

      const needsDoc = role === 'coach' || role === 'adviser';
      const file = docInput && docInput.files && docInput.files[0];

      if (needsDoc) {
        if (!file) { showMessage(msgEl, 'Please upload a certification or ID image for admin review.', 'error'); return; }
        if (!/^image\//.test(file.type)) { showMessage(msgEl, 'The uploaded file must be an image.', 'error'); return; }
        if (file.size > MAX_DOC_BYTES) { showMessage(msgEl, 'Image must be smaller than 2MB.', 'error'); return; }
      }

      try {
        const fd = new FormData();
        fd.append('username', username);
        fd.append('password', password);
        fd.append('role', role);
        if (needsDoc && file) fd.append('document', file);

        const data = await apiUpload('register.php', fd);
        showMessage(msgEl, data.message, 'success');
        form.reset();
        syncDocVisibility();
        setTimeout(() => { window.location.href = 'login.html'; }, 1600);
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  /* ========================================================
     GYM USER DASHBOARD
  ======================================================== */
  async function initDashboardUser() {
    if (page() !== 'dashboard-user') return;
    const session = await requireRole('user');
    if (!session) return;
    initSectionNav();

    renderWelcome(session);
    await renderWorkoutPlan(session);
    await renderMembership(session);
    await initBookingFlow(session);
    await renderProgressAndReports(session);
    initProfileForm(session);
  }

  async function getFreshUser(username) {
    const data = await api('GET', 'users.php?action=get&username=' + encodeURIComponent(username));
    return data.user;
  }

  function renderWelcome(session) {
    const el = document.getElementById('welcomeName');
    if (el) el.textContent = session.fullName || session.username;
  }

  /* ── Workout Plan ───────────────────────────────────── */
  async function renderWorkoutPlan(session) {
    const box = document.getElementById('workoutPlanBox');
    if (!box) return;
    const user = await getFreshUser(session.username);
    const member = !!(user.membership && user.membership.status === 'active');

    if (!member) {
      box.innerHTML = '<p>Personalised workout plans are a Membership benefit. ' +
        '<a href="#" data-jump="membership">Subscribe to Membership</a> (RM 15.00/month) to unlock yours.</p>';
      wireJumpLinks(box);
      return;
    }

    try {
      const data = await api('GET', 'workouts.php?username=' + encodeURIComponent(session.username));
      const plan = data.plan;
      if (!plan) {
        box.innerHTML = '<p>You don\'t have a workout plan yet. Book a session with a coach and they\'ll build one for you.</p>';
        return;
      }
      let html = '<p><strong>Plan:</strong> ' + escapeHtml(plan.title || 'My Workout Plan') +
        ' · <em>updated ' + formatDate(plan.updated_at) + '</em></p>';
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
    } catch (e) {
      box.innerHTML = '<p><em>Could not load workout plan.</em></p>';
    }
  }

  function wireJumpLinks(scope) {
    Array.from(scope.querySelectorAll('[data-jump]')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goToSection(a.getAttribute('data-jump'));
      });
    });
  }

  /* ── Membership ──────────────────────────────────────── */
  async function renderMembership(session) {
    const cardBox = document.getElementById('membershipPlans');
    const statusBox = document.getElementById('membershipStatus');
    if (!cardBox && !statusBox) return;

    let plans = [];
    try { const d = await api('GET', 'plans.php'); plans = d.plans; } catch (e) { /* ignore */ }
    const plan = plans[0];
    const user = await getFreshUser(session.username);
    const membership = user.membership || { status: 'none' };

    if (statusBox) {
      if (membership.status === 'active') {
        statusBox.innerHTML =
          '<div class="status-message success">Active Membership since ' + formatDate(membership.start_date) +
          ' — unlimited bookings and full features.</div>' +
          '<button id="cancelMembershipBtn" type="button" class="btn-danger">Cancel membership</button>';
        const cancelBtn = document.getElementById('cancelMembershipBtn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', async function () {
            if (!window.confirm('Cancel your Membership?')) return;
            try { await api('POST', 'plans.php', { action: 'cancel' }); } catch (e) { /* ignore */ }
            await renderMembership(session);
            await renderWorkoutPlan(session);
            await renderProgressAndReports(session);
            refreshBookingEligibilityIfPresent(session);
          });
        }
      } else if (membership.status === 'cancelled') {
        statusBox.innerHTML = '<div class="status-message error">Your membership was cancelled. Subscribe again to regain unlimited bookings and full features.</div>';
      } else {
        statusBox.innerHTML = '<div class="status-message">' +
          (user.free_session_used ? 'You\'ve used your free session.' : 'You have 1 free session available.') +
          ' Subscribe to Membership for unlimited bookings and full features.</div>';
      }
    }

    if (cardBox && plan) {
      const isActive = membership.status === 'active';
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML =
        '<h4>' + escapeHtml(plan.name) + ' — ' + formatMoney(plan.price) + ' / ' + escapeHtml(plan.period) + '</h4>' +
        '<ul>' + (plan.features || []).map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn-primary" ' + (isActive ? 'disabled' : '') + '>' +
        (isActive ? 'Current plan' : 'Subscribe') + '</button>';
      const btn = card.querySelector('button');
      if (!isActive) {
        btn.addEventListener('click', function () {
          showPaymentModal(plan.price, 'Subscribe to ' + plan.name + ' (' + formatMoney(plan.price) + '/' + plan.period + ')', async function () {
            try { await api('POST', 'plans.php', { action: 'subscribe' }); } catch (e) { /* ignore */ }
            await renderMembership(session);
            await renderWorkoutPlan(session);
            await renderProgressAndReports(session);
            refreshBookingEligibilityIfPresent(session);
          });
        });
      }
      cardBox.innerHTML = '';
      cardBox.appendChild(card);
    }
  }

  /* ── Bookings ────────────────────────────────────────── */
  let refreshBookingEligibilityFn = null;
  function refreshBookingEligibilityIfPresent(session) {
    if (refreshBookingEligibilityFn) refreshBookingEligibilityFn(session);
  }

  async function getBookingEligibility(user) {
    if (user.membership && user.membership.status === 'active') {
      return { allowed: true, message: 'You have an active Membership — book unlimited sessions.' };
    }
    if (!user.free_session_used) {
      return { allowed: true, message: 'You have 1 free session available. After that, Membership (RM 15.00/month) gives unlimited bookings.' };
    }
    return { allowed: false, message: 'You\'ve used your free session. Subscribe to Membership for unlimited bookings.' };
  }

  async function initBookingFlow(session) {
    const typeSel = document.getElementById('bookingType');
    const providerSel = document.getElementById('bookingProvider');
    const form = document.getElementById('bookingForm');
    const listBox = document.getElementById('myBookings');
    const eligBox = document.getElementById('bookingEligibility');
    if (!form) return;

    async function fillProviders() {
      const role = typeSel.value;
      try {
        const data = await api('GET', 'users.php?action=list&role=' + role);
        providerSel.innerHTML = '<option value="">Select ' + (role === 'coach' ? 'a coach' : 'a health adviser') + '</option>' +
          data.users.map(function (p) { return '<option value="' + escapeHtml(p.username) + '">' + escapeHtml(p.full_name || p.fullName || p.username) + '</option>'; }).join('');
      } catch (e) {
        providerSel.innerHTML = '<option value="">—</option>';
      }
    }
    typeSel.addEventListener('change', fillProviders);
    fillProviders();

    async function refreshEligibility() {
      const user = await getFreshUser(session.username);
      const elig = await getBookingEligibility(user);
      if (eligBox) {
        eligBox.innerHTML = '<div class="status-message ' + (elig.allowed ? 'success' : 'error') + '">' + escapeHtml(elig.message) + '</div>' +
          (!elig.allowed ? '<button type="button" id="goToMembershipBtn" class="btn-primary">Go to Membership</button>' : '');
        const goBtn = document.getElementById('goToMembershipBtn');
        if (goBtn) goBtn.addEventListener('click', function () { goToSection('membership'); });
      }
      form.classList.toggle('hidden', !elig.allowed);
    }
    refreshBookingEligibilityFn = refreshEligibility;
    refreshEligibility();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('bookingMessage');
      const user = await getFreshUser(session.username);
      const elig = await getBookingEligibility(user);
      if (!elig.allowed) { showMessage(msgEl, elig.message, 'error'); return; }

      const providerUsername = providerSel.value;
      const date = document.getElementById('bookingDate').value;
      const time = document.getElementById('bookingTime').value;

      if (!providerUsername || !date || !time) { showMessage(msgEl, 'Please complete all booking fields.', 'error'); return; }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(date) < today) { showMessage(msgEl, 'Please choose a date that is today or later.', 'error'); return; }

      try {
        await api('POST', 'bookings.php', { providerUsername, date, time });
        showMessage(msgEl, 'Booking confirmed!', 'success');
        form.reset();
        fillProviders();
        renderMyBookings(session, listBox);
        refreshEligibility();
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });

    renderMyBookings(session, listBox);
  }

  async function renderMyBookings(session, listBox) {
    if (!listBox) return;
    try {
      const data = await api('GET', 'bookings.php?type=my');
      const bookings = data.bookings;
      if (!bookings.length) { listBox.innerHTML = '<p><em>You have no bookings yet.</em></p>'; return; }
      let html = '<table class="data-table"><thead><tr><th>With</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>';
      bookings.forEach(function (b) {
        html += '<tr>' +
          '<td>' + escapeHtml(b.provider_name || b.provider_id) + '</td>' +
          '<td>' + formatDate(b.booking_date) + '</td>' +
          '<td>' + escapeHtml(b.booking_time) + '</td>' +
          '<td>' + escapeHtml(b.status) + '</td>' +
          '<td>' + (b.status === 'confirmed' ? '<button type="button" class="btn-danger" data-cancel="' + b.id + '">Cancel</button>' : '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      listBox.innerHTML = html;

      Array.from(listBox.querySelectorAll('[data-cancel]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const id = btn.getAttribute('data-cancel');
          try { await api('PUT', 'bookings.php', { id }); } catch (e) { /* ignore */ }
          renderMyBookings(session, listBox);
        });
      });
    } catch (e) {
      listBox.innerHTML = '<p><em>Could not load bookings.</em></p>';
    }
  }

  /* ── Progress & Reports ──────────────────────────────── */
  async function renderProgressAndReports(session) {
    const statsBox = document.getElementById('progressStats');
    const reportBox = document.getElementById('healthReportBox');
    const dietBox = document.getElementById('dietPlanBox');
    if (!statsBox && !reportBox && !dietBox) return;

    const user = await getFreshUser(session.username);
    const profile = user.profile || {};
    const member = !!(user.membership && user.membership.status === 'active');

    if (statsBox) {
      let bmi = '—';
      if (profile.weight_kg && profile.height_cm) {
        const h = profile.height_cm / 100;
        bmi = (profile.weight_kg / (h * h)).toFixed(1);
      }
      statsBox.innerHTML =
        statCard('Weight', profile.weight_kg ? profile.weight_kg + ' kg' : '—') +
        statCard('Height', profile.height_cm ? profile.height_cm + ' cm' : '—') +
        statCard('BMI', bmi) +
        statCard('Goal', profile.fitness_goal ? labelGoal(profile.fitness_goal) : '—') +
        statCard('Membership', member ? 'Active' : 'None');
    }

    const upsell = '<p>Health reports and diet plans are a Membership benefit. ' +
      '<a href="#" data-jump="membership">Subscribe to Membership</a> (RM 15.00/month) to unlock yours.</p>';

    if (reportBox) {
      if (!member) {
        reportBox.innerHTML = upsell;
        wireJumpLinks(reportBox);
      } else {
        try {
          const data = await api('GET', 'reports.php?username=' + encodeURIComponent(session.username));
          const report = data.report;
          if (!report) {
            reportBox.innerHTML = '<p><em>No health report yet. Book a session with a health adviser to get one.</em></p>';
          } else {
            reportBox.innerHTML =
              '<div class="plan-day"><p><strong>By:</strong> ' + escapeHtml(report.adviser_name || '—') +
              ' · <em>' + formatDate(report.created_at) + '</em></p>' +
              '<p><strong>BMI:</strong> ' + escapeHtml(report.bmi || '—') + ' · <strong>Blood pressure:</strong> ' + escapeHtml(report.blood_pressure || '—') + '</p>' +
              '<p><strong>Summary:</strong> ' + escapeHtml(report.summary || '—') + '</p>' +
              '<p><strong>Recommendations:</strong> ' + escapeHtml(report.recommendations || '—') + '</p></div>';
          }
        } catch (e) { reportBox.innerHTML = '<p><em>Could not load health report.</em></p>'; }
      }
    }

    if (dietBox) {
      if (!member) {
        dietBox.innerHTML = upsell;
        wireJumpLinks(dietBox);
      } else {
        try {
          const data = await api('GET', 'diets.php?username=' + encodeURIComponent(session.username));
          const diet = data.diet;
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
        } catch (e) { dietBox.innerHTML = '<p><em>Could not load diet plan.</em></p>'; }
      }
    }
  }

  function statCard(label, value) {
    return '<div class="stat-card"><h4>' + escapeHtml(label) + '</h4><p>' + escapeHtml(value) + '</p></div>';
  }
  function labelGoal(g) {
    const map = { lose_weight: 'Lose Weight', gain_muscle: 'Gain Muscle', maintain: 'Maintain', improve_fitness: 'Improve Fitness' };
    return map[g] || g;
  }

  /* ── Profile ─────────────────────────────────────────── */
  async function initProfileForm(session) {
    const form = document.getElementById('profileForm');
    if (!form) return;
    const user = await getFreshUser(session.username);
    const profile = user.profile || {};

    const ageEl = document.getElementById('age'), genderEl = document.getElementById('gender'),
      weightEl = document.getElementById('weight'), heightEl = document.getElementById('height'), goalEl = document.getElementById('goal');
    if (ageEl) ageEl.value = profile.age || '';
    if (genderEl) genderEl.value = profile.gender || '';
    if (weightEl) weightEl.value = profile.weight_kg || '';
    if (heightEl) heightEl.value = profile.height_cm || '';
    if (goalEl) goalEl.value = profile.fitness_goal || '';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api('PUT', 'users.php', {
          profile: {
            age: ageEl.value, gender: genderEl.value,
            weight: weightEl.value, height: heightEl.value, goal: goalEl.value
          }
        });
        showMessage(document.getElementById('profileMessage'), 'Profile saved!', 'success');
        renderProgressAndReports(session);
      } catch (err) {
        showMessage(document.getElementById('profileMessage'), err.message, 'error');
      }
    });
  }

  /* ========================================================
     FITNESS COACH DASHBOARD
  ======================================================== */
  async function initDashboardCoach() {
    if (page() !== 'dashboard-coach') return;
    const session = await requireRole('coach');
    if (!session) return;
    initSectionNav();

    const nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    fillUserSelect('workoutUserSelect');
    fillUserSelect('performanceUserSelect');

    initWorkoutPlanEditor(session);
    initPerformanceEditor(session);
    renderCoachBookings(session);
  }

  async function fillUserSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    try {
      const data = await api('GET', 'users.php?action=list&role=user');
      sel.innerHTML = '<option value="">Select a gym user</option>' +
        data.users.map(function (u) {
          const tag = (u.membership && u.membership.status === 'active') ? 'Member' : 'Free';
          return '<option value="' + escapeHtml(u.username) + '">' + escapeHtml(u.full_name || u.username) + ' (' + tag + ')</option>';
        }).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">—</option>';
    }
  }

  /* ── Workout Plan Editor ─────────────────────────────── */
  let workoutDraft = { days: [] };

  function initWorkoutPlanEditor(session) {
    const sel = document.getElementById('workoutUserSelect');
    const addDayBtn = document.getElementById('addDayBtn');
    const saveBtn = document.getElementById('saveWorkoutBtn');
    const daysBox = document.getElementById('workoutDaysBox');
    const titleEl = document.getElementById('workoutTitle');
    const msgEl = document.getElementById('workoutMessage');
    if (!sel || !daysBox) return;

    sel.addEventListener('change', async function () {
      showMessage(msgEl, '', '');
      workoutDraft = { title: '', days: [] };
      if (sel.value) {
        try {
          const data = await api('GET', 'workouts.php?username=' + encodeURIComponent(sel.value));
          if (data.plan) workoutDraft = JSON.parse(JSON.stringify(data.plan));
        } catch (e) { /* use empty draft */ }
      }
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
        const dayEl = document.createElement('div');
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

      Array.from(daysBox.querySelectorAll('[data-day-name]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          workoutDraft.days[Number(inp.getAttribute('data-day-name'))].name = inp.value;
        });
      });
      Array.from(daysBox.querySelectorAll('[data-add-ex]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const idx = Number(btn.getAttribute('data-add-ex'));
          workoutDraft.days[idx].exercises.push({ name: '', sets: '3', reps: '10' });
          renderDays();
        });
      });
      Array.from(daysBox.querySelectorAll('[data-del-day]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          workoutDraft.days.splice(Number(btn.getAttribute('data-del-day')), 1);
          renderDays();
        });
      });
    }

    function renderExercises(dIdx) {
      const box = daysBox.querySelector('[data-ex-list="' + dIdx + '"]');
      if (!box) return;
      box.innerHTML = (workoutDraft.days[dIdx].exercises || []).map(function (ex, eIdx) {
        return '<div class="form-group" style="display:flex; gap:.5rem; align-items:center;">' +
          '<input type="text" placeholder="Exercise" style="flex:2" data-ex-name="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.name) + '">' +
          '<input type="text" placeholder="Sets" style="flex:1" data-ex-sets="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.sets) + '">' +
          '<input type="text" placeholder="Reps" style="flex:1" data-ex-reps="' + dIdx + '-' + eIdx + '" value="' + escapeHtml(ex.reps) + '">' +
          '<button type="button" class="btn-danger" data-del-ex="' + dIdx + '-' + eIdx + '">×</button>' +
          '</div>';
      }).join('');

      Array.from(box.querySelectorAll('[data-ex-name]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          const parts = inp.getAttribute('data-ex-name').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].name = inp.value;
        });
      });
      Array.from(box.querySelectorAll('[data-ex-sets]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          const parts = inp.getAttribute('data-ex-sets').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].sets = inp.value;
        });
      });
      Array.from(box.querySelectorAll('[data-ex-reps]')).forEach(function (inp) {
        inp.addEventListener('input', function () {
          const parts = inp.getAttribute('data-ex-reps').split('-');
          workoutDraft.days[Number(parts[0])].exercises[Number(parts[1])].reps = inp.value;
        });
      });
      Array.from(box.querySelectorAll('[data-del-ex]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const parts = btn.getAttribute('data-del-ex').split('-');
          workoutDraft.days[Number(parts[0])].exercises.splice(Number(parts[1]), 1);
          renderExercises(Number(parts[0]));
        });
      });
    }

    saveBtn.addEventListener('click', async function () {
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      try {
        await api('POST', 'workouts.php', {
          username: sel.value,
          title: titleEl.value || 'My Workout Plan',
          days: workoutDraft.days
        });
        showMessage(msgEl, 'Workout plan saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  /* ── Performance ─────────────────────────────────────── */
  function initPerformanceEditor(session) {
    const sel = document.getElementById('performanceUserSelect');
    const form = document.getElementById('performanceForm');
    const historyBox = document.getElementById('performanceHistory');
    if (!sel || !form) return;

    async function renderHistory() {
      historyBox.innerHTML = '';
      if (!sel.value) { historyBox.innerHTML = '<p><em>Select a gym user to see their history.</em></p>'; return; }
      try {
        const data = await api('GET', 'performance.php?username=' + encodeURIComponent(sel.value));
        const records = data.records;
        if (!records.length) { historyBox.innerHTML = '<p><em>No performance records yet.</em></p>'; return; }
        let html = '<table class="data-table"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Body fat %</th><th>Notes</th></tr></thead><tbody>';
        records.forEach(function (r) {
          html += '<tr><td>' + formatDate(r.record_date) + '</td><td>' + escapeHtml(r.weight_kg) + '</td><td>' + escapeHtml(r.body_fat_pct || '—') + '</td><td>' + escapeHtml(r.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
        historyBox.innerHTML = html;
      } catch (e) {
        historyBox.innerHTML = '<p><em>Could not load performance data.</em></p>';
      }
    }
    sel.addEventListener('change', renderHistory);
    renderHistory();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('performanceMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      const date = document.getElementById('perfDate').value || todayISO();
      const weight = document.getElementById('perfWeight').value;
      const bodyFat = document.getElementById('perfBodyFat').value;
      const notes = document.getElementById('perfNotes').value;
      if (!weight) { showMessage(msgEl, 'Weight is required.', 'error'); return; }
      try {
        await api('POST', 'performance.php', { username: sel.value, date, weight, bodyFat, notes });
        showMessage(msgEl, 'Performance record added.', 'success');
        form.reset();
        renderHistory();
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  async function renderCoachBookings(session) {
    const box = document.getElementById('coachBookings');
    if (!box) return;
    try {
      const data = await api('GET', 'bookings.php?type=provider');
      const bookings = data.bookings;
      if (!bookings.length) { box.innerHTML = '<p><em>No upcoming sessions booked yet.</em></p>'; return; }
      let html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>';
      bookings.forEach(function (b) {
        html += '<tr><td>' + escapeHtml(b.user_name || b.user_id) + '</td><td>' + formatDate(b.booking_date) + '</td><td>' + escapeHtml(b.booking_time) + '</td><td>' + escapeHtml(b.status) + '</td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<p><em>Could not load bookings.</em></p>';
    }
  }

  /* ========================================================
     HEALTH ADVISER DASHBOARD
  ======================================================== */
  async function initDashboardAdviser() {
    if (page() !== 'dashboard-adviser') return;
    const session = await requireRole('adviser');
    if (!session) return;
    initSectionNav();

    const nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    fillUserSelect('reportUserSelect');
    fillUserSelect('dietUserSelect');
    fillUserSelect('editDietUserSelect');

    initHealthReportEditor(session);
    initDietPlanEditor(session);
    initEditDietPlanEditor(session);
    renderAdviserBookings(session);
  }

  function initHealthReportEditor(session) {
    const sel = document.getElementById('reportUserSelect');
    const form = document.getElementById('reportForm');
    if (!sel || !form) return;

    const bmiEl = document.getElementById('reportBmi'), bpEl = document.getElementById('reportBp'),
      summaryEl = document.getElementById('reportSummary'), recEl = document.getElementById('reportRecommendations');

    sel.addEventListener('change', async function () {
      bmiEl.value = ''; bpEl.value = ''; summaryEl.value = ''; recEl.value = '';
      if (sel.value) {
        try {
          const data = await api('GET', 'reports.php?username=' + encodeURIComponent(sel.value));
          if (data.report) {
            bmiEl.value = data.report.bmi || ''; bpEl.value = data.report.blood_pressure || '';
            summaryEl.value = data.report.summary || ''; recEl.value = data.report.recommendations || '';
          } else {
            // Auto-fill BMI from profile
            const uData = await api('GET', 'users.php?action=get&username=' + encodeURIComponent(sel.value));
            const profile = uData.user.profile || {};
            if (profile.weight_kg && profile.height_cm) {
              const h = profile.height_cm / 100;
              bmiEl.value = (profile.weight_kg / (h * h)).toFixed(1);
            }
          }
        } catch (e) { /* ignore */ }
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('reportMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      try {
        await api('POST', 'reports.php', {
          username: sel.value, bmi: bmiEl.value, bloodPressure: bpEl.value,
          summary: summaryEl.value, recommendations: recEl.value
        });
        showMessage(msgEl, 'Health report saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  function initDietPlanEditor(session) {
    const sel = document.getElementById('dietUserSelect');
    const form = document.getElementById('dietForm');
    if (!sel || !form) return;

    const bEl = document.getElementById('dietBreakfast'), lEl = document.getElementById('dietLunch'),
      dEl = document.getElementById('dietDinner'), sEl = document.getElementById('dietSnacks'), nEl = document.getElementById('dietNotes');

    sel.addEventListener('change', async function () {
      bEl.value = ''; lEl.value = ''; dEl.value = ''; sEl.value = ''; nEl.value = '';
      if (sel.value) {
        try {
          const data = await api('GET', 'diets.php?username=' + encodeURIComponent(sel.value));
          if (data.diet) {
            bEl.value = data.diet.breakfast || ''; lEl.value = data.diet.lunch || '';
            dEl.value = data.diet.dinner || ''; sEl.value = data.diet.snacks || ''; nEl.value = data.diet.notes || '';
          }
        } catch (e) { /* ignore */ }
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msgEl = document.getElementById('dietMessage');
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      try {
        await api('POST', 'diets.php', {
          username: sel.value, breakfast: bEl.value, lunch: lEl.value,
          dinner: dEl.value, snacks: sEl.value, notes: nEl.value
        });
        showMessage(msgEl, 'Diet plan saved for ' + sel.options[sel.selectedIndex].text + '.', 'success');
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  function initEditDietPlanEditor(session) {
    const sel = document.getElementById('editDietUserSelect');
    const form = document.getElementById('editDietForm');
    if (!sel || !form) return;

    const bEl = document.getElementById('editDietBreakfast'), lEl = document.getElementById('editDietLunch'),
      dEl = document.getElementById('editDietDinner'), sEl = document.getElementById('editDietSnacks'),
      nEl = document.getElementById('editDietNotes'), msgEl = document.getElementById('editDietMessage');

    async function loadDietPlan() {
      showMessage(msgEl, '', '');
      bEl.value = ''; lEl.value = ''; dEl.value = ''; sEl.value = ''; nEl.value = '';
      if (sel.value) {
        try {
          const data = await api('GET', 'diets.php?username=' + encodeURIComponent(sel.value));
          if (data.diet) {
            bEl.value = data.diet.breakfast || ''; lEl.value = data.diet.lunch || '';
            dEl.value = data.diet.dinner || ''; sEl.value = data.diet.snacks || ''; nEl.value = data.diet.notes || '';
          } else {
            showMessage(msgEl, 'No existing diet plan found. Create one first.', 'error');
          }
        } catch (e) { /* ignore */ }
      }
    }
    sel.addEventListener('change', loadDietPlan);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!sel.value) { showMessage(msgEl, 'Select a gym user first.', 'error'); return; }
      if (!bEl.value.trim() && !lEl.value.trim() && !dEl.value.trim() && !sEl.value.trim() && !nEl.value.trim()) {
        showMessage(msgEl, 'Please enter at least one diet plan detail.', 'error'); return;
      }
      try {
        await api('POST', 'diets.php', {
          username: sel.value, breakfast: bEl.value.trim(), lunch: lEl.value.trim(),
          dinner: dEl.value.trim(), snacks: sEl.value.trim(), notes: nEl.value.trim()
        });
        showMessage(msgEl, 'Diet plan updated for ' + sel.options[sel.selectedIndex].text + '.', 'success');
      } catch (err) {
        showMessage(msgEl, err.message, 'error');
      }
    });
  }

  async function renderAdviserBookings(session) {
    const box = document.getElementById('adviserBookings');
    if (!box) return;
    try {
      const data = await api('GET', 'bookings.php?type=provider');
      const bookings = data.bookings;
      if (!bookings.length) { box.innerHTML = '<p><em>No upcoming consultations booked yet.</em></p>'; return; }
      let html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>';
      bookings.forEach(function (b) {
        html += '<tr><td>' + escapeHtml(b.user_name || b.user_id) + '</td><td>' + formatDate(b.booking_date) + '</td><td>' + escapeHtml(b.booking_time) + '</td><td>' + escapeHtml(b.status) + '</td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<p><em>Could not load bookings.</em></p>';
    }
  }

  /* ========================================================
     ADMIN DASHBOARD
  ======================================================== */
  async function initDashboardAdmin() {
    if (page() !== 'dashboard-admin') return;
    const session = await requireRole('admin');
    if (!session) return;
    initSectionNav();

    const nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = session.fullName || session.username;

    await refreshAdminViews(session);
    initUserFilter(session);
  }

  async function refreshAdminViews(session) {
    await Promise.all([
      renderUserStats(),
      renderAllUsersReadonly(),
      renderApprovals(session),
      renderUsersTable(session, document.getElementById('userRoleFilter') ? document.getElementById('userRoleFilter').value : ''),
      renderPlanAdmin(),
      renderSubscriptionsTable()
    ]);
  }

  async function renderUserStats() {
    const box = document.getElementById('adminStats');
    if (!box) return;
    try {
      const data = await api('GET', 'users.php?action=list');
      const users = data.users;
      const byRole = { user: 0, coach: 0, adviser: 0, admin: 0 };
      let pending = 0;
      users.forEach(function (u) {
        if (byRole[u.role] !== undefined) byRole[u.role]++;
        if ((u.role === 'coach' || u.role === 'adviser') && u.approval_status === 'pending') pending++;
      });
      box.innerHTML =
        statCard('Total accounts', users.length) +
        statCard('Gym users', byRole.user) +
        statCard('Coaches', byRole.coach) +
        statCard('Health advisers', byRole.adviser) +
        statCard('Pending approvals', pending);
    } catch (e) {
      box.innerHTML = '<p><em>Could not load stats.</em></p>';
    }
  }

  async function renderAllUsersReadonly() {
    const box = document.getElementById('allUsersBox');
    if (!box) return;
    try {
      const data = await api('GET', 'users.php?action=list');
      const users = data.users;
      let html = '<table class="data-table"><thead><tr><th>Username</th><th>Role</th><th>Joined</th></tr></thead><tbody>';
      users.forEach(function (u) {
        html += '<tr><td>' + escapeHtml(u.full_name || u.username) + '</td><td>' + ROLE_LABEL[u.role] + '</td><td>' + formatDate(u.created_at) + '</td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<p><em>Could not load users.</em></p>';
    }
  }

  async function renderApprovals(session) {
    const box = document.getElementById('approvalsBox');
    if (!box) return;
    try {
      const data = await api('GET', 'users.php?action=list');
      const pending = data.users.filter(function (u) {
        return (u.role === 'coach' || u.role === 'adviser') && u.approval_status === 'pending';
      });
      if (!pending.length) { box.innerHTML = '<p><em>No pending applications.</em></p>'; return; }

      let html = '';
      pending.forEach(function (u) {
        html += '<div class="plan-day">' +
          '<p><strong>' + escapeHtml(u.full_name || u.username) + '</strong> — applying as ' + ROLE_LABEL[u.role] +
          ' · submitted ' + formatDate(u.created_at) + '</p>';
        if (u.verification_doc_path) {
          html += '<p><a href="api/' + u.verification_doc_path + '" target="_blank" rel="noopener" title="Open full size">' +
            '<img src="api/' + u.verification_doc_path + '" alt="Verification document" ' +
            'style="max-width:220px; max-height:160px; border-radius:4px; border:1px solid #ddd; display:block; margin-bottom:0.5rem;"></a></p>';
        } else {
          html += '<p><em>No document was uploaded.</em></p>';
        }
        html += '<button type="button" class="btn-success" data-approve="' + escapeHtml(u.username) + '">Approve</button> ' +
          '<button type="button" class="btn-danger" data-reject="' + escapeHtml(u.username) + '">Reject</button>' +
          '</div>';
      });
      box.innerHTML = html;

      Array.from(box.querySelectorAll('[data-approve]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-approve');
          try { await api('PUT', 'users.php', { targetUsername: username, approvalStatus: 'approved' }); } catch (e) { /* ignore */ }
          refreshAdminViews(session);
        });
      });
      Array.from(box.querySelectorAll('[data-reject]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-reject');
          if (!window.confirm('Reject this application? ' + username + ' will not be able to log in.')) return;
          try { await api('PUT', 'users.php', { targetUsername: username, approvalStatus: 'rejected' }); } catch (e) { /* ignore */ }
          refreshAdminViews(session);
        });
      });
    } catch (e) {
      box.innerHTML = '<p><em>Could not load approvals.</em></p>';
    }
  }

  function initUserFilter(session) {
    const filterSel = document.getElementById('userRoleFilter');
    if (!filterSel) return;
    filterSel.addEventListener('change', function () { renderUsersTable(session, filterSel.value); });
  }

  function approvalLabel(u) {
    if (u.role !== 'coach' && u.role !== 'adviser') return '—';
    if (u.approval_status === 'approved') return 'Approved';
    if (u.approval_status === 'rejected') return 'Rejected';
    return 'Pending';
  }

  async function renderUsersTable(session, roleFilter) {
    const box = document.getElementById('usersTableBox');
    if (!box) return;
    try {
      const url = roleFilter ? 'users.php?action=list&role=' + roleFilter : 'users.php?action=list';
      const data = await api('GET', url);
      const users = data.users;

      let html = '<table class="data-table"><thead><tr><th>Username</th><th>Role</th><th>Joined</th><th>Approval</th><th>Membership</th><th>Actions</th></tr></thead><tbody>';
      users.forEach(function (u) {
        const membership = u.membership ? u.membership.status : 'none';
        const needsApprovalAction = (u.role === 'coach' || u.role === 'adviser') && u.approval_status !== 'approved';
        html += '<tr>' +
          '<td>' + escapeHtml(u.full_name || u.username) + '</td>' +
          '<td>' +
            '<select data-role-select="' + escapeHtml(u.username) + '">' +
              ['user', 'coach', 'adviser', 'admin'].map(function (r) {
                return '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>';
              }).join('') +
            '</select>' +
          '</td>' +
          '<td>' + formatDate(u.created_at) + '</td>' +
          '<td>' + approvalLabel(u) + (needsApprovalAction ? ' <button type="button" class="btn-secondary" data-quick-approve="' + escapeHtml(u.username) + '">Approve</button>' : '') + '</td>' +
          '<td>' + escapeHtml(membership) + '</td>' +
          '<td>' +
            '<button type="button" class="btn-secondary" data-reset-pw="' + escapeHtml(u.username) + '">Reset PW</button> ' +
            '<button type="button" class="btn-danger" data-delete-user="' + escapeHtml(u.username) + '"' + (u.username === session.username ? ' disabled title="You cannot delete your own account"' : '') + '>Delete</button>' +
          '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      Array.from(box.querySelectorAll('[data-role-select]')).forEach(function (sel2) {
        sel2.addEventListener('change', async function () {
          const username = sel2.getAttribute('data-role-select');
          try { await api('PUT', 'users.php', { targetUsername: username, role: sel2.value }); } catch (e) { /* ignore */ }
          refreshAdminViews(session);
        });
      });
      Array.from(box.querySelectorAll('[data-quick-approve]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-quick-approve');
          try { await api('PUT', 'users.php', { targetUsername: username, approvalStatus: 'approved' }); } catch (e) { /* ignore */ }
          refreshAdminViews(session);
        });
      });
      Array.from(box.querySelectorAll('[data-reset-pw]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-reset-pw');
          if (!window.confirm('Reset password for ' + username + ' to "changeme123"?')) return;
          try { await api('PUT', 'users.php', { targetUsername: username, password: 'changeme123' }); window.alert('Password reset to: changeme123'); } catch (e) { window.alert('Failed: ' + e.message); }
        });
      });
      Array.from(box.querySelectorAll('[data-delete-user]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-delete-user');
          if (!window.confirm('Delete account "' + username + '"? This cannot be undone.')) return;
          try { await api('DELETE', 'users.php?action=delete&username=' + encodeURIComponent(username)); } catch (e) { /* ignore */ }
          refreshAdminViews(session);
        });
      });
    } catch (e) {
      box.innerHTML = '<p><em>Could not load users.</em></p>';
    }
  }

  async function renderPlanAdmin() {
    const box = document.getElementById('plansAdminBox');
    if (!box) return;
    try {
      const data = await api('GET', 'plans.php');
      const plans = data.plans;
      const p = plans[0];
      if (!p) { box.innerHTML = ''; return; }

      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML =
        '<div class="form-group"><label>Plan name</label><input type="text" id="planName"></div>' +
        '<div class="form-group"><label>Price (RM)</label><input type="number" min="0" step="0.01" id="planPrice"></div>' +
        '<div class="form-group"><label>Billing period</label>' +
          '<select id="planPeriod">' +
            ['month', 'year'].map(function (per) { return '<option value="' + per + '">' + per + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="form-group"><label>Features (one per line)</label><textarea rows="3" id="planFeatures"></textarea></div>' +
        '<button type="button" class="btn-success" id="savePlanBtn">Save</button>';
      box.innerHTML = '';
      box.appendChild(card);

      document.getElementById('planName').value = p.name;
      document.getElementById('planPrice').value = p.price;
      document.getElementById('planPeriod').value = p.period;
      document.getElementById('planFeatures').value = (p.features || []).join('\n');

      document.getElementById('savePlanBtn').addEventListener('click', async function () {
        try {
          await api('PUT', 'plans.php', {
            name: document.getElementById('planName').value || 'Membership',
            price: Number(document.getElementById('planPrice').value) || 0,
            period: document.getElementById('planPeriod').value,
            features: document.getElementById('planFeatures').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
          });
          window.alert('Membership plan saved.');
          renderSubscriptionsTable();
        } catch (e) {
          window.alert('Failed: ' + e.message);
        }
      });
    } catch (e) {
      box.innerHTML = '<p><em>Could not load plan.</em></p>';
    }
  }

  async function renderSubscriptionsTable() {
    const box = document.getElementById('subscriptionsBox');
    if (!box) return;
    try {
      const data = await api('GET', 'users.php?action=list&role=user');
      const users = data.users;
      let html = '<table class="data-table"><thead><tr><th>Gym user</th><th>Plan</th><th>Status</th><th>Since</th><th>Action</th></tr></thead><tbody>';
      users.forEach(function (u) {
        const m = u.membership || { status: 'none' };
        html += '<tr>' +
          '<td>' + escapeHtml(u.full_name || u.username) + '</td>' +
          '<td>' + escapeHtml((m.plan_name || '—')) + '</td>' +
          '<td>' + escapeHtml(m.status || 'none') + '</td>' +
          '<td>' + formatDate(m.start_date) + '</td>' +
          '<td>' + (m.status === 'active' ? '<button type="button" class="btn-danger" data-revoke="' + escapeHtml(u.username) + '">Revoke</button>' : '<em>—</em>') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      Array.from(box.querySelectorAll('[data-revoke]')).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const username = btn.getAttribute('data-revoke');
          if (!window.confirm('Revoke membership for ' + username + '?')) return;
          try { await api('POST', 'plans.php', { action: 'revoke', username }); } catch (e) { /* ignore */ }
          renderSubscriptionsTable();
          renderUsersTable(currentSession, document.getElementById('userRoleFilter') ? document.getElementById('userRoleFilter').value : '');
        });
      });
    } catch (e) {
      box.innerHTML = '<p><em>Could not load subscriptions.</em></p>';
    }
  }

  /* ── Boot ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    await fetchSession();
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
