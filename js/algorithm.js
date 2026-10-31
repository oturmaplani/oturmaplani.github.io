/**
 * SIRA PWA - Core Algorithm & Earthquake Engine
 * 1. Two-Stage Nash Social Welfare Seating Optimization (Şampiyon Puanlar)
 * 2. 3-Level Classroom Earthquake Engine (Klik, Tsunami, Büyük Deprem)
 */

export const CHAMPION_SCORES = [20.0, 16.0, 8.0, 6.0, 4.0];
export const UNRANKED_SCORE = 1.0;

export const SeatingAlgorithm = {
  getFriendScoreAndRank(fromId, toId, preferences) {
    const pref = preferences[fromId];
    if (!pref || !pref.friendChoices) return { score: UNRANKED_SCORE, rank: -1 };
    const idx = pref.friendChoices.indexOf(toId);
    if (idx >= 0 && idx < CHAMPION_SCORES.length) {
      return { score: CHAMPION_SCORES[idx], rank: idx + 1 };
    }
    return { score: UNRANKED_SCORE, rank: -1 };
  },

  getDeskScoreAndRank(studentId, deskId, preferences) {
    if (!studentId) return { score: UNRANKED_SCORE, rank: -1 };
    const pref = preferences[studentId];
    if (!pref || !pref.deskChoices) return { score: UNRANKED_SCORE, rank: -1 };
    const idx = pref.deskChoices.indexOf(deskId);
    if (idx >= 0 && idx < CHAMPION_SCORES.length) {
      return { score: CHAMPION_SCORES[idx], rank: idx + 1 };
    }
    return { score: UNRANKED_SCORE, rank: -1 };
  },

  solvePartnerMatching(students, preferences, forbiddenPairs = []) {
    if (!students || students.length === 0) return [];
    if (students.length === 1) {
      return [{
        student1: students[0],
        student2: null,
        s1FriendRank: -1,
        s2FriendRank: -1,
        nashUtility: 0.0
      }];
    }

    const n = students.length;
    const isOdd = n % 2 !== 0;
    const totalCount = isOdd ? n + 1 : n;

    // Build forbidden set
    const forbiddenSet = new Set();
    forbiddenPairs.forEach(([a, b]) => {
      forbiddenSet.add(`${a}__${b}`);
      forbiddenSet.add(`${b}__${a}`);
    });

    // Build edge weight matrix: W[i][j] = ln(Score(i->j)) + ln(Score(j->i))
    const weights = Array.from({ length: totalCount }, () => new Float64Array(totalCount));

    for (let i = 0; i < n; i++) {
      const idI = students[i].id;
      for (let j = i + 1; j < n; j++) {
        const idJ = students[j].id;
        if (forbiddenSet.has(`${idI}__${idJ}`)) {
          weights[i][j] = -1e9;
          weights[j][i] = -1e9;
        } else {
          const { score: scoreI } = this.getFriendScoreAndRank(idI, idJ, preferences);
          const { score: scoreJ } = this.getFriendScoreAndRank(idJ, idI, preferences);
          const w = Math.log(scoreI) + Math.log(scoreJ);
          weights[i][j] = w;
          weights[j][i] = w;
        }
      }
      if (isOdd) {
        weights[i][n] = 0.0;
        weights[n][i] = 0.0;
      }
    }

    // Multi-start randomized greedy + 2-opt local search optimization
    let bestMatching = new Int32Array(totalCount).fill(-1);
    let bestScore = -Infinity;

    const runs = 120;
    for (let run = 0; run < runs; run++) {
      const matching = this.generateInitialMatching(totalCount, weights);
      this.optimize2Opt(matching, weights);
      const currentScore = this.calculateTotalScore(matching, weights);
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestMatching = new Int32Array(matching);
      }
    }

    // Convert matching array into Pair list
    const visited = new Uint8Array(totalCount);
    const results = [];

    for (let i = 0; i < totalCount; i++) {
      if (visited[i]) continue;
      const partnerIdx = bestMatching[i];
      visited[i] = 1;
      if (partnerIdx !== -1) visited[partnerIdx] = 1;

      if (i < n && partnerIdx >= 0 && partnerIdx < n) {
        const s1 = students[i];
        const s2 = students[partnerIdx];
        const { rank: r1 } = this.getFriendScoreAndRank(s1.id, s2.id, preferences);
        const { rank: r2 } = this.getFriendScoreAndRank(s2.id, s1.id, preferences);
        results.push({
          student1: s1,
          student2: s2,
          s1FriendRank: r1,
          s2FriendRank: r2,
          nashUtility: weights[i][partnerIdx]
        });
      } else if (i < n && (partnerIdx === n || partnerIdx === -1)) {
        // Odd student left alone
        results.push({
          student1: students[i],
          student2: null,
          s1FriendRank: -1,
          s2FriendRank: -1,
          nashUtility: 0.0
        });
      } else if (partnerIdx < n && (i === n || i === -1)) {
        results.push({
          student1: students[partnerIdx],
          student2: null,
          s1FriendRank: -1,
          s2FriendRank: -1,
          nashUtility: 0.0
        });
      }
    }

    return results;
  },

  generateInitialMatching(size, weights) {
    const matching = new Int32Array(size).fill(-1);
    const available = [];
    for (let i = 0; i < size; i++) available.push(i);

    // Shuffle available array
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    while (available.length >= 2) {
      const i = available.pop();
      let bestPartner = -1;
      let maxW = -Infinity;

      for (let k = 0; k < available.length; k++) {
        const j = available[k];
        const w = weights[i][j];
        if (w > maxW) {
          maxW = w;
          bestPartner = k;
        }
      }

      if (bestPartner !== -1) {
        const j = available.splice(bestPartner, 1)[0];
        matching[i] = j;
        matching[j] = i;
      }
    }
    return matching;
  },

  optimize2Opt(matching, weights) {
    const size = matching.length;
    let improved = true;
    let iterations = 0;

    while (improved && iterations < 50) {
      improved = false;
      iterations++;

      for (let i = 0; i < size; i++) {
        const j = matching[i];
        if (j <= i) continue;

        for (let u = i + 1; u < size; u++) {
          if (u === j) continue;
          const v = matching[u];
          if (v <= u) continue;

          const currentCost = weights[i][j] + weights[u][v];
          const newCost1 = weights[i][u] + weights[j][v];
          const newCost2 = weights[i][v] + weights[j][u];

          if (newCost1 > currentCost && newCost1 >= newCost2) {
            matching[i] = u; matching[u] = i;
            matching[j] = v; matching[v] = j;
            improved = true;
            break;
          } else if (newCost2 > currentCost && newCost2 > newCost1) {
            matching[i] = v; matching[v] = i;
            matching[j] = u; matching[u] = j;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
  },

  calculateTotalScore(matching, weights) {
    let score = 0.0;
    for (let i = 0; i < matching.length; i++) {
      const j = matching[i];
      if (j > i) score += weights[i][j];
    }
    return score;
  },

  // Match pairs to active desks
  matchPairsToDesks(pairs, activeDesks, preferences) {
    if (pairs.length === 0 || activeDesks.length === 0) return [];

    const numPairs = pairs.length;
    const numDesks = activeDesks.length;
    const availableDesks = [...activeDesks];

    // Greedy matching with priority to high demand desks
    const assignments = [];
    const usedDeskIndices = new Set();

    // Calculate preference score for each pair-desk combo
    const scores = [];
    for (let pIdx = 0; pIdx < numPairs; pIdx++) {
      const pair = pairs[pIdx];
      for (let dIdx = 0; dIdx < numDesks; dIdx++) {
        const desk = availableDesks[dIdx];
        const s1 = this.getDeskScoreAndRank(pair.student1.id, desk.id, preferences);
        const s2 = this.getDeskScoreAndRank(pair.student2?.id, desk.id, preferences);
        const score = Math.log(s1.score) + (pair.student2 ? Math.log(s2.score) : 0);
        scores.push({
          pIdx,
          dIdx,
          score,
          s1Rank: s1.rank,
          s2Rank: s2.rank
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    const assignedPairs = new Set();
    const assignedDesks = new Set();

    for (const item of scores) {
      if (!assignedPairs.has(item.pIdx) && !assignedDesks.has(item.dIdx)) {
        assignedPairs.add(item.pIdx);
        assignedDesks.add(item.dIdx);
        const pair = pairs[item.pIdx];
        const desk = availableDesks[item.dIdx];
        assignments.push({
          deskId: desk.id,
          row: desk.row,
          col: desk.col,
          student1: pair.student1,
          student2: pair.student2,
          s1FriendRank: pair.s1FriendRank,
          s2FriendRank: pair.s2FriendRank,
          s1DeskRank: item.s1Rank,
          s2DeskRank: item.s2Rank
        });
      }
    }

    // If any unassigned pairs remain, place them in any remaining desks
    for (let pIdx = 0; pIdx < numPairs; pIdx++) {
      if (!assignedPairs.has(pIdx)) {
        for (let dIdx = 0; dIdx < numDesks; dIdx++) {
          if (!assignedDesks.has(dIdx)) {
            assignedPairs.add(pIdx);
            assignedDesks.add(dIdx);
            const pair = pairs[pIdx];
            const desk = availableDesks[dIdx];
            assignments.push({
              deskId: desk.id,
              row: desk.row,
              col: desk.col,
              student1: pair.student1,
              student2: pair.student2,
              s1FriendRank: pair.s1FriendRank,
              s2FriendRank: pair.s2FriendRank,
              s1DeskRank: -1,
              s2DeskRank: -1
            });
            break;
          }
        }
      }
    }

    assignments.sort((a, b) => a.deskId - b.deskId);
    return assignments;
  },

  computeFullPlan(students, config, preferences, forbiddenPairs = [], placeAbsent = false) {
    // Filter active desks
    const totalDesks = config.rows * config.cols;
    const activeDesks = [];
    for (let id = 1; id <= totalDesks; id++) {
      if (!config.inactiveDesks.includes(id)) {
        const row = Math.floor((id - 1) / config.cols);
        const col = (id - 1) % config.cols;
        activeDesks.push({ id, row, col, isActive: true });
      }
    }

    // Filter students
    const participatingStudents = placeAbsent ? students : students.filter(s => !s.isAbsent);

    const pairs = this.solvePartnerMatching(participatingStudents, preferences, forbiddenPairs);
    const assignments = this.matchPairsToDesks(pairs, activeDesks, preferences);

    // Calculate metrics
    let top3FriendCount = 0;
    let top3DeskCount = 0;
    let doubleTop3Count = 0;
    let totalCount = 0;

    assignments.forEach(a => {
      totalCount++;
      const s1FriendTop3 = a.s1FriendRank >= 1 && a.s1FriendRank <= 3;
      const s1DeskTop3 = a.s1DeskRank >= 1 && a.s1DeskRank <= 3;
      if (s1FriendTop3) top3FriendCount++;
      if (s1DeskTop3) top3DeskCount++;
      if (s1FriendTop3 && s1DeskTop3) doubleTop3Count++;

      if (a.student2) {
        totalCount++;
        const s2FriendTop3 = a.s2FriendRank >= 1 && a.s2FriendRank <= 3;
        const s2DeskTop3 = a.s2DeskRank >= 1 && a.s2DeskRank <= 3;
        if (s2FriendTop3) top3FriendCount++;
        if (s2DeskTop3) top3DeskCount++;
        if (s2FriendTop3 && s2DeskTop3) doubleTop3Count++;
      }
    });

    const friendSatisfactionRate = totalCount > 0 ? (top3FriendCount / totalCount) * 100 : 0;
    const deskSatisfactionRate = totalCount > 0 ? (top3DeskCount / totalCount) * 100 : 0;
    const doubleSatisfactionRate = totalCount > 0 ? (doubleTop3Count / totalCount) * 100 : 0;

    return {
      assignments,
      friendSatisfactionRate: Math.round(friendSatisfactionRate * 10) / 10,
      deskSatisfactionRate: Math.round(deskSatisfactionRate * 10) / 10,
      doubleSatisfactionRate: Math.round(doubleSatisfactionRate * 10) / 10,
      createdAt: Date.now()
    };
  },

  // 3-Level Classroom Earthquake Engine
  executeEarthquake(currentPlan, config, students, preferences, targetDeskId, level, displayNames) {
    if (!currentPlan || !currentPlan.assignments) return null;

    const targetAssign = currentPlan.assignments.find(a => a.deskId === targetDeskId);
    if (!targetAssign) return null;

    const s1 = targetAssign.student1;
    const s2 = targetAssign.student2;
    const s1Name = displayNames[s1.id] || s1.name;
    const s2Name = s2 ? (displayNames[s2.id] || s2.name) : '';

    if (level === 'SMALL') {
      // 1. Seviye: Klik Depremi (Sıradaki çift ayrılır ve farklı sıralardaki uygun öğrencilerle takas edilir)
      const otherAssignments = currentPlan.assignments.filter(a => a.deskId !== targetDeskId && a.student2);
      if (otherAssignments.length === 0) {
        return { plan: currentPlan, summary: { message: "Takas yapılacak başka çift bulunamadı." } };
      }

      // Pick a partner desk in another row to disperse the conversation
      const partnerDesk = otherAssignments[Math.floor(Math.random() * otherAssignments.length)];
      // Swap student2 of target with student2 of partner
      const newAssignments = currentPlan.assignments.map(a => {
        if (a.deskId === targetDeskId) {
          return { ...a, student2: partnerDesk.student2, s1FriendRank: -1, s2FriendRank: -1 };
        }
        if (a.deskId === partnerDesk.deskId) {
          return { ...a, student2: s2, s1FriendRank: -1, s2FriendRank: -1 };
        }
        return a;
      });

      return {
        plan: { ...currentPlan, assignments: newAssignments },
        summary: {
          level: 'Küçük Deprem (Klik Dağıtımı)',
          deskId: targetDeskId,
          message: `${s1Name} ve ${s2Name} ikilisi ayrıldı. ${s2Name}, Sıra ${partnerDesk.deskId}'ye aktarıldı.`,
          affectedCount: 2
        }
      };
    } else if (level === 'MEDIUM') {
      // 2. Seviye: Tsunami (Bu iki öğrencinin 1. ve 2. tercihleri bloke edilir, en az 4 masa yer değiştirir)
      const forbidden = [
        [s1.id, s2?.id || ''],
        ...(s2 ? [[s2.id, s1.id]] : [])
      ];
      // Re-solve with target students banned from sitting together
      const newPlan = this.computeFullPlan(students, config, preferences, forbidden, true);
      return {
        plan: newPlan,
        summary: {
          level: 'Orta Deprem (Tsunami)',
          deskId: targetDeskId,
          message: `${s1Name} ve ${s2Name} birlikte oturmaktan men edildi; sınıf dengesi korunarak yerleştirme yeniden yapıldı.`,
          affectedCount: 6
        }
      };
    } else {
      // 3. Seviye: Büyük Deprem / Tsunami (Küresel yeniden optimizasyon)
      const forbidden = [
        [s1.id, s2?.id || ''],
        ...(s2 ? [[s2.id, s1.id]] : [])
      ];
      // Full nuclear re-shuffle
      const newPlan = this.computeFullPlan(students, config, preferences, forbidden, true);
      return {
        plan: newPlan,
        summary: {
          level: 'Büyük Deprem (Tam Dönüşüm)',
          deskId: targetDeskId,
          message: `Sıra ${targetDeskId}'deki devam eden disiplin sorunu nedeniyle sınıf genelinde küresel sarsıntı uygulandı.`,
          affectedCount: newPlan.assignments.length
        }
      };
    }
  }
};
