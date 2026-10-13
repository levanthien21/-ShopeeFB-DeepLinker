const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  } catch (e) {}
}

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
      if (!parsed.links) parsed.links = {};
      if (!parsed.campaigns) parsed.campaigns = {};
      if (!parsed.autoReplies) parsed.autoReplies = {};
      if (!parsed.fbIntegrations) parsed.fbIntegrations = {};
      if (!parsed.scheduledQueues) parsed.scheduledQueues = {};
      if (!parsed.fanpageFarms) parsed.fanpageFarms = {};
      if (!parsed.repliedComments) parsed.repliedComments = {};
      if (!parsed.autoReplyLogs) parsed.autoReplyLogs = {};
      parsed.users[ROOT_ADMIN.id] = ROOT_ADMIN;
      return parsed;
    }
  } catch (e) {}
  return { users: { [ROOT_ADMIN.id]: ROOT_ADMIN }, links: {}, campaigns: {}, autoReplies: {}, fbIntegrations: {}, scheduledQueues: {}, fanpageFarms: {}, repliedComments: {}, autoReplyLogs: {} };
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
      if (!data.links) data.links = {};
      if (!data.campaigns) data.campaigns = {};
      if (!data.autoReplies) data.autoReplies = {};
      if (!data.fbIntegrations) data.fbIntegrations = {};
      if (!data.scheduledQueues) data.scheduledQueues = {};
      if (!data.fanpageFarms) data.fanpageFarms = {};
      if (!data.repliedComments) data.repliedComments = {};
      if (!data.autoReplyLogs) data.autoReplyLogs = {};
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
    const options = {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true
    };
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      options.token = process.env.BLOB_READ_WRITE_TOKEN;
    }
    await put('shopeefb_db.json', JSON.stringify(db), options);
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

// Quản lý Nhật Ký & Danh Sách Bình Luận Đã Xử Lý (Auto-Reply Logs)
async function getRepliedCommentIds(userId) {
  const db = await getCloudDb();
  if (!db.repliedComments) db.repliedComments = {};
  const list = db.repliedComments[userId] || [];
  return list.map(item => (typeof item === 'string' ? item : item.commentId));
}

async function getAutoReplyLogs(userId) {
  const db = await getCloudDb();
  if (!db.autoReplyLogs) db.autoReplyLogs = {};
  return db.autoReplyLogs[userId] || [];
}

async function addRepliedCommentLog(userId, logItem) {
  const db = await getCloudDb();
  if (!db.repliedComments) db.repliedComments = {};
  if (!Array.isArray(db.repliedComments[userId])) db.repliedComments[userId] = [];
  
  if (!db.autoReplyLogs) db.autoReplyLogs = {};
  if (!Array.isArray(db.autoReplyLogs[userId])) db.autoReplyLogs[userId] = [];

  // Thêm ID vào danh sách đã phản hồi
  if (logItem.commentId) {
    db.repliedComments[userId].unshift(logItem.commentId);
    if (db.repliedComments[userId].length > 500) {
      db.repliedComments[userId] = db.repliedComments[userId].slice(0, 500);
    }
  }

  // Thêm chi tiết vào nhật ký hiển thị UI
  db.autoReplyLogs[userId].unshift(logItem);
  if (db.autoReplyLogs[userId].length > 100) {
    db.autoReplyLogs[userId] = db.autoReplyLogs[userId].slice(0, 100);
  }

  await saveCloudDb(db);
  return logItem;
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

// ----------------- QUẢN LÝ DÀN NUÔI FANPAGE TỰ ĐỘNG (MULTI-FANPAGE FARM) -----------------
async function getFanpageFarm(userId) {
  const db = await getCloudDb();
  if (!db.fanpageFarms) db.fanpageFarms = {};
  let list = db.fanpageFarms[userId] || [];

  // Di chuyển tự động từ fbIntegrations cũ sang dàn farm nếu list còn trống
  if (list.length === 0 && db.fbIntegrations && db.fbIntegrations[userId] && db.fbIntegrations[userId].connected) {
    const old = db.fbIntegrations[userId];
    const initialPage = {
      id: old.pageId || ('page_' + Date.now()),
      name: old.pageName || 'Fanpage Bán Hàng Trực Tuyến',
      category: old.pageCategory || 'Trang Doanh Nghiệp',
      avatar: old.pageAvatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      accessToken: old.pageAccessToken || '',
      niche: old.niche || old.selectedCategory || 'cong_nghe',
      status: old.autoScheduleEnabled ? 'ACTIVE' : 'PAUSED',
      dailySlots: [old.dailyPostTime || '20:00'],
      postsPerDay: 1,
      contentMix: 'balanced', // 'balanced' (Kiến thức + Tương tác + Deal), 'knowledge' (Chỉ kiến thức/tips), 'sales' (Tập trung deal bán hàng)
      affiliateLink: '',
      autoRunAds: !!old.autoRunAds,
      dailyBudget: old.dailyBudget || 50000,
      totalPostsPublished: 0,
      lastPostedSlot: null,
      lastPostedDate: old.lastAutoPilotDate || null,
      postHistory: [],
      createdAt: new Date().toISOString()
    };
    list = [initialPage];
    db.fanpageFarms[userId] = list;
    await saveCloudDb(db);
  }

  return list;
}

async function saveFanpageToFarm(userId, pageData) {
  const db = await getCloudDb();
  if (!db.fanpageFarms) db.fanpageFarms = {};
  const list = db.fanpageFarms[userId] || [];

  const existingIndex = list.findIndex(p => p.id === pageData.id);
  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      ...pageData,
      updatedAt: new Date().toISOString()
    };
  } else {
    list.push({
      ...pageData,
      status: pageData.status || 'ACTIVE',
      totalPostsPublished: 0,
      lastPostedSlot: null,
      lastPostedDate: null,
      postHistory: [],
      createdAt: new Date().toISOString()
    });
  }

  db.fanpageFarms[userId] = list;
  await saveCloudDb(db);
  return list;
}

