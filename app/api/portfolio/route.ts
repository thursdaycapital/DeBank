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
    throw new Error(`DeBank error: HTTP ${res.status}`);
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
    const addresses = body.addresses || body.address ? [body.address] : [];

    // 支持单个地址或地址数组
    const addressList = Array.isArray(addresses)
      ? addresses
      : typeof addresses === "string"
        ? [addresses]
        : [];

    if (addressList.length === 0) {
      return NextResponse.json({ error: "至少需要一个地址" }, { status: 400 });
    }

    // 去重并清理地址
    const uniqueAddresses = Array.from(
      new Set(addressList.map((addr: string) => (addr || "").trim()).filter(Boolean)),
    );

    if (uniqueAddresses.length === 0) {
      return NextResponse.json({ error: "地址不能为空" }, { status: 400 });
    }

    const accessKey = process.env.DEBANK_ACCESS_KEY;
    if (!accessKey) {
      return NextResponse.json(
        { error: "后端未配置 DEBANK_ACCESS_KEY" },
        { status: 500 },
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

