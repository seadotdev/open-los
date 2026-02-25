"use client";

export function Nav({ active }: { active?: string }) {
  const links = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/terminal", label: "Terminal" },
    { href: "/playground", label: "Playground" },
    { href: "/docs", label: "API Docs" },
  ];

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        background: "var(--bg-primary)",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>
            Open LOS
          </span>
        </a>
      </div>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              fontSize: "14px",
              color: active === link.label ? "var(--accent)" : "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {link.label}
          </a>
        ))}
        <a
          href="https://github.com/seadotdev/open-los"
          target="_blank"
          style={{ fontSize: "14px", color: "var(--text-secondary)", textDecoration: "none" }}
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}
