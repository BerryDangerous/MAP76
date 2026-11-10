import { MarkerKind, MarkerSelectPayload, EmptyMapClickPayload, ScreenAnchor, Point2D } from '@/types/seams.js';
import { SettlementData } from '@/types/payloads.js';
import { QuestItem } from '@/types/quests.js';
import { SearchResult } from '../domain/types.js';
import { Corner } from '../positioning.js';

import { domainState } from '@/core/state/index.js';
import { FocusOwner, InputRouter } from '@/input/index.js';

import { SoundService } from '@/services/soundService.js';

import { CustomMarkerCard } from '../cards/CustomMarkerCard.js';
import { LocationCard, type LocationCardOpenOptions } from '../cards/LocationCard.js';
import { QuestCard } from '../cards/QuestCard.js';
import { QuestList } from '../panels/QuestsPanel.js';
import { LocationsList, type LocationListItem } from '../panels/LocationsPanel.js';
import { SearchPanel } from '../panels/SearchPanel.js';

export type FastTravelHandler = (formId: number, name: string) => void;

export interface ActiveCardRegistration {
    id: FocusOwner;
    element: HTMLElement | null;
    referencePanel: HTMLElement | null;
    onDismiss: () => void;
}

export interface OpenCardOptions {
    cardElement: HTMLElement | null;
    referencePanel?: HTMLElement | null;
    onDismiss: () => void;
    takeFocus?: boolean;
}

export interface RegisteredPanel {
    id: FocusOwner;
    element: HTMLElement;
    collapse: () => void;
}

export class OverlayCoordinator {
    private activeCard: ActiveCardRegistration | null = null;
    private readonly expandedPanels = new Map<FocusOwner, RegisteredPanel>();
    private dockedCardRafId: number | null = null;
    private pendingCardAction: (() => void) | null = null;
    private fastTravelHandler: FastTravelHandler | null = null;

    constructor() {
        LocationCard.onClose = () => this.handleCardClosed(FocusOwner.LOCATION_CARD);
        LocationCard.onNavBack = () => this.handleCardNavBack(FocusOwner.LOCATION_CARD);
        LocationCard.onFastTravel = (formId, name) => this.requestFastTravel(formId, name);

        QuestCard.onClose = () => this.handleCardClosed(FocusOwner.QUEST_CARD);
        QuestCard.onNavBack = () => this.handleCardNavBack(FocusOwner.QUEST_CARD);

        CustomMarkerCard.onClose = () => this.handleCardClosed(FocusOwner.CUSTOM_MARKER_CARD);
        CustomMarkerCard.onNavBack = () => this.handleCardNavBack(FocusOwner.CUSTOM_MARKER_CARD);

        this.wirePanels();
    }

