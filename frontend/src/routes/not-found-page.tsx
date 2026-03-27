import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <div className="panel p-8 text-center">
      <div className="section-kicker">404</div>
      <h1 className="display-title mt-4 text-5xl text-stone-950">
        That page drifted off the board.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-stone-600">
        The route you requested does not exist in this MVP yet.
      </p>
      <Link
        className="dark-pill mt-6 px-5 py-3 text-sm"
        to="/"
      >
        Return home
      </Link>
    </div>
  )
}