async function updateFanpageInFarm(userId, pageId, updates) {
  const db = await getCloudDb();
  if (!db.fanpageFarms || !db.fanpageFarms[userId]) return null;
  const list = db.fanpageFarms[userId];
  const item = list.find(p => p.id === pageId);
  if (item) {
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    await saveCloudDb(db);
    return item;
  }
  return null;
}

async function deleteFanpageFromFarm(userId, pageId) {
  const db = await getCloudDb();
  if (!db.fanpageFarms || !db.fanpageFarms[userId]) return false;
  db.fanpageFarms[userId] = db.fanpageFarms[userId].filter(p => p.id !== pageId);
  await saveCloudDb(db);
  return true;
}

async function toggleFanpageFarmStatus(userId, pageId) {
  const db = await getCloudDb();
  if (!db.fanpageFarms || !db.fanpageFarms[userId]) return null;
  const item = db.fanpageFarms[userId].find(p => p.id === pageId);
  if (item) {
    item.status = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    item.updatedAt = new Date().toISOString();
    await saveCloudDb(db);
    return item;
  }
  return null;
}

async function addPostToFarmHistory(userId, pageId, postLog) {
  const db = await getCloudDb();
  if (!db.fanpageFarms || !db.fanpageFarms[userId]) return;
  const item = db.fanpageFarms[userId].find(p => p.id === pageId);
  if (item) {
    if (!item.postHistory) item.postHistory = [];
    item.postHistory.unshift(postLog);
    if (item.postHistory.length > 50) item.postHistory = item.postHistory.slice(0, 50);
    item.totalPostsPublished = (item.totalPostsPublished || 0) + 1;
    item.lastPostedDate = postLog.date || new Date().toISOString().slice(0, 10);
    item.lastPostedSlot = postLog.slot || null;
    await saveCloudDb(db);
  }
}

// ----------------- QUẢN LÝ SHOPEEFB DEEPLINKER (RÚT GỌN & CHUYỂN LINK MỞ APP) -----------------
async function getStoredLinks(userId = null) {
  const db = await getCloudDb();
  if (!db.links) db.links = {};
  if (!userId) return db.links;
  const filtered = {};
  for (const [k, v] of Object.entries(db.links)) {
    if (v.userId === userId || userId === ROOT_ADMIN.id) {
      filtered[k] = v;
    }
  }
  return filtered;
}

async function getStoredLink(linkId) {
  const db = await getCloudDb();
  if (!db.links) db.links = {};
  return db.links[linkId] || null;
}

async function saveStoredLink(link) {
  const db = await getCloudDb();
  if (!db.links) db.links = {};
  db.links[link.id] = link;
  await saveCloudDb(db);
  return link;
}

async function deleteStoredLink(linkId, userId) {
  const db = await getCloudDb();
  if (!db.links) db.links = {};
  if (db.links[linkId]) {
    if (db.links[linkId].userId === userId || userId === ROOT_ADMIN.id) {
      delete db.links[linkId];
      await saveCloudDb(db);
      return true;
    }
  }
  return false;
}

async function incrementLinkClicks(linkId) {
  const db = await getCloudDb();
  if (db.links && db.links[linkId]) {
    db.links[linkId].clicks = (db.links[linkId].clicks || 0) + 1;
    await saveCloudDb(db);
    return db.links[linkId].clicks;
  }
  return 0;
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
  getRepliedCommentIds,
  getAutoReplyLogs,
  addRepliedCommentLog,
  getFbIntegration,
  saveFbIntegration,
  getScheduledQueue,
  saveScheduledQueue,
  getFanpageFarm,
  saveFanpageToFarm,
  updateFanpageInFarm,
  deleteFanpageFromFarm,
  toggleFanpageFarmStatus,
  addPostToFarmHistory,
  getStoredLinks,
  getStoredLink,
  saveStoredLink,
  deleteStoredLink,
  incrementLinkClicks,
  hashPassword,
  generateToken,
  verifyToken
};
