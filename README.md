## 部署说明

### 环境要求
- Node.js >= 16.x
- MongoDB >= 5.0

### 安装步骤

1. 克隆代码
```bash
git clone <repository>
cd survey-app
安装依赖

bash
npm install
启动MongoDB

bash
mongod --dbpath ./data
启动应用

bash
node server.js
访问系统

text
http://localhost:3000

运行测试脚本

node test-full.js