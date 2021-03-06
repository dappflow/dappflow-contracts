const {expectBignumberEqual, expect} = require('../../../helpers');
const {toHex, hexToBytes, getTokens, shouldFailWithMessage} = require('../../helpers/utils');
const {getTclActors} = require('../../helpers/address');
const {deployAndSetupCng1400} = require('../../helpers/deploy');
const {setupCountryLimitCheckpoint} = require('../utils');

contract('erc1594: transferFrom', accounts => {
  let cng1400;
  let blockedAccountCheckpoint;

  const {
    issuer,
    authorisedHolder,
    dodgyGuy,
    mainController
  } = getTclActors(accounts);
  const EMPTY_DATA = hexToBytes(toHex('empty_bytes_data'));

  beforeEach(async () => {
    ({cng1400, blockedAccountCheckpoint} = await deployAndSetupCng1400(accounts));
  });

  it('should revert beneficiary is not authorised', async () => {
    await cng1400.issue(authorisedHolder, getTokens(100), EMPTY_DATA, {from: issuer});
    await cng1400.approve(issuer, getTokens(100), {from: authorisedHolder});

    await shouldFailWithMessage(
      cng1400.transferFrom.call(
        authorisedHolder, 
        dodgyGuy, 
        getTokens(100), 
        {from: authorisedHolder}
      ),
      'RECIPIENT_BLOCKED'
    );
  });

  it('should revert if holder is not authorised anymore', async () => {
    await cng1400.issue(authorisedHolder, getTokens(100), EMPTY_DATA, {from: issuer});
    await cng1400.approve(issuer, getTokens(100), {from: authorisedHolder});
    await blockedAccountCheckpoint.blockAccount(authorisedHolder, {from: mainController});

    await shouldFailWithMessage(
      cng1400.transferFrom.call(
        authorisedHolder, 
        issuer, 
        getTokens(100), 
        {from: authorisedHolder}
      ),
      'SENDER_BLOCKED'
    );
  });

  it('should transferFrom tokens correctly', async () => {
    await cng1400.issue(authorisedHolder, getTokens(100), EMPTY_DATA, {from: issuer});
    await cng1400.approve(issuer, getTokens(100), {from: authorisedHolder});
    await cng1400.transferFrom(authorisedHolder, issuer, getTokens(100), {from: issuer});

    const balance = await cng1400.balanceOf(issuer);
    expectBignumberEqual(balance, getTokens(100));
  });

  it('should revert if the recipient is from a country that has reached the limit (i.e. countryLimitCheckpoint)', async () => {
    const sender = accounts[2];
    const recipient = accounts[3];
    const recipient2 = accounts[4];
    
    const {cng1400} = await setupCountryLimitCheckpoint(accounts, sender, recipient, recipient2);

    // limit for the sender and recipient country is 2
    await cng1400.issue(sender, getTokens(200), EMPTY_DATA, {from: issuer});
    await cng1400.approve(issuer, getTokens(100), {from: sender});
    await cng1400.transferFrom(sender, recipient, getTokens(100), {from: issuer});
    await cng1400.approve(issuer, getTokens(100), {from: recipient});

    await shouldFailWithMessage(
      cng1400.transferFrom.call(recipient, recipient2, getTokens(50), {from: issuer}),
      'RECIPIENT_COUNTRY_LIMIT'
    );
  });
});
