export type MetricKey = 'sales' | 'rto' | 'delivered' | 'inTransit';
export type RangeKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export type DateRange = { start: Date; end: Date };

export function getPresetRange(key: Exclude<RangeKey, 'custom'>, now = new Date()): DateRange {
	const end = new Date(now);
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	end.setHours(23, 59, 59, 999);
	if (key === 'yesterday') {
		start.setDate(start.getDate() - 1);
		end.setDate(end.getDate() - 1);
		return { start, end };
	}
	if (key === 'last7') {
		const s = new Date(end);
		s.setDate(s.getDate() - 6);
		s.setHours(0, 0, 0, 0);
		return { start: s, end };
	}
	if (key === 'last30') {
		const s = new Date(end);
		s.setDate(s.getDate() - 29);
		s.setHours(0, 0, 0, 0);
		return { start: s, end };
	}
	return { start, end };
}

export type MetricPoint = {
	date: string;
	salesAmount: number; salesCount: number;
	rtoAmount: number; rtoCount: number;
	deliveredAmount: number; deliveredCount: number;
	inTransitAmount: number; inTransitCount: number;
	waLeadsCount: number; waSalesAmount: number; waSalesCount: number;
	abandonedCount: number; abandonedAmount: number;
	shopifySalesAmount: number; shopifySalesCount: number;
	repeatSalesAmount: number; repeatSalesCount: number;
	amazonSalesAmount: number; amazonSalesCount: number;
	flipkartSalesAmount: number; flipkartSalesCount: number;
	productSales: {
		'Ghee': { count: number; amount: number };
		'Honey': { count: number; amount: number };
		'Grocery': { count: number; amount: number };
		'Oils': { count: number; amount: number };
		'Vermicompost': { count: number; amount: number };
	};
};

// Mock generator: deterministic based on date string
export function generateMockData(range: DateRange): MetricPoint[] {
	const points: MetricPoint[] = [];
	const cursor = new Date(range.start);
    while (cursor <= range.end) {
		const seed = Number(cursor.getFullYear().toString() + (cursor.getMonth()+1).toString().padStart(2,'0') + cursor.getDate().toString().padStart(2,'0'));
		const rnd = (n: number) => (Math.sin(seed + n) + 1) / 2; // 0..1
		const salesCount = Math.round(20 + rnd(1) * 80);
		const deliveredCount = Math.round(salesCount * (0.75 + rnd(2) * 0.2));
		const rtoCount = Math.max(0, salesCount - deliveredCount - Math.round(rnd(3) * 10));
		const inTransitCount = Math.max(0, salesCount - deliveredCount - rtoCount);
		const avg = 499 + Math.round(rnd(4) * 1500);
        const waLeadsCount = Math.round(80 + rnd(5) * 220);
        const waSalesCount = Math.min(salesCount, Math.round(waLeadsCount * (0.15 + rnd(6) * 0.15)));
        const abandonedCount = Math.round(waLeadsCount * (0.3 + rnd(7) * 0.2));
        const shopifySalesCount = Math.round(salesCount * (0.6 + rnd(8) * 0.2));
        const repeatSalesCount = Math.round(deliveredCount * (0.25 + rnd(9) * 0.2));
        const amazonSalesCount = Math.round(salesCount * (0.15 + rnd(10) * 0.1));
        const flipkartSalesCount = Math.round(salesCount * (0.12 + rnd(11) * 0.08));
        
        // Product-wise distribution
        const productGhee = Math.round(salesCount * (0.35 + rnd(12) * 0.15));
        const productHoney = Math.round(salesCount * (0.20 + rnd(13) * 0.12));
        const productGrocery = Math.round(salesCount * (0.18 + rnd(14) * 0.10));
        const productOils = Math.round(salesCount * (0.15 + rnd(15) * 0.08));
        const productVermicompost = Math.max(0, salesCount - productGhee - productHoney - productGrocery - productOils);
        
        const priceGhee = 599 + Math.round(rnd(16) * 400);
        const priceHoney = 349 + Math.round(rnd(17) * 200);
        const priceGrocery = 199 + Math.round(rnd(18) * 300);
        const priceOils = 299 + Math.round(rnd(19) * 250);
        const priceVermicompost = 149 + Math.round(rnd(20) * 150);

        points.push({
			date: cursor.toISOString().slice(0, 10),
			salesAmount: salesCount * avg,
			salesCount,
			rtoAmount: rtoCount * Math.round(avg * 0.9),
			rtoCount,
			deliveredAmount: deliveredCount * avg,
			deliveredCount,
			inTransitAmount: inTransitCount * avg,
            inTransitCount,
            waLeadsCount,
            waSalesCount,
            waSalesAmount: waSalesCount * avg,
            abandonedCount,
            abandonedAmount: abandonedCount * Math.round(avg * 0.8),
            shopifySalesCount,
            shopifySalesAmount: shopifySalesCount * avg,
            repeatSalesCount,
            repeatSalesAmount: repeatSalesCount * avg,
            amazonSalesCount,
            amazonSalesAmount: amazonSalesCount * avg,
            flipkartSalesCount,
            flipkartSalesAmount: flipkartSalesCount * avg,
            productSales: {
                'Ghee': { count: productGhee, amount: productGhee * priceGhee },
                'Honey': { count: productHoney, amount: productHoney * priceHoney },
                'Grocery': { count: productGrocery, amount: productGrocery * priceGrocery },
                'Oils': { count: productOils, amount: productOils * priceOils },
                'Vermicompost': { count: productVermicompost, amount: productVermicompost * priceVermicompost },
            },
		});
		cursor.setDate(cursor.getDate() + 1);
		cursor.setHours(0, 0, 0, 0);
	}
	return points;
}

