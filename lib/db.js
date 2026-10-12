const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'db.json');

// Khởi tạo database local nếu chưa có
function getLocalDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (e) {}
  return { users: {}, links: {} };
}

function saveLocalDb(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {}
}

// Kiểm tra Vercel KV / Upstash Redis
const hasVercelKV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function kvGet(key) {
  if (hasVercelKV) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
      const data = await res.json();
      return data.result ? JSON.parse(data.result) : null;
    } catch (e) {
      console.error('KV get error:', e);
    }
  }
  const db = getLocalDb();
  return db[key] || null;
}

async function kvSet(key, value) {
  if (hasVercelKV) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(value))
      });
      return;
    } catch (e) {
      console.error('KV set error:', e);
    }
  }
  const db = getLocalDb();
  db[key] = value;
  saveLocalDb(db);
}

// Bảng thông số 4 gói cước chuẩn thiết kế
const PLANS = {
  free: {
    id: 'free',
    name: 'Dùng Thử',
    price: 0,
    priceLabel: '0đ',
    linkLimit: 2,
    badge: 'Trải nghiệm',
    features: [
      '2 link dùng thử',
      'Chuyển link Shopee mở App ngay',
      'Hỗ trợ link Affiliate Shopee'
    ]
  },
  basic: {
    id: 'basic',
    name: 'Basic (Khởi đầu)',
    price: 59000,
    priceLabel: '59.000đ/tháng',
    linkLimit: 5,
    badge: 'Khởi đầu',
    features: [
      '5 link/tháng',
      'Chuyển link Shopee sang deeplink mở app',
      'Hỗ trợ link Affiliate',
      'Sử dụng 1 tài khoản',
      'Hỗ trợ kỹ thuật cơ bản'
    ]
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    price: 99000,
    priceLabel: '99.000đ/tháng',
    linkLimit: 20,
    badge: 'Cân bằng',
    features: [
      '20 link/tháng',
      'Toàn bộ tính năng Basic',
      'Lưu lịch sử chuyển link',
      'Sao chép kết quả nhanh',
      'Hỗ trợ kỹ thuật ưu tiên'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 149000,
    priceLabel: '149.000đ/tháng',
    linkLimit: 50,
    badge: 'Phổ biến nhất',
    popular: true,
    features: [
      '50 link/tháng',
      'Toàn bộ tính năng Standard',
      'Ưu tiên hỗ trợ kỹ thuật',
      'Tốc độ xử lý nhanh hơn',
      'Vũ khí tăng CTR (Nút Play ảo, Tem sale, FOMO)'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 199000,
    priceLabel: '199.000đ/tháng',
    linkLimit: 100,
    badge: 'Đội nhóm',
    features: [
      '100 link/tháng',
      'Toàn bộ tính năng Pro',
      'Chuyển đổi hàng loạt link',
      'Hỗ trợ nhiều tài khoản đội nhóm',
      'Hỗ trợ ưu tiên cao nhất'
    ]
  }
};

// Quản lý Users
async function getAllUsers() {
  const users = await kvGet('users');
  return users || {};
}

async function getUserById(id) {
  const users = await getAllUsers();
  return users[id] || null;
}

async function getUserByEmail(email) {
  const users = await getAllUsers();
  const lower = (email || '').trim().toLowerCase();
  return Object.values(users).find(u => u.email.toLowerCase() === lower) || null;
}

async function saveUser(user) {
  const users = await getAllUsers();
  users[user.id] = user;
  await kvSet('users', users);
  return user;
}

// Băm mật khẩu an toàn
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'shopee_salt_2026').digest('hex');
}

// Tạo Token đơn giản cho phiên làm việc
function generateToken(userId) {
  const payload = `${userId}:${Date.now()}`;
  const signature = crypto.createHmac('sha256', 'aff_secret_key_2026').update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, timestamp, signature] = raw.split(':');
    if (!userId || !timestamp || !signature) return null;
    const expected = crypto.createHmac('sha256', 'aff_secret_key_2026').update(`${userId}:${timestamp}`).digest('hex');
    if (signature === expected) {
      return userId;
    }
  } catch (e) {}
  return null;
}

// Khởi tạo tài khoản Admin mặc định nếu chưa có
async function initDefaultAdmin() {
  const adminEmail = 'admin@shopeefb.com';
  const existing = await getUserByEmail(adminEmail);
  if (!existing) {
    const adminUser = {
      id: 'admin_root',
      email: adminEmail,
      passwordHash: hashPassword('admin123'),
      name: 'Quản Trị Viên',
      role: 'admin',
      plan: 'business',
      linksUsed: 0,
      linksLimit: 99999,
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };
    await saveUser(adminUser);
    console.log('✅ Đã tạo tài khoản Admin mặc định: admin@shopeefb.com / admin123');
  }
}

initDefaultAdmin();

module.exports = {
  PLANS,
  getAllUsers,
  getUserById,
  getUserByEmail,
  saveUser,
  hashPassword,
  generateToken,
  verifyToken
};
