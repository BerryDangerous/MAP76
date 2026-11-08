import { SearchResult } from './types.js';

import { domainState } from '@/core/state/index.js';
import { getWorldspaceName } from '@/core/state/worldspaces.js';
import { t } from '@/core/i18n.js';

import { QuestUtils } from './questRules.js';
import { getWorkshopIconType, getWorkshopBadgesHtml, getWorkshopSubtitle } from './settlementRules.js';
import { SearchUtils } from './searchUtils.js';

export function searchEntities(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    if (!query || query.trim() === '') {
        return results;
    }

    const addResult = (res: SearchResult) => {
        if (res.score > -100) {
            results.push(res);
        }
    };

    const settlementFormIds = new Set<number>();
    for (const w of domainState.settlements.values()) {
        if (w.markerFormId) settlementFormIds.add(w.markerFormId);
        if (w.formId) settlementFormIds.add(w.formId);
        if (w.locationFormId) settlementFormIds.add(w.locationFormId);
    }

    for (const m of domainState.markers.values()) {
        const shouldRender = m.visible || m.discovered || m.canFastTravel;
        if (!shouldRender || !m.name) continue;
        if (settlementFormIds.has(m.formId)) continue;

        const titleMatch = SearchUtils.fuzzyMatch(query, m.name);
        const wsName = getWorldspaceName(m.worldspace);
        const subtitle = wsName ? `${t('search.resultType.location')} - ${wsName}` : t('search.resultType.location');
        const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);

        if (titleMatch || subtitleMatch) {
            const match = titleMatch || subtitleMatch!;
            addResult({
                id: `marker_${m.formId}`,
                type: 'marker',
                title: m.name,
                titleMatchIndices: titleMatch ? titleMatch.indices : [],
                subtitle: subtitle,
                subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                originalRef: m,
                markerCoords: { x: m.x, y: m.y, worldspace: m.worldspace },
                iconType: m.type,
                customIcon: m.customIcon,
                discovered: m.discovered || m.canFastTravel,
                score: match.score
            });
        }
    }

    for (const w of domainState.settlements.values()) {
        if (!w.name) continue;

        const marker = domainState.markers.get(w.markerFormId ?? w.formId ?? w.locationFormId ?? 0);
        if (marker) {
            const shouldRender = marker.visible || marker.discovered || marker.canFastTravel;
            if (!shouldRender && !w.owned) continue;
        } else if (!w.owned) {
            continue;
        }

        const titleMatch = SearchUtils.fuzzyMatch(query, w.name);
        const subtitle = getWorkshopSubtitle(w);
        const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);

        if (titleMatch || subtitleMatch) {
            const match = titleMatch || subtitleMatch!;
            const markerCoords = marker ? { x: marker.x, y: marker.y, worldspace: marker.worldspace } : undefined;
            const badgesHtml = getWorkshopBadgesHtml(w);

            addResult({
                id: `workshop_${w.formId || w.markerFormId || w.name}`,
                type: 'workshop',
                title: w.name,
                titleMatchIndices: titleMatch ? titleMatch.indices : [],
                subtitle: subtitle,
                subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                originalRef: w,
                markerCoords: markerCoords,
                iconType: getWorkshopIconType(w),
                discovered: marker ? (marker.discovered || marker.canFastTravel) : w.owned,
                badgesHtml: badgesHtml,
                score: match.score
            });
        }
    }

    for (const q of domainState.quests.values()) {
        let maxScore = -Infinity;
        let titleIndices: number[] = [];
        let subtitleIndices: number[] = [];

        const titleMatch = SearchUtils.fuzzyMatch(query, q.questName);
        if (titleMatch) {
            maxScore = Math.max(maxScore, titleMatch.score);
            titleIndices = titleMatch.indices;
        }

        const isCompleted = QuestUtils.isQuestCompleted(q);
        const subtitle = isCompleted ? t('quests.type.completed') : t(`quests.type.${q.type || 'side'}`);

        const typeMatch = SearchUtils.fuzzyMatch(query, subtitle);
        if (typeMatch && typeMatch.score > maxScore) {
            maxScore = typeMatch.score;
            subtitleIndices = typeMatch.indices;
        }

        if (q.journal) {
            const journalMatch = SearchUtils.fuzzyMatch(query, q.journal);
            if (journalMatch && journalMatch.score > maxScore) {
                maxScore = journalMatch.score;
            }
        }

        if (q.objectives) {
            for (const obj of q.objectives) {
                if (obj.text) {
                    const objMatch = SearchUtils.fuzzyMatch(query, obj.text);
                    if (objMatch && objMatch.score > maxScore) {
                        maxScore = objMatch.score;
                    }
                }
            }
        }

        if (maxScore > -Infinity) {
            let markerCoords;
            if (q.isTracked && q.objectives) {
                const activeObj = q.objectives.find(o => o.state === 1) || q.objectives[0];
                if (activeObj && activeObj.targets && activeObj.targets.length > 0) {
                    const target = activeObj.targets[0];
                    markerCoords = { x: target.x, y: target.y, z: target.z, worldspace: target.worldspace };
                }
            }

            addResult({
                id: `quest_${q.formId !== undefined ? q.formId : q.questName}`,
                type: 'quest',
                title: q.questName,
                titleMatchIndices: titleIndices,
                subtitle: subtitle,
                subtitleMatchIndices: subtitleIndices,
                originalRef: q,
                markerCoords: markerCoords,
                score: maxScore
            });
        }
    }

    const matchSingletonEntity = (
        id: string,
        type: 'powerArmor' | 'customMarker',
        label: string,
        ref: { worldspace: number; x: number; y: number; z?: number }
    ) => {
        const wsName = getWorldspaceName(ref.worldspace);
        const subtitle = wsName ? `${label} - ${wsName}` : label;

        const titleMatch = SearchUtils.fuzzyMatch(query, label);
        const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);

        if (titleMatch || subtitleMatch) {
            const score = Math.max(titleMatch?.score ?? -Infinity, subtitleMatch?.score ?? -Infinity);
            addResult({
                id,
                type,
                title: label,
                titleMatchIndices: titleMatch ? titleMatch.indices : [],
                subtitle,
                subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                originalRef: ref,
                markerCoords: { x: ref.x, y: ref.y, z: ref.z, worldspace: ref.worldspace },
                score
            });
        }
    };

    if (domainState.lastPayload?.power_armor) {
        matchSingletonEntity('power_armor', 'powerArmor', t('search.resultType.powerArmor'), domainState.lastPayload.power_armor);
    }

    if (domainState.lastPayload?.custom_marker) {
        matchSingletonEntity('custom_marker', 'customMarker', t('search.resultType.customMarker'), domainState.lastPayload.custom_marker);
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}
