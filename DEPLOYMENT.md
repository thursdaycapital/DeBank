# 部署和环境变量配置指南

## 环境变量配置位置

### 1. Vercel 部署（推荐）

如果项目部署在 Vercel 上，按以下步骤配置：

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目（或导入 GitHub 仓库）
3. 进入项目设置：**Settings** → **Environment Variables**
4. 添加环境变量：
   - **Name**: `DEBANK_ACCESS_KEY`
   - **Value**: 你的 DeBank AccessKey
   - **Environment**: 选择 `Production`、`Preview`、`Development`（根据需要）
5. 点击 **Save**
6. 重新部署项目（Redeploy）

**注意**：即使配置了环境变量，前端仍然可以在输入框中输入 AccessKey，前端输入的优先级更高。

### 2. GitHub Secrets（用于 GitHub Actions）

如果使用 GitHub Actions 进行 CI/CD：

1. 进入 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加：
   - **Name**: `DEBANK_ACCESS_KEY`
   - **Value**: 你的 DeBank AccessKey
5. 点击 **Add secret**

### 3. 本地开发

在项目根目录创建 `.env.local` 文件：

```bash
DEBANK_ACCESS_KEY=your_access_key_here
```

**注意**：`.env.local` 文件已经在 `.gitignore` 中，不会被提交到 GitHub。

### 4. 其他部署平台

#### Netlify
1. 进入 Netlify Dashboard
2. **Site settings** → **Environment variables**
3. 添加 `DEBANK_ACCESS_KEY`

#### Railway
1. 进入 Railway Dashboard
2. 选择项目 → **Variables**
3. 添加 `DEBANK_ACCESS_KEY`

#### Render
1. 进入 Render Dashboard
2. 选择服务 → **Environment**
3. 添加 `DEBANK_ACCESS_KEY`

## 获取 DeBank AccessKey

1. 访问 [DeBank OpenAPI](https://open.debank.com/)
2. 注册/登录账号
3. 创建应用并获取 AccessKey
4. 确保 AccessKey 有权限访问以下 API：
   - `/v1/user/total_balance`
   - `/v1/user/all_token_list`

## 重要提示

- ⚠️ **不要**将 AccessKey 提交到 GitHub 代码仓库
- ✅ 使用环境变量或前端输入（不会保存）
- ✅ `.env.local` 文件已在 `.gitignore` 中
- ✅ 前端输入的 AccessKey 优先级高于环境变量

## 验证配置

配置完成后，可以通过以下方式验证：

1. **使用环境变量**：不输入 AccessKey，直接查询（如果配置了环境变量）
2. **使用前端输入**：在页面输入框中输入 AccessKey 进行查询

