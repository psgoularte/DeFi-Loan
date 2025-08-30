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
import { Switch } from "@/cache/components/ui/switch";
import {
  Star,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  Sparkles,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/cache/components/ui/tooltip";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { LoanMarketABI, LOAN_MARKET_ADDRESS } from "@/app/lib/contracts";
import { formatUnits, parseEther } from "viem";

const STATUS_MAP = [
  "Open",
  "Funded",
  "Active",
  "Repaid",
  "Defaulted",
  "Cancelled",
];

type AiAnalysisResult = {
  riskScore: number;
  analysis: string;
};

type Loan = {
  id: number;
  borrower: `0x${string}`;
  amountRequested: bigint;
  amountFunded: bigint;
  interestBps: bigint;
  durationSecs: bigint;
  fundingDeadline: bigint;
  status: number;
  startTimestamp: bigint;
  totalRepayment: bigint;
  investor: `0x${string}`;
  score: number;
  defaultTimestamp: bigint;
  collateralAmount: bigint;
  collateralClaimed: boolean;
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================
function ScoreStars({
  score,
  completedLoans,
  isFinalScore,
}: {
  score: number;
  completedLoans: number;
  isFinalScore?: boolean;
}) {
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
      <div className="flex flex-col items-start ml-2">
        <span className="text-sm font-medium leading-tight">
          {displayScore > 0 ? displayScore.toFixed(1) : "N/A"}
        </span>
        {isFinalScore ? (
          <span className="text-xs text-accent leading-tight">Final score</span>
        ) : (
          <span className="text-xs text-muted-foreground leading-tight">
            {completedLoans > 0
              ? `from ${completedLoans} loan${completedLoans > 1 ? "s" : ""}`
              : "New Borrower"}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente para o investidor deixar a avaliação e sacar
function InvestorActionWithScore({
  title,
  description,
  buttonText,
  loadingText,
  action,
  isLoading,
}: {
  title: string;
  description: string;
  buttonText: string;
  loadingText: string;
  action: (score: number) => void;
  isLoading: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
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
        onClick={() => action(rating)}
      >
        {isLoading ? loadingText : buttonText}
      </Button>
    </div>
  );
}

// ============================================================================
// LOAN REQUEST MODAL COMPONENT
// ============================================================================
function RequestLoanDialog({
  onLoanCreated,
  trigger,
}: {
  onLoanCreated: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [interestBps, setInterestBps] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [collateral, setCollateral] = useState("");
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !amount || !interestBps || !durationDays) return;

    const amountInWei = parseEther(amount);
    const interest = BigInt(interestBps);
    const durationInSeconds = BigInt(Number(durationDays) * 24 * 60 * 60);
    const deadline = BigInt(
      Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60
    );
    const collateralInWei = collateral ? parseEther(collateral) : BigInt(0);

    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "createLoan",
      args: [
        amountInWei,
        interest,
        durationInSeconds,
        deadline,
        collateralInWei,
      ],
      value: collateralInWei,
    });
  };

  useEffect(() => {
    if (isSuccess && open) {
      onLoanCreated();
      const timer = setTimeout(() => {
        setOpen(false);
        setAmount("");
        setInterestBps("");
        setDurationDays("");
        setCollateral("");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, open, onLoanCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request a New Loan</DialogTitle>
          <DialogDescription>
            Fill in the details below. You can add optional collateral to
            increase trust.
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collateral" className="text-right">
                  Collateral (ETH)
                </Label>
                <Input
                  id="collateral"
                  type="number"
                  placeholder="Optional, e.g., 0.1"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending || isConfirming}>
                {isPending
                  ? "Waiting..."
                  : isConfirming
                  ? "Confirming..."
                  : "Submit Request"}
              </Button>
            </DialogFooter>
            {isSuccess && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✅ Loan request created! Refreshing list...
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">
                ❌{" "}
                {(error as { shortMessage?: string }).shortMessage ||
                  error.message}
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

// ============================================================================
// LOAN REQUEST CARD COMPONENT
// ============================================================================
function LoanRequestCard({
  request,
  completedLoans,
  onAction,
}: {
  request: Loan;
  completedLoans: number;
  onAction: () => void;
}) {
  const { address: userAddress } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (isSuccess) {
      onAction();
    }
  }, [isSuccess, onAction]);

  const isRepaymentDue = useMemo(() => {
    if (request.status !== 2) return false;

    const repaymentDeadline =
      Number(request.startTimestamp) + Number(request.durationSecs);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    return currentTimestamp > repaymentDeadline;
  }, [request.status, request.startTimestamp, request.durationSecs]);

  const isLoanOpenForInvestment = useMemo(() => {
    if (request.status !== 0) return false;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    return currentTimestamp < Number(request.fundingDeadline);
  }, [request.status, request.fundingDeadline]);

  const { data: averageScoreData } = useReadContract({
    abi: LoanMarketABI,
    address: LOAN_MARKET_ADDRESS,
    functionName: "averageScoreOfBorrower",
    args: [request.borrower],
  });

  const displayScore = useMemo(() => {
    if (request.score > 0) return request.score;
    if (averageScoreData) return Number(averageScoreData) / 100;
    return 0;
  }, [request.score, averageScoreData]);

  const isBorrower =
    userAddress?.toLowerCase() === request.borrower.toLowerCase();
  const isInvestor =
    userAddress?.toLowerCase() === request.investor.toLowerCase();

  const repaymentAmount = useMemo(() => {
    const principal = request.amountRequested;
    const interest = (principal * request.interestBps) / BigInt(10000);
    return principal + interest;
  }, [request.amountRequested, request.interestBps]);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiError("");
    setAiAnalysis(null);

    try {
      const payload = {
        address: request.borrower,
        amount: formatUnits(request.amountRequested, 18),
        interestBps: Number(request.interestBps),
        durationDays: Number(request.durationSecs) / (60 * 60 * 24),
        collateral: formatUnits(request.collateralAmount, 18),
        completedLoans: completedLoans,
      };

      const response = await fetch("/api/risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed. Please try again.");
      }

      const data = await response.json();
      setAiAnalysis(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError("An unknown error occurred.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

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
  const handleCancel = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "cancelLoan",
      args: [BigInt(request.id)],
    });
  const handleWithdrawInvestorShare = (score: number) =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "withdrawInvestorShare",
      args: [BigInt(request.id), score],
    });
  const handleClaimCollateral = (score: number) =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "claimCollateral",
      args: [BigInt(request.id), score],
    });

  const isLoading = isPending || isConfirming;

  const renderActionButtons = () => {
    // Borrower's view
    if (isBorrower) {
      if (request.status === 0) {
        // Open
        return (
          <Button
            className="w-full"
            size="lg"
            variant="destructive"
            disabled={isLoading}
            onClick={handleCancel}
          >
            {isLoading ? "Cancelling..." : "Cancel Loan"}
          </Button>
        );
      }
      if (request.status === 1) {
        // Funded
        return (
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleWithdraw}
          >
            {isLoading ? "Withdrawing..." : "Withdraw Funds"}
          </Button>
        );
      }
      if (request.status === 2) {
        // Active
        return (
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleRepay}
          >
            {isLoading
              ? "Repaying..."
              : `Repay Loan (${formatUnits(repaymentAmount, 18)} ETH)`}
          </Button>
        );
      }
      // For Repaid (3) or Defaulted (4) loans, there are no more actions for the borrower.
      // Collateral is handled automatically by the contract.
      return (
        <Button className="w-full" size="lg" disabled>
          {STATUS_MAP[request.status]}
        </Button>
      );
    }

    // Investor's view
    if (isInvestor) {
      if (request.status === 2 && isRepaymentDue) {
        // Active but overdue
        return (
          <InvestorActionWithScore
            title="Loan Overdue"
            description="Trigger default to claim collateral and leave your feedback."
            buttonText="Trigger Default & Claim Collateral"
            loadingText="Triggering..."
            action={handleClaimCollateral}
            isLoading={isLoading}
          />
        );
      }
      if (request.status === 3) {
        // Repaid
        return (
          <InvestorActionWithScore
            title="Loan Repaid"
            description="Withdraw your funds and leave a final score for the borrower."
            buttonText="Withdraw & Submit Score"
            loadingText="Withdrawing..."
            action={handleWithdrawInvestorShare}
            isLoading={isLoading}
          />
        );
      }
      if (request.status === 4) {
        // Defaulted
        return (
          <InvestorActionWithScore
            title="Borrower Defaulted"
            description="Claim the collateral and leave a final score."
            buttonText={`Claim ${formatUnits(
              request.collateralAmount,
              18
            )} ETH & Submit Score`}
            loadingText="Claiming..."
            action={handleClaimCollateral}
            isLoading={isLoading}
          />
        );
      }
      return (
        <Button className="w-full" size="lg" disabled>
          {STATUS_MAP[request.status]}
        </Button>
      );
    }

    // Public view (potential investor)
    return (
      <div className="space-y-3">
        {isLoanOpenForInvestment && (
          <div className="space-y-2">
            {!aiAnalysis && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAiAnalysis}
                disabled={isAnalyzing}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isAnalyzing ? "Analyzing..." : "Analyze Risk with AI"}
              </Button>
            )}
            {isAnalyzing && (
              <p className="text-xs text-center text-muted-foreground">
                Searching data on-chain...
              </p>
            )}
            {aiError && (
              <p className="text-xs text-center text-red-500">{aiError}</p>
            )}
            {aiAnalysis && (
              <div className="p-3 bg-card rounded-md border text-center">
                <p className="text-sm font-bold">
                  Risk Score:{" "}
                  <span className="text-green-500">
                    {aiAnalysis.riskScore}/100
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aiAnalysis.analysis}
                </p>
              </div>
            )}
          </div>
        )}
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
      </div>
    );
  };

  const loanEndDate = useMemo(() => {
    if (request.status < 1) return null;
    const endDate = new Date(
      (Number(request.startTimestamp) + Number(request.durationSecs)) * 1000
    );
    return (
      endDate.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      }) +
      ", " +
      endDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }, [request.status, request.startTimestamp, request.durationSecs]);

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
            {(isBorrower || isInvestor) && (
              <Badge
                variant={isBorrower ? "default" : "secondary"}
                className="mt-2"
              >
                {isBorrower ? "Your Loan" : "You are the Investor"}
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end">
            <Badge
              variant="default"
              className="bg-accent text-accent-foreground"
            >
              {`${Number(request.durationSecs) / (60 * 60 * 24)} days`}
            </Badge>
            {loanEndDate && (
              <p className="text-xs text-muted-foreground text-right mt-1">
                {loanEndDate}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Credit Score</span>
            </div>
            <ScoreStars
              score={displayScore}
              completedLoans={completedLoans}
              isFinalScore={
                (request.status === 3 || request.status === 4) &&
                request.score > 0
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Interest Rate</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Platform charges a 10% fee on investor profits.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
        {request.collateralAmount > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Collateral</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      10% fee on claimed collateral in case of default.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xl font-bold">
              {formatUnits(request.collateralAmount, 18)} ETH
            </p>
          </div>
        )}
        <div className="pt-2 mt-auto">
          {renderActionButtons()}
          {isSuccess && (
            <p className="text-sm text-center mt-2 text-green-600">
              ✅ Transaction Confirmed!
            </p>
          )}
          {error && (
            <p className="text-sm text-center mt-2 text-red-600">
              ❌{" "}
              {(error as { shortMessage?: string }).shortMessage ||
                error.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function InvestmentRequestsPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMyLoansOnly, setShowMyLoansOnly] = useState(false);
  const itemsPerPage = 9;
  const { isConnected, address: userAddress } = useAccount();

  const {
    data: loanCount,
    isLoading: isLoadingCount,
    refetch: refetchLoanCount,
  } = useReadContract({
    abi: LoanMarketABI,
    address: LOAN_MARKET_ADDRESS,
    functionName: "getLoanCount",
  });

  const loanContracts = useMemo(() => {
    if (!loanCount) return [];
    const count = Number(loanCount);
    return Array.from({ length: count }, (_, i) => ({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "loans",
      args: [BigInt(i)],
    }));
  }, [loanCount]);

  const {
    data: loansData,
    isLoading: isLoadingLoansData,
    refetch: refetchLoansData,
  } = useReadContracts({
    contracts: loanContracts,
    query: { enabled: isConnected && loanContracts.length > 0 },
  });

  const handleAction = () => {
    // This function forces a refresh of the loan data after a transaction
    setTimeout(() => {
      refetchLoanCount();
      refetchLoansData();
    }, 1000); // Small delay to allow blockchain to update
  };

  const handleLoanCreated = () => {
    // Force a recount and refetch when a new loan is created
    setTimeout(() => {
      refetchLoanCount();
    }, 1000);
  };

  useEffect(() => {
    if (loansData) {
      const formattedLoans = loansData
        .filter((res) => res.status === "success")
        .map((result, i) => {
          const loanData = result.result as any;
          return {
            id: i,
            borrower: loanData[0],
            amountRequested: loanData[1],
            amountFunded: loanData[2],
            interestBps: loanData[3],
            durationSecs: loanData[4],
            fundingDeadline: loanData[5],
            status: loanData[6],
            startTimestamp: loanData[7],
            totalRepayment: loanData[8],
            investor: loanData[9],
            score: loanData[10],
            defaultTimestamp: loanData[11],
            collateralAmount: loanData[12],
            collateralClaimed: loanData[13],
          };
        });
      setLoans(formattedLoans.reverse());
    }
  }, [loansData]);

  const borrowerStats = useMemo(() => {
    const stats: { [key: string]: { completedLoans: number } } = {};
    loans.forEach((loan) => {
      const borrowerAddress = loan.borrower.toLowerCase();
      if (!stats[borrowerAddress]) {
        stats[borrowerAddress] = { completedLoans: 0 };
      }
      if (loan.status === 3 || loan.status === 4) {
        stats[borrowerAddress].completedLoans += 1;
      }
    });
    return stats;
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => loan.status !== 5) // Filter out Cancelled loans
      .filter((loan) => {
        if (!showMyLoansOnly || !userAddress) return true;
        const userAddr = userAddress.toLowerCase();
        return (
          loan.borrower.toLowerCase() === userAddr ||
          loan.investor.toLowerCase() === userAddr
        );
      });
  }, [loans, showMyLoansOnly, userAddress]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLoans = filteredLoans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [showMyLoansOnly]);

  const stats = useMemo(() => {
    if (!loans || loans.length === 0)
      return {
        activeRequests: 0,
        avgInterestRate: "0.0%",
        totalVolume: "0.00 ETH",
      };
    const openLoans = loans.filter(
      (loan) => loan.status >= 0 && loan.status < 4
    );
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
    const processedLoans = loans.filter(
      (loan) => loan.status >= 1 && loan.status < 5
    );
    const totalVolumeWei = processedLoans.reduce(
      (acc, loan) => acc + loan.amountRequested,
      BigInt(0)
    );
    const totalVolume = `${parseFloat(formatUnits(totalVolumeWei, 18)).toFixed(
      2
    )} ETH`;
    return { activeRequests, avgInterestRate, totalVolume };
  }, [loans]);

  const isLoading = isLoadingCount || isLoadingLoansData;
  const NotConnectedView = () => (
    <div className="col-span-full text-center py-16">
      <h3 className="text-2xl font-semibold mb-2">Welcome to LenDeFi</h3>
      <p className="text-muted-foreground">
        Please connect your wallet to view and interact with loan requests.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-xl font-black text-primary-foreground">
                  L
                </span>
              </div>
              <h1 className="text-xl font-bold">LenDeFi</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <RequestLoanDialog
                onLoanCreated={handleLoanCreated}
                trigger={
                  <Button variant="outline" size="lg">
                    Request Loan
                  </Button>
                }
              />
              <ConnectButton />
            </nav>
          </div>
        </div>
      </header>
      <section className="bg-gradient-to-r from-background to-card border-b">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-2xl font-black text-primary-foreground">
                  L
                </span>
              </div>
              <h1 className="text-3xl font-bold">LenDeFi</h1>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Decentralized P2P lending powered by Smart Contracts. Connect
              directly with investors and borrowers on the blockchain.
            </p>
          </div>
        </div>
      </section>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          {isConnected && (
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
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg. Interest Rate
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.avgInterestRate}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Volume
                    </p>
                    <p className="text-2xl font-bold">{stats.totalVolume}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {isConnected && (
            <div className="flex justify-end items-center mb-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="my-loans-filter"
                  checked={showMyLoansOnly}
                  onCheckedChange={setShowMyLoansOnly}
                />
                <Label htmlFor="my-loans-filter">Show My Loans Only</Label>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {!isConnected ? (
            <NotConnectedView />
          ) : isLoading ? (
            <p className="col-span-full text-center text-muted-foreground">
              Loading loans...
            </p>
          ) : currentLoans.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground">
              {showMyLoansOnly
                ? "You are not involved in any loans."
                : "No loans found. Create the first one!"}
            </p>
          ) : (
            currentLoans.map((request, index) => (
              <LoanRequestCard
                key={request.id}
                request={{
                  ...request,
                  id: loans.length - 1 - (indexOfFirstItem + index),
                }}
                completedLoans={
                  borrowerStats[request.borrower.toLowerCase()]
                    ?.completedLoans || 0
                }
                onAction={handleAction}
              />
            ))
          )}
        </div>
        {totalPages > 1 && isConnected && (
          <div className="mt-8 flex justify-center items-center gap-4">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              variant="ghost"
            >
              Previous
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              variant="ghost"
            >
              Next
            </Button>
          </div>
        )}
        <div className="text-center mt-12">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-2">Need a Loan?</h3>
              <p className="text-muted-foreground mb-6">
                Join our platform and get access to competitive rates from
                verified investors.
              </p>
              <RequestLoanDialog
                onLoanCreated={handleLoanCreated}
                trigger={
                  <Button variant="default" size="lg">
                    Request a Loan
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </main>
      <section className="bg-card border-t">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How LenDeFi Works
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
                      Borrowers create loan requests specifying amount,
                      interest, and duration. Optional collateral can be added
                      to increase trust and lower rates.
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
                      AI Risk Analysis
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Investors can use an AI-powered tool to analyze the
                      borrower's on-chain history, receiving a risk score to
                      inform their decision.
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
                      Funding & Repayment
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Investors fund loans directly. Borrowers repay the
                      contract, which automatically returns collateral,
                      streamlining the process.
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
                      Mandatory Feedback
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Investors must submit a final score for the borrower to
                      withdraw their profits or claim collateral, building a
                      robust reputation system.
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
                    Earn competitive interest rates by lending directly to
                    peers, cutting out traditional financial middlemen.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-accent/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="h-6 w-6 text-accent" />
                  </div>
                  <h4 className="font-semibold mb-2">On-Chain Security</h4>
                  <p className="text-sm text-muted-foreground">
                    All transactions are secured by a smart contract, ensuring
                    funds are handled according to predefined rules.
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
                    Connect with borrowers and investors worldwide, 24/7,
                    without geographical restrictions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center text-center">
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                  <span className="font-bold text-primary-foreground">L</span>
                </div>
                <span className="font-bold">LenDeFi</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Secure, transparent, and decentralized lending platform built on
                blockchain technology.
              </p>
            </div>
          </div>
          <a
            href="https://github.com/psgoularte/DeFi-Loan"
            className="flex justify-center mt-8 text-m text-white hover:text-muted-foreground"
          >
            Github Project
          </a>
        </div>
      </footer>
    </div>
  );
}
