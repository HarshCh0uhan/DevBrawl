import { Router } from 'express'
import { login, refresh, logout, me } from '../controllers/auth.controller.js'
import { registerUser } from '../controllers/user.controller.js'
import { upload } from '../middlewares/multer.middleware.js'
import { userAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/register', upload.single('avatar'), registerUser)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', userAuth, me)

export default router
