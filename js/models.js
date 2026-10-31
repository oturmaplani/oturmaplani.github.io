/**
 * SIRA PWA - Models and Sample Data
 * Implements Turkish name utilities and official 7-C benchmark dataset.
 */

export const TurkishNameUtils = {
  formatFullName(name) {
    if (!name) return '';
    return name.trim().split(/\s+/).map(word => {
      if (!word) return '';
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    }).join(' ');
  },

  computeDisplayNames(students) {
    const parsedList = students.map(s => {
      const clean = this.formatFullName(s.name);
      const parts = clean.split(/\s+/);
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] || '');
      const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      const initial = lastName ? `${lastName.charAt(0).toLocaleUpperCase('tr-TR')}.` : '';
      const abbreviated = initial ? `${firstName} ${initial}` : firstName;
      return { id: s.id, clean, abbreviated, lastName };
    });

    // Count occurrences of abbreviated names to detect collisions (e.g. two "Ahmet K.")
    const countMap = {};
    parsedList.forEach(item => {
      countMap[item.abbreviated] = (countMap[item.abbreviated] || 0) + 1;
    });

    const resultMap = {};
    parsedList.forEach(item => {
      if (countMap[item.abbreviated] > 1) {
        // Collision -> show full surname
        resultMap[item.id] = item.clean;
      } else {
        // Unique -> show "Ad S."
        resultMap[item.id] = item.abbreviated;
      }
    });
    return resultMap;
  },

  getAvatarInitial(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toLocaleUpperCase('tr-TR');
  }
};

