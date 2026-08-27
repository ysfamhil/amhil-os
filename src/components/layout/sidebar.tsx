import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
      <div className="mb-8 px-2">
        <p className="text-lg font-semibold tracking-tight">AMHIL OS</p>
        <p className="text-xs text-muted">Personal command center</p>
      </div>
      <NavLinks />
      <div className="mt-auto border-t border-border pt-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
