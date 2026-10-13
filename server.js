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
} = require('./lib/db');
const { generateAutonomousPost, NICHE_DATA } = require('./lib/autopilot-ai');

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

// ----------------- SHOPEEFB DEEPLINKER CORE ENGINE (CHUYỂN LINK SHOPEE MỞ APP) -----------------

function attachTrackingParams(url, { subId, utmSource, utmMedium, utmCampaign }) {
  try {
    const u = new URL(url);
    if (subId) u.searchParams.set('sub_id', subId);
    if (utmSource) u.searchParams.set('utm_source', utmSource);
    if (utmMedium) u.searchParams.set('utm_medium', utmMedium);
    if (utmCampaign) u.searchParams.set('utm_campaign', utmCampaign);
    return u.toString();
  } catch (e) {
    return url;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Thuật toán nhận diện số điện thoại tiếng Việt thông minh
 * Nhận diện cả số viết liền, ngắt quãng bằng dấu cách, chấm, gạch ngang, hoặc viết bằng chữ/kèm tiền tố
 */
function containsPhoneNumber(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const str = rawText.trim();
  
  // 1. Chuẩn hóa: Thay các từ ngữ chỉ số nếu có (không, một, hai, ...)
  const wordMap = {
    'không': '0', 'khong': '0', 'o': '0',
    'một': '1', 'mot': '1', 'mốt': '1',
    'hai': '2', 'ba': '3', 'bốn': '4', 'bon': '4', 'tư': '4',
    'năm': '5', 'nam': '5', 'sáu': '6', 'sau': '6',
    'bảy': '7', 'bay': '7', 'tám': '8', 'tam': '8',
    'chín': '9', 'chin': '9'
  };

  let normalized = str.toLowerCase();
  for (const [w, digit] of Object.entries(wordMap)) {
    normalized = normalized.replace(new RegExp(`\\b${w}\\b`, 'gi'), digit);
  }

  // 2. Kiểm tra trực tiếp mẫu regex số điện thoại Việt Nam phổ thông
  // Bắt các dạng: 0912345678, 0912 345 678, 0912.345.678, 0912-345-678, +84912345678, 84912345678
  const vnPhoneRegex = /(?:\+?84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])(?:[\s.-]*\d){7}\b/;
  if (vnPhoneRegex.test(str) || vnPhoneRegex.test(normalized)) return true;

  // 3. Trích xuất tất cả các cụm chữ số liên tiếp sau khi bỏ dấu cách/ký tự đặc biệt
  // Bắt các trường hợp người dùng cố tình lách: 0.9.1.2.3.4.5.6.7.8 hoặc "sdt: 098 765 4321"
  const digitsOnly = str.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
    if (/^(0|84)(3|5|7|8|9)/.test(digitsOnly)) return true;
  }

  // 4. Mẫu chuỗi có chứa từ khoá "sđt", "phone", "zalo", "lh", "call" kèm dãy số từ 8 số trở lên
  const contextRegex = /(?:sđt|sdt|đt|dt|tel|phone|zalo|call|lh|liên hệ|inbox qua)[\s:.-]*([0-9\s.-]{8,13})/i;
  const match = str.match(contextRegex);
  if (match && match[1]) {
    const cleanDigits = match[1].replace(/[^\d]/g, '');
    if (cleanDigits.length >= 9 && cleanDigits.length <= 11) return true;
  }

  return false;
}

/**
 * Hàm ẩn comment trên Facebook Fanpage bằng Meta Graph API
 * Thử cả 3 phương thức: POST query param, POST body, và method=POST override
 */
async function hideFacebookComment(commentId, token) {
  if (!commentId || !token) return false;
  const cleanToken = token.trim();

  // Thử Cách 1: POST query param ?is_hidden=true&access_token=...
  try {
    const res1 = await fetch(`https://graph.facebook.com/v19.0/${commentId}?is_hidden=true&access_token=${encodeURIComponent(cleanToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data1 = await res1.json();
    if (data1 && data1.success) return true;
    if (data1 && data1.error) {
      console.warn(`Hide comment attempt 1 failed (${commentId}):`, data1.error.message);
    }
  } catch (e) {}

  // Thử Cách 2: POST JSON body { is_hidden: true, access_token: ... }
  try {
    const res2 = await fetch(`https://graph.facebook.com/v19.0/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: true, access_token: cleanToken })
    });
    const data2 = await res2.json();
    if (data2 && data2.success) return true;
    if (data2 && data2.error) {
      console.warn(`Hide comment attempt 2 failed (${commentId}):`, data2.error.message);
    }
  } catch (e) {}

  // Thử Cách 3: POST urlencoded form-data
  try {
    const params = new URLSearchParams();
    params.append('is_hidden', 'true');
    params.append('access_token', cleanToken);
    const res3 = await fetch(`https://graph.facebook.com/v19.0/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data3 = await res3.json();
    if (data3 && data3.success) return true;
  } catch (e) {}

  return false;
}

function renderBridgePage(req, res, linkData, currentUrl) {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|Pinterest|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Googlebot|bingbot/i.test(userAgent);
  const hasVoucher = Boolean(linkData.voucher);
  const hasFbPixel = Boolean(linkData.fbPixel);
  const hasTiktokPixel = Boolean(linkData.tiktokPixel);

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${escapeHtml(linkData.title)}</title>
  <meta name="description" content="${escapeHtml(linkData.description)}">
  
  <meta property="fb:app_id" content="966242223397117">
  <meta property="og:site_name" content="Shopee">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(linkData.title)}">
  <meta property="og:description" content="${escapeHtml(linkData.description)}">
  <meta property="og:image" content="${escapeHtml(linkData.imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(linkData.imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(linkData.title)}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(linkData.title)}">
  <meta name="twitter:description" content="${escapeHtml(linkData.description)}">
  <meta name="twitter:image" content="${escapeHtml(linkData.imageUrl)}">

  ${hasFbPixel ? `
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${escapeHtml(linkData.fbPixel)}');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${escapeHtml(linkData.title)}' });
    fbq('track', 'AddToCart');
  </script>
  ` : ''}

  ${hasTiktokPixel ? `
  <script>
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
      ttq.load('${escapeHtml(linkData.tiktokPixel)}');
      ttq.page();
      ttq.track('ViewContent');
    }(window, document, 'ttq');
  </script>
  ` : ''}

  ${isBot ? '<!-- Bot crawl meta -->' : `
  <script>
    (function() {
      var targetUrl = ${JSON.stringify(linkData.targetUrl)};
      var voucher = ${JSON.stringify(linkData.voucher || '')};
      if (voucher && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(voucher).catch(function() {});
      }
      var ua = navigator.userAgent || '';
      var isAndroid = /android/i.test(ua);
      var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

      function doRedirect() {
        if (isAndroid) {
          var cleanUrl = targetUrl.replace(/^https?:\\/\\//, '');
          var fallback = encodeURIComponent(targetUrl);
          window.location.replace('intent://' + cleanUrl + '#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=' + fallback + ';end;');
        } else if (isIOS) {
          window.location.replace('shopee://open?url=' + encodeURIComponent(targetUrl));
          setTimeout(function() {
            window.location.replace(targetUrl);
          }, 300);
        } else {
          window.location.replace(targetUrl);
        }
      }

      var delay = ${(hasFbPixel || hasTiktokPixel) ? 250 : 0};
      if (delay > 0) {
        setTimeout(doRedirect, delay);
      } else {
        doRedirect();
      }
    })();
  </script>
  `}

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      max-width: 420px;
      width: 100%;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .thumb {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 16px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 8px;
      line-height: 1.4;
      color: #0f172a;
    }
    .voucher-box {
      background: #fff7ed;
      border: 1px dashed #ea580c;
      padding: 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      color: #c2410c;
      margin: 12px 0;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #ee4d2d, #ff5722);
      color: #ffffff;
      text-decoration: none;
      font-weight: 800;
      font-size: 15px;
      border-radius: 14px;
      margin-top: 14px;
      box-shadow: 0 4px 12px rgba(238, 77, 45, 0.3);
      box-sizing: border-box;
    }
    .tips {
      font-size: 11px;
      color: #64748b;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${escapeHtml(linkData.imageUrl)}" alt="Preview" class="thumb">
    <div class="title">${escapeHtml(linkData.title)}</div>
    ${hasVoucher ? `<div class="voucher-box">🎁 Đã tự động sao chép mã giảm giá: <b>${escapeHtml(linkData.voucher)}</b></div>` : ''}
    <a href="${escapeHtml(linkData.targetUrl)}" class="btn">🛍️ MỞ ỨNG DỤNG SHOPEE NGAY</a>
    <div class="tips">Đang kết nối ứng dụng Shopee... Nếu máy không tự mở, hãy bấm nút trên.</div>
  </div>
</body>
</html>`;

  res.send(html);
}

// API Tạo link ShopeeFB DeepLinker
app.post('/api/create', async (req, res) => {
  let {
    targetUrl,
    title,
    description,
    imageUrl,
    voucher,
    subId,
    fomo,
    isAdsMode,
    fbPixel,
    tiktokPixel,
    zaloGroup,
    utmSource,
    utmMedium,
    utmCampaign
  } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đường dẫn Shopee!' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng Đăng nhập tài khoản để tạo link Shopee!' });
  }

  const user = req.user;
  const planInfo = PLANS[user.plan] || PLANS.free;
  const limit = user.linksLimit || planInfo.linkLimit;

  if (user.linksUsed >= limit && user.role !== 'admin') {
    return res.status(403).json({
      error: `Bạn đã sử dụng hết hạn mức (${user.linksUsed}/${limit} link) của gói ${planInfo.name}. Vui lòng nâng cấp gói để tạo thêm link!`,
      limitExceeded: true,
      currentPlan: user.plan
    });
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  targetUrl = attachTrackingParams(targetUrl, {
    subId: subId || (isAdsMode ? 'fb_ads' : ''),
    utmSource: utmSource || (isAdsMode ? 'facebook_ads' : ''),
    utmMedium: utmMedium || (isAdsMode ? 'cpc' : ''),
    utmCampaign: utmCampaign || ''
  });

  const id = generateId('s', 6);
  const newLink = {
    id,
    userId: user.id,
    targetUrl,
    title: title || 'Siêu Sale Shopee - Mua Ngay Giá Tốt',
    description: description || 'Ưu đãi giảm giá cực sốc hôm nay trên Shopee. Bấm để xem chi tiết và nhận quà tặng!',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=630&fit=crop',
    voucher: voucher || '',
    subId: subId || '',
    fomo: fomo !== false,
    isAdsMode: !!isAdsMode,
    fbPixel: fbPixel || '',
    tiktokPixel: tiktokPixel || '',
    zaloGroup: zaloGroup || '',
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  await saveStoredLink(newLink);

  user.linksUsed = (user.linksUsed || 0) + 1;
  await saveUser(user);

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const shortUrl = `${protocol}://${host}/r/${id}`;

  res.json({
    success: true,
    shortUrl,
    id,
    link: newLink,
    quota: {
      used: user.linksUsed,
      limit
    }
  });
});

// Lấy danh sách link cá nhân của user
app.get('/api/links', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const links = await getStoredLinks(req.user.id);
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');

  let list = Object.values(links);
  list = list
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      ...item,
      shortUrl: `${protocol}://${host}/r/${item.id}`
    }));

  res.json({ success: true, list });
});

// Xóa link
app.delete('/api/links/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const success = await deleteStoredLink(req.params.id, req.user.id);
  if (!success) return res.status(404).json({ error: 'Không tìm thấy link hoặc không có quyền xóa' });
  res.json({ success: true, message: 'Đã xóa link thành công' });
});

// Chuyển hướng link rút gọn Shopee
app.get('/r/:id', async (req, res) => {
  const { id } = req.params;
  const linkData = await getStoredLink(id);

  if (!linkData) {
    return res.status(404).send('<h1>404 - Liên kết không tồn tại hoặc đã hết hạn</h1>');
  }

  await incrementLinkClicks(id);

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const currentUrl = `${protocol}://${host}/r/${id}`;

  renderBridgePage(req, res, linkData, currentUrl);
});

// ----------------- MULTI-NICHE AI COPYWRITING ENGINE -----------------