export const SAMPLE_7C_STUDENTS = [
  { id: "s7c_1", no: 26, name: "Hayrettin Bağlı", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_2", no: 43, name: "Özlem Mazı", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_3", no: 58, name: "Talha Toygar Kurt", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_4", no: 294, name: "Zeynep Naz Samsa", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_5", no: 309, name: "Yağmursena Demir", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_6", no: 319, name: "Salih Tekin", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_7", no: 384, name: "Fatma Azra Özer", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_8", no: 476, name: "Zafer Cenk Çiftci", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_9", no: 561, name: "Tuğba Hayta", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_10", no: 564, name: "Irmak Çidem", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_11", no: 573, name: "Mira Ergül", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_12", no: 638, name: "Elanur Kaya", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_13", no: 730, name: "Doğan Ocakbaşı", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_14", no: 756, name: "Fatih Çabuk", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_15", no: 841, name: "Muhammed Ali Öndarö", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_16", no: 872, name: "Ceren Öztürk", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_17", no: 893, name: "Kerem Çolak", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_18", no: 949, name: "Muhammed Yahya Tunç", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_19", no: 1074, name: "Volkan Kerem Göksal", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_20", no: 1094, name: "Adem Topaloğlu", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_21", no: 1190, name: "Arda Çınar", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_22", no: 1210, name: "Ayaz Işı", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_23", no: 1243, name: "Berilsu Saraçlı", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_24", no: 1261, name: "Rüya Ökmen", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_25", no: 1278, name: "Cansu Ateş", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_26", no: 1345, name: "Fatma Mahmoud", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_27", no: 1480, name: "Uğur Toprak Kocagil", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_28", no: 1507, name: "Yağmur Cengiz", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_29", no: 1561, name: "Doğuş Mankır", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_30", no: 1807, name: "Yaman Akpınar", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_31", no: 1885, name: "Elif Su Böbek", gender: "Kız", hasVoted: true, isAbsent: false },
  { id: "s7c_32", no: 1887, name: "Emir Tamar", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_33", no: 3004, name: "Batuhan Adıgüzel", gender: "Erkek", hasVoted: true, isAbsent: false },
  { id: "s7c_34", no: 3054, name: "Selim Alabay", gender: "Erkek", hasVoted: true, isAbsent: false }
];

export function createSample7CPreferences() {
  const p = (friendChoices, deskChoices = [1, 2, 6, 7, 11]) => ({
    friendChoices: friendChoices.map(n => `s7c_${n}`),
    deskChoices: deskChoices
  });

  return {
    "s7c_1": p([6, 14, 20, 34, 32], [1, 2, 6, 7, 11]),
    "s7c_2": p([11, 4, 5, 10, 12], [1, 2, 6, 7, 3]),
    "s7c_3": p([8, 13, 21, 22, 33], [11, 12, 16, 17, 6]),
    "s7c_4": p([5, 2, 11, 10, 7], [1, 6, 2, 7, 11]),
    "s7c_5": p([4, 11, 2, 10, 24], [1, 6, 2, 7, 11]),
    "s7c_6": p([1, 14, 20, 32, 34], [2, 1, 7, 6, 12]),
    "s7c_7": p([9, 12, 16, 23, 4], [6, 7, 1, 2, 11]),
    "s7c_8": p([3, 13, 21, 22, 33], [11, 16, 12, 17, 6]),
    "s7c_9": p([7, 16, 12, 23, 5], [7, 8, 6, 1, 12]),
    "s7c_10": p([11, 4, 5, 2, 12], [1, 2, 6, 3, 7]),
    "s7c_11": p([2, 4, 5, 10, 25], [1, 2, 6, 7, 11]),
    "s7c_12": p([7, 9, 16, 2, 10], [6, 7, 8, 1, 2]),
    "s7c_13": p([3, 8, 21, 22, 33], [11, 12, 16, 17, 6]),
    "s7c_14": p([1, 6, 20, 32, 34], [2, 1, 7, 6, 12]),
    "s7c_15": p([18, 19, 29, 30, 17], [16, 17, 11, 12, 18]),
    "s7c_16": p([7, 9, 12, 23, 28], [7, 8, 6, 2, 12]),
    "s7c_17": p([18, 19, 15, 29, 30], [17, 18, 12, 13, 16]),
    "s7c_18": p([15, 19, 17, 29, 30], [16, 17, 18, 11, 12]),
    "s7c_19": p([15, 18, 17, 30, 29], [17, 18, 16, 12, 13]),
    "s7c_20": p([1, 6, 14, 34, 32], [2, 1, 7, 6, 11]),
    "s7c_21": p([3, 8, 13, 22, 33], [12, 11, 17, 16, 7]),
    "s7c_22": p([3, 8, 13, 21, 33], [12, 11, 17, 16, 6]),
    "s7c_23": p([7, 9, 16, 12, 28], [8, 7, 6, 13, 12]),
    "s7c_24": p([5, 4, 11, 2, 25], [2, 1, 7, 6, 3]),
    "s7c_25": p([11, 2, 4, 5, 24], [1, 2, 6, 7, 11]),
    "s7c_26": p([4, 5, 2, 11, 7], [1, 2, 3, 6, 7]),  // Fatma Mahmoud (İzole/yeni gelen)
    "s7c_27": p([3, 8, 1, 6, 14], [16, 17, 11, 12, 6]), // Uğur Toprak (İzole)
    "s7c_28": p([16, 7, 9, 23, 12], [8, 7, 13, 12, 6]),
    "s7c_29": p([15, 18, 19, 30, 17], [16, 17, 18, 11, 12]),
    "s7c_30": p([15, 18, 19, 29, 17], [17, 18, 16, 12, 13]),
    "s7c_31": p([2, 4, 5, 11, 25], [1, 2, 6, 7, 3]),
    "s7c_32": p([1, 6, 14, 20, 34], [2, 1, 7, 6, 12]),
    "s7c_33": p([3, 8, 13, 21, 22], [11, 12, 16, 17, 6]),
    "s7c_34": p([1, 6, 14, 20, 32], [2, 1, 7, 6, 12])
  };
}

export function createDefaultClassroomConfig() {
  return {
    rows: 4,
    cols: 5,
    inactiveDesks: [19, 20], // Desks 19 & 20 inactive for 17 active 2-seater desks = 34 capacity
    windowSide: "left",       // "left" (Sol) or "right" (Sağ)
    doorSide: "right",        // "right" (Arka sağ)
    boardSide: "top"          // Tahta / Kürsü önde
  };
}