export function sum(points: MetricPoint[]) {
	return points.reduce(
		(acc, p) => ({
			salesAmount: acc.salesAmount + p.salesAmount,
			salesCount: acc.salesCount + p.salesCount,
			rtoAmount: acc.rtoAmount + p.rtoAmount,
			rtoCount: acc.rtoCount + p.rtoCount,
			deliveredAmount: acc.deliveredAmount + p.deliveredAmount,
			deliveredCount: acc.deliveredCount + p.deliveredCount,
			inTransitAmount: acc.inTransitAmount + p.inTransitAmount,
            inTransitCount: acc.inTransitCount + p.inTransitCount,
            waLeadsCount: acc.waLeadsCount + p.waLeadsCount,
            waSalesAmount: acc.waSalesAmount + p.waSalesAmount,
            waSalesCount: acc.waSalesCount + p.waSalesCount,
            abandonedCount: acc.abandonedCount + p.abandonedCount,
            abandonedAmount: acc.abandonedAmount + p.abandonedAmount,
            shopifySalesAmount: acc.shopifySalesAmount + p.shopifySalesAmount,
            shopifySalesCount: acc.shopifySalesCount + p.shopifySalesCount,
            repeatSalesAmount: acc.repeatSalesAmount + p.repeatSalesAmount,
            repeatSalesCount: acc.repeatSalesCount + p.repeatSalesCount,
            amazonSalesAmount: acc.amazonSalesAmount + p.amazonSalesAmount,
            amazonSalesCount: acc.amazonSalesCount + p.amazonSalesCount,
            flipkartSalesAmount: acc.flipkartSalesAmount + p.flipkartSalesAmount,
            flipkartSalesCount: acc.flipkartSalesCount + p.flipkartSalesCount,
            productSales: {
                'Ghee': {
                    count: acc.productSales['Ghee'].count + p.productSales['Ghee'].count,
                    amount: acc.productSales['Ghee'].amount + p.productSales['Ghee'].amount,
                },
                'Honey': {
                    count: acc.productSales['Honey'].count + p.productSales['Honey'].count,
                    amount: acc.productSales['Honey'].amount + p.productSales['Honey'].amount,
                },
                'Grocery': {
                    count: acc.productSales['Grocery'].count + p.productSales['Grocery'].count,
                    amount: acc.productSales['Grocery'].amount + p.productSales['Grocery'].amount,
                },
                'Oils': {
                    count: acc.productSales['Oils'].count + p.productSales['Oils'].count,
                    amount: acc.productSales['Oils'].amount + p.productSales['Oils'].amount,
                },
                'Vermicompost': {
                    count: acc.productSales['Vermicompost'].count + p.productSales['Vermicompost'].count,
                    amount: acc.productSales['Vermicompost'].amount + p.productSales['Vermicompost'].amount,
                },
            },
		}),
        { 
            salesAmount: 0, salesCount: 0, rtoAmount: 0, rtoCount: 0, deliveredAmount: 0, deliveredCount: 0, 
            inTransitAmount: 0, inTransitCount: 0, waLeadsCount: 0, waSalesAmount: 0, waSalesCount: 0, 
            abandonedCount: 0, abandonedAmount: 0, shopifySalesAmount: 0, shopifySalesCount: 0, 
            repeatSalesAmount: 0, repeatSalesCount: 0, amazonSalesAmount: 0, amazonSalesCount: 0, 
            flipkartSalesAmount: 0, flipkartSalesCount: 0,
            productSales: {
                'Ghee': { count: 0, amount: 0 },
                'Honey': { count: 0, amount: 0 },
                'Grocery': { count: 0, amount: 0 },
                'Oils': { count: 0, amount: 0 },
                'Vermicompost': { count: 0, amount: 0 },
            }
        }
	);
}

export function getMonthRange(monthsAgo: number, now = new Date()): DateRange {
    const ref = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

export function monthLabel(monthsAgo: number, now = new Date()): string {
    const ref = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return ref.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}


