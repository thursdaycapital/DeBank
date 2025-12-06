import { NextResponse } from "next/server";

const EVM_RPC: Record<string, string> = {
  ETH: "https://ethereum.publicnode.com",
  BSC: "https://bsc.publicnode.com",
  Polygon: "https://polygon-bor.publicnode.com",
  Arbitrum: "https://arbitrum-one.publicnode.com",
  Optimism: "https://optimism.publicnode.com",
  Base: "https://base.publicnode.com",
};

async function fetchDeBank(path: string, id: string, accessKey: string) {
  const url = new URL(`https://pro-openapi.debank.com${path}`);
  url.searchParams.set("id", id);
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      AccessKey: accessKey,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let errorMessage = `DeBank API 错误: HTTP ${res.status}`;
    try {
      const errorBody = await res.text();
      if (errorBody) {
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage += ` - ${JSON.stringify(errorJson)}`;
        } catch {
          errorMessage += ` - ${errorBody}`;
        }
      }
    } catch {
      // 忽略解析错误
    }
    
    // 针对常见错误提供更友好的提示
    if (res.status === 403) {
      errorMessage += "。可能的原因：1) AccessKey 无效或已过期；2) AccessKey 权限不足；3) IP 地址被限制。请检查 AccessKey 是否正确，或联系 DeBank 支持。";
    } else if (res.status === 401) {
      errorMessage += "。AccessKey 认证失败，请检查 AccessKey 是否正确。";
    } else if (res.status === 429) {
      errorMessage += "。请求频率过高，请稍后再试。";
    }
    
    throw new Error(errorMessage);
  }
  return res.json();
}

async function fetchNativeBalance(chain: string, address: string) {
  const rpc = EVM_RPC[chain];
  if (!rpc) return null;

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getBalance",
    params: [address, "latest"],
  };

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  const hex = json.result ?? "0x0";
  try {
    const wei = BigInt(hex);
    return Number(wei) / 1e18;
  } catch {
    return null;
  }
}

async function fetchPortfolioForAddress(
  address: string,
  accessKey: string,
): Promise<{
  debank: {
    total_usd_value: number;
    chain_list: Array<{ id: string; usd_value?: number }>;
    tokens: Array<any>;
  };
  evmNative: Record<string, { balance: number | null }>;
}> {
  // DeBank: total_balance + all_token_list
  const [totalBalanceRes, allTokenRes] = await Promise.all([
    fetchDeBank("/v1/user/total_balance", address, accessKey),
    fetchDeBank("/v1/user/all_token_list", address, accessKey),
  ]);

  const total_usd_value = totalBalanceRes.total_usd_value ?? 0;
  const chain_list = totalBalanceRes.chain_list ?? [];
  const tokens =
    Array.isArray(allTokenRes) ? allTokenRes : allTokenRes.data ?? allTokenRes ?? [];

  // EVM RPC: 原生币余额
  const evmNative: Record<string, { balance: number | null }> = {};
  await Promise.all(
    Object.keys(EVM_RPC).map(async (chain) => {
      const bal = await fetchNativeBalance(chain, address);
      evmNative[chain] = { balance: bal };
    }),
  );

  return {
    debank: { total_usd_value, chain_list, tokens },
    evmNative,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 支持单个地址或地址数组
    let addressList: string[] = [];
    if (body.addresses) {
      // 如果提供了 addresses 数组
      addressList = Array.isArray(body.addresses) 
        ? body.addresses 
        : [body.addresses];
    } else if (body.address) {
      // 如果提供了单个 address
      addressList = Array.isArray(body.address) 
        ? body.address 
        : [body.address];
    }

    if (addressList.length === 0) {
      return NextResponse.json({ 
        error: "至少需要一个地址。请检查请求体是否包含 'addresses' 或 'address' 字段" 
      }, { status: 400 });
    }

    // 去重并清理地址
    const uniqueAddresses = Array.from(
      new Set(addressList.map((addr: string) => (addr || "").trim()).filter(Boolean)),
    );

    if (uniqueAddresses.length === 0) {
      return NextResponse.json({ 
        error: `地址不能为空。收到 ${addressList.length} 个地址，但清理后全部为空。请检查地址格式是否正确。` 
      }, { status: 400 });
    }

    // 优先使用请求体中的 accessKey，如果没有则使用环境变量
    const accessKey = (body.accessKey || "").trim() || process.env.DEBANK_ACCESS_KEY;
    if (!accessKey) {
      return NextResponse.json(
        { error: "请提供 DeBank AccessKey（可在前端输入或配置环境变量 DEBANK_ACCESS_KEY）" },
        { status: 400 },
      );
    }

    // 批量查询所有地址
    const results = await Promise.all(
      uniqueAddresses.map(async (address: string) => {
        try {
          const portfolio = await fetchPortfolioForAddress(address, accessKey);
          return {
            address,
            success: true,
            data: portfolio,
          };
        } catch (error: any) {
          return {
            address,
            success: false,
            error: error?.message || "查询失败",
          };
        }
      }),
    );

    // 如果是单个地址，返回单个结果格式（向后兼容）
    if (uniqueAddresses.length === 1) {
      const result = results[0];
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(result.data);
    }

    // 多个地址返回批量结果
    return NextResponse.json({ results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

