import { getDatabase } from "./database";
import { LocalDB } from "../database/localDb";

export interface ProductProfit {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
}

export async function getProductProfits(
  startDate?: string,
  endDate?: string
): Promise<ProductProfit[]> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) return [];

  let query = `
    SELECT
      si.product_id,
      MAX(si.product_name) as product_name,
      SUM(si.quantity) as units_sold,
      SUM(si.total_price) as revenue,
      COALESCE(SUM(si.unit_cost * si.quantity), 0) as total_cost
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.user_id = ? AND s.is_deleted = 0 AND si.is_deleted = 0
  `;
  const params: any[] = [userId];

  if (startDate) {
    query += ` AND s.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND s.created_at <= ?`;
    params.push(endDate);
  }

  query += ` GROUP BY si.product_id ORDER BY revenue DESC`;

  const rows = await db.getAllAsync<any>(query, ...params);

  return rows.map((row: any) => ({
    product_id: row.product_id,
    product_name: row.product_name,
    units_sold: row.units_sold,
    revenue: row.revenue,
    total_cost: row.total_cost,
    gross_profit: row.revenue - row.total_cost,
    profit_margin: row.revenue > 0 ? ((row.revenue - row.total_cost) / row.revenue) * 100 : 0,
  }));
}

export async function getTopProductsByProfit(
  limit: number = 5,
  startDate?: string,
  endDate?: string
): Promise<ProductProfit[]> {
  const products = await getProductProfits(startDate, endDate);
  return products
    .sort((a, b) => b.gross_profit - a.gross_profit)
    .slice(0, limit);
}

export async function getProductProfitSummary(
  startDate?: string,
  endDate?: string
): Promise<{ totalGrossProfit: number; totalRevenue: number; totalCost: number; averageMargin: number; productCount: number }> {
  const products = await getProductProfits(startDate, endDate);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalCost = products.reduce((s, p) => s + p.total_cost, 0);
  return {
    totalGrossProfit: totalRevenue - totalCost,
    totalRevenue,
    totalCost,
    averageMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
    productCount: products.length,
  };
}
