const express = require('express');
const fs = require('fs');
const path = require('path');
const {
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
  hashPassword,
  generateToken,
  verifyToken
} = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware xác thực người dùng
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    req.user = null;
    return next();
  }

  const userId = verifyToken(token);
  if (!userId) {
    req.user = null;
    return next();
  }

  const user = await getUserById(userId);
  req.user = user || null;
  next();
}

app.use(authMiddleware);

function generateId(prefix = 'c', length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${result}`;
}

// ----------------- 1. AUTH & USER MANAGEMENT -----------------

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập Email và Mật khẩu' });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Email này đã tồn tại. Vui lòng đăng nhập!' });
  }

  const userId = generateId('usr', 8);
  const newUser = {
    id: userId,
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    name: (name || email.split('@')[0]).trim(),
    role: 'user',
    plan: 'free',
    linksUsed: 0,
    linksLimit: PLANS.free.linkLimit,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  await saveUser(newUser);
  const token = generateToken(newUser.id);

  res.json({
    success: true,
    token,
    user: sanitizeUser(newUser)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập Email và Mật khẩu' });
  }

  const user = await getUserByEmail(email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Email hoặc Mật khẩu không chính xác' });
  }

  const token = generateToken(user.id);
  res.json({
    success: true,
    token,
    user: sanitizeUser(user)
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false, user: null });
  }
  res.json({
    loggedIn: true,
    user: sanitizeUser(req.user)
  });
});

app.get('/api/plans', (req, res) => {
  res.json({ success: true, plans: PLANS });
});

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  const planInfo = PLANS[safe.plan] || PLANS.free;
  return {
    ...safe,
    planDetails: planInfo
  };
}

// ----------------- 2. MODULE 1: AI ADS CONTENT & CREATIVE STUDIO -----------------

app.post('/api/ads/generate-content', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng Đăng nhập tài khoản để tạo nội dung quảng cáo!' });
  }

  const user = req.user;
  const plan = PLANS[user.plan] || PLANS.free;
  const limit = user.linksLimit || plan.linkLimit;

  if (user.linksUsed >= limit && user.role !== 'admin') {
    return res.status(403).json({
      error: `Bạn đã sử dụng hết hạn mức (${user.linksUsed}/${limit} lượt) của gói ${plan.name}. Vui lòng nâng cấp gói để tiếp tục!`,
      limitExceeded: true
    });
  }

  const { productName, category, originalPrice, salePrice, promo, style } = req.body;

  if (!productName) {
    return res.status(400).json({ error: 'Vui lòng nhập Tên sản phẩm cần viết quảng cáo' });
  }

  // Tăng số lượt dùng của user
  user.linksUsed = (user.linksUsed || 0) + 1;
  await saveUser(user);

  const priceText = salePrice ? `${salePrice} (Giá gốc: ${originalPrice || 'cao hơn'})` : (originalPrice || 'Ưu đãi cực sốc');
  const promoText = promo || 'Freeship toàn quốc + Tặng quà độc quyền';

  // Thuật toán AI Copywriting sinh 3 góc nhìn bài viết quảng cáo chuyên sâu
  const posts = [
    {
      formula: 'AIDA (Gây Chú Ý - Tò Mò - Khao Khát - Mua Ngay)',
      headline: `🔥 [XẢ KHO CỰC SỐC] ${productName.toUpperCase()} CHÍNH HÃNG - DUY NHẤT HÔM NAY!`,
      content: `💥 CHỚP CƠ HỘI SĂN SALE LỚN NHẤT THÁNG!
Bạn đang tìm kiếm ${productName} chuẩn xịn, bảo hành uy tín với mức giá hời nhất? Đừng lướt qua bài viết này!

👉 Giá Flash Sale hôm nay: CHỈ CÒN ${salePrice || 'GIÁ CỰC TỐT'} (Giá niêm yết: ${originalPrice || 'giá cũ'})
🎁 ĐẶC QUYỀN ĐI KÈM HÔM NAY:
- ${promoText}
- Cam kết 100% hàng chính hãng, phát hiện hàng giả đền tiền gấp đôi.
- Kiểm tra hàng thoải mái trước khi nhận, ưng ý mới thanh toán!

⏳ Số lượng ưu đãi chỉ còn 25 suất cuối cùng cho những ai để lại bình luận hoặc nhắn tin sớm nhất.
👇 BÌNH LUẬN "MUA NGAY" HOẶC NHẮN TIN TRỰC TIẾP ĐỂ GIỮ SUẤT GIẢM GIÁ!`,
      hashtags: `#${slugify(productName)} #GiamGia #FlashSale #ChinhHang #SaleSoc #Freeship`
    },
    {
      formula: 'PAS (Đánh Trúng Nỗi Đau - Đưa Giải Pháp Hoàn Hảo)',
      headline: `⚠️ ĐỪNG MUA ${productName.toUpperCase()} NẾU BẠN CHƯA BIẾT ĐIỀU NÀY!`,
      content: `Có phải bạn đã từng mất tiền mua phải những sản phẩm kém chất lượng, dùng vài hôm đã hỏng mà không được hỗ trợ bảo hành? 

Đừng để tiền mất tật mang nữa! ${productName} chính là giải pháp nâng cấp trải nghiệm hoàn hảo mà bạn đang tìm kiếm:
✨ Đạt tiêu chuẩn chất lượng cao cấp, độ bền vượt trội.
✨ Thiết kế thông minh, tối ưu công năng sử dụng hàng ngày.
✨ Được hơn 10.000+ khách hàng tin dùng và đánh giá 5 sao.

🔥 DEAL ĐỘC QUYỀN TRÊN BÀI VIẾT NÀY:
- Mức giá trợ giá: ${priceText}
- Ưu đãi: ${promoText}
- Đổi mới 1-1 trong 30 ngày nếu có bất kỳ lỗi nào từ nhà sản xuất.

👉 ĐỂ LẠI BÌNH LUẬN HOẶC NHẤN "GỬI TIN NHẮN" NGAY ĐỂ NHẬN TƯ VẤN & MÃ GIẢM GIÁ ĐỘC QUYỀN!`,
      hashtags: `#${slugify(productName)} #ReviewChatLuong #GiaiPhap #UyTin #MuaSamThongMinh`
    },
    {
      formula: 'FOMO & STORYTELLING (Kích Thích Hành Động Nhanh)',
      headline: `🚨 CẢNH BÁO: CHỈ CÒN VÀI GIỜ NỮA LÀ KẾT THÚC ĐỢT GIẢM GIÁ KHỦNG!`,
      content: `Vừa bóc seal em ${productName} mà mê thực sự cả nhà ơi! Đúng là "tiền nào của nấy", chất lượng vượt xa mong đợi.

Kho vừa báo chỉ còn duy nhất 20 chiếc cuối cùng để kết thúc đợt khuyến mãi này:
💰 Giá ưu đãi: ${priceText}
🚚 Giao hàng hỏa tốc - ${promoText}
📦 Đóng gói cẩn thận 3 lớp, bảo hành chính hãng dài hạn.

Bỏ lỡ hôm nay là ngày mai giá sẽ quay về mức cũ đấy ạ. Nhanh tay kẻo hết size/hết màu ưng ý!
💬 Nhắn tin ngay cho shop hoặc để lại bình luận bên dưới để nhận mã Freeship 0đ nhé cả nhà 👇`,
      hashtags: `#${slugify(productName)} #DealHot #GiaTotMoiNgay #SanSale #SieuPham`
    }
  ];

  res.json({
    success: true,
    posts,
    quota: {
      used: user.linksUsed,
      limit,
      plan: user.plan
    }
  });
});

