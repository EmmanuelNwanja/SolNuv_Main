declare namespace Express {
  interface Request {
    user?: {
      id?: string;
      email?: string;
      role?: string;
      company_id?: string;
      [key: string]: unknown;
    };
    company?: {
      id?: string;
      name?: string;
      subscription_plan?: string;
      [key: string]: unknown;
    };
    isNewUser?: boolean;
  }
}
