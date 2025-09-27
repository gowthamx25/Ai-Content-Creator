import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="group inline-flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">AI</span> Course Creator
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to={onHome ? "/create" : "/create"}>Create</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
