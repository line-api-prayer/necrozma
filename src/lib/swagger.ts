import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Necrozma API",
      version: "1.0.0",
      description: "API documentation for Necrozma project",
    },
    servers: [
      {
        url: process.env.APP_URL ?? "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  // Path to the API docs
  apis: ["./src/app/api/**/*.ts"],
};

export const spec = swaggerJsdoc(options);
