import { Link } from '@tanstack/react-router'
import { getMarketsRoute } from '../lib/routes'

export function NotFoundPage() {
  return (
    <div className="panel p-8 text-center">
      <div className="section-kicker">404</div>
      <h1 className="display-title mt-4">
        That page drifted off the board.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[var(--color-text-secondary)]">
        The route you requested does not exist in this MVP yet.
      </p>
      <Link
        className="terminal-button terminal-button-primary mt-6 text-sm font-medium"
        {...getMarketsRoute()}
      >
        Return to markets
      </Link>
    </div>
  )
}
