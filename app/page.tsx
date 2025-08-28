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
  Info,
} from "lucide-react"; // Icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/cache/components/ui/tooltip"; // Tooltip for info
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

// Tipo Loan com novos campos de garantia
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
// ScoreStars agora recebe o número de empréstimos concluídos
function ScoreStars({
  score,
  completedLoans,
}: {
  score: number;
  completedLoans: number;
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
        <span className="text-xs text-muted-foreground leading-tight">
          {completedLoans > 0
            ? `from ${completedLoans} loan${completedLoans > 1 ? "s" : ""}`
            : "New Borrower"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// LOAN REQUEST MODAL COMPONENT
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
      const timer = setTimeout(() => {
        setOpen(false);
        setAmount("");
        setInterestBps("");
        setDurationDays("");
        setCollateral("");
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
                ✅ Loan request created!
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
}: {
  request: Loan;
  completedLoans: number;
}) {
  const { address: userAddress } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

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

  const { data: withdrawableAmount } = useReadContract({
    abi: LoanMarketABI,
    address: LOAN_MARKET_ADDRESS,
    functionName: "withdrawableOf",
    args: [BigInt(request.id)],
    query: { enabled: isInvestor && request.status === 3 },
  });

  const repaymentAmount = useMemo(() => {
    const principal = request.amountRequested;
    const interest = (principal * request.interestBps) / BigInt(10000);
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
  const handleCancel = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "cancelLoan",
      args: [BigInt(request.id)],
    });
  const handleCancelFundedLoan = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "cancelFundedLoan",
      args: [BigInt(request.id)],
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
  const handleWithdrawInvestorShare = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "withdrawInvestorShare",
      args: [BigInt(request.id)],
    });
  const handleWithdrawCollateral = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "withdrawCollateral",
      args: [BigInt(request.id)],
    });
  const handleClaimCollateral = () =>
    writeContract({
      abi: LoanMarketABI,
      address: LOAN_MARKET_ADDRESS,
      functionName: "claimCollateral",
      args: [BigInt(request.id)],
    });

  const isLoading = isPending || isConfirming;

  const isFundedAndExpired = useMemo(() => {
    if (request.status !== 1) return false; // Must be Funded
    const expirationTimestamp =
      Number(request.startTimestamp) + Number(request.durationSecs);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    return currentTimestamp > expirationTimestamp;
  }, [request.status, request.startTimestamp, request.durationSecs]);

  const renderActionButtons = () => {
    if (isBorrower) {
      if (request.status === 0)
        return (
          <Button
            className="w-full"
            size="lg"
            variant="default"
            disabled={isLoading}
            onClick={handleCancel}
          >
            {isLoading ? "Cancelling..." : "Cancel Loan"}
          </Button>
        );
      if (request.status === 1)
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
      if (request.status === 2 || request.status === 4)
        return (
          <div className="text-center">
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
            <p className="text-xs text-muted-foreground mt-1">
              Principal + Interest
            </p>
          </div>
        );
      if (
        request.status === 3 &&
        request.collateralAmount > 0 &&
        !request.collateralClaimed
      ) {
        return (
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleWithdrawCollateral}
          >
            {isLoading
              ? "Returning..."
              : `Withdraw ${formatUnits(
                  request.collateralAmount,
                  18
                )} ETH Collateral`}
          </Button>
        );
      }
      return (
        <Button className="w-full" size="lg" disabled>
          {STATUS_MAP[request.status]}
        </Button>
      );
    }

    if (isInvestor) {
      if (request.status === 1 && isFundedAndExpired) {
        return (
          <Button
            className="w-full"
            size="lg"
            variant="default"
            disabled={isLoading}
            onClick={handleCancelFundedLoan}
          >
            {isLoading ? "Cancelling..." : "Cancel & Reclaim Funds"}
          </Button>
        );
      }
      if (request.status === 3) {
        // Repaid
        if (withdrawableAmount && withdrawableAmount > 0)
          return (
            <Button
              className="w-full"
              size="lg"
              disabled={isLoading}
              onClick={handleWithdrawInvestorShare}
            >
              {isLoading
                ? "Withdrawing..."
                : `Withdraw ${formatUnits(withdrawableAmount, 18)} ETH`}
            </Button>
          );
        if (request.score === 0)
          return (
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium">Leave your feedback</p>
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
                {isLoading ? "Submitting..." : "Submit Score"}
              </Button>
            </div>
          );
      }
      if (request.status === 4) {
        // Defaulted
        if (request.collateralAmount > 0 && !request.collateralClaimed)
          return (
            <Button
              className="w-full"
              size="lg"
              variant="destructive"
              disabled={isLoading}
              onClick={handleClaimCollateral}
            >
              {isLoading
                ? "Claiming..."
                : `Claim ${formatUnits(
                    request.collateralAmount,
                    18
                  )} ETH Collateral`}
            </Button>
          );
        if (request.score === 0)
          return (
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium text-destructive">
                Borrower defaulted. Leave your feedback
              </p>
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
                {isLoading ? "Submitting..." : "Submit Score"}
              </Button>
            </div>
          );
      }
      return (
        <Button className="w-full" size="lg" disabled>
          {STATUS_MAP[request.status]}
        </Button>
      );
    }

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

  const loanEndDate = useMemo(() => {
    if (request.status < 1) return null; // Only show date if loan is Active or finished
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
          </div>
          <div className="flex flex-col items-end">
            <Badge
              variant="default"
              className="bg-accent text-accent-foreground"
            >{`${Number(request.durationSecs) / (60 * 60 * 24)} days`}</Badge>
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
            <ScoreStars score={displayScore} completedLoans={completedLoans} />
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

  const { data: loanCount, isLoading: isLoadingCount } = useReadContract({
    abi: LoanMarketABI,
    address: LOAN_MARKET_ADDRESS,
    functionName: "getLoanCount",
    query: { enabled: isConnected },
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

  const { data: loansData, isLoading: isLoadingLoansData } = useReadContracts({
    contracts: loanContracts,
    query: { enabled: isConnected && loanContracts.length > 0 },
  });

  useEffect(() => {
    if (loansData) {
      const formattedLoans = loansData.map((result, i) => {
        const decoded = result.result as unknown as [
          `0x${string}`,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          number,
          bigint,
          bigint,
          `0x${string}`,
          number,
          bigint,
          bigint,
          boolean
        ];
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
          collateralAmount: decoded[12],
          collateralClaimed: decoded[13],
        };
      });
      setLoans(formattedLoans.reverse());
    }
  }, [loansData]);

  // Calcula o número de empréstimos concluídos para cada devedor
  const borrowerStats = useMemo(() => {
    const stats: { [key: string]: { completedLoans: number } } = {};
    loans.forEach((loan) => {
      const borrowerAddress = loan.borrower.toLowerCase();
      if (!stats[borrowerAddress]) {
        stats[borrowerAddress] = { completedLoans: 0 };
      }
      if (loan.status === 3 || loan.status === 4) {
        // Repaid or Defaulted
        stats[borrowerAddress].completedLoans += 1;
      }
    });
    return stats;
  }, [loans]);

  //Filtro de Paginação
  const filteredLoans = useMemo(() => {
    return (
      loans
        // 1. Oculta empréstimos cancelados
        .filter((loan) => loan.status !== 5)
        // 2. Aplica o filtro 'Meus Empréstimos' se estiver ativo
        .filter((loan) => {
          if (!showMyLoansOnly || !userAddress) return true;
          const userAddr = userAddress.toLowerCase();
          return (
            loan.borrower.toLowerCase() === userAddr ||
            loan.investor.toLowerCase() === userAddr
          );
        })
    );
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

  // Reseta a página para 1 quando o filtro muda
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
    const proccesLoans = loans.filter(
      (loan) => loan.status >= 1 && loan.status < 5
    );
    const totalVolumeWei = proccesLoans.reduce(
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
                triggerButtonText="Request Loan"
                triggerButtonVariant="outline"
                triggerButtonSize="lg"
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
          {/*Filtro 'Meus Empréstimos' */}
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
            currentLoans.map((request) => (
              <LoanRequestCard
                key={request.id}
                request={request}
                completedLoans={
                  borrowerStats[request.borrower.toLowerCase()]
                    ?.completedLoans || 0
                }
              />
            ))
          )}
        </div>
        {totalPages > 1 && isConnected && (
          <div className="mt-8 flex justify-center items-center gap-4">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="bg-transparent text-white hover:text-neutral-700 hover:bg-transparent"
            >
              Previous
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="bg-transparent text-white hover:text-neutral-700 hover:bg-transparent"
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
                      Connect your wallet and create a loan request specifying
                      the amount, interest, and duration. You can add optional
                      collateral to increase trust.
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
                      Reputation Score
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      The platform automatically analyzes your on-chain history
                      to calculate an average Credit Score, giving investors a
                      clear reputation metric.
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
                      Investors can fund the entire loan with one transaction.
                      Borrowers can repay directly to the contract, even after
                      the due date.
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
                      Automated Payouts
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      After repayment, investors withdraw their share. In case
                      of default, collateral is split (90% for investor, 10% for
                      platform).
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
                    Earn competitive returns by cutting out traditional banking
                    intermediaries.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-accent/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="h-6 w-6 text-accent" />
                  </div>
                  <h4 className="font-semibold mb-2">Flexible Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose your risk level. Invest in loans secured by
                    reputation or by optional collateral.
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
