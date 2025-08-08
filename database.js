const { Pool } = require('pg');

const pool = new Pool({
  user: 'n8n_user',        // Thay bằng user của bạn
  host: '100.91.108.88',
  database: 'Web_HRM',     // Thay bằng tên database của bạn
  password: 'n8n_pass', // Thay bằng password của bạn
  port: 5432,
});

// Test kết nối
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Kết nối lỗi:', err);
  } else {
    console.log('Kết nối thành công!', res.rows[0]);
  }
});
module.exports = pool;