    private wirePanels(): void {
        QuestList.onExpanded = () => this.notifyPanelExpanded(FocusOwner.QUEST_LIST);
        QuestList.onRequestCloseCards = () => {
            const container = document.getElementById('quest-list-panel');
            if (container) this.dismissCardIfAnchoredTo(container);
        };
        QuestList.onFlushScheduledCard = () => this.flushScheduledCard();
        QuestList.onNavigateToDockedCard = () => this.navigateToDockedCard();
        QuestList.onSelectionChange = (quest) => {
            if (quest) {
                this.scheduleDockedCard(() => {
                    const container = document.getElementById('quest-list-panel');
                    this.showQuestDetails(quest, undefined, container || undefined, QuestList.getState().dockCorner, false);
                });
            } else {
                this.cancelScheduledCard();
                this.dismissActiveCard();
            }
        };

        LocationsList.onExpanded = () => this.notifyPanelExpanded(FocusOwner.WORKSHOP_LIST);
        LocationsList.onRequestCloseCards = () => {
            const container = document.getElementById('locations-list-panel');
            if (container) this.dismissCardIfAnchoredTo(container);
        };
        LocationsList.onFlushScheduledCard = () => this.flushScheduledCard();
        LocationsList.onNavigateToDockedCard = () => this.navigateToDockedCard();
        LocationsList.onSelectionChange = (item: LocationListItem | null) => {
            if (item) {
                this.scheduleDockedCard(() => {
                    const container = document.getElementById('locations-list-panel');
                    const dockCorner = LocationsList.getState().dockCorner;
                    if (item.type === 'favorite') {
                        const marker = item.marker;
                        this.openLocationCard({
                            markerFormId: marker.formId,
                            title: marker.name,
                            canFastTravel: marker.canFastTravel,
                            referencePanel: container || undefined,
                            dockCorner,
                            takeFocus: false
                        });
                    } else if (item.type === 'workshop') {
                        const workshop = item.data;
                        const marker = domainState.markers.get(workshop.markerFormId);
                        const canFastTravel = marker ? marker.canFastTravel : workshop.owned;
                        this.openLocationCard({
                            markerFormId: workshop.markerFormId,
                            title: workshop.name,
                            canFastTravel,
                            settlement: workshop.vassal ? undefined : workshop,
                            referencePanel: container || undefined,
                            dockCorner,
                            takeFocus: false
                        });
                    } else {
                        this.dismissActiveCard();
                    }
                });
            } else {
                this.cancelScheduledCard();
                this.dismissActiveCard();
            }
        };

        SearchPanel.onExpanded = () => this.notifyPanelExpanded(FocusOwner.SEARCH_PANEL);
        SearchPanel.onRequestCloseCards = () => {
            const container = document.getElementById('search-panel');
            if (container) this.dismissCardIfAnchoredTo(container);
        };
        SearchPanel.onFlushScheduledCard = () => this.flushScheduledCard();
        SearchPanel.onNavigateToDockedCard = () => this.navigateToDockedCard();
        SearchPanel.onSelectionChange = (result: SearchResult | null) => {
            if (result) {
                this.scheduleDockedCard(() => {
                    const container = document.getElementById('search-panel');
                    const dockCorner = SearchPanel.getState().dockCorner;
                    if (result.type === 'marker') {
                        const m = result.originalRef;
                        this.openLocationCard({
                            markerFormId: m.formId,
                            title: m.name,
                            canFastTravel: m.canFastTravel,
                            referencePanel: container || undefined,
                            dockCorner,
                            takeFocus: false
                        });
                    } else if (result.type === 'quest') {
                        const q = result.originalRef;
                        this.showQuestDetails(q, undefined, container || undefined, dockCorner, false);
                    } else if (result.type === 'workshop') {
                        const w = result.originalRef;
                        const marker = domainState.markers.get(w.markerFormId ?? w.formId ?? w.locationFormId ?? 0);
                        const canFastTravel = marker ? marker.canFastTravel : w.owned;
                        const markerFormId = marker ? marker.formId : w.markerFormId;
                        this.openLocationCard({
                            markerFormId: markerFormId ?? 0,
                            title: w.name,
                            canFastTravel,
                            settlement: w,
                            referencePanel: container || undefined,
                            dockCorner,
                            takeFocus: false
                        });
                    } else {
                        this.dismissActiveCard();
                    }
                });
            } else {
                this.cancelScheduledCard();
                this.dismissActiveCard();
            }
        };
    }

    private navigateToDockedCard(): boolean {
        this.flushScheduledCard();
        if (this.activeCard) {
            InputRouter.push(this.activeCard.id as FocusOwner);
            SoundService.playFocus();
            return true;
        }
        return false;
    }

    public init(): void {
        const questPanelEl = document.getElementById('quest-list-panel');
        if (questPanelEl) this.registerPanel(FocusOwner.QUEST_LIST, questPanelEl, () => QuestList.collapse());

        const locPanelEl = document.getElementById('locations-list-panel');
        if (locPanelEl) this.registerPanel(FocusOwner.WORKSHOP_LIST, locPanelEl, () => LocationsList.collapse());

        const searchPanelEl = document.getElementById('search-panel');
        if (searchPanelEl) this.registerPanel(FocusOwner.SEARCH_PANEL, searchPanelEl, () => SearchPanel.collapse());

        window.addEventListener('click', (e: MouseEvent) => {
            const targetNode = e.target as Node;
            const clickedInsideCard = this.activeCard?.element?.contains(targetNode) ?? false;

            let clickedInsidePanel = false;
            for (const panel of this.expandedPanels.values()) {
                if (panel.element.contains(targetNode)) {
                    clickedInsidePanel = true;
                    break;
                }
            }

            if (!clickedInsideCard && !clickedInsidePanel) {
                this.dismissAll();
            }
        });
    }