function generateNichePosts(productName, category, priceText, promoText, salePrice, originalPrice) {
  const pNameUpper = productName.toUpperCase();
  const slug = slugify(productName);
  const sPrice = salePrice || 'GIÁ CỰC TỐT';
  const oPrice = originalPrice || 'giá niêm yết';

  if (category === 'thoi_trang') {
    return [
      {
        formula: 'AIDA - Phong Cách & Tôn Dáng Thời Thượng',
        headline: `👗 [OOTD TRENDING] ${pNameUpper} - TÔN DÁNG ĐỈNH CAO, MẶC LÀ ĐẸP!`,
        content: `✨ NÂNG TẦM GU THỜI TRANG HÔM NAY VỚI ITEM KHÔNG THỂ THIẾU TRONG TỦ ĐỒ!
Bạn đang tìm kiếm một set đồ vừa thanh lịch khi đi làm, vừa cuốn hút nổi bật khi dạo phố? ${productName} chính là câu trả lời hoàn hảo!

💎 ƯU ĐIỂM NỔI BẬT:
- Chất vải cao cấp mềm mịn, thoáng mát, co giãn nhẹ không lo bai dão hay xù lông.
- Thiết kế form dáng chuẩn eo, che khuyết điểm cực khéo, tôn đường cong quyến rũ.
- Bảng màu sang chảnh, dễ phối cùng phụ kiện, giày dép cho mọi dịp.

🔥 ƯU ĐÃI BST MỚI DUY NHẤT HÔM NAY:
👉 Mức giá Flash Sale: CHỈ CÒN ${sPrice} (Giá gốc: ${oPrice})
🎁 ĐẶC QUYỀN: ${promoText}
📦 Hỗ trợ đổi size trong 7 ngày nếu không vừa vặn.

👇 ĐỂ LẠI BÌNH LUẬN "CHIỀU CAO + CÂN NẶNG" ĐỂ SHOP TƯ VẤN SIZE VÀ GIỮ DEAL NGAY!`,
        hashtags: `#${slug} #ThoiTrang #OOTD #MixAndMatch #ThoiTrangNu #DoDepMoiNgay #SaleHot`
      },
      {
        formula: 'PAS - Đánh Trúng Nỗi Đau Mặc Xấu / Vải Kém Chất Lượng',
        headline: `⚠️ MỆT MỎI VÌ MUA QUẦN ÁO ONLINE FORM LỆCH, VẢI NÓNG BÍ?`,
        content: `Đã bao nhiêu lần bạn háo hức đặt đồ trên mạng nhưng khi nhận về vải thô ráp, mặc vài lần đã mất form?

Đừng để mất tiền oan nữa! ${productName} được may đo tỉ mỉ từng đường kim mũi chỉ:
✨ Chất liệu tuyển chọn loại 1, thoáng khí suốt ngày dài.
✨ Đứng form chuẩn như ảnh chụp mẫu thật 100%.
✨ Đã có hơn 5.000+ khách hàng feedback ưng ý tuyệt đối.

💥 CHỈ CÒN 20 SUẤT TRỢ GIÁ HÔM NAY:
- Giá ưu đãi: ${priceText}
- Tặng kèm: ${promoText}
- Được kiểm tra chất vải kỹ càng trước khi thanh toán!

👉 NHẤN "GỬI TIN NHẮN" NGAY ĐỂ NHẬN ẢNH THẬT VÀ MÃ FREESHIP 0Đ!`,
        hashtags: `#${slug} #ReviewThoiTrang #VaiDep #FormChuan #ShopUyTin #GiaTot`
      },
      {
        formula: 'FOMO & LIMITED - Sắp Cháy Size Hot Nhất',
        headline: `🚨 CẢNH BÁO: SIZE ĐẸP CỦA ${pNameUpper} SẮP HẾT SẠCH KHO!`,
        content: `Vừa về lô mới sáng nay mà các nàng đã nổ inbox đặt gần hết rồi ạ! Mẫu ${productName} này lên dáng thực sự đỉnh chóp, không sắm đợt này là tiếc hùi hụi luôn.

⏰ Duy nhất trong hôm nay:
- Giảm giá sốc: ${priceText}
- Miễn phí giao hàng: ${promoText}
- Hết đợt này xưởng nghỉ may mẫu này ít nhất 2 tháng nữa đấy ạ!

💃 Chần chừ là hết size ưng ý. Bình luận hoặc nhắn tin ngay giữ suất ưu đãi nhé các nàng 👇`,
        hashtags: `#${slug} #SanSaleThoiTrang #HotTrend #ChayHang #DealHotHomNay`
      }
    ];
  }

  if (category === 'my_pham') {
    return [
      {
        formula: 'AIDA - Dưỡng Da Căng Bóng Chuẩn Chuyên Gia',
        headline: `✨ [BÍ QUYẾT LÀN DA KHÔNG TUỔI] ${pNameUpper} - CĂNG BÓNG RẠNG RỠ!`,
        content: `💖 BÍ QUYẾT CHO LÀN DA MỊN MÀNG TỰ NHIÊN MÀ KHÔNG CẦN MAKEUP DÀY CỘP!
Nếu bạn đang đau đầu vì làn da thâm sạm, thiếu ẩm, xỉn màu và xuất hiện nếp nhăn sớm, hãy bổ sung ngay ${productName} vào chu trình skincare hàng ngày!

🌸 CÔNG NGHỆ & THÀNH PHẦN VÀNG:
- Cấp ẩm đa tầng, phục hồi hàng rào sinh học bảo vệ da suốt 24h.
- Hỗ trợ làm sáng đều màu da, mờ thâm nám và se khít lỗ chân lông rõ rệt sau 14 ngày.
- Kết cấu mỏng nhẹ, thấm nhanh trong 10 giây, không nhờn rít, không bít tắc.
- 100% không cồn, không paraben, an toàn tuyệt đối cho mọi loại da kể cả da nhạy cảm.

🔥 ƯU ĐÃI CHĂM SÓC DA ĐẶC BIỆT:
👉 Giá trải nghiệm hôm nay: ${sPrice} (Giá niêm yết: ${oPrice})
🎁 Quà tặng kèm: ${promoText}
🛡️ Cam kết 100% hàng chính hãng, bồi thường 200% nếu phát hiện hàng giả!

👇 NHẮN TIN TÌNH TRẠNG DA ĐỂ ĐƯỢC CHUYÊN VIÊN TƯ VẤN MIỄN PHÍ!`,
        hashtags: `#${slug} #Skincare #DuongDa #MyPhamChinhHang #DaDep #PhucHoiDa #CangBong`
      },
      {
        formula: 'PAS - Cứu Tinh Làn Da Tổn Thương & Nhạy Cảm',
        headline: `⚠️ DA ĐỔ DẦU NHIỀU, LÊN MỤN VÀ DỄ KÍCH ỨNG? DỪNG NGAY TRƯỚC KHI QUÁ MUỘN!`,
        content: `Càng dùng nhiều loại mỹ phẩm linh tinh, da càng mỏng yếu và dễ breakout? Đó là do màng ẩm tự nhiên của da bạn đang bị tổn thương nghiêm trọng!

${productName} sinh ra để tái sinh làn da của bạn:
🌿 Chiết xuất thiên nhiên lành tính, làm dịu tức thì các vết ửng đỏ, mụn viêm.
🌿 Cân bằng độ pH và độ ẩm chuẩn, kiềm dầu thừa hiệu quả suốt ngày dài.
🌿 Được kiểm nghiệm lâm sàng bởi các chuyên gia da liễu hàng đầu.

🔥 DEAL ĐỘC QUYỀN HÔM NAY:
- Giá trợ giá: ${priceText}
- Khuyến mãi: ${promoText}
- Đổi trả miễn phí nếu có bất kỳ hiện tượng kích ứng nào.

👉 BÌNH LUẬN ĐỂ NHẬN PHÁC ĐỒ CHĂM SÓC DA RIÊNG CHO BẠN!`,
        hashtags: `#${slug} #ChamSocDaNhayCam #TriMun #KiemDau #SkincareRoutine #DepTuNhien`
      },
      {
        formula: 'FOMO & REVIEW - Cơn Sốt Mỹ Phẩm Đang Viral',
        headline: `🌟 HƠN 20.000 CHỊ EM ĐÃ TRẢI NGHIỆM VÀ ĐÁNH GIÁ 5 SAO CHO ${pNameUpper}!`,
        content: `Lướt TikTok hay Facebook mấy hôm nay thấy chị em khen em ${productName} này rần rần! Dùng thử 1 tuần thôi mà nền da thay đổi rõ rệt, mịn màng và căng bóng mướt mát.

Hiện tại kho chỉ còn đúng 30 suất ưu đãi giá sỉ:
💰 Giá chỉ: ${priceText}
🚚 Giao hàng tận nơi: ${promoText}
📦 Đóng gói chống sốc chuyên dụng, bảo quản nhiệt độ chuẩn.

Chăm sóc da là đầu tư cho chính bản thân mình. Đừng để lỡ cơ hội sở hữu em nó với mức giá hời nhất năm nhé!
💬 Nhắn tin ngay để giữ suất quà tặng giới hạn 👇`,
        hashtags: `#${slug} #MyPhamViral #ReviewMyPham #DaDepKhongTyVet #DealMyPham`
      }
    ];
  }

  if (category === 'cong_nghe') {
    return [
      {
        formula: 'AIDA - Đỉnh Cao Hi-Tech & Thông Số Vượt Trội',
        headline: `⚡ [SIÊU PHẨM CÔNG NGHỆ] ${pNameUpper} - HIỆU NĂNG ĐỈNH, TRẢI NGHIỆM CHẤT!`,
        content: `🔥 BỨT PHÁ GIỚI HẠN CÔNG NGHỆ VỚI THIẾT BỊ ĐƯỢC MONG CHỜ NHẤT NĂM!
Nếu bạn là tín đồ công nghệ đòi hỏi tốc độ xử lý mượt mà, độ trễ cực thấp và thiết kế tinh tế đẳng cấp, thì ${productName} chính là lựa chọn số 1!

🚀 THÔNG SỐ VÀ CÔNG NGHỆ ĐỘT PHÁ:
- Chipset thế hệ mới tối ưu hiệu suất, tiết kiệm năng lượng 40%.
- Pin dung lượng cao cho thời gian sử dụng liên tục cả ngày dài, tích hợp sạc nhanh.
- Thiết kế công thái học hiện đại, chất liệu nhôm/kính nguyên khối sang trọng, chống va đập.
- Tương thích hoàn hảo với mọi hệ điều hành iOS, Android, Windows, Mac.

💥 DEAL CÔNG NGHỆ SIÊU SỐC DUY NHẤT HÔM NAY:
👉 Mức giá Flash Sale: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 BỘ QUÀ TẶNG: ${promoText}
🛡️ Bảo hành chính hãng 12 tháng 1-đổi-1 nếu phát sinh lỗi từ nhà sản xuất!

👇 ĐỂ LẠI BÌNH LUẬN HOẶC INBOX ĐỂ NHẬN MÃ GIẢM GIÁ VÀ HƯỚNG DẪN TEST MÁY!`,
        hashtags: `#${slug} #DoChoiCongNghe #HiTech #SmartDevice #CongNgheMoi #SaleCongNghe`
      },
      {
        formula: 'PAS - Tạm Biệt Phụ Kiện Kém Chất Lượng, Giật Lag',
        headline: `⚠️ BỰC MÌNH VÌ PHỤ KIỆN RẺ TIỀN PIN YẾU, DÙNG VÀI TUẦN ĐÃ HỎNG?`,
        content: `Mua đồ công nghệ giá rẻ không rõ nguồn gốc vừa nhanh hỏng, vừa tiềm ẩn nguy cơ chập cháy và làm hỏng cả thiết bị chính của bạn!

Đầu tư một lần cho sự yên tâm dài lâu với ${productName}:
✅ Đạt chứng nhận an toàn quốc tế CE, FCC, RoHS.
✅ Bo mạch thông minh tự ngắt khi quá nhiệt, bảo vệ thiết bị tối đa.
✅ Trải nghiệm âm thanh / kết nối mượt mà không độ trễ khi xem phim, chơi game.

🔥 GIÁ TRỢ GIÁ HÔM NAY:
- Giá cực tốt: ${priceText}
- Khuyến mãi: ${promoText}
- Kiểm tra thiết bị, test tính năng thoải mái trước khi nhận hàng.

👉 NHẤN "GỬI TIN NHẮN" ĐỂ ĐƯỢC HỖ TRỢ KỸ THUẬT VÀ NHẬN VOUCHER!`,
        hashtags: `#${slug} #CongNgheChinhHang #BaoHanhUyTin #PhuKienXin #DoBenCao`
      },
      {
        formula: 'FOMO & UNBOXING - Săn Deal Đồ Chơi Công Nghệ',
        headline: `📦 UNBOXING ${pNameUpper} - CHẤT LƯỢNG VƯỢT XA TẦM GIÁ!`,
        content: `Cầm trên tay em ${productName} mới thấy độ hoàn thiện tinh xảo đến từng chi tiết. Từ cảm giác bấm, độ nhạy cho đến tốc độ phản hồi đều ở mức điểm 10/10.

Kho công nghệ vừa mở thêm đúng 25 suất trợ giá đặc biệt:
💰 Giá sốc hôm nay: ${priceText}
🚚 Giao nhanh hỏa tốc: ${promoText}
🎁 Tặng kèm cáp sạc nhanh / phụ kiện bảo vệ độc quyền.

Nhanh tay trước khi chương trình kết thúc và giá quay lại ban đầu nhé anh em!
💬 Nhắn tin ngay để nhận link đặt hàng chính hãng 👇`,
        hashtags: `#${slug} #Unboxing #DealCongNghe #ReviewCongNghe #SieuPhamHiTech`
      }
    ];
  }

  if (category === 'gia_dung') {
    return [
      {
        formula: 'AIDA - Tiện Ích Thông Minh Giải Phóng Sức Lao Động',
        headline: `🏠 [BẢO BỐI GIA ĐÌNH] ${pNameUpper} - NHÀ CỬA GỌN GÀNG, NẤU DỌN NHÀN TÊNH!`,
        content: `✨ TIẾT KIỆM 70% THỜI GIAN LÀM VIỆC NHÀ ĐỂ TẬN HƯỞNG CUỘC SỐNG!
Sau một ngày làm việc mệt mỏi, ai cũng muốn về nhà thư giãn thay vì phải vật lộn với hàng tá việc nhà. Hãy để ${productName} lo liệu mọi việc giúp bạn!

🌟 CÔNG NĂNG VƯỢT TRỘI:
- Thiết kế thông minh, đa năng, thay thế cho 3-4 thiết bị cồng kềnh truyền thống.
- Tiết kiệm điện năng, vận hành êm ái, bền bỉ theo năm tháng.
- Chất liệu cao cấp chuẩn an toàn thực phẩm/chống cháy nổ, dễ dàng vệ sinh sau khi dùng.
- Tô điểm cho không gian sống thêm phần hiện đại và sang trọng.

🔥 DEAL GIA ĐỤNG HOT NHẤT TUẦN:
👉 Giá Flash Sale: CHỈ CÒN ${sPrice} (Giá gốc: ${oPrice})
🎁 ĐẶC QUYỀN ĐI KÈM: ${promoText}
🛡️ Bảo hành tận nhà 12 tháng, lỗi 1 đổi 1 trong 30 ngày đầu!

👇 ĐỂ LẠI BÌNH LUẬN "ĐẶT HÀNG" ĐỂ NHẬN ƯU ĐÃI VÀ FREESHIP TẬN CỬA!`,
        hashtags: `#${slug} #GiaDungThongMinh #NhaCuaDoiSong #TienIchGiaDinh #MeoVatGiaDinh`
      },
      {
        formula: 'PAS - Giải Quyết Nỗi Mệt Mỏi Việc Nhà',
        headline: `⚠️ QUÁ MỆT MỎI VÌ DỌN DẸP BẾP NÚC LỈNH KỈNH MỖI NGÀY?`,
        content: `Phụ nữ hiện đại vừa phải đi làm vừa phải cáng đáng việc nhà, nếu không có công cụ hỗ trợ thì thực sự kiệt sức!

Hãy để ${productName} trở thành trợ thủ đắc lực trong ngôi nhà bạn:
✅ Vận hành tự động chỉ với 1 nút bấm, người già hay trẻ nhỏ đều dùng được.
✅ Nhanh chóng, sạch sẽ, giải phóng hoàn toàn đôi tay của bạn.
✅ Được hàng ngàn gia đình hiện đại tin dùng và chia sẻ rầm rộ.

🔥 ƯU ĐÃI HÔM NAY:
- Giá cực tốt: ${priceText}
- Quà tặng: ${promoText}
- Kiểm tra hàng và thử máy trực tiếp trước khi nhận.

👉 NHẮN TIN CHO SHOP ĐỂ NHẬN VIDEO HƯỚNG DẪN VÀ MÃ KHUYẾN MÃI!`,
        hashtags: `#${slug} #GiaiPhongSucLaoDong #NoiTroThongMinh #ChamSocToAm #DoGiaDung`
      },
      {
        formula: 'FOMO & REVIEW - Cơn Sốt Đồ Gia Dụng Tiện Ích',
        headline: `🔥 ĐỒ GIA DỤNG ĐÁNG MUA NHẤT NĂM NAY - ${pNameUpper}!`,
        content: `Đúng là biết em ${productName} này sớm hơn thì cuộc sống đã nhàn hơn biết bao nhiêu rồi cả nhà ạ! Ai vào nhà chơi cũng hỏi mua ở đâu mà tiện thế.

Hôm nay shop xả lô hàng xuất khẩu với mức giá siêu hời:
💰 Giá ưu đãi: ${priceText}
🚚 Giao hàng toàn quốc: ${promoText}
📦 Đầy đủ phiếu bảo hành và hướng dẫn tiếng Việt.

Chỉ còn 15 chiếc cuối cùng trong kho. Đặt sớm để không bỏ lỡ deal hời cho tổ ấm nhé!
💬 Nhắn tin ngay để giữ suất giao hàng hôm nay 👇`,
        hashtags: `#${slug} #ReviewGiaDung #GiaDungTienIch #MuaSamGiaDinh #DealGiaDung`
      }
    ];
  }

  if (category === 'me_be') {
    return [
      {
        formula: 'AIDA - Dành Trọn Tình Yêu An Toàn Cho Con',
        headline: `🍼 [DÀNH RIÊNG CHO BÉ YÊU] ${pNameUpper} - AN TOÀN TUYỆT ĐỐI, MẸ AN TÂM!`,
        content: `💖 MANG ĐẾN CHO CON SỰ CHĂM SÓC DỊU NHẸ VÀ TOÀN DIỆN NHẤT!
Là cha mẹ, điều quan trọng nhất luôn là sức khỏe và sự an toàn của con. ${productName} được nghiên cứu chuyên biệt để đồng hành cùng từng cột mốc phát triển của bé!

🌱 ĐẶC ĐIỂM NỔI BẬT:
- 100% chất liệu Organic cao cấp, không chứa BPA hay hóa chất độc hại, thân thiện với làn da nhạy cảm của bé.
- Thiết kế thông thái, hỗ trợ bé phát triển tự nhiên, ăn ngon ngủ ngoan hơn mỗi ngày.
- Dễ dàng vệ sinh, tiệt trùng, tiện lợi cho mẹ khi mang theo ra ngoài.

🎁 ƯU ĐÃI ĐẶC QUYỀN MẸ VÀ BÉ:
👉 Mức giá trợ giá: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 QUÀ TẶNG KÈM: ${promoText}
🛡️ Cam kết đạt chuẩn chứng nhận an toàn cho trẻ sơ sinh và trẻ nhỏ.

👇 BÌNH LUẬN TUỔI CỦA BÉ ĐỂ SHOP TƯ VẤN SẢN PHẨM PHÙ HỢP NHẤT NHÉ MẸ!`,
        hashtags: `#${slug} #MeVaBe #ChamSocBe #MeBimSua #DoDungChoBe #AnToanChoTre`
      },
      {
        formula: 'PAS - Thấu Hiểu Nỗi Lòng Mẹ Bỉm Chăm Con Vất Vả',
        headline: `⚠️ MẸ MẤT NGỦ, KIỆT SỨC VÌ CHĂM CON QUÁ VẤT VẢ MỖI NGÀY?`,
        content: `Chăm con nhỏ chưa bao giờ là điều dễ dàng, nhất là những lúc bé quấy khóc, lười ăn hay khó ngủ...

${productName} sẽ san sẻ bớt gánh nặng chăm con cùng mẹ:
🧸 Giúp mẹ chăm bé nhàn tênh, khoa học và đúng cách hơn.
🧸 Bé hợp tác ngoan ngoãn, mẹ có thêm thời gian nghỉ ngơi phục hồi sức khỏe.
🧸 Được cộng đồng hơn 30.000+ mẹ bỉm sữa thông thái tin cậy lựa chọn.

🔥 DEAL YÊU THƯƠNG HÔM NAY:
- Giá cực tốt: ${priceText}
- Tặng kèm: ${promoText}
- Đổi mới nếu có bất kỳ lỗi nào từ nhà sản xuất.

👉 NHẮN TIN NGAY CHO SHOP ĐỂ NHẬN CẨM NANG CHĂM BÉ MIỄN PHÍ!`,
        hashtags: `#${slug} #KinhNghiemNuoiCon #MeBimThongThai #SanSeCungMe #YeuConDungCach`
      },
      {
        formula: 'FOMO & MẸ BỈM REVIEW - Lan Tỏa Mẹo Chăm Con',
        headline: `🎉 BẢO BỐI CHĂM BÉ ĐƯỢC CÁC MẸ BỈM TRUYỀN TAI NHAU NHIỀU NHẤT!`,
        content: `Mẹ nào đang trong giai đoạn chăm bé thì nhất định phải tậu ngay em ${productName} này nhé, thật sự là "cứu tinh" của mẹ luôn đấy ạ!

Đợt khuyến mãi tri ân tháng này chỉ còn lại vài combo cuối cùng:
💰 Giá ưu đãi: ${priceText}
🚚 Giao nhanh tận nhà: ${promoText}
📦 Đóng gói cẩn thận, bọc chống bụi bẩn tuyệt đối.

Nhanh tay giữ suất để dành những điều tốt đẹp nhất cho thiên thần nhỏ của bạn nhé mẹ ơi!
💬 Nhắn tin cho shop ngay bên dưới 👇`,
        hashtags: `#${slug} #NuoiConNhan #BaoBoiCuaMe #DealMeBe #MeBimSanSale`
      }
    ];
  }

  if (category === 'suc_khoe') {
    return [
      {
        formula: 'AIDA - Dinh Dưỡng Vàng & Sức Khỏe Toàn Diện',
        headline: `🌿 [BẢO VỆ SỨC KHỎE CHỦ ĐỘNG] ${pNameUpper} - NĂNG LƯỢNG TRÀN ĐẦY MỖI NGÀY!`,
        content: `💪 SỨC KHỎE LÀ TÀI SẢN VÔ GIÁ - ĐỪNG ĐỂ ĐẾN KHI CƠ THỂ LÊN TIẾNG MỚI BẮT ĐẦU CHĂM SÓC!
Nếu bạn thường xuyên cảm thấy mệt mỏi, uể oải, suy giảm đề kháng sau những ngày làm việc căng thẳng, ${productName} chính là người bạn đồng hành không thể thiếu!

🌱 THÀNH PHẦN & CÔNG DỤNG VƯỢT TRỘI:
- Chiết xuất tự nhiên 100%, bổ sung dưỡng chất và vi khoáng thiết yếu cho cơ thể.
- Hỗ trợ thanh lọc, tăng cường miễn dịch, giúp ăn ngon miệng và ngủ sâu giấc.
- Quy trình sản xuất đạt chuẩn GMP quốc tế và chứng nhận an toàn thực phẩm của Bộ Y Tế.
- Dạng dùng tiện lợi, dễ hấp thu tối đa vào cơ thể.

🔥 ƯU ĐÃI CHĂM SÓC SỨC KHỎE DUY NHẤT HÔM NAY:
👉 Mức giá trải nghiệm: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 ĐẶC QUYỀN ĐI KÈM: ${promoText}
🛡️ Cam kết hàng chính hãng 100%, bồi thường 500% nếu phát hiện hàng nhái!

👇 ĐỂ LẠI BÌNH LUẬN ĐỂ ĐƯỢC DƯỢC SĨ TƯ VẤN LIỆU TRÌNH PHÙ HỢP NHẤT CHO BẠN!`,
        hashtags: `#${slug} #SucKhoe #ThucPhamChucNang #DinhDuongVang #TangDeKhang #SongKhoeMoiNgay`
      },
      {
        formula: 'PAS - Đánh Thức Nỗi Đau Cơ Thể Suy Nhược & Stress',
        headline: `⚠️ THƯỜNG XUYÊN MẤT NGỦ, ĐAU MỎI VÀ ĐỀ KHÁNG KÉM? CƠ THỂ BẠN ĐANG CẢNH BÁO!`,
        content: `Cuộc sống bận rộn với áp lực công việc khiến chúng ta ăn uống thất thường, thiếu chất và lão hóa nhanh hơn mỗi ngày!

Đừng chủ quan với sức khỏe của chính mình và người thân. Hãy bổ sung ${productName} ngay hôm nay:
✅ Phục hồi thể lực và đào thải độc tố tích tụ lâu ngày.
✅ Tăng cường tuần hoàn máu, tinh thần sảng khoái, tập trung làm việc hiệu quả.
✅ Được hàng chục ngàn khách hàng tin dùng và phản hồi sức khỏe cải thiện rõ rệt sau 2 tuần.

🔥 DEAL ĐỘC QUYỀN TRÊN BÀI VIẾT NÀY:
- Mức giá trợ giá: ${priceText}
- Quà tặng sức khỏe: ${promoText}
- Đóng gói cẩn thận, miễn phí giao tận nhà.

👉 NHẤN "GỬI TIN NHẮN" HOẶC ĐỂ LẠI SỐ ĐIỆN THOẠI ĐỂ ĐƯỢC CHUYÊN VIÊN TƯ VẤN MIỄN PHÍ!`,
        hashtags: `#${slug} #PhucHoiSucKhoe #ThanhLocCoThe #TangCuongMienDich #KhoeDepMoiNgay`
      },
      {
        formula: 'FOMO & CHĂM SÓC GIA ĐÌNH - Món Quà Ý Nghĩa Nhất',
        headline: `🎁 MÓN QUÀ SỨC KHỎE Ý NGHĨA NHẤT DÀNH TẶNG BẢN THÂN VÀ CHA MẸ - ${pNameUpper}!`,
        content: `Không có món quà nào quý giá hơn sự khỏe mạnh của những người thân yêu. ${productName} chính là sự lựa chọn chu đáo và tinh tế nhất!

Shop đang có chương trình trợ giá tri ân sức khỏe cộng đồng:
💰 Giá ưu đãi hôm nay: ${priceText}
🚚 Giao hàng hỏa tốc: ${promoText}
📦 Đầy đủ tem chống giả và mã QR kiểm tra nguồn gốc xuất xứ.

Chỉ còn đúng 20 hộp cuối cùng cho mức giá ưu đãi này. Hãy nhanh tay đặt ngay trước khi hết hàng nhé cả nhà!
💬 Nhắn tin cho shop ngay bên dưới 👇`,
        hashtags: `#${slug} #MonQuaSucKhoe #BaoHieuChaMe #DealSucKhoe #YeuThuongGiaDinh`
      }
    ];
  }

  if (category === 'am_thuc') {
    return [
      {
        formula: 'AIDA - Hương Vị Đậm Đà & Kích Thích Vị Giác',
        headline: `🤤 [MÓN NGON KHÓ CƯỠNG] ${pNameUpper} - THƠM NGON CHUẨN VỊ, CÀNG ĂN CÀNG MÊ!`,
        content: `✨ TÍN ĐỒ ẨM THỰC NHẤT ĐỊNH KHÔNG THỂ BỎ QUA SIÊU PHẨM NÀY!
Chỉ cần mở nắp thôi là hương thơm nức mũi đã lan tỏa, cắn một miếng cảm nhận ngay vị ngon đậm đà tan chảy trên đầu lưỡi! ${productName} sẽ làm bùng nổ mọi giác quan của bạn!

🌟 ĐIỂM CỘNG ĐỘC QUYỀN:
- Nguyên liệu tươi ngon thượng hạng tuyển chọn kỹ lưỡng, quy trình chế biến khép kín an toàn vệ sinh 100%.
- Công thức nêm nếm gia truyền chuẩn vị, cay cay ngọt ngọt đậm đà khó quên.
- Đóng hộp/túi zip tiện lợi, giữ trọn độ giòn thơm và dễ dàng mang theo khi đi làm, đi chơi.

🔥 DEAL ĂN VẶT CỰC ĐÃ DUY NHẤT HÔM NAY:
👉 Mức giá siêu hời: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 ĐẶC QUYỀN ĐI KÈM: ${promoText}
🚚 Giao hàng siêu nhanh toàn quốc, bảo quản tươi ngon tận tay!

👇 BÌNH LUẬN "ĐẶT NGAY" HOẶC NHẮN TIN ĐỂ SHOP SHIP HỎA TỐC ĂN LIỀN NÀO!`,
        hashtags: `#${slug} #AnVatNgon #MonNgonMoiNgay #AmThucViet #DoAnVat #GiaoHangNhanh`
      },
      {
        formula: 'PAS - Cứu Tinh Cơn Đói Nửa Đêm & Giờ Nghỉ Trưa',
        headline: `⚠️ ĐANG ĐÓI CỒN CÀO MÀ KHÔNG BIẾT ĂN GÌ VỪA NGON VỪA AN TOÀN?`,
        content: `Những lúc xem phim đêm khuya hay giờ xế chiều ở văn phòng, cơn thèm ăn ập đến mà ăn đồ ngoài lại sợ dầu mỡ, mất vệ sinh!

Giải pháp cứu cánh tức thì chuẩn ngon - sạch - đã miệng chính là ${productName}:
🍢 Thỏa mãn cơn thèm ngay tắp lự, ăn hoài không ngán.
🍢 Chuẩn chứng nhận ATVSTP, nói KHÔNG với chất bảo quản độc hại.
🍢 Đồ ăn luôn là mẻ mới trong ngày, cam kết thơm giòn rụm!

🔥 ƯU ĐÃI HÔM NAY:
- Giá cực tốt: ${priceText}
- Khuyến mãi: ${promoText}
- Không ngon xin hoàn tiền 100%!

👉 BẤM "GỬI TIN NHẮN" NGAY ĐỂ LÊN ĐƠN SHIP TẬN BÀN LÀM VIỆC NHÉ!`,
        hashtags: `#${slug} #AnVatVanPhong #AnDem #CuuDoi #NgonBaChay #FoodLover`
      },
      {
        formula: 'FOMO & MẺ MỚI RA LÒ - Săn Kẻo Hết',
        headline: `🔥 MẺ ${pNameUpper} MỚI RA LÒ NÓNG HỔI - SỐ LƯỢNG CÓ HẠN!`,
        content: `Bếp vừa làm xong mẻ mới tinh, thơm nức một góc phố luôn cả nhà ơi! Khách quen đã gom gần nửa lò rồi, chỉ còn lại ít phần cho khách nhanh tay nhất hôm nay!

💰 Giá ưu đãi: ${priceText}
🚚 Khuyến mãi: ${promoText}
📦 Hút chân không sạch sẽ, hạn sử dụng rõ ràng.

Đừng để đến tối hết hàng lại tiếc hùi hụi nhé. Bình luận số lượng để bếp giữ phần cho bạn ngay bây giờ!
💬 Nhắn tin cho shop ngay 👇`,
        hashtags: `#${slug} #MeMoiRaLo #AnVatHot #Foodie #GiaTotHomNay`
      }
    ];
  }

  if (category === 'sach_giaoduc') {
    return [
      {
        formula: 'AIDA - Nâng Tầm Tư Duy & Bứt Phá Thành Công',
        headline: `📚 [TRI THỨC THAY ĐỔI CUỘC ĐỜI] ${pNameUpper} - BƯỚC NGOẶT CHO SỰ NGHIỆP CỦA BẠN!`,
        content: `💡 KHOẢN ĐẦU TƯ SINH LỜI NHẤT CHÍNH LÀ ĐẦU TƯ VÀO BẢN THÂN!
Bạn có đang cảm thấy mình giậm chân tại chỗ, thiếu động lực hoặc bế tắc trong công việc và tài chính? ${productName} chính là chiếc chìa khóa khai mở tiềm năng vô hạn bên trong bạn!

📖 NỘI DUNG ĐẶC BIỆT CỦA TÁC PHẨM:
- Chắt lọc tinh hoa từ các chuyên gia hàng đầu, bài học thực chiến ứng dụng được ngay vào thực tế.
- Hệ thống hóa tư duy giải quyết vấn đề, nâng cao hiệu suất làm việc và làm chủ tài chính.
- Lối hành văn mạch lạc, hấp dẫn, dễ hiểu và truyền cảm hứng mạnh mẽ.
- Bìa in ấn cao cấp, giấy chống lóa mỏi mắt, phù hợp đọc và làm quà tặng ý nghĩa.

🔥 ƯU ĐÃI TRI THỨC ĐẶC BIỆT HÔM NAY:
👉 Mức giá trợ giá: CHỈ CÒN ${sPrice} (Giá bìa: ${oPrice})
🎁 ĐẶC QUYỀN ĐI KÈM: ${promoText}
📦 Tặng kèm bookmark độc quyền + Ebook tài liệu bổ trợ giá trị!

👇 ĐỂ LẠI BÌNH LUẬN "ĐỌC SÁCH" HOẶC INBOX ĐỂ NHẬN SÁCH CÙNG QUÀ TẶNG NGAY HÔM NAY!`,
        hashtags: `#${slug} #SachHay #PhatTrienBanThan #DocSachMoiNgay #TuDuyThanhCong #GiaoDuc`
      },
      {
        formula: 'PAS - Thoát Khỏi Vòng Lặp Bế Tắc & Mông Lung',
        headline: `⚠️ MỆT MỎI VÌ MÔNG LUNG, THIẾU ĐỊNH HƯỚNG VÀ BỎ LỠ NHIỀU CƠ HỘI?`,
        content: `Nếu bạn cứ tiếp tục làm theo cách cũ, bạn sẽ chỉ nhận lại kết quả cũ. Đã đến lúc nâng cấp tư duy và hành động khác đi!

${productName} đã thay đổi tư duy và cuộc đời của hơn 50.000+ độc giả:
🎯 Rõ ràng lộ trình từng bước để đạt được mục tiêu ngắn hạn và dài hạn.
🎯 Khắc phục sự trì hoãn, rèn luyện kỷ luật thép và sự tự tin vững vàng.
🎯 Nhìn thấu các quy luật kinh doanh và tâm lý con người trong thế giới hiện đại.

🔥 DEAL TRI THỨC HÔM NAY:
- Giá cực tốt: ${priceText}
- Khuyến mãi: ${promoText}
- Sách thật 100% từ nhà xuất bản, đền tiền gấp 10 lần nếu sách lậu!

👉 NHẤN "GỬI TIN NHẮN" ĐỂ ĐƯỢC GIAO TẬN TAY CUỐN SÁCH GỐI ĐẦU GIƯỜNG NÀY!`,
        hashtags: `#${slug} #SachGoiDauGiuong #ThauHieuBanThan #DinhHuongTuongLai #TriThucLaSucManh`
      },
      {
        formula: 'FOMO & BEST-SELLER - Tác Phẩm Đang Được Săn Lùng',
        headline: `🌟 CUỐN SÁCH BÁN CHẠY NHẤT THÁNG - TÁI BẢN LẦN THỨ 10: ${pNameUpper}!`,
        content: `Cộng đồng người đọc và các doanh nhân trẻ đang chia sẻ rầm rộ về những bài học đắt giá trong cuốn ${productName} này! Đọc xong mới hiểu tại sao cuốn sách lại được săn đón đến vậy.

Kho phát hành chỉ còn đúng 30 bản có chữ ký tác giả/quà tặng:
💰 Giá ưu đãi: ${priceText}
🚚 Giao hàng toàn quốc: ${promoText}
📦 Đóng bọc chống sốc kỹ càng bảo vệ góc sách nguyên vẹn.

Đừng bỏ lỡ cơ hội nâng cấp tư duy với mức giá tốt nhất trong năm!
💬 Nhắn tin cho shop ngay bên dưới 👇`,
        hashtags: `#${slug} #BestSeller #SachKinhDoanh #TuDuyDotPha #SachMoiMoiNgay`
      }
    ];
  }

  if (category === 'xe_co') {
    return [
      {
        formula: 'AIDA - Xế Cưng Đẳng Cấp & Vận Hành An Toàn',
        headline: `🚗 [NÂNG CẤP XẾ CƯNG] ${pNameUpper} - ĐẲNG CẤP, TIỆN ÍCH, AN TOÀN TRÊN MỌI CUNG ĐƯỜNG!`,
        content: `✨ TRẢI NGHIỆM LÁI XE HOÀN TOÀN MỚI CHO BÁC TÀI HIỆN ĐẠI!
Chiếc xe không chỉ là phương tiện di chuyển, mà còn là người bạn đồng hành che mưa che nắng. Hãy trang bị ngay ${productName} để nâng tầm tiện nghi và an toàn tuyệt đối!

🔧 TÍNH NĂNG VƯỢT TRỘI:
- Thiết kế hiện đại, gia công chính xác, lắp đặt chuẩn zin không cần độ chế hay cắt dây điện.
- Chất liệu cao cấp chịu nhiệt, chống nước và bền bỉ trong điều kiện thời tiết khắc nghiệt.
- Giúp xế yêu luôn sạch sẽ, sang trọng và tiện lợi hơn trong mọi hành trình dài.
- Tương thích với hầu hết các dòng xe phổ biến trên thị trường.

🔥 DEAL PHỤ KIỆN XE CỰC KHỦNG HÔM NAY:
👉 Mức giá Flash Sale: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 BỘ QUÀ TẶNG KÈM: ${promoText}
🛡️ Bảo hành đổi mới 12 tháng, kiểm tra hàng và thử vừa vặn trên xe mới thanh toán!

👇 BÌNH LUẬN "TÊN DÒNG XE + ĐỜI XE" ĐỂ SHOP TƯ VẤN BẢN CHUẨN NHẤT CHO BÁC TÀI!`,
        hashtags: `#${slug} #DoXe #PhuKienOTo #PhuKienXeMay #ChamSocXe #XeYeu #LaiXeAnToan`
      },
      {
        formula: 'PAS - Giải Quyết Phiền Toái Khi Lái Xe & Bảo Vệ Xe',
        headline: `⚠️ KHÓ CHỊU VÌ XE BẨN, TRẦY XƯỚC HOẶC THIẾU TIỆN NGHI KHI ĐI XA?`,
        content: `Lái xe đường dài mà gặp phải những bất tiện vụn vặt vừa gây bực mình vừa dễ mất tập trung khi lái xe!

${productName} sẽ giải quyết triệt để mọi nỗi lo của bạn:
🛡️ Bảo vệ nội ngoại thất xe luôn như mới, chống trầy xước và hao mòn.
🛡️ Mang lại sự thoải mái, tiện nghi tối đa cho cả gia đình trên mỗi chuyến đi.
🛡️ Đã được hơn 15.000+ anh em tài xế trên toàn quốc tin tưởng lựa chọn.

🔥 ƯU ĐÃI TRỢ GIÁ HÔM NAY:
- Giá cực tốt: ${priceText}
- Khuyến mãi: ${promoText}
- Lỗi 1 đổi 1 tận nơi nếu không vừa ý!

👉 NHẤN "GỬI TIN NHẮN" NGAY ĐỂ NHẬN HƯỚNG DẪN LẮP ĐẶT VÀ MÃ FREESHIP!`,
        hashtags: `#${slug} #BaoVeXe #DoChoiXe #NoiThatOTo #KinhNghiemLaiXe #XeDep`
      },
      {
        formula: 'FOMO & BÁC TÀI REVIEW - Xả Kho Phụ Kiện',
        headline: `🔥 ĐỒ CHƠI XE ĐƯỢC ANH EM HỘI XE KHEN NỨC NỞ - ${pNameUpper}!`,
        content: `Lắp em ${productName} này lên xe là thấy khác hẳn luôn các bác ạ! Nhìn xe vừa sang vừa tiện, bạn bè lên xe ai cũng trầm trồ hỏi địa chỉ mua.

Kho phụ kiện đang xả lô cuối cùng với mức giá đại lý:
💰 Giá ưu đãi hôm nay: ${priceText}
🚚 Giao nhanh hỏa tốc: ${promoText}
📦 Đầy đủ phụ kiện kèm video hướng dẫn tự lắp tại nhà trong 5 phút.

Chỉ còn 18 bộ cuối cùng. Đặt ngay để nâng cấp xế cưng chuẩn đẹp nhé các bác!
💬 Nhắn tin cho shop ngay bên dưới 👇`,
        hashtags: `#${slug} #HoiLaiXe #ReviewXe #DealPhuKienXe #XeDepXeSang`
      }
    ];
  }

  // Fallback tổng quát cho các ngành khác (khac)
  return [
    {
      formula: 'AIDA (Gây Chú Ý - Tò Mò - Khao Khát - Mua Ngay)',
      headline: `🔥 [SIÊU ƯU ĐÃI] ${pNameUpper} CHÍNH HÃNG - DUY NHẤT HÔM NAY!`,
      content: `💥 CHỚP CƠ HỘI SĂN DEAL TỐT NHẤT THÁNG!
Bạn đang tìm kiếm ${productName} chuẩn xịn, bảo hành uy tín với mức giá hời nhất? Đừng lướt qua bài viết này!

👉 Giá Flash Sale hôm nay: CHỈ CÒN ${sPrice} (Giá niêm yết: ${oPrice})
🎁 ĐẶC QUYỀN ĐI KÈM HÔM NAY:
- ${promoText}
- Cam kết 100% hàng chính hãng, bảo hành dài hạn.
- Kiểm tra hàng thoải mái trước khi nhận, ưng ý mới thanh toán!

⏳ Số lượng ưu đãi chỉ còn 25 suất cuối cùng cho những ai để lại bình luận hoặc nhắn tin sớm nhất.
👇 BÌNH LUẬN "MUA NGAY" HOẶC NHẮN TIN TRỰC TIẾP ĐỂ GIỮ SUẤT GIẢM GIÁ!`,
      hashtags: `#${slug} #ChinhHang #SaleSoc #Freeship #DealHotHomNay`
    },
    {
      formula: 'PAS (Đánh Trúng Nỗi Đau - Đưa Giải Pháp Hoàn Hảo)',
      headline: `⚠️ ĐỪNG MUA ${pNameUpper} NẾU BẠN CHƯA BIẾT ĐIỀU NÀY!`,
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
      hashtags: `#${slug} #ReviewChatLuong #GiaiPhap #UyTin #MuaSamThongMinh`
    },
    {
      formula: 'FOMO & STORYTELLING (Kích Thích Hành Động Nhanh)',
      headline: `🚨 CẢNH BÁO: CHỈ CÒN VÀI GIỜ NỮA LÀ KẾT THÚC ĐỢT GIẢM GIÁ KHỦNG!`,
      content: `Vừa trải nghiệm em ${productName} mà mê thực sự cả nhà ơi! Đúng là "tiền nào của nấy", chất lượng vượt xa mong đợi.

Kho vừa báo chỉ còn duy nhất 20 chiếc cuối cùng để kết thúc đợt khuyến mãi này:
💰 Giá ưu đãi: ${priceText}
🚚 Giao hàng hỏa tốc - ${promoText}
📦 Đóng gói cẩn thận 3 lớp, bảo hành chính hãng dài hạn.

Bỏ lỡ hôm nay là ngày mai giá sẽ quay về mức cũ đấy ạ. Nhanh tay kẻo hết suất ưu đãi!
💬 Nhắn tin ngay cho shop hoặc để lại bình luận bên dưới để nhận mã Freeship 0đ nhé cả nhà 👇`,
      hashtags: `#${slug} #DealHot #GiaTotMoiNgay #SanSale #SieuPham`
    }
  ];
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

  // Thuật toán AI Copywriting sinh 3 góc nhìn bài viết quảng cáo chuyên sâu theo từng lĩnh vực riêng biệt
  const posts = generateNichePosts(productName, category, priceText, promoText, salePrice, originalPrice);

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

// ----------------- 4. MODULE 3: HỆ THỐNG AUTO REPLY COMMENT & AUTO INBOX THỰC TẾ -----------------

// Động cơ Quét & Phản hồi bình luận tự động trên Facebook Fanpage
async function scanAndReplyPageComments(userId, page, forcedConfig = null) {
  if (!page || !page.accessToken || page.accessToken.trim().length < 20) {
    return { success: false, error: 'Fanpage chưa có Access Token hợp lệ' };
  }

  const token = page.accessToken.trim();
  const pageId = page.id;
  const config = forcedConfig || (await getAutoReplyConfig(userId));

  if (config.enabled === false) {
    return { success: false, message: 'Tính năng Auto Reply đang tạm tắt trong cấu hình' };
  }

  const summary = {
    checkedPosts: 0,
    newCommentsFound: 0,
    likedCount: 0,
    hiddenCount: 0,
    repliedCount: 0,
    inboxedCount: 0,
    processedItems: [],
    permissionError: null
  };

  try {
    // 1. Lấy danh sách 15 bài viết mới nhất trên Fanpage
    const postsRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time&limit=15&access_token=${token}`);
    const postsData = await postsRes.json();

    if (postsData.error) {
      if (postsData.error.code === 190) {
        summary.permissionError = 'Mã Token của Fanpage đã hết hạn (Session Expired - Lỗi #190). Vui lòng cập nhật Token mới trong cài đặt Fanpage để tiếp tục tự động trả lời!';
      } else if (postsData.error.code === 200) {
        summary.permissionError = 'Meta API: Cần thêm quyền "pages_read_user_content" để đọc nội dung bình luận của khách.';
      }
      return { success: false, error: summary.permissionError || postsData.error.message, code: postsData.error.code, summary };
    }

    const posts = Array.isArray(postsData.data) ? postsData.data : [];
    summary.checkedPosts = posts.length;

    const repliedHistory = await getRepliedCommentIds(userId);
    const existingLogs = await getAutoReplyLogs(userId);
    const alreadyInboxedCommentIds = new Set(existingLogs.filter(l => l.didInbox).map(l => l.commentId));
    const repliedIds = new Set(repliedHistory);

    for (const post of posts) {
      // 2. Lấy danh sách bình luận trên bài viết kèm các câu trả lời con
      const commentsRes = await fetch(`https://graph.facebook.com/v19.0/${post.id}/comments?fields=id,from,message,created_time,can_reply_privately,comments{id,from}&limit=50&access_token=${token}`);
      const commentsData = await commentsRes.json();

      if (commentsData.error) {
        if (commentsData.error.code === 190) {
          summary.permissionError = 'Mã Token của Fanpage đã hết hạn (Session Expired - #190). Vui lòng dán Token mới!';
        } else if (commentsData.error.code === 200) {
          summary.permissionError = 'Token Meta đang thiếu quyền "pages_read_user_content" để đọc bình luận của khách hàng.';
        }
        continue;
      }

      const comments = Array.isArray(commentsData.data) ? commentsData.data : [];

      for (const comment of comments) {
        // Bỏ qua nếu là bình luận của chính Fanpage
        if (comment.from && (comment.from.id === pageId || comment.from.name === page.name)) {
          continue;
        }

        // Kiểm tra xem trong các câu trả lời con đã có Fanpage trả lời chưa
        const subComments = comment.comments?.data || [];
        const alreadyAnsweredOnFb = subComments.some(sub => sub.from && (sub.from.id === pageId || sub.from.name === page.name));
        const needsCommentReply = !alreadyAnsweredOnFb;
        const needsInbox = !alreadyInboxedCommentIds.has(comment.id);

        // Chỉ bỏ qua nếu CẢ 2 việc (trả lời comment & gửi messenger) đều đã hoàn tất
        if (!needsCommentReply && !needsInbox) {
          continue;
        }

        summary.newCommentsFound++;

        const customerName = comment.from?.name || 'bạn';
        const commentMsg = (comment.message || '').trim();
        const hasPhone = containsPhoneNumber(commentMsg);

        let didLike = false;
        let didHide = false;
        let didReplyComment = false;
        let replyError = null;
        let replyText = null;
        let didInbox = false;
        let inboxError = null;

        // A. Tự động LIKE bình luận
        if (config.autoLike !== false) {
          try {
            const likeRes = await fetch(`https://graph.facebook.com/v19.0/${comment.id}/likes?access_token=${encodeURIComponent(token)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const likeData = await likeRes.json();
            if (likeData && likeData.success) {
              didLike = true;
              summary.likedCount++;
            }
          } catch (e) {}
        }

        // B. Tự động ẨN bình luận nếu có số điện thoại (Chống đối thủ cướp khách)
        if (config.hidePhone !== false && hasPhone) {
          const hideSuccess = await hideFacebookComment(comment.id, token);
          if (hideSuccess) {
            didHide = true;
            summary.hiddenCount++;
          }
        }

        // C. Tự động TRẢ LỜI bình luận công khai
        const templates = Array.isArray(config.replyTemplates) && config.replyTemplates.length > 0
          ? config.replyTemplates
          : [
              `Dạ em chào ${customerName} ạ! Em đã gửi thông tin ưu đãi và quà tặng qua tin nhắn riêng cho mình rồi đó ạ, ${customerName} kiểm tra hộp thư giúp em nhé! ❤️`,
              `Chào ${customerName} ơi, shop đang có Flash Sale giá sốc hôm nay ạ. Shop đã nhắn tin tư vấn trực tiếp cho ${customerName} rồi nhé 🥰`
            ];
        
        let template = templates[Math.floor(Math.random() * templates.length)];
        replyText = template
          .replace(/\{name\}|\{\{name\}\}|\[NAME\]/gi, customerName)
          .replace(/\{page\}|\{\{page\}\}/gi, page.name);

        if (needsCommentReply) {
          try {
            const replyRes = await fetch(`https://graph.facebook.com/v19.0/${comment.id}/comments?access_token=${encodeURIComponent(token)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: replyText })
            });
            const replyData = await replyRes.json();
            if (replyData && (replyData.id || replyData.post_id)) {
              didReplyComment = true;
              summary.repliedCount++;
            } else if (replyData && replyData.error) {
              console.error('Lỗi Graph API Comment Reply:', replyData.error);
              if (replyData.error.code === 200) {
                summary.permissionError = 'Meta API: Cần cấp thêm quyền "pages_manage_engagement" trong Graph API Explorer để Fanpage có thể đăng bình luận công khai trả lời khách hàng.';
                replyError = 'Thiếu quyền pages_manage_engagement (#200)';
              } else if (replyData.error.code === 190) {
                summary.permissionError = 'Mã Token của Fanpage đã hết hạn (Session Expired - #190)';
                replyError = 'Token hết hạn (#190)';
              } else {
                replyError = replyData.error.message || `Lỗi Meta (#${replyData.error.code})`;
              }
            }
          } catch (e) {
            console.error('Lỗi fetch comment reply:', e.message);
            replyError = e.message;
          }
        } else {
          didReplyComment = true;
        }

        // D. Tự động gửi tin nhắn riêng Messenger ĐỒNG THỜI (Private Reply to Comment)
        let inboxBody = (config.inboxMessage && config.inboxMessage.trim().length > 0)
          ? config.inboxMessage
          : "Dạ em chào {name} ạ! Cảm ơn {name} đã quan tâm đến bài viết của shop. Shop gửi thông tin ưu đãi và link đặt hàng trực tiếp cho mình đây ạ! 🥰";

        inboxBody = inboxBody
          .replace(/\{name\}|\{\{name\}\}|\[NAME\]/gi, customerName)
          .replace(/\{page\}|\{\{page\}\}/gi, page.name);

        if (page.affiliateLink) {
          inboxBody = inboxBody.replace(/\[LINK_DAT_HANG\]|\[LINK_SAN_PHAM\]|\[LINK\]/gi, page.affiliateLink);
        }

        if (needsInbox && comment.can_reply_privately !== false) {
          try {
            // Thử endpoint chuẩn /me/messages với access_token query param
            let msgRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { comment_id: comment.id },
                message: { text: inboxBody }
              })
            });
            let msgData = await msgRes.json();

            // Nếu /me/messages thất bại, fallback sang /${pageId}/messages
            if (msgData && msgData.error && msgData.error.code !== 200) {
              msgRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { comment_id: comment.id },
                  message: { text: inboxBody }
                })
              });
              msgData = await msgRes.json();
            }

            if (msgData && (msgData.message_id || msgData.recipient_id)) {
              didInbox = true;
              summary.inboxedCount++;
            } else if (msgData && msgData.error) {
              console.error('Lỗi Graph API Messenger Private Reply:', msgData.error);
              if (msgData.error.code === 200 || msgData.error.code === 230) {
                summary.permissionError = 'Meta API: Cần cấp thêm quyền "pages_messaging" trong Graph API Explorer để Fanpage có thể nhắn tin riêng Messenger cho khách.';
                inboxError = 'Thiếu quyền pages_messaging (#200)';
              } else if (msgData.error.code === 10900) {
                inboxError = 'Khách đã từng được gửi tin nhắn riêng cho bình luận này';
                didInbox = true;
              } else {
                inboxError = msgData.error.message || `Lỗi Meta (#${msgData.error.code})`;
              }
            }
          } catch (e) {
            console.error('Lỗi fetch Messenger Private Reply:', e.message);
            inboxError = e.message;
          }
        } else if (!needsInbox) {
          didInbox = true;
        }

        const logEntry = {
          id: generateId('crlog', 8),
          commentId: comment.id,
          postId: post.id,
          pageId: pageId,
          pageName: page.name,
          customerName: customerName,
          commentMessage: commentMsg,
          didLike,
          didHide,
          didReplyComment,
          replyError,
          replyText,
          didInbox,
          inboxError,
          timestamp: new Date().toISOString()
        };

        await addRepliedCommentLog(userId, logEntry);
        if (didReplyComment) {
          repliedIds.add(comment.id);
        }
        summary.processedItems.push(logEntry);
      }
    }

    return {
      success: true,
      summary,
      message: summary.permissionError
        ? `⚠️ ${summary.permissionError}`
        : (summary.newCommentsFound > 0
            ? `🎉 Đã quét ${summary.checkedPosts} bài viết, phát hiện ${summary.newCommentsFound} bình luận mới: Like (${summary.likedCount}), Ẩn SĐT (${summary.hiddenCount}), Trả lời cmt (${summary.repliedCount}), Inbox (${summary.inboxedCount})!`
            : `Đã quét ${summary.checkedPosts} bài viết gần nhất. Tất cả bình luận đều đã được phản hồi đầy đủ!`)
    };
  } catch (err) {
    return { success: false, error: err.message, summary };
  }
}

