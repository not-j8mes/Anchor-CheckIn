import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import formsRouter from "./forms";
import questionsRouter from "./questions";
import registrationsRouter from "./registrations";
import childrenRouter from "./children";
import checkinsRouter from "./checkins";
import statsRouter from "./stats";
import eventsRouter from "./events";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(organizationsRouter);
router.use(eventsRouter);
router.use(formsRouter);
router.use(questionsRouter);
router.use(registrationsRouter);
router.use(childrenRouter);
router.use(checkinsRouter);
router.use(statsRouter);
router.use(adminRouter);

export default router;
