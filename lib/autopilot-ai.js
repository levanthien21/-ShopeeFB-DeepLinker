// lib/autopilot-ai.js - Động cơ AI tự động sản xuất nội dung nuôi Fanpage (Auto-Pilot Content Engine)

const LINK_PLACEHOLDER = '{{AFFILIATE_LINK}}';

const NICHE_DATA = {
  thoi_trang: {
    name: 'Thời trang & Phụ kiện',
    defaultImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800',
    knowledge: [
      {
        title: '4 Quy Tắc Phối Đồ Tôn Dáng Cực Đỉnh Cho Nàng Nấm Lùn',
        headline: '👗 4 MẸO HACK DÁNG CHO NÀNG DƯỚI 1M55 - CAO HƠN 5CM TRONG 1 NỐT NHẠC!',
        content: `Nhiều bạn nghĩ người thấp thì khó mặc đồ đẹp, nhưng thực tế bí quyết chỉ nằm ở tỷ lệ trang phục thôi đó ạ! Cùng lưu lại ngay 4 mẹo phối đồ cực kỳ đơn giản này nhé:

1️⃣ Ưu tiên quần/chân váy cạp cao: Đây là "vũ khí tối thượng" giúp kéo dài đôi chân, tạo cảm giác tỷ lệ cơ thể 3:7 chuẩn mẫu.
2️⃣ Sơ vin (Tuck-in) gọn gàng: Dù mặc áo phông hay sơ mi, việc sơ vin vạt trước hoặc toàn bộ sẽ giúp cơ thể thanh thoát hơn rất nhiều.
3️⃣ Phối đồ cùng tông màu (Monochrome): Diện 1 tone màu từ trên xuống dưới giúp ánh nhìn liền mạch, đánh lừa thị giác người đối diện.
4️⃣ Chọn họa tiết sọc dọc mảnh: Tránh xa các họa tiết kẻ ngang to bản kẻo cơ thể bị bè ngang nhé.

✨ Thời trang không giới hạn ở chiều cao, quan trọng nhất là bạn tự tin và hiểu rõ cơ thể mình!`,
        hashtags: '#MeoPhoiDo #ThoiTrangNu #HackDang #OutfitMoiNgay #TuTinToaSang',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800'
      },
      {
        title: 'Cách Giữ Quần Áo Luôn Bền Màu & Không Nhão Sau Khi Giặt',
        headline: '🧺 3 BÍ QUYẾT BẢO QUẢN QUẦN ÁO BỀN ĐẸP NHƯ MỚI TẠI NHÀ!',
        content: `Có những món đồ vừa mua tuần trước, giặt vài lần đã bai nhão và phai màu? Đó là vì bạn chưa áp dụng đúng các bước này:

💡 Luôn lộn trái áo quần trước khi phơi: Ánh nắng mặt trời trực tiếp chính là nguyên nhân lớn nhất làm sợi vải bị xơ và phai màu.
💡 Dùng túi giặt cho đồ len và cotton co giãn: Ngăn quần áo bị vặn xoắn và kéo giãn trong lồng giặt.
💡 Hạn chế dùng nước nóng quá 40 độ: Nhiệt độ cao làm hỏng cấu trúc sợi spandex và cotton.

Hãy yêu thương và chăm sóc tủ đồ của mình đúng cách để luôn diện đồ đẹp mỗi ngày nhé! ❤️`,
        hashtags: '#ChamSocQuanAo #MeoVatCuocSong #ThoiTrangBenVung #OutfitTips',
        image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800'
      }
    ],
    engagement: [
      {
        title: 'Bạn thuộc Team Đơn giản hay Team Cá tính?',
        headline: '👠 BÌNH CHỌN: GU ĂN MẶC CỦA BẠN THUỘC PHONG CÁCH NÀO?',
        content: `Mỗi phong cách thời trang đều nói lên một phần cá tính riêng biệt của chúng mình:

👉 Team 1 (Thả Tim ❤️): Basic & Thanh lịch - Áo thun trắng, quần jeans, blazer tối giản, nhẹ nhàng nhưng sang trọng.
👉 Team 2 (Thả Like 👍): Năng động & Streetwear - Áo hoodie oversize, sneaker, túi đeo chéo cực chất.
👉 Team 3 (Thả Thương Thương 🥰): Bánh bèo & Nữ tính - Đầm hoa nhí, chân váy bồng bềnh, phụ kiện vintage ngọt ngào.

Bạn thuộc team nào? Để lại bình luận bên dưới xem team nào đông nhất nhé! 👇`,
        hashtags: '#BinhChonThoiTrang #GuThoiTrang #OOTD #GocChiEm #StyleCheck',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800'
      }
    ],
    review: [
      {
        title: 'Review Chiếc Áo Blazer Quốc Dân Đi Làm Hay Đi Chơi Đều Đẹp',
        headline: '✨ TRẢI NGHIỆM CHÂN THỰC: CHIẾC BLAZER MÀ NÀNG NÀO CŨNG NÊN CÓ TRONG TỦ!',
        content: `Sau gần 2 tháng diện em nó liên tục từ đi làm, đi họp đến dạo phố cuối tuần, mình phải công nhận em blazer này xứng đáng 10/10 điểm:

🌿 Form áo đứng dáng, có đệm vai nhẹ vừa phải không bị cứng hay thô.
🌿 Chất vải tuyết mưa dày dặn, không nhăn nhúm dù ngồi làm việc cả ngày.
🌿 Dễ phối đồ dã man: mix với áo thun trắng + quần jeans là chuẩn Hàn Quốc, mix với đầm dài thì vừa sang vừa thanh lịch.

Điểm trừ duy nhất là quá hot nên hay bị hết size nếu không canh sớm thôi ạ! Chị em đang tìm blazer chuẩn form thì đừng bỏ qua em này nhé!`,
        hashtags: '#ReviewThoiTrang #BlazerDep #OutfitCongSo #GocReview',
        image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800'
      }
    ],
    sales: [
      {
        title: 'Flash Sale Set Đồ Mùa Mới Trợ Giá Sốc',
        headline: '🔥 [SIÊU SALE ĐỘC QUYỀN] SET ĐỒ HOT-HIT MÙA NÀY GIẢM ĐẾN 45%!',
        content: `Cơ hội F5 tủ đồ với mức giá hời nhất mùa săn sale đây các nàng ơi! 
Set trang phục thiết kế chuẩn form dáng, chất liệu thoáng mát cao cấp giúp bạn tự tin tỏa sáng mọi góc nhìn.

🎁 ĐẶC QUYỀN DUY NHẤT HÔM NAY:
- Giảm ngay 45% giá gốc trên bài viết này.
- Tặng kèm voucher Freeship toàn quốc 0đ.
- Kiểm tra hàng chuẩn đẹp trước khi nhận!

${LINK_PLACEHOLDER}
👇 Để lại bình luận hoặc nhắn tin cho shop để nhận ngay mã ưu đãi số lượng có hạn nhé!`,
        hashtags: '#SaleThoiTrang #GiamGiaSoc #SanDealGiaTot #DealShopee #Freeship',
        image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800'
      }
    ]
  },

  my_pham: {
    name: 'Mỹ phẩm & Chăm sóc da',
    defaultImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
    knowledge: [
      {
        title: '5 Sai Lầm Khi Dưỡng Ẩm Khiến Da Nổi Mụn',
        headline: '🧴 5 SAI LẦM KHI BÔI KEM DƯỠNG KHIẾN DA MÃI KHÔNG ĐẸP MÀ CÒN BÍ TẮC LỖ CHÂN LÔNG!',
        content: `Dưỡng ẩm là bước cốt lõi trong routine chăm da, nhưng bôi sai cách thì công sức đổ sông đổ bể:

❌ Bôi kem khi da đã khô cong: Lúc này da khó hấp thụ hoạt chất nhất. Hãy bôi kem khi da còn hơi ẩm sau bước toner/serum.
❌ Bôi lượng quá dày: Da chỉ hấp thụ một lượng vừa đủ, bôi quá nhiều sẽ gây bít tắc sinh mụn ẩn.
❌ Bỏ qua bước chống nắng: Dưỡng ẩm kỹ đến mấy mà không chống nắng thì tia UV vẫn phá vỡ collagen và hàng rào bảo vệ da.
❌ Không tẩy tế bào chết định kỳ: Lớp sừng già ngăn cản dưỡng chất thẩm thấu sâu.

Chăm sóc da là một hành trình kiên nhẫn. Lắng nghe làn da mỗi ngày bạn nhé! ✨`,
        hashtags: '#SkincareTips #ChamSocDa #DuongAmDungCach #DaDepMoiNgay #LamDep',
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800'
      }
    ],
    engagement: [
      {
        title: 'Routine Skincare Tối Của Bạn Có Mấy Bước?',
        headline: '✨ KHẢO SÁT NHANH: ROUTINE BUỔI TỐI CỦA BẠN GỒM MẤY BƯỚC?',
        content: `Mỗi làn da là một thế giới riêng biệt! Hội chị em vào điểm danh xem routine của mình thuộc trường phái nào nhé:

1️⃣ Team Tối Giản (2-3 bước): Tẩy trang -> Sữa rửa mặt -> Kem dưỡng ẩm. Nhanh gọn đi ngủ sớm!
2️⃣ Team Chuẩn Chỉ (4-5 bước): Double cleansing -> Toner -> Serum phục hồi -> Kem dưỡng -> Dưỡng mắt.
3️⃣ Team 7 Bước Hàn Quốc: Đầy đủ tẩy da chết, essence, ampoule, mặt nạ, kem khóa ẩm chuyên sâu!

Bình luận số bước routine của bạn và tình trạng da hiện tại, shop tư vấn miễn phí cho mình nha! 👇`,
        hashtags: '#HoiDapSkincare #RoutineBuoiToi #DaCangBong #ChiaSeBiQuyet',
        image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800'
      }
    ],
    review: [
      {
        title: 'Trải Nghiệm 2 Tuần Dùng Serum B5 Phục Hồi Căng Bóng',
        headline: '💧 REVIEW 14 NGÀY DÙNG SERUM B5: CỨU TINH CHO LÀN DA YẾU & MẪN ĐỎ!',
        content: `Đợt vừa rồi da mình bị kích ứng do thay đổi thời tiết, khô rát và bong tróc kinh khủng. Quyết định thử em serum B5 này theo lời khuyên của bạn thân:

✨ Kết cấu: Thấm siêu nhanh, không gây bết dính hay bóng dầu khó chịu.
✨ Hiệu quả: Sau 3 ngày, cảm giác rát đỏ dịu hẳn. Sau 14 ngày, da mọng nước, căng bóng tự nhiên và hàng rào bảo vệ da khỏe khoắn hơn hẳn.

Một em serum chân ái rất đáng thử cho ai có nền da nhạy cảm hoặc đang treatment nhé!`,
        hashtags: '#ReviewMyPham #SerumB5 #PhucHoiDa #DaKho #SkincareReview',
        image: 'https://images.unsplash.com/photo-1608248597359-0a56247c1a84?w=800'
      }
    ],
    sales: [
      {
        title: 'Deal Mỹ Phẩm Chính Hãng Tặng Quà Cực Hot',
        headline: '🎁 [ĐẠI TIỆC CHĂM DA] SERUM CĂNG BÓNG DA TRỢ GIÁ 50% DUY NHẤT HÔM NAY!',
        content: `Da căng mướt chuẩn gái Hàn không khó khi đã có bí quyết chăm da khoa học!
Lô hàng chính hãng tem phụ đầy đủ, date mới nhất vừa về kho:

🔥 ƯU ĐÃI ĐỘC QUYỀN HÔM NAY:
- Giảm ngay 50% so với giá niêm yết showroom.
- Tặng kèm mặt nạ dưỡng ẩm chuyên sâu.
- Cam kết 100% chính hãng, hoàn tiền 200% nếu phát hiện hàng nhái.

${LINK_PLACEHOLDER}
👇 Bình luận "DA ĐẸP" để shop gửi mã ưu đãi và tư vấn routine phù hợp nhất với da bạn nhé!`,
        hashtags: '#MyPhamChinhHang #SaleMyPham #SanDealGiaTot #DealShopee #DaDepDonTet',
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800'
      }
    ]
  },

  cong_nghe: {
    name: 'Đồ công nghệ & Phụ kiện ĐT',
    defaultImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    knowledge: [
      {
        title: '3 Mẹo Tối Ưu Pin Điện Thoại Đơn Giản Ít Người Để Ý',
        headline: '⚡ 3 THỦ THUẬT KÉO DÀI TUỔI THỌ PIN ĐIỆN THOẠI THÊM 2 NĂM!',
        content: `Pin chai là nỗi ám ảnh lớn nhất của người dùng smartphone. Bỏ túi ngay 3 thói quen cực kỳ hữu ích này:

1️⃣ Đừng để pin sập nguồn về 0%: Cơ chế pin Lithium-ion hoạt động tốt nhất trong khoảng 20% - 85%. Việc xả cạn kiệt pin sẽ làm giảm chu kỳ sạc nhanh chóng.
2️⃣ Tránh vừa dùng vừa sạc tác vụ nặng: Chơi game hoặc render video lúc sạc làm máy nóng ran, kẻ thù số 1 của tuổi thọ pin.
3️⃣ Tắt định vị và Bluetooth chạy ngầm khi không dùng: Giúp tiết kiệm 15-20% dung lượng pin mỗi ngày.

Áp dụng ngay hôm nay để bảo vệ chiếc dế yêu của bạn nhé! 📱`,
        hashtags: '#MeoCongNghe #BaoVePin #ThuThuatDienThoai #TechTips #SmartPhone',
        image: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800'
      }
    ],
    engagement: [
      {
        title: 'Bạn đang dùng iOS hay Android?',
        headline: '📱 ĐẠI CHIẾN CÔNG NGHỆ: BẠN THUỘC HỆ ĐIỀU HÀNH NÀO?',
        content: `Cuộc tranh luận bất tận giữa 2 thế giới công nghệ:

🍎 Team Táo Khuyết (iOS): Mượt mà, bảo mật cao, hệ sinh thái đồng bộ hoàn hảo, dùng 4-5 năm vẫn mượt.
🤖 Team Robot Xanh (Android): Tùy biến cực đã, sạc siêu nhanh 67W-120W, màn hình 120Hz mượt mắt, giá thành hợp lý.

Hiện tại bạn đang cầm trên tay chiếc điện thoại nào? Cùng chia sẻ cảm nhận bên dưới nhé! 👇`,
        hashtags: '#DaiChienCongNghe #iOSvsAndroid #CongDongCongNghe #TechFan',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800'
      }
    ],
    review: [
      {
        title: 'Đánh Giá Tai Nghe Bluetooth Chống Ồn Phân Khúc Học Sinh Sinh Viên',
        headline: '🎧 ĐÁNH GIÁ CHÂN THỰC: TAI NGHE KHÔNG DÂY CHỐNG ỒN DƯỚI 500K CÓ ĐÁNG TIỀN?',
        content: `Cày cuốc trải nghiệm hơn 3 tuần liên tục từ đi làm, chạy bộ đến học tập trong quán cà phê ồn ào:

✅ Điểm cộng:
- Chống ồn chủ động (ANC) lọc tiếng xe cộ và tiếng nói chuyện xung quanh cực ổn áp.
- Bass đánh chắc, nghe nhạc EDM hay Podcast đều rõ lời.
- Pin trâu 6 tiếng liên tục, kèm dock sạc dùng cả tuần mới phải cắm điện một lần.

❌ Điểm trừ: Mic đàm thoại ngoài gió to hơi bị vọng tiếng một chút, nhưng trong tầm giá này thì không có đối thủ!`,
        hashtags: '#ReviewCongNghe #TaiNgheBluetooth #AmThanhChatLuong #TechReview',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'
      }
    ],
    sales: [
      {
        title: 'Flash Sale Phụ Kiện Sạc Nhanh Cao Cấp',
        headline: '🚀 DEAL CÔNG NGHỆ BÙNG NỔ: BỘ CỦ CÁP SẠC NHANH TRỢ GIÁ KHỦNG HÔM NAY!',
        content: `Không còn phải chờ đợi 2-3 tiếng để sạc đầy điện thoại nữa! 
Bộ củ sạc GaN công nghệ mới nhỏ gọn bằng 1/2 củ sạc truyền thống nhưng công suất vượt trội:

⚡ Sạc 50% pin chỉ trong 25 phút.
⚡ Chip thông minh tự ngắt khi đầy, chống cháy nổ và nóng máy tuyệt đối.
⚡ Bảo hành 1 đổi 1 trong 12 tháng nếu có bất kỳ lỗi nào!

${LINK_PLACEHOLDER}
👇 Nhắn tin hoặc để lại bình luận để nhận mã giảm giá và Freeship ngay hôm nay!`,
        hashtags: '#SacNhanh #DealCongNghe #PhuKienChinhHang #DealShopee #TechSale',
        image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'
      }
    ]
  },

  gia_dung: {
    name: 'Đồ gia dụng & Tiện ích nhà cửa',
    defaultImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800',
    knowledge: [
      {
        title: '4 Mẹo Vệ Sinh Bếp Cực Nhanh Không Cần Hóa Chất Độc Hại',
        headline: '🍳 4 MẸO DỌN DẸP BẾP SẠCH BONG KIN KÍT CHỈ VỚI BAKING SODA & GIẤM TRẮNG!',
        content: `Dầu mỡ bám dính lâu ngày khiến căn bếp ngột ngạt và khó lau chùi? Hãy thử ngay mẹo tự nhiên an toàn này:

1️⃣ Đánh bay vết cháy đáy nồi: Đun sôi hỗn hợp nước + giấm trắng, sau đó cho 2 thìa baking soda vào ngâm 15 phút. Vết đen bong ra cực dễ.
2️⃣ Làm sạch kiềng bếp ga và mặt kính: Pha xịt giấm loãng, rắc nhẹ baking soda lên rồi lau bằng khăn sợi microfiber.
3️⃣ Khử mùi tủ lạnh: Đặt một chén bã cà phê hoặc baking soda ở góc tủ, hút sạch mùi hôi thức ăn trong 24h.

Nhà sạch thì mát, bát sạch ngon cơm. Lưu lại áp dụng cho cuối tuần này nhé cả nhà! 🏡`,
        hashtags: '#MeoVatNhaBep #NhaCuaDoiSong #GiaDungThongMinh #MeoDonNha',
        image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800'
      }
    ],
    engagement: [
      {
        title: 'Món Đồ Gia Dụng Nào Bạn Thấy Đáng Mua Nhất?',
        headline: '🏡 CHIA SẺ: MÓN ĐỒ GIA DỤNG NÀO ĐÃ "GIẢI CỨU" CUỘC ĐỜI LÀM VIỆC NHÀ CỦA BẠN?',
        content: `Thời đại công nghệ giúp việc nhà thảnh thơi hơn gấp 10 lần. Giữa những trợ thủ đắc lực này:

1️⃣ Nồi chiên không dầu (Bỏ đồ vào hẹn giờ là có đồ ăn ngon)
2️⃣ Robot hút bụi / Máy hút bụi cầm tay (Tạm biệt cảnh quét nhà mỏi lưng)
3️⃣ Máy rửa bát (Chân ái hòa thuận gia đình)
4️⃣ Nồi nấu chậm / Máy làm sữa hạt đa năng

Món đồ nào bạn thấy đáng đồng tiền bát gạo nhất? Kể cho mọi người nghe cùng học hỏi nhé! 👇`,
        hashtags: '#HoiDapGiaDung #GiaDungTienIch #ViecNhaThanhThoi #YeuBepYeuNha',
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800'
      }
    ],
    review: [
      {
        title: 'Review Nồi Chiên Không Dầu Sau 6 Tháng Sử Dụng Hàng Ngày',
        headline: '✨ TRẢI NGHIỆM THỰC TẾ: CÓ NÊN MUA NỒI CHIÊN KHÔNG DẦU KHÔNG?',
        content: `Trước khi mua mình cũng đắn đo sợ mua về chật bếp rồi bỏ xó. Nhưng sau nửa năm thì ngày nào nhà mình cũng dùng ít nhất 2 lần:

🥩 Giảm 85% lượng dầu mỡ so với chiên rán thông thường, ăn uống healthy hơn hẳn.
🥩 Không lo bị bắn dầu bỏng tay hay ám mùi khắp gian nhà.
🥩 Nướng gà, chiên khoai, nướng bánh mì ăn sáng siêu tiện lợi chỉ 10-15 phút.

Khuyên thật lòng gia đình nào có con nhỏ hoặc người lớn tuổi nên sắm một chiếc để ăn uống thanh đạm, bảo vệ sức khỏe tim mạch nhé!`,
        hashtags: '#ReviewGiaDung #NoiChienKhongDau #MonNgonMoiNgay #YeuBep',
        image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800'
      }
    ],
    sales: [
      {
        title: 'Xả Kho Thiết Bị Gia Dụng Tiện Ích Trợ Giá Khủng',
        headline: '🔥 SIÊU DEAL TIỆN ÍCH GIA ĐÌNH: GIẢM NGAY 40% CÙNG FREESHIP TOÀN QUỐC!',
        content: `Nâng cấp không gian sống hiện đại, tiện nghi và tiết kiệm thời gian nội trợ mỗi ngày!
Sản phẩm đồ gia dụng thông minh với chất liệu an toàn, thiết kế sang trọng đang có chương trình trợ giá tốt nhất tháng:

🎁 ĐẶC QUYỀN HÔM NAY:
- Mức giá trợ giá siêu hời tiết kiệm đến 40%.
- Bảo hành đổi mới nếu phát sinh lỗi kỹ thuật.
- Kiểm tra hàng cẩn thận trước khi thanh toán.

${LINK_PLACEHOLDER}
👇 Nhắn tin hoặc bình luận bên dưới để nhận mã giảm giá giao hàng tận nơi nhé!`,
        hashtags: '#GiaDungChinhHang #GiaDungThongMinh #DealGiaDung #DealShopee #NhaDep',
        image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800'
      }
    ]
  },

  me_be: {
    name: 'Mẹ & Bé',
    defaultImage: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800',
    knowledge: [
      {
        title: '3 Lưu Ý Vàng Giúp Bé Ngủ Ngon Sâu Giấc Cả Đêm',
        headline: '🍼 3 BÍ QUYẾT RÈN BÉ NGỦ XUYÊN ĐÊM - MẸ NHÀN CON KHỎE!',
        content: `Giấc ngủ đóng vai trò quyết định đến sự phát triển trí não và chiều cao của bé yêu. Mẹ bỉm bỏ túi ngay:

1️⃣ Tạo môi trường ngủ chuẩn: Phòng ngủ thoáng mát (24-26 độ C), ánh sáng dịu nhẹ và hạn chế tiếng ồn đột ngột.
2️⃣ Phân biệt ngày và đêm: Ban ngày giữ ánh sáng tự nhiên và sinh hoạt bình thường. Ban đêm hạ đèn tối, yên tĩnh để bé nhận thức chu kỳ sinh học.
3️⃣ Thiết lập chu trình trước khi ngủ (Bedtime routine): Tắm nước ấm -> Massage nhẹ nhàng -> Đọc sách/hát ru -> Đặt bé vào cũi lúc còn lơ mơ ngủ.

Chúc các thiên thần nhỏ luôn có giấc ngủ êm đềm để lớn khôn mỗi ngày! 👶❤️`,
        hashtags: '#ChamConKhoaHoc #MeVaBe #GiacNguCuaBe #MeBimSua #NuoiConKhongPhaiLaCuocChien',
        image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800'
      }
    ],
    engagement: [
      {
        title: 'Chia sẻ khoảnh khắc đáng yêu của bé hôm nay',
        headline: '👶 GÓC TÂM SỰ MẸ BỈM: KHOẢNH KHẮC ĐÁNG YÊU NHẤT CỦA BÉ HÔM NAY LÀ GÌ?',
        content: `Dù chăm con cả ngày có mệt mỏi đến đâu, chỉ cần nhìn thấy nụ cười của con là mọi âu lo tan biến hết!
Hôm nay em bé nhà bạn đã biết làm thêm điều gì mới lạ chưa?
- Biết cười toe toét khi nghe mẹ gọi tên?
- Biết ê a tập nói hay đang chập chững những bước đi đầu đời?

Các mẹ vào chia sẻ ảnh hoặc khoảnh khắc ấm áp của con để cùng tiếp thêm năng lượng tích cực cho nhau nhé! 🥰👇`,
        hashtags: '#TamSuMeBim #BeYeu #KhoanhKhacDangYeu #GiaDinhNho #YeuCon',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800'
      }
    ],
    review: [
      {
        title: 'Review Đồ Dùng Ăn Dặm An Toàn Cho Bé',
        headline: '🌿 REVIEW BỘ DỤNG CỤ ĂN DẶM SILICONE HỮU CƠ: MẸ YÊN TÂM, BÉ HỨNG THÚ!',
        content: `Đến giai đoạn con tập ăn dặm, tìm được dụng cụ vừa an toàn vừa dễ vệ sinh làm mình đau đầu mất mấy tuần:

🍼 Chất liệu silicone thực phẩm chuẩn FDA, không chứa BPA độc hại, rơi không lo vỡ.
🍼 Thiết kế đế hít chân không siêu chắc, bé không hất đổ bát thức ăn ra sàn được.
🍼 Muỗng nĩa bo tròn mềm mại, không làm tổn thương nướu non của con.

Mẹ nào đang chuẩn bị cho bé ăn dặm thì rất nên tham khảo bộ này nha!`,
        hashtags: '#ReviewDoMeBe #AnDamCungBe #SiliconeAnToan #MeThongThai',
        image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800'
      }
    ],
    sales: [
      {
        title: 'Ưu Đãi Combo Chăm Sóc Mẹ & Bé Toàn Diện',
        headline: '🎁 [ĐẶC QUYỀN MẸ VÀ BÉ] SẢN PHẨM CHÍNH HÃNG AN TOÀN TRỢ GIÁ ĐẾN 40%!',
        content: `Dành trọn những điều tuyệt vời và an lành nhất cho hành trình khôn lớn của con yêu!
Các dòng sản phẩm chăm sóc bé hữu cơ đạt chứng nhận an toàn quốc tế đang có chương trình tri ân đặc biệt:

✨ Giảm giá trực tiếp lên đến 40%.
✨ Tặng kèm quà tặng gặm nướu / khăn sợi tre kháng khuẩn.
✨ Đóng gói kỹ lưỡng, giao hàng tận nhà nhanh chóng.

${LINK_PLACEHOLDER}
👇 Mẹ nhắn tin cho shop hoặc để lại bình luận để nhận tư vấn theo tháng tuổi của bé nhé!`,
        hashtags: '#SaleMeBe #DoChoiTreEm #DoSoSinh #DealShopee #ChamSocBe',
        image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800'
      }
    ]
  },

  suc_khoe: {
    name: 'Sức khỏe & Thể thao',
    defaultImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800',
    knowledge: [
      {
        title: '5 Thói Quen Đốt Mỡ Tự Nhiên Buổi Sáng',
        headline: '💪 5 THÓI QUEN NHỎ BUỔI SÁNG GIÚP KÍCH HOẠT TRAO ĐỔI CHẤT & GIỮ DÁNG EO THON!',
        content: `Không cần kiêng khem khắc nghiệt, chỉ cần duy trì 5 thói quen lành mạnh này mỗi sáng:

1️⃣ Uống 1 ly nước ấm ngay khi thức dậy: Đánh thức hệ tiêu hóa và thanh lọc độc tố sau 8 tiếng ngủ say.
2️⃣ Vận động nhẹ nhàng 15 phút: Bài tập giãn cơ (stretching) hoặc yoga nhẹ giúp máu huyết lưu thông và tỉnh táo tức thì.
3️⃣ Đón ánh nắng sớm 10 phút: Cung cấp Vitamin D tự nhiên và cân bằng nhịp sinh học cơ thể.
4️⃣ Ăn bữa sáng giàu đạm (Protein): Trứng luộc, ức gà, các loại hạt giúp no lâu và không thèm ăn vặt giữa buổi.
5️⃣ Hít thở sâu và cười thật tươi: Tinh thần sảng khoái là chìa khóa của một hệ miễn dịch khỏe mạnh!

Khởi đầu ngày mới tràn đầy năng lượng bạn nhé! 🌿`,
        hashtags: '#SongKhoeMoiNgay #GiuDang #SucKhoeChuDong #ThoiQuenTot #HealthyLife',
        image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800'
      }
    ],
    engagement: [
      {
        title: 'Mục tiêu sức khỏe tuần này của bạn là gì?',
        headline: '🏃‍♂️ THỬ THÁCH SỐNG KHỎE: MỤC TIÊU CỦA BẠN TRONG TUẦN NÀY LÀ GÌ?',
        content: `Một tuần mới lại đến, hãy đặt cho mình ít nhất một mục tiêu nhỏ để cơ thể luôn dẻo dai:

1️⃣ Đi bộ đủ 8.000 bước mỗi ngày.
2️⃣ Uống đủ 2 lít nước lọc (giảm trà sữa và nước ngọt có gas).
3️⃣ Đi ngủ trước 23h đêm.
4️⃣ Tập thể dục ít nhất 30 phút x 3 buổi/tuần.

Bạn cam kết thực hiện mục tiêu nào? Cùng điểm danh bên dưới để có thêm động lực hoàn thành nhé! 👇`,
        hashtags: '#ThuThachSongKhoe #MucTieuTuanMoi #GymMotivation #SongLanhManh',
        image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800'
      }
    ],
    review: [
      {
        title: 'Trải Nghiệm Thức Uống Dinh Dưỡng Giàu Khoáng Chất',
        headline: '🥗 REVIEW THỰC TẾ: BỔ SUNG KHOÁNG CHẤT & DINH DƯỠNG CÓ THẬT SỰ HIỆU QUẢ?',
        content: `Sau gần 1 tháng kiên trì bổ sung đều đặn vào bữa xế chiều:

🌿 Cảm nhận rõ nhất là buổi chiều làm việc không còn bị tụt năng lượng hay ngáp vặt mệt mỏi.
🌿 Hệ tiêu hóa hoạt động trơn tru hơn nhờ lượng chất xơ và enzyme lành tính.
🌿 Vị thanh mát dễ uống, không bị gắt đường hóa học.

Sức khỏe là tài sản quý giá nhất, đầu tư cho dinh dưỡng là khoản đầu tư sinh lời nhất trong đời!`,
        hashtags: '#DinhDuongSach #SongKhoe #ReviewSucKhoe #EatClean',
        image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800'
      }
    ],
    sales: [
      {
        title: 'Flash Sale Sản Phẩm Chăm Sóc Sức Khỏe & Thể Thao',
        headline: '🔥 [ĐỒNG HÀNH SỨC KHỎE] BẢO VỆ GIA ĐÌNH VỚI ƯU ĐÃI TRỢ GIÁ 45%!',
        content: `Nâng cao sức đề kháng và giữ gìn vóc dáng thon gọn, dẻo dai mỗi ngày!
Sản phẩm chính hãng có chứng nhận nguồn gốc xuất xứ rõ ràng đang có đợt ưu đãi trợ giá lớn nhất mùa này:

💪 Giá ưu đãi giảm ngay 45% duy nhất hôm nay.
💪 Tặng kèm cẩm nang thực đơn dinh dưỡng khoa học.
💪 Giao hàng tận nơi, kiểm tra hàng thoải mái trước khi nhận!

${LINK_PLACEHOLDER}
👇 Để lại bình luận hoặc nhắn tin trực tiếp để nhận tư vấn chuyên sâu cho thể trạng của bạn nhé!`,
        hashtags: '#SucKhoeGiaDinh #SaleSucKhoe #DealShopee #SongKhoeDep #TangDeKhang',
        image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800'
      }
    ]
  },

  am_thuc: {
    name: 'Ẩm thực & Ăn vặt',
    defaultImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    knowledge: [
      {
        title: 'Bí Quyết Ướp Thịt Nướng Thơm Mềm Chuẩn Vị',
        headline: '🥩 BÍ QUYẾT ƯỚP THỊT NƯỚNG MỀM MỌNG KHÔNG BỊ KHÔ NHƯ NGOÀI HÀNG!',
        content: `Nhiều bạn ướp thịt nướng hay bị dai và khô cứng. Chỉ cần thêm 2 nguyên liệu bí mật này lúc ướp:

1️⃣ Một chút sữa đặc hoặc nước ép lê/táo: Giúp thớ thịt mềm ngọt tự nhiên mà không bị cháy khét.
2️⃣ Dầu hào và mật ong: Tạo màu cánh gián óng ả và hương thơm đậm đà nức mũi.
3️⃣ Ướp ít nhất 2 tiếng trong ngăn mát tủ lạnh trước khi nướng.

Cuối tuần mở tiệc BBQ tại nhà cùng gia đình và bạn bè thì ngon hết sẩy luôn nhé! 🥘`,
        hashtags: '#MonNgonMoiNgay #BiQuyetNauAn #VaoBepCungNhau #AmThucVietNam',
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'
      }
    ],
    engagement: [
      {
        title: 'Đại chiến món ăn vặt quốc dân',
        headline: '🤤 KÈO ĂN VẶT BUỔI CHIỀU: NẾU ĐƯỢC CHỌN 1 MÓN, BẠN CHỌN MÓN NÀO?',
        content: `Tầm 3-4h chiều mà chiếc bụng réo rắt thì chỉ có những món ăn vặt này mới cứu rỗi được tâm hồn:

1️⃣ Bánh tráng trộn muối tôm dẻo cay cay, chua chua thơm mùi tắc.
2️⃣ Khô bò miếng giòn rụm chấm tương ớt cay nồng.
3️⃣ Cơm cháy chà bông mỡ hành giòn rụm đẫm topping.
4️⃣ Chân gà sốt thái giòn sần sật đậm đà khó cưỡng.

Team mê ăn vặt bình luận số món bạn thèm nhất lúc này nhé! 👇`,
        hashtags: '#GocAnVat #MonNgonQuocDan #DoAnVat #ThemAnChieu #Foodie',
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800'
      }
    ],
    review: [
      {
        title: 'Review Món Ăn Vặt Đóng Hộp Siêu Cuốn',
        headline: '✨ TRẢI NGHIỆM MÓN ĂN VẶT GÂY NGHIỆN: ĂN LÀ KHÔNG DỪNG ĐƯỢC!',
        content: `Đặt thử một hộp ăn thử xem có ngon như lời đồn không, ai ngờ vừa khui nắp là hết veo trong một nốt nhạc:

🤤 Đồ ăn giòn rụm, gia vị tẩm ướp vừa vặn không bị quá ngọt hay quá mặn.
🤤 Đóng hũ nắp nhôm chắc chắn, hút ẩm sạch sẽ đảm bảo vệ sinh an toàn thực phẩm.
🤤 Nhâm nhi lúc xem phim hay làm việc văn phòng thì chuẩn bài luôn ạ!`,
        hashtags: '#ReviewDoAn #AnVatVanPhong #FoodReview #NgonKhoCuong',
        image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800'
      }
    ],
    sales: [
      {
        title: 'Đại Tiệc Ăn Vặt Mua 2 Tặng 1 Trợ Giá',
        headline: '📦 [ĐẠI TIỆC ĂN VẶT] THƠM NGON GIÒN RỤM - MUA 2 TẶNG 1 HÔM NAY!',
        content: `Sẵn sàng cho những buổi xem phim, tụ tập bạn bè với menu ăn vặt siêu đỉnh!
Đặc sản chế biến từ nguyên liệu tươi ngon chọn lọc, nói không với chất bảo quản độc hại:

🔥 Ưu đãi cực đã: Mua 2 hũ tặng ngay 1 hũ tự chọn.
🔥 Đóng gói hũ kín sạch sẽ, giao nhanh tận tay.
🔥 Được nếm thử ưng ý mới thanh toán!

${LINK_PLACEHOLDER}
👇 Bình luận "ĐẶT HÀNG" hoặc nhắn tin để shop ship hỏa tốc ngay chiều nay nhé!`,
        hashtags: '#AnVatGiaTot #DealAnVat #Freeship #DealShopee #DoAnNgon',
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'
      }
    ]
  },

  sach_giaoduc: {
    name: 'Sách & Giáo dục',
    defaultImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
    knowledge: [
      {
        title: '3 Quy Tắc Quản Lý Thời Gian Giúp Tăng Gấp Đôi Hiệu Suất',
        headline: '📚 3 PHƯƠNG PHÁP QUẢN LÝ THỜI GIAN GIÚP BẠN THOÁT KHỎI SỰ TRÌ HOÃN!',
        content: `Thời gian là tài nguyên công bằng nhất của mỗi người. Học cách làm chủ thời gian với 3 quy tắc kinh điển:

1️⃣ Quy tắc 2 phút: Việc gì làm xong dưới 2 phút (trả lời email gấp, dọn bàn làm việc), hãy làm ngay lập tức thay vì ghi vào danh sách chờ.
2️⃣ Phương pháp Pomodoro: Làm việc tập trung cao độ 25 phút, nghỉ ngắn 5 phút. Giúp não bộ luôn duy trì trạng thái sáng tạo đỉnh cao.
3️⃣ Ma trận Eisenhower: Phân loại công việc theo mức độ Quan trọng và Khẩn cấp để luôn ưu tiên làm đúng việc tạo ra giá trị lớn nhất.

Đầu tư vào tư duy là khoản đầu tư không bao giờ lỗ! 💡`,
        hashtags: '#PhatTrienBanThan #DocSachMoiNgay #QuanLyThoiGian #TuDuyTichCuc #ThanhCong',
        image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800'
      }
    ],
    engagement: [
      {
        title: 'Cuốn sách nào đã thay đổi cuộc đời bạn?',
        headline: '📖 THẢO LUẬN: CUỐN SÁCH NÀO ĐÃ THAY ĐỔI TƯ DUY CỦA BẠN NHIỀU NHẤT?',
        content: `Một cuốn sách hay có thể mở ra cả một chân trời mới và cứu rỗi một giai đoạn bế tắc trong cuộc đời:

- Có người thay đổi thói quen nhờ "Atomic Habits".
- Có người mở rộng góc nhìn tài chính nhờ "Cha Giàu Cha Nghèo".
- Có người tìm thấy sự bình yên nội tâm nhờ "Muôn Kiếp Nhân Sinh" hay "Hiểu Về Trái Tim".

Cuốn sách gối đầu giường của bạn là gì? Hãy chia sẻ tựa sách để cộng đồng cùng tìm đọc nhé! 👇`,
        hashtags: '#GocSachHay #ChiaSeSach #YeuSach #TriThuc #BookLovers',
        image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800'
      }
    ],
    review: [
      {
        title: 'Review Cuốn Sách Bứt Phá Thói Quen Thành Công',
        headline: '💡 REVIEW SÁCH: BÍ QUYẾT XÂY DỰNG KỶ LUẬT THÉP MÀ KHÔNG CẢM THẤY ÁP LỰC!',
        content: `Đọc xong cuốn sách này mình mới nhận ra: Ý chí chỉ là một phần nhỏ, chìa khóa thật sự nằm ở việc thiết kế môi trường sống xung quanh bạn:

🎯 Tác giả chỉ ra lộ trình 4 bước đơn giản để biến bất kỳ hành vi tốt nào thành thói quen tự động.
🎯 Lối viết ngắn gọn, súc tích, nhiều câu chuyện thực tế ứng dụng được ngay.
🎯 Một cuốn sách nên đọc lại ít nhất mỗi năm một lần để định hình lại lối sống.`,
        hashtags: '#ReviewSach #SachHayNenDoc #TuDuyDotPha #SachGoiDauGiuong',
        image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800'
      }
    ],
    sales: [
      {
        title: 'Tuần Lễ Tri Thức - Trợ Giá Sách Chuẩn Nhà Xuất Bản',
        headline: '🌟 [TUẦN LỄ SÁCH HAY] BẢN IN CHUẨN XỊN TRỢ GIÁ 40% TẶNG KÈM BOOKMARK!',
        content: `Nuôi dưỡng tâm hồn và nâng tầm tri thức với những tác phẩm best-seller truyền cảm hứng nhất!
Sách thật 100% từ nhà xuất bản, bìa cứng in ấn sắc nét bảo vệ thị lực người đọc:

📖 Trợ giá tri thức giảm 40% giá bìa.
📖 Tặng kèm bookmark độc quyền + Ebook tài liệu bổ trợ giá trị.
📖 Đóng bọc chống sốc kỹ càng bảo vệ góc sách nguyên vẹn khi giao hàng.

${LINK_PLACEHOLDER}
👇 Bình luận "ĐỌC SÁCH" để shop giao tận tay cuốn sách giá trị này nhé!`,
        hashtags: '#SachChinhHang #SaleSach #SachKinhDoanh #DealShopee #SachHayMoiNgay',
        image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800'
      }
    ]
  },

  xe_co: {
    name: 'Phụ kiện Xe & Lái xe an toàn',
    defaultImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
    knowledge: [
      {
        title: '4 Thói Quen Lái Xe Giúp Tiết Kiệm Xăng & Bền Máy',
        headline: '🚗 4 KINH NGHIỆM LÁI XE GIÚP TIẾT KIỆM 20% NHIÊN LIỆU MỖI THÁNG!',
        content: `Giá xăng dầu tăng giảm thất thường, bác tài bỏ túi ngay những mẹo nhỏ cực kỳ thực tế này:

1️⃣ Duy trì ga đều, tránh đạp phanh thốc và thốc ga đột ngột: Đây là thói quen đốt xăng nhiều nhất.
2️⃣ Kiểm tra áp suất lốp định kỳ: Lốp non hơi làm tăng ma sát mặt đường, khiến xe phải gồng máy nhiều hơn.
3️⃣ Dọn dẹp cốp xe, không chở đồ quá nặng không cần thiết.
4️⃣ Bảo dưỡng thay dầu nhớt đúng số km khuyến cáo.

Chúc các bác tài luôn vạn dặm bình an trên mọi cung đường! 🛣️`,
        hashtags: '#KinhNghiemLaiXe #TietKiemXang #ChamSocXe #LaiXeAnToan #HoiLaiXe',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800'
      }
    ],
    engagement: [
      {
        title: 'Bạn thích chạy xe số, xe ga hay lái ô tô khi đi xa?',
        headline: '🛵 HỘI PHƯỢT THỦ: ĐI PHƯỢT ĐƯỜNG DÀI BÁC TÀI CHỌN XE NÀO?',
        content: `Mỗi phương tiện đều mang lại những trải nghiệm cảm xúc rất riêng khi rong ruổi trên những cung đường:

1️⃣ Xe số / Côn tay: Làm chủ tốc độ, leo đèo đổ dốc đầm chắc và an toàn.
2️⃣ Xe ga: Thoải mái cốp rộng, tư thế ngồi êm ái nhẹ nhàng.
3️⃣ Ô tô: Mưa không tới mặt, nắng không tới đầu, tiện nghi cho cả gia đình.

Chiếc xế cưng đồng hành cùng bạn trên nhiều cung đường nhất là gì? Bình luận tên em nó nhé! 👇`,
        hashtags: '#HoiXe #PhuotThu #MeXe #DoXe #TrenTungCaySo',
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800'
      }
    ],
    review: [
      {
        title: 'Đánh Giá Phụ Kiện Tiện Ích Trên Xe Hơi',
        headline: '🔧 REVIEW BỘ PHỤ KIỆN THÔNG MINH CHO XE: NHỎ GỌN NHƯNG TIỆN LỢI BẤT NGỜ!',
        content: `Lắp thử món đồ chơi này trên xe được gần 2 tháng, cảm giác lái xe đường dài đỡ mệt và tiện hơn hẳn:

🚗 Thiết kế vừa vặn nội thất xe, lắp đặt chuẩn zin không cần độ chế dây điện.
🚗 Giúp xe luôn sạch sẽ, gọn gàng và sang trọng hơn.
🚗 Đã kiểm chứng độ bền qua nhiều chuyến đi đường dài nắng nóng không bị biến dạng.

Đáng tiền cho anh em nào muốn nâng cấp trải nghiệm xế cưng!`,
        hashtags: '#ReviewPhuKienXe #DoChoiXe #NoiThatOTo #ChamSocXe',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800'
      }
    ],
    sales: [
      {
        title: 'Xả Kho Phụ Kiện Nâng Cấp Xế Cưng Trợ Giá Đại Lý',
        headline: '🔥 [XẢ KHO PHỤ KIỆN XE] BẢO VỆ XẾ CƯNG SANG ĐẸP - GIẢM NGAY 45%!',
        content: `Nâng tầm đẳng cấp và sự an toàn tiện nghi trên mọi nẻo đường cho chiếc xe của bạn!
Phụ kiện chuẩn theo từng dòng xe, gia công chính xác từ vật liệu cao cấp chịu nhiệt chống nước:

🚗 Mức giá trợ giá siêu hời duy nhất hôm nay.
🚗 Bảo hành đổi mới 12 tháng.
🚗 Được thử và kiểm tra vừa vặn trên xe mới thanh toán!

${LINK_PLACEHOLDER}
👇 Bình luận [Tên Xe + Đời Xe] để shop gửi mẫu chuẩn và mã Freeship tận nhà nhé các bác!`,
        hashtags: '#DoXeChinhHang #SalePhuKienXe #DealXe #DealShopee #XếCưng',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800'
      }
    ]
  },

  khac: {
    name: 'Đa ngành & Phong cách sống',
    defaultImage: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800',
    knowledge: [
      {
        title: '3 Thói Quen Tích Cực Giúp Mỗi Ngày Đều Tràn Đầy Cảm Hứng',
        headline: '✨ 3 ĐIỀU NHỎ BÉ GIÚP BẠN SỐNG VUI VẺ & BỚT LO ÂU MỖI NGÀY!',
        content: `Cuộc sống bận rộn đôi khi khiến chúng ta quên mất việc chăm sóc tâm hồn mình:

1️⃣ Dành 15 phút ngắt kết nối mạng xã hội: Đọc vài trang sách hoặc ngắm nhìn cây cối giúp tâm trí lắng đọng.
2️⃣ Viết ra 3 điều bạn biết ơn mỗi tối: Bạn sẽ nhận ra cuộc sống vẫn còn vô vàn điều ấm áp xung quanh.
3️⃣ Tự thưởng cho bản thân một món quà nhỏ khi hoàn thành tốt công việc.

Hãy dịu dàng với chính mình bạn nhé! 🌿`,
        hashtags: '#SongTichCuc #YeuBanThan #TruyenCamHung #GocBinhYen',
        image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800'
      }
    ],
    engagement: [
      {
        title: 'Hôm nay của bạn thế nào?',
        headline: '💬 TÂM SỰ ĐẦU TUẦN: HÔM NAY CỦA BẠN THẾ NÀO RỒI?',
        content: `Một ngày làm việc trôi qua nhanh thật nhanh! 
Dù ngày hôm nay có mệt mỏi hay tràn ngập niềm vui, hãy dành cho bản thân một lời khen vì đã cố gắng hết mình nhé.

Thả một chiếc icon miêu tả tâm trạng lúc này của bạn vào phần bình luận nhé:
🥰 - Cực kỳ vui vẻ & năng lượng
😴 - Mệt mỏi nhưng đã hoàn thành tốt
🍀 - Bình yên và nhẹ nhõm

Chúc cả nhà một buổi tối thật an lành bên gia đình! ❤️`,
        hashtags: '#GocTamSu #KetNoi #NuCuoiMoiNgay #YeuDoi',
        image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800'
      }
    ],
    review: [
      {
        title: 'Top Sản Phẩm Tiện Ích Đời Sống Được Săn Đón Nhất',
        headline: '🌟 TOP SẢN PHẨM TIỆN ÍCH GIẢI PHÁP ĐƯỢC ĐÁNH GIÁ 5 SAO TUẦN QUA!',
        content: `Đúng là những món đồ sinh ra để nâng tầm chất lượng cuộc sống hàng ngày:

✨ Thiết kế hiện đại, gia công tỉ mỉ từng chi tiết nhỏ.
✨ Tối ưu trải nghiệm sử dụng, bền bỉ và tiện lợi vượt trội.
✨ Được đông đảo khách hàng tin dùng và phản hồi cực kỳ hài lòng.`,
        hashtags: '#ReviewTienIch #MuaSamThongMinh #GiaiPhapCuocSong',
        image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800'
      }
    ],
    sales: [
      {
        title: 'Flash Sale Sản Phẩm Best-Seller Trợ Giá',
        headline: '💥 [SIÊU SALE CHÍNH HÃNG] BEST-SELLER TRỢ GIÁ 45% DUY NHẤT HÔM NAY!',
        content: `Cơ hội săn deal hot với mức giá tiết kiệm chưa từng có!
Cam kết hàng chính hãng 100%, bảo hành uy tín lâu dài:

👉 Giá ưu đãi trợ giá cực tốt.
👉 Freeship toàn quốc khi đặt hàng hôm nay.
👉 Kiểm tra hàng thoải mái trước khi nhận!

${LINK_PLACEHOLDER}
👇 Để lại bình luận hoặc nhắn tin trực tiếp để nhận mã giảm giá độc quyền nhé!`,
        hashtags: '#BestSeller #DealHotHomNay #SanSaleGiaTot #DealShopee #ChinhHang',
        image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800'
      }
    ]
  }
};