// Lấy cấu hình kịch bản Auto-Reply & Trạng thái quyền Token
app.get('/api/ads/auto-reply', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const config = await getAutoReplyConfig(req.user.id);
  const logs = await getAutoReplyLogs(req.user.id);
  const farm = await getFanpageFarm(req.user.id);
  const activePage = farm.find(p => p.status === 'ACTIVE' && p.accessToken && p.accessToken.length > 20) || farm.find(p => p.accessToken && p.accessToken.length > 20) || farm[0] || null;

  let permissionInfo = null;
  if (activePage && activePage.accessToken && activePage.accessToken.length > 20) {
    try {
      const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(activePage.accessToken)}&access_token=${encodeURIComponent(activePage.accessToken)}`);
      const debugData = await debugRes.json();
      if (debugData && debugData.data) {
        const scopes = debugData.data.scopes || [];
        permissionInfo = {
          isValid: debugData.data.is_valid,
          isExpired: !debugData.data.is_valid,
          scopes,
          hasManagePosts: scopes.includes('pages_manage_posts'),
          hasManageEngagement: scopes.includes('pages_manage_engagement'),
          hasReadEngagement: scopes.includes('pages_read_engagement'),
          hasReadUserContent: scopes.includes('pages_read_user_content'),
          hasMessaging: scopes.includes('pages_messaging'),
          allRequiredGranted: scopes.includes('pages_manage_posts') &&
                              scopes.includes('pages_manage_engagement') &&
                              scopes.includes('pages_read_user_content') &&
                              scopes.includes('pages_messaging')
        };
      } else if (debugData && debugData.error) {
        permissionInfo = {
          isValid: false,
          isExpired: true,
          error: debugData.error.message || 'Token đã hết hạn (Session expired)',
          code: debugData.error.code
        };
      }
    } catch (e) {
      permissionInfo = { isValid: false, isExpired: true, error: e.message };
    }
  }

  res.json({ success: true, config, logs, activePage, permissionInfo });
});

// Lưu cấu hình kịch bản Auto-Reply
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

// Kích hoạt Quét & Trả lời bình luận ngay lập tức (Live Scan Now)
app.post('/api/fb/auto-reply/scan-now', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { pageId } = req.body;
  const farm = await getFanpageFarm(req.user.id);
  const targetPages = pageId ? farm.filter(p => p.id === pageId) : farm.filter(p => p.status === 'ACTIVE' && p.accessToken);

  if (targetPages.length === 0) {
    return res.status(400).json({ error: 'Chưa có Fanpage nào được kích hoạt hoặc có Access Token trong Dàn Nuôi của bạn' });
  }

  let totalScanned = 0;
  let totalNew = 0;
  let totalLiked = 0;
  let totalHidden = 0;
  let totalReplied = 0;
  let lastMessage = '';
  let permissionWarning = null;

  for (const page of targetPages) {
    const resScan = await scanAndReplyPageComments(req.user.id, page);
    if (resScan.summary) {
      totalScanned += resScan.summary.checkedPosts;
      totalNew += resScan.summary.newCommentsFound;
      totalLiked += resScan.summary.likedCount;
      totalHidden += resScan.summary.hiddenCount;
      totalReplied += resScan.summary.repliedCount;
      if (resScan.summary.permissionError) {
        permissionWarning = resScan.summary.permissionError;
      }
    }
    lastMessage = resScan.message || resScan.error || '';
  }

  const logs = await getAutoReplyLogs(req.user.id);

  res.json({
    success: true,
    message: permissionWarning || lastMessage,
    permissionWarning,
    stats: { totalScanned, totalNew, totalLiked, totalHidden, totalReplied },
    logs
  });
});

// Lấy nhật ký bình luận đã phản hồi
app.get('/api/fb/auto-reply/logs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const logs = await getAutoReplyLogs(req.user.id);
  res.json({ success: true, logs });
});

// Facebook Webhook Verification & Real-time Auto-Reply Listener
app.get('/api/fb/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token) {
    if (mode === 'subscribe' && (token === 'shopeefb_webhook_verify_2026' || token === process.env.FB_WEBHOOK_VERIFY_TOKEN)) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// Xử lý sự kiện Webhook thời gian thực từ Meta (Real-time Instant Auto-Reply 0s)
async function handleRealtimeCommentWebhook(pageId, val) {
  const commentId = val.comment_id;
  const postId = val.post_id || val.parent_id || 'feed';
  const commentMsg = (val.message || '').trim();
  const customer = val.from;

  if (!customer || customer.id === pageId) return;
  const customerName = customer.name || 'bạn';

  const usersMap = await getAllUsers();
  let ownerUser = null;
  let targetPage = null;

  for (const user of Object.values(usersMap)) {
    const farm = await getFanpageFarm(user.id);
    const found = farm.find(p => p.id === pageId);
    if (found && found.accessToken && found.accessToken.length > 20) {
      ownerUser = user;
      targetPage = found;
      break;
    }
    const integration = await getFbIntegration(user.id);
    if (integration && integration.pageId === pageId && integration.pageAccessToken && integration.pageAccessToken.length > 20) {
      ownerUser = user;
      targetPage = {
        id: integration.pageId,
        name: integration.pageName || 'Fanpage',
        accessToken: integration.pageAccessToken,
        status: 'ACTIVE'
      };
      break;
    }
  }

  if (!ownerUser || !targetPage) {
    return;
  }

  const token = targetPage.accessToken.trim();
  const config = await getAutoReplyConfig(ownerUser.id);
  if (config.enabled === false) return;

  const repliedHistory = await getRepliedCommentIds(ownerUser.id);
  if (repliedHistory.includes(commentId)) {
    return;
  }

  const existingLogs = await getAutoReplyLogs(ownerUser.id);
  const alreadyInboxed = existingLogs.some(l => l.commentId === commentId && l.didInbox);

  const hasPhone = containsPhoneNumber(commentMsg);
  let didLike = false;
  let didHide = false;
  let didReplyComment = false;
  let replyError = null;
  let didInbox = alreadyInboxed;
  let inboxError = null;

  // A. Like
  if (config.autoLike !== false) {
    try {
      const likeRes = await fetch(`https://graph.facebook.com/v19.0/${commentId}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      });
      const likeData = await likeRes.json();
      if (likeData && likeData.success) didLike = true;
    } catch (e) {}
  }

  // B. Hide phone (Ẩn bình luận chứa số điện thoại)
  if (config.hidePhone !== false && hasPhone) {
    didHide = await hideFacebookComment(commentId, token);
  }

  // C. Reply Comment
  const templates = Array.isArray(config.replyTemplates) && config.replyTemplates.length > 0
    ? config.replyTemplates
    : [
        `Dạ em chào ${customerName} ạ! Em đã gửi thông tin ưu đãi và quà tặng qua tin nhắn riêng cho mình rồi đó ạ, ${customerName} kiểm tra hộp thư giúp em nhé! ❤️`,
        `Chào ${customerName} ơi, shop đang có Flash Sale giá sốc hôm nay ạ. Shop đã nhắn tin tư vấn trực tiếp cho ${customerName} rồi nhé 🥰`
      ];
  let template = templates[Math.floor(Math.random() * templates.length)];
  const replyText = template
    .replace(/\{name\}|\{\{name\}\}|\[NAME\]/gi, customerName)
    .replace(/\{page\}|\{\{page\}\}/gi, targetPage.name);

  try {
    const replyRes = await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText, access_token: token })
    });
    const replyData = await replyRes.json();
    if (replyData && (replyData.id || replyData.post_id)) {
      didReplyComment = true;
    } else if (replyData && replyData.error) {
      if (replyData.error.code === 200) {
        replyError = 'Thiếu quyền pages_manage_engagement (#200)';
      } else {
        replyError = replyData.error.message || `Lỗi Meta (#${replyData.error.code})`;
      }
    }
  } catch (e) {
    replyError = e.message;
  }

  // D. Messenger Private Reply
  if (!alreadyInboxed) {
    let inboxBody = (config.inboxMessage && config.inboxMessage.trim().length > 0)
      ? config.inboxMessage
      : "Dạ em chào {name} ạ! Cảm ơn {name} đã quan tâm đến bài viết của shop. Shop gửi thông tin ưu đãi và link đặt hàng trực tiếp cho mình đây ạ! 🥰";

    inboxBody = inboxBody
      .replace(/\{name\}|\{\{name\}\}|\[NAME\]/gi, customerName)
      .replace(/\{page\}|\{\{page\}\}/gi, targetPage.name);

    if (targetPage.affiliateLink) {
      inboxBody = inboxBody.replace(/\[LINK_DAT_HANG\]|\[LINK_SAN_PHAM\]|\[LINK\]/gi, targetPage.affiliateLink);
    }

    try {
      let msgRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text: inboxBody }
        })
      });
      let msgData = await msgRes.json();

      if (msgData && msgData.error && msgData.error.code !== 200) {
        msgRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { comment_id: commentId },
            message: { text: inboxBody }
          })
        });
        msgData = await msgRes.json();
      }

      if (msgData && (msgData.message_id || msgData.recipient_id)) {
        didInbox = true;
      } else if (msgData && msgData.error) {
        if (msgData.error.code === 200 || msgData.error.code === 230) {
          inboxError = 'Thiếu quyền pages_messaging (#200)';
        } else if (msgData.error.code === 10900) {
          inboxError = 'Khách đã từng được gửi tin nhắn riêng cho bình luận này';
          didInbox = true;
        } else {
          inboxError = msgData.error.message;
        }
      }
    } catch (e) {
      inboxError = e.message;
    }
  }

  const logEntry = {
    id: generateId('crlog', 8),
    commentId: commentId,
    postId: postId,
    pageId: pageId,
    pageName: targetPage.name,
    customerName: customerName,
    commentMessage: commentMsg,
    didLike,
    didHide,
    didReplyComment,
    replyError,
    replyText,
    didInbox,
    inboxError,
    source: 'WEBHOOK_REALTIME',
    timestamp: new Date().toISOString()
  };

  await addRepliedCommentLog(ownerUser.id, logEntry);
}

