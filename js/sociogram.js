/**
 * SIRA PWA - Visual Moreno 5-Tier Target Sociogram
 * Features:
 * - Moreno 5 concentric target circles (No text labels, pure clean geometry)
 * - Semantic Zoom: Circles stay constant size, node spacing & rings expand on zoom
 * - Pan & Zoom (Mouse drag, wheel, pinch-to-zoom)
 * - Fullscreen mode
 * - Student selection highlighting incoming, outgoing & mutual ties
 * - Display: "Ad S." (No student numbers)
 */

export class VisualSociogram {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.students = [];
    this.preferences = {};
    this.displayNames = {};

    // View state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.selectedStudentId = null;

    // Node layout cache
    this.nodes = [];
    this.links = [];

    // Interaction handling
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.initialPinchDistance = null;

    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 500) * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  setData(students, preferences, displayNames) {
    this.students = students || [];
    this.preferences = preferences || {};
    this.displayNames = displayNames || {};
    this.computeLayout();
    this.resetView();
    this.render();
  }

  resetView() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.selectedStudentId = null;
    this.render();
  }

  computeLayout() {
    if (!this.students || this.students.length === 0) {
      this.nodes = [];
      this.links = [];
      return;
    }

    // 1. Calculate in-degree (incoming votes)
    const inDegrees = {};
    this.students.forEach(s => inDegrees[s.id] = 0);

    Object.entries(this.preferences).forEach(([fromId, pref]) => {
      (pref.friendChoices || []).forEach(toId => {
        if (inDegrees[toId] !== undefined) {
          inDegrees[toId]++;
        }
      });
    });

    // 2. Moreno 5-Tier categorization
    // Tier 1 (Center): Stars (> 80th percentile)
    // Tier 2: Popular (60-80th percentile)
    // Tier 3: Average (35-60th percentile)
    // Tier 4: Low (10-35th percentile)
    // Tier 5 (Perimeter): Isolates (0 or 1 vote)
    const sortedDegrees = Object.values(inDegrees).sort((a, b) => a - b);
    const p10 = sortedDegrees[Math.floor(sortedDegrees.length * 0.1)] || 1;
    const p35 = sortedDegrees[Math.floor(sortedDegrees.length * 0.35)] || 2;
    const p60 = sortedDegrees[Math.floor(sortedDegrees.length * 0.6)] || 3;
    const p80 = sortedDegrees[Math.floor(sortedDegrees.length * 0.8)] || 4;

    const tiers = [[], [], [], [], []]; // 0 (center) to 4 (outer)

    this.students.forEach(s => {
      const deg = inDegrees[s.id];
      if (deg === 0) {
        tiers[4].push(s); // Isolates
      } else if (deg >= p80 && deg > 0) {
        tiers[0].push(s); // Stars
      } else if (deg >= p60) {
        tiers[1].push(s); // Popular
      } else if (deg >= p35) {
        tiers[2].push(s); // Average
      } else {
        tiers[3].push(s); // Low
      }
    });

    // Place nodes on concentric rings with angular separation
    const nodes = [];
    // Normalized radii: Tier 0 = 0.18, Tier 1 = 0.36, Tier 2 = 0.54, Tier 3 = 0.72, Tier 4 = 0.90
    const ringFractions = [0.18, 0.38, 0.58, 0.78, 0.94];

    tiers.forEach((tierStudents, tierIdx) => {
      const count = tierStudents.length;
      if (count === 0) return;
      const angleStep = (2 * Math.PI) / count;
      const ringFraction = ringFractions[tierIdx];
      // Offset starting angle per tier to avoid radial alignment
      const startAngle = (tierIdx * 0.45);

      tierStudents.forEach((student, i) => {
        const angle = startAngle + i * angleStep;
        nodes.push({
          id: student.id,
          student,
          name: this.displayNames[student.id] || student.name,
          gender: student.gender,
          inDegree: inDegrees[student.id],
          tier: tierIdx,
          ringFraction,
          angle,
          // Base normalized coordinates in [-1, 1] range
          normX: ringFraction * Math.cos(angle),
          normY: ringFraction * Math.sin(angle)
        });
      });
    });

    this.nodes = nodes;

    // 3. Extract Links
    const links = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    nodes.forEach(nFrom => {
      const pref = this.preferences[nFrom.id];
      if (!pref) return;

      (pref.friendChoices || []).forEach((toId, choiceIdx) => {
        const nTo = nodeMap.get(toId);
        if (!nTo) return;

        // Check if reciprocal
        const targetPref = this.preferences[toId];
        const isMutual = targetPref && (targetPref.friendChoices || []).includes(nFrom.id);

        links.push({
          from: nFrom.id,
          to: toId,
          choiceRank: choiceIdx + 1,
          isMutual
        });
      });
    });

    this.links = links;
  }

  getScreenPos(node, centerX, centerY, maxRadius) {
    // SEMANTIC ZOOM: The distance from the center scales with this.scale,
    // causing nodes to drift apart and rings to expand.
    const r = maxRadius * node.ringFraction * this.scale;
    const x = centerX + this.panX + r * Math.cos(node.angle);
    const y = centerY + this.panY + r * Math.sin(node.angle);
    return { x, y };
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height || 500;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) * 0.88;

    // 1. Draw 5 Concentric Target Rings (Clean geometry, NO text labels)
    const ringFractions = [0.18, 0.38, 0.58, 0.78, 0.94];
    ctx.save();
    ringFractions.forEach((fraction, idx) => {
      const r = maxRadius * fraction * this.scale;
      ctx.beginPath();
      ctx.arc(centerX + this.panX, centerY + this.panY, r, 0, 2 * Math.PI);
      ctx.strokeStyle = idx === 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = idx === 0 ? 2 : 1;
      ctx.setLineDash(idx === 4 ? [4, 4] : []);
      ctx.stroke();

      // Subtle fill for target center
      if (idx === 0) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.04)';
        ctx.fill();
      }
    });
    ctx.restore();

    if (this.nodes.length === 0) return;

    // Build screen positions
    const posMap = new Map();
    this.nodes.forEach(node => {
      posMap.set(node.id, this.getScreenPos(node, centerX, centerY, maxRadius));
    });

    // 2. Draw Links
    this.links.forEach(link => {
      const pFrom = posMap.get(link.from);
      const pTo = posMap.get(link.to);
      if (!pFrom || !pTo) return;

      const isFromSelected = this.selectedStudentId === link.from;
      const isToSelected = this.selectedStudentId === link.to;
      const isRelevant = !this.selectedStudentId || isFromSelected || isToSelected;

      // Filter out non-relevant links if a student is selected
      if (this.selectedStudentId && !isRelevant) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pFrom.x, pFrom.y);
      ctx.lineTo(pTo.x, pTo.y);

      if (link.isMutual) {
        // Emerald for mutual ties
        ctx.strokeStyle = isRelevant ? '#10b981' : 'rgba(16, 185, 129, 0.2)';
        ctx.lineWidth = isRelevant ? 2.5 : 1.2;
      } else if (isFromSelected) {
        // Blue for outgoing ties of selected
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.0;
      } else if (isToSelected) {
        // Amber for incoming ties of selected
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.0;
      } else {
        // Subtle grey for regular ties
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();

      // Draw arrowhead at target (offset before circle border)
      const angle = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x);
      const nodeRadius = 26; // Fixed crisp node size
      const arrowX = pTo.x - Math.cos(angle) * (nodeRadius + 2);
      const arrowY = pTo.y - Math.sin(angle) * (nodeRadius + 2);

      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 3. Draw Nodes (Fixed crisp radius, constant font size!)
    const NODE_RADIUS = 26;

    this.nodes.forEach(node => {
      const pos = posMap.get(node.id);
      const isSelected = this.selectedStudentId === node.id;
      const isDimmed = this.selectedStudentId && !isSelected &&
        !this.links.some(l => (l.from === this.selectedStudentId && l.to === node.id) ||
                              (l.to === this.selectedStudentId && l.from === node.id));

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.25 : 1.0;

      // Circle Background
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);

      if (isSelected) {
        ctx.fillStyle = '#4f46e5';
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 3.5;
      } else if (node.inDegree === 0) {
        // Isolate node (coral/rose)
        ctx.fillStyle = '#ffe4e6';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
      } else if (node.tier === 0) {
        // Star node (amber/indigo glow)
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
      } else {
        // Normal node
        ctx.fillStyle = node.gender === 'Kız' ? '#fdf2f8' : '#f0f9ff';
        ctx.strokeStyle = node.gender === 'Kız' ? '#ec4899' : '#0284c7';
        ctx.lineWidth = 1.8;
      }

      ctx.fill();
      ctx.stroke();

      // Text inside node: "Ad S." (NO student number!)
      ctx.fillStyle = isSelected ? '#ffffff' : '#0f172a';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate name if too wide
      let displayName = node.name;
      if (displayName.length > 12) {
        displayName = displayName.substring(0, 11) + '…';
      }
      ctx.fillText(displayName, pos.x, pos.y);

      // Incoming vote badge
      if (!isDimmed) {
        ctx.beginPath();
        ctx.arc(pos.x + NODE_RADIUS - 6, pos.y - NODE_RADIUS + 6, 8, 0, 2 * Math.PI);
        ctx.fillStyle = node.inDegree > 3 ? '#10b981' : (node.inDegree === 0 ? '#f43f5e' : '#64748b');
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px system-ui';
        ctx.fillText(`${node.inDegree}`, pos.x + NODE_RADIUS - 6, pos.y - NODE_RADIUS + 6);
      }

      ctx.restore();
    });
  }

  bindEvents() {
    const canvas = this.canvas;

    // Pan via Mouse Drag
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Zoom via Wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      this.scale = Math.min(Math.max(this.scale * zoomFactor, 0.4), 4.0);
      this.render();
    }, { passive: false });

    // Touch events (Pan and Pinch-to-zoom for iPad / iPhone)
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouseX;
        const dy = e.touches[0].clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this.render();
      } else if (e.touches.length === 2 && this.initialPinchDistance) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / this.initialPinchDistance;
        this.scale = Math.min(Math.max(this.scale * factor, 0.4), 4.0);
        this.initialPinchDistance = dist;
        this.render();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      this.initialPinchDistance = null;
    });

    // Click on node to select
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = (rect.height || 500) / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.88;

      let clickedNode = null;
      for (const node of this.nodes) {
        const pos = this.getScreenPos(node, centerX, centerY, maxRadius);
        const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
        if (dist <= 26) {
          clickedNode = node;
          break;
        }
      }

      if (clickedNode) {
        this.selectedStudentId = this.selectedStudentId === clickedNode.id ? null : clickedNode.id;
      } else {
        this.selectedStudentId = null;
      }
      this.render();
    });
  }
}