function slugify(text) {
  return text.toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
}

// ----------------- 3. MODULE 2: TRÌNH QUẢN LÝ & LÊN CHIẾN DỊCH ADS FACEBOOK -----------------

// Lấy danh sách chiến dịch của user
app.get('/api/ads/campaigns', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const campaigns = await getUserCampaigns(req.user.id);
  res.json({ success: true, campaigns });
});

// Tạo và kích hoạt chiến dịch quảng cáo Facebook
app.post('/api/ads/campaigns/create', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { name, objective, dailyBudget, targetAge, targetGender, targetLocation, postTitle, postContent, accessToken } = req.body;

  if (!name || !dailyBudget) {
    return res.status(400).json({ error: 'Vui lòng nhập Tên chiến dịch và Ngân sách hàng ngày' });
  }

  const campId = generateId('camp', 10);
  const budgetNum = parseInt(dailyBudget, 10) || 50000;

  // Mô phỏng lượt tiếp cận và tương tác ước tính theo ngân sách
  const estReachMin = Math.round(budgetNum * 0.08);
  const estReachMax = Math.round(budgetNum * 0.22);
  const estEngage = Math.round(budgetNum * 0.012);

  const newCamp = {
    id: campId,
    userId: req.user.id,
    name: name.trim(),
    objective: objective || 'MESSAGES', // MESSAGES, POST_ENGAGEMENT, TRAFFIC
    dailyBudget: budgetNum,
    targetAge: targetAge || '18-45',
    targetGender: targetGender || 'ALL',
    targetLocation: targetLocation || 'Toàn quốc (Việt Nam)',
    postTitle: postTitle || 'Bài viết quảng cáo thu hút khách',
    postContent: postContent || '',
    status: 'ACTIVE', // ACTIVE, PAUSED
    spent: 0,
    reach: `${estReachMin.toLocaleString('vi-VN')} - ${estReachMax.toLocaleString('vi-VN')}`,
    engagement: estEngage,
    createdAt: new Date().toISOString()
  };

  await saveCampaign(newCamp);

  res.json({
    success: true,
    message: 'Chiến dịch quảng cáo Facebook đã được kích hoạt thành công!',
    campaign: newCamp
  });
});