app.post('/api/fb/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  try {
    const body = req.body;
    if (body && body.object === 'page' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const pageId = entry.id;
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          if (change.field === 'feed' && change.value) {
            const val = change.value;
            if (val.item === 'comment' && val.verb === 'add' && val.comment_id) {
              await handleRealtimeCommentWebhook(pageId, val);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Lỗi Webhook POST:', e.message);
  }
});

// ----------------- VERCEL CRON JOBS (TỰ ĐỘNG CHẠY SERVERLESS 24/7) -----------------
// Cron Tự động Quét & Phản hồi bình luận mọi Fanpage trên hệ thống
app.get('/api/cron/auto-reply', async (req, res) => {
  const startTime = Date.now();
  const summary = {
    timestamp: new Date().toISOString(),
    usersProcessed: 0,
    pagesProcessed: 0,
    results: []
  };

  try {
    const usersMap = await getAllUsers();
    for (const user of Object.values(usersMap)) {
      summary.usersProcessed++;
      const farm = await getFanpageFarm(user.id);
      for (const page of farm) {
        if (page.status === 'ACTIVE' && page.accessToken && page.accessToken.trim().length > 20) {
          summary.pagesProcessed++;
          try {
            const scanRes = await scanAndReplyPageComments(user.id, page);
            summary.results.push({
              userId: user.id,
              pageId: page.id,
              pageName: page.name,
              success: scanRes.success,
              summary: scanRes.summary,
              message: scanRes.message
            });
          } catch (pageErr) {
            summary.results.push({
              userId: user.id,
              pageId: page.id,
              pageName: page.name,
              success: false,
              error: pageErr.message
            });
          }
        }
      }
    }

    res.json({
      success: true,
      durationMs: Date.now() - startTime,
      summary
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      durationMs: Date.now() - startTime
    });
  }
});

// Cron Tự động Đăng Bài Nuôi Fanpage Theo Lịch Giờ Vàng
app.get('/api/cron/farm-autopilot', async (req, res) => {
  const startTime = Date.now();
  const summary = {
    timestamp: new Date().toISOString(),
    usersProcessed: 0,
    postsChecked: 0,
    results: []
  };

  try {
    const usersMap = await getAllUsers();
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayStr = now.toISOString().slice(0, 10);

    for (const user of Object.values(usersMap)) {
      summary.usersProcessed++;
      const farm = await getFanpageFarm(user.id);
      for (const page of farm) {
        if (page.status === 'ACTIVE' && page.accessToken && page.accessToken.trim().length > 20) {
          const slots = Array.isArray(page.dailySlots) && page.dailySlots.length > 0 ? page.dailySlots : ['08:00', '11:30', '19:30', '20:30', '22:00'];
          summary.postsChecked += slots.length;
        }
      }
    }

    res.json({
      success: true,
      currentTime: currentTimeStr,
      today: todayStr,
      durationMs: Date.now() - startTime,
      summary
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      durationMs: Date.now() - startTime
    });
  }
});

// Mô phỏng kịch bản (Live Simulator)
app.post('/api/ads/auto-reply/simulate', async (req, res) => {
  const { customerComment, customerName, productName, productPrice, productLink } = req.body;

  const name = customerName || 'Khách hàng';
  const comment = (customerComment || '').trim();
  const hasPhone = containsPhoneNumber(comment);

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
      hideReason: hasPhone ? 'Phát hiện số điện thoại (Việt Nam): Tự động ẩn comment để chống đối thủ cướp khách' : null,
      replyComment: pickedReply,
      sentInbox: inboxMessage,
      timestamp: new Date().toLocaleTimeString('vi-VN')
    }
  });
});

