import React from "react";
import { paths, views } from "../../routes/views.js";

export function Breadcrumb({ current, setView }) {
  return (
    <div className="breadcrumb-bar">
      <div>
        <button onClick={() => setView(views.home, paths.home)}>Trang chủ</button>
        <span>/</span>
        <strong>{current}</strong>
      </div>
    </div>
  );
}