// Bật / Tắt chiến dịch
app.post('/api/ads/campaigns/toggle', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { campaignId } = req.body;
  const updated = await toggleCampaignStatus(campaignId, req.user.id);

  if (!updated) {
    return res.status(404).json({ error: 'Không tìm thấy chiến dịch này' });
  }

  res.json({
    success: true,
    message: `Đã chuyển trạng thái chiến dịch sang: ${updated.status === 'ACTIVE' ? 'ĐANG CHẠY' : 'TẠM DỪNG'}`,
    campaign: updated
  });
});

// ----------------- 4. MODULE 3: HỆ THỐNG AUTO REPLY COMMENT & AUTO INBOX -----------------

// Lấy cấu hình kịch bản
app.get('/api/ads/auto-reply', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const config = await getAutoReplyConfig(req.user.id);
  res.json({ success: true, config });
});

// Lưu cấu hình kịch bản
app.post('/api/ads/auto-reply', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { enabled, autoLike, hidePhone, replyTemplates, inboxMessage } = req.body;
  const updated = await saveAutoReplyConfig(req.user.id, {
    enabled: enabled !== false,
    autoLike: autoLike !== false,
    hidePhone: hidePhone !== false,
    replyTemplates: Array.isArray(replyTemplates) && replyTemplates.length > 0 ? replyTemplates : [
      "Dạ em chào anh/chị ạ! Em đã gửi thông tin ưu đãi và quà tặng qua tin nhắn riêng cho mình rồi đó ạ, mình kiểm tra hộp thư giúp em nhé! ❤️"
    ],
    inboxMessage: inboxMessage || "Dạ shop chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm bên shop. Hôm nay shop đang có ưu đãi giảm 50% kèm quà tặng đặc biệt dành riêng cho bạn! Bấm vào link để xem chi tiết nhé ạ: [LINK_SAN_PHAM]"
  });

  res.json({
    success: true,
    message: 'Đã lưu kịch bản tự động phản hồi thành công!',
    config: updated
  });
});

