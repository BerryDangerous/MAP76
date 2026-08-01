import { SettlementData } from '../types/payloads.js';

export interface SettlementDataWithRatings extends SettlementData {
    ratings?: {
        food?: number;
        water?: number;
        beds?: number;
        power?: number;
        defense?: number;
        population?: number;
        happiness?: number;
        overallAlert?: boolean;
    };
}

export interface SettlementResolvedRatings {
    food: number;
    water: number;
    beds: number;
    power: number;
    defense: number;
    population: number;
    happiness: number;
    overallStatus: -1 | 0 | 1; // -1 for alert, 1 for increasing, 0 for neutral
}

export function calculateSettlementRatings(settlement: SettlementDataWithRatings): SettlementResolvedRatings {
    const rawRatings = settlement.ratings || {};

    const foodRating = rawRatings.food ?? (settlement.food < settlement.population ? -1 : 0);
    const waterRating = rawRatings.water ?? (settlement.water < settlement.population ? -1 : 0);
    const bedsRating = rawRatings.beds ?? (settlement.beds < settlement.population ? -1 : 0);
    const defenseRating = rawRatings.defense ?? (settlement.defense < (settlement.food + settlement.water) ? -1 : 0);
    const powerRating = rawRatings.power ?? 0;
    const populationRating = rawRatings.population ?? 0;
    const happinessRating = rawRatings.happiness ?? 0;

    let overallStatus: -1 | 0 | 1 = 0;
    
    if (foodRating < 0 || waterRating < 0 || bedsRating < 0 || defenseRating < 0 || powerRating < 0 || populationRating < 0 || happinessRating < 0 || rawRatings.overallAlert) {
        overallStatus = -1;
    } else if (foodRating > 0 || waterRating > 0 || bedsRating > 0 || defenseRating > 0 || powerRating > 0 || populationRating > 0 || happinessRating > 0) {
        overallStatus = 1;
    }

    return {
        food: foodRating,
        water: waterRating,
        beds: bedsRating,
        power: powerRating,
        defense: defenseRating,
        population: populationRating,
        happiness: happinessRating,
        overallStatus
    };
}
