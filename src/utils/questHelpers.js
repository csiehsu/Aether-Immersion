/**
 * Shared utility functions for NPC quests, prerequisites, and submissions.
 */

/**
 * 檢查並取得指定 NPC 當前可接取的第一個任務。
 * @param {Array<Object>} [questsList=[]] - 全域任務設定清單。
 * @param {Object} [player={}] - 玩家資料物件。
 * @param {string} cId - NPC 識別碼。
 * @param {string} [cName] - NPC 名稱（可選，相容依名稱匹配的舊設定）。
 * @returns {Object|null} 符合條件可接取的任務定義物件，無符合則回傳 null。
 */
export const getAvailableQuestForNpc = (questsList = [], player = {}, cId, cName) => {
  const pQuests = player?.quests || [];
  for (const qDef of (questsList || [])) {
    if (qDef.displayable !== true) continue;
    if (qDef.triggerType !== 'NPC') continue;
    const matchesNpc = qDef.triggerNpcId === cId || (cName && qDef.triggerNpcId === cName);
    if (!matchesNpc) continue;

    const alreadyHandled = pQuests.some(
      (pq) => pq.questId === qDef.questId && (pq.status === 'IN_PROGRESS' || pq.status === 'COMPLETED')
    );
    if (alreadyHandled) continue;

    if (qDef.minLevel && (player?.level || 1) < qDef.minLevel) continue;

    if (Array.isArray(qDef.prerequisites) && qDef.prerequisites.length > 0) {
      const meetsPrereq = qDef.prerequisites.every((req) => {
        if (req.type === 'QUEST_COMPLETED') {
          return pQuests.some((pq) => pq.questId === req.targetId && pq.status === 'COMPLETED');
        }
        return true;
      });
      if (!meetsPrereq) continue;
    }

    return qDef;
  }
  return null;
};

/**
 * 檢查指定 NPC 是否為進行中任務的交付對象或對話目標。
 * @param {Array<Object>} [questsList=[]] - 全域任務設定清單。
 * @param {Object} [player={}] - 玩家資料物件。
 * @param {string} cId - NPC 識別碼。
 * @returns {{ pQuest: Object, qDef: Object }|null} 進行中的玩家任務紀錄與對應任務定義，若無則回傳 null。
 */
export const getActiveQuestForNpc = (questsList = [], player = {}, cId) => {
  const pQuests = player?.quests || [];
  const activePQuests = pQuests.filter((pq) => pq.status === 'IN_PROGRESS');
  for (const pq of activePQuests) {
    const qDef = (questsList || []).find((q) => q.questId === pq.questId);
    if (!qDef) continue;
    const isSubmitNpc = qDef.submitNpcId === cId;
    const isTargetNpc = (qDef.objectives || []).some((obj) => obj.targetNpcId === cId);
    if (isSubmitNpc || isTargetNpc) {
      return { pQuest: pq, qDef };
    }
  }
  return null;
};

/**
 * 檢查進行中任務是否已達成所有目標並滿足提交條件。
 * @param {Object} qDef - 任務定義物件。
 * @param {Object} pQuest - 玩家任務進行進度物件。
 * @param {Array<Object>} [inventory=[]] - 玩家背包道具清單。
 * @returns {boolean} 若所有目標均已完成則回傳 true，否則回傳 false。
 */
export const checkCanSubmitQuest = (qDef, pQuest, inventory = []) => {
  if (!qDef || !pQuest) return false;
  const objectives = qDef.objectives || [];
  for (let idx = 0; idx < objectives.length; idx++) {
    const obj = objectives[idx];
    if (obj.type === 'TALK_NPC') {
      continue;
    }
    if (obj.type === 'HAS_ITEM') {
      const ownedCount = (inventory || [])
        .filter((i) => i.itemId === obj.targetId)
        .reduce((sum, item) => sum + (item.count || 1), 0);
      if (ownedCount < (obj.requiredCount || 1)) {
        return false;
      }
    }
    if (obj.type === 'CRAFT') {
      const prog = pQuest.progress?.[idx];
      const progCount = prog?.currentCount || 0;
      const ownedCount = (inventory || [])
        .filter((i) => i.itemId === obj.targetId)
        .reduce((sum, item) => sum + (item.count || 1), 0);
      if (!prog?.isCompleted && progCount < (obj.requiredCount || 1) && ownedCount < (obj.requiredCount || 1)) {
        return false;
      }
    }
    if (obj.type === 'VISIT_LOCATION') {
      const prog = pQuest.progress?.[idx];
      if (prog && !prog.isCompleted && prog.currentCount < (obj.requiredCount || 1)) {
        return false;
      }
    }
  }
  return true;
};
