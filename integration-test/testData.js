import config from 'config';
import utils from 'nightlite-utils';

const { leftPadHex } = utils;
const LEAF_HASHLENGTH = config.get('LEAF_HASHLENGTH');

function parseMintCommitments(erc20, type, user) {
  return erc20[type].mintCommitments.map(value => {
    return {
      value: leftPadHex(value.toString(16), 32),
      get commitment() {
        return utils.shaHash(
          utils.strip0x(erc20.contractAddress).padStart(64, '0'),
          utils.strip0x(this.value),
          utils.strip0x(user.pk),
          this.salt === undefined ? '0' : utils.strip0x(this.salt), // S_A - set at erc-20 commitment mint (step 18)
        );
      },
    };
  });
}

function parseTransferCommitments(erc20, type, user) {
  return erc20[type].transferCommitments.map(value => {
    return {
      value: leftPadHex(value.toString(16), 32),
      receiver: { name: user.name },
      get commitment() {
        return utils.shaHash(
          utils.strip0x(erc20.contractAddress).padStart(64, '0'),
          utils.strip0x(this.value),
          utils.strip0x(user.pk),
          this.salt === undefined ? '0' : utils.strip0x(this.salt), // S_A - set at erc-20 commitment mint (step 18)
        );
      },
    };
  });
}

// test data.
export default {
  alice: {
    name: 'alice',
    email: 'alice@ey.com',
    password: 'pass',
    get pk() {
      return this.secretKey === undefined
        ? undefined
        : utils.shaHash(utils.strip0x(this.secretKey)); // secretKey - set at login test suit (step 2)
    },
  },
  bob: {
    name: 'bob',
    email: 'bob@ey.com',
    password: 'pass',
    get pk() {
      return this.secretKey === undefined
        ? undefined
        : utils.shaHash(utils.strip0x(this.secretKey)); // secretKey - set at login test suit (step 2)
    },
  },
  erc721: {
    contractAddress: '',
    tokenUri: 'one',
  },
  erc20: {
    contractAddress: '',
    mint: 100,
    transfer: {
      mintCommitments: [2, 3],
      transferCommitment: 4,
      get changeCommitment() {
        return this.mintCommitments.reduce((a, b) => a + b, -this.transferCommitment);
      },
    },
    batchTransfer: {
      mintCommitment: 50,
      transferCommitments: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4],
    },
  },

  // dependent data
  async erc721CommitmentTransfer() {
    const { alice, bob, erc721 } = this;
    return {
      tokenUri: erc721.tokenUri,
      get tokenId() {
        return erc721.tokenId;
      },
      // commitment while mint
      get mintCommitment() {
        return utils.shaHash(
          utils.strip0x(erc721.contractAddress).padStart(64, '0'),
          utils.strip0x(this.tokenId).slice(-(LEAF_HASHLENGTH * 2)),
          utils.strip0x(alice.pk),
          utils.strip0x(this.salt), // salt - set at erc-721 commitment mint (step 4)
        );
      },

      // commitment while transfer
      get transferCommitment() {
        return utils.shaHash(
          utils.strip0x(erc721.contractAddress).padStart(64, '0'),
          utils.strip0x(this.tokenId).slice(-(LEAF_HASHLENGTH * 2)),
          utils.strip0x(bob.pk),
          utils.strip0x(this.transferredSalt), // S_B - set at erc-721 commitment transfer to bob (step 5)
        );
      },
      get transferCommitmentIndex() {
        return this.mintCommitmentIndex + 1;
      },
    };
  },

  // dependent data
  async erc20CommitmentTransfer() {
    const { alice, bob, erc20 } = this;
    return {
      mintCommitments: parseMintCommitments(erc20, 'transfer', alice),
      transferCommitment: {
        value: leftPadHex(erc20.transfer.transferCommitment.toString(16), 32),
        get commitment() {
          return utils.shaHash(
            utils.strip0x(erc20.contractAddress).padStart(64, '0'),
            utils.strip0x(this.value),
            utils.strip0x(bob.pk),
            this.salt === undefined ? '0x0' : utils.strip0x(this.salt), // S_E - set at erc-20 commitment transfer (step 12)
          );
        },
      },
      changeCommitment: {
        value: leftPadHex(erc20.transfer.changeCommitment.toString(16), 32),
        get commitment() {
          return utils.shaHash(
            utils.strip0x(erc20.contractAddress).padStart(64, '0'),
            utils.strip0x(this.value),
            utils.strip0x(alice.pk),
            this.salt === undefined ? '0x0' : utils.strip0x(this.salt), // S_F - set at erc-20 commitment transfer (step 12)
          );
        },
      },
    };
  },

  // dependent data
  async erc20CommitmentBatchTransfer() {
    const { alice, bob, erc20 } = this;
    return {
      mintCommitment: {
        value: leftPadHex(erc20.batchTransfer.mintCommitment.toString(16), 32),
        get commitment() {
          return utils.shaHash(
            utils.strip0x(erc20.contractAddress).padStart(64, '0'),
            utils.strip0x(this.value),
            utils.strip0x(alice.pk),
            this.salt === undefined ? '0x0' : utils.strip0x(this.salt), // S_A - set at erc-20 commitment mint (step 18)
          );
        },
      },
      transferCommitments: parseTransferCommitments(erc20, 'batchTransfer', bob),
    };
  },

  // dependent data
  async erc20CommitmentConsolidationTransfer() {
    const { alice, erc20, erc20CommitmentBatchTransfer } = this;
    return {
      mintCommitments: erc20CommitmentBatchTransfer.transferCommitments,
      transferCommitment: {
        get value() {
          return leftPadHex(erc20.batchTransfer.mintCommitment.toString(16), 32);
        },
        get commitment() {
          return utils.shaHash(
            utils.strip0x(erc20.contractAddress).padStart(64, '0'),
            utils.strip0x(this.value),
            utils.strip0x(alice.pk),
            this.salt === undefined ? '0x0' : utils.strip0x(this.salt), // S_E - set at erc-20 commitment transfer (step 12)
          );
        },
      },
    };
  },

  /*
   *  This function will configure dependent test data.
   */
  async configureDependentTestData() {
    this.erc721CommitmentTransfer = await this.erc721CommitmentTransfer();
    this.erc20CommitmentTransfer = await this.erc20CommitmentTransfer();
    this.erc20CommitmentBatchTransfer = await this.erc20CommitmentBatchTransfer();
    this.erc20CommitmentConsolidationTransfer = await this.erc20CommitmentConsolidationTransfer();
  },
};
