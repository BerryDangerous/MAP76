import { POIMarker, CustomMarker, PowerArmorMarker } from '@/types/markers.js';
import { SettlementData } from '@/types/payloads.js';
import { QuestItem } from '@/types/quests.js';
import { SearchResult, SearchResultType } from '@/types/search.js';

import { mapState } from '@/core/state.js';

import { QuestUtils } from '@/utils/questUtils.js';
import { SearchUtils } from '@/utils/searchUtils.js';
import { getWorkshopIconType, getWorkshopBadgesHtml, getWorkshopSubtitle } from '@/utils/settlementUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';
import { t } from '@/core/i18n.js';

export const SearchEngine = {
    search(query: string): SearchResult[] {
        const results: SearchResult[] = [];
        if (!query || query.trim() === '') {
            return results;
        }

        const payload = mapState.lastPayload;
        if (!payload) return results;

        const addResult = (res: SearchResult) => {
            if (res.score > -100) {
                results.push(res);
            }
        };

        const settlementFormIds = new Set<number>();
        if (payload.settlements) {
            for (const w of payload.settlements) {
                if (w.markerFormId) settlementFormIds.add(w.markerFormId);
                if (w.formId) settlementFormIds.add(w.formId);
                if (w.locationFormId) settlementFormIds.add(w.locationFormId);
            }
        }

        if (payload.markers) {
            for (const m of payload.markers) {
                const shouldRender = m.visible || m.discovered || m.canFastTravel;
                if (!shouldRender || !m.name) continue;
                if (settlementFormIds.has(m.formId)) continue;
                
                const titleMatch = SearchUtils.fuzzyMatch(query, m.name);
                
                const wsName = WorldspaceUtils.getWorldspaceName(m.worldspace);
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
                        score: match.score
                    });
                }
            }
        }

        if (payload.settlements) {
            for (const w of payload.settlements) {
                if (!w.name) continue;

                const marker = payload.markers.find(m => m.formId === w.markerFormId || m.formId === w.formId || m.formId === w.locationFormId);
                if (marker) {
                    const shouldRender = marker.visible || marker.discovered || marker.canFastTravel;
                    if (!shouldRender && !w.owned) continue;
                } else if (!w.owned) {
                    continue;
                }

                const titleMatch = SearchUtils.fuzzyMatch(query, w.name);
                
                const subtitleType = getWorkshopSubtitle(w);
                
                const wsName = WorldspaceUtils.getWorldspaceName(w.worldspace);
                const subtitle = wsName ? `${subtitleType} - ${wsName}` : subtitleType;
                
                const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);
                
                if (titleMatch || subtitleMatch) {
                    const score = Math.max(titleMatch?.score || -Infinity, subtitleMatch?.score || -Infinity);
                    
                    let markerCoords;
                    if (marker) {
                        markerCoords = { x: marker.x, y: marker.y, worldspace: marker.worldspace };
                    }
                    
                    const iconType = getWorkshopIconType(w, marker);
                    const badgesHtml = getWorkshopBadgesHtml(w);
                    
                    addResult({
                        id: `workshop_${w.formId}`,
                        type: 'workshop',
                        title: w.name,
                        titleMatchIndices: titleMatch ? titleMatch.indices : [],
                        subtitle: subtitle,
                        subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                        originalRef: w,
                        markerCoords: markerCoords,
                        iconType: iconType,
                        customIcon: marker?.customIcon,
                        badgesHtml: badgesHtml,
                        score: score
                    });
                }
            }
        }

        if (payload.quests) {
            for (const q of payload.quests) {
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
        }

        if (payload.power_armor) {
            const p = payload.power_armor;
            const wsName = WorldspaceUtils.getWorldspaceName(p.worldspace);
            const subtitle = wsName ? `${t('search.resultType.powerArmor')} - ${wsName}` : t('search.resultType.powerArmor');
            
            const titleMatch = SearchUtils.fuzzyMatch(query, t('search.resultType.powerArmor'));
            const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);
            
            if (titleMatch || subtitleMatch) {
                const score = Math.max(titleMatch?.score || -Infinity, subtitleMatch?.score || -Infinity);
                addResult({
                    id: 'power_armor',
                    type: 'powerArmor',
                    title: t('search.resultType.powerArmor'),
                    titleMatchIndices: titleMatch ? titleMatch.indices : [],
                    subtitle: subtitle,
                    subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                    originalRef: payload.power_armor,
                    markerCoords: { x: payload.power_armor.x, y: payload.power_armor.y, z: payload.power_armor.z, worldspace: payload.power_armor.worldspace },
                    score: score
                });
            }
        }

        if (payload.custom_marker) {
            const m = payload.custom_marker;
            const wsName = WorldspaceUtils.getWorldspaceName(m.worldspace);
            const subtitle = wsName ? `${t('search.resultType.customMarker')} - ${wsName}` : t('search.resultType.customMarker');
            
            const titleMatch = SearchUtils.fuzzyMatch(query, t('search.resultType.customMarker'));
            const subtitleMatch = SearchUtils.fuzzyMatch(query, subtitle);
            
            if (titleMatch || subtitleMatch) {
                const score = Math.max(titleMatch?.score || -Infinity, subtitleMatch?.score || -Infinity);
                addResult({
                    id: 'custom_marker',
                    type: 'customMarker',
                    title: t('search.resultType.customMarker'),
                    titleMatchIndices: titleMatch ? titleMatch.indices : [],
                    subtitle: subtitle,
                    subtitleMatchIndices: subtitleMatch ? subtitleMatch.indices : [],
                    originalRef: payload.custom_marker,
                    markerCoords: { x: payload.custom_marker.x, y: payload.custom_marker.y, worldspace: payload.custom_marker.worldspace },
                    score: score
                });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results;
    }
};
