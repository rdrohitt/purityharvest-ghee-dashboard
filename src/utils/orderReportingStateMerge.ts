import type { AnalyticsOrderReportingStateCount } from '../types/analytics-order-reporting';

function normalizeStateToken(raw: string): string {
	return raw.trim().replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();
}

/** `&` or `and` between words, for matching only (e.g. Jammu & Kashmir vs Jammu and Kashmir). */
function withAmpersandAsAnd(s: string): string {
	return s.replace(/\s*&\s*/g, ' and ');
}

/** Grouping key: UP / Uttar Pradesh; J&K; MH; Chhatisgarh spellings; West Bengal spellings; Uttarakhand spellings; else normalized token. */
function stateMergeBucket(raw: string): string {
	const t = normalizeStateToken(raw);
	if (t === 'up' || t === 'uttar pradesh') return 'in:uttar-pradesh';
	if (withAmpersandAsAnd(t) === 'jammu and kashmir') return 'in:jammu-kashmir';
	if (t === 'maharashtra' || t === 'maharashtri' || t === 'mumbai') return 'in:maharashtra';
	if (t === 'chhatishgarh' || t === 'chhatisgarh' || t === 'chhattisgarh') return 'in:chhatisgarh';
	if (t === 'west bengal' || t === 'west bangal') return 'in:west-bengal';
	if (t === 'uttarakhand' || t === 'uttrakhand') return 'in:uttarakhand';
	return `in:${t}`;
}

function displayStateLabel(bucket: string): string {
	if (bucket === 'in:uttar-pradesh') return 'Uttar Pradesh';
	if (bucket === 'in:jammu-kashmir') return 'Jammu & Kashmir';
	if (bucket === 'in:maharashtra') return 'Maharashtra';
	if (bucket === 'in:chhatisgarh') return 'Chhatishgarh';
	if (bucket === 'in:west-bengal') return 'West Bengal';
	if (bucket === 'in:uttarakhand') return 'Uttarakhand';
	const keyPart = bucket.startsWith('in:') ? bucket.slice(3) : bucket;
	if (!keyPart) return '—';
	return keyPart
		.split(' ')
		.map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
		.join(' ');
}

/**
 * Merges duplicate Indian state labels (e.g. UP / Uttar Pradesh → "Uttar Pradesh";
 * "Jammu & Kashmir" / "Jammu and Kashmir" → "Jammu & Kashmir";
 * Maharashtra / Maharashtri / Mumbai → "Maharashtra";
 * Chhatishgarh / Chhatisgarh / Chhattisgarh → "Chhatishgarh";
 * West Bengal / West Bangal → "West Bengal") and sums counts.
 * Other states merge on case-insensitive trimmed text.
 */
export function mergeStateCountsForDisplay(rows: AnalyticsOrderReportingStateCount[]): AnalyticsOrderReportingStateCount[] {
	const map = new Map<string, { count: number; label: string }>();
	for (const row of rows) {
		const bucket = stateMergeBucket(row.state);
		const label = displayStateLabel(bucket);
		const n = typeof row.count === 'number' ? row.count : Number(row.count);
		const add = Number.isFinite(n) ? n : 0;
		const prev = map.get(bucket);
		if (!prev) map.set(bucket, { count: add, label });
		else prev.count += add;
	}
	return Array.from(map.values()).map(({ count, label }) => ({ state: label, count }));
}
