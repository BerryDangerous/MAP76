import { F4SEMapPayload } from "../types/payloads";

export const mockPayload: F4SEMapPayload = {
    bounds: {
        mapOffsetX: 0.0,
        mapOffsetY: 0.0,
        mapOffsetZ: 0.0,
        mapScale: 1.0,
        maxX: 114688.0,
        maxY: 102400.0,
        minX: -135168.0,
        minY: -147456.0,
        nwCellX: -33,
        nwCellY: 25,
        seCellX: 28,
        seCellY: -36,
        usableHeight: 0,
        usableWidth: 0
    },
    dlc04VassalDistance: 70000,
    custom_marker: {
        worldspace: 60,
        x: 10000,
        y: 10000
    },
    worldspaces: {
        60: {
            editorID: "Commonwealth",
            fullName: "Commonwealth"
        }
    },
    power_armor: {
        worldspace: 60,
        x: -47000,
        y: 670,
        z: 700
    },
    player: {
        x: -45000,
        y: 65000,
        z: 100,
        worldspace: 60,
        angle: 45,
        caps: 1420,
        currentWeight: 185,
        maxWeight: 260
    },
    markers: [
        {
            canFastTravel: true,
            discovered: false,
            formId: 469576,
            name: "Sanctuary",
            type: 12,
            visible: true,
            worldspace: 60,
            x: -80768.1875,
            y: 88174.8046875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 151486,
            name: "Red Rocket Truck Stop",
            type: 27,
            visible: true,
            worldspace: 60,
            x: -69379.0,
            y: 80148.046875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 532792,
            name: "Concord",
            type: 10,
            visible: true,
            worldspace: 60,
            x: -60286.01171875,
            y: 72977.7890625
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 651890,
            name: "Vault 111",
            type: 15,
            visible: true,
            worldspace: 60,
            x: -89271.984375,
            y: 91369.3046875
        },
        {
            canFastTravel: false,
            discovered: false,
            formId: 117461,
            name: "Diamond City",
            type: 2,
            visible: true,
            worldspace: 60,
            x: -17464.94140625,
            y: -29950.375
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 140840,
            name: "Goodneighbor",
            type: 29,
            visible: true,
            worldspace: 60,
            x: 20826.119140625,
            y: -11904.7138671875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 151445,
            name: "Starlight Drive In",
            type: 23,
            visible: true,
            worldspace: 60,
            x: -39208.84765625,
            y: 57600.890625
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 151452,
            name: "Lexington",
            type: 1,
            visible: true,
            worldspace: 60,
            x: -33029.6953125,
            y: 41006.21875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 149850,
            name: "Outpost Zimonja",
            type: 42,
            visible: true,
            worldspace: 60,
            x: -10606.697265625,
            y: 100158.2421875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 635313,
            name: "Tenpines Bluff",
            type: 26,
            visible: true,
            worldspace: 60,
            x: -22154.76953125,
            y: 89056.078125
        },
        {
            canFastTravel: false,
            discovered: false,
            formId: 100707766,
            name: "Nuka-World Transit Center",
            type: 73,
            visible: true,
            worldspace: 60,
            x: -111604.2578125,
            y: 20804.873046875
        },
        {
            canFastTravel: true,
            discovered: false,
            formId: 50345206,
            name: "Nakano Residence",
            type: 13,
            visible: true,
            worldspace: 60,
            x: 80812.84375,
            y: 122126.3671875
        }
    ],
    settlements: [
        {
            beds: 0.0,
            defense: 0.0,
            food: 0.0,
            formId: 151806,
            happiness: 2,
            linkedLocationFormIds: [151467],
            locationFormId: 127528,
            markerFormId: 469576,
            iconType: 12,
            name: "Sanctuary Hills",
            owned: true,
            population: 10,
            power: 100.0,
            raider: false,
            vassal: false,
            vr: false,
            water: 0.0,
            worldspace: 60,
            },
        {
            beds: 0.0,
            defense: 0.0,
            food: 0.0,
            formId: 347054,
            happiness: 50,
            linkedLocationFormIds: [127528],
            locationFormId: 151467,
            markerFormId: 151486,
            iconType: 27,
            name: "Red Rocket Truck Stop",
            owned: true,
            population: 0,
            power: 0.0,
            raider: false,
            vassal: false,
            vr: false,
            water: 0.0,
            worldspace: 60,
            },
        {
            beds: 0.0,
            defense: 0.0,
            food: 0.0,
            formId: 119010,
            happiness: 50,
            linkedLocationFormIds: [],
            locationFormId: 151446,
            markerFormId: 151445,
            iconType: 23,
            name: "Starlight Drive-In",
            owned: false,
            population: 0,
            power: 0.0,
            raider: false,
            vassal: false,
            vr: false,
            water: 0.0,
            worldspace: 60,
            },
        {
            beds: 2.0,
            defense: 0.0,
            food: 0.0,
            formId: 150054,
            happiness: 38,
            linkedLocationFormIds: [],
            locationFormId: 349186,
            markerFormId: 149850,
            iconType: 42,
            name: "Outpost Zimonja",
            owned: true,
            population: 3,
            power: 3.0,
            raider: true,
            vassal: false,
            vr: false,
            water: 3.0,
            worldspace: 60,
            },
        {
            beds: 3.0,
            defense: 0.0,
            food: 8.0,
            formId: 635308,
            happiness: 38,
            linkedLocationFormIds: [],
            locationFormId: 635316,
            markerFormId: 635313,
            iconType: 26,
            name: "Tenpines Bluff",
            owned: false,
            population: 2,
            power: 0.0,
            raider: false,
            vassal: true,
            vr: false,
            water: 3.0,
            worldspace: 60,
            }
    ],
    quests: [
        {
            questName: "Out of Time",
            type: "Main",
            journal: "I've reached Concord, the closest neighborhood next to my old home. Maybe there are other survivors here?",
            isMisc: false,
            isTracked: true,
            formId:117802,
            objectives: [
                {
                    index: 0,
                    state: 2,
                    targets: [],
                    text: "Exit Vault 111"
                },
                {
                    index: 1,
                    state: 3,
                    targets: [],
                    text: "Talk to Codsworth"
                },
                {
                    index: 2,
                    state: 3,
                    targets: [],
                    text: "Search the Neighborhood with Codsworth"
                },
                {
                    index: 3,
                    state: 1,
                    targets: [
                        {
                            x: -57011,
                            y: 70392,
                            z: 0,
                            isDoor: false,
                            worldspace: 60,
                        }
                    ],
                    text: "Investigate Concord"
                }
            ]
        },
        {
            questName: "All Aboard",
            type: "Side",
            journal: "I tuned into an old Nuka-Cola family radio station on my Pip-Boy. It was looping a jingle and advertisement for a place called Nuka-World. The broadcast mentioned a Nuka-World Transit Center with transportation to take me there. I should find it and see if I can still reach the amusement park.",
            isMisc: false,
            isTracked: false,
            formId:100665344,
            objectives: [
                {
                    index: 0,
                    state: 0,
                    targets: [],
                    text: "Listen to the Nuka-Cola Family Radio"
                },
                {
                    index: 1,
                    state: 1,
                    targets: [
                        {
                            x: -111604,
                            y: 20804,
                            z: 0,
                            isDoor: false,
                            worldspace: 60,
                        }
                    ],
                    text: "Travel to the Nuka-World Transit Center"
                },
                {
                    index: 2,
                    state: 0,
                    targets: [],
                    text: "Speak to Harvey"
                },
                {
                    index: 3,
                    state: 0,
                    targets: [],
                    text: "Take the Nuka-Express to Nuka-World"
                }
            ]
        },
        {
            questName: "Talk to MacCready",
            type: "Misc",
            journal: "",
            isMisc: true,
            isTracked: false,
            formId:1138867,
            objectives: [
                {
                    index: 0,
                    state: 1,
                    targets: [
                        {
                            x: 20826,
                            y: -11904,
                            z: 0,
                            isDoor: true,
                            worldspace: 60,
                        }
                    ],
                    text: "Talk to MacCready"
                }
            ]
        }
    ]
};
