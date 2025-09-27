import { User } from "lucide-react";

export default function Profile({ name = "Trainer" }: { name?: string }) {
  return (
    <div className="absolute left-6 top-6 flex items-center gap-3 rounded-full bg-card/70 px-3 py-1.5 shadow-md">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <User className="h-4 w-4" />
      </div>
      <div className="hidden flex-col sm:flex">
        <span className="text-sm font-semibold">{name}</span>
      </div>
    </div>
  );
}
