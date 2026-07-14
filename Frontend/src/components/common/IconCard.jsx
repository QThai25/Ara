import React from "react";
import { Link } from "react-router-dom";

export function IconCard({ icon: Icon, label, description, to, active = false, ariaLabel }) {
  const className = `${description ? "benefit-card" : "icon-card"}${active ? " active" : ""}`;
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
      <Link className={className} to={to} aria-label={ariaLabel || label}>
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
