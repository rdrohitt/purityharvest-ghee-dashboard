export type Caller = {
    id: string;
    name: string;
    phone: string;
    totalRevenue: number;
    lastCallDate: string; // ISO date
};

function rand(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const callerNames = [
    'Monia Sharma', 'Sarita Verma', 'Priya Patel', 'Anita Singh', 'Neha Gupta',
    'Kavita Mehta', 'Sunita Rao', 'Rekha Nair', 'Meera Joshi', 'Divya Kapoor'
];

export function generateMockCallers(limit = 30): Caller[] {
    const callers: Caller[] = [];
    const now = new Date();
    
    for (let i = 0; i < limit; i++) {
        const seed = i + 1;
        const name = callerNames[Math.floor(rand(seed) * callerNames.length)];
        const phone = `9${String(Math.floor(rand(seed + 1) * 1000000000)).padStart(9, '0')}`;
        
        // Generate random revenue (between 10,000 and 500,000)
        const totalRevenue = Math.round(10000 + rand(seed + 2) * 490000);
        
        // Generate last call date (within last 60 days)
        const daysAgo = Math.floor(rand(seed + 3) * 60);
        const lastCallDate = new Date(now);
        lastCallDate.setDate(now.getDate() - daysAgo);
        
        callers.push({
            id: `CALLER-${1000 + i}`,
            name,
            phone,
            totalRevenue,
            lastCallDate: lastCallDate.toISOString(),
        });
    }
    
    return callers.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

