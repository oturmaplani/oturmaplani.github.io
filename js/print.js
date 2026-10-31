/**
 * SIRA PWA - Seating Plan Print & PDF Generator
 * Renders an official, clean A4 print view and triggers window.print().
 * Strict adherence to requirements:
 * - Student Name + Abbreviated Surname ("Ad S.")
 * - NO student numbers
 * - NO footer stats or satisfaction rates
 * - Official signature box: "Sınıf Öğretmeni: ..........  İmza: .........."
 */

export function printSeatingPlan(classroom, displayNames) {
  let printContainer = document.getElementById('print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    document.body.appendChild(printContainer);
  }

  const plan = classroom.plan;
  const config = classroom.config;
  if (!plan || !plan.assignments || plan.assignments.length === 0) {
    alert('Yazdırılacak aktif bir oturma planı bulunamadı. Lütfen önce planı oluşturun.');
    return;
  }

  const rows = config.rows;
  const cols = config.cols;
  const totalDesks = rows * cols;

  const assignmentMap = new Map();
  plan.assignments.forEach(a => assignmentMap.set(a.deskId, a));

  const today = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let desksHtml = '';
  for (let id = 1; id <= totalDesks; id++) {
    const isInactive = config.inactiveDesks.includes(id);
    const assign = assignmentMap.get(id);

    if (isInactive) {
      desksHtml += `<div class="print-desk print-empty-desk">Boş / Kapalı</div>`;
    } else if (assign) {
      const s1 = assign.student1;
      const s2 = assign.student2;
      const s1Name = displayNames[s1.id] || s1.name;
      const s2Name = s2 ? (displayNames[s2.id] || s2.name) : '-';

      desksHtml += `
        <div class="print-desk">
          <div class="print-desk-num">Sıra ${id}</div>
          <div class="print-desk-students">
            <div class="print-student">${s1Name}</div>
            <div class="print-desk-divider"></div>
            <div class="print-student">${s2Name}</div>
          </div>
        </div>
      `;
    } else {
      desksHtml += `
        <div class="print-desk print-empty-desk">
          <div class="print-desk-num">Sıra ${id}</div>
          <span>Boş Sıra</span>
        </div>
      `;
    }
  }

  printContainer.innerHTML = `
    <div class="print-sheet">
      <div class="print-header">
        <h1>${classroom.name || 'Sınıf'} Oturma Düzeni Çizelgesi</h1>
        <p>Tarih: ${today}</p>
      </div>

      <div class="print-board">
        ▲ TAHTA / ÖĞRETMEN KÜRSÜSÜ (ÖN) ▲
      </div>

      <div class="print-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
        ${desksHtml}
      </div>

      <div class="print-footer">
        <div class="print-signature-box">
          <div><strong>Sınıf Rehber Öğretmeni:</strong> ........................................</div>
          <div><strong>İmza:</strong> ................................................................</div>
        </div>
      </div>
    </div>
  `;

  // Allow DOM to update then trigger print
  setTimeout(() => {
    window.print();
  }, 200);
}
