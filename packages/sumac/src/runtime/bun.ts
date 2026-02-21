import type { Sumac } from '../sumac';

export const bunHandler = (app: Sumac<any>) => (req: Request) => app.fetch(req);
