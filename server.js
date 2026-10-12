const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'links.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Đọc dữ liệu link lưu trữ (cho môi trường local)
function getStoredLinks() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {}
  return {};
}

function saveStoredLinks(links) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(links, null, 2), 'utf8');
  } catch (err) {}
}

function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Encode dữ liệu vào chuỗi Base64URL an toàn (Stateless - vĩnh viễn trên Vercel không cần Database)
function encodePayload(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function decodePayload(str) {
  try {
    const json = Buffer.from(str, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

// Gắn Sub-ID Tracking vào Shopee URL
function attachSubId(url, subId) {
  if (!subId) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('sub_id', subId);
    return parsed.toString();
  } catch (e) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}sub_id=${encodeURIComponent(subId)}`;
  }
}

// API: Tạo link chuyển hướng
app.post('/api/create', (req, res) => {
  let { targetUrl, title, description, imageUrl, voucher, subId, fomo } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link Shopee' });
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  // Gắn sub_id tracking nếu có
  if (subId) {
    targetUrl = attachSubId(targetUrl, subId);
  }

  const id = generateShortCode();
  const linkData = {
    id,
    targetUrl,
    title: title || 'Mua ngay trên Shopee - Ưu đãi giảm giá',
    description: description || 'Bấm vào để xem chi tiết sản phẩm và nhận mã giảm giá độc quyền trên Shopee!',
    imageUrl: imageUrl || 'https://cf.shopee.vn/file/default_shopee_og.png',
    voucher: (voucher || '').trim().toUpperCase(),
    subId: (subId || '').trim(),
    fomo: fomo !== false,
    createdAt: new Date().toISOString()
  };

  // Lưu database local
  const links = getStoredLinks();
  links[id] = { ...linkData, clicks: 0 };
  saveStoredLinks(links);

  // Tạo mã stateless để hoạt động trọn đời trên Vercel
  const statelessCode = encodePayload({
    u: linkData.targetUrl,
    t: linkData.title,
    d: linkData.description,
    i: linkData.imageUrl,
    v: linkData.voucher,
    f: linkData.fomo ? 1 : 0
  });

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  
  const shortUrl = `${protocol}://${host}/p/${statelessCode}`;

  res.json({
    success: true,
    data: {
      ...linkData,
      shortUrl
    }
  });
});

// API: Lấy danh sách link gần đây
app.get('/api/links', (req, res) => {
  const links = getStoredLinks();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');

  const list = Object.values(links)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      ...item,
      shortUrl: `${protocol}://${host}/r/${item.id}`
    }));

  res.json({ success: true, list });
});

