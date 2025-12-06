"use client";

import { useState } from "react";

type ChainItem = {
  id: string;
  usd_value?: number;
};

type TokenItem = {
  chain?: string;
  id?: string;
  symbol?: string;
  amount?: number;
  price?: number;
  value?: number;
};

type PortfolioData = {
  debank: {
    total_usd_value: number;
    chain_list: ChainItem[];
    tokens: TokenItem[];
  };
  evmNative: Record<string, { balance: number | null }>;
};

type PortfolioResponse = PortfolioData | { results: Array<{ address: string; success: boolean; data?: PortfolioData; error?: string }> };

type AddressResult = {
  address: string;
  data: PortfolioData;
};

// CSV 导出函数
function exportToCSV(data: AddressResult[]) {
  // 1. 汇总表格：地址 + 总资产
  const summaryRows: string[][] = [
    ["地址", "总资产 (USD)"],
    ...data.map((r) => [r.address, r.data.debank.total_usd_value.toFixed(2)]),
  ];

  // 2. 链维度表格：地址 + 链 + DeBank资产 + 原生币余额
  const chainRows: string[][] = [
    ["地址", "链", "DeBank 资产 (USD)", "原生币余额"],
  ];
  data.forEach((r) => {
    r.data.debank.chain_list.forEach((chain) => {
      const chainUpper = chain.id?.toUpperCase() || "";
      const nativeBal = r.data.evmNative[chainUpper]?.balance;
      chainRows.push([
        r.address,
        chain.id || "",
        chain.usd_value?.toFixed(2) || "0",
        nativeBal != null ? nativeBal.toFixed(6) : "-",
      ]);
    });
  });

  // 3. Token 列表：地址 + 链 + Token + 数量 + 价格 + 价值
  const tokenRows: string[][] = [
    ["地址", "链", "Token", "数量", "价格 (USD)", "价值 (USD)"],
  ];
  data.forEach((r) => {
    r.data.debank.tokens.slice(0, 50).forEach((token) => {
      tokenRows.push([
        r.address,
        token.chain || "",
        token.symbol || token.id || "",
        token.amount?.toString() || "0",
        token.price?.toString() || "0",
        token.value?.toString() || "0",
      ]);
    });
  });

  // 合并所有表格
  const allRows = [
    ["=== 汇总 ==="],
    ...summaryRows,
    [""],
    ["=== 按链分布 ==="],
    ...chainRows,
    [""],
    ["=== Token 列表（前50个） ==="],
    ...tokenRows,
  ];

  // 转换为 CSV 格式
  const csvContent = allRows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  // 添加 BOM 以支持中文
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `portfolio_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Page() {
  const [addressInput, setAddressInput] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [data, setData] = useState<AddressResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    setError(null);
    setData(null);

    const key = accessKey.trim();
    if (!key) {
      setError("请输入 DeBank AccessKey");
      return;
    }

    const input = addressInput.trim();
    if (!input) {
      setError("请输入地址");
      return;
    }

    // 支持多地址：换行、逗号、分号分隔
    const addresses = input
      .split(/[\n,;]+/)
      .map((addr) => addr.trim())
      .filter(Boolean);

    if (addresses.length === 0) {
      setError("请输入至少一个有效的地址（地址不能为空）");
      return;
    }

    // 验证地址格式（基本检查：以 0x 开头，长度至少 40）
    const invalidAddresses = addresses.filter(
      (addr) => !addr.startsWith("0x") || addr.length < 40
    );
    if (invalidAddresses.length > 0) {
      setError(
        `以下地址格式可能不正确（应以 0x 开头，长度至少 40 字符）：${invalidAddresses.join(", ")}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses, accessKey: key }),
      });

      const json: PortfolioResponse = await res.json();

      if (!res.ok) {
        setError((json as any).error || "请求失败");
      } else {
        // 处理单个或批量结果
        if ("results" in json) {
          // 批量结果
          const successful = json.results
            .filter((r) => r.success && r.data)
            .map((r) => ({ address: r.address, data: r.data! }));
          const failed = json.results.filter((r) => !r.success);

          if (successful.length === 0) {
            setError(failed[0]?.error || "所有地址查询失败");
          } else {
            if (failed.length > 0) {
              setError(
                `部分地址查询失败: ${failed.map((f) => `${f.address} (${f.error})`).join(", ")}`,
              );
            }
            setData(successful);
          }
        } else {
          // 单个结果（向后兼容）
          setData([{ address: addresses[0], data: json }]);
        }
      }
    } catch (e: any) {
      setError(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    exportToCSV(data);
  };

  // 计算总资产汇总
  const totalValue = data?.reduce((sum, r) => sum + r.data.debank.total_usd_value, 0) || 0;

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        全链资产查看器（DeBank + EVM RPC）
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
          DeBank AccessKey <span style={{ color: "#666", fontSize: 12, fontWeight: 400 }}>（每次查询都需要输入，不会保存）</span>：
        </label>
        <input
          type="password"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="输入 DeBank AccessKey（从 https://open.debank.com/ 获取）"
          style={{
            width: "100%",
            padding: 10,
            fontFamily: "monospace",
            borderRadius: 4,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
          输入地址（支持多个，用换行、逗号或分号分隔）：
        </label>
        <textarea
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="输入一个或多个 EVM 地址&#10;例如：&#10;0x1234...&#10;0x5678..."
          style={{
            width: "100%",
            minHeight: 120,
            padding: 10,
            fontFamily: "monospace",
            borderRadius: 4,
            border: "1px solid #ccc",
            fontSize: 14,
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={handleQuery}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: 4,
            border: "none",
            backgroundColor: "#0070f3",
            color: "#fff",
            cursor: loading ? "default" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "查询中…" : "查询资产"}
        </button>

        {data && data.length > 0 && (
          <button
            onClick={handleExportCSV}
            style={{
              padding: "10px 20px",
              borderRadius: 4,
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            导出 CSV
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 4,
            background: "#ffe6e6",
            color: "#b00020",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {data && data.length > 0 && (
        <>
          {/* 汇总信息 */}
          <section style={{ marginTop: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>汇总</h2>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
              总资产: ${totalValue.toFixed(2)}
            </div>
            <div style={{ fontSize: 14, color: "#666" }}>
              已查询 {data.length} 个地址
            </div>
          </section>

          {/* 每个地址的详细信息 */}
          {data.map((result, idx) => (
            <section
              key={result.address}
              style={{
                marginTop: 24,
                padding: 16,
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #e0e0e0",
              }}
            >
              <h2 style={{ fontSize: 18, marginBottom: 12, fontFamily: "monospace" }}>
                地址 {idx + 1}: {result.address.slice(0, 10)}...{result.address.slice(-8)}
              </h2>

              {/* 单个地址总资产 */}
              <div style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>
                ≈ ${result.data.debank.total_usd_value.toFixed(2)}
              </div>

              {/* 链维度资产 + 原生币余额 */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, marginBottom: 8, fontWeight: 600 }}>
                  按链分布 + 原生币余额
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          链
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          链上资产（DeBank, USD）
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          原生币余额（RPC）
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.debank.chain_list.map((c) => {
                        const evmNative =
                          result.data.evmNative[c.id?.toUpperCase() || ""]?.balance;
                        return (
                          <tr key={c.id}>
                            <td
                              style={{
                                padding: 8,
                                borderBottom: "1px solid #f0f0f0",
                              }}
                            >
                              {c.id}
                            </td>
                            <td
                              style={{
                                padding: 8,
                                textAlign: "right",
                                borderBottom: "1px solid #f0f0f0",
                              }}
                            >
                              {c.usd_value?.toFixed
                                ? `$${c.usd_value.toFixed(2)}`
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: 8,
                                textAlign: "right",
                                borderBottom: "1px solid #f0f0f0",
                                fontFamily: "monospace",
                              }}
                            >
                              {evmNative != null ? evmNative.toFixed(6) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Token 列表（前 50 个） */}
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 8, fontWeight: 600 }}>
                  Token 列表（前 50 个）
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          链
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          Token
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          数量
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          价格 (USD)
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          价值 (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.debank.tokens.slice(0, 50).map((t, tokenIdx) => (
                        <tr key={tokenIdx}>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            {t.chain}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            {t.symbol || t.id}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              textAlign: "right",
                              borderBottom: "1px solid #f0f0f0",
                              fontFamily: "monospace",
                            }}
                          >
                            {t.amount?.toLocaleString() || "0"}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              textAlign: "right",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            {t.price?.toFixed(6) || "0"}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              textAlign: "right",
                              borderBottom: "1px solid #f0f0f0",
                              fontWeight: 500,
                            }}
                          >
                            {t.value?.toFixed(2) || "0"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

