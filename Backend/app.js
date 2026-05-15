import express from 'express'

const  app = express()

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running'
  });
});

export default app