import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import leadsRouter from "./leads";
import prototypesRouter from "./prototypes";
import anthropicRouter from "./anthropic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(leadsRouter);
router.use(prototypesRouter);
router.use(anthropicRouter);

export default router;
