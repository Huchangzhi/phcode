# PH Code v3 — TypeScript 重构版（开发中）

> ⚠️ **此版本正在开发中，功能可能不完整或不稳定。**
> 稳定版本 (Python 原版) 请访问 [huchangzhi/phoi](https://github.com/huchangzhi/phoi)

> 本项目完全使用AI生成，仅供学习，造成损失作者概不负责

一个跨平台的C++编辑器，甚至在手机上也可以写代码

UI参考：Microsofr VS Code ~~（微软大战代码）~~ ，部分图标来自VScode，CPH

运行器：[rextester](https://rextester.com/)

体验:

[主站](https://ide.hcz1017.dpdns.org/)

[备用](https://hcz1017.pythonanywhere.com/)


## 为什么暂缓开发

最近学习压力很大，再加上功能已经基本完整，于是决定暂缓开发，若有问题请邮箱联系：hcz1017@outlook.com

目前不知道多久恢复开发





另外,ph code桌面版自v2.2.2版本已打包发布至release
运行要求:

**关于桌面版**

环境要求:

> win10及以上   

> [webview2](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2)

安装：

Release里面下载

功能区别:

gdb调试，但是翻译功能仍是使用云端接口

cph浏览器插件传送数据至phcode

端口使用:27120(主程序)，27121(cph)

**关于安卓版本**

安卓版提供两个版本：

### Lite 版（PHCODE-android-lite.apk）
- **引擎**: System WebView（系统自带）
- **最低安卓版本**: 5.0（API 21）
- **架构**: 通用（一个 APK 兼容所有设备）
- **体积**: 较小
- **说明**: 兼容性好，适合旧设备，本地编译速度取决于系统 WebView，相对较慢

### GeckoView 版（PHCODE-app-*-release.apk）
- **引擎**: GeckoView（Firefox 同款引擎）
- **最低安卓版本**: 8.0（API 26）
- **架构**: 按架构分为 3 个独立 APK
  - `PHCODE-app-arm64-v8a-release.apk` — 主流现代手机
  - `PHCODE-app-armeabi-v7a-release.apk` — 老款 32 位 ARM 设备
  - `PHCODE-app-x86_64-release.apk` — 模拟器 / Intel 设备
- **体积**: 较大（包含完整 Gecko 渲染引擎）
- **说明**: 本地编译速度更快（接近桌面 Chrome 水平），需根据设备架构选择对应 APK

> ⚠️ 两个版本均不支持 clangd（代码补全/诊断），Android 上暂无可用方案


> 不确定选哪个：2020 年后的大多数手机用 `arm64-v8a`，较旧的手机用 `armeabi-v7a`

---

插件功能：

> 目前插件功能正在改善，正在添加更多的端口，希望大家多多pr

> 目前插件：C++代码补全（clangd），洛谷主题库查看，CPH测试点维护

> 本地编译：在网页或手机上通过 WASM 在浏览器内本地编译 C++，无需服务器（开关在 **文件 → 首选项**）


注：洛谷题目来自https://cdn.luogu.com.cn/problemset-open/latest.ndjson.gz

## 部署:
```sh
pip install -r requirements.txt
```
对于使用rextester的
```sh
python app.py
```
对于使用本机进行评测的（有风险，建议容器内部署）
```sh
python app_local.py
```

**Android 签名证书配置（维护者）**

首次构建前需要生成签名证书并配置 GitHub Secrets：

1. 运行 `generate_keystore.bat` 生成签名证书
2. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：
   - `ANDROID_KEYSTORE`: base64 编码的 keystore 文件内容
   - `KEYSTORE_PASSWORD`: 密钥库密码
   - `KEY_ALIAS`: 密钥别名
   - `KEY_PASSWORD`: 密钥密码

⚠️ **重要**：生成后请删除本地的 `.keystore` 文件，并妥善保管密码。丢失证书将无法更新应用。

gui版本
```sh
python server_gui.py
```

cloudflare部署:

1.克隆此仓库
2.在cloudflare workers里面选择克隆的仓库创建worker
3.配置
<img width="441" height="82" alt="image" src="https://github.com/user-attachments/assets/0ba5e98c-6792-4866-b1e9-265126010664" />

<img width="594" height="1202" alt="image" src="https://github.com/user-attachments/assets/ba53f0ad-a8cb-4ac0-a4d2-06b6428534f3" />

