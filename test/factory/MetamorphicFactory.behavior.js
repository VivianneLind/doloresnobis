const { expect } = require('chai');

const { describeFilter } = require('@solidstate/library/mocha_describe_filter.js');

const describeBehaviorOfFactory = require('./Factory.behavior.js');

const describeBehaviorOfMetamorphicFactory = function ({ deploy }, skips) {
  const describe = describeFilter(skips);

  describe('::MetamorphicFactory', function () {
    let instance;

    beforeEach(async function () {
      instance = await ethers.getContractAt('MetamorphicFactory', (await deploy()).address);
    });

    // eslint-disable-next-line mocha/no-setup-in-describe
    describeBehaviorOfFactory({}, skips);

    describe('#getMetamorphicImplementation', function () {
      // behavior changes during internal call but cannot be tested independently
      it('returns zero address', async function () {
        expect(
          await instance.callStatic.getMetamorphicImplementation()
        ).to.equal(ethers.constants.AddressZero);
      });
    });
  });
};

// eslint-disable-next-line mocha/no-exports
module.exports = describeBehaviorOfMetamorphicFactory;
