import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware } from '../middlewares/authMiddleware';
import { registerSchema, loginSchema } from '../validators/auth.validators';

const router = Router();
const { authController } = buildContainer();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);

export { router as authRoutes };
