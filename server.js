const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'links.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Đọc dữ liệu link lưu trữ (cho môi trường có ghi file)
function getStoredLinks() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    // Trên Vercel serverless có thể chỉ đọc
  }
  return {};
}

function saveStoredLinks(links) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(links, null, 2), 'utf8');
  } catch (err) {
    // Ignored nếu môi trường read-only như Vercel
  }
}

function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Encode dữ liệu vào chuỗi an toàn cho URL (Stateless - chạy vĩnh viễn trên Vercel không cần Database)
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

// API: Tạo link chuyển hướng
app.post('/api/create', (req, res) => {
  let { targetUrl, title, description, imageUrl } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link Shopee' });
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  const id = generateShortCode();
  const linkData = {
    id,
    targetUrl,
    title: title || 'Mua ngay trên Shopee - Ưu đãi giảm giá',
    description: description || 'Bấm vào để xem chi tiết sản phẩm và nhận mã giảm giá độc quyền trên Shopee!',
    imageUrl: imageUrl || 'https://cf.shopee.vn/file/default_shopee_og.png',
    createdAt: new Date().toISOString()
  };

  // Lưu file nếu được
  const links = getStoredLinks();
  links[id] = { ...linkData, clicks: 0 };
  saveStoredLinks(links);

  // Tạo mã stateless để hoạt động trọn đời trên Vercel không phụ thuộc database
  const statelessCode = encodePayload({
    u: linkData.targetUrl,
    t: linkData.title,
    d: linkData.description,
    i: linkData.imageUrl
  });

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  
  // Trả về link dạng stateless `/p/:code` (chạy mượt mà trên Vercel)
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

// Hàm render trang cầu nối Shopee Deep Link & Open Graph
function renderBridgePage(req, res, linkData, currentUrl) {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|Facebot|Twitterbot|Pinterest|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Googlebot|bingbot/i.test(userAgent);

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph Meta Tags cho Facebook -->
  <title>${escapeHtml(linkData.title)}</title>
  <meta name="description" content="${escapeHtml(linkData.description)}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(linkData.title)}">
  <meta property="og:description" content="${escapeHtml(linkData.description)}">
  <meta property="og:image" content="${escapeHtml(linkData.imageUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(linkData.title)}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(linkData.title)}">
  <meta name="twitter:description" content="${escapeHtml(linkData.description)}">
  <meta name="twitter:image" content="${escapeHtml(linkData.imageUrl)}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
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
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .thumb {
      width: 110px;
      height: 110px;
      object-fit: cover;
      border-radius: 16px;
      margin: 0 auto 18px;
      display: block;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #fed7aa;
      border-top-color: #ee4d2d;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.4;
      margin-bottom: 8px;
      color: #0f172a;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: #ee4d2d;
      color: white;
      text-decoration: none;
      padding: 14px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 16px;
      box-sizing: border-box;
      box-shadow: 0 4px 14px rgba(238, 77, 45, 0.35);
      transition: background 0.2s;
    }
    .btn:hover {
      background: #d73211;
    }
    .tips {
      margin-top: 16px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${escapeHtml(linkData.imageUrl)}" alt="Preview" class="thumb" onerror="this.style.display='none'">
    <div class="title">${escapeHtml(linkData.title)}</div>
    <div class="subtitle">Đang mở ứng dụng Shopee...</div>
    
    <div class="spinner"></div>

    <a id="openBtn" href="${escapeHtml(linkData.targetUrl)}" class="btn">
      🛍️ MỞ ỨNG DỤNG SHOPEE NGAY
    </a>

    <div class="tips">Nếu ứng dụng không tự mở trong vài giây, hãy bấm nút cam phía trên.</div>
  </div>

  <script>
    (function() {
      const targetUrl = ${JSON.stringify(linkData.targetUrl)};
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isAndroid = /android/i.test(userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

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

      ${isBot ? '// Bot crawl meta' : `
      window.onload = function() {
        if (isAndroid || isIOS) {
          window.location.href = deepLink;
          setTimeout(function() {
            window.location.href = targetUrl;
          }, 1200);
        } else {
          setTimeout(function() {
            window.location.href = targetUrl;
          }, 400);
        }
      };
      `}
    })();
  </script>
</body>
</html>`;

  res.send(html);
}

// Route 1: Stateless URL (/p/:code) -> Hoạt động vĩnh viễn trên Vercel không cần Database
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
    imageUrl: decoded.i
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
