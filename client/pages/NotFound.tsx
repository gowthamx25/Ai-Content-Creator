import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold mb-2">404</h1>
        <p className="text-base text-muted-foreground mb-6">Oops! Page not found</p>
        <a href="/" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