// ----------------- MODULE 4: LIÊN KẾT FACEBOOK & TỰ ĐỘNG ĐẶT LỊCH ĐĂNG / CHẠY ADS -----------------

// Lấy thông tin liên kết FB & hàng đợi
app.get('/api/fb/settings', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const integration = await getFbIntegration(req.user.id);
  const queue = await getScheduledQueue(req.user.id);
  res.json({ success: true, integration, queue });
});

// Xác thực kết nối Fanpage & Lưu thông tin
function parseFacebookTarget(input) {
  const str = (input || '').trim();
  let cleanId = str;
  let cleanName = '';

  if (str.includes('facebook.com') || str.includes('fb.com')) {
    try {
      const url = new URL(str.startsWith('http') ? str : 'https://' + str);
      if (url.searchParams.has('id')) {
        cleanId = url.searchParams.get('id');
      } else {
        const parts = url.pathname.split('/').filter(p => p && p !== 'profile.php' && p !== 'pages' && p !== 'groups');
        cleanId = parts[parts.length - 1] || 'page_shop';
      }
    } catch (e) {
      cleanId = str.replace(/https?:\/\/(www\.)?(facebook|fb)\.com\//i, '').replace(/\/.*$/, '') || 'page_shop';
    }
  }

  cleanName = cleanId.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (/^\d+$/.test(cleanId)) {
    cleanName = `Fanpage Bán Hàng (#${cleanId.slice(-4)})`;
  }

  return { cleanId, cleanName };
}

// Tự động phân giải Token: Nếu người dùng nhập User Access Token, tự động đổi sang Page Access Token
async function resolvePageAccessToken(pageId, token) {
  if (!token || token.trim().length < 20) {
    return { token: token ? token.trim() : '', pageId, pageName: '' };
  }
  const cleanToken = token.trim();
  const cleanTargetId = pageId ? String(pageId).replace(/[^\d]/g, '') : '';
  const searchStr = pageId ? String(pageId).toLowerCase() : '';

  try {
    // 1. Thử gọi /me/accounts với token được cung cấp để xem có phải User Token không
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,picture,followers_count,access_token&access_token=${cleanToken}`);
    const meData = await meRes.json();

    if (meData && Array.isArray(meData.data) && meData.data.length > 0) {
      // Đúng là User Access Token! Tìm Page phù hợp trong danh sách tài khoản
      let matched = null;
      if (cleanTargetId) {
        matched = meData.data.find(p => p.id === cleanTargetId);
      }
      if (!matched && searchStr) {
        matched = meData.data.find(p =>
          (p.name && p.name.toLowerCase().includes(searchStr)) ||
          (p.name && searchStr.includes(p.name.toLowerCase()))
        );
      }
      // Nếu không tìm thấy theo ID/tên nhưng chỉ có 1 page, hoặc lấy page đầu tiên
      if (!matched && meData.data.length > 0) {
        matched = meData.data[0];
      }

      if (matched && matched.access_token) {
        return {
          token: matched.access_token,
          pageId: matched.id,
          pageName: matched.name,
          category: matched.category || 'Trang Fanpage Doanh Nghiệp',
          avatar: matched.picture?.data?.url || `https://graph.facebook.com/${matched.id}/picture?type=normal`,
          followers: matched.followers_count || 0,
          allPages: meData.data
        };
      }
    }

    // 2. Nếu không có trong /me/accounts, có thể token đã là Page Token xịn! Kiểm tra với /me
    const meDirectRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,category,picture,followers_count,fan_count&access_token=${cleanToken}`);
    const meDirect = await meDirectRes.json();
    if (meDirect && meDirect.id && !meDirect.error) {
      return {
        token: cleanToken,
        pageId: meDirect.id,
        pageName: meDirect.name,
        category: meDirect.category || 'Trang Fanpage Doanh Nghiệp',
        avatar: meDirect.picture?.data?.url || `https://graph.facebook.com/${meDirect.id}/picture?type=normal`,
        followers: meDirect.followers_count || meDirect.fan_count || 0
      };
    }
  } catch (e) {
    console.error('Lỗi phân giải Page Token:', e.message);
  }

  return { token: cleanToken, pageId, pageName: '' };
}

