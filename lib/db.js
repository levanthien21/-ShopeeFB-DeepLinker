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
      if (!parsed.campaigns) parsed.campaigns = {};
      if (!parsed.autoReplies) parsed.autoReplies = {};
      parsed.users[ROOT_ADMIN.id] = ROOT_ADMIN;
      return parsed;
    }
  } catch (e) {}
  return { users: { [ROOT_ADMIN.id]: ROOT_ADMIN }, links: {}, campaigns: {}, autoReplies: {} };
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
      if (!data.campaigns) data.campaigns = {};
      if (!data.autoReplies) data.autoReplies = {};
      data.users[ROOT_ADMIN.id] = ROOT_ADMIN;
      return data;
    }
  } catch (e) {}
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
    linkLimit: 5,
    badge: 'Trải nghiệm',
    allowAdsTool: true,
    allowAiContent: true,
    features: [
      '5 lượt tạo bài viết quảng cáo AI',
      'Thiết kế hình ảnh quảng cáo Visual Ad',
      'Mô phỏng Auto Reply chốt đơn'
    ]
  },
  basic: {
    id: 'basic',
    name: 'Basic (Khởi đầu)',
    price: 59000,
    priceLabel: '59.000đ/tháng',
    linkLimit: 30,
    badge: 'Khởi đầu',
    allowAdsTool: true,
    allowAiContent: true,
    features: [
      '30 bài viết quảng cáo AI/tháng',
      'Thiết kế banner quảng cáo Flash Sale HD',
      'Lên chiến dịch Ads Facebook cơ bản',
      'Hỗ trợ 1 tài khoản'
    ]
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    price: 99000,
    priceLabel: '99.000đ/tháng',
    linkLimit: 100,
    badge: 'Tiêu chuẩn',
    allowAdsTool: true,
    allowAiContent: true,
    features: [
      '100 bài viết quảng cáo AI/tháng',
      'Tạo ảnh quảng cáo không giới hạn',
      'Quản lý 5 chiến dịch Facebook Ads đồng thời',
      'Kịch bản Auto Reply & Auto Inbox chống cướp khách',
      'Hỗ trợ kỹ thuật ưu tiên'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 149000,
    priceLabel: '149.000đ/tháng',
    linkLimit: 300,
    badge: 'Phổ biến nhất',
    popular: true,
    allowAdsTool: true,
    allowAiContent: true,
    features: [
      '300 bài viết quảng cáo AI/tháng',
      'Mở khóa trọn bộ công thức AIDA, PAS, FOMO Shock',
      'Lên chiến dịch Ads 1-click tự động qua Facebook API',
      'Hệ thống Auto Reply + Tự động gửi tin nhắn chốt đơn',
      'Ẩn comment chứa SĐT bảo vệ khách hàng 100%',
      'Ưu tiên hỗ trợ kỹ thuật cao'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 199000,
    priceLabel: '199.000đ/tháng',
    linkLimit: 1000,
    badge: 'Đội nhóm & Doanh nghiệp',
    allowAdsTool: true,
    allowAiContent: true,
    features: [
      'Không giới hạn bài viết quảng cáo AI',
      'Bộ công cụ Facebook Ads Manager Pro không giới hạn tài khoản',
      'Hệ thống phễu Auto Inbox đa kịch bản',
      'Hỗ trợ nhiều tài khoản đội nhóm làm việc cùng lúc',
      'Hỗ trợ 24/7 trực tiếp 1-1'
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

// Quản lý Chiến Dịch Ads (Module 2)
async function getUserCampaigns(userId) {
  const db = await getCloudDb();
  const all = db.campaigns || {};
  return Object.values(all).filter(c => c.userId === userId || userId === ROOT_ADMIN.id);
}

async function saveCampaign(campaign) {
  const db = await getCloudDb();
  if (!db.campaigns) db.campaigns = {};
  db.campaigns[campaign.id] = campaign;
  await saveCloudDb(db);
  return campaign;
}

async function toggleCampaignStatus(campaignId, userId) {
  const db = await getCloudDb();
  if (db.campaigns && db.campaigns[campaignId]) {
    const camp = db.campaigns[campaignId];
    camp.status = camp.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    camp.updatedAt = new Date().toISOString();
    await saveCloudDb(db);
    return camp;
  }
  return null;
}

// Quản lý Cài Đặt Auto Reply (Module 3)
async function getAutoReplyConfig(userId) {
  const db = await getCloudDb();
  if (!db.autoReplies) db.autoReplies = {};
  return db.autoReplies[userId] || {
    enabled: true,
    autoLike: true,
    hidePhone: true,
    replyTemplates: [
      "Dạ em chào anh/chị ạ! Em đã gửi thông tin khuyến mãi và mã giảm giá 50k qua tin nhắn riêng cho mình rồi đó ạ, anh/chị check inbox giúp em nhé! ❤️",
      "Chào bạn ơi, bên mình đang có Flash Sale giá sốc hôm nay ạ. Mình gửi thông tin chi tiết vào hộp thư Messenger cho bạn rồi nhé 🥰",
      "Dạ bạn check tin nhắn chờ giúp shop nhé, shop vừa gửi mã ưu đãi freeship và quà tặng độc quyền cho bạn đó ạ! 🎁"
    ],
    inboxMessage: "Dạ shop chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm bên shop. Hôm nay bên shop đang có chương trình FLASH SALE giảm giá đến 50% kèm miễn phí giao hàng toàn quốc! Bạn đặt hàng ngay hôm nay để nhận thêm quà tặng đặc biệt nhé: [LINK_DAT_HANG]"
  };
}

async function saveAutoReplyConfig(userId, config) {
  const db = await getCloudDb();
  if (!db.autoReplies) db.autoReplies = {};
  db.autoReplies[userId] = config;
  await saveCloudDb(db);
  return config;
}

// Quản lý cấu hình liên kết Facebook & Đặt lịch
async function getFbIntegration(userId) {
  const db = await getCloudDb();
  if (!db.fbIntegrations) db.fbIntegrations = {};
  return db.fbIntegrations[userId] || {
    connected: false,
    pageId: '',
    pageName: '',
    pageAccessToken: '',
    adAccountId: '',
    autoScheduleEnabled: false,
    dailyPostTime: '20:00',
    autoRunAds: true,
    dailyBudget: 50000,
    selectedCategory: 'cong_nghe',
    lastSync: null
  };
}

async function saveFbIntegration(userId, data) {
  const db = await getCloudDb();
  if (!db.fbIntegrations) db.fbIntegrations = {};
  const current = db.fbIntegrations[userId] || {};
  db.fbIntegrations[userId] = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString()
  };
  await saveCloudDb(db);
  return db.fbIntegrations[userId];
}

// Quản lý Hàng Đợi Lịch Đăng Bài (Scheduled Queue)
async function getScheduledQueue(userId) {
  const db = await getCloudDb();
  if (!db.scheduledQueues) db.scheduledQueues = {};
  return db.scheduledQueues[userId] || [];
}

async function saveScheduledQueue(userId, queue) {
  const db = await getCloudDb();
  if (!db.scheduledQueues) db.scheduledQueues = {};
  db.scheduledQueues[userId] = queue;
  await saveCloudDb(db);
  return queue;
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
  getUserCampaigns,
  saveCampaign,
  toggleCampaignStatus,
  getAutoReplyConfig,
  saveAutoReplyConfig,
  getFbIntegration,
  saveFbIntegration,
  getScheduledQueue,
  saveScheduledQueue,
  hashPassword,
  generateToken,
  verifyToken
};
