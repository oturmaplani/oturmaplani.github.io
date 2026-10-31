/**
 * SIRA PWA - Main Application Controller
 */

import { Storage } from './storage.js';
import { TurkishNameUtils } from './models.js';
import { SeatingAlgorithm } from './algorithm.js';
import { VisualSociogram } from './sociogram.js';
import { printSeatingPlan } from './print.js';

class SiraApp {
  constructor() {
    this.classroom = null;
    this.displayNames = {};
    this.activeView = 'kiosk-start-view';
    this.activeTeacherTab = 'tab-plan';
    this.sociogramInstance = null;
    this.fullscreenSociogramInstance = null;

    // Swap state
    this.selectedSeat = null; // { deskId, studentIndex }

    // Voting wizard state
    this.voterStudent = null;
    this.selectedFriends = [];
    this.selectedDesks = [];

    // Pending earthquake desk
    this.earthquakeDeskId = null;
  }

  async init() {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('ServiceWorker registration error:', err);
      });
    }

    // Load data
    this.classroom = await Storage.getClassroom();
    this.updateDisplayNames();

    // Auto-compute plan if missing
    if (!this.classroom.plan || !this.classroom.plan.assignments || this.classroom.plan.assignments.length === 0) {
      this.classroom.plan = SeatingAlgorithm.computeFullPlan(
        this.classroom.students,
        this.classroom.config,
        this.classroom.preferences,
        this.classroom.forbiddenPairs,
        false
      );
      await Storage.saveClassroom(this.classroom);
    }

    this.bindEvents();
    this.renderKioskStart();
    this.renderTeacherDashboard();
  }

  updateDisplayNames() {
    this.displayNames = TurkishNameUtils.computeDisplayNames(this.classroom.students);
  }

  switchView(viewId) {
    this.activeView = viewId;
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    if (viewId === 'kiosk-start-view') {
      this.renderKioskStart();
    } else if (viewId === 'teacher-dashboard-view') {
      this.renderTeacherDashboard();
    }
  }

  switchTeacherTab(tabId) {
    this.activeTeacherTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    if (tabId === 'tab-sociogram') {
      setTimeout(() => {
        if (!this.sociogramInstance) {
          const canvas = document.getElementById('sociogram-canvas');
          this.sociogramInstance = new VisualSociogram(canvas);
        }
        this.sociogramInstance.setData(this.classroom.students, this.classroom.preferences, this.displayNames);
        this.sociogramInstance.resizeCanvas();
      }, 50);
    }
  }

  /* ---------------- KIOSK START SCREEN ---------------- */
  renderKioskStart() {
    const totalStudents = this.classroom.students.length;
    const votedCount = this.classroom.students.filter(s => s.hasVoted).length;

    const countEl = document.getElementById('kiosk-voted-count');
    if (countEl) {
      countEl.textContent = `${votedCount} / ${totalStudents} Öğrenci Oy Kullandı`;
    }
  }

  /* ---------------- KIOSK VOTING WIZARD ---------------- */
  startVotingWizard() {
    this.voterStudent = null;
    this.selectedFriends = [];
    this.selectedDesks = [];

    this.switchView('kiosk-vote-view');
    this.showWizardStep(1);
    this.renderStudentSelectionGrid();
  }

  showWizardStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach((el, idx) => {
      el.style.display = (idx + 1 === stepNum) ? 'block' : 'none';
    });
  }

  renderStudentSelectionGrid() {
    const grid = document.getElementById('voter-selection-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.classroom.students.forEach(s => {
      const btn = document.createElement('div');
      btn.className = `student-btn ${s.hasVoted ? 'voted' : ''}`;
      btn.textContent = s.name;
      btn.onclick = () => {
        this.voterStudent = s;
        this.showWizardStep(2);
        this.renderFriendSelectionGrid();
      };
      grid.appendChild(btn);
    });
  }

  renderFriendSelectionGrid() {
    const title = document.getElementById('wizard-friend-title');
    if (title) {
      title.textContent = `Merhaba ${this.voterStudent.name}, Birlikte Oturmak İstediğin Arkadaşlar`;
    }

    const grid = document.getElementById('friend-selection-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Filter out voter themselves
    const candidates = this.classroom.students.filter(s => s.id !== this.voterStudent.id);

    candidates.forEach(s => {
      const btn = document.createElement('div');
      const idx = this.selectedFriends.indexOf(s.id);
      const isSelected = idx >= 0;

      btn.className = `student-btn ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `${s.name} ${isSelected ? `<span class="choice-badge">${idx + 1}</span>` : ''}`;

      btn.onclick = () => {
        const curIdx = this.selectedFriends.indexOf(s.id);
        if (curIdx >= 0) {
          this.selectedFriends.splice(curIdx, 1);
        } else {
          if (this.selectedFriends.length < 5) {
            this.selectedFriends.push(s.id);
          } else {
            alert('En fazla 5 arkadaş seçebilirsiniz.');
          }
        }
        this.renderFriendSelectionGrid();
      };
      grid.appendChild(btn);
    });
  }

  async completeVote() {
    if (!this.voterStudent) return;

    // Save preferences
    this.classroom.preferences[this.voterStudent.id] = {
      friendChoices: this.selectedFriends,
      deskChoices: this.selectedDesks.length > 0 ? this.selectedDesks : [1, 2, 6, 7, 11]
    };

    // Mark voted
    const targetStudent = this.classroom.students.find(s => s.id === this.voterStudent.id);
    if (targetStudent) targetStudent.hasVoted = true;

    await Storage.saveClassroom(this.classroom);

    // Show step 3 (success)
    this.showWizardStep(3);
    const successMsg = document.getElementById('vote-success-name');
    if (successMsg) successMsg.textContent = this.voterStudent.name;

    // Auto return after 3 seconds
    setTimeout(() => {
      this.switchView('kiosk-start-view');
    }, 3000);
  }

  /* ---------------- TEACHER DASHBOARD ---------------- */
  renderTeacherDashboard() {
    const classNameEl = document.getElementById('dashboard-class-name');
    if (classNameEl) classNameEl.textContent = this.classroom.name || '7-C Sınıfı';

    this.renderSeatingPlanTab();
    this.renderStudentListTab();
    this.renderClassroomConfigTab();
  }

  renderSeatingPlanTab() {
    const grid = document.getElementById('seating-plan-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const config = this.classroom.config;
    const plan = this.classroom.plan;
    if (!plan || !plan.assignments) return;

    grid.style.gridTemplateColumns = `repeat(${config.cols}, minmax(0, 1fr))`;

    const totalDesks = config.rows * config.cols;
    const assignmentMap = new Map();
    plan.assignments.forEach(a => assignmentMap.set(a.deskId, a));

    for (let id = 1; id <= totalDesks; id++) {
      const isInactive = config.inactiveDesks.includes(id);
      const card = document.createElement('div');
      card.className = `desk-card ${isInactive ? 'inactive' : ''}`;

      if (isInactive) {
        card.innerHTML = `
          <div class="desk-header"><span>Sıra ${id}</span><span>Kapalı</span></div>
          <div style="font-size:11px;color:#64748b;text-align:center;padding:12px 0;">Boş Alan</div>
        `;
      } else {
        const assign = assignmentMap.get(id);
        const s1 = assign ? assign.student1 : null;
        const s2 = assign ? assign.student2 : null;
        const s1Name = s1 ? (this.displayNames[s1.id] || s1.name) : 'Boş';
        const s2Name = s2 ? (this.displayNames[s2.id] || s2.name) : 'Boş';

        card.innerHTML = `
          <div class="desk-header">
            <span>Sıra ${id}</span>
            <div class="desk-actions">
              <button class="btn-card-discipline btn-card-yellow" title="Sarı Kart (Uyarı)" onclick="window.siraApp.onDisciplineCard(${id}, 'YELLOW')">S</button>
              <button class="btn-card-discipline btn-card-red" title="Kırmızı Kart (Deprem Başlat)" onclick="window.siraApp.onDisciplineCard(${id}, 'RED')">K</button>
            </div>
          </div>
          <div class="desk-students">
            <div class="desk-seat ${this.isSelectedSeat(id, 1) ? 'selected-for-swap' : ''}" onclick="window.siraApp.onSeatClick(${id}, 1)">
              ${s1Name}
            </div>
            <div class="desk-divider"></div>
            <div class="desk-seat ${this.isSelectedSeat(id, 2) ? 'selected-for-swap' : ''}" onclick="window.siraApp.onSeatClick(${id}, 2)">
              ${s2Name}
            </div>
          </div>
        `;
      }
      grid.appendChild(card);
    }
  }

  isSelectedSeat(deskId, studentIndex) {
    return this.selectedSeat && this.selectedSeat.deskId === deskId && this.selectedSeat.studentIndex === studentIndex;
  }

  onSeatClick(deskId, studentIndex) {
    if (!this.selectedSeat) {
      // First selection
      this.selectedSeat = { deskId, studentIndex };
      this.renderSeatingPlanTab();
    } else {
      // Second selection -> Perform Swap!
      const seatA = this.selectedSeat;
      const seatB = { deskId, studentIndex };

      if (seatA.deskId === seatB.deskId && seatA.studentIndex === seatB.studentIndex) {
        // Deselect
        this.selectedSeat = null;
        this.renderSeatingPlanTab();
        return;
      }

      this.executeSeatSwap(seatA, seatB);
      this.selectedSeat = null;
    }
  }

  async executeSeatSwap(seatA, seatB) {
    const plan = this.classroom.plan;
    if (!plan || !plan.assignments) return;

    const assignA = plan.assignments.find(a => a.deskId === seatA.deskId);
    const assignB = plan.assignments.find(a => a.deskId === seatB.deskId);
    if (!assignA || !assignB) return;

    const studentA = seatA.studentIndex === 1 ? assignA.student1 : assignA.student2;
    const studentB = seatB.studentIndex === 1 ? assignB.student1 : assignB.student2;

    if (seatA.studentIndex === 1) assignA.student1 = studentB;
    else assignA.student2 = studentB;

    if (seatB.studentIndex === 1) assignB.student1 = studentA;
    else assignB.student2 = studentA;

    // Reset ranks for swapped seats
    assignA.s1FriendRank = -1; assignA.s2FriendRank = -1;
    assignB.s1FriendRank = -1; assignB.s2FriendRank = -1;

    await Storage.saveClassroom(this.classroom);
    this.renderSeatingPlanTab();
  }

  onDisciplineCard(deskId, cardType) {
    this.earthquakeDeskId = deskId;
    const modal = document.getElementById('earthquake-modal');
    const title = document.getElementById('earthquake-modal-title');
    if (title) title.textContent = `Sıra ${deskId} Disiplin Müdahalesi`;
    if (modal) modal.classList.add('active');
  }

  async executeEarthquakeLevel(level) {
    const deskId = this.earthquakeDeskId;
    if (!deskId) return;

    const result = SeatingAlgorithm.executeEarthquake(
      this.classroom.plan,
      this.classroom.config,
      this.classroom.students,
      this.classroom.preferences,
      deskId,
      level,
      this.displayNames
    );

    if (result && result.plan) {
      this.classroom.plan = result.plan;
      this.classroom.lastEarthquakeSummary = result.summary;
      await Storage.saveClassroom(this.classroom);

      this.closeModal('earthquake-modal');
      this.renderSeatingPlanTab();
      alert(`⚡ ${result.summary.level}\n\n${result.summary.message}`);
    }
  }

  async recomputePlan() {
    const placeAbsent = document.getElementById('toggle-place-absent')?.checked || false;
    this.classroom.plan = SeatingAlgorithm.computeFullPlan(
      this.classroom.students,
      this.classroom.config,
      this.classroom.preferences,
      this.classroom.forbiddenPairs,
      placeAbsent
    );
    await Storage.saveClassroom(this.classroom);
    this.renderSeatingPlanTab();
  }

  openRaporModal() {
    const plan = this.classroom.plan;
    if (!plan) return;

    document.getElementById('rapor-friend-rate').textContent = `%${plan.friendSatisfactionRate || 0}`;
    document.getElementById('rapor-desk-rate').textContent = `%${plan.deskSatisfactionRate || 0}`;
    document.getElementById('rapor-double-rate').textContent = `%${plan.doubleSatisfactionRate || 0}`;

    const tbody = document.getElementById('rapor-student-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      plan.assignments.forEach(a => {
        const s1 = a.student1;
        const s2 = a.student2;
        const s1Name = this.displayNames[s1.id] || s1.name;
        const s2Name = s2 ? (this.displayNames[s2.id] || s2.name) : '-';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #334155';
        row.innerHTML = `
          <td style="padding:8px;">Sıra ${a.deskId}</td>
          <td style="padding:8px;">${s1Name}</td>
          <td style="padding:8px;">${s2Name}</td>
          <td style="padding:8px;text-align:center;">${a.s1FriendRank > 0 ? `${a.s1FriendRank}. Tercih` : '-'}</td>
          <td style="padding:8px;text-align:center;">${a.s2FriendRank > 0 ? `${a.s2FriendRank}. Tercih` : '-'}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById('rapor-modal')?.classList.add('active');
  }

  /* ---------------- STUDENT LIST TAB ---------------- */
  renderStudentListTab() {
    const tbody = document.getElementById('student-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    this.classroom.students.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #334155';
      tr.innerHTML = `
        <td style="padding:10px 14px;">${s.no || idx + 1}</td>
        <td style="padding:10px 14px;font-weight:700;">${s.name}</td>
        <td style="padding:10px 14px;">${s.gender}</td>
        <td style="padding:10px 14px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${s.hasVoted ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${s.hasVoted ? '#10b981' : '#ef4444'};">
            ${s.hasVoted ? 'Kullandı' : 'Kullanmadı'}
          </span>
        </td>
        <td style="padding:10px 14px;text-align:center;">
          <input type="checkbox" ${s.isAbsent ? 'checked' : ''} onchange="window.siraApp.toggleStudentAbsent('${s.id}', this.checked)" style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444;" />
        </td>
        <td style="padding:10px 14px;text-align:right;">
          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="window.siraApp.deleteStudent('${s.id}')">Sil</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async toggleStudentAbsent(studentId, isAbsent) {
    const s = this.classroom.students.find(item => item.id === studentId);
    if (s) {
      s.isAbsent = isAbsent;
      await Storage.saveClassroom(this.classroom);
    }
  }

  async deleteStudent(studentId) {
    if (confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) {
      this.classroom.students = this.classroom.students.filter(s => s.id !== studentId);
      delete this.classroom.preferences[studentId];
      this.updateDisplayNames();
      await Storage.saveClassroom(this.classroom);
      this.renderStudentListTab();
      this.renderKioskStart();
    }
  }

  async addStudent() {
    const nameInput = document.getElementById('new-student-name');
    const genderSelect = document.getElementById('new-student-gender');
    const name = nameInput.value.trim();
    if (!name) return;

    const newId = `s_${Date.now()}`;
    this.classroom.students.push({
      id: newId,
      no: this.classroom.students.length + 1,
      name: TurkishNameUtils.formatFullName(name),
      gender: genderSelect.value,
      hasVoted: false,
      isAbsent: false
    });

    nameInput.value = '';
    this.updateDisplayNames();
    await Storage.saveClassroom(this.classroom);
    this.renderStudentListTab();
    this.renderKioskStart();
  }

  async resetToSample7C() {
    if (confirm('Tüm sınıf verisi silinecek ve orijinal 7-C sınıfı (34 öğrenci) yüklenecek. Emin misiniz?')) {
      this.classroom = await Storage.resetToDefault();
      this.updateDisplayNames();
      this.classroom.plan = SeatingAlgorithm.computeFullPlan(
        this.classroom.students,
        this.classroom.config,
        this.classroom.preferences,
        this.classroom.forbiddenPairs,
        false
      );
      await Storage.saveClassroom(this.classroom);
      this.renderTeacherDashboard();
      this.renderKioskStart();
      alert('7-C Sınıfı başarıyla yüklendi.');
    }
  }

  /* ---------------- CLASSROOM CONFIG TAB ---------------- */
  renderClassroomConfigTab() {
    const rowsInput = document.getElementById('cfg-rows');
    const colsInput = document.getElementById('cfg-cols');
    const windowSelect = document.getElementById('cfg-window');
    if (rowsInput) rowsInput.value = this.classroom.config.rows;
    if (colsInput) colsInput.value = this.classroom.config.cols;
    if (windowSelect) windowSelect.value = this.classroom.config.windowSide;
  }

  async saveClassroomConfig() {
    const rows = parseInt(document.getElementById('cfg-rows').value) || 4;
    const cols = parseInt(document.getElementById('cfg-cols').value) || 5;
    const windowSide = document.getElementById('cfg-window').value || 'left';

    this.classroom.config.rows = rows;
    this.classroom.config.cols = cols;
    this.classroom.config.windowSide = windowSide;

    await Storage.saveClassroom(this.classroom);
    this.recomputePlan();
    alert('Sınıf düzeni kaydedildi ve plan güncellendi.');
  }

  /* ---------------- FULLSCREEN SOSYOGRAM ---------------- */
  openFullscreenSociogram() {
    const dialog = document.getElementById('sociogram-fullscreen-dialog');
    if (!dialog) return;
    dialog.classList.add('active');

    setTimeout(() => {
      const canvas = document.getElementById('sociogram-fullscreen-canvas');
      if (!this.fullscreenSociogramInstance) {
        this.fullscreenSociogramInstance = new VisualSociogram(canvas);
      }
      this.fullscreenSociogramInstance.setData(this.classroom.students, this.classroom.preferences, this.displayNames);
      this.fullscreenSociogramInstance.resizeCanvas();
    }, 50);
  }

  closeFullscreenSociogram() {
    document.getElementById('sociogram-fullscreen-dialog')?.classList.remove('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  bindEvents() {}
}

// Global instance for inline onclick handlers
window.siraApp = new SiraApp();
window.addEventListener('DOMContentLoaded', () => {
  window.siraApp.init();
});