// Xác thực kết nối Fanpage Facebook
app.post('/api/fb/verify-connection', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { fbTarget, pageId, pageAccessToken, adAccountId, niche } = req.body;
  const target = (fbTarget || pageId || '').trim();

  if (!target && !pageAccessToken) {
    return res.status(400).json({ error: 'Vui lòng nhập Link Fanpage, Page ID hoặc Tên trang!' });
  }

  const { cleanId, cleanName } = parseFacebookTarget(target || 'page_shop');
  const cleanToken = (pageAccessToken || '').trim();

  let verifiedAccount = null;
  let finalToken = cleanToken;

  // Nếu người dùng cung cấp Token thật, tự động phân giải Page Access Token
  if (cleanToken && cleanToken.length > 20) {
    try {
      const resolved = await resolvePageAccessToken(cleanId, cleanToken);
      if (resolved && resolved.pageId) {
        verifiedAccount = {
          id: resolved.pageId,
          name: resolved.pageName || cleanName,
          category: resolved.category || 'Trang Fanpage Doanh Nghiệp',
          avatar: resolved.avatar || `https://graph.facebook.com/${resolved.pageId}/picture?type=normal`
        };
        if (resolved.token) finalToken = resolved.token;
      }
    } catch (err) {
      console.error('Lỗi Graph API verify-connection:', err.message);
    }
  }

  if (!verifiedAccount) {
    verifiedAccount = {
      id: cleanId,
      name: cleanName || 'Fanpage Bán Hàng Trực Tuyến',
      category: 'Trang Fanpage Doanh Nghiệp',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      isSandbox: !cleanToken
    };
  }

  const targetUrl = target.startsWith('http') ? target : `https://facebook.com/${cleanId}`;

  const saved = await saveFbIntegration(req.user.id, {
    connected: true,
    accountType: 'page',
    pageId: verifiedAccount.id,
    pageName: verifiedAccount.name,
    pageCategory: verifiedAccount.category,
    pageAvatar: verifiedAccount.avatar,
    pageAccessToken: finalToken,
    niche: niche || 'cong_nghe',
    adAccountId: (adAccountId || '').trim(),
    fbTarget: target,
    targetUrl: targetUrl,
    isSandbox: !cleanToken
  });

  res.json({
    success: true,
    message: `🎉 Đã liên kết thành công Fanpage: ${verifiedAccount.name}!`,
    integration: saved
  });
});

// Lưu cấu hình Đặt lịch tự động hàng ngày
app.post('/api/fb/save-settings', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { autoScheduleEnabled, dailyPostTime, autoRunAds, dailyBudget, selectedCategory } = req.body;

  const updated = await saveFbIntegration(req.user.id, {
    autoScheduleEnabled: !!autoScheduleEnabled,
    dailyPostTime: dailyPostTime || '20:00',
    autoRunAds: !!autoRunAds,
    dailyBudget: parseInt(dailyBudget, 10) || 50000,
    selectedCategory: selectedCategory || 'cong_nghe'
  });

  res.json({
    success: true,
    message: 'Đã lưu cấu hình tự động đăng bài & kích hoạt Ads mỗi ngày!',
    integration: updated
  });
});

// Đăng bài ngay lập tức lên Fanpage
app.post('/api/fb/publish-now', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  const { postTitle, postContent, autoRunAds, dailyBudget, imageUrl, videoUrl, mediaUrl: rawMediaUrl, pageId } = req.body;
  const mediaUrl = (videoUrl || rawMediaUrl || imageUrl || '').trim();
  if (!postContent) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung bài viết' });
  }

  let integration = null;
  if (pageId) {
    const farm = await getFanpageFarm(req.user.id);
    const foundPage = farm.find(p => p.id === pageId);
    if (foundPage) {
      integration = {
        connected: true,
        accountType: 'page',
        pageId: foundPage.id,
        pageName: foundPage.name,
        pageAccessToken: foundPage.accessToken,
        autoRunAds: foundPage.autoRunAds,
        dailyBudget: foundPage.dailyBudget,
        targetUrl: `https://facebook.com/${foundPage.id}`
      };
    }
  }

  if (!integration) {
    integration = await getFbIntegration(req.user.id);
  }

  if (!integration || !integration.connected) {
    integration = await saveFbIntegration(req.user.id, {
      connected: true,
      accountType: 'page',
      pageId: 'page_demo_' + req.user.id.slice(-6),
      pageName: 'Fanpage Bán Hàng Trực Tuyến',
      pageCategory: 'Trang Doanh Nghiệp',
      pageAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
      isSandbox: true
    });
  }

  let realPostId = null;
  let isLiveApi = false;
  let apiError = null;

  // Nếu người dùng cung cấp Page Access Token thật, gọi Graph API đăng trực tiếp
  if (integration.pageAccessToken && integration.pageAccessToken.trim().length > 20) {
    try {
      const resolved = await resolvePageAccessToken(integration.pageId, integration.pageAccessToken);
      const activeToken = resolved.token || integration.pageAccessToken.trim();
      const activePageId = resolved.pageId || integration.pageId;

      let fbPublishRes;
      const isVideo = mediaUrl && /\.(mp4|mov|avi|wmv|m4v|webm)(\?.*)?$/i.test(mediaUrl);

      if (isVideo) {
        // Đăng Video lên Fanpage qua Graph API /videos
        fbPublishRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: postContent,
            title: postTitle || 'Video Review Sản Phẩm',
            file_url: mediaUrl,
            access_token: activeToken
          })
        });
      } else if (mediaUrl && mediaUrl.startsWith('http')) {
        // Đăng Ảnh lên Fanpage qua Graph API /photos
        fbPublishRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: postContent,
            url: mediaUrl,
            access_token: activeToken
          })
        });
      } else {
        // Đăng bài viết thường dạng status qua /feed
        fbPublishRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: postContent,
            access_token: activeToken
          })
        });
      }
      let fbPublishData = await fbPublishRes.json();

      // Nếu đăng video/ảnh lỗi, tự động fallback sang đăng feed để đảm bảo bài viết vẫn lên được trang
      if (fbPublishData && fbPublishData.error && mediaUrl && mediaUrl.startsWith('http')) {
        const feedRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: postContent,
            access_token: activeToken
          })
        });
        const feedData = await feedRes.json();
        if (feedData && (feedData.id || feedData.post_id)) {
          fbPublishData = feedData;
        }
      }

      if (fbPublishData && (fbPublishData.id || fbPublishData.post_id)) {
        realPostId = fbPublishData.post_id || fbPublishData.id;
        isLiveApi = true;
      } else if (fbPublishData && fbPublishData.error) {
        apiError = fbPublishData.error.message || 'Lỗi xác thực Meta API';
      }
    } catch (err) {
      apiError = err.message;
      console.error('FB Publish Error:', err.message);
    }
  }

  const targetUrl = integration.targetUrl || `https://facebook.com/${integration.pageId}`;
  const postId = isLiveApi ? realPostId : `${integration.pageId}_${Date.now()}`;
  const postUrl = isLiveApi ? `https://facebook.com/${realPostId}` : targetUrl;

  // Nếu bật Auto Ads, tự động khởi tạo chiến dịch Ads
  let adsResult = null;
  const shouldRunAds = autoRunAds !== undefined ? autoRunAds : integration.autoRunAds;
  if (shouldRunAds) {
    const budget = dailyBudget || integration.dailyBudget || 50000;
    const newCamp = {
      id: generateId('camp', 10),
      userId: req.user.id,
      name: `Ads Fanpage: ${(postTitle || 'Bài viết mới').slice(0, 35)}`,
      objective: 'MESSAGES',
      dailyBudget: budget,
      targetAge: '18-45',
      targetGender: 'ALL',
      targetLocation: 'Toàn quốc',
      postTitle: postTitle || 'Bài đăng Fanpage',
      postContent: postContent,
      status: 'ACTIVE',
      spent: 0,
      reach: `${Math.round(budget * 0.08).toLocaleString('vi-VN')} - ${Math.round(budget * 0.22).toLocaleString('vi-VN')}`,
      engagement: Math.round(budget * 0.012),
      createdAt: new Date().toISOString()
    };
    await saveCampaign(newCamp);
    adsResult = newCamp;
  }

  // Cập nhật queue
  const queue = await getScheduledQueue(req.user.id);
  queue.unshift({
    id: generateId('post', 8),
    title: postTitle || 'Bài viết đăng ngay',
    content: postContent,
    status: isLiveApi ? 'PUBLISHED' : 'PUBLISHED_DIRECT',
    mode: isLiveApi ? 'META_API' : 'DIRECT_PASTE',
    postId,
    postUrl,
    publishedAt: new Date().toISOString(),
    adsLaunched: !!adsResult,
    adsCampaignId: adsResult ? adsResult.id : null
  });
  await saveScheduledQueue(req.user.id, queue.slice(0, 30));

  let responseMessage = '';
  if (isLiveApi) {
    responseMessage = adsResult
      ? '🎉 Đã đăng bài trực tiếp thành công lên Fanpage qua Meta API & Kích hoạt chiến dịch Ads!'
      : '🎉 Đã đăng bài trực tiếp thành công lên Fanpage qua Meta API!';
  } else if (apiError) {
    responseMessage = `⚠️ Meta API: "${apiError}". Hệ thống đã tự động sao chép bài viết và mở Fanpage để bạn dán (Ctrl + V) đăng trực tiếp!`;
  } else {
    responseMessage = '📋 Đã tự động sao chép toàn bộ bài viết và mở Fanpage của bạn! Nhấn Ctrl + V để đăng bài ngay trong 1 giây.';
  }

  res.json({
    success: true,
    isLiveApi,
    apiError,
    accountType: 'page',
    targetUrl,
    message: responseMessage,
    postId,
    postUrl,
    adsLaunched: !!adsResult,
    campaign: adsResult
  });
});

// Thêm bài viết vào lịch hẹn giờ (Schedule Post)
app.post('/api/fb/schedule-post', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  }

  let integration = await getFbIntegration(req.user.id);
  if (!integration || !integration.connected) {
    integration = await saveFbIntegration(req.user.id, {
      connected: true,
      pageId: 'page_demo_' + req.user.id.slice(-6),
      pageName: 'Fanpage Bán Hàng Trực Tuyến (Sandbox)',
      pageCategory: 'Cửa hàng Bán lẻ & Quảng cáo',
      pageAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
      isSandbox: true
    });
  }

  const { postTitle, postContent, scheduleTime, autoRunAds, dailyBudget } = req.body;
  if (!postContent || !scheduleTime) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung và thời gian kích hoạt' });
  }

  const queue = await getScheduledQueue(req.user.id);
  const newItem = {
    id: generateId('sched', 8),
    title: postTitle || 'Bài viết hẹn giờ',
    content: postContent,
    scheduleTime,
    autoRunAds: !!autoRunAds,
    dailyBudget: dailyBudget || integration.dailyBudget || 50000,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  queue.push(newItem);
  await saveScheduledQueue(req.user.id, queue);

  res.json({
    success: true,
    message: `Đã đặt lịch kích hoạt thành công vào lúc ${scheduleTime}!`,
    item: newItem
  });
});

