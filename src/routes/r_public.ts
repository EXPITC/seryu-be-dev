import { Router, Response, Request } from "express";

const router = Router();
// for quick test or
// align with requirement not using auth

router.get("/", (_req: Request, res: Response) =>
  res.status(200).json("Hello y'all from Seryu :3"),
);

export default router;