/**
 * Tự động sản xuất 1 bài viết nuôi Fanpage hoàn chỉnh
 * @param {string} niche - Lĩnh vực (thoi_trang, my_pham, cong_nghe, ...)
 * @param {string} mix - 'balanced', 'knowledge', 'sales'
 * @param {string} affiliateLink - Link shopee deeplink gắn vào bài bán hàng
 */
function generateAutonomousPost(niche = 'cong_nghe', mix = 'balanced', affiliateLink = '') {
  const nicheKey = NICHE_DATA[niche] ? niche : 'khac';
  const data = NICHE_DATA[nicheKey];

  // Chọn pillar dựa theo mix
  let availablePillars = [];
  if (mix === 'knowledge') {
    availablePillars = ['knowledge', 'knowledge', 'engagement'];
  } else if (mix === 'sales') {
    availablePillars = ['review', 'sales', 'sales'];
  } else {
    // balanced: xoay vòng cân đối
    availablePillars = ['knowledge', 'engagement', 'review', 'sales'];
  }

  const chosenPillar = availablePillars[Math.floor(Math.random() * availablePillars.length)];
  const pool = data[chosenPillar] && data[chosenPillar].length > 0 ? data[chosenPillar] : data.knowledge;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  // Xử lý placeholder link affiliate
  let finalContent = picked.content;
  const linkText = affiliateLink
    ? `👉 Link săn deal chính hãng nhận Voucher giảm giá tại đây:\n🔗 ${affiliateLink}`
    : `👉 Nhắn tin cho shop hoặc để lại bình luận để nhận mã giảm giá và link đặt hàng chính hãng nhé!`;

  finalContent = finalContent.replace(LINK_PLACEHOLDER, linkText);

  const fullText = `${picked.headline}\n\n${finalContent}\n\n${picked.hashtags}`;

  const pillarNames = {
    knowledge: 'Chia sẻ kiến thức & Mẹo hay',
    engagement: 'Tương tác & Hỏi đáp cộng đồng',
    review: 'Review trải nghiệm thực tế',
    sales: 'Flash Sale & Deal Shopee'
  };

  return {
    niche: nicheKey,
    nicheName: data.name,
    pillar: chosenPillar,
    pillarName: pillarNames[chosenPillar] || 'Nội dung nuôi page',
    title: picked.title,
    headline: picked.headline,
    body: finalContent,
    hashtags: picked.hashtags,
    fullText: fullText,
    imageUrl: picked.image || data.defaultImage,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  NICHE_DATA,
  generateAutonomousPost
};