// Hủy lịch hẹn
app.post('/api/fb/cancel-scheduled', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { itemId } = req.body;
  let queue = await getScheduledQueue(req.user.id);
  queue = queue.filter(q => q.id !== itemId);
  await saveScheduledQueue(req.user.id, queue);
  res.json({ success: true, message: 'Đã hủy bài viết trong hàng đợi lịch đăng' });
});

// ----------------- HỆ THỐNG NUÔI DÀN FANPAGE TỰ ĐỘNG (MULTI-FANPAGE FARM) -----------------

// Lấy danh sách Dàn Fanpage của người dùng
app.get('/api/fb/farm', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const farm = await getFanpageFarm(req.user.id);
  res.json({ success: true, farm });
});

// Lấy thông tin các lĩnh vực & trụ cột nội dung
app.get('/api/fb/farm/niches', (req, res) => {
  res.json({ success: true, niches: NICHE_DATA });
});

// API Tự động quét và nhận diện danh sách Fanpage từ Access Token
app.post('/api/fb/farm/detect-pages', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { token } = req.body;
  if (!token || token.trim().length < 20) {
    return res.status(400).json({ error: 'Vui lòng dán Access Token hợp lệ từ Meta for Developers' });
  }

  const cleanToken = token.trim();
  try {
    // 1. Thử lấy danh sách page từ /me/accounts (User Token)
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,picture,followers_count,access_token&access_token=${cleanToken}`);
    const meData = await meRes.json();

    if (meData && Array.isArray(meData.data) && meData.data.length > 0) {
      const pages = meData.data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Trang Doanh Nghiệp',
        avatar: p.picture?.data?.url || `https://graph.facebook.com/${p.id}/picture?type=normal`,
        followers: p.followers_count || 0,
        accessToken: p.access_token
      }));
      return res.json({
        success: true,
        type: 'user_token_pages',
        message: `Đã tìm thấy ${pages.length} Fanpage được quản lý bởi tài khoản của bạn!`,
        pages
      });
    }

    // 2. Nếu là Page Token trực tiếp:
    const meDirectRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,category,picture,followers_count,fan_count&access_token=${cleanToken}`);
    const meDirect = await meDirectRes.json();
    if (meDirect && meDirect.id && !meDirect.error) {
      const page = {
        id: meDirect.id,
        name: meDirect.name,
        category: meDirect.category || 'Trang Fanpage',
        avatar: meDirect.picture?.data?.url || `https://graph.facebook.com/${meDirect.id}/picture?type=normal`,
        followers: meDirect.followers_count || meDirect.fan_count || 0,
        accessToken: cleanToken
      };
      return res.json({
        success: true,
        type: 'direct_page_token',
        message: `Đã xác thực thành công Page Token của "${page.name}"!`,
        pages: [page]
      });
    }

    if (meData && meData.error) {
      return res.status(400).json({ error: `Lỗi Meta API: ${meData.error.message}` });
    }
    return res.status(400).json({ error: 'Không tìm thấy Fanpage nào liên kết với Token này. Hãy kiểm tra lại quyền pages_show_list và pages_manage_posts.' });
  } catch (err) {
    return res.status(500).json({ error: `Lỗi máy chủ: ${err.message}` });
  }
});

// Thêm Fanpage mới vào Dàn Nuôi
app.post('/api/fb/farm/add', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { fbTarget, pageId, pageAccessToken, niche, dailySlots, contentMix, affiliateLink, autoRunAds, dailyBudget } = req.body;

  const target = (fbTarget || pageId || '').trim();
  const rawToken = (pageAccessToken || '').trim();
  if (!target && !rawToken) {
    return res.status(400).json({ error: 'Vui lòng nhập Link Fanpage, Page ID hoặc Page Access Token' });
  }

  const { cleanId, cleanName } = parseFacebookTarget(target || 'page_shop');
  let finalToken = rawToken;
  let verifiedAccount = null;

  // Nếu có Token, tự động phân giải Page Access Token chuẩn và trích xuất thông tin
  if (rawToken && rawToken.length > 20) {
    try {
      const resolved = await resolvePageAccessToken(cleanId, rawToken);
      if (resolved && resolved.pageId) {
        verifiedAccount = {
          id: resolved.pageId,
          name: resolved.pageName || cleanName,
          category: resolved.category || 'Trang Fanpage Doanh Nghiệp',
          avatar: resolved.avatar || `https://graph.facebook.com/${resolved.pageId}/picture?type=normal`,
          followers: resolved.followers || 0
        };
        if (resolved.token) finalToken = resolved.token;
      }
    } catch (err) {
      console.error('Lỗi Graph API verify Fanpage Farm:', err.message);
    }
  }

  if (!verifiedAccount) {
    verifiedAccount = {
      id: cleanId || ('page_' + Date.now().toString().slice(-6)),
      name: cleanName || 'Fanpage Bán Hàng Trực Tuyến',
      category: 'Trang Doanh Nghiệp',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      followers: 0,
      isSandbox: !finalToken
    };
  }

  const newPage = {
    id: verifiedAccount.id,
    name: verifiedAccount.name,
    category: verifiedAccount.category,
    avatar: verifiedAccount.avatar,
    followers: verifiedAccount.followers,
    accessToken: finalToken,
    niche: niche || 'cong_nghe',
    status: 'ACTIVE',
    dailySlots: Array.isArray(dailySlots) && dailySlots.length ? dailySlots : ['08:00', '11:30', '20:00'],
    contentMix: contentMix || 'balanced',
    affiliateLink: affiliateLink || '',
    autoRunAds: !!autoRunAds,
    dailyBudget: parseInt(dailyBudget, 10) || 50000,
    isSandbox: !finalToken
  };

  const updatedFarm = await saveFanpageToFarm(req.user.id, newPage);

  res.json({
    success: true,
    message: `🎉 Đã thêm Fanpage "${verifiedAccount.name}" vào Dàn Nuôi Tự Động!`,
    page: newPage,
    farm: updatedFarm
  });
});

// Bật / Tắt trạng thái nuôi tự động của 1 Fanpage
app.post('/api/fb/farm/toggle', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { pageId } = req.body;
  if (!pageId) return res.status(400).json({ error: 'Thiếu pageId' });

  const updated = await toggleFanpageFarmStatus(req.user.id, pageId);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy Fanpage' });

  res.json({
    success: true,
    item: updated,
    message: updated.status === 'ACTIVE'
      ? `Đã kích hoạt chế độ nuôi tự động cho Fanpage "${updated.name}"`
      : `Đã tạm dừng nuôi Fanpage "${updated.name}"`
  });
});

// Xóa Fanpage khỏi Dàn Nuôi
app.delete('/api/fb/farm/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const ok = await deleteFanpageFromFarm(req.user.id, req.params.id);
  res.json({
    success: ok,
    message: ok ? 'Đã xóa Fanpage khỏi dàn nuôi thành công' : 'Không tìm thấy Fanpage'
  });
});

// Lấy thông tin chi tiết & kiểm tra quyền Token của 1 Fanpage
app.get('/api/fb/farm/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const farm = await getFanpageFarm(req.user.id);
  const page = farm.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Fanpage' });

  let permissionInfo = null;
  if (page.accessToken && page.accessToken.trim().length > 20) {
    try {
      const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${page.accessToken}&access_token=${page.accessToken}`);
      const debugData = await debugRes.json();
      if (debugData && debugData.data) {
        const scopes = debugData.data.scopes || [];
        permissionInfo = {
          isValid: debugData.data.is_valid,
          scopes,
          hasManagePosts: scopes.includes('pages_manage_posts'),
          hasManageEngagement: scopes.includes('pages_manage_engagement'),
          hasMessaging: scopes.includes('pages_messaging'),
          hasReadUserContent: scopes.includes('pages_read_user_content'),
          hasReadEngagement: scopes.includes('pages_read_engagement'),
          hasShowList: scopes.includes('pages_show_list'),
          allRequiredGranted: scopes.includes('pages_manage_posts') &&
                              scopes.includes('pages_manage_engagement') &&
                              scopes.includes('pages_messaging') &&
                              scopes.includes('pages_read_user_content')
        };
      }
    } catch (e) {}
  }

  res.json({ success: true, page, permissionInfo });
});

// Cập nhật chi tiết Fanpage (Token riêng biệt, Affiliate link riêng biệt, Lĩnh vực, Giờ đăng)
app.put('/api/fb/farm/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const pageId = req.params.id;
  const farm = await getFanpageFarm(req.user.id);
  const page = farm.find(p => p.id === pageId);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Fanpage trong dàn nuôi của bạn' });

  const { accessToken, affiliateLink, niche, contentMix, dailySlots, autoRunAds, dailyBudget, name } = req.body;
  const updates = {};

  if (affiliateLink !== undefined) updates.affiliateLink = (affiliateLink || '').trim();
  if (niche !== undefined) updates.niche = niche;
  if (contentMix !== undefined) updates.contentMix = contentMix;
  if (Array.isArray(dailySlots)) updates.dailySlots = dailySlots;
  if (autoRunAds !== undefined) updates.autoRunAds = !!autoRunAds;
  if (dailyBudget !== undefined) updates.dailyBudget = Number(dailyBudget) || 50000;
  if (name && name.trim()) updates.name = name.trim();

  let tokenNote = null;
  if (accessToken && accessToken.trim().length > 20) {
    const rawToken = accessToken.trim();
    let finalPageToken = rawToken;

    // Tự động kiểm tra nếu người dùng dán User Token: chuyển thành Page Token chuẩn
    try {
      const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${rawToken}`);
      const accountsData = await accountsRes.json();
      if (accountsData && Array.isArray(accountsData.data)) {
        const matched = accountsData.data.find(a => a.id === pageId);
        if (matched && matched.access_token) {
          finalPageToken = matched.access_token;
          tokenNote = `Hệ thống đã tự động nhận diện và chuyển đổi User Token thành Page Token chuẩn cho "${matched.name}"!`;
        }
      }
    } catch (e) {}

    updates.accessToken = finalPageToken;
    updates.isSandbox = false;

    // Cập nhật ảnh đại diện/tên mới nhất từ Facebook
    try {
      const fbMeRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=name,picture&access_token=${finalPageToken}`);
      const fbMe = await fbMeRes.json();
      if (fbMe && fbMe.name) {
        updates.name = fbMe.name;
        if (fbMe.picture?.data?.url) updates.avatar = fbMe.picture.data.url;
      }
    } catch (e) {}
  }

  const updated = await updateFanpageInFarm(req.user.id, pageId, updates);
  res.json({
    success: true,
    message: tokenNote || `Đã cập nhật thành công Fanpage "${updated.name}"!`,
    tokenNote,
    page: updated
  });
});

// Kiểm tra quyền của một Access Token bất kỳ
app.post('/api/fb/farm/:id/check-token', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const pageId = req.params.id;
  const token = (req.body.token || '').trim();
  if (!token || token.length < 20) {
    return res.status(400).json({ error: 'Vui lòng nhập Access Token hợp lệ (tối thiểu 20 ký tự)' });
  }

  try {
    let finalToken = token;
    let isUserTokenConverted = false;

    // Kiểm tra xem có phải User Token chứa Page này không
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${token}`);
    const accountsData = await accountsRes.json();
    if (accountsData && Array.isArray(accountsData.data)) {
      const matched = accountsData.data.find(a => a.id === pageId);
      if (matched && matched.access_token) {
        finalToken = matched.access_token;
        isUserTokenConverted = true;
      }
    }

    const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${finalToken}&access_token=${finalToken}`);
    const debugData = await debugRes.json();

    if (debugData && debugData.data) {
      const d = debugData.data;
      const scopes = d.scopes || [];
      const expiresAt = d.expires_at || 0;
      const isPermanent = expiresAt === 0;
      const expiresDateStr = expiresAt === 0 
        ? 'Vĩnh viễn (Never Expires)' 
        : new Date(expiresAt * 1000).toLocaleString('vi-VN');

      return res.json({
        success: true,
        isUserTokenConverted,
        resolvedToken: finalToken,
        isValid: d.is_valid,
        expiresAt,
        isPermanent,
        expiresDateStr,
        scopes,
        hasManagePosts: scopes.includes('pages_manage_posts'),
        hasManageEngagement: scopes.includes('pages_manage_engagement'),
        hasMessaging: scopes.includes('pages_messaging'),
        hasReadUserContent: scopes.includes('pages_read_user_content'),
        hasReadEngagement: scopes.includes('pages_read_engagement'),
        allRequiredGranted: scopes.includes('pages_manage_posts') &&
                            scopes.includes('pages_manage_engagement') &&
                            scopes.includes('pages_messaging') &&
                            scopes.includes('pages_read_user_content')
      });
    }

    if (debugData && debugData.error) {
      return res.status(400).json({ error: `Lỗi Meta API: ${debugData.error.message}` });
    }
    return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  } catch (err) {
    return res.status(500).json({ error: `Lỗi kiểm tra token: ${err.message}` });
  }
});

// Chuyển đổi Short-Lived User Token sang Page Token VĨNH VIỄN (Permanent Never-Expiring Token)
app.post('/api/fb/exchange-permanent-token', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { pageId, token, appId, appSecret } = req.body;
  if (!token || token.trim().length < 20) {
    return res.status(400).json({ error: 'Vui lòng nhập Access Token cần chuyển đổi' });
  }

  const cleanToken = token.trim();
  const cleanAppId = (appId || '').trim();
  const cleanAppSecret = (appSecret || '').trim();

  try {
    let longLivedUserToken = cleanToken;

    // Nếu người dùng cung cấp App ID và App Secret, trao đổi token ngắn hạn (1h) thành Long-Lived Token (60 ngày)
    if (cleanAppId && cleanAppSecret) {
      const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${cleanAppId}&client_secret=${cleanAppSecret}&fb_exchange_token=${cleanToken}`;
      const exRes = await fetch(exchangeUrl);
      const exData = await exRes.json();
      if (exData && exData.access_token) {
        longLivedUserToken = exData.access_token;
      } else if (exData && exData.error) {
        return res.status(400).json({ error: `Lỗi đổi Long-Lived Token từ App Meta: ${exData.error.message}` });
      }
    }

    // Từ User Token dài hạn (hoặc token hiện tại), gọi /me/accounts để lấy Page Access Token VĨNH VIỄN
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category,picture&access_token=${longLivedUserToken}`);
    const accountsData = await accountsRes.json();

    if (!accountsData || !Array.isArray(accountsData.data) || accountsData.data.length === 0) {
      if (accountsData && accountsData.error) {
        return res.status(400).json({ error: `Lỗi Meta: ${accountsData.error.message}` });
      }
      return res.status(400).json({ error: 'Không tìm thấy Fanpage nào từ Token này. Hãy đảm bảo tài khoản cấp đủ quyền pages_show_list.' });
    }

    // Tìm đúng Page mục tiêu hoặc lấy Page đầu tiên
    let targetAccount = null;
    if (pageId) {
      targetAccount = accountsData.data.find(a => a.id === pageId);
    }
    if (!targetAccount) {
      targetAccount = accountsData.data[0];
    }

    const permanentPageToken = targetAccount.access_token;

    // Kiểm tra thời hạn của token vừa trích xuất
    let isPermanent = false;
    let expiresDateStr = 'Vĩnh viễn (Never Expires)';
    let scopes = [];

    try {
      const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${permanentPageToken}&access_token=${permanentPageToken}`);
      const debugData = await debugRes.json();
      if (debugData && debugData.data) {
        const d = debugData.data;
        scopes = d.scopes || [];
        isPermanent = d.expires_at === 0;
        expiresDateStr = d.expires_at === 0 ? 'Vĩnh viễn (Never Expires - 24/7)' : new Date(d.expires_at * 1000).toLocaleString('vi-VN');
      }
    } catch (e) {}

    // Tự động lưu Token này vào Dàn Nuôi Fanpage nếu pageId đã tồn tại
    if (pageId) {
      try {
        await updateFanpageInFarm(req.user.id, pageId, {
          accessToken: permanentPageToken,
          isSandbox: false
        });
      } catch (e) {}
    }

    return res.json({
      success: true,
      message: isPermanent 
        ? `🎉 Đã tạo thành công Token VĨNH VIỄN (Never Expires) cho Fanpage "${targetAccount.name}"!` 
        : `✅ Đã tạo thành công Page Token cho Fanpage "${targetAccount.name}" (Hạn: ${expiresDateStr})`,
      pageId: targetAccount.id,
      pageName: targetAccount.name,
      permanentToken: permanentPageToken,
      isPermanent,
      expiresDateStr,
      scopes
    });
  } catch (err) {
    return res.status(500).json({ error: `Lỗi máy chủ chuyển đổi Token: ${err.message}` });
  }
});

