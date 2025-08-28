// Em: src/app/api/analyze-borrower/route.ts

import { NextResponse } from "next/server";
import { formatUnits } from "viem";

// --- Configurações das APIs ---
const githubToken = process.env.GITHUB_TOKEN;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
const endpoint = "https://models.github.ai/inference/chat/completions";
const model = "deepseek/DeepSeek-V3-0324";
// -----------------------------------------

interface AiResponse {
  riskScore: number;
  analysis: string;
}

// Função para buscar dados on-chain
async function getOnChainData(address: string) {
  if (!etherscanApiKey) {
    throw new Error(
      "A chave da API do Etherscan não foi configurada no servidor."
    );
  }
  const baseUrl = "https://api.etherscan.io/api";
  const balanceUrl = `${baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanApiKey}`;
  const transactionsUrl = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${etherscanApiKey}`;
  try {
    const [balanceResponse, txResponse] = await Promise.all([
      fetch(balanceUrl),
      fetch(transactionsUrl),
    ]);
    if (!balanceResponse.ok || !txResponse.ok) {
      throw new Error("Falha ao buscar dados no Etherscan.");
    }
    const balanceData = await balanceResponse.json();
    const txData = await txResponse.json();
    const ethBalance = parseFloat(
      formatUnits(BigInt(balanceData.result), 18)
    ).toFixed(4);
    const transactionCount = txData.result.length;
    let walletAgeDays = 0;
    if (transactionCount > 0) {
      const firstTxTimestamp = parseInt(txData.result[0].timeStamp) * 1000;
      const ageInMillis = Date.now() - firstTxTimestamp;
      walletAgeDays = Math.floor(ageInMillis / (1000 * 60 * 60 * 24));
    }
    const defiInteractions =
      transactionCount > 50 ? ["Protocolos Variados"] : ["Atividade Limitada"];
    const hasENS = false;
    return {
      walletAgeDays,
      transactionCount,
      ethBalance: parseFloat(ethBalance),
      defiInteractions,
      hasENS,
    };
  } catch (error) {
    console.error("Erro ao buscar dados do Etherscan:", error);
    return {
      walletAgeDays: 0,
      transactionCount: 0,
      ethBalance: 0,
      defiInteractions: ["Erro na busca"],
      hasENS: false,
    };
  }
}

export async function POST(request: Request) {
  if (!githubToken || !etherscanApiKey) {
    return NextResponse.json(
      {
        error:
          "Configuração do servidor incompleta. As chaves de API estão ausentes.",
      },
      { status: 500 }
    );
  }

  try {
    const { address, amount, interestBps, durationDays, collateral } =
      await request.json();

    if (!address) {
      return NextResponse.json(
        { error: "Endereço da carteira é obrigatório." },
        { status: 400 }
      );
    }

    const onChainData = await getOnChainData(address);

    const prompt = `
      Analise o risco de um empréstimo P2P para um investidor.

      **Dados On-Chain do Tomador:**
      - Idade da carteira: ${onChainData.walletAgeDays} dias
      - Transações: ${onChainData.transactionCount}
      - Saldo: ${onChainData.ethBalance} ETH
      - Interações: ${onChainData.defiInteractions.join(", ")}
      
      **Termos do Empréstimo:**
      - Valor: ${amount} ETH
      - Juros: ${interestBps / 100}%
      - Duração: ${durationDays} dias
      - Colateral: ${collateral} ETH

      **Tarefa:**
      Avalie o risco para um investidor.
      Responda ESTRITAMENTE e APENAS com um objeto JSON. Não inclua texto, explicações ou markdown antes ou depois do objeto JSON.

      **Formato JSON Obrigatório:**
      {
        "riskScore": um número de 0 a 100 (100 = menor risco),
        "analysis": "Uma análise curta em uma frase explicando a pontuação em INGLÊS."
      }
    `;

    const body = {
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente especialista em análise de risco DeFi que responde apenas com JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5, // Mais baixo para ser mais direto e menos criativo
      top_p: 1.0,
      max_tokens: 250,
      model: model,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro da API de IA:", errorData);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;

    try {
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Nenhum objeto JSON encontrado na resposta da IA.");
      }

      const jsonString = content.substring(jsonStart, jsonEnd + 1);
      const parsedContent: AiResponse = JSON.parse(jsonString);

      return NextResponse.json(parsedContent);
    } catch (_parseError) {
      console.error(
        "DEBUG: Resposta completa da IA que falhou no parse:",
        content
      );
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
