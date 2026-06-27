import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware } from '../middlewares/authMiddleware';
import { registerSchema, loginSchema, forgotPasswordSchema } from '../validators/auth.validators';

const router = Router();
const { authController } = buildContainer();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);

export { router as authRoutes };
