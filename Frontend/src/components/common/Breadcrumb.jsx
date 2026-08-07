import React from "react";
import { Link } from "react-router-dom";

export function Breadcrumb({ current, setView }) {
  return (
    <nav className="breadcrumb-bar" aria-label="Breadcrumb">
      <div>
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <strong>{current}</strong>
      </div>
    </nav>
  );
}
