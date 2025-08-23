"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/cache/components/ui/card";
import { Badge } from "@/cache/components/ui/badge";
import { Button } from "@/cache/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/cache/components/ui/dialog";
import { Input } from "@/cache/components/ui/input";
import { Label } from "@/cache/components/ui/label";
import { Star, TrendingUp, DollarSign, Users } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { LoanMarketABI, LOAN_MARKET_ADDRESS } from "@/app/lib/contracts";
import {
  formatUnits,
  encodeFunctionData,
  decodeFunctionResult,
  parseEther,
} from "viem";

// Mapeamento dos status do contrato para texto legível
const STATUS_MAP = [
  "Open",
  "Funded",
  "Active",
  "Repaid",
  "Defaulted",
  "Cancelled",
];

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================
function ScoreStars({ score }: { score: number }) {
  const displayScore = score > 0 ? score : 0;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= Math.floor(displayScore)
              ? "fill-accent text-accent"
              : "text-muted-foreground"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">
        {displayScore > 0 ? displayScore.toFixed(1) : "N/A"}
      </span>
    </div>
  );
}

// ============================================================================
// COMPONENTE: MODAL PARA REQUISITAR EMPRÉSTIMO
// ============================================================================
interface RequestLoanDialogProps {
  triggerButtonText: string;
  triggerButtonVariant?:
    | "outline"
    | "default"
    | "destructive"
    | "secondary"
    | "ghost"
    | "link"
    | null;
  triggerButtonSize?: "default" | "sm" | "lg" | "icon" | null;
  triggerButtonClassName?: string;
}

