# DocVault LaTeX Report

Thư mục này chứa bản nháp báo cáo LaTeX cho đề tài:

> Triển khai hệ thống quản lý tài liệu bảo mật DocVault theo quy trình DevSecOps

## Build

Khuyến nghị dùng XeLaTeX hoặc LuaLaTeX để xử lý tiếng Việt ổn định.

```powershell
cd report
latexmk -xelatex main.tex
```

Nếu không có `latexmk`, có thể chạy thủ công:

```powershell
xelatex main.tex
biber main
xelatex main.tex
xelatex main.tex
```

Lưu ý khi dùng MiKTeX trên Windows: không nên trộn build trực tiếp với lệnh
`xelatex -output-directory=build main.tex`, vì TeX có thể đọc `main.aux` cũ ở
thư mục gốc trong khi ghi file mới vào `build/`, làm `\ref` báo undefined dù
label đã có trong `build/main.aux`. Nếu gặp lỗi này, build lại đồng nhất từ
thư mục `report` bằng chuỗi lệnh ở trên.

## Ghi chú

- Ảnh web/evidence được nhúng trực tiếp từ `../docs/images/web` và `../docs/evidence/screenshots`.
- Thông tin sinh viên, giảng viên, khoa/trường và quy định trình bày cần thay theo mẫu chính thức của trường.
- Các chương đã có nội dung nháp theo phong cách khóa luận, nhưng cần bổ sung screenshot pipeline thật mới nhất trước khi nộp.
