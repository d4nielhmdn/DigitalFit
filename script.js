
(function () {
  'use strict';

  // ── Which page are we on? ────────────────────────────────────
  function page() {
    return document.body.getAttribute('data-page') || '';
  }

  // ── Generic helpers ──────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

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

  function goToSection(sectionId) {
    var link = document.querySelector('a[data-section="' + sectionId + '"]');
    if (link) link.click();
  }

  function initJumpLinks() {
    Array.prototype.slice.call(document.querySelectorAll('[data-jump]')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goToSection(a.getAttribute('data-jump'));
      });
    });
  }

  function initRegisterDocToggle() {
    if (page() !== 'register') return;
    var roleEl = $('regRole');
    var docGroup = $('regDocumentGroup');
    var docInput = $('regDocument');
    if (!roleEl || !docGroup) return;

    function sync() {
      var needsDoc = roleEl.value === 'coach' || roleEl.value === 'adviser';
      docGroup.classList.toggle('hidden', !needsDoc);
      if (docInput) {
        if (needsDoc) docInput.setAttribute('required', 'required');
        else docInput.removeAttribute('required');
      }
    }
    roleEl.addEventListener('change', sync);
    sync();
  }

  function initBookingProviderToggle() {
    if (page() !== 'dashboard-user') return;
    var typeSel = $('bookingType');
    var providerSel = $('bookingProvider');
    if (!typeSel || !providerSel) return;

    function filter() {
      var role = typeSel.value;
      Array.prototype.slice.call(providerSel.options).forEach(function (opt) {
        if (!opt.value) return; // placeholder
        opt.style.display = opt.getAttribute('data-role') === role ? '' : 'none';
      });

      var firstVisible = Array.prototype.slice.call(providerSel.options).filter(function (o) {
        return o.value && o.style.display !== 'none';
      })[0];
      if (firstVisible) providerSel.value = firstVisible.value;
      else providerSel.value = '';
    }
    typeSel.addEventListener('change', filter);
    filter();
  }

  function initWorkoutDayEditor() {
    if (page() !== 'dashboard-coach') return;
    var addDayBtn = $('addDayBtn');
    var daysBox = $('workoutDaysBox');
    if (!addDayBtn || !daysBox) return;

    var dayCounter = 0;

    function createDay(name) {
      var idx = dayCounter++;
      var dayEl = document.createElement('div');
      dayEl.className = 'plan-day';
      dayEl.innerHTML =
        '<div class="form-group">' +
          '<label>Day name</label>' +
          '<input type="text" name="day_name[]" value="' + escapeHtml(name || 'Day ' + (idx + 1)) + '">' +
        '</div>' +
        '<div class="exercises-box" data-day="' + idx + '"></div>' +
        '<button type="button" class="btn-secondary add-ex-btn">+ Add exercise</button> ' +
        '<button type="button" class="btn-danger remove-day-btn">Remove day</button>';
      daysBox.appendChild(dayEl);

      dayEl.querySelector('.add-ex-btn').addEventListener('click', function () {
        addExercise(dayEl.querySelector('.exercises-box'), idx);
      });
      dayEl.querySelector('.remove-day-btn').addEventListener('click', function () {
        dayEl.remove();
      });
      return dayEl;
    }

    function addExercise(box, dayIdx) {
      var row = document.createElement('div');
      row.className = 'form-group';
      row.style.cssText = 'display:flex; gap:.5rem; align-items:center;';
      row.innerHTML =
        '<input type="text" name="ex_name[]" placeholder="Exercise" style="flex:2">' +
        '<input type="text" name="ex_sets[]" placeholder="Sets" style="flex:1" value="3">' +
        '<input type="text" name="ex_reps[]" placeholder="Reps" style="flex:1" value="10">' +
        '<input type="hidden" name="ex_day_idx[]" value="' + dayIdx + '">' +
        '<button type="button" class="btn-danger remove-ex-btn">×</button>';
      box.appendChild(row);
      row.querySelector('.remove-ex-btn').addEventListener('click', function () {
        row.remove();
      });
    }

    addDayBtn.addEventListener('click', function () { createDay(); });

    // Start with one empty day
    createDay();
  }

  function initPerformanceHistoryLoader() {
    if (page() !== 'dashboard-coach') return;
    var sel = $('performanceUserSelect');
    var box = $('performanceHistory');
    if (!sel || !box) return;

    sel.addEventListener('change', function () {
      var userId = sel.value;
      if (!userId) {
        box.innerHTML = '<p><em>Select a gym user above to see their history.</em></p>';
        return;
      }
      box.innerHTML = '<p><em>Loading…</em></p>';
      fetch('api/get_performance.php?user_id=' + encodeURIComponent(userId))
        .then(function (r) { return r.json(); })
        .then(function (records) {
          if (!records.length) {
            box.innerHTML = '<p><em>No performance records yet.</em></p>';
            return;
          }
          var html = '<table class="data-table"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Body fat %</th><th>Notes</th></tr></thead><tbody>';
          records.forEach(function (r) {
            html += '<tr><td>' + escapeHtml(r.record_date) + '</td><td>' + escapeHtml(r.weight_kg) + '</td><td>' + escapeHtml(r.body_fat_pct || '—') + '</td><td>' + escapeHtml(r.notes || '') + '</td></tr>';
          });
          html += '</tbody></table>';
          box.innerHTML = html;
        })
        .catch(function () {
          box.innerHTML = '<p><em>Could not load history.</em></p>';
        });
    });
  }

  //role filter for admin
  window.filterUserTable = function () {
    var role = ($('userRoleFilter') || {}).value || '';
    var rows = document.querySelectorAll('#manageUsersTable tbody tr');
    rows.forEach(function (tr) {
      tr.style.display = !role || tr.getAttribute('data-role') === role ? '' : 'none';
    });
  };

  // ── escapeHtml ───────────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str === null || str === undefined ? '' : String(str);
    return div.innerHTML;
  }

  
  document.addEventListener('DOMContentLoaded', function () {
    initSectionNav();
    initJumpLinks();
    initRegisterDocToggle();
    initBookingProviderToggle();
    initWorkoutDayEditor();
    initPerformanceHistoryLoader();
  });
})();
