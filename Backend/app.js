import './src/config/env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './src/config/env.js'

const app = express()

app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

import userRouter from './src/routes/user.routes.js'
import authRouter from './src/routes/auth.routes.js'
import compilerRouter from './src/routes/compiler.routes.js'
import submissionRouter from './src/routes/submission.routes.js'
import questionRouter from './src/routes/question.routes.js'
import shopRoutes from './src/routes/shop.routes.js'
import errorMiddleware from './src/middlewares/error.middleware.js'

app.use("/api/v1/users", userRouter)
app.use('/api/v1/auth', authRouter)
app.use("/api/v1/compiler", compilerRouter);
app.use("/api/v1/submissions", submissionRouter)
app.use("/api/v1/questions", questionRouter)
app.use('/api/v1/shop', shopRoutes)
app.use(errorMiddleware)

export default app