// Kích hoạt nuôi tức thì 1 bài (Trigger Now Live Test)
app.post('/api/fb/farm/trigger-now', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const { pageId, mix, customAffiliateLink } = req.body;
  if (!pageId) return res.status(400).json({ error: 'Vui lòng chọn Fanpage cần nuôi' });

  const farm = await getFanpageFarm(req.user.id);
  const page = farm.find(p => p.id === pageId);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Fanpage trong dàn nuôi của bạn' });

  // Tự động sản xuất nội dung nuôi page phù hợp
  const genPost = generateAutonomousPost(page.niche, mix || page.contentMix, customAffiliateLink || page.affiliateLink);

  let isLive = false;
  let postId = null;
  let postUrl = null;
  let errorMsg = null;

  let activeToken = page.accessToken ? page.accessToken.trim() : '';
  let activePageId = page.id;

  if (activeToken && activeToken.length > 20) {
    try {
      const resolved = await resolvePageAccessToken(page.id, activeToken);
      if (resolved && resolved.token && resolved.token !== activeToken) {
        activeToken = resolved.token;
        await updateFanpageInFarm(req.user.id, page.id, {
          accessToken: activeToken,
          name: resolved.pageName || page.name,
          category: resolved.category || page.category,
          avatar: resolved.avatar || page.avatar
        });
        page.accessToken = activeToken;
      }
      if (resolved && resolved.pageId) {
        activePageId = resolved.pageId;
      }

      // 1. Kiểm tra định dạng media: Nếu là Video thì đăng qua /videos, nếu là Ảnh thì đăng qua /photos
      const mediaUrl = genPost.videoUrl || genPost.imageUrl;
      const isVideo = mediaUrl && /\.(mp4|mov|avi|wmv|m4v|webm)(\?.*)?$/i.test(mediaUrl);
      let fbRes;

      if (isVideo) {
        fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: genPost.fullText,
            title: genPost.title || 'Video Fanpage',
            file_url: mediaUrl,
            access_token: activeToken
          })
        });
      } else if (mediaUrl && mediaUrl.startsWith('http')) {
        fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: genPost.fullText,
            url: mediaUrl,
            access_token: activeToken
          })
        });
      } else {
        fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: genPost.fullText,
            access_token: activeToken
          })
        });
      }
      let fbData = await fbRes.json();

      // 2. Fallback sang /feed nếu media gặp lỗi
      if (fbData && fbData.error) {
        const firstErr = fbData.error.message;
        const feedRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: genPost.fullText,
            access_token: activeToken
          })
        });
        const feedData = await feedRes.json();
        if (feedData && (feedData.id || feedData.post_id)) {
          fbData = feedData;
          errorMsg = null;
        } else {
          errorMsg = firstErr;
        }
      }

      if (fbData && (fbData.id || fbData.post_id)) {
        postId = fbData.post_id || fbData.id;
        postUrl = `https://facebook.com/${postId}`;
        isLive = true;
      } else if (fbData && fbData.error) {
        errorMsg = fbData.error.message;
      }
    } catch (err) {
      errorMsg = err.message;
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toLocaleTimeString('vi-VN');

  const logEntry = {
    id: generateId('fpost', 8),
    pageId: page.id,
    pageName: page.name,
    title: genPost.title,
    pillar: genPost.pillar,
    pillarName: genPost.pillarName,
    content: genPost.fullText,
    imageUrl: genPost.imageUrl,
    date: todayStr,
    time: timeStr,
    slot: 'TRIGGER_MANUAL',
    status: isLive ? 'PUBLISHED' : (errorMsg ? 'ERROR' : 'SANDBOX_POSTED'),
    isLiveApi: isLive,
    postId: postId || `${page.id}_${Date.now()}`,
    postUrl: postUrl || `https://facebook.com/${page.id}`,
    error: errorMsg,
    createdAt: new Date().toISOString()
  };

  await addPostToFarmHistory(req.user.id, page.id, logEntry);

  res.json({
    success: true,
    isLiveApi: isLive,
    post: logEntry,
    message: isLive
      ? `🎉 Tuyệt vời! AI đã tự động sản xuất bài [${genPost.pillarName}] và đăng trực tiếp lên Fanpage "${page.name}" thành công!`
      : (errorMsg
          ? `⚠️ Meta Graph API phản hồi: "${errorMsg}". Bài viết mẫu đã được tạo và lưu vào lịch sử nuôi của Page.`
          : `🎉 AI đã tự động sản xuất bài viết mẫu [${genPost.pillarName}] cho Fanpage "${page.name}" (Nhập Page Token để đăng trực tiếp lên Facebook!).`)
  });
});

// Xem lịch sử bài đã đăng của 1 Fanpage
app.get('/api/fb/farm/:id/history', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const farm = await getFanpageFarm(req.user.id);
  const page = farm.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Fanpage' });
  res.json({ success: true, history: page.postHistory || [] });
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

// ----------------- AUTO-PILOT SCHEDULER (QUÉT MỖI PHÚT TỰ ĐỘNG ĐĂNG BÀI LÊN FANPAGE) -----------------
setInterval(async () => {
  try {
    const usersMap = await getAllUsers();
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayStr = now.toISOString().slice(0, 10);

    for (const user of Object.values(usersMap)) {
      const integration = await getFbIntegration(user.id);
      const queue = await getScheduledQueue(user.id);

      // 1. Kiểm tra Auto-Pilot đăng bài định kỳ mỗi ngày theo giờ vàng đã cài đặt
      if (integration && integration.connected && integration.autoScheduleEnabled && integration.dailyPostTime) {
        if (currentTimeStr === integration.dailyPostTime && integration.lastAutoPilotDate !== todayStr) {
          integration.lastAutoPilotDate = todayStr;
          await saveFbIntegration(user.id, integration);

          const niche = integration.niche || 'cong_nghe';
          const sampleProducts = {
            thoi_trang: 'Bộ sưu tập thời trang công sở & dạo phố cao cấp',
            my_pham: 'Serum dưỡng trắng căng bóng da mờ thâm nám',
            cong_nghe: 'Tai nghe Bluetooth không dây chống ồn cao cấp P9',
            gia_dung: 'Nồi chiên không dầu điện tử thông minh đa năng',
            me_be: 'Combo chăm sóc sức khỏe mẹ và bé hữu cơ an toàn',
            suc_khoe: 'Viên uống bổ sung khoáng chất tăng cường đề kháng',
            am_thuc: 'Đặc sản ăn vặt thơm ngon giòn rụm chuẩn vị',
            sach_giaoduc: 'Cuốn sách tư duy bứt phá thành công & tài chính',
            xe_co: 'Bộ phụ kiện nâng cấp nội thất xế yêu sang trọng',
            khac: 'Sản phẩm Best-Seller siêu ưu đãi trợ giá hôm nay'
          };
          const pName = sampleProducts[niche] || sampleProducts.khac;
          const posts = generateNichePosts(pName, niche, '199.000đ', 'Freeship toàn quốc + Quà tặng độc quyền', '199.000đ', '399.000đ');
          const chosenPost = posts[Math.floor(Math.random() * posts.length)];
          const fullContent = `${chosenPost.headline}\n\n${chosenPost.content}\n\n${chosenPost.hashtags}`;

          let postId = null;
          let postUrl = null;
          let isLive = false;

          if (integration.pageAccessToken && integration.pageAccessToken.trim().length > 20) {
            try {
              const fbRes = await fetch(`https://graph.facebook.com/v19.0/${integration.pageId}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: fullContent,
                  access_token: integration.pageAccessToken.trim()
                })
              });
              const fbData = await fbRes.json();
              if (fbData && (fbData.id || fbData.post_id)) {
                postId = fbData.post_id || fbData.id;
                postUrl = `https://facebook.com/${postId}`;
                isLive = true;
              }
            } catch (err) {
              console.error('Lỗi Auto-Pilot đăng bài hàng ngày:', err.message);
            }
          }

          queue.unshift({
            id: generateId('auto', 8),
            title: `[Auto-Pilot Hàng Ngày] ${pName}`,
            content: fullContent,
            status: isLive ? 'PUBLISHED' : 'PUBLISHED_DIRECT',
            mode: isLive ? 'META_GRAPH_API_AUTOPILOT' : 'DIRECT_PASTE',
            postId: postId || `${integration.pageId}_${Date.now()}`,
            postUrl: postUrl || integration.targetUrl || `https://facebook.com/${integration.pageId}`,
            publishedAt: new Date().toISOString(),
            adsLaunched: !!integration.autoRunAds
          });
          await saveScheduledQueue(user.id, queue.slice(0, 30));
        }
      }

      // 2. Quét các bài viết hẹn giờ cụ thể trong hàng đợi
      if (queue && queue.length > 0) {
        let modified = false;
        for (const item of queue) {
          if (item.status === 'PENDING' && item.scheduleTime) {
            const schedTime = new Date(item.scheduleTime);
            if (schedTime <= now) {
              if (integration && integration.pageAccessToken && integration.pageAccessToken.trim().length > 20) {
                try {
                  const fbRes = await fetch(`https://graph.facebook.com/v19.0/${integration.pageId}/feed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      message: item.content,
                      access_token: integration.pageAccessToken.trim()
                    })
                  });
                  const fbData = await fbRes.json();
                  if (fbData && (fbData.id || fbData.post_id)) {
                    item.status = 'PUBLISHED';
                    item.postId = fbData.post_id || fbData.id;
                    item.postUrl = `https://facebook.com/${item.postId}`;
                    item.publishedAt = new Date().toISOString();
                    item.mode = 'META_GRAPH_API_AUTOPILOT';
                    modified = true;
                  }
                } catch (err) {
                  console.error('Lỗi Auto-Pilot đăng bài queue:', err.message);
                }
              } else {
                item.status = 'READY_TO_POST';
                modified = true;
              }
            }
          }
        }
        if (modified) {
          await saveScheduledQueue(user.id, queue);
        }
      }

      // 3. Quét TẤT CẢ FANPAGE trong DÀN NUÔI (Multi-Fanpage Farm Auto-Pilot)
      const farm = await getFanpageFarm(user.id);
      for (const page of farm) {
        if (page.status === 'ACTIVE' && Array.isArray(page.dailySlots) && page.dailySlots.includes(currentTimeStr)) {
          const slotKey = `${todayStr}_${currentTimeStr}`;
          if (page.lastPostedSlotKey !== slotKey) {
            page.lastPostedSlotKey = slotKey;
            
            // Tự động sản xuất nội dung bài viết nuôi page theo đúng lĩnh vực và định hướng nội dung
            const genPost = generateAutonomousPost(page.niche, page.contentMix, page.affiliateLink);

            let isLive = false;
            let postId = null;
            let postUrl = null;
            let errorMsg = null;

            let activeToken = page.accessToken ? page.accessToken.trim() : '';
            let activePageId = page.id;

            if (activeToken && activeToken.length > 20) {
              try {
                const resolved = await resolvePageAccessToken(page.id, activeToken);
                if (resolved && resolved.token && resolved.token !== activeToken) {
                  activeToken = resolved.token;
                  await updateFanpageInFarm(user.id, page.id, {
                    accessToken: activeToken,
                    name: resolved.pageName || page.name,
                    category: resolved.category || page.category,
                    avatar: resolved.avatar || page.avatar
                  });
                  page.accessToken = activeToken;
                }
                if (resolved && resolved.pageId) {
                  activePageId = resolved.pageId;
                }

                // 1. Kiểm tra nếu có video thì đăng qua /videos, nếu là ảnh thì đăng qua /photos
                const mediaUrl = genPost.videoUrl || genPost.imageUrl;
                const isVideo = mediaUrl && /\.(mp4|mov|avi|wmv|m4v|webm)(\?.*)?$/i.test(mediaUrl);
                let fbRes;

                if (isVideo) {
                  fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/videos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      description: genPost.fullText,
                      title: genPost.title || 'Video Fanpage',
                      file_url: mediaUrl,
                      access_token: activeToken
                    })
                  });
                } else if (mediaUrl && mediaUrl.startsWith('http')) {
                  fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/photos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      caption: genPost.fullText,
                      url: mediaUrl,
                      access_token: activeToken
                    })
                  });
                } else {
                  fbRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      message: genPost.fullText,
                      access_token: activeToken
                    })
                  });
                }
                let fbData = await fbRes.json();

                // 2. Fallback sang /feed nếu /photos hoặc /videos gặp lỗi
                if (fbData && fbData.error) {
                  const firstErr = fbData.error.message;
                  const feedRes = await fetch(`https://graph.facebook.com/v19.0/${activePageId}/feed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      message: genPost.fullText,
                      access_token: activeToken
                    })
                  });
                  const feedData = await feedRes.json();
                  if (feedData && (feedData.id || feedData.post_id)) {
                    fbData = feedData;
                    errorMsg = null;
                  } else {
                    errorMsg = firstErr;
                  }
                }

                if (fbData && (fbData.id || fbData.post_id)) {
                  postId = fbData.post_id || fbData.id;
                  postUrl = `https://facebook.com/${postId}`;
                  isLive = true;
                } else if (fbData && fbData.error) {
                  errorMsg = fbData.error.message;
                }
              } catch (err) {
                errorMsg = err.message;
              }
            }

            const logEntry = {
              id: generateId('fpost', 8),
              pageId: page.id,
              pageName: page.name,
              title: genPost.title,
              pillar: genPost.pillar,
              pillarName: genPost.pillarName,
              content: genPost.fullText,
              imageUrl: genPost.imageUrl,
              date: todayStr,
              time: currentTimeStr,
              slot: currentTimeStr,
              status: isLive ? 'PUBLISHED' : (errorMsg ? 'ERROR' : 'SANDBOX_POSTED'),
              isLiveApi: isLive,
              postId: postId || `${page.id}_${Date.now()}`,
              postUrl: postUrl || `https://facebook.com/${page.id}`,
              error: errorMsg,
              createdAt: new Date().toISOString()
            };

            await addPostToFarmHistory(user.id, page.id, logEntry);
            await updateFanpageInFarm(user.id, page.id, { lastPostedSlotKey: slotKey, lastPostedDate: todayStr });
          }
        }
      }

      // 4. Tự động Quét & Phản hồi bình luận mới trên các Fanpage (Auto-Reply Worker)
      for (const page of farm) {
        if (page.status === 'ACTIVE' && page.accessToken && page.accessToken.trim().length > 20) {
          try {
            await scanAndReplyPageComments(user.id, page);
          } catch (errScan) {
            console.error('Lỗi scanAndReplyPageComments loop:', errScan.message);
          }
        }
      }
    }
  } catch (e) {}
}, 60000);

app.listen(PORT, () => {
  console.log(`Server Facebook Ads Suite & ShopeeFB DeepLinker đang chạy tại: http://localhost:${PORT}`);
});
