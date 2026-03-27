import 'dotenv/config'
import { createApp } from './app/create-app.js'

const DEFAULT_PORT = 8787

async function start() {
  const app = await createApp()
  const port = Number(process.env.PORT ?? DEFAULT_PORT)

  try {
    await app.listen({
      host: '0.0.0.0',
      port,
    })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
