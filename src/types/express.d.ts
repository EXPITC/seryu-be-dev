import "express";
import { PrismaClient } from "@prisma/client";

declare module "express" {
  interface Request {
    timeStamp?: string;
    prisma?: PrismaClient;
    // Add your custom properties here
  }
}
