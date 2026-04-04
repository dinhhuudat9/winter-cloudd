const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// -------------------- CẤU HÌNH LƯU TRỮ BỀN VỮNG TRÊN RENDER --------------------
// Render persistent disk mount path: /data
// Nếu chạy local, dùng thư mục data trong backend
const DATA_DIR =
  process.env.RENDER_DISK_MOUNT_PATH ||
  process.env.DATA_DIR ||
  path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

// Đảm bảo thư mục DATA_DIR tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Hàm đọc/ghi database
const readDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Tạo file db.json mặc định nếu chưa có
      const initialData = {
        users: [
          {
            username: "admin",
            password: "admin123",
            balance: 999999,
            isAdmin: true,
          },
          { username: "test", password: "123", balance: 50000, isAdmin: false },
        ],
        products: [
          {
            id: "p1",
            name: "Tool Auto Like Facebook",
            price: 99000,
            category: "python",
            icon: "fab fa-python",
            desc: "Auto like, thả tim cực mạnh",
            downloadLink: "https://drive.google.com/",
            demoUrl: "",
          },
          {
            id: "p2",
            name: "Source Web MMO Game",
            price: 199000,
            category: "website",
            icon: "fas fa-globe",
            desc: "Full code web kiếm tiền",
            downloadLink: "https://example.com/",
            demoUrl: "",
          },
          {
            id: "p3",
            name: "Gói Tình Yêu - QR Heart",
            price: 50000,
            category: "love",
            icon: "fas fa-heart",
            desc: "Mã nguồn tạo QR trái tim",
            downloadLink: "https://example.com/",
            demoUrl: "",
          },
        ],
        purchases: [],
        transactions: [],
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Lỗi đọc db.json:", err);
    return { users: [], products: [], purchases: [], transactions: [] };
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Lỗi ghi db.json:", err);
  }
};

// ==================== API AUTH ====================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(
    (u) => u.username === username && u.password === password,
  );
  if (user) {
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } else {
    res.json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
  }
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  if (db.users.find((u) => u.username === username)) {
    return res.json({ success: false, message: "Tên đăng nhập đã tồn tại" });
  }
  const newUser = { username, password, balance: 2000, isAdmin: false };
  db.users.push(newUser);
  writeDB(db);
  const { password: _, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// ==================== API PRODUCTS ====================
app.get("/api/products", (req, res) => {
  const db = readDB();
  res.json(db.products);
});

app.post("/api/products", (req, res) => {
  const { user, product } = req.body;
  const db = readDB();
  const adminUser = db.users.find(
    (u) => u.username === user.username && u.isAdmin === true,
  );
  if (!adminUser) return res.status(403).json({ error: "Không có quyền" });

  const newProduct = { id: "p" + Date.now(), ...product };
  db.products.push(newProduct);
  writeDB(db);
  res.json({ success: true, product: newProduct });
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  const db = readDB();
  const adminUser = db.users.find(
    (u) => u.username === user.username && u.isAdmin === true,
  );
  if (!adminUser) return res.status(403).json({ error: "Không có quyền" });

  db.products = db.products.filter((p) => p.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// ==================== API PURCHASE ====================
app.post("/api/purchase", (req, res) => {
  const { username, productId } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.username === username);
  const product = db.products.find((p) => p.id === productId);
  if (!user || !product)
    return res.status(400).json({ error: "User hoặc sản phẩm không tồn tại" });
  if (user.balance < product.price)
    return res.json({ success: false, message: "Số dư không đủ" });

  user.balance -= product.price;
  db.purchases.unshift({
    username,
    productName: product.name,
    price: product.price,
    downloadLink: product.downloadLink,
    date: new Date().toISOString(),
  });
  writeDB(db);
  res.json({
    success: true,
    newBalance: user.balance,
    purchase: db.purchases[0],
  });
});

app.get("/api/history/:username", (req, res) => {
  const { username } = req.params;
  const db = readDB();
  const history = db.purchases.filter((p) => p.username === username);
  res.json(history);
});

// ==================== API NẠP TIỀN (admin xác nhận thủ công) ====================
app.post("/api/create-deposit", (req, res) => {
  const { username, amount } = req.body;
  if (!username || amount <= 0)
    return res.status(400).json({ error: "Số tiền không hợp lệ" });

  const transactionId = `DEP${Date.now()}`;
  const bankInfo = {
    bankCode: "BIDV",
    accountNumber: "8826353645",
    accountName: "ĐINH HỮU ĐẠT",
    amount,
    description: `NAP ${transactionId}`,
  };
  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankCode}-${bankInfo.accountNumber}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(bankInfo.description)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

  const db = readDB();
  db.transactions.push({
    id: transactionId,
    username,
    amount,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  writeDB(db);
  res.json({ success: true, qrUrl, transactionId, amount });
});

app.get("/api/check-deposit/:username/:transactionId", (req, res) => {
  const { username, transactionId } = req.params;
  const db = readDB();
  const tx = db.transactions.find(
    (t) => t.id === transactionId && t.username === username,
  );
  if (!tx) return res.json({ status: "not_found" });
  if (tx.status === "completed") {
    const user = db.users.find((u) => u.username === username);
    res.json({ status: "completed", newBalance: user.balance });
  } else {
    res.json({ status: "pending" });
  }
});

// ADMIN: lấy danh sách giao dịch pending
app.get("/api/admin/pending-transactions", (req, res) => {
  const { adminUsername } = req.query;
  const db = readDB();
  const admin = db.users.find(
    (u) => u.username === adminUsername && u.isAdmin === true,
  );
  if (!admin) return res.status(403).json({ error: "Unauthorized" });
  const pending = db.transactions.filter((tx) => tx.status === "pending");
  res.json(pending);
});

// ADMIN: xác nhận giao dịch (cộng tiền)
app.post("/api/admin/confirm-deposit", (req, res) => {
  const { adminUsername, transactionId } = req.body;
  const db = readDB();
  const admin = db.users.find(
    (u) => u.username === adminUsername && u.isAdmin === true,
  );
  if (!admin)
    return res.status(403).json({ success: false, message: "Không có quyền" });

  const tx = db.transactions.find(
    (t) => t.id === transactionId && t.status === "pending",
  );
  if (!tx)
    return res.json({
      success: false,
      message: "Giao dịch không tồn tại hoặc đã được xử lý",
    });

  const user = db.users.find((u) => u.username === tx.username);
  if (!user)
    return res.json({ success: false, message: "Không tìm thấy người dùng" });

  user.balance += tx.amount;
  tx.status = "completed";
  writeDB(db);
  res.json({
    success: true,
    newBalance: user.balance,
    username: user.username,
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📂 Dữ liệu được lưu tại: ${DB_PATH}`);
});
