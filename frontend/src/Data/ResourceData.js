const ResourceData = [
    {
        category: 'Medical Resources',
        items: [
            { id: 'ambulances',    name: 'Ambulances',    icon: '🚑', available: 5, total: 5 },
            { id: 'doctors',       name: 'Doctors',       icon: '👨‍⚕️', available: 10, total: 10 },
            { id: 'nurses',        name: 'Nurses',        icon: '👩‍⚕️', available: 20, total: 20 },
            { id: 'medicalKits',   name: 'Medical Kits',  icon: '💼', available: 30, total: 30 },
            { id: 'generators',    name: 'Generators',    icon: '⚡️', available: 8, total: 8 }
        ]
    },
    {
        category: 'Logistics & Support',
        items: [
            { id: 'rescueBoats',   name: 'Rescue Boats',  icon: '🛥️', available: 6, total: 6 },
            { id: 'fuelReserves',  name: 'Fuel Reserves', icon: '⛽️', available: 50, total: 50 },
            { id: 'commRadios',    name: 'Comm Radios',   icon: '📻', available: 15, total: 15 },
            { id: 'waterUnits',    name: 'Water Units',   icon: '💧', available: 10, total: 10 },
            { id: 'shelterTents',  name: 'Shelter Tents', icon: '⛺️', available: 12, total: 12 }
        ]
    }
];

export default ResourceData;