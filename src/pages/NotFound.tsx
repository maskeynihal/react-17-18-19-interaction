import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="r17-page">
      <h1 className="r17-page__title">Page not found</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </div>
  );
}
