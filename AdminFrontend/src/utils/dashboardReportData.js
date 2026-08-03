function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapDashboardAnalytics(trendRows = [], orderRows = []) {
  const ordersByPeriod = new Map(orderRows.map((row) => [row.period, row]));

  return {
    revenue: trendRows.map((row) => ({
      label: row.period,
      netRevenue: toNumber(row.netRevenue),
      successfulPayments: toNumber(row.successfulPayments ?? row.grossRevenue),
      refundedAmount: toNumber(row.refundedAmount),
      depositRevenue: toNumber(row.depositRevenue),
      rentalRevenue: toNumber(row.rentalRevenue),
      penaltyRevenue: toNumber(row.penaltyRevenue)
    })),
    orders: trendRows.map((row) => {
      const events = ordersByPeriod.get(row.period) || {};
      return {
        label: row.period,
        createdOrders: toNumber(events.created),
        pickedUpOrders: toNumber(events.pickedUp),
        returnedOrders: toNumber(events.returned),
        completedOrders: toNumber(events.completed)
      };
    })
  };
}

export function getRevenueFlow(summary = {}) {
  const reportedSuccessfulPayments = toNumber(summary.successfulPayments);
  const reportedGrossRevenue = toNumber(summary.grossRevenue);
  const categorizedPayments = toNumber(summary.depositRevenue)
    + toNumber(summary.rentalRevenue)
    + toNumber(summary.penaltyRevenue);
  const collectedAmount = reportedSuccessfulPayments > 0
    ? reportedSuccessfulPayments
    : reportedGrossRevenue > 0
      ? reportedGrossRevenue
      : categorizedPayments;

  return {
    collectedAmount,
    refundedAmount: toNumber(summary.refundedAmount),
    netRevenue: toNumber(summary.netRevenue)
  };
}
