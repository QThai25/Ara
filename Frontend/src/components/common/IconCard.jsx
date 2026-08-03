import React from "react";
import { Link } from "react-router-dom";

export function IconCard({ icon: Icon, label, description, to, active = false, ariaLabel, onClick }) {
  const className = [
    description ? "benefit-card" : "icon-card",
    to ? "is-interactive" : "is-static",
    active ? "active" : ""
  ].filter(Boolean).join(" ");
  const content = (
    <>
      <Icon size={description ? 34 : 30} strokeWidth={1.35} />
      <div>
        <strong>{label}</strong>
        {description && <p>{description}</p>}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        className={className}
        to={to}
        onClick={onClick}
        aria-label={ariaLabel || label}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
