import { HandleGetSalaryDriverList } from "controllers/api/v1/salary/c_list";
import { Router } from "express";

const router = Router();
// for quick test or
// align with requirement not using auth

// LIST
router.post("/driver/list", HandleGetSalaryDriverList);

// CRUD-O

export default router;