// Render trang cầu nối Shopee Deep Link & Open Graph với tính năng CTR Booster
function renderBridgePage(req, res, linkData, currentUrl) {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|Pinterest|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Googlebot|bingbot/i.test(userAgent);

  const hasVoucher = Boolean(linkData.voucher);
  const showFomo = linkData.fomo !== false;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph Meta Tags cho Facebook -->
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
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(linkData.title)}">
  <meta name="twitter:description" content="${escapeHtml(linkData.description)}">
  <meta name="twitter:image" content="${escapeHtml(linkData.imageUrl)}">

  <!-- ULTRA-FAST 0ms INSTANT REDIRECT (Kích hoạt ngay khi nhận byte đầu tiên) -->
  ${isBot ? '<!-- Bot crawl meta: không redirect -->' : `
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

      if (isAndroid) {
        var cleanUrl = targetUrl.replace(/^https?:\\/\\//, '');
        var fallback = encodeURIComponent(targetUrl);
        window.location.replace('intent://' + cleanUrl + '#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=' + fallback + ';end;');
      } else if (isIOS) {
        window.location.replace('shopee://open?url=' + encodeURIComponent(targetUrl));
        setTimeout(function() {
          window.location.replace(targetUrl);
        }, 250);
      } else {
        window.location.replace(targetUrl);
      }
    })();
  </script>
  `}

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #334155;
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
      border-radius: 24px;
      padding: 28px 22px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .thumb {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 18px;
      margin: 0 auto 16px;
      display: block;
      box-shadow: 0 6px 16px rgba(0,0,0,0.1);
      border: 2px solid #ffedd5;
    }
    .title {
      font-size: 16px;
      font-weight: 800;
      line-height: 1.4;
      margin-bottom: 8px;
      color: #0f172a;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* FOMO Box */
    .fomo-box {
      background: #fff7ed;
      border: 1px dashed #fdba74;
      border-radius: 14px;
      padding: 10px 14px;
      margin: 14px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 700;
      color: #c2410c;
    }
    .live-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      margin-right: 4px;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Voucher Banner */
    .voucher-banner {
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      border-radius: 14px;
      padding: 12px;
      margin: 14px 0;
      text-align: left;
    }
    .voucher-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #047857;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .voucher-code-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px dashed #059669;
    }
    .voucher-code {
      font-family: monospace;
      font-size: 15px;
      font-weight: 800;
      color: #065f46;
    }
    .copy-pill {
      font-size: 11px;
      background: #059669;
      color: white;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3.5px solid #fed7aa;
      border-top-color: #ee4d2d;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 16px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: linear-gradient(135deg, #ee4d2d 0%, #ff6b35 100%);
      color: white;
      text-decoration: none;
      padding: 15px 12px;
      border-radius: 14px;
      font-weight: 800;
      font-size: 15px;
      box-sizing: border-box;
      box-shadow: 0 6px 18px rgba(238, 77, 45, 0.35);
      transition: transform 0.15s ease;
      letter-spacing: 0.3px;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .tips {
      margin-top: 14px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${escapeHtml(linkData.imageUrl)}" alt="Preview" class="thumb" onerror="this.style.display='none'">
    <div class="title">${escapeHtml(linkData.title)}</div>

    ${showFomo ? `
    <div class="fomo-box">
      <div><span class="live-dot"></span><span id="liveViewers">48</span> người đang xem</div>
      <div>⏳ <span id="countdown">04:59</span></div>
    </div>
    ` : ''}

    ${hasVoucher ? `
    <div class="voucher-banner">
      <div class="voucher-title">🎁 Đã tự động sao chép mã giảm giá:</div>
      <div class="voucher-code-wrap">
        <span class="voucher-code" id="vCode">${escapeHtml(linkData.voucher)}</span>
        <span class="copy-pill" id="vPill">Đã chép</span>
      </div>
      <div style="font-size: 10px; color: #047857; margin-top: 5px;">* Dán mã này tại bước thanh toán trong Shopee để được giảm giá.</div>
    </div>
    ` : ''}

    <div class="spinner"></div>

    <a id="openBtn" href="${escapeHtml(linkData.targetUrl)}" class="btn">
      🛍️ MỞ SHOPEE MUA NGAY
    </a>

    <div class="tips">Hệ thống đang mở App Shopee... Nếu không tự mở, hãy bấm nút cam phía trên.</div>
  </div>

  <script>
    (function() {
      const targetUrl = ${JSON.stringify(linkData.targetUrl)};
      const voucher = ${JSON.stringify(linkData.voucher || '')};
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isAndroid = /android/i.test(userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

      // 1. Tự động sao chép mã giảm giá vào Clipboard của khách
      if (voucher && navigator.clipboard) {
        navigator.clipboard.writeText(voucher).catch(function() {});
      }

      // 2. Chạy đếm ngược FOMO
      var countdownEl = document.getElementById('countdown');
      if (countdownEl) {
        var totalSec = 299; // 4 phút 59 giây
        setInterval(function() {
          if (totalSec > 0) {
            totalSec--;
            var m = Math.floor(totalSec / 60);
            var s = totalSec % 60;
            countdownEl.innerText = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
          }
        }, 1000);
      }

      // Giả lập số người xem dao động
      var liveEl = document.getElementById('liveViewers');
      if (liveEl) {
        setInterval(function() {
          var delta = Math.floor(Math.random() * 5) - 2;
          var cur = parseInt(liveEl.innerText, 10) + delta;
          if (cur < 28) cur = 32;
          if (cur > 92) cur = 85;
          liveEl.innerText = cur;
        }, 3000);
      }

      // 3. Xây dựng Deep Link Shopee
      let deepLink = targetUrl;
      if (isAndroid) {
        const encodedTarget = encodeURIComponent(targetUrl);
        deepLink = 'intent://' + targetUrl.replace(/^https?:\\/\\//, '') + 
                   '#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=' + encodedTarget + ';end;';
      } else if (isIOS) {
        deepLink = 'shopee://open?url=' + encodeURIComponent(targetUrl);
      }

      const btn = document.getElementById('openBtn');
      if (btn) {
        btn.href = targetUrl;
        btn.onclick = function() {
          if (deepLink && deepLink !== targetUrl) {
            window.location.href = deepLink;
            setTimeout(function() {
              window.location.href = targetUrl;
            }, 1000);
            return false;
          }
        };
      }
    })();
  </script>
</body>
</html>`;

  res.send(html);
}

// Route 1: Stateless URL (/p/:code) -> Vĩnh viễn trên Vercel không cần Database
app.get('/p/:code', (req, res) => {
  const { code } = req.params;
  const decoded = decodePayload(code);

  if (!decoded || !decoded.u) {
    return res.status(404).send('Liên kết không hợp lệ!');
  }

  const linkData = {
    targetUrl: decoded.u,
    title: decoded.t,
    description: decoded.d,
    imageUrl: decoded.i,
    voucher: decoded.v,
    fomo: decoded.f !== 0
  };

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const currentUrl = `${protocol}://${host}/p/${code}`;

  renderBridgePage(req, res, linkData, currentUrl);
});

// Route 2: Lưu database (/r/:id)
app.get('/r/:id', (req, res) => {
  const { id } = req.params;
  const links = getStoredLinks();
  const linkData = links[id];

  if (!linkData) {
    return res.status(404).send('Liên kết không tồn tại!');
  }

  linkData.clicks = (linkData.clicks || 0) + 1;
  saveStoredLinks(links);

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const currentUrl = `${protocol}://${host}/r/${id}`;

  renderBridgePage(req, res, linkData, currentUrl);
});

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});
