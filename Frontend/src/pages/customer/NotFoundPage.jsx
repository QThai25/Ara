import React from "react";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();
  return <main className="ara-not-found">
    <span><SearchX size={30}/></span>
    <small>404 · ARA COSTUME RENTAL</small>
    <h1>Không tìm thấy trang</h1>
    <p>Đường dẫn có thể đã thay đổi, hết hiệu lực hoặc được nhập chưa đúng. Dữ liệu và thao tác trước đó của bạn không bị xóa.</p>
    <div><button type="button" onClick={() => navigate(-1)}><ArrowLeft size={17}/> Quay lại</button><Link to="/"><Home size={17}/> Về trang chủ</Link></div>
  </main>;
}

