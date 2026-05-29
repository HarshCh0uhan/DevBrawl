import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
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

app.use("/api/v1/users", userRouter)

export default app