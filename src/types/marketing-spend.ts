/**
 * Single marketing spend record as returned by the backend API.
 *
 * Example:
 * {
 *   "_id": "69af15982f2e966d92ac245d",
 *   "platform": "meta1",
 *   "date": "2026-03-01T00:00:00.000Z",
 *   "note": "test",
 *   "amount": 1000,
 *   "createdAt": "2026-03-09T18:46:48.908Z",
 *   "updatedAt": "2026-03-09T18:46:48.908Z",
 *   "__v": 0
 * }
 */
export interface MarketingSpendUserRef {
  _id: string;
  name: string;
}

export interface MarketingSpendApiItem {
  _id: string;
  platform: string;
  date: string;
  note?: string;
  amount: number;
  createdBy?: MarketingSpendUserRef;
  updatedBy?: MarketingSpendUserRef;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

