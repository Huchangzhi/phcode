import { createApp } from './app.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000
const app = createApp()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PH Code server v3 running on http://0.0.0.0:${PORT}`)
})
