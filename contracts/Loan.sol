// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.19;

contract LoanMarketSimplified {
    address public owner;
    uint private _status = 1; // ⚡ VARIÁVEL DE ESTADO PARA REENTRÂNCIA
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    // --- MODIFICADOR NONREENTRANT (IMPLEMENTAÇÃO CORRETA) ---
    modifier nonReentrant() {
        require(_status == 1, "ReentrancyGuard: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }

    // --- eventos ---
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

    // --- criação de pedido ---
    function createLoan(
        uint amountRequested,
        uint interestBps,
        uint durationSecs,
        uint fundingDeadline
    ) external returns (uint loanId) {
        require(amountRequested > 0, "amount>0");
        require(fundingDeadline > block.timestamp, "deadline future");
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
        revert("use fundLoan(loanId)");
    }

    // --- aporte ---
    function fundLoan(uint loanId) external payable {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        require(L.status == Status.Open, "not open");
        require(block.timestamp <= L.fundingDeadline, "funding closed");
        require(msg.value == L.amountRequested, "must fund full amount");
        require(L.investor == address(0), "already funded");

        L.amountFunded = msg.value;
        L.investor = msg.sender;
        L.status = Status.Funded;
        L.startTimestamp = block.timestamp;

        emit Funded(loanId, msg.sender, msg.value);
    }

    // --- saque pelo mutuário (PROTEGIDO COM NONREENTRANT) ---
    function withdrawAsBorrower(uint loanId) external nonReentrant {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        require(L.borrower == msg.sender, "only borrower");
        require(L.status == Status.Funded, "not funded");
        uint amount = L.amountFunded;
        require(amount > 0, "nothing");

        L.status = Status.Active;
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "transfer failed");

        emit WithdrawnByBorrower(loanId, amount);
    }

    // --- verificação automática de inadimplência ---
    function checkDefault(uint loanId) public {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        
        if (L.status == Status.Active && 
            block.timestamp > L.startTimestamp + L.durationSecs &&
            L.defaultTimestamp == 0) {
            
            L.status = Status.Defaulted;
            L.defaultTimestamp = block.timestamp;
            emit Defaulted(loanId, block.timestamp);
        }
    }

    // --- pagamento pelo mutuário (PROTEGIDO COM NONREENTRANT) ---
    function repay(uint loanId) external payable nonReentrant {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        require(L.borrower == msg.sender, "only borrower");
        require(L.status == Status.Active, "not active");

        checkDefault(loanId);
        require(L.status == Status.Active, "loan is defaulted");

        uint principal = L.amountRequested;
        uint interest = (principal * L.interestBps) / 10000;
        uint owed = principal + interest;
        require(msg.value >= owed, "not enough");

        L.totalRepayment = owed;
        L.status = Status.Repaid;
        withdrawableOf[loanId] = owed;

        if (msg.value > owed) {
            uint refund = msg.value - owed;
            (bool r, ) = msg.sender.call{value: refund}("");
            require(r, "refund failed");
        }

        emit RepaymentMade(loanId, owed);
    }

    // --- cancelamento pelo mutuário ---
    function cancelLoan(uint loanId) external {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        require(msg.sender == L.borrower, "only borrower");
        require(L.status == Status.Open, "only open loans can be cancelled");
        require(block.timestamp <= L.fundingDeadline, "funding period ended");
        require(L.investor == address(0), "already funded");

        L.status = Status.Cancelled;
        emit LoanCancelled(loanId, msg.sender);
    }

    // --- investidor retira sua parte (PROTEGIDO COM NONREENTRANT) ---
    function withdrawInvestorShare(uint loanId) external nonReentrant {
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "only investor");
        uint available = withdrawableOf[loanId];
        require(available > 0, "nothing");

        withdrawableOf[loanId] = 0;
        (bool s, ) = msg.sender.call{value: available}("");
        require(s, "transfer failed");

        emit InvestorWithdraw(loanId, msg.sender, available);
    }

    // --- investidor deixa score ---
    function leaveScore(uint loanId, uint8 score) external {
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "only investor");
        require(L.status == Status.Repaid || L.status == Status.Defaulted, "loan not finished");
        require(score >= 1 && score <= 5, "score 1-5");
        require(L.score == 0, "already left score");

        L.score = score;
        emit ScoreLeft(loanId, msg.sender, score);
    }

    // --- investidor pode marcar manualmente como inadimplente ---
    function markAsDefault(uint loanId) external {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        require(msg.sender == L.investor, "only investor");
        require(L.status == Status.Active, "not active");
        require(block.timestamp > L.startTimestamp + L.durationSecs, "not yet due");
        require(L.defaultTimestamp == 0, "already defaulted");

        L.status = Status.Defaulted;
        L.defaultTimestamp = block.timestamp;
        emit Defaulted(loanId, block.timestamp);
    }

    // --- consultar se empréstimo está inadimplente ---
    function isLoanDefaulted(uint loanId) external view returns (bool) {
        require(loanId < loans.length, "invalid loan");
        Loan storage L = loans[loanId];
        
        return (L.status == Status.Defaulted) || 
               (L.status == Status.Active && 
                block.timestamp > L.startTimestamp + L.durationSecs);
    }

    // --- calcular média de scores ---
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

    function rescueETH(address to, uint amount) external onlyOwner {
        (bool s, ) = to.call{value: amount}("");
        require(s, "rescue failed");
    }
}