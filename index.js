const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const pool = require('./database');
const cloudinary = require('cloudinary').v2;

// Nạp các biến môi trường từ file .env. Đảm bảo dòng này chạy sớm nhất có thể.
require('dotenv').config(); 

// --- KHỞI TẠO ỨNG DỤNG ---
const app = express();
const port = 5000;

// --- CẤU HÌNH MIDDLEWARE ---

// 1. CORS
const allowedOrigins = [
  'https://hrm.info.aipencil.name.vn',
  'http://localhost:3000'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Bỏ app.use('/uploads', ...) vì không dùng file tĩnh nữa

// 2. Cấu hình Cloudinary
// THÊM CÁC DÒNG LOG NÀY ĐỂ DEBUG CHẮC CHẮN BIẾN ĐƯỢC LOAD
console.log('--- CLOUDINARY CONFIG DEBUG ---');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '*****' : 'UNDEFINED/EMPTY'); 
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '*****' : 'UNDEFINED/EMPTY'); 
console.log('------------------------------');

// Kiểm tra và xử lý nếu biến môi trường bị thiếu
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Lỗi: Thiếu một hoặc nhiều biến môi trường Cloudinary. Vui lòng kiểm tra file .env');
  // Bạn có thể chọn dừng ứng dụng hoặc xử lý lỗi khác ở đây
  // process.exit(1); 
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm helper để upload file lên Cloudinary từ buffer
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    // Thêm kiểm tra cấu hình Cloudinary trước khi upload
    if (!cloudinary.config().api_key) {
      return reject(new Error('Cloudinary API key is not configured.'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' }, // Tự động nhận diện loại file
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};


// 3. Cấu hình Multer để lưu file vào bộ nhớ (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Hàm helper để chuyển đổi định dạng ngày từ 'DD/MM/YYYY' sang 'YYYY-MM-DD'
const convertDateFormat = (dateString) => {
  if (!dateString) return null;
  const parts = dateString.split('/');
  if (parts.length === 3) {
    // Đảm bảo định dạng YYYY-MM-DD
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null; // Trả về null nếu định dạng không hợp lệ
};


// --- ĐỊNH NGHĨA API ROUTE ---
app.options('/hrminfo', cors());

app.post(
  '/hrminfo',
  // Multer sẽ xử lý các file này và lưu vào req.files
  upload.fields([
    { name: 'staffPhoto', maxCount: 1 },
    { name: 'citizenFront', maxCount: 1 },
    { name: 'citizenBack', maxCount: 1 }
  ]),
  async (req, res) => {
    console.log('Received data at /hrminfo:');
    const form = req.body;
    const files = req.files;

    if (!form || Object.keys(form).length === 0) {
      return res.status(400).json({ success: false, error: 'Không nhận được dữ liệu từ form.' });
    }
    
    try {
      // Xử lý upload file lên Cloudinary
      let staffPhotoPath = null;
      let citizenFrontPath = null;
      let citizenBackPath = null;
      
      // Chỉ upload nếu file tồn tại và có dữ liệu
      if (files.staffPhoto && files.staffPhoto.length > 0 && files.staffPhoto[0].buffer) {
        const result = await uploadToCloudinary(files.staffPhoto[0].buffer);
        staffPhotoPath = result.secure_url;
      }
      if (files.citizenFront && files.citizenFront.length > 0 && files.citizenFront[0].buffer) {
        const result = await uploadToCloudinary(files.citizenFront[0].buffer);
        citizenFrontPath = result.secure_url;
      }
      if (files.citizenBack && files.citizenBack.length > 0 && files.citizenBack[0].buffer) {
        const result = await uploadToCloudinary(files.citizenBack[0].buffer);
        citizenBackPath = result.secure_url;
      }

      console.log('Cloudinary URLs:', { staffPhotoPath, citizenFrontPath, citizenBackPath });

      // Cập nhật câu lệnh SQL để khớp với cấu trúc bảng mới
      // Loại bỏ "ten_nganh", "ten_truong" và thêm "ten_don_vi"
      const query = `
        INSERT INTO hrminfo (
        ho_va_ten, gioi_tinh, ngay_thang_nam_sinh, hinh_thuc_cong_viec, ngay_bat_dau_lam_viec, hinh_thuc_lam_viec, chuc_vu, phong_ban, thuong_hieu, noi_lam_viec, ten_don_vi, so_dien_thoai, email, link_facebook, so_tai_khoan_vpbank, chu_tai_khoan_vpbank, chi_nhanh_vpbank, so_can_cuoc_cong_dan, dia_chi_thuong_tru, dia_chi_hien_tai, anh_the_nhan_vien_link, anh_cccd_mat_truoc_link, anh_cccd_mat_sau_link, bien_so_xe, tham_gia_nhom_rieng, cam_doan
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 
          $18, $19, $20, $21, $22, $23, $24, $25, $26
        ) RETURNING id;
      `;
      
      // Cập nhật mảng values để khớp với thứ tự và số lượng cột mới
      const values = [
        form.fullName,
        form.gender,
        convertDateFormat(form.dob), 
        form.position,
        convertDateFormat(form.startDate), 
        form.workType,
        form.role,
        form.department,
        form.memberOf,
        form.workPlace,
        form.unitName, 
        form.phone,
        form.email,
        form.facebook,
        form.vpBankAccount,
        form.vpBankOwner,
        form.vpBankBranch,
        form.citizenId,
        form.permanentAddress,
        form.currentAddress,
        staffPhotoPath,
        citizenFrontPath,
        citizenBackPath,
        form.vehiclePlate,
        form.joinInternalGroup === 'Yes' ? 1 : 0, 
        form.confirm ? '1' : '0' 
      ];

      const result = await pool.query(query, values);
      res.status(201).json({
        success: true,
        message: 'Thông tin đã được lưu thành công!',
        id: result.rows[0].id,
        staffPhotoPath,
        citizenFrontPath,
        citizenBackPath
      });

    } catch (err) {
      // Ghi log lỗi chi tiết hơn
      console.error('Detailed Error Object:', err); 
      console.error('Error Message:', err.message); 
      console.error('Error Stack:', err.stack);   
      console.error('Error Name:', err.name);     
      res.status(500).json({ success: false, error: 'Lỗi server: ' + (err.message || 'Lỗi không xác định') });
    }
  }
);

// --- KHỞI ĐỘNG SERVER ---
app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});
