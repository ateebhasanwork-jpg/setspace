import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import kpisRouter from "./kpis";
import attendanceRouter from "./attendance";
import qualityRouter from "./quality";
import messagesRouter from "./messages";
import meetingsRouter from "./meetings";
import notificationsRouter from "./notifications";
import leaderboardRouter from "./leaderboard";
import storageRouter from "./storage";
import videosRouter from "./videos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(kpisRouter);
router.use(attendanceRouter);
router.use(qualityRouter);
router.use(messagesRouter);
router.use(meetingsRouter);
router.use(notificationsRouter);
router.use(leaderboardRouter);
router.use(storageRouter);
router.use(videosRouter);

export default router;
