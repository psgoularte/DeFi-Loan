"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, DollarSign, Users } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

// Mock data for loan requests
const loanRequests = [
  {
    id: 1,
    creatorAddress: "0x742d35Cc6634C0532925a3b8D4C0532925a3b8D4",
    score: 4.8,
    interestRate: 8.5,
    loanAmount: 50000,
    purpose: "Business Expansion",
    duration: "24 months",
  },
  {
    id: 2,
    creatorAddress: "0x8f3CF7ad23Cd3CaDbD9735AFf958023239c6A063",
    score: 4.2,
    interestRate: 12.3,
    loanAmount: 25000,
    purpose: "Real Estate Investment",
    duration: "36 months",
  },
  {
    id: 3,
    creatorAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    score: 3.9,
    interestRate: 15.7,
    loanAmount: 75000,
    purpose: "Technology Startup",
    duration: "18 months",
  },
  {
    id: 4,
    creatorAddress: "0xA0b86a33E6441e8e5c3ecE7C1f1c4e2c5b8d9e0f",
    score: 4.5,
    interestRate: 9.8,
    loanAmount: 100000,
    purpose: "Manufacturing Equipment",
    duration: "48 months",
  },
  {
    id: 5,
    creatorAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    score: 3.6,
    interestRate: 18.2,
    loanAmount: 15000,
    purpose: "Working Capital",
    duration: "12 months",
  },
  {
    id: 6,
    creatorAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    score: 4.7,
    interestRate: 7.9,
    loanAmount: 200000,
    purpose: "Commercial Property",
    duration: "60 months",
  },
];

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= Math.floor(score)
              ? "fill-accent text-accent"
              : star <= score
              ? "fill-accent/50 text-accent"
              : "text-muted-foreground"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{score}</span>
    </div>
  );
}

function LoanRequestCard({ request }: { request: (typeof loanRequests)[0] }) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {request.purpose}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-mono">
              {request.creatorAddress.slice(0, 6)}...
              {request.creatorAddress.slice(-4)}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-accent/10 text-accent-foreground"
          >
            {request.duration}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Credit Score</span>
            </div>
            <ScoreStars score={request.score} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Interest Rate</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {request.interestRate}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium">Loan Amount</span>
          </div>
          <p className="text-2xl font-bold">
            ${request.loanAmount.toLocaleString()}
          </p>
        </div>

        <div className="pt-2">
          <Button className="w-full" size="lg">
            Invest Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestmentRequestsPage() {
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
              <Button variant="outline" size="lg">
                Request Loan
              </Button>
              <ConnectButton />
            </nav>
          </div>
        </div>
      </header>

      {/* Centralized brand header with brief text */}
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
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Active Requests
                    </p>
                    <p className="text-2xl font-bold">247</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg. Interest Rate
                    </p>
                    <p className="text-2xl font-bold">12.1%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Volume
                    </p>
                    <p className="text-2xl font-bold">$2.4M</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Loan Requests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loanRequests.map((request) => (
            <LoanRequestCard key={request.id} request={request} />
          ))}
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
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Request a Loan
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Project explanation section as a map */}
      <section className="bg-card border-t">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How Our Platform Works
            </h2>

            {/* Process Map */}
            <div className="relative">
              {/* Connection lines */}
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary transform -translate-y-1/2"></div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
                {/* Step 1 */}
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
                      address, desired amount, and purpose. Our AI analyzes
                      on-chain activity to generate credit scores.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
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
                      transaction history. Credit scores (1-5) are calculated
                      based on blockchain activity and reputation.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
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
                      and interest rates, then fund loans directly through
                      secure smart contracts.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
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
                      interest distribution. Investors receive returns directly
                      to their wallets without intermediaries.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Benefits */}
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
