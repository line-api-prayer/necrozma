import { betterAuth } from 'better-auth';
import { Pool } from "pg";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: new Pool({
        connectionString: process.env.POSTGRES_URL,
    }),
    emailAndPassword: {
        enabled: true,
    }
})