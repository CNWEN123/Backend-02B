# 🔄 浏览器缓存清除指南

## 问题说明
如果您在预览页看不到新功能（分享链接、专属域名等），这是因为浏览器缓存了旧版本的JavaScript文件。

---

## 解决方案（3种方法）

### 方法1：强制刷新（推荐，最快）⚡

#### Chrome / Edge / Brave
```
Windows: Ctrl + Shift + R
或
Windows: Ctrl + F5

Mac: Command + Shift + R
```

#### Firefox
```
Windows: Ctrl + Shift + R
或
Windows: Ctrl + F5

Mac: Command + Shift + R
```

#### Safari (Mac)
```
Command + Option + R
或
Command + Option + E (清空缓存) + Command + R (刷新)
```

---

### 方法2：清除特定网站缓存（彻底）🧹

#### Chrome / Edge / Brave
1. 按 `F12` 打开开发者工具
2. 右键点击地址栏旁的**刷新按钮**
3. 选择 "**清空缓存并硬性重新加载**" (Empty Cache and Hard Reload)

**或者**

1. 按 `F12` 打开开发者工具
2. 点击 "**Network**" (网络) 标签
3. 勾选 "**Disable cache**" (禁用缓存)
4. 刷新页面 (F5)

#### Firefox
1. 按 `F12` 打开开发者工具
2. 点击 "**Network**" (网络) 标签
3. 勾选 "**Disable HTTP cache**" (禁用HTTP缓存)
4. 刷新页面 (F5)

---

### 方法3：清除所有浏览器数据（最彻底）🗑️

#### Chrome / Edge / Brave
1. 按 `Ctrl + Shift + Delete` (Windows) 或 `Command + Shift + Delete` (Mac)
2. 选择时间范围：**过去1小时**
3. 确保勾选：
   - ✅ **缓存的图片和文件**
   - ✅ **Cookie及其他网站数据** (可选)
4. 点击 "**清除数据**"

#### Firefox
1. 按 `Ctrl + Shift + Delete` (Windows) 或 `Command + Shift + Delete` (Mac)
2. 选择时间范围：**过去1小时**
3. 确保勾选：
   - ✅ **缓存**
   - ✅ **Cookie** (可选)
4. 点击 "**立即清除**"

---

## 验证新功能是否加载

清除缓存后，访问系统并检查以下项目：

### ✅ 检查清单

1. **登录系统**
   ```
   URL: https://3000-i9mzigr2smruxfa8tgrk9-2e77fc33.sandbox.novita.ai
   账号: admin
   密码: admin123
   ```

2. **进入代理管理页面**
   ```
   左侧菜单 → 层级管理 → 代理管理
   ```

3. **验证新功能显示**

   #### ✅ 代理列表应该显示：
   - [ ] 表头有"**分享链接**"列（在"佣金"和"下级/玩家"之间）
   - [ ] 每个代理的分享链接列显示邀请码或"未设置"
   - [ ] 邀请码旁边有📋复制按钮
   - [ ] 操作列有紫色的🔗"**分享设置**"按钮

   #### ✅ 点击"新增代理"应该显示：
   - [ ] 表单底部有橙色背景的"**专属域名绑定**"区域
   - [ ] 有"专属域名"输入框，占位符：`如: agent.yourdomain.com`

   #### ✅ 点击"分享设置"按钮应该弹出：
   - [ ] 弹窗标题："分享与域名设置"
   - [ ] 4个区域：代理信息、邀请码、分享链接、专属域名
   - [ ] 邀请码区域有绿色边框
   - [ ] 分享链接区域有蓝色边框
   - [ ] 专属域名区域有橙色边框

---

## 仍然看不到？尝试这些

### 1. 检查开发者工具控制台
```
按 F12 → Console 标签
查看是否有红色错误信息
```

### 2. 检查网络请求
```
按 F12 → Network 标签
刷新页面
搜索 "app.js"
确认状态码是 200 (不是 304 缓存)
```

### 3. 检查JavaScript加载
```
按 F12 → Console 标签
输入: typeof showAgentShareSettings
应该返回: "function"
如果返回 "undefined"，说明JS未加载
```

### 4. 使用隐私模式/无痕模式
```
Chrome: Ctrl + Shift + N
Firefox: Ctrl + Shift + P
Safari: Command + Shift + N

在无痕模式中访问系统，确保没有缓存干扰
```

### 5. 尝试不同的浏览器
如果一个浏览器有问题，试试另一个：
- Chrome
- Firefox
- Edge
- Safari

---

## 技术细节（开发者）

### 检查文件版本
访问 JavaScript 文件查看版本：
```
https://3000-i9mzigr2smruxfa8tgrk9-2e77fc33.sandbox.novita.ai/static/app.js
```

文件大小应该是 **~522 KB**

### 验证关键函数存在
在浏览器控制台运行：
```javascript
// 检查新功能函数
console.log('showAgentShareSettings:', typeof showAgentShareSettings);
console.log('saveAgentShareSettings:', typeof saveAgentShareSettings);
console.log('regenerateInviteCode:', typeof regenerateInviteCode);
console.log('verifyAgentDomain:', typeof verifyAgentDomain);
console.log('copyInviteCode:', typeof copyInviteCode);

// 应该都返回 "function"
```

### 检查API端点
在浏览器控制台运行：
```javascript
// 测试公开API（无需登录）
fetch('/api/v1/public/agent-by-invite/TEST1234')
  .then(r => r.json())
  .then(console.log);

// 应该返回类似:
// {success: false, message: "邀请码无效或代理已禁用"}
```

---

## 快速测试命令（终端）

如果您有SSH访问权限，可以运行：

```bash
# 检查文件是否包含新功能
grep -c "showAgentShareSettings" /home/user/webapp/public/static/app.js

# 应该返回大于 0 的数字（表示函数存在）
```

---

## 📞 需要帮助？

如果尝试了以上所有方法仍然看不到新功能，请提供以下信息：

1. **浏览器信息**
   - 浏览器名称和版本
   - 操作系统

2. **开发者工具截图**
   - Console标签的错误信息
   - Network标签的app.js请求状态

3. **页面截图**
   - 代理管理页面的完整截图

4. **控制台测试结果**
   ```javascript
   typeof showAgentShareSettings
   ```

---

## ✅ 成功标志

清除缓存成功后，您应该能看到：

1. ✅ 代理列表有"分享链接"列
2. ✅ 邀请码显示（如 `A3B7C9D2`）
3. ✅ 紫色"分享设置"按钮
4. ✅ 点击后弹出完整的分享设置弹窗
5. ✅ 新增代理表单有"专属域名绑定"区域

---

**重要提示**：服务器已更新，只是浏览器缓存的问题。强制刷新（Ctrl+Shift+R）通常就能解决！

**系统版本**：Live Dealer Admin V2.1  
**功能状态**：✅ 已部署  
**最后更新**：2024-11-30
