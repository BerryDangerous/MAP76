import { POIMarker } from '@/types/markers.js';
import { SettlementData } from '@/types/payloads.js';

import { MARKER_ICON_SETTLEMENT, MARKER_ICON_RAIDER_OUTPOST, MARKER_ICON_VASSAL_SETTLEMENT } from '@/core/constants.js';

import { AssetManager } from '@/systems/assetManager.js';
import { t } from '@/core/i18n.js';

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

export function getWorkshopIconType(workshop: SettlementDataWithRatings, marker?: POIMarker): number {
    if (workshop.iconType !== undefined && workshop.iconType !== 0) {
        return workshop.iconType;
    } else if (workshop.raider) {
        return MARKER_ICON_RAIDER_OUTPOST;
    } else if (workshop.vassal) {
        return MARKER_ICON_VASSAL_SETTLEMENT;
    } else if (marker) {
        return marker.type;
    }
    return MARKER_ICON_SETTLEMENT;
}

export function getWorkshopBadgesHtml(workshop: SettlementDataWithRatings): string {
    let badgesHtml = '';

    const ratings = calculateSettlementRatings(workshop);
    if (ratings.overallStatus === -1) {
        const alertSvg = AssetManager.getIconSvg('workshop-alert');
        badgesHtml += `<span class="wl-status-badge icon-wrapper" style="width: 14px; height: 14px; display: inline-block; margin-left: 4px;">${alertSvg}</span>`;
    } else if (ratings.overallStatus === 1) {
        const increasingSvg = AssetManager.getIconSvg('workshop-increasing');
        badgesHtml += `<span class="wl-status-badge icon-wrapper" style="width: 14px; height: 14px; display: inline-block; margin-left: 4px;">${increasingSvg}</span>`;
    }

    if (workshop.raider) {
        badgesHtml += `<span class="wl-status-badge icon-wrapper" style="width: 14px; height: 14px; display: inline-block; margin-left: 4px;">${AssetManager.getIconSvg('workshop-raider-outpost')}</span>`;
    } else if (workshop.vassal) {
        badgesHtml += `<span class="wl-status-badge icon-wrapper" style="width: 14px; height: 14px; display: inline-block; margin-left: 4px;">${AssetManager.getIconSvg('workshop-vassal-settlement')}</span>`;
    }

    return badgesHtml;
}

export function getWorkshopSubtitle(workshop: SettlementData): string {
    if (workshop.raider) return t('locations.subtitle.raider');
    if (workshop.vassal) return t('locations.subtitle.vassal');
    if (workshop.vr) return t('locations.subtitle.vr');
    return t('locations.subtitle.default');
}
