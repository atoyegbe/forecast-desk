import { Link } from '@tanstack/react-router'
import { getMarketsRoute } from '../lib/routes'

export function NotFoundPage() {
  return (
    <div className="panel px-4 py-8 text-center md:px-6">
      <div className="section-kicker">404</div>
      <h1 className="display-title mt-4">
        That page drifted off the board.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[var(--color-text-secondary)]">
        The route you requested does not exist in this MVP yet.
      </p>
      <Link
        className="terminal-button terminal-button-primary mt-6 w-full text-sm font-medium sm:w-auto"
        {...getMarketsRoute()}
      >
        Return to markets
      </Link>
    </div>
  )
}
