import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { Redis } from "@upstash/redis";

const githubToken = process.env.GITHUB_TOKEN;
const infuraUrl = process.env.SEPOLIA_URL;

const model = "deepseek/DeepSeek-V3-0324";
const githubEndpoint = "https://models.github.ai/inference";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});
const CACHE_DURATION_SECONDS = 30 * 60; // 30 minutos

if (!githubToken || !infuraUrl || !process.env.UPSTASH_REDIS_REST_URL) {
  console.error(
    "ERRO CRÍTICO: Uma ou mais variáveis de ambiente (GITHUB_TOKEN, INFURA_HTTPS_URL, UPSTASH_REDIS_*) não foram definidas."
  );
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(infuraUrl),
});

async function getOnChainData(address: `0x${string}`) {
  try {
    const [balance, transactionCount] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getTransactionCount({ address }),
    ]);
    const ethBalance = parseFloat(formatUnits(balance, 18)).toFixed(4);
    return {
      transactionCount: Number(transactionCount),
      ethBalance: parseFloat(ethBalance),
    };
  } catch (error) {
    console.error(`Falha ao buscar dados para ${address} via Infura:`, error);
    return { transactionCount: 0, ethBalance: 0 };
  }
}

export async function POST(request: Request) {
  if (!githubToken || !infuraUrl || !process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json(
      { error: "Configuração do servidor incompleta." },
      { status: 500 }
    );
  }

  try {
    const {
      address,
      amount,
      interestBps,
      durationDays,
      collateral,
      completedLoans,
    } = await request.json();
    const borrowerAddress = address as `0x${string}`;

    if (!borrowerAddress) {
      return NextResponse.json(
        { error: "Endereço da carteira é obrigatório." },
        { status: 400 }
      );
    }

    const cacheKey = `analysis:github:${address}-${amount}-${interestBps}-${durationDays}-${collateral}`;
    const cachedEntry = await redis.get<any>(cacheKey);
    if (cachedEntry) {
      console.log("Servindo resposta do cache para a chave:", cacheKey);
      return NextResponse.json(cachedEntry);
    }
    console.log(
      "Cache não encontrado. Buscando novos dados para a chave:",
      cacheKey
    );

    const onChainData = await getOnChainData(borrowerAddress);

    const prompt = `
      Analise o risco de um empréstimo P2P. Responda ESTRITAMENTE e APENAS com um objeto JSON válido.

      **Dados do Tomador:**
      - Empréstimos concluídos na plataforma: ${completedLoans}
      - Total de transações da carteira: ${onChainData.transactionCount}
      - Saldo de ETH: ${onChainData.ethBalance} ETH
      
      **Termos do Empréstimo:**
      - Valor: ${amount} ETH
      - Juros: ${interestBps / 100}%
      - Duração: ${durationDays} dias
      - Colateral: ${collateral} ETH

      **Formato JSON Obrigatório:**
      {
        "riskScore": um número de 0 a 100 (100 = menor risco),
        "analysis": "Uma análise curta em uma frase EM INGLÊS."
      }
    `;

    const body = {
      model: model,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente especialista em análise de risco DeFi que responde apenas com JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 250,
    };

    const response = await fetch(`${githubEndpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API do GitHub AI:", errorText);
      throw new Error(`Erro na API de IA: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;

    try {
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("JSON não encontrado na resposta da IA.");
      }
      const jsonString = content.substring(jsonStart, jsonEnd + 1);
      const parsedContent = JSON.parse(jsonString);

      await redis.set(cacheKey, JSON.stringify(parsedContent), {
        ex: CACHE_DURATION_SECONDS,
      });

      return NextResponse.json(parsedContent);
    } catch {
      console.error("DEBUG: Resposta da IA que falhou no parse:", content);
      throw new Error("A resposta da IA não estava no formato JSON esperado.");
    }
  } catch (error: unknown) {
    let errorMessage = "Falha ao processar a análise.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error("Erro na rota /api/risk-analysis:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
