const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'db.json');
const BLOB_DB_URL = 'https://meo68oenlhu0k0ib.public.blob.vercel-storage.com/shopeefb_db.json';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'shopee_salt_2026').digest('hex');
}

// Tài khoản Admin cố định 100% luôn hoạt động
const ROOT_ADMIN = {
  id: 'admin_root',
  email: 'admin@shopeefb.com',
  passwordHash: hashPassword('admin123'),
  name: 'Quản Trị Viên (Lê Văn Thiện)',
  role: 'admin',
  plan: 'business',
  linksUsed: 0,
  linksLimit: 99999,
  planExpiresAt: '2036-12-31T23:59:59.000Z',
  createdAt: '2026-01-01T00:00:00.000Z'
};

// Khởi tạo database local fallback
function getLocalDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data || '{}');
      if (!parsed.users) parsed.users = {};
      parsed.users[ROOT_ADMIN.id] = ROOT_ADMIN;
      return parsed;
    }
  } catch (e) {}
  return { users: { [ROOT_ADMIN.id]: ROOT_ADMIN }, links: {} };
}

function saveLocalDb(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {}
}

// Tương tác Vercel Blob để lưu trữ dữ liệu vĩnh viễn trên đám mây
async function getCloudDb() {
  try {
    const res = await fetch(`${BLOB_DB_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (!data.users) data.users = {};
      data.users[ROOT_ADMIN.id] = ROOT_ADMIN;
      return data;
    }
  } catch (e) {
    // Không kết nối được blob, fallback local
  }
  return getLocalDb();
}

async function saveCloudDb(db) {
  saveLocalDb(db);
  try {
    const { put } = require('@vercel/blob');
    await put('shopeefb_db.json', JSON.stringify(db), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true
    });
  } catch (e) {
    console.error('Lỗi lưu Vercel Blob:', e.message);
  }
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
    allowAds: false,
    allowBooster: false,
    allowHistory: false,
    features: [
      '2 link dùng thử miễn phí',
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
    allowAds: false,
    allowBooster: false,
    allowHistory: false,
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
    badge: 'Tiêu chuẩn',
    allowAds: false,
    allowBooster: false,
    allowHistory: true,
    features: [
      '20 link/tháng',
      'Toàn bộ tính năng Basic',
      'Lưu lịch sử chuyển link cá nhân',
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
    allowAds: true,
    allowBooster: true,
    allowHistory: true,
    features: [
      '50 link/tháng',
      'Toàn bộ tính năng Standard',
      'Tốc độ xử lý siêu tốc 0ms',
      'Vũ khí tăng CTR (Nút Play ảo, Tem sale, FOMO)',
      'Hỗ trợ gắn Pixel Facebook & TikTok Ads',
      'Ưu tiên hỗ trợ kỹ thuật cao'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 199000,
    priceLabel: '199.000đ/tháng',
    linkLimit: 100,
    badge: 'Đội nhóm & ADS Pro',
    allowAds: true,
    allowBooster: true,
    allowHistory: true,
    features: [
      '100 link/tháng',
      'Toàn bộ tính năng Pro',
      'Bộ công cụ Facebook Ads & TikTok Ads Pro (Pixel CAPI + UTM Builder)',
      'Nút chuyển đổi Zalo Group Săn Sale VIP',
      'Hỗ trợ nhiều tài khoản đội nhóm',
      'Hỗ trợ 24/7 ưu tiên cao nhất'
    ]
  }
};

// Quản lý Users
async function getAllUsers() {
  const db = await getCloudDb();
  const users = db.users || {};
  users[ROOT_ADMIN.id] = ROOT_ADMIN;
  return users;
}

async function getUserById(id) {
  if (id === ROOT_ADMIN.id) return ROOT_ADMIN;
  const users = await getAllUsers();
  return users[id] || null;
}

async function getUserByEmail(email) {
  const lower = (email || '').trim().toLowerCase();
  if (lower === ROOT_ADMIN.email.toLowerCase()) return ROOT_ADMIN;
  const users = await getAllUsers();
  return Object.values(users).find(u => u.email.toLowerCase() === lower) || null;
}

async function saveUser(user) {
  const db = await getCloudDb();
  if (!db.users) db.users = {};
  db.users[user.id] = user;
  db.users[ROOT_ADMIN.id] = ROOT_ADMIN;
  await saveCloudDb(db);
  return user;
}

async function deleteUser(userId) {
  if (userId === ROOT_ADMIN.id) return false;
  const db = await getCloudDb();
  if (db.users && db.users[userId]) {
    delete db.users[userId];
    await saveCloudDb(db);
    return true;
  }
  return false;
}

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

module.exports = {
  PLANS,
  ROOT_ADMIN,
  getAllUsers,
  getUserById,
  getUserByEmail,
  saveUser,
  deleteUser,
  hashPassword,
  generateToken,
  verifyToken
};