    public setFastTravelHandler(handler: FastTravelHandler | null): void {
        this.fastTravelHandler = handler;
    }

    public requestFastTravel(formId: number, name: string): void {
        if (this.fastTravelHandler) {
            this.fastTravelHandler(formId, name);
        }
    }

    public registerPanel(id: FocusOwner, element: HTMLElement, collapse: () => void): void {
        this.expandedPanels.set(id, { id, element, collapse });
    }

    public notifyPanelExpanded(panelId: FocusOwner): void {
        this.dismissActiveCard();
        for (const panel of this.expandedPanels.values()) {
            if (panel.id !== panelId) {
                panel.collapse();
                InputRouter.remove(panel.id);
            }
        }
    }

    public scheduleDockedCard(openAction: () => void): void {
        this.pendingCardAction = openAction;
        if (this.dockedCardRafId !== null) return;

        this.dockedCardRafId = requestAnimationFrame(() => {
            this.dockedCardRafId = null;
            const action = this.pendingCardAction;
            this.pendingCardAction = null;
            if (action) {
                action();
            }
        });
    }

    public flushScheduledCard(): void {
        if (this.dockedCardRafId !== null) {
            cancelAnimationFrame(this.dockedCardRafId);
            this.dockedCardRafId = null;
        }
        if (this.pendingCardAction) {
            const action = this.pendingCardAction;
            this.pendingCardAction = null;
            action();
        }
    }

    public cancelScheduledCard(): void {
        if (this.dockedCardRafId !== null) {
            cancelAnimationFrame(this.dockedCardRafId);
            this.dockedCardRafId = null;
        }
        this.pendingCardAction = null;
    }

    private prepareCardPresentation(
        id: FocusOwner,
        referencePanel: HTMLElement | null | undefined,
        onDismiss: () => void,
        takeFocus: boolean = true
    ): void {
        this.cancelScheduledCard();
        const previousCard = this.activeCard;
        this.activeCard = null;

        if (previousCard && previousCard.id !== id) {
            previousCard.onDismiss();
        }

        for (const panel of this.expandedPanels.values()) {
            if (referencePanel !== panel.element && (!panel.element.hasAttribute('data-collapsed') || panel.element.getAttribute('data-collapsed') === 'false')) {
                panel.collapse();
            }
        }

        this.activeCard = {
            id,
            element: null,
            referencePanel: referencePanel || null,
            onDismiss
        };

        if (takeFocus && InputRouter.peek()?.id !== id) {
            if (previousCard && InputRouter.peek()?.id === previousCard.id) {
                InputRouter.replace(id);
            } else {
                InputRouter.push(id);
            }
        }
    }

    private handleCardClosed(id: FocusOwner): void {
        if (this.activeCard && this.activeCard.id === id) {
            this.activeCard = null;
            InputRouter.remove(id);
        }
    }

    private handleCardNavBack(id: FocusOwner): boolean {
        if (this.activeCard && this.activeCard.id === id && this.activeCard.referencePanel) {
            InputRouter.pop();
            return true;
        }
        return false;
    }

    public openCard(id: FocusOwner, options: OpenCardOptions): void {
        this.prepareCardPresentation(id, options.referencePanel, options.onDismiss, options.takeFocus);
        if (this.activeCard) {
            this.activeCard.element = options.cardElement;
        }
    }

    public notifyCardClosed(id: FocusOwner): void {
        this.handleCardClosed(id);
    }

    public dismissCard(id?: FocusOwner): void {
        this.cancelScheduledCard();
        if (!this.activeCard) return;
        if (id && this.activeCard.id !== id) return;

        const cardToDismiss = this.activeCard;
        this.activeCard = null;
        cardToDismiss.onDismiss();

        InputRouter.remove(cardToDismiss.id);
    }

    public dismissActiveCard(): void {
        this.dismissCard();
    }

    public dismissCardIfAnchoredTo(panelElement: HTMLElement): void {
        this.cancelScheduledCard();
        if (this.activeCard && this.activeCard.referencePanel === panelElement) {
            this.dismissCard();
        }
    }

