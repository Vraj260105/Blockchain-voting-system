// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract VotingSystem {
    // ── Structs ──────────────────────────────────────────────
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedCandidateId;
    }

    struct Candidate {
        string name;
        string description;
        uint256 voteCount;
    }

    struct Election {
        string name;
        string description;
        string organizationName;
        uint256 scheduledStart;  // 0 = manual control only
        uint256 scheduledEnd;    // 0 = no auto-close
        uint256 startTime;       // actual start (set when opened)
        uint256 endTime;         // actual end (set when closed)
        bool isActive;
        bool exists;
        uint256 totalVotes;
        uint256 candidateCount;
    }

    // ── State ────────────────────────────────────────────────
    address public owner;
    uint256 public electionCount;
    uint256 public voterFundAmount = 0.5 ether; // 0.5 POL

    // electionId => Election metadata
    mapping(uint256 => Election) public elections;
    // electionId => candidateIndex => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    // electionId => voterAddress => Voter
    mapping(uint256 => mapping(address => Voter)) public voters;

    // ── Events ───────────────────────────────────────────────
    event ElectionCreated(uint256 indexed electionId, string name, string organizationName, uint256 scheduledStart, uint256 scheduledEnd);
    event ElectionUpdated(uint256 indexed electionId);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event VoterRegistered(uint256 indexed electionId, address indexed voter);
    event VoterFunded(address indexed voter, uint256 amount);
    event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId);
    event VotingOpened(uint256 indexed electionId);
    event VotingClosed(uint256 indexed electionId);
    event ContractFunded(address indexed funder, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier whenVotingOpen(uint256 _electionId) {
        Election storage e = elections[_electionId];
        require(e.isActive, "Voting is not open");
        // If a scheduled end time is set and it has passed, block voting
        require(
            e.scheduledEnd == 0 || block.timestamp <= e.scheduledEnd,
            "Voting period has ended"
        );
        _;
    }

    // ── Constructor ──────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Receive POL to fund voter registrations ──────────────
    receive() external payable {
        emit ContractFunded(msg.sender, msg.value);
    }

    function fundContract() external payable {
        require(msg.value > 0, "Must send POL");
        emit ContractFunded(msg.sender, msg.value);
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool sent, ) = payable(owner).call{value: balance}("");
        require(sent, "Withdrawal failed");
        emit FundsWithdrawn(owner, balance);
    }

    function setVoterFundAmount(uint256 _amount) external onlyOwner {
        voterFundAmount = _amount;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ── Election Management (Owner Only) ─────────────────────
    /**
     * @param _scheduledStart Unix timestamp for auto-open (0 = manual only)
     * @param _scheduledEnd   Unix timestamp for auto-close (0 = no auto-close)
     */
    function createElection(
        string memory _name,
        string memory _description,
        string memory _organizationName,
        uint256 _scheduledStart,
        uint256 _scheduledEnd
    ) external onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "Election name required");
        require(
            _scheduledEnd == 0 || _scheduledEnd > block.timestamp,
            "End time must be in the future"
        );
        require(
            _scheduledStart == 0 || _scheduledEnd == 0 || _scheduledEnd > _scheduledStart,
            "End time must be after start time"
        );

        uint256 electionId = electionCount;
        Election storage e = elections[electionId];
        e.name = _name;
        e.description = _description;
        e.organizationName = _organizationName;
        e.scheduledStart = _scheduledStart;
        e.scheduledEnd = _scheduledEnd;
        e.exists = true;
        e.isActive = false;

        electionCount++;
        emit ElectionCreated(electionId, _name, _organizationName, _scheduledStart, _scheduledEnd);
        return electionId;
    }

    function updateElection(
        uint256 _electionId,
        string memory _name,
        string memory _description,
        string memory _organizationName,
        uint256 _scheduledStart,
        uint256 _scheduledEnd
    ) external onlyOwner electionExists(_electionId) {
        require(!elections[_electionId].isActive, "Cannot update active election");
        require(bytes(_name).length > 0, "Election name required");

        Election storage e = elections[_electionId];
        e.name = _name;
        e.description = _description;
        e.organizationName = _organizationName;
        e.scheduledStart = _scheduledStart;
        e.scheduledEnd = _scheduledEnd;

        emit ElectionUpdated(_electionId);
    }

    /**
     * @notice Anyone can call this to trigger auto-open or auto-close
     *         based on the scheduled times. Returns true if any state changed.
     */
    function triggerElectionStatus(uint256 _electionId)
        external
        electionExists(_electionId)
        returns (bool changed)
    {
        Election storage e = elections[_electionId];
        changed = false;

        // Auto-open: not yet active, scheduled start reached, has candidates
        if (
            !e.isActive &&
            e.scheduledStart > 0 &&
            block.timestamp >= e.scheduledStart &&
            e.candidateCount > 0 &&
            (e.scheduledEnd == 0 || block.timestamp < e.scheduledEnd)
        ) {
            e.isActive = true;
            e.startTime = block.timestamp;
            emit VotingOpened(_electionId);
            changed = true;
        }

        // Auto-close: active, scheduled end passed
        if (e.isActive && e.scheduledEnd > 0 && block.timestamp >= e.scheduledEnd) {
            e.isActive = false;
            e.endTime = block.timestamp;
            emit VotingClosed(_electionId);
            changed = true;
        }

        return changed;
    }

    // ── Candidate Management ─────────────────────────────────
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _description
    ) external onlyOwner electionExists(_electionId) {
        require(!elections[_electionId].isActive, "Cannot add candidate while voting is open");
        require(bytes(_name).length > 0, "Candidate name required");

        uint256 candidateId = elections[_electionId].candidateCount;
        candidates[_electionId][candidateId] = Candidate({
            name: _name,
            description: _description,
            voteCount: 0
        });
        elections[_electionId].candidateCount++;

        emit CandidateAdded(_electionId, candidateId, _name);
    }

    // ── Voting Lifecycle (Manual Controls) ───────────────────
    function openVoting(uint256 _electionId) external onlyOwner electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(!e.isActive, "Already open");
        require(e.candidateCount > 0, "No candidates");
        e.isActive = true;
        e.startTime = block.timestamp;
        emit VotingOpened(_electionId);
    }

    function closeVoting(uint256 _electionId) external onlyOwner electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.isActive, "Not open");
        e.isActive = false;
        e.endTime = block.timestamp;
        emit VotingClosed(_electionId);
    }

    // ── Voter Self-Registration + Auto-Fund ──────────────────
    function registerSelf(uint256 _electionId) external electionExists(_electionId) {
        require(!voters[_electionId][msg.sender].isRegistered, "Already registered");

        voters[_electionId][msg.sender].isRegistered = true;
        emit VoterRegistered(_electionId, msg.sender);

        // Auto-fund: send POL to the new voter so they can pay gas
        if (voterFundAmount > 0 && address(this).balance >= voterFundAmount) {
            (bool sent, ) = payable(msg.sender).call{value: voterFundAmount}("");
            if (sent) {
                emit VoterFunded(msg.sender, voterFundAmount);
            }
        }
    }

    // ── Casting Votes ────────────────────────────────────────
    function castVote(
        uint256 _electionId,
        uint256 _candidateId
    ) external electionExists(_electionId) whenVotingOpen(_electionId) {
        require(voters[_electionId][msg.sender].isRegistered, "Not registered");
        require(!voters[_electionId][msg.sender].hasVoted, "Already voted");
        require(_candidateId < elections[_electionId].candidateCount, "Invalid candidate");

        Voter storage v = voters[_electionId][msg.sender];
        v.hasVoted = true;
        v.votedCandidateId = _candidateId;

        candidates[_electionId][_candidateId].voteCount += 1;
        elections[_electionId].totalVotes += 1;

        emit VoteCast(_electionId, msg.sender, _candidateId);
    }

    // ── Read Helpers ─────────────────────────────────────────
    function getElection(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (
            string memory name,
            string memory description,
            string memory organizationName,
            uint256 scheduledStart,
            uint256 scheduledEnd,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            uint256 totalVotes,
            uint256 candidateCount
        )
    {
        Election storage e = elections[_electionId];
        return (
            e.name, e.description, e.organizationName,
            e.scheduledStart, e.scheduledEnd,
            e.startTime, e.endTime,
            e.isActive, e.totalVotes, e.candidateCount
        );
    }

    function getElectionCandidates(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (string[] memory names, string[] memory descriptions, uint256[] memory voteCounts)
    {
        uint256 len = elections[_electionId].candidateCount;
        names = new string[](len);
        descriptions = new string[](len);
        voteCounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            Candidate storage c = candidates[_electionId][i];
            names[i] = c.name;
            descriptions[i] = c.description;
            voteCounts[i] = c.voteCount;
        }
    }

    function getVoterInfo(uint256 _electionId, address _voter)
        external
        view
        electionExists(_electionId)
        returns (bool isRegistered, bool hasVoted, uint256 votedCandidateId)
    {
        Voter storage v = voters[_electionId][_voter];
        return (v.isRegistered, v.hasVoted, v.votedCandidateId);
    }

    function getElectionWinner(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (string memory name, uint256 voteCount, bool isTie)
    {
        Election storage e = elections[_electionId];
        require(!e.isActive, "Voting is still open");
        require(e.candidateCount > 0, "No candidates");

        uint256 winningCount = 0;
        uint256 winningIndex = 0;
        bool tie = false;

        for (uint256 i = 0; i < e.candidateCount; i++) {
            uint256 v = candidates[_electionId][i].voteCount;
            if (v > winningCount) {
                winningCount = v;
                winningIndex = i;
                tie = false;
            } else if (v == winningCount && i > 0) {
                tie = true;
            }
        }

        return (candidates[_electionId][winningIndex].name, winningCount, tie);
    }

    // ── Convenience: check if auto-trigger would change anything ──
    function getElectionScheduleStatus(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (
            bool shouldOpen,   // true if triggerElectionStatus would open it
            bool shouldClose,  // true if triggerElectionStatus would close it
            uint256 currentTime
        )
    {
        Election storage e = elections[_electionId];
        currentTime = block.timestamp;

        shouldOpen = (
            !e.isActive &&
            e.scheduledStart > 0 &&
            block.timestamp >= e.scheduledStart &&
            e.candidateCount > 0 &&
            (e.scheduledEnd == 0 || block.timestamp < e.scheduledEnd)
        );

        shouldClose = (
            e.isActive &&
            e.scheduledEnd > 0 &&
            block.timestamp >= e.scheduledEnd
        );
    }
}