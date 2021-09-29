// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.3.2/contracts/utils/math/SafeMath.sol";

contract Domimi {
    using SafeMath for uint256;

    // 管理詳細情報
    struct Management {
        // 管理者
        address payable master;
        // 管理開始時刻（UNIX時間）
        uint start;
        // 管理期間（秒）
        uint period;
        // 管理開始費（wei）
        uint initialCost;
        // 管理中止費（wei）
        uint abortCost;
        // 管理者自身で実行する操作1回あたりの手数料（wei）
        uint execCost;
        // 1回あたりの最大延長期間（秒）
        uint maxExtent;
    }

    // コントラクトの所有者（=被管理者）
    address payable owner;
    // 管理詳細情報
    Management m;
    // 管理者が受け取る金額のリスト
    mapping(address => uint) payouts;
    // 全ての管理者が受け取る金額の合計
    uint payoutTotal;
    // 開始署名のリプレイ攻撃を防ぐ nonce の使用済みリスト
    mapping(uint => bool) usedNonces;

    constructor() payable {
        owner = payable(msg.sender);
        m.master = payable(msg.sender);
    }

    // 参照関連
    function isUnderManagement() public view returns(bool) {
        return m.master != owner;
    }
    function isOnPeriod() internal view returns(bool) {
        return m.start <= block.timestamp && block.timestamp <= m.start.add(m.period);
    }
    function isSentByOwner() internal view returns(bool) {
        return msg.sender == owner;
    }
    function isSentByMaster() internal view returns(bool) {
        return msg.sender == m.master;
    }

    // 前提条件のチェック modifier 関連
    /////管理者の有無をチェック
    modifier onlyWithMaster {
        require(isUnderManagement(), "must call under management");
        _;
    }
    modifier onlyWithoutMaster {
        require(!isUnderManagement(), "must call under non-management");
        _;
    }
    ///// 管理期間をチェック
    modifier onlyOnPeriod {
        require(isOnPeriod(), "must call on management period");
        _;
    }
    modifier onlyNotOnPeriod {
        require(!isOnPeriod(), "must call not on management period");
        _;
    }
    ///// 実行者をチェック
    modifier onlyOwner {
        require(isSentByOwner(), "must call by owner");
        _;
    }
    modifier onlyOwnerOrMaster {
        require(isSentByOwner() || isSentByMaster(), "must call by owner or master");
        _;
    }

    // 操作
    ///// 管理開始
    ///// minBalance: 管理開始時点でコントラクトに預けられているべき残高
    /////             = _initialCost + _execCost * 管理開始時点での最小延長可能回数
    function start(
        address payable _master, uint _period, uint _initialCost,
        uint _abortCost, uint _execCost, uint _maxExtent,
        uint minBalance, uint nonce, bytes memory signature
    ) public payable onlyWithoutMaster onlyOwner {
        // 残高 >= 最小残高 >= 初期費用
        require(
            minBalance >= _initialCost,
            "must be minBalance >= _initialCost"
        );
        require(
            address(this).balance >= minBalance,
            "must deposit at least minBalance"
        );

        require(_master != owner, "new _master must not be owner");

        require(!usedNonces[nonce], "this nonce is already used");
        usedNonces[nonce] = true;

        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(
                    _period, _initialCost, _abortCost, _execCost, _maxExtent,
                    minBalance, nonce, this
                )
            )
        );
        require(
            recoverSigner(message, signature) == _master,
            "signer is not new _master"
        );

        m.master = _master;
        m.start = block.timestamp;
        m.initialCost = _initialCost;
        m.period = _period;
        m.abortCost = _abortCost;
        m.execCost = _execCost;
        m.maxExtent = _maxExtent;

        acquire(m.initialCost);
    }
    ///// 管理期間の追加
    function extendPeriod(uint _extent) public onlyWithMaster onlyOwnerOrMaster {
        // 被管理者は上限なく期間を追加できる
        // 管理者は maxExtent を上限として追加できる
        require(
            isSentByOwner() || _extent <= m.maxExtent,
            "must be _extent <= maxExtent"
        );

        if (isSentByMaster()) {
            acquire(m.execCost);
        }
        m.period = m.period.add(_extent);
    }
    ///// 管理期間満了後の（または管理者による）リセット
    function exit() public onlyWithMaster onlyOwnerOrMaster {
        // 管理者はいつでも管理を終了できる
        // 被管理者は管理期間満了後に管理を終了できる
        require(
            isSentByMaster() || !isOnPeriod(),
            "you cannot exit on management period"
        );

        if (isSentByMaster()) {
            acquire(m.execCost);
        }
        reset();
    }
    ///// 管理期間中途でのリセット
    function abort() public payable onlyWithMaster onlyOnPeriod onlyOwner {
        acquire(m.abortCost);
        reset();
    }
    ///// 管理手数料の払い出し
    function withdraw(address payable receiver) public {
        // 被管理者は任意の管理者の管理手数料を送金できる
        // 管理者は自らに支払われた管理手数料を送金できる
        require(
            isSentByOwner() || receiver == msg.sender,
            "you can withdraw only your own balance"
        );

        require(payouts[receiver] > 0, "receiver not found");

        uint amount = payouts[receiver];
        delete payouts[receiver];
        payoutTotal = payoutTotal.sub(amount);
        receiver.transfer(amount);
    }
    ///// ロックされていない保証金の払い戻し
    function refund() public onlyWithoutMaster onlyOwner {
        uint amount = address(this).balance.sub(payoutTotal);
        owner.transfer(amount);
    }

    // その他内部処理など
    ///// 払い出す管理手数料のロック
    function acquire(uint amount) internal onlyWithMaster onlyOwnerOrMaster {
        require(
            payoutTotal.add(amount) <= address(this).balance,
            "must be payoutTotal + amount <= balance"
        );
        payouts[m.master] = payouts[m.master].add(amount);
        payoutTotal = payoutTotal.add(amount);
    }
    ///// 管理情報のリセット
    function reset() internal onlyWithMaster onlyOwnerOrMaster {
        m = Management(owner, 0, 0, 0, 0, 0, 0);
    }
    ///// selfdestruct
    ///// 非管理下で管理手数料が全て払い出されている場合に owner のみが呼び出せる
    function kill() public onlyWithoutMaster onlyOwner {
        require(
            payoutTotal == 0,
            "must be called after all the management costs are payed out"
        );
        selfdestruct(owner);
    }
    ///// 保証金の払い込みの受付
    receive() external payable {}

    // 署名関連
    function splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65);
        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }
    function recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
    }
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
