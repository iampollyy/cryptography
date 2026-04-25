const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  let wallet;
  let owner1, owner2, owner3, nonOwner, receiver;
  const ZERO_ADDRESS = ethers.ZeroAddress;

  beforeEach(async function () {
    [owner1, owner2, owner3, nonOwner, receiver] = await ethers.getSigners();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    wallet = await MultiSigWallet.deploy(
      [owner1.address, owner2.address, owner3.address],
      2 
    );

    await owner1.sendTransaction({
      to: wallet.target,
      value: ethers.parseEther("10"),
    });
  });


  describe("Deployment", function () {
    it("should set the correct owners", async function () {
      const owners = await wallet.getOwners();
      expect(owners).to.deep.equal([
        owner1.address,
        owner2.address,
        owner3.address,
      ]);
    });

    it("should set the correct number of confirmations required", async function () {
      expect(await wallet.numConfirmationsRequired()).to.equal(2);
    });

    it("should mark each address as an owner", async function () {
      expect(await wallet.isOwner(owner1.address)).to.be.true;
      expect(await wallet.isOwner(owner2.address)).to.be.true;
      expect(await wallet.isOwner(owner3.address)).to.be.true;
      expect(await wallet.isOwner(nonOwner.address)).to.be.false;
    });

    it("should revert if no owners provided", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(MultiSigWallet.deploy([], 1)).to.be.revertedWith(
        "owners required"
      );
    });

    it("should revert if confirmations required is 0", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address], 0)
      ).to.be.revertedWith("invalid number of required confirmations");
    });

    it("should revert if confirmations required > owners count", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address], 2)
      ).to.be.revertedWith("invalid number of required confirmations");
    });

    it("should revert if a duplicate owner is provided", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address, owner1.address], 1)
      ).to.be.revertedWith("owner not unique");
    });

    it("should revert if zero address is provided as owner", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([ZERO_ADDRESS], 1)
      ).to.be.revertedWith("invalid owner");
    });
  });


  describe("Receive Ether", function () {
    it("should accept Ether and emit Deposit event", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        owner1.sendTransaction({ to: wallet.target, value: amount })
      )
        .to.emit(wallet, "Deposit")
        .withArgs(
          owner1.address,
          amount,
          ethers.parseEther("10") + amount 
        );
    });
  });


  describe("submitTransaction", function () {
    it("should allow an owner to submit a transaction", async function () {
      const value = ethers.parseEther("1");
      await expect(
        wallet.submitTransaction(receiver.address, value, "0x")
      )
        .to.emit(wallet, "SubmitTransaction")
        .withArgs(owner1.address, 0, receiver.address, value, "0x");

      expect(await wallet.getTransactionCount()).to.equal(1);

      const tx = await wallet.getTransaction(0);
      expect(tx.to).to.equal(receiver.address);
      expect(tx.value).to.equal(value);
      expect(tx.executed).to.be.false;
      expect(tx.numConfirmations).to.equal(0);
    });

    it("should revert if a non-owner submits a transaction", async function () {
      await expect(
        wallet.connect(nonOwner).submitTransaction(receiver.address, 0, "0x")
      ).to.be.revertedWith("not owner");
    });

    it("should allow multiple transactions to be submitted", async function () {
      await wallet.submitTransaction(receiver.address, 100, "0x");
      await wallet.submitTransaction(receiver.address, 200, "0x");
      expect(await wallet.getTransactionCount()).to.equal(2);
    });
  });

  describe("confirmTransaction", function () {
    beforeEach(async function () {
      await wallet.submitTransaction(
        receiver.address,
        ethers.parseEther("1"),
        "0x"
      );
    });

    it("should allow an owner to confirm a transaction", async function () {
      await expect(wallet.confirmTransaction(0))
        .to.emit(wallet, "ConfirmTransaction")
        .withArgs(owner1.address, 0);

      const tx = await wallet.getTransaction(0);
      expect(tx.numConfirmations).to.equal(1);
      expect(await wallet.isConfirmed(0, owner1.address)).to.be.true;
    });

    it("should allow multiple owners to confirm", async function () {
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);

      const tx = await wallet.getTransaction(0);
      expect(tx.numConfirmations).to.equal(2);
    });

    it("should revert if an owner confirms the same tx twice (duplicate)", async function () {
      await wallet.confirmTransaction(0);
      await expect(wallet.confirmTransaction(0)).to.be.revertedWith(
        "tx already confirmed"
      );
    });

    it("should revert if a non-owner tries to confirm", async function () {
      await expect(
        wallet.connect(nonOwner).confirmTransaction(0)
      ).to.be.revertedWith("not owner");
    });

    it("should revert for a non-existent transaction", async function () {
      await expect(wallet.confirmTransaction(999)).to.be.revertedWith(
        "tx does not exist"
      );
    });

    it("should revert if the transaction is already executed", async function () {
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      await expect(
        wallet.connect(owner3).confirmTransaction(0)
      ).to.be.revertedWith("tx already executed");
    });
  });

  describe("executeTransaction", function () {
    const SEND_VALUE = ethers.parseEther("1");

    beforeEach(async function () {
      await wallet.submitTransaction(receiver.address, SEND_VALUE, "0x");
    });

    it("should execute a transaction after enough confirmations", async function () {
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);

      const balanceBefore = await ethers.provider.getBalance(receiver.address);

      await expect(wallet.executeTransaction(0))
        .to.emit(wallet, "ExecuteTransaction")
        .withArgs(owner1.address, 0);

      const balanceAfter = await ethers.provider.getBalance(receiver.address);
      expect(balanceAfter - balanceBefore).to.equal(SEND_VALUE);

      const tx = await wallet.getTransaction(0);
      expect(tx.executed).to.be.true;
    });

    it("should revert if not enough confirmations", async function () {
      await wallet.confirmTransaction(0); 
      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "cannot execute tx"
      );
    });

    it("should revert if a non-owner tries to execute", async function () {
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await expect(
        wallet.connect(nonOwner).executeTransaction(0)
      ).to.be.revertedWith("not owner");
    });

    it("should revert if already executed (no double execution)", async function () {
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);
      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "tx already executed"
      );
    });

    it("should revert for a non-existent transaction", async function () {
      await expect(wallet.executeTransaction(999)).to.be.revertedWith(
        "tx does not exist"
      );
    });

    it("should revert if the low-level call fails (e.g., receiver reverts)", async function () {
      const RejecterFactory = await ethers.getContractFactory("Rejecter");
      const rejecter = await RejecterFactory.deploy();

      await wallet.submitTransaction(
        rejecter.target,
        ethers.parseEther("1"),
        "0x"
      );
      const txIndex = 1;

      await wallet.confirmTransaction(txIndex);
      await wallet.connect(owner2).confirmTransaction(txIndex);

      await expect(wallet.executeTransaction(txIndex)).to.be.revertedWith(
        "tx failed"
      );
    });
  });

  describe("revokeConfirmation", function () {
    beforeEach(async function () {
      await wallet.submitTransaction(
        receiver.address,
        ethers.parseEther("1"),
        "0x"
      );
      await wallet.confirmTransaction(0);
    });

    it("should allow an owner to revoke their confirmation", async function () {
      await expect(wallet.revokeConfirmation(0))
        .to.emit(wallet, "RevokeConfirmation")
        .withArgs(owner1.address, 0);

      const tx = await wallet.getTransaction(0);
      expect(tx.numConfirmations).to.equal(0);
      expect(await wallet.isConfirmed(0, owner1.address)).to.be.false;
    });

    it("should revert if the owner has not confirmed", async function () {
      await expect(
        wallet.connect(owner2).revokeConfirmation(0)
      ).to.be.revertedWith("tx not confirmed");
    });

    it("should revert if a non-owner tries to revoke", async function () {
      await expect(
        wallet.connect(nonOwner).revokeConfirmation(0)
      ).to.be.revertedWith("not owner");
    });

    it("should revert for a non-existent transaction", async function () {
      await expect(wallet.revokeConfirmation(999)).to.be.revertedWith(
        "tx does not exist"
      );
    });

    it("should revert if the transaction is already executed", async function () {
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);
      await expect(wallet.revokeConfirmation(0)).to.be.revertedWith(
        "tx already executed"
      );
    });

    it("should prevent execution after revoking a critical confirmation", async function () {
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.connect(owner2).revokeConfirmation(0);

      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "cannot execute tx"
      );
    });
  });


  describe("Owner management (addOwner / removeOwner / changeRequirement)", function () {
    it("should add a new owner via multisig transaction", async function () {
      const data = wallet.interface.encodeFunctionData("addOwner", [
        nonOwner.address,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      expect(await wallet.isOwner(nonOwner.address)).to.be.true;
      const owners = await wallet.getOwners();
      expect(owners.length).to.equal(4);
    });

    it("should revert addOwner if called directly (not via multisig)", async function () {
      await expect(wallet.addOwner(nonOwner.address)).to.be.revertedWith(
        "must be called via multisig tx"
      );
    });

    it("should remove an owner via multisig transaction", async function () {
      const data = wallet.interface.encodeFunctionData("removeOwner", [
        owner3.address,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      expect(await wallet.isOwner(owner3.address)).to.be.false;
      const owners = await wallet.getOwners();
      expect(owners.length).to.equal(2);
    });

    it("should auto-lower requirement when removing owner makes it too high", async function () {
      const data1 = wallet.interface.encodeFunctionData("removeOwner", [
        owner3.address,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data1);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      const data2 = wallet.interface.encodeFunctionData("removeOwner", [
        owner2.address,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data2);
      await wallet.confirmTransaction(1);
      await wallet.connect(owner2).confirmTransaction(1);
      await wallet.executeTransaction(1);

      expect(await wallet.numConfirmationsRequired()).to.equal(1);
    });

    it("should change requirement via multisig", async function () {
      const data = wallet.interface.encodeFunctionData("changeRequirement", [
        3,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      expect(await wallet.numConfirmationsRequired()).to.equal(3);
    });

    it("should revert changeRequirement with invalid value", async function () {
      const data = wallet.interface.encodeFunctionData("changeRequirement", [
        0,
      ]);
      await wallet.submitTransaction(wallet.target, 0, data);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "tx failed"
      );
    });
  });


  describe("View functions", function () {
    it("getTransactionCount returns 0 initially", async function () {
      expect(await wallet.getTransactionCount()).to.equal(0);
    });

    it("getTransaction returns correct data", async function () {
      const calldata = "0xabcdef";
      await wallet.submitTransaction(receiver.address, 42, calldata);
      const tx = await wallet.getTransaction(0);
      expect(tx.to).to.equal(receiver.address);
      expect(tx.value).to.equal(42);
      expect(tx.data).to.equal(calldata);
      expect(tx.executed).to.be.false;
      expect(tx.numConfirmations).to.equal(0);
    });

    it("owners(index) returns correct owner", async function () {
      expect(await wallet.owners(0)).to.equal(owner1.address);
      expect(await wallet.owners(1)).to.equal(owner2.address);
      expect(await wallet.owners(2)).to.equal(owner3.address);
    });
  });


  describe("Transaction with calldata", function () {
    it("should execute a transaction that calls another contract", async function () {
      const CounterFactory = await ethers.getContractFactory("Counter");
      const counter = await CounterFactory.deploy();

      const data = counter.interface.encodeFunctionData("increment");

      await wallet.submitTransaction(counter.target, 0, data);
      await wallet.confirmTransaction(0);
      await wallet.connect(owner2).confirmTransaction(0);
      await wallet.executeTransaction(0);

      expect(await counter.count()).to.equal(1);
    });
  });
});
