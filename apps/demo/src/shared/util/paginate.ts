export const paginate = <T>(items: T[], page: number, limit: number) => ({
  data: items.slice((page - 1) * limit, page * limit),
  total: items.length,
  page,
  limit
});
