const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = "survey-system-secret-key-2024";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: "未登录，请先登录" 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: "用户不存在" 
      });
    }
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        error: "无效的 token" 
      });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        error: "登录已过期，请重新登录" 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      error: "认证失败" 
    });
  }
};

module.exports = authMiddleware;