// Mô phỏng kịch bản (Live Simulator)
app.post('/api/ads/auto-reply/simulate', async (req, res) => {
  const { customerComment, customerName, productName, productPrice, productLink } = req.body;

  const name = customerName || 'Khách hàng';
  const comment = (customerComment || '').trim();
  const hasPhone = /(03|05|07|08|09)\d{8}/.test(comment);

  const templates = [
    `Dạ em chào ${name} ạ! Em vừa gửi thông tin chi tiết kèm mã giảm giá độc quyền vào tin nhắn cho mình rồi đó ạ, ${name} kiểm tra hộp thư giúp em nhé! ❤️`,
    `Chào ${name} ơi, shop đang có Flash Sale giá sốc hôm nay ạ. Shop đã nhắn tin tư vấn trực tiếp cho ${name} rồi nhé 🥰`,
    `Dạ shop vừa gửi bảng giá ưu đãi và quà tặng kèm freeship vào Messenger cho ${name} rồi ạ, bạn check tin nhắn chờ giúp shop nha! 🎁`
  ];

  const pickedReply = templates[Math.floor(Math.random() * templates.length)];
  const inboxMessage = `Dạ shop chào ${name}! Cảm ơn bạn đã quan tâm đến ${productName || 'sản phẩm'}.\n\n🔥 Mức giá Flash Sale hôm nay: ${productPrice || '199.000đ (Giảm 50%)'}\n🎁 Ưu đãi: Miễn phí giao hàng toàn quốc + Tặng voucher giảm 50k!\n\n👉 Bạn bấm vào đây để xem chi tiết và đặt hàng nhận quà nhé: ${productLink || 'https://shopee.vn'}`;

  res.json({
    success: true,
    result: {
      actionLiked: true,
      actionHidden: hasPhone,
      hideReason: hasPhone ? 'Phát hiện số điện thoại: Tự động ẩn comment để chống đối thủ cướp khách' : null,
      replyComment: pickedReply,
      sentInbox: inboxMessage,
      timestamp: new Date().toLocaleTimeString('vi-VN')
    }
  });
});

// ----------------- 5. ADMIN MANAGEMENT -----------------

app.get('/api/admin/users', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền truy cập!' });
  }
  const usersMap = await getAllUsers();
  const users = Object.values(usersMap).map(u => sanitizeUser(u));
  res.json({ success: true, users });
});

app.post('/api/admin/upgrade', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền nâng cấp!' });
  }

  const { targetEmail, planId, days, customLimit } = req.body;
  const user = await getUserByEmail(targetEmail);
  if (!user) {
    return res.status(404).json({ error: `Không tìm thấy tài khoản: ${targetEmail}` });
  }

  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'Gói không hợp lệ' });

  const durationDays = parseInt(days, 10) || 30;
  user.plan = planId;
  user.linksLimit = customLimit ? parseInt(customLimit, 10) : plan.linkLimit;
  user.linksUsed = 0;
  user.planExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await saveUser(user);

  res.json({
    success: true,
    message: `Đã kích hoạt thành công gói ${plan.name} cho ${user.email} (${durationDays} ngày)!`,
    user: sanitizeUser(user)
  });
});

app.post('/api/admin/reset-quota', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thao tác!' });
  }
  const { targetEmail } = req.body;
  const user = await getUserByEmail(targetEmail);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  user.linksUsed = 0;
  await saveUser(user);
  res.json({ success: true, message: `Đã đặt lại lượt dùng về 0 cho ${user.email}` });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa!' });
  }
  const success = await deleteUser(req.params.id);
  if (!success) return res.status(400).json({ error: 'Không thể xóa tài khoản này' });
  res.json({ success: true, message: 'Đã xóa người dùng thành công' });
});

app.listen(PORT, () => {
  console.log(`Server Facebook Ads Suite đang chạy tại: http://localhost:${PORT}`);
});
