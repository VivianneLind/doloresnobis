const { expect } = require('chai');
const { deployMockContract } = require('@ethereum-waffle/mock-contract');

const { describeFilter } = require('@solidstate/library/mocha_describe_filter.js');

const describeBehaviorOfERC165 = require('../../introspection/ERC165.behavior.js');

const describeBehaviorOfDiamondCuttable = function ({ deploy, getOwner, getNonOwner }, skips) {
  const describe = describeFilter(skips);

  describe('::DiamondCuttable', function () {
    let owner, nonOwner;

    const functions = [];
    const selectors = [];
    let abi;
    let facet;

    let instance;

    before(async function () {
      owner = await getOwner();
      nonOwner = await getNonOwner();

      for (let i = 0; i < 24; i++) {
        const fn = `fn${ i }()`;
        functions.push(fn);
        selectors.push(ethers.utils.hexDataSlice(
          ethers.utils.solidityKeccak256(['string'], [fn]), 0, 4
        ));
      }

      abi = functions.map(fn => `function ${ fn }`);

      facet = await deployMockContract(owner, abi);
    });

    beforeEach(async function () {
      instance = await ethers.getContractAt('DiamondCuttable', (await deploy()).address);
    });

    // eslint-disable-next-line mocha/no-setup-in-describe
    describeBehaviorOfERC165({
      deploy: () => instance,
      interfaceIds: ['0x1f931c1c'],
    }, skips);

    describe('#diamondCut', function () {
      it('emits DiamondCut event', async function () {
        const args = [
          [
            [
              facet.address,
              0,
              [ethers.utils.hexlify(ethers.utils.randomBytes(4))],
            ],
          ],
          ethers.constants.AddressZero,
          '0x',
        ];

        let tx = instance.connect(owner).diamondCut(...args);

        await expect(
          tx
        ).to.emit(
          instance,
          'DiamondCut'
        );

        expect(
          (await (await tx).wait()).events[0].args
        ).to.deep.equal(
          args
        );
      });

      describe('using FacetCutAction ADD', function () {
        it('adds facet', async function () {
          const contract = new ethers.Contract(
            instance.address,
            abi,
            ethers.provider
          );

          for (let fn of functions) {
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'DiamondBase: no facet found for function signature'
            );
          }

          await instance.connect(owner).diamondCut(
            [
              { target: facet.address, action: 0, selectors },
            ],
            ethers.constants.AddressZero,
            '0x'
          );

          for (let fn of functions) {
            // call reverts, but with mock-specific message
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'Mock on the method is not initialized'
            );
          }
        });

        describe('reverts if', function () {
          it('target facet is not a contract', async function () {
            await expect (
              instance.connect(owner).diamondCut(
                [
                  {
                    target: ethers.constants.AddressZero,
                    action: 0,
                    selectors: [ethers.utils.randomBytes(4)],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: ADD target has no code'
            );
          });

          it('selector has already been added', async function () {
            const facetCuts = [
              {
                target: facet.address,
                action: 0,
                selectors: [ethers.utils.randomBytes(4)],
              },
            ];

            await instance.connect(owner).diamondCut(
              facetCuts,
              ethers.constants.AddressZero,
              '0x'
            );

            await expect (
              instance.connect(owner).diamondCut(
                facetCuts,
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: selector already added'
            );
          });
        });
      });

      describe('using FacetCutAction REMOVE', function () {
        it('removes facet', async function () {
          const contract = new ethers.Contract(
            instance.address,
            abi,
            ethers.provider
          );

          await instance.connect(owner).diamondCut(
            [
              { target: facet.address, action: 0, selectors },
            ],
            ethers.constants.AddressZero,
            '0x'
          );

          for (let fn of functions) {
            // call reverts, but with mock-specific message
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'Mock on the method is not initialized'
            );
          }

          await instance.connect(owner).diamondCut(
            [
              { target: ethers.constants.AddressZero, action: 2, selectors },
            ],
            ethers.constants.AddressZero,
            '0x'
          );

          for (let fn of functions) {
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'DiamondBase: no facet found for function signature'
            );
          }
        });

        describe('reverts if', function () {
          it('target address is not zero address', async function () {
            await expect(
              instance.connect(owner).diamondCut(
                [
                  {
                    target: instance.address,
                    action: 2,
                    selectors: [ethers.utils.randomBytes(4)],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: REMOVE target must be zero address'
            );
          });

          it('selector has not been added', async function () {
            await expect(
              instance.connect(owner).diamondCut(
                [
                  {
                    target: ethers.constants.AddressZero,
                    action: 2,
                    selectors: [ethers.utils.randomBytes(4)],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: selector not found'
            );
          });

          it('selector is immutable', async function () {
            const selector = ethers.utils.randomBytes(4);

            await instance.connect(owner).diamondCut(
              [
                {
                  target: instance.address,
                  action: 0,
                  selectors: [selector],
                },
              ],
              ethers.constants.AddressZero,
              '0x'
            );

            await expect (
              instance.connect(owner).diamondCut(
                [
                  {
                    target: ethers.constants.AddressZero,
                    action: 2,
                    selectors: [selector],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: selector is immutable'
            );
          });
        });
      });

      describe('using FacetCutAction REPLACE', function () {
        it('replaces facet', async function () {
          const contract = new ethers.Contract(
            instance.address,
            abi,
            ethers.provider
          );

          await instance.connect(owner).diamondCut(
            [
              { target: facet.address, action: 0, selectors },
            ],
            ethers.constants.AddressZero,
            '0x'
          );

          for (let fn of functions) {
            // call reverts, but with mock-specific message
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'Mock on the method is not initialized'
            );
          }

          const facetReplacement = await deployMockContract(owner, abi);

          for (let fn of functions) {
            expect(facetReplacement[fn]).not.to.be.undefined;
          }

          await instance.connect(owner).diamondCut(
            [
              { target: facetReplacement.address, action: 1, selectors },
            ],
            ethers.constants.AddressZero,
            '0x'
          );

          for (let fn of functions) {
            // call reverts, but with mock-specific message
            await expect(
              contract.callStatic[fn]()
            ).to.be.revertedWith(
              'Mock on the method is not initialized'
            );
          }
        });

        describe('reverts if', function () {
          it('target facet is not a contract', async function () {
            await expect (
              instance.connect(owner).diamondCut(
                [
                  {
                    target: ethers.constants.AddressZero,
                    action: 1,
                    selectors: [ethers.utils.randomBytes(4)],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: REPLACE target has no code'
            );
          });

          it('selector has not been added', async function () {
            await expect(
              instance.connect(owner).diamondCut(
                [
                  {
                    target: facet.address,
                    action: 1,
                    selectors: [ethers.utils.randomBytes(4)],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: selector not found'
            );
          });

          it('selector is immutable', async function () {
            const selector = ethers.utils.randomBytes(4);

            await instance.connect(owner).diamondCut(
              [
                {
                  target: instance.address,
                  action: 0,
                  selectors: [selector],
                },
              ],
              ethers.constants.AddressZero,
              '0x'
            );

            await expect (
              instance.connect(owner).diamondCut(
                [
                  {
                    target: facet.address,
                    action: 1,
                    selectors: [selector],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: selector is immutable'
            );
          });

          it('replacement facet is same as existing facet', async function () {
            const selector = ethers.utils.randomBytes(4);

            await instance.connect(owner).diamondCut(
              [
                {
                  target: facet.address,
                  action: 0,
                  selectors: [selector],
                },
              ],
              ethers.constants.AddressZero,
              '0x'
            );

            await expect (
              instance.connect(owner).diamondCut(
                [
                  {
                    target: facet.address,
                    action: 1,
                    selectors: [selector],
                  },
                ],
                ethers.constants.AddressZero,
                '0x'
              )
            ).to.be.revertedWith(
              'DiamondBase: REPLACE target is identical'
            );
          });
        });
      });

      describe('reverts if', function () {
        it('sender is not owner', async function () {
          await expect(
            instance.connect(nonOwner).diamondCut([], ethers.constants.AddressZero, '0x')
          ).to.be.revertedWith(
            'Ownable: sender must be owner'
          );
        });

        it('passed FacetCutAction is invalid', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [
                {
                  target: ethers.constants.AddressZero,
                  action: 3,
                  selectors: [],
                },
              ],
              ethers.constants.AddressZero,
              '0x'
            )
          ).to.be.revertedWith(
            'Hardhat couldn\'t infer the reason. Please report this to help us improve Hardhat.'
          );
        });

        it('passed selector array is empty', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [
                {
                  target: ethers.constants.AddressZero,
                  action: 0,
                  selectors: [],
                },
              ],
              ethers.constants.AddressZero,
              '0x'
            )
          ).to.be.revertedWith(
            'DiamondBase: no selectors specified'
          );
        });

        it('initialization target is provided but data is not', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [],
              facet.address,
              '0x'
            )
          ).to.be.revertedWith(
            'DiamondBase: invalid initialization parameters'
          );
        });

        it('initialization data is provided but target is not', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [],
              ethers.constants.AddressZero,
              '0x01'
            )
          ).to.be.revertedWith(
            'DiamondBase: invalid initialization parameters'
          );
        });

        it('initialization target has no code', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [],
              owner.address,
              '0x01'
            )
          ).to.be.revertedWith(
            'DiamondBase: initialization target has no code'
          );
        });

        it('initialization function reverts', async function () {
          await expect(
            instance.connect(owner).diamondCut(
              [],
              facet.address,
              '0x01'
            )
          ).to.be.revertedWith(
            'Mock on the method is not initialized'
          );
        });
      });
    });
  });
};

// eslint-disable-next-line mocha/no-exports
module.exports = describeBehaviorOfDiamondCuttable;
