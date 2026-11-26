import { Router } from 'express'
import { login, refresh, logout, me } from '../controllers/auth.controller.js'
import { userAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', userAuth, me)

export default router
