import { StringUtils } from '@/utils/stringUtils.js';

export interface FuzzyMatchResult {
    score: number;
    indices: number[];
}

export const SearchUtils = {
    fuzzyMatch(pattern: string, text: string): FuzzyMatchResult | null {
        if (!pattern) return { score: 0, indices: [] };
        if (!text) return null;

        const lowerPattern = pattern.trim().toLowerCase();
        const lowerText = text.toLowerCase();
        if (lowerPattern === '') return { score: 0, indices: [] };

        const terms = lowerPattern.split(/\s+/);
        let totalScore = 0;
        const allIndices: number[] = [];

        for (const term of terms) {
            // 1. Direct contiguous substring match
            const subIdx = lowerText.indexOf(term);
            if (subIdx !== -1) {
                const termIndices = Array.from({ length: term.length }, (_, i) => subIdx + i);
                allIndices.push(...termIndices);

                let termScore = 100;
                // Bonus if word start
                if (subIdx === 0 || /[\s_\-\/'"]/.test(lowerText[subIdx - 1])) {
                    termScore += 50;
                }
                // Penalty for extra length in text
                termScore -= (text.length - term.length) * 0.5;
                totalScore += termScore;
                continue;
            }

            // 2. Acronym / Word-start match
            let wordMatchIdx = 0;
            const acronymIndices: number[] = [];

            for (let i = 0; i < lowerText.length; i++) {
                const isWordStart = (i === 0 || /[\s_\-\/'"]/.test(lowerText[i - 1])) && !/[\s_\-\/'"]/.test(lowerText[i]);
                if (isWordStart && wordMatchIdx < term.length) {
                    if (lowerText[i] === term[wordMatchIdx]) {
                        acronymIndices.push(i);
                        wordMatchIdx++;
                    }
                }
            }

            if (wordMatchIdx === term.length) {
                allIndices.push(...acronymIndices);
                totalScore += 40;
                continue;
            }

            // 3. Fallback: fuzzy character match with strict gap limit
            let pIdx = 0;
            let tIdx = 0;
            let gap = 0;
            const fuzzyIndices: number[] = [];
            let termScore = 0;

            while (pIdx < term.length && tIdx < lowerText.length) {
                if (term[pIdx] === lowerText[tIdx]) {
                    fuzzyIndices.push(tIdx);
                    const isStart = tIdx === 0 || /[\s_\-\/'"]/.test(lowerText[tIdx - 1]);
                    termScore += isStart ? 10 : 3;
                    pIdx++;
                    gap = 0;
                } else {
                    gap++;
                    if (gap > 2 && pIdx > 0) {
                        break;
                    }
                }
                tIdx++;
            }

            if (pIdx === term.length) {
                allIndices.push(...fuzzyIndices);
                totalScore += termScore;
            } else {
                return null;
            }
        }

        const uniqueIndices = Array.from(new Set(allIndices)).sort((a, b) => a - b);
        return { score: totalScore, indices: uniqueIndices };
    },

    highlightText(text: string, indices: number[]): string {
        return StringUtils.escapeHtml(text);
    }
};
