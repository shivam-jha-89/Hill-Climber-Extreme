// Garage & Save Progression Economy System for Hill Climb Racing

import { VEHICLE_CATALOG, UPGRADE_CONFIG } from './vehicle.js';

export const STAGE_CATALOG = {
  countryside: {
    id: 'countryside',
    name: 'Countryside',
    description: 'Rolling green hills and pleasant jumps. The perfect starting track.',
    price: 0,
    gravity: 52,
    color: '#52b788'
  },
  desert: {
    id: 'desert',
    name: 'Desert',
    description: 'Challenging steep sand dunes and bumpy sandstone ridges.',
    price: 3500,
    gravity: 52,
    color: '#fb8500'
  },
  moon: {
    id: 'moon',
    name: 'Moon',
    description: 'Low lunar gravity! Spectacular high-flying air time and tricky landings.',
    price: 10000,
    gravity: 18,
    color: '#adb5bd'
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain Peaks',
    description: 'Treacherous steep cliffs, sharp kickers & razor chasms! Balance your car mid-air or driver will be down.',
    price: 0,
    gravity: 54,
    color: '#e76f51'
  }
};

const STORAGE_KEY = 'hill_climb_save_data_v1';

export class GarageManager {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    const defaultData = {
      coins: 500, // Starter bonus coins
      selectedVehicle: 'jeep',
      selectedStage: 'countryside',
      unlockedVehicles: ['jeep'],
      unlockedStages: ['countryside', 'mountain'],
      upgrades: {
        jeep: { engine: 0, suspension: 0, tires: 0, fourWD: 0 },
        bike: { engine: 0, suspension: 0, tires: 0, fourWD: 0 },
        truck: { engine: 0, suspension: 0, tires: 0, fourWD: 0 }
      },
      highScores: {
        countryside: 0,
        desert: 0,
        moon: 0,
        mountain: 0
      }
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const unlockedStages = Array.isArray(parsed.unlockedStages) ? [...parsed.unlockedStages] : ['countryside'];
        if (!unlockedStages.includes('mountain')) {
          unlockedStages.push('mountain');
        }
        return {
          ...defaultData,
          ...parsed,
          unlockedStages,
          upgrades: { ...defaultData.upgrades, ...(parsed.upgrades || {}) },
          highScores: { ...defaultData.highScores, ...(parsed.highScores || {}) }
        };
      }
    } catch (e) {
      console.warn('Could not read save data from localStorage:', e);
    }
    return defaultData;
  }

  saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not write save data to localStorage:', e);
    }
  }

  addCoins(amount) {
    this.data.coins += amount;
    this.saveData();
    return this.data.coins;
  }

  getUpgradeLevel(vehicleId, upgradeType) {
    const vUp = this.data.upgrades[vehicleId] || {};
    return vUp[upgradeType] || 0;
  }

  getUpgradeCost(upgradeType, currentLevel) {
    const cfg = UPGRADE_CONFIG[upgradeType];
    if (!cfg || currentLevel >= cfg.maxLevel) return null;
    return Math.round(cfg.baseCost * Math.pow(cfg.costMult, currentLevel));
  }

  canBuyUpgrade(vehicleId, upgradeType) {
    const curLevel = this.getUpgradeLevel(vehicleId, upgradeType);
    const cost = this.getUpgradeCost(upgradeType, curLevel);
    if (cost === null) return false;
    return this.data.coins >= cost;
  }

  buyUpgrade(vehicleId, upgradeType) {
    const curLevel = this.getUpgradeLevel(vehicleId, upgradeType);
    const cost = this.getUpgradeCost(upgradeType, curLevel);
    if (cost === null || this.data.coins < cost) return false;

    this.data.coins -= cost;
    if (!this.data.upgrades[vehicleId]) {
      this.data.upgrades[vehicleId] = { engine: 0, suspension: 0, tires: 0, fourWD: 0 };
    }
    this.data.upgrades[vehicleId][upgradeType] = curLevel + 1;
    this.saveData();
    return true;
  }

  unlockVehicle(vehicleId) {
    const v = VEHICLE_CATALOG[vehicleId];
    if (!v || this.data.unlockedVehicles.includes(vehicleId)) return true;
    if (this.data.coins < v.price) return false;

    this.data.coins -= v.price;
    this.data.unlockedVehicles.push(vehicleId);
    this.data.selectedVehicle = vehicleId;
    this.saveData();
    return true;
  }

  unlockStage(stageId) {
    const s = STAGE_CATALOG[stageId];
    if (!s || this.data.unlockedStages.includes(stageId)) return true;
    if (this.data.coins < s.price) return false;

    this.data.coins -= s.price;
    this.data.unlockedStages.push(stageId);
    this.data.selectedStage = stageId;
    this.saveData();
    return true;
  }

  selectVehicle(vehicleId) {
    if (this.data.unlockedVehicles.includes(vehicleId)) {
      this.data.selectedVehicle = vehicleId;
      this.saveData();
      return true;
    }
    return false;
  }

  selectStage(stageId) {
    if (this.data.unlockedStages.includes(stageId)) {
      this.data.selectedStage = stageId;
      this.saveData();
      return true;
    }
    return false;
  }

  recordDistance(stageId, distance) {
    const dist = Math.round(distance);
    const cur = this.data.highScores[stageId] || 0;
    if (dist > cur) {
      this.data.highScores[stageId] = dist;
      this.saveData();
      return true; // New record!
    }
    return false;
  }
}

export const garageManager = new GarageManager();
