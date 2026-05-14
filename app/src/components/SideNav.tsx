import "./SideNav.css";

export type RouteId = "original" | "absorb" | "mass" | "baton" | "inline" | "inline-saved" | "chat";

interface NavItem {
  id: RouteId;
  label: string;
  hint: string;
}

const ITEMS: NavItem[] = [
  { id: "chat", label: "Chat", hint: "real conversation" },
  // { id: "original", label: "Original", hint: "current build" },
  // { id: "absorb", label: "A — Absorb", hint: "button into bubble" },
  // { id: "mass", label: "B — Heavy bubble", hint: "differentiated mass" },
  // { id: "baton", label: "C — Baton pass", hint: "fluid hand-off" },
  { id: "inline-saved", label: "D — Inline (ref)", hint: "saved baseline" },
  { id: "inline", label: "D — Inline (wip)", hint: "active experiment" },
];

interface SideNavProps {
  active: RouteId;
  onSelect: (id: RouteId) => void;
}

export function SideNav({ active, onSelect }: SideNavProps) {
  return (
    <aside className="sideNav">
      <div className="sideNavBrand">Quick beacon</div>
      <nav>
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sideNavItem ${active === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="sideNavLabel">{item.label}</span>
            <span className="sideNavHint">{item.hint}</span>
          </button>
        ))}
      </nav>
      <p className="sideNavFoot">
        Each proposal changes only the responding → resting transition. Everything else
        is identical so you can compare them on the same playground.
      </p>
    </aside>
  );
}