function RequestLoanDialog({
  triggerButtonText,
  triggerButtonVariant = "outline",
  triggerButtonSize = "lg",
  triggerButtonClassName = "",
}: RequestLoanDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [interestBps, setInterestBps] = useState("");
  const [durationDays, setDurationDays] = useState("");

  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !amount || !interestBps || !durationDays) {
      alert("Please connect your wallet and fill all fields.");
      return;
    }
    const amountInWei = parseEther(amount);
    const interest = BigInt(interestBps);
    const durationInSeconds = BigInt(Number(durationDays) * 24 * 60 * 60);
    const deadline = BigInt(
      Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60
    );
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "createLoan",
      args: [amountInWei, interest, durationInSeconds, deadline],
    });
  };

  useEffect(() => {
    if (isSuccess && open) {
      const timer = setTimeout(() => {
        setOpen(false);
        setAmount("");
        setInterestBps("");
        setDurationDays("");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerButtonVariant}
          size={triggerButtonSize}
          className={triggerButtonClassName}
        >
          {triggerButtonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request a New Loan</DialogTitle>
          <DialogDescription>
            Fill in the details below. Your request will be visible to investors
            after submission.
          </DialogDescription>
        </DialogHeader>
        {isConnected ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount (ETH)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 1.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="interest" className="text-right">
                  Interest (Bps)
                </Label>
                <Input
                  id="interest"
                  type="number"
                  placeholder="e.g., 500 for 5%"
                  value={interestBps}
                  onChange={(e) => setInterestBps(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="duration" className="text-right">
                  Duration (Days)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="e.g., 30"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending || isConfirming}>
                {isPending
                  ? "Waiting for signature..."
                  : isConfirming
                  ? "Confirming..."
                  : "Submit Request"}
              </Button>
            </DialogFooter>
            {isSuccess && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✅ Loan request created!
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">
                ❌ {(error as any).shortMessage || error.message}
              </p>
            )}
          </form>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please connect your wallet.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 🏦 Card do Empréstimo (com dados do contrato)
function LoanRequestCard({ request }: { request: any }) {
  const { address: userAddress } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const [rating, setRating] = useState(0); // Estado para a avaliação do investidor
  const [hoverRating, setHoverRating] = useState(0); // Estado para o efeito de hover das estrelas

  const isBorrower =
    userAddress?.toLowerCase() === request.borrower.toLowerCase();
  const isInvestor =
    userAddress?.toLowerCase() === request.investor.toLowerCase();

  const repaymentAmount = useMemo(() => {
    const principal = request.amountRequested;
    const interest = BigInt(principal * request.interestBps) / BigInt(10000);
    return principal + interest;
  }, [request.amountRequested, request.interestBps]);

  const handleInvest = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "fundLoan",
      args: [BigInt(request.id)],
      value: request.amountRequested,
    });
  const handleWithdraw = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "withdrawAsBorrower",
      args: [BigInt(request.id)],
    });
  const handleRepay = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "repay",
      args: [BigInt(request.id)],
      value: repaymentAmount,
    });
  const handleLeaveScore = () => {
    if (rating === 0) {
      alert("Please select a score from 1 to 5.");
      return;
    }
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "leaveScore",
      args: [BigInt(request.id), rating],
    });
  };

  const isLoading = isPending || isConfirming;

  const renderActionButtons = () => {
    // VISÃO DO MUTUÁRIO
    if (isBorrower) {
      if (request.status === 1)
        return (
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleWithdraw}
          >
            {isLoading ? "Withdrawing..." : "Withdraw funds"}
          </Button>
        );
      if (request.status === 2)
        return (
          <div className="text-center">
            <Button
              className="w-full"
              size="lg"
              disabled={isLoading}
              onClick={handleRepay}
            >
              {isLoading
                ? "Paying..."
                : `Pay debt (${formatUnits(repaymentAmount, 18)} ETH)`}
            </Button>
          </div>
        );
      return (
        <Button className="w-full" size="lg" disabled>
          {STATUS_MAP[request.status]}
        </Button>
      );
    }

    // VISÃO DO INVESTIDOR
    if (isInvestor) {
      const canLeaveScore =
        (request.status === 3 || request.status === 4) && request.score === 0;
      if (canLeaveScore) {
        return (
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium">Deixe sua avaliação</p>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-6 w-6 cursor-pointer transition-colors ${
                    (hoverRating || rating) >= star
                      ? "fill-accent text-accent"
                      : "text-muted-foreground"
                  }`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={isLoading || rating === 0}
              onClick={handleLeaveScore}
            >
              {isLoading ? "Sending..." : "Send feedback"}
            </Button>
          </div>
        );
      }
    }

    // VISÃO DE OUTROS USUÁRIOS
    const isLoanOpenForInvestment = request.status === 0;
    return (
      <Button
        className="w-full"
        size="lg"
        disabled={!isLoanOpenForInvestment || isLoading}
        onClick={handleInvest}
      >
        {isLoading
          ? isPending
            ? "Signing..."
            : "Confirming..."
          : isLoanOpenForInvestment
          ? "Invest Now"
          : STATUS_MAP[request.status]}
      </Button>
    );
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              Loan Request #{request.id}
            </CardTitle>
            <p
              className="text-sm text-muted-foreground font-mono"
              title={request.borrower}
            >
              {request.borrower.slice(0, 6)}...{request.borrower.slice(-4)}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-accent/10 text-accent-foreground"
          >
            {`${Number(request.durationSecs) / (60 * 60 * 24)} days`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Credit Score</span>
            </div>
            <ScoreStars score={Number(request.score)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Interest Rate</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {Number(request.interestBps) / 100}%
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium">Loan Amount</span>
          </div>
          <p className="text-2xl font-bold">
            {formatUnits(request.amountRequested, 18)} ETH
          </p>
        </div>
        <div className="pt-2 mt-auto">
          {renderActionButtons()}
          {isSuccess && (
            <p className="text-sm text-center mt-2 text-green-600">
              ✅ Transaction Confirmed!
            </p>
          )}
          {error && (
            <p className="text-sm text-center mt-2 text-red-600">
              ❌ {(error as any).shortMessage || error.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ============================================================================
export default function InvestmentRequestsPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);

  const { data: loanCount } = useReadContract({
    abi: LoanMarketABI,
    address: LOAN_MARKET_ADDRESS,
    functionName: "getLoanCount",
  });

  useEffect(() => {
    const fetchLoans = async () => {
      if (typeof loanCount === "undefined" || !(window as any).ethereum) {
        setIsLoadingLoans(false);
        return;
      }
      setIsLoadingLoans(true);
      const count = Number(loanCount);
      const promises = Array.from({ length: count }, (_, i) =>
        (window as any).ethereum
          .request({
            method: "eth_call",
            params: [
              {
                to: LOAN_MARKET_ADDRESS,
                data: encodeFunctionData({
                  abi: LoanMarketABI,
                  functionName: "loans",
                  args: [BigInt(i)],
                }),
              },
              "latest",
            ],
          })
          .then((data: any) => {
            const decoded = decodeFunctionResult({
              abi: LoanMarketABI,
              functionName: "loans",
              data,
            });
            return {
              id: i,
              borrower: decoded[0],
              amountRequested: decoded[1],
              amountFunded: decoded[2],
              interestBps: decoded[3],
              durationSecs: decoded[4],
              fundingDeadline: decoded[5],
              status: decoded[6],
              startTimestamp: decoded[7],
              totalRepayment: decoded[8],
              investor: decoded[9],
              score: decoded[10],
              defaultTimestamp: decoded[11],
            };
          })
      );
      const results = await Promise.all(promises);
      setLoans(results.reverse());
      setIsLoadingLoans(false);
    };
    fetchLoans();
  }, [loanCount]);

  const stats = useMemo(() => {
    if (!loans || loans.length === 0) {
      return {
        activeRequests: 0,
        avgInterestRate: "0.0%",
        totalVolume: "0.00 ETH",
      };
    }
    const openLoans = loans.filter((loan) => loan.status === 0);
    const activeRequests = openLoans.length;
    let avgInterestRate = "0.0%";
    if (openLoans.length > 0) {
      const totalInterestBps = openLoans.reduce(
        (acc, loan) => acc + Number(loan.interestBps),
        0
      );
      avgInterestRate = `${(totalInterestBps / openLoans.length / 100).toFixed(
        1
      )}%`;
    }
    const fundedLoans = loans.filter(
      (loan) => loan.status >= 1 && loan.status < 5
    );
    const totalVolumeWei = fundedLoans.reduce(
      (acc, loan) => acc + loan.amountRequested,
      BigInt(0)
    );
    const totalVolume = `${parseFloat(formatUnits(totalVolumeWei, 18)).toFixed(
      2
    )} ETH`;
    return { activeRequests, avgInterestRate, totalVolume };
  }, [loans]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">DeFi Lending</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <RequestLoanDialog
                triggerButtonText="Request Loan"
                triggerButtonVariant="outline"
                triggerButtonSize="lg"
              />
              <ConnectButton />
            </nav>
          </div>
        </div>
      </header>

      {/* Centralized brand header */}
      <section className="bg-gradient-to-r from-background to-card border-b">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold">DeFi Lending Platform</h1>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Connect borrowers and investors through secure, transparent
              blockchain technology.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Page Stats */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Requests
                  </p>
                  <p className="text-2xl font-bold">{stats.activeRequests}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Avg. Interest Rate
                  </p>
                  <p className="text-2xl font-bold">{stats.avgInterestRate}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Volume</p>
                  <p className="text-2xl font-bold">{stats.totalVolume}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Loan Requests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {isLoadingLoans ? (
            <p className="col-span-full text-center text-muted-foreground">
              Loading loans...
            </p>
          ) : loans.length > 0 ? (
            loans.map((request) => (
              <LoanRequestCard key={request.id} request={request} />
            ))
          ) : (
            <p className="col-span-full text-center text-muted-foreground">
              No loans found.
            </p>
          )}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-2">Need a Loan?</h3>
              <p className="text-muted-foreground mb-6">
                Join our platform and get access to competitive rates from
                verified investors
              </p>
              <RequestLoanDialog
                triggerButtonText="Request a Loan"
                triggerButtonSize="lg"
                triggerButtonClassName="bg-accent hover:bg-accent/90 text-accent-foreground"
              />
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Project explanation section */}
      <section className="bg-card border-t">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How Our Platform Works
            </h2>
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary transform -translate-y-1/2"></div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-primary-foreground">
                      1
                    </span>
                  </div>
                  <div className="bg-background border-2 border-primary/20 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold mb-3 text-primary">
                      Submit Request
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Borrowers create loan requests with their blockchain
                      address, desired amount, and purpose.
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-accent-foreground">
                      2
                    </span>
                  </div>
                  <div className="bg-background border-2 border-accent/20 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold mb-3 text-accent">
                      Verification
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Smart contracts verify borrower credentials and
                      transaction history. Credit scores (1-5) are calculated.
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-primary-foreground">
                      3
                    </span>
                  </div>
                  <div className="bg-background border-2 border-primary/20 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold mb-3 text-primary">
                      Investment
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Investors browse verified requests, review credit scores
                      and interest rates, then fund loans directly.
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-accent-foreground">
                      4
                    </span>
                  </div>
                  <div className="bg-background border-2 border-accent/20 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold mb-3 text-accent">
                      Automated Returns
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Smart contracts automatically handle repayments and
                      interest distribution to investor wallets.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-2">Higher Returns</h4>
                  <p className="text-sm text-muted-foreground">
                    Earn 8-18% APY by cutting out traditional banking
                    intermediaries
                  </p>
                </CardContent>
              </Card>
              <Card className="border-accent/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="h-6 w-6 text-accent" />
                  </div>
                  <h4 className="font-semibold mb-2">Full Transparency</h4>
                  <p className="text-sm text-muted-foreground">
                    All transactions recorded on blockchain for complete audit
                    trail
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-2">Global Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect with borrowers and investors worldwide, 24/7
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold">DeFi Lending</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Secure, transparent, and decentralized lending platform built on
                blockchain technology.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    How it Works
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Security
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Fees
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Community
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Risk Disclosure
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 DeFi Lending Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