    public dismissAll(): void {
        this.cancelScheduledCard();
        this.dismissCard();
        this.collapseAllPanels();

        const overlayFocuses: readonly string[] = [
            FocusOwner.LOCATION_CARD,
            FocusOwner.QUEST_CARD,
            FocusOwner.CUSTOM_MARKER_CARD,
            FocusOwner.QUEST_LIST,
            FocusOwner.WORKSHOP_LIST,
            FocusOwner.SEARCH_PANEL
        ];
        while (overlayFocuses.includes(InputRouter.getFocus())) {
            InputRouter.pop();
        }
    }

    public collapseAllPanels(): void {
        for (const panel of this.expandedPanels.values()) {
            panel.collapse();
        }
    }

    public getActiveCardId(): FocusOwner | null {
        return this.activeCard ? this.activeCard.id : null;
    }

    public openLocationCard(options: LocationCardOpenOptions): void {
        const takeFocus = options.takeFocus ?? true;
        this.prepareCardPresentation(FocusOwner.LOCATION_CARD, options.referencePanel, () => LocationCard.close(), takeFocus);
        LocationCard.open({ ...options, takeFocus });
        if (this.activeCard) {
            this.activeCard.element = LocationCard.getElement();
        }
    }

    public showQuestDetails(
        quest: QuestItem,
        anchor?: ScreenAnchor,
        referencePanel?: HTMLElement,
        dockCorner?: Corner,
        takeFocus: boolean = true
    ): void {
        this.prepareCardPresentation(FocusOwner.QUEST_CARD, referencePanel, () => QuestCard.close(), takeFocus);
        QuestCard.open(quest, undefined, referencePanel, dockCorner, takeFocus, anchor);
        if (this.activeCard) {
            this.activeCard.element = QuestCard.getElement();
        }
    }

    public openCustomMarkerCard(options: {
        gameCoords?: Point2D;
        pageCoords?: Point2D;
        worldspaceId?: number;
        anchor?: ScreenAnchor;
    }): void {
        this.prepareCardPresentation(FocusOwner.CUSTOM_MARKER_CARD, null, () => CustomMarkerCard.close());
        CustomMarkerCard.open({
            gameCoords: options.gameCoords,
            pageCoords: options.pageCoords,
            worldspaceId: options.worldspaceId,
            screenAnchor: options.anchor
        });
        if (this.activeCard) {
            this.activeCard.element = CustomMarkerCard.getElement();
        }
    }

    public handleMarkerSelect(payload: MarkerSelectPayload): void {
        SoundService.playFocus();
        this.collapseAllPanels();

        switch (payload.kind) {
            case MarkerKind.QUEST: {
                const matchingQuest = domainState.quests.get(payload.questFormId);
                if (matchingQuest) {
                    this.showQuestDetails(matchingQuest, payload.anchor);
                } else {
                    this.dismissActiveCard();
                }
                break;
            }
            case MarkerKind.CUSTOM: {
                this.openCustomMarkerCard({ anchor: payload.anchor });
                break;
            }
            case MarkerKind.POI: {
                const targetMarker = domainState.markers.get(payload.formId);
                const canTravel = targetMarker ? (targetMarker.canFastTravel || targetMarker.discovered) : false;

                let ownedSettlement: SettlementData | undefined;
                for (const w of domainState.settlements.values()) {
                    if (w.owned && (w.markerFormId === payload.formId || w.formId === payload.formId || w.locationFormId === payload.formId)) {
                        ownedSettlement = w;
                        break;
                    }
                }

                this.openLocationCard({
                    markerFormId: payload.formId,
                    title: ownedSettlement ? ownedSettlement.name : targetMarker?.name,
                    canFastTravel: canTravel,
                    settlement: ownedSettlement,
                    screenAnchor: payload.anchor
                });
                break;
            }
            case MarkerKind.POWER_ARMOR: {
                this.dismissActiveCard();
                break;
            }
        }
    }

    public handleEmptyMapClick(payload: EmptyMapClickPayload): void {
        this.dismissActiveCard();
        this.collapseAllPanels();

        this.openCustomMarkerCard({
            gameCoords: payload.worldCoordinates,
            pageCoords: payload.screenCoordinates,
            worldspaceId: payload.worldspaceId
        });
    }
}

export const overlayCoordinator = new OverlayCoordinator();
