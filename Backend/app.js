import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

import userRouter from './src/routes/user.routes.js'
import compilerRouter from './src/routes/compiler.routes.js'
import submissionRouter from './src/routes/submission.routes.js'
import questionRouter from './src/routes/question.routes.js'
import errorMiddleware from './src/middlewears/error.middlewear.js'

app.use("/api/v1/users", userRouter)
app.use("/api/v1/compiler", compilerRouter);
app.use("/api/v1/submissions", submissionRouter)
app.use("/api/v1/questions", questionRouter)
app.use(errorMiddleware)

export default app