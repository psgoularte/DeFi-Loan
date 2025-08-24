// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.19;

contract LoanMarket {
    address public owner;
    address payable public feeWallet; // Carteira para receber as taxas da plataforma.
    uint private _status = 1; // Variável de estado para o guarda de re-entrância
    
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
    }

    Loan[] public loans;
    mapping(uint => uint) public withdrawableOf;

    // --- Funções do Dono ---
    function setFeeWallet(address payable _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Cannot be zero address");
        feeWallet = _feeWallet;
    }

    function rescueETH(address to, uint amount) external onlyOwner {
        (bool s, ) = to.call{value: amount}("");
        require(s, "Rescue failed");
    }

    // --- Funções Principais ---
    function createLoan(
        uint amountRequested,
        uint interestBps,
        uint durationSecs,
        uint fundingDeadline
    ) external returns (uint loanId) {
        require(amountRequested > 0, "Amount must be greater than 0");
        require(fundingDeadline > block.timestamp, "Deadline must be in the future");
        Loan memory L = Loan({
            borrower: msg.sender,
            amountRequested: amountRequested,
            amountFunded: 0,
            interestBps: interestBps,
            durationSecs: durationSecs,
            fundingDeadline: fundingDeadline,
            status: Status.Open,
            startTimestamp: 0,
            totalRepayment: 0,
            investor: address(0),
            score: 0,
            defaultTimestamp: 0
        });
        loans.push(L);
        loanId = loans.length - 1;
        emit LoanCreated(loanId, msg.sender, amountRequested);
    }

    receive() external payable {
        revert("Use fundLoan(loanId) to send ETH");
    }

    function fundLoan(uint loanId) external payable {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(L.status == Status.Open, "Loan is not open for funding");
        require(block.timestamp <= L.fundingDeadline, "Funding period has closed");
        require(msg.value == L.amountRequested, "Must fund the full amount");
        require(L.investor == address(0), "Loan has already been funded");

        L.amountFunded = msg.value;
        L.investor = msg.sender;
        L.status = Status.Funded;
        L.startTimestamp = block.timestamp;

        emit Funded(loanId, msg.sender, msg.value);
    }

    function withdrawAsBorrower(uint loanId) external nonReentrant {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(L.borrower == msg.sender, "Only the borrower can withdraw");
        require(L.status == Status.Funded, "Loan is not in funded state");
        uint amount = L.amountFunded;
        require(amount > 0, "No amount to withdraw");

        L.status = Status.Active;
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit WithdrawnByBorrower(loanId, amount);
    }

    function checkDefault(uint loanId) public {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        
        if (L.status == Status.Active && 
            block.timestamp > L.startTimestamp + L.durationSecs &&
            L.defaultTimestamp == 0) {
            
            L.status = Status.Defaulted;
            L.defaultTimestamp = block.timestamp;
            emit Defaulted(loanId, block.timestamp);
        }
    }

    function repay(uint loanId) external payable nonReentrant {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(L.borrower == msg.sender, "Only the borrower can repay");
        
        // ✅ MODIFICADO: Permite pagamento nos status Active ou Defaulted.
        require(L.status == Status.Active || L.status == Status.Defaulted, "Loan is not in a repayable state");

        // Se estava em Default, ainda assim é verificado (mas não vai impedir o pagamento)
        if (L.status == Status.Active) {
            checkDefault(loanId);
        }
        
        uint principal = L.amountRequested;
        uint interest = (principal * L.interestBps) / 10000;
        uint owed = principal + interest;
        require(msg.value >= owed, "Not enough ETH sent for repayment");

        L.totalRepayment = owed;
        L.status = Status.Repaid;
        withdrawableOf[loanId] = owed;

        if (msg.value > owed) {
            uint refund = msg.value - owed;
            (bool r, ) = msg.sender.call{value: refund}("");
            require(r, "Refund failed");
        }

        emit RepaymentMade(loanId, owed);
    }

    function cancelLoan(uint loanId) external {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(msg.sender == L.borrower, "Only the borrower can cancel");
        require(L.status == Status.Open, "Only open loans can be cancelled");
        require(block.timestamp <= L.fundingDeadline, "Funding period has already ended");
        require(L.investor == address(0), "Cannot cancel a funded loan");

        L.status = Status.Cancelled;
        emit LoanCancelled(loanId, msg.sender);
    }

    function withdrawInvestorShare(uint loanId) external nonReentrant {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "Only the investor can withdraw");
        require(feeWallet != address(0), "Fee wallet not set");

        uint available = withdrawableOf[loanId];
        require(available > 0, "Nothing to withdraw");

        uint principal = L.amountRequested;
        
        withdrawableOf[loanId] = 0; // Prevenção de re-entrância (checks-effects-interactions)

        if (available > principal) {
            uint profit = available - principal;
            uint platformFee = (profit * 10) / 100; // 10% de taxa sobre o lucro
            uint investorShare = available - platformFee;

            (bool feeSent, ) = feeWallet.call{value: platformFee}("");
            require(feeSent, "Fee transfer failed");

            (bool investorShareSent, ) = msg.sender.call{value: investorShare}("");
            require(investorShareSent, "Investor share transfer failed");
            
            emit InvestorWithdraw(loanId, msg.sender, investorShare);
        } else {
            (bool investorShareSent, ) = msg.sender.call{value: available}("");
            require(investorShareSent, "Investor share transfer failed");
            emit InvestorWithdraw(loanId, msg.sender, available);
        }
    }

    function leaveScore(uint loanId, uint8 score) external {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "Only the investor can leave a score");
        require(L.status == Status.Repaid || L.status == Status.Defaulted, "Loan is not finished");
        require(score >= 1 && score <= 5, "Score must be between 1 and 5");
        require(L.score == 0, "Score has already been left");

        L.score = score;
        emit ScoreLeft(loanId, msg.sender, score);
    }

    function markAsDefault(uint loanId) external {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "Only the investor can mark as default");
        require(L.status == Status.Active, "Loan is not active");
        require(block.timestamp > L.startTimestamp + L.durationSecs, "Loan is not yet due");
        require(L.defaultTimestamp == 0, "Loan is already defaulted");

        L.status = Status.Defaulted;
        L.defaultTimestamp = block.timestamp;
        emit Defaulted(loanId, block.timestamp);
    }

    // --- Funções de Leitura (View) ---
    function isLoanDefaulted(uint loanId) external view returns (bool) {
        require(loanId < loans.length, "Invalid loan ID");
        Loan storage L = loans[loanId];
        return (L.status == Status.Defaulted) || (L.status == Status.Active && block.timestamp > L.startTimestamp + L.durationSecs);
    }

    function averageScoreOfBorrower(address borrower) external view returns (uint avgTimes100) {
        uint sum = 0;
        uint count = 0;
        for (uint i = 0; i < loans.length; i++) {
            if (loans[i].borrower == borrower && loans[i].score > 0) {
                sum += loans[i].score;
                count++;
            }
        }
        if (count == 0) return 0;
        return (sum * 100) / count;
    }

    function getLoanCount() external view returns (uint) {
        return loans.length;
    }
}