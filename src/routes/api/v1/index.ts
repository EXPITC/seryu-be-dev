import { Router } from "express";
import r_salary from "./r_salary";

const r_api_v1 = Router();

// api v1
r_api_v1.use("/salary", r_salary);

// help standarize import naming
export default r_api_v1;
