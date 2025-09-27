import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate, useLocation } from "react-router-dom";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const e = params.get("email");
    if (e) setEmail(e);
  }, [location.search]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/create");
    }, 600);
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)] bg-background">
      <div className="brand-gradient absolute inset-0" aria-hidden="true" />
      <section className="container relative grid place-items-center py-12 sm:py-24">
        <div className="w-full max-w-md rounded-2xl glass p-8">
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Welcome back. Build courses faster than ever.
          </p>
          <form onSubmit={onSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 rounded-lg bg-secondary/70 placeholder:text-muted-foreground focus-visible:ring-primary"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-lg bg-secondary/70 placeholder:text-muted-foreground focus-visible:ring-primary"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
                Need help?
              </a>
            </div>
            <Button
              type="submit"
              className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!email || !password || loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            AI Course Creator — Fast • Flexible • Multi‑language • Clear
          </p>
        </div>
      </section>
    </main>
  );
}
