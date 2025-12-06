# 全链资产查看器

基于 Next.js + TypeScript + App Router 的全链资产查看器，结合 DeBank OpenAPI 和 EVM RPC 实时查询多链钱包资产。

## 功能特性

- ✅ 支持单个或多个 EVM 地址批量查询
- ✅ 集成 DeBank OpenAPI 获取资产数据
- ✅ 通过 EVM RPC 实时查询原生币余额
- ✅ 支持 6 条主流链：ETH、BSC、Polygon、Arbitrum、Optimism、Base
- ✅ 导出 CSV 文件，包含汇总、链分布和 Token 列表
- ✅ 响应式 UI，支持多地址对比

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
DEBANK_ACCESS_KEY=your_access_key_here
```

> 获取 AccessKey：访问 [DeBank OpenAPI](https://open.debank.com/) 注册并获取 AccessKey

### 3. 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 在环境变量中添加 `DEBANK_ACCESS_KEY`
4. 部署完成

无需额外配置，Vercel 会自动识别 Next.js 项目。

## 使用方法

### 单个地址查询

在输入框中输入一个 EVM 地址，点击「查询资产」按钮。

### 批量地址查询

支持多种分隔方式：
- 换行分隔
- 逗号分隔
- 分号分隔

示例：
```
0x1234567890123456789012345678901234567890
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222
```

### 导出 CSV

查询完成后，点击「导出 CSV」按钮，将下载包含以下内容的 CSV 文件：
- 汇总表格（地址 + 总资产）
- 按链分布表格（地址 + 链 + DeBank资产 + 原生币余额）
- Token 列表（地址 + 链 + Token + 数量 + 价格 + 价值）

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **API**: DeBank OpenAPI + EVM RPC
- **部署**: Vercel（零配置）

## 支持的链

- Ethereum (ETH)
- BSC (BSC)
- Polygon (Polygon)
- Arbitrum (Arbitrum)
- Optimism (Optimism)
- Base (Base)

## API 接口

### POST /api/portfolio

请求体：
```json
{
  "addresses": ["0x...", "0x..."]  // 或单个 "address": "0x..."
}
```

响应：
```json
{
  "results": [
    {
      "address": "0x...",
      "success": true,
      "data": {
        "debank": {
          "total_usd_value": 1234.56,
          "chain_list": [...],
          "tokens": [...]
        },
        "evmNative": {
          "ETH": { "balance": 0.5 },
          "BSC": { "balance": 1.2 }
        }
      }
    }
  ]
}
```

## 注意事项

- DeBank API 调用在服务端进行，AccessKey 不会暴露到客户端
- 如果没有配置 `DEBANK_ACCESS_KEY`，API 会返回 500 错误
- CSV 导出包含 UTF-8 BOM，确保 Excel 正确显示中文

## License

MIT

