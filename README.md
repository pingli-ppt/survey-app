---

# 第一步在 **终端（Terminal / 命令行）里执行**

---


## ① 打开 VS Code准备存项目的文件夹，打开终端

## ③ 在终端执行

```bash
npm init -y
```

👉 作用：

* 初始化 Node 项目
* 生成 `package.json`

---

然后执行：

```bash
npm install express mongoose body-parser
```

👉 作用：

* 安装后端依赖

---

# 你现在的目录会变成这样

```
survey-system/
├── node_modules/
├── package.json
```

---


你还需要启动 MongoDB 👇

## 方法1（本地安装）

安装后运行：

```bash
mongod
```

# 如何确认环境成功？

在终端输入：

```bash
node -v
npm -v
```

如果能输出版本号 ✅说明成功
