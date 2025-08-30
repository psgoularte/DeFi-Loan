// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LoanMarket {
    address public owner;
    address payable public feeWallet = payable(0x4E8B7696fa787b32f1d8A0B1025Fd1A5d8f994cd); // Endereço que recebe as taxas

    uint private _status = 1; // Guarda de re-entrância

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier nonReentrant() {
        require(_status == 1, "ReentrancyGuard: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }

    // --- Eventos ---
    event LoanCreated(uint indexed loanId, address indexed borrower, uint amountRequested);
    event Funded(uint indexed loanId, address indexed investor, uint amount);
    event WithdrawnByBorrower(uint indexed loanId, uint amount);
    event RepaymentMade(uint indexed loanId, uint amount);
    event InvestorWithdraw(uint indexed loanId, address indexed investor, uint amount);
    event ScoreLeft(uint indexed loanId, address indexed investor, uint8 score);
    event Defaulted(uint indexed loanId, uint defaultTimestamp);
    event LoanCancelled(uint indexed loanId, address indexed borrower);
    event CollateralWithdrawn(uint indexed loanId, address indexed borrower, uint amount);
    event CollateralClaimed(uint indexed loanId, address indexed investor, uint gross, uint fee, uint net);

    enum Status { Open, Funded, Active, Repaid, Defaulted, Cancelled }

    struct Loan {
        address borrower;
        uint amountRequested;
        uint amountFunded;
        uint interestBps;
        uint durationSecs;
        uint fundingDeadline;
        Status status;
        uint startTimestamp;
        uint totalRepayment;
        address investor;
        uint8 score;
        uint defaultTimestamp;
        uint collateralAmount;
        bool collateralClaimed;
    }

    Loan[] public loans;
    mapping(address => uint) public borrowerLoanCount; // Conta empréstimos finalizados (pagos ou default)
    mapping(address => uint) public borrowerScoreSum;

    function createLoan(
        uint _amountRequested,
        uint _interestBps,
        uint _durationSecs,
        uint _fundingDeadline,
        uint _collateralAmount
    ) external payable nonReentrant {
        require(_amountRequested > 0, "Amount must be > 0");
        require(msg.value == _collateralAmount, "Incorrect collateral sent");

        loans.push(
            Loan({
                borrower: msg.sender,
                amountRequested: _amountRequested,
                amountFunded: 0,
                interestBps: _interestBps,
                durationSecs: _durationSecs,
                fundingDeadline: _fundingDeadline,
                status: Status.Open,
                startTimestamp: 0,
                totalRepayment: 0,
                investor: address(0),
                score: 0,
                defaultTimestamp: 0,
                collateralAmount: _collateralAmount,
                collateralClaimed: false
            })
        );
        emit LoanCreated(loans.length - 1, msg.sender, _amountRequested);
    }

    function fundLoan(uint loanId) external payable nonReentrant {
        Loan storage L = loans[loanId];
        require(L.status == Status.Open, "Loan not open for funding");
        require(block.timestamp < L.fundingDeadline, "Funding deadline has passed");
        require(msg.value == L.amountRequested, "Incorrect funding amount sent");

        L.status = Status.Funded;
        L.investor = msg.sender;
        L.amountFunded = msg.value;
        L.startTimestamp = block.timestamp;

        emit Funded(loanId, msg.sender, msg.value);
    }

    function withdrawAsBorrower(uint loanId) external nonReentrant {
        Loan storage L = loans[loanId];
        require(L.status == Status.Funded, "Loan is not in Funded state");
        require(msg.sender == L.borrower, "Only the borrower can withdraw");

        L.status = Status.Active;
        (bool sent, ) = L.borrower.call{value: L.amountFunded}("");
        require(sent, "Failed to send funds to borrower");

        emit WithdrawnByBorrower(loanId, L.amountFunded);
    }

    function repay(uint loanId) external payable nonReentrant {
        Loan storage L = loans[loanId];
        require(L.status == Status.Active, "Loan is not active for repayment");

        uint principal = L.amountRequested;
        uint interest = (principal * L.interestBps) / 10000;
        uint owed = principal + interest;
        require(msg.value >= owed, "Insufficient amount sent for repayment");

        // --- Checks & Effects ---
        L.totalRepayment = owed;
        L.status = Status.Repaid;
        borrowerLoanCount[L.borrower]++;
        emit RepaymentMade(loanId, owed);

        // --- Interaction ---
        // Devolve automaticamente o colateral ao devedor
        if (L.collateralAmount > 0) {
            (bool sent, ) = L.borrower.call{value: L.collateralAmount}("");
            require(sent, "Collateral transfer failed");
            emit CollateralWithdrawn(loanId, L.borrower, L.collateralAmount);
        }
    }

    function withdrawInvestorShare(uint loanId, uint8 score) external nonReentrant {
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "Only the investor can withdraw");
        require(L.status == Status.Repaid, "Loan has not been repaid");
        require(L.score == 0, "Score has already been submitted");
        require(score >= 1 && score <= 5, "Score must be between 1 and 5");

        uint principal = L.amountRequested;
        uint interest = (principal * L.interestBps) / 10000;
        uint total = principal + interest;
        uint fee = (interest * 10) / 100; // 10% da taxa sobre o lucro
        uint net = total - fee;

        // --- Checks & Effects ---
        // Força a submissão da avaliação
        L.score = score;
        borrowerScoreSum[L.borrower] += score;
        emit ScoreLeft(loanId, msg.sender, score);

        // --- Interactions ---
        (bool feeSent, ) = feeWallet.call{value: fee}("");
        require(feeSent, "Fee transfer failed");

        (bool investorSent, ) = L.investor.call{value: net}("");
        require(investorSent, "Investor share transfer failed");

        emit InvestorWithdraw(loanId, L.investor, net);
    }

    function claimCollateral(uint loanId, uint8 score) external nonReentrant {
        checkDefault(loanId); // Garante que o status é atualizado para Defaulted se o prazo passou
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "Only the investor can claim");
        require(L.status == Status.Defaulted, "Loan has not defaulted");
        require(!L.collateralClaimed, "Collateral has already been claimed");
        require(L.collateralAmount > 0, "This loan has no collateral");
        require(L.score == 0, "Score has already been submitted");
        require(score >= 1 && score <= 5, "Score must be between 1 and 5");

        // --- Checks & Effects ---
        L.collateralClaimed = true;
        borrowerLoanCount[L.borrower]++;

        // Força a submissão da avaliação
        L.score = score;
        borrowerScoreSum[L.borrower] += score;
        emit ScoreLeft(loanId, msg.sender, score);

        uint gross = L.collateralAmount;
        uint fee = (gross * 10) / 100; // 10% da taxa sobre o colateral
        uint net = gross - fee;

        // --- Interactions ---
        (bool feeSent, ) = feeWallet.call{value: fee}("");
        require(feeSent, "Fee transfer failed");

        (bool investorSent, ) = L.investor.call{value: net}("");
        require(investorSent, "Collateral transfer to investor failed");

        emit CollateralClaimed(loanId, L.investor, gross, fee, net);
    }

    function cancelLoan(uint loanId) external nonReentrant {
        Loan storage L = loans[loanId];
        require(msg.sender == L.borrower, "Only the borrower can cancel");
        require(L.status == Status.Open, "Loan is not open for cancellation");

        L.status = Status.Cancelled;

        if (L.collateralAmount > 0) {
            (bool sent, ) = L.borrower.call{value: L.collateralAmount}("");
            require(sent, "Collateral refund failed");
        }
        emit LoanCancelled(loanId, L.borrower);
    }
    
    function checkDefault(uint loanId) public {
        Loan storage L = loans[loanId];
        if (L.status == Status.Active && block.timestamp > L.startTimestamp + L.durationSecs) {
            L.status = Status.Defaulted;
            L.defaultTimestamp = block.timestamp;
            emit Defaulted(loanId, L.defaultTimestamp);
        }
    }

    function getLoanCount() external view returns (uint) {
        return loans.length;
    }

    function averageScoreOfBorrower(address borrower) external view returns (uint) {
        if (borrowerLoanCount[borrower] == 0) return 0;
        return (borrowerScoreSum[borrower] * 100) / borrowerLoanCount[borrower];
    }
